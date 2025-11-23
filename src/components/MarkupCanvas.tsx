/**
 * MarkupCanvas - Viewport-based PDF markup editor
 * 
 * REFACTORED FROM FABRIC.JS TO VIEWPORT SYSTEM (2024)
 * 
 * This component was completely refactored to replace Fabric.js canvas rendering
 * with a native document viewer-style viewport system. Key changes:
 * 
 * 1. REMOVED FABRIC.JS DEPENDENCIES:
 *    - No longer uses Fabric.js Canvas, Circle, Rect, Group, etc.
 *    - Removed all Fabric.js event handlers and object management
 *    - Reduced from ~1460 lines to ~1100 lines
 * 
 * 2. NEW VIEWPORT-BASED ARCHITECTURE:
 *    - Uses PDFAnnotationPage component for rendering PDF pages
 *    - Viewport-based scrolling (native HTML scroll) instead of Fabric transforms
 *    - Gray background with centered pages, mimicking native PDF viewers
 *    - Page geometry tracked via PageGeometry interface
 * 
 * 3. ANNOTATION SYSTEM:
 *    - Piles and footings converted to Annotation[] format
 *    - All annotations stored in normalized coordinates (0..1 range)
 *    - Custom renderers: PileMarkerRenderer, FootingRenderer
 *    - Annotations positioned via overlay divs above PDF canvas
 * 
 * 4. COORDINATE SYSTEM:
 *    - Uses screenToNorm() and normToScreen() from coordinateUtils.ts
 *    - All coordinates normalized to PDF page dimensions (0..1)
 *    - Zoom and pan handled via CSS transforms and viewport scrolling
 *    - Coordinates persist correctly across zoom/pan changes
 * 
 * 5. INTERACTIONS:
 *    - Pile tool: Click to place piles (converts to normalized coords)
 *    - Footing tool: Drag to create rectangles
 *    - Select tool: Click to select, drag to move annotations
 *    - Pan tool: Middle mouse or pan tool to drag viewport
 *    - Zoom: Ctrl/Cmd + scroll, zooms to mouse position
 * 
 * 6. EXPORT SYSTEM:
 *    - Uses exportAnnotationsToPDF() from pdfExportNew.ts
 *    - Draws annotations directly onto original PDF using pdf-lib
 *    - Supports exporting single page or all pages
 *    - Includes summary box overlay when available
 * 
 * MAINTAINED FEATURES:
 * - All editing functionality (create, move, delete piles/footings)
 * - Context menu, keyboard shortcuts (Delete, Undo/Redo)
 * - Selection, multi-select, dragging
 * - History/undo-redo system
 * - FloatingProjectSummary integration (pin functionality)
 * - Export with summary box
 */

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PileColors } from "@/components/PileColorSettings";
import PileContextMenu from "@/components/PileContextMenu";
import { exportAnnotationsToPDF } from "@/lib/pdfExportNew";
import { HistoryAction } from "@/hooks/useHistory";
import { Annotation } from "@/lib/annotations";
import { PDFAnnotationPage } from "./PDFAnnotationPage";
import { screenToNorm, PageGeometry, normToScreen } from "@/utils/coordinateUtils";
import { PileMarkerRenderer } from "./annotation-renderers/PileMarkerRenderer";
import { FootingRenderer } from "./annotation-renderers/FootingRenderer";
import "./PDFViewer.css";

// Configure PDF.js worker immediately when module loads
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface MarkupCanvasProps {
  pages: any[];
  currentPageIndex: number;
  activeTool: string;
  piles: any[];
  footings: any[];
  onObjectSelect: (obj: any) => void;
  onMarkupsChange: () => void;
  onPilesUpdate: (piles: any[]) => void;
  onFootingsUpdate: (footings: any[]) => void;
  onSelectedPilesChange: (pileIds: string[]) => void;
  pileConfig: {
    pileType: string;
    bladeSize: string;
    length: string;
    extension: string;
    nextPileNumber: number;
    scale: number;
    customColor: string | null;
  };
  footingConfig: {
    footingType: string;
    drawingMode: string;
    opacity: number;
  };
  onPileNumberUpdate: (num: number) => void;
  pileColors: PileColors;
  projectName: string;
  onHistoryAdd: (action: HistoryAction) => void;
  onUndo: () => void;
  onRedo: () => void;
  footingColors: any;
}

export default function MarkupCanvas({
  pages,
  currentPageIndex,
  activeTool,
  piles,
  footings,
  onObjectSelect,
  onMarkupsChange,
  onPilesUpdate,
  onFootingsUpdate,
  onSelectedPilesChange,
  pileConfig,
  footingConfig,
  onPileNumberUpdate,
  pileColors,
  projectName,
  onHistoryAdd,
  onUndo,
  onRedo,
  footingColors,
}: MarkupCanvasProps) {
  // ============================================================================
  // VIEWPORT REFS AND STATE
  // ============================================================================
  
  // Viewport refs - the scrollable container that holds the PDF page
  const viewportRef = useRef<HTMLDivElement>(null); // Main scrollable viewport
  const containerRef = useRef<HTMLDivElement>(null); // Outer container wrapper
  
  // PDF and page state
  const [pdfDoc, setPdfDoc] = useState<any>(null); // pdf.js document object
  const [pdfPages, setPdfPages] = useState<Map<string, any>>(new Map()); // Cache of pdf.js page objects by pageId
  const [currentPdfPage, setCurrentPdfPage] = useState<any>(null); // Current pdf.js page object being displayed
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null); // Resolved/signed URL for PDF access
  const [zoom, setZoom] = useState(1.5); // Zoom level (1.0 = 100%, 1.5 = 150%, etc.)
  const [loading, setLoading] = useState(true); // PDF loading state
  const [pageGeometry, setPageGeometry] = useState<PageGeometry | null>(null); // Current page geometry (size, position, zoom) - used for coordinate conversion
  
  // ============================================================================
  // DRAWING AND INTERACTION STATE
  // ============================================================================
  
  // Footing drawing state - tracks when user is drawing a footing rectangle
  const [isDrawingFooting, setIsDrawingFooting] = useState(false);
  const [footingStart, setFootingStart] = useState<{ x: number; y: number } | null>(null); // Starting point of footing drag (in viewport coordinates)
  const [tempFootingRect, setTempFootingRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null); // Temporary rectangle shown during drag
  
  // Selection and UI state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; selectedIds: string[] } | null>(null); // Context menu position and selected pile IDs
  const [selectedAnnotationIds, setSelectedAnnotationIds] = useState<Set<string>>(new Set()); // Currently selected annotation IDs
  const [draggingAnnotation, setDraggingAnnotation] = useState<{ id: string; type: 'pile' | 'footing'; startX: number; startY: number; startNormX: number; startNormY: number } | null>(null); // Annotation being dragged
  
  // Pan state - for dragging the viewport to pan around
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState<{ x: number; y: number } | null>(null);
  
  const { session } = useAuth();
  
  // Cache PDF document and signed URLs
  const pdfDocCacheRef = useRef<Map<string, any>>(new Map());
  const signedUrlCacheRef = useRef<Map<string, string>>(new Map());
  
  // Use refs to always have latest data (avoid stale closures)
  const pilesRef = useRef(piles);
  const footingsRef = useRef(footings);
  const lastClickRef = useRef<{ x: number; y: number; timestamp: number } | null>(null);
  
  useEffect(() => {
    pilesRef.current = piles;
  }, [piles]);
  
  useEffect(() => {
    footingsRef.current = footings;
  }, [footings]);
  
  // Get current page and filter markups for current page
  const currentPage = pages[currentPageIndex];
  const currentPagePiles = piles.filter(p => p.page_id === currentPage?.id);
  const currentPageFootings = footings.filter(f => f.page_id === currentPage?.id);
  
  // ============================================================================
  // ANNOTATION CONVERSION
  // ============================================================================
  // 
  // Converts piles and footings from database format to Annotation[] format
  // for rendering. Uses normalized coordinates (0..1 range relative to PDF page).
  // 
  // Key points:
  // - If piles/footings have xNorm/yNorm, uses them directly
  // - Otherwise, converts legacy pixel coordinates to normalized
  // - All coordinates stored relative to PDF page dimensions (not screen pixels)
  // - This ensures annotations stay aligned during zoom/pan
  //
  const annotations = useMemo(() => {
    if (!currentPdfPage) {
      console.log('⚠️ No currentPdfPage, returning empty annotations');
      return [];
    }
    
    // Get PDF page viewport at scale 1 (natural size) for coordinate conversion
    const viewport = currentPdfPage.getViewport({ scale: 1 });
    const pageIndex = currentPageIndex;
    const result: Annotation[] = [];
    
    console.log(`📊 Converting annotations: ${currentPagePiles.length} piles, ${currentPageFootings.length} footings`);
    
    // Convert piles to annotations
    currentPagePiles.forEach((pile) => {
      // Use normalized coords if available, otherwise convert from pixel coords
      let xNorm: number, yNorm: number;
      
      if ((pile as any).xNorm !== undefined && (pile as any).yNorm !== undefined) {
        xNorm = (pile as any).xNorm;
        yNorm = (pile as any).yNorm;
      } else {
        // Convert legacy pixel coordinates to normalized
        // Assuming base scale of 3 for rendering
        const baseScale = 3;
        const viewport = currentPdfPage.getViewport({ scale: 1 });
        xNorm = pile.position_x / (viewport.width * baseScale);
        yNorm = pile.position_y / (viewport.height * baseScale);
      }
      
      const radius = pile.radius || 15;
      const diameterNorm = (radius * 2) / viewport.width;
      
      result.push({
        id: pile.id,
        pageIndex,
        type: "pile_marker",
        xNorm,
        yNorm,
        widthNorm: diameterNorm,
        heightNorm: diameterNorm,
        color: pile.color || undefined,
        meta: {
          pile_type: pile.pile_type,
          blade_size: pile.blade_size,
          length: pile.length,
          extension: pile.extension,
          radius,
          number: pile.number,
          is_custom: pile.is_custom,
          min_depth: (pile as any).min_depth,
          min_torque: (pile as any).min_torque,
        },
      });
    });
    
    // Convert footings to annotations
    currentPageFootings.forEach((footing) => {
      let xNorm: number, yNorm: number, widthNorm: number, heightNorm: number;
      
      if ((footing as any).xNorm !== undefined && (footing as any).yNorm !== undefined) {
        xNorm = (footing as any).xNorm;
        yNorm = (footing as any).yNorm;
        widthNorm = (footing as any).widthNorm || 0;
        heightNorm = (footing as any).heightNorm || 0;
      } else if (footing.coordinates && footing.coordinates.length === 2) {
        // Convert legacy pixel coordinates to normalized
        const baseScale = 3;
        const viewport = currentPdfPage.getViewport({ scale: 1 });
        const [start, end] = footing.coordinates;
        
        const startXNorm = start.x / (viewport.width * baseScale);
        const startYNorm = start.y / (viewport.height * baseScale);
        const endXNorm = end.x / (viewport.width * baseScale);
        const endYNorm = end.y / (viewport.height * baseScale);
        
        widthNorm = Math.abs(endXNorm - startXNorm);
        heightNorm = Math.abs(endYNorm - startYNorm);
        xNorm = Math.min(startXNorm, endXNorm);
        yNorm = Math.min(startYNorm, endYNorm);
      } else {
        return; // Skip invalid footing
      }
      
      result.push({
        id: footing.id,
        pageIndex,
        type: "footing",
        xNorm,
        yNorm,
        widthNorm,
        heightNorm,
        color: footing.color || undefined,
        meta: {
          footing_type: footing.footing_type,
          shape: footing.shape,
        },
      });
    });
    
    console.log(`✅ Created ${result.length} annotations`);
    return result;
  }, [currentPagePiles, currentPageFootings, currentPageIndex, currentPdfPage]);
  
  // Function to renumber piles
  const renumberPiles = async (currentPiles: any[]) => {
    try {
      if (currentPiles.length === 0) {
        onPileNumberUpdate(1);
        return;
      }

      const sortedPiles = [...currentPiles].sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      
      const updates = sortedPiles.map((pile, index) => 
        supabase
          .from("piles")
          .update({ number: index + 1 })
          .eq("id", pile.id)
      );
      
      await Promise.all(updates);
      
      const renumbered = sortedPiles.map((pile, index) => ({
        ...pile,
        number: index + 1
      }));
      
      onPilesUpdate(renumbered);
      onPileNumberUpdate(sortedPiles.length + 1);
    } catch (error) {
      logger.error("Error renumbering piles:", error);
    }
  };
  
  // Handle delete selected annotations
  const handleDeleteSelected = useCallback(async () => {
    if (selectedAnnotationIds.size === 0) return;
    
    const ids = Array.from(selectedAnnotationIds);
    const pilesToDelete: string[] = [];
    const footingsToDelete: string[] = [];
    
    // Determine which are piles and which are footings
    currentPagePiles.forEach(p => {
      if (ids.includes(p.id)) pilesToDelete.push(p.id);
    });
    
    currentPageFootings.forEach(f => {
      if (ids.includes(f.id)) footingsToDelete.push(f.id);
    });
    
    // Delete piles
    if (pilesToDelete.length > 0) {
      try {
        const deletedPiles = pilesRef.current.filter(p => pilesToDelete.includes(p.id));
        
        await supabase.from("piles").delete().in("id", pilesToDelete);
        
        const remainingPiles = pilesRef.current.filter(p => !pilesToDelete.includes(p.id));
        onPilesUpdate(remainingPiles);
        
        if (deletedPiles.length === 1) {
          onHistoryAdd({ type: 'DELETE_PILE', pile: deletedPiles[0] });
        } else {
          onHistoryAdd({ type: 'DELETE_MULTIPLE_PILES', piles: deletedPiles });
        }
        
        await renumberPiles(remainingPiles);
        toast.success(`${pilesToDelete.length} pile(s) deleted`);
      } catch (error) {
        logger.error("Error deleting piles:", error);
        toast.error("Failed to delete piles");
      }
    }
    
    // Delete footings
    if (footingsToDelete.length > 0) {
      try {
        const deletedFootings = footingsRef.current.filter(f => footingsToDelete.includes(f.id));
        
        await supabase.from("footings").delete().in("id", footingsToDelete);
        onFootingsUpdate(footingsRef.current.filter(f => !footingsToDelete.includes(f.id)));
        
        if (deletedFootings.length === 1) {
          onHistoryAdd({ type: 'DELETE_FOOTING', footing: deletedFootings[0] });
        } else {
          onHistoryAdd({ type: 'DELETE_MULTIPLE_FOOTINGS', footings: deletedFootings });
        }
        
        toast.success(`${footingsToDelete.length} footing(s) deleted`);
      } catch (error) {
        logger.error("Error deleting footings:", error);
        toast.error("Failed to delete footings");
      }
    }
    
    setSelectedAnnotationIds(new Set());
  }, [selectedAnnotationIds, currentPagePiles, currentPageFootings, onPilesUpdate, onFootingsUpdate, onHistoryAdd, onPileNumberUpdate]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedAnnotationIds.size > 0) {
          e.preventDefault();
          handleDeleteSelected();
        }
      } else if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          onUndo();
        } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
          e.preventDefault();
          onRedo();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedAnnotationIds, handleDeleteSelected, onUndo, onRedo]);
  
  // Load PDF document and resolve URL
  useEffect(() => {
    if (!currentPage || !session) return;
    
    const loadPDF = async () => {
      try {
        setLoading(true);
        const projectId = currentPage.project_id;
        
        if (!projectId) {
          logger.error('Could not find project ID');
          toast.error('Failed to load blueprint');
          setLoading(false);
          return;
        }
        
        // Get or cache signed URL
        let signedUrl = signedUrlCacheRef.current.get(projectId);
        if (!signedUrl) {
          const { data: signedUrlData, error: signedUrlError } = await supabase.functions.invoke("get-blueprint-url", {
            body: { projectId }
          });

          if (signedUrlError || !signedUrlData?.signedUrl) {
            logger.error('Error fetching signed URL:', signedUrlError);
            toast.error('Failed to load blueprint');
            setLoading(false);
            return;
          }
          signedUrl = signedUrlData.signedUrl;
          signedUrlCacheRef.current.set(projectId, signedUrl);
        }
        
        setResolvedUrl(signedUrl);
        
        // Get or cache PDF document
        let pdf = pdfDocCacheRef.current.get(projectId);
        if (!pdf) {
          const loadingTask = pdfjsLib.getDocument({ url: signedUrl });
          pdf = await loadingTask.promise;
          pdfDocCacheRef.current.set(projectId, pdf);
        }
        
        setPdfDoc(pdf);
        
        // Load the current page
        if (currentPage.page_number >= 1 && currentPage.page_number <= pdf.numPages) {
          const pdfPage = await pdf.getPage(currentPage.page_number);
          setCurrentPdfPage(pdfPage);
          setPdfPages(prev => new Map(prev).set(currentPage.id, pdfPage));
        } else {
          logger.error(`Page number ${currentPage.page_number} is out of range`);
          toast.error(`Failed to load page ${currentPage.page_number}`);
        }
      } catch (error) {
        logger.error('Error loading PDF:', error);
        toast.error('Failed to load PDF');
      } finally {
        setLoading(false);
      }
    };
    
    loadPDF();
  }, [currentPage?.id, currentPage?.project_id, currentPage?.page_number, session]);
  
  // Handle page geometry updates from PDFAnnotationPage
  const handlePageGeometryUpdate = useCallback((geo: PageGeometry) => {
    setPageGeometry(geo);
  }, []);
  
  // Constrain viewport scrolling to page boundaries
  useEffect(() => {
    if (!viewportRef.current || !currentPdfPage) return;
    
    const viewportElement = viewportRef.current;
    const pdfViewport = currentPdfPage.getViewport({ scale: zoom });
    
    const constrainScroll = () => {
      const pageWidth = pdfViewport.width;
      const pageHeight = pdfViewport.height;
      const viewportWidth = viewportElement.clientWidth;
      const viewportHeight = viewportElement.clientHeight;
      
      // Calculate max scroll positions
      const maxScrollLeft = Math.max(0, pageWidth - viewportWidth);
      const maxScrollTop = Math.max(0, pageHeight - viewportHeight);
      
      // Constrain scroll
      if (viewportElement.scrollLeft < 0) viewportElement.scrollLeft = 0;
      if (viewportElement.scrollLeft > maxScrollLeft) viewportElement.scrollLeft = maxScrollLeft;
      if (viewportElement.scrollTop < 0) viewportElement.scrollTop = 0;
      if (viewportElement.scrollTop > maxScrollTop) viewportElement.scrollTop = maxScrollTop;
    };
    
    viewportElement.addEventListener('scroll', constrainScroll);
    const intervalId = setInterval(constrainScroll, 50);
    
    return () => {
      viewportElement.removeEventListener('scroll', constrainScroll);
      clearInterval(intervalId);
    };
  }, [zoom, currentPdfPage]);
  
  // Center page in viewport when it loads (but not on every zoom to preserve position)
  useEffect(() => {
    if (!viewportRef.current || !currentPdfPage) return;
    
    const pdfViewport = currentPdfPage.getViewport({ scale: zoom });
    const viewportElement = viewportRef.current;
    
    // Only center on initial load, not on zoom changes
    const pageWidth = pdfViewport.width;
    const pageHeight = pdfViewport.height;
    const containerWidth = viewportElement.clientWidth;
    const containerHeight = viewportElement.clientHeight;
    
    // Center the page if it's smaller than the container
    if (pageWidth < containerWidth) {
      viewportElement.scrollLeft = Math.max(0, (pageWidth - containerWidth) / 2);
    }
    if (pageHeight < containerHeight) {
      viewportElement.scrollTop = Math.max(0, (pageHeight - containerHeight) / 2);
    }
    
    // Dispatch initial transform for FloatingProjectSummary
    window.dispatchEvent(new CustomEvent('canvas-transform-change', {
      detail: {
        zoom: zoom,
        viewportTransform: [zoom, 0, 0, zoom, viewportElement.scrollLeft, viewportElement.scrollTop]
      }
    }));
  }, [currentPdfPage, zoom]); // Include zoom to update transform event
  
  // ============================================================================
  // VIEWPORT CLICK HANDLER
  // ============================================================================
  // 
  // Handles clicks on the viewport for:
  // - Pile tool: Creates a new pile at click position
  // - Select tool: Clears selection when clicking empty space
  // 
  // Coordinates are converted from viewport scroll-space to normalized PDF coordinates
  // using screenToNorm() utility function.
  //
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    if (!viewportRef.current || !pageGeometry || !currentPdfPage || activeTool === 'pan') return;
    
    // Get click position relative to viewport's scrolled content
    const viewportRect = viewportRef.current.getBoundingClientRect();
    const contentMouseX = e.clientX - viewportRect.left + viewportRef.current.scrollLeft;
    const contentMouseY = e.clientY - viewportRect.top + viewportRef.current.scrollTop;
    
    const geo = pageGeometry;
    const coords = screenToNorm(contentMouseX, contentMouseY, geo);
    
    if (!coords) return; // Click was outside page
    
    // Handle pile tool
    if (activeTool === 'pile') {
      const now = Date.now();
      
      // Prevent duplicates
      if (lastClickRef.current) {
        const timeDiff = now - lastClickRef.current.timestamp;
        const distance = Math.sqrt(
          Math.pow(contentMouseX - lastClickRef.current.x, 2) + 
          Math.pow(contentMouseY - lastClickRef.current.y, 2)
        );
        
        if (timeDiff < 200 && distance < 5) {
          return;
        }
      }
      
      lastClickRef.current = { x: contentMouseX, y: contentMouseY, timestamp: now };
      
      // Create pile
      const pileColor = pileConfig.customColor || pileColors[pileConfig.pileType as keyof PileColors] || "#FF6400";
      const viewport = currentPdfPage.getViewport({ scale: 1 });
      const baseScale = 3;
      const position_x = coords.xNorm * viewport.width * baseScale;
      const position_y = coords.yNorm * viewport.height * baseScale;
      
      const tempId = `temp-${Date.now()}`;
      const tempPile = {
        id: tempId,
        page_id: currentPage.id,
        pile_type: pileConfig.pileType,
        blade_size: pileConfig.bladeSize,
        length: pileConfig.length,
        extension: pileConfig.extension,
        position_x,
        position_y,
        is_custom: false,
        radius: 15,
        number: pileConfig.nextPileNumber,
        created_at: new Date().toISOString(),
        color: pileColor,
        xNorm: coords.xNorm,
        yNorm: coords.yNorm,
      };
      
      // Optimistic update
      onPilesUpdate([...pilesRef.current, tempPile]);
      onPileNumberUpdate(pileConfig.nextPileNumber + 1);
      
      // Save to database
      supabase
        .from("piles")
        .insert({
          page_id: tempPile.page_id,
          pile_type: tempPile.pile_type,
          blade_size: tempPile.blade_size,
          length: tempPile.length,
          extension: tempPile.extension,
          position_x: tempPile.position_x,
          position_y: tempPile.position_y,
          is_custom: tempPile.is_custom,
          radius: tempPile.radius,
          number: tempPile.number,
          color: tempPile.color,
        })
        .select()
        .single()
        .then(({ data, error }) => {
          if (error) throw error;
          
          // Replace temp pile with real pile
          onPilesUpdate(pilesRef.current.map(p => p.id === tempId ? data : p));
          onHistoryAdd({ type: 'ADD_PILE', pile: data });
        })
        .catch((error) => {
          logger.error("Error adding pile:", error);
          onPilesUpdate(pilesRef.current.filter(p => p.id !== tempId));
          onPileNumberUpdate(pileConfig.nextPileNumber);
          toast.error("Failed to add pile");
        });
    }
    
    // Handle select tool
    if (activeTool === 'select') {
      // Clear selection if clicking empty space
      setSelectedAnnotationIds(new Set());
      onSelectedPilesChange([]);
    }
  }, [activeTool, pageGeometry, currentPdfPage, pileConfig, pileColors, currentPage, onPilesUpdate, onPileNumberUpdate, onHistoryAdd, onSelectedPilesChange]);
  
  // ============================================================================
  // FOOTING DRAWING HANDLERS
  // ============================================================================
  // 
  // Handles drag-to-draw footing rectangles:
  // - handleMouseDown: Starts footing drag
  // - handleMouseMove: Updates temporary rectangle preview
  // - handleMouseUp: Creates footing from final rectangle
  // 
  // All coordinates converted to normalized PDF coordinates before saving.
  //
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (activeTool !== 'footing' || !viewportRef.current || !pageGeometry || !currentPdfPage) return;
    
    const viewportRect = viewportRef.current.getBoundingClientRect();
    const contentMouseX = e.clientX - viewportRect.left + viewportRef.current.scrollLeft;
    const contentMouseY = e.clientY - viewportRect.top + viewportRef.current.scrollTop;
    
    const geo = pageGeometry;
    const coords = screenToNorm(contentMouseX, contentMouseY, geo);
    
    if (!coords) return;
    
    setIsDrawingFooting(true);
    setFootingStart({ x: contentMouseX, y: contentMouseY });
  }, [activeTool, currentPdfPage]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawingFooting || !footingStart || !viewportRef.current || !pageGeometry) return;
    
    const viewportRect = viewportRef.current.getBoundingClientRect();
    const contentMouseX = e.clientX - viewportRect.left + viewportRef.current.scrollLeft;
    const contentMouseY = e.clientY - viewportRect.top + viewportRef.current.scrollTop;
    
    const width = contentMouseX - footingStart.x;
    const height = contentMouseY - footingStart.y;
    
    setTempFootingRect({
      x: width < 0 ? contentMouseX : footingStart.x,
      y: height < 0 ? contentMouseY : footingStart.y,
      width: Math.abs(width),
      height: Math.abs(height),
    });
  }, [isDrawingFooting, footingStart]);
  
  const handleMouseUp = useCallback(async (e: React.MouseEvent) => {
    if (!isDrawingFooting || !footingStart || !pageGeometry || !currentPdfPage) {
      setIsDrawingFooting(false);
      setFootingStart(null);
      setTempFootingRect(null);
      return;
    }
    
    const viewportRect = viewportRef.current?.getBoundingClientRect();
    if (!viewportRect) return;
    
    const contentMouseX = e.clientX - viewportRect.left + (viewportRef.current?.scrollLeft || 0);
    const contentMouseY = e.clientY - viewportRect.top + (viewportRef.current?.scrollTop || 0);
    
    const geo = pageGeometry;
    const startCoords = screenToNorm(footingStart.x, footingStart.y, geo);
    const endCoords = screenToNorm(contentMouseX, contentMouseY, geo);
    
    if (!startCoords || !endCoords) {
      setIsDrawingFooting(false);
      setFootingStart(null);
      setTempFootingRect(null);
      return;
    }
    
    const widthNorm = Math.abs(endCoords.xNorm - startCoords.xNorm);
    const heightNorm = Math.abs(endCoords.yNorm - startCoords.yNorm);
    
    // Only create if size is meaningful
    if (widthNorm > 0.01 && heightNorm > 0.01) {
      const xNorm = Math.min(startCoords.xNorm, endCoords.xNorm);
      const yNorm = Math.min(startCoords.yNorm, endCoords.yNorm);
      
      const viewport = currentPdfPage.getViewport({ scale: 1 });
      const baseScale = 3;
      const startX = xNorm * viewport.width * baseScale;
      const startY = yNorm * viewport.height * baseScale;
      const endX = (xNorm + widthNorm) * viewport.width * baseScale;
      const endY = (yNorm + heightNorm) * viewport.height * baseScale;
      
      const footingColor = footingColors[footingConfig.footingType] || "#64748b";
      const hexToRgba = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      };
      
      try {
        const { data, error } = await supabase
          .from("footings")
          .insert({
            page_id: currentPage.id,
            footing_type: footingConfig.footingType,
            shape: "rectangle",
            coordinates: [
              { x: startX, y: startY },
              { x: endX, y: endY },
            ],
            color: hexToRgba(footingColor, footingConfig.opacity),
            xNorm,
            yNorm,
            widthNorm,
            heightNorm,
          })
          .select()
          .single();

        if (error) throw error;

        onFootingsUpdate([...footingsRef.current, data]);
        onHistoryAdd({ type: 'ADD_FOOTING', footing: data });
        toast.success("Footing added");
      } catch (error) {
        logger.error("Error adding footing:", error);
        toast.error("Failed to add footing");
      }
    }
    
    setIsDrawingFooting(false);
    setFootingStart(null);
    setTempFootingRect(null);
  }, [isDrawingFooting, footingStart, pageGeometry, currentPdfPage, footingConfig, footingColors, currentPage, onFootingsUpdate, onHistoryAdd]);
  
  // ============================================================================
  // PAN HANDLERS
  // ============================================================================
  // 
  // Handles panning the viewport by dragging:
  // - handlePanStart: Initiates pan (middle mouse or pan tool)
  // - handlePanMove: Updates scroll position based on mouse movement
  // - handlePanEnd: Cleans up pan state
  // 
  // Dispatches transform events for FloatingProjectSummary to follow pinned summary box.
  //
  const handlePanStart = useCallback((e: React.MouseEvent) => {
    if (activeTool !== 'pan' && e.button !== 1) return;
    setIsPanning(true);
    setLastPanPoint({ x: e.clientX, y: e.clientY });
    e.preventDefault();
  }, [activeTool]);
  
  const handlePanMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning || !lastPanPoint || !viewportRef.current) return;
    
    const deltaX = e.clientX - lastPanPoint.x;
    const deltaY = e.clientY - lastPanPoint.y;
    
    viewportRef.current.scrollLeft -= deltaX;
    viewportRef.current.scrollTop -= deltaY;
    
    // Dispatch transform change event for FloatingProjectSummary
    window.dispatchEvent(new CustomEvent('canvas-transform-change', {
      detail: {
        zoom: zoom,
        viewportTransform: [zoom, 0, 0, zoom, viewportRef.current.scrollLeft, viewportRef.current.scrollTop]
      }
    }));
    
    setLastPanPoint({ x: e.clientX, y: e.clientY });
  }, [isPanning, lastPanPoint, zoom]);
  
  const handlePanEnd = useCallback(() => {
    setIsPanning(false);
    setLastPanPoint(null);
  }, []);
  
  // ============================================================================
  // ZOOM HANDLER
  // ============================================================================
  // 
  // Handles Ctrl/Cmd + scroll to zoom. Key features:
  // - Zooms to mouse cursor position (keeps point under cursor fixed)
  // - Debounced to prevent flashing during rapid scroll
  // - Uses requestAnimationFrame for smooth scroll adjustments
  // - Dispatches transform events for FloatingProjectSummary
  // 
  const zoomTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingZoomRef = useRef<number | null>(null);
  
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!viewportRef.current || !currentPdfPage) return;
    
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      
      const viewport = viewportRef.current;
      const delta = e.deltaY;
      
      // Get mouse position relative to viewport
      const rect = viewport.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Get current scroll position
      const scrollX = viewport.scrollLeft;
      const scrollY = viewport.scrollTop;
      
      // Calculate zoom factor (smaller increments for smoother zoom)
      const zoomFactor = delta < 0 ? 1.05 : 0.95;
      const newZoom = Math.max(0.25, Math.min(3, (pendingZoomRef.current || zoom) * zoomFactor));
      pendingZoomRef.current = newZoom;
      
      // Calculate the point under the mouse in page coordinates
      const pageX = (scrollX + mouseX) / (pendingZoomRef.current || zoom);
      const pageY = (scrollY + mouseY) / (pendingZoomRef.current || zoom);
      
      // Clear any pending zoom updates
      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
      }
      
      // Debounce zoom state update to prevent flashing (but update scroll immediately)
      zoomTimeoutRef.current = setTimeout(() => {
        if (pendingZoomRef.current !== null && viewportRef.current) {
          const finalZoom = pendingZoomRef.current;
          setZoom(finalZoom);
          
          // Adjust scroll to keep the same point under the mouse
          requestAnimationFrame(() => {
            if (viewportRef.current) {
              viewportRef.current.scrollLeft = pageX * finalZoom - mouseX;
              viewportRef.current.scrollTop = pageY * finalZoom - mouseY;
              
              // Dispatch transform change event for FloatingProjectSummary
              window.dispatchEvent(new CustomEvent('canvas-transform-change', {
                detail: {
                  zoom: finalZoom,
                  viewportTransform: [finalZoom, 0, 0, finalZoom, viewportRef.current.scrollLeft, viewportRef.current.scrollTop]
                }
              }));
            }
          });
          
          pendingZoomRef.current = null;
        }
      }, 50); // Small delay to batch rapid zoom events
    }
  }, [zoom, currentPdfPage]);
  
  // ============================================================================
  // ANNOTATION INTERACTION HANDLERS
  // ============================================================================
  // 
  // handleAnnotationClick: Handles clicking annotations for selection
  // - Supports single select and multi-select (Shift/Ctrl/Cmd click)
  // - Updates selectedAnnotationIds state
  // 
  // handleAnnotationDragStart: Initiates dragging an annotation
  // - Stores starting position in both screen and normalized coordinates
  // 
  // Drag move/end handled in separate useEffect that listens to window mouse events
  //
  const handleAnnotationClick = useCallback((annotation: Annotation, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (activeTool !== 'select') return;
    
    setSelectedAnnotationIds(prev => {
      let newSet: Set<string>;
      
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        // Multi-select
        newSet = new Set(prev);
        if (newSet.has(annotation.id)) {
          newSet.delete(annotation.id);
        } else {
          newSet.add(annotation.id);
        }
      } else {
        // Single select
        newSet = new Set([annotation.id]);
      }
      
      // Update selected pile IDs for context menu
      if (annotation.type === 'pile_marker') {
        const pileIds = Array.from(newSet).filter(id => {
          return currentPagePiles.some(p => p.id === id);
        });
        onSelectedPilesChange(pileIds);
      }
      
      return newSet;
    });
  }, [activeTool, currentPagePiles, onSelectedPilesChange]);
  
  // Handle annotation drag start
  const handleAnnotationDragStart = useCallback((annotation: Annotation, e: React.MouseEvent) => {
    if (activeTool !== 'select' || !pageGeometry) return;
    
    e.stopPropagation();
    
    const viewportRect = viewportRef.current?.getBoundingClientRect();
    if (!viewportRect) return;
    
    const contentMouseX = e.clientX - viewportRect.left + (viewportRef.current?.scrollLeft || 0);
    const contentMouseY = e.clientY - viewportRect.top + (viewportRef.current?.scrollTop || 0);
    
    setDraggingAnnotation({
      id: annotation.id,
      type: annotation.type === 'pile_marker' ? 'pile' : 'footing',
      startX: contentMouseX,
      startY: contentMouseY,
      startNormX: annotation.xNorm,
      startNormY: annotation.yNorm,
    });
    
    // Select if not already selected
    if (!selectedAnnotationIds.has(annotation.id)) {
      setSelectedAnnotationIds(new Set([annotation.id]));
    }
  }, [activeTool, pageGeometry, selectedAnnotationIds]);
  
  // Handle annotation drag move
  useEffect(() => {
    if (!draggingAnnotation || !pageGeometry || !viewportRef.current) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      const viewportRect = viewportRef.current?.getBoundingClientRect();
      if (!viewportRect) return;
      
      const contentMouseX = e.clientX - viewportRect.left + (viewportRef.current?.scrollLeft || 0);
      const contentMouseY = e.clientY - viewportRect.top + (viewportRef.current?.scrollTop || 0);
      
      const deltaX = contentMouseX - draggingAnnotation.startX;
      const deltaY = contentMouseY - draggingAnnotation.startY;
      
      if (!pageGeometry) return;
      
      const geo = pageGeometry;
      const deltaXNorm = deltaX / (geo.pageWidth * geo.zoom);
      const deltaYNorm = deltaY / (geo.pageHeight * geo.zoom);
      
      const newNormX = draggingAnnotation.startNormX + deltaXNorm;
      const newNormY = draggingAnnotation.startNormY + deltaYNorm;
      
      // Update annotation position (optimistic update)
      if (draggingAnnotation.type === 'pile') {
        const pile = currentPagePiles.find(p => p.id === draggingAnnotation.id);
        if (pile) {
          const viewport = currentPdfPage?.getViewport({ scale: 1 });
          if (viewport) {
            const baseScale = 3;
            const position_x = newNormX * viewport.width * baseScale;
            const position_y = newNormY * viewport.height * baseScale;
            
            onPilesUpdate(pilesRef.current.map(p => 
              p.id === draggingAnnotation.id 
                ? { ...p, position_x, position_y, xNorm: newNormX, yNorm: newNormY }
                : p
            ));
          }
        }
      } else if (draggingAnnotation.type === 'footing') {
        const footing = currentPageFootings.find(f => f.id === draggingAnnotation.id);
        if (footing && (footing as any).widthNorm !== undefined) {
          const viewport = currentPdfPage?.getViewport({ scale: 1 });
          if (viewport) {
            const baseScale = 3;
            const widthNorm = (footing as any).widthNorm;
            const heightNorm = (footing as any).heightNorm;
            
            const startX = newNormX * viewport.width * baseScale;
            const startY = newNormY * viewport.height * baseScale;
            const endX = (newNormX + widthNorm) * viewport.width * baseScale;
            const endY = (newNormY + heightNorm) * viewport.height * baseScale;
            
            onFootingsUpdate(footingsRef.current.map(f =>
              f.id === draggingAnnotation.id
                ? { ...f, coordinates: [{ x: startX, y: startY }, { x: endX, y: endY }], xNorm: newNormX, yNorm: newNormY }
                : f
            ));
          }
        }
      }
    };
    
    const handleMouseUp = async () => {
      if (!draggingAnnotation || !pageGeometry) return;
      
      // Save to database
      if (draggingAnnotation.type === 'pile') {
        const pile = pilesRef.current.find(p => p.id === draggingAnnotation.id);
        if (pile) {
          try {
            await supabase
              .from("piles")
              .update({ 
                position_x: pile.position_x, 
                position_y: pile.position_y 
              })
              .eq("id", pile.id);
          } catch (error) {
            logger.error("Error updating pile position:", error);
            toast.error("Failed to update pile position");
          }
        }
      } else if (draggingAnnotation.type === 'footing') {
        const footing = footingsRef.current.find(f => f.id === draggingAnnotation.id);
        if (footing) {
          try {
            await supabase
              .from("footings")
              .update({
                coordinates: footing.coordinates
              })
              .eq("id", footing.id);
          } catch (error) {
            logger.error("Error updating footing position:", error);
            toast.error("Failed to update footing position");
          }
        }
      }
      
      setDraggingAnnotation(null);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingAnnotation, pageGeometry, currentPdfPage, currentPagePiles, currentPageFootings, onPilesUpdate, onFootingsUpdate]);
  
  // Handle context menu
  const handleContextMenu = useCallback((annotation: Annotation, e: React.MouseEvent) => {
    if (annotation.type !== 'pile_marker') return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const pileIds = Array.from(selectedAnnotationIds);
    if (!pileIds.includes(annotation.id) && pileIds.length === 0) {
      pileIds.push(annotation.id);
      setSelectedAnnotationIds(new Set(pileIds));
    }
    
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      selectedIds: pileIds.length > 0 ? pileIds : [annotation.id],
    });
  }, [selectedAnnotationIds]);
  
  // ============================================================================
  // CUSTOM ANNOTATION RENDERER
  // ============================================================================
  // 
  // Renders annotations using custom renderer components:
  // - PileMarkerRenderer: Renders pile markers with numbers and colors
  // - FootingRenderer: Renders footing rectangles with opacity
  // 
  // These renderers receive the annotation, screen position, and page geometry
  // to properly size and position annotations at the current zoom level.
  //
  const renderAnnotation = useCallback((annotation: Annotation, screenPos: { x: number; y: number }, geo: PageGeometry) => {
    if (annotation.type === 'pile_marker') {
      return (
        <PileMarkerRenderer
          annotation={annotation}
          pageGeometry={geo}
          pileScale={pileConfig.scale}
          pileColors={pileColors}
          isSelected={selectedAnnotationIds.has(annotation.id)}
          onClick={(e) => handleAnnotationClick(annotation, e)}
          onDragStart={(e) => handleAnnotationDragStart(annotation, e)}
        />
      );
    } else if (annotation.type === 'footing') {
      return (
        <FootingRenderer
          annotation={annotation}
          pageGeometry={geo}
          opacity={footingConfig.opacity}
          footingColors={footingColors}
          isSelected={selectedAnnotationIds.has(annotation.id)}
          onClick={(e) => handleAnnotationClick(annotation, e)}
          onDragStart={(e) => handleAnnotationDragStart(annotation, e)}
        />
      );
    }
    return null;
  }, [pileConfig.scale, pileColors, footingConfig.opacity, footingColors, selectedAnnotationIds, handleAnnotationClick, handleAnnotationDragStart]);
  
  // ============================================================================
  // PDF EXPORT FUNCTIONALITY
  // ============================================================================
  // 
  // Listens for 'export-pdf' and 'export-pdf-all' events from Editor component.
  // 
  // Export process:
  // 1. Converts all piles/footings to Annotation[] format
  // 2. Captures summary box as image if available (via html2canvas)
  // 3. Calls exportAnnotationsToPDF() to draw annotations on original PDF
  // 4. Includes summary box overlay in exported PDF
  // 
  // Supports:
  // - Single page export (current page only)
  // - All pages export (all pages with their annotations)
  //
  useEffect(() => {
    const handleExportEvent = async (event: Event) => {
      if (!pdfDoc || !currentPage) return;
      
      const customEvent = event as CustomEvent;
      const exportAllPages = customEvent.detail?.exportAllPages ?? false;
      
      try {
        const pdfUrl = resolvedUrl || '';
        
        if (!pdfUrl) {
          toast.error("PDF URL not available for export");
          return;
        }
        
        // Convert all piles/footings to annotations (for all pages if needed)
        const allAnnotations: Annotation[] = [];
        
        // Get all pages' annotations if exporting all pages
        const pagesToProcess = exportAllPages 
          ? pages 
          : [currentPage];
        
        for (const page of pagesToProcess) {
          const pageIndex = page.page_number - 1; // Convert to 0-based
          const pagePiles = piles.filter(p => p.page_id === page.id);
          const pageFootings = footings.filter(f => f.page_id === page.id);
          
          // Get PDF page to calculate dimensions
          const pdfPage = pdfPages.get(page.id) || await pdfDoc.getPage(page.page_number);
          
          pagePiles.forEach((pile) => {
            let xNorm: number, yNorm: number;
            if ((pile as any).xNorm !== undefined) {
              xNorm = (pile as any).xNorm;
              yNorm = (pile as any).yNorm;
            } else {
              const viewport = pdfPage.getViewport({ scale: 1 });
              const baseScale = 3;
              xNorm = pile.position_x / (viewport.width * baseScale);
              yNorm = pile.position_y / (viewport.height * baseScale);
            }
            
            const radius = pile.radius || 15;
            const viewport = pdfPage.getViewport({ scale: 1 });
            const diameterNorm = (radius * 2) / viewport.width;
            
            allAnnotations.push({
              id: pile.id,
              pageIndex,
              type: "pile_marker",
              xNorm,
              yNorm,
              widthNorm: diameterNorm,
              heightNorm: diameterNorm,
              color: pile.color,
              meta: {
                pile_type: pile.pile_type,
                radius,
                number: pile.number,
              },
            });
          });
          
          pageFootings.forEach((footing) => {
            if ((footing as any).xNorm !== undefined) {
              allAnnotations.push({
                id: footing.id,
                pageIndex,
                type: "footing",
                xNorm: (footing as any).xNorm,
                yNorm: (footing as any).yNorm,
                widthNorm: (footing as any).widthNorm || 0,
                heightNorm: (footing as any).heightNorm || 0,
                color: footing.color,
                meta: {
                  footing_type: footing.footing_type,
                },
              });
            }
          });
        }
        
        // Capture summary box if available
        let summaryImage: string | undefined;
        let summaryPosition: { x: number; y: number; width: number; height: number } | undefined;
        
        const summaryElement = document.getElementById('project-summary-panel');
        if (summaryElement) {
          try {
            // Enable print mode
            window.dispatchEvent(new CustomEvent('summary-print-mode', { detail: { enabled: true } }));
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const html2canvas = (await import('html2canvas')).default;
            const summaryCanvas = await html2canvas(summaryElement, {
              backgroundColor: null,
              scale: 2,
            });
            summaryImage = summaryCanvas.toDataURL('image/png');
            
            const summaryRect = summaryElement.getBoundingClientRect();
            const viewportRect = viewportRef.current?.getBoundingClientRect();
            
            if (viewportRect) {
              summaryPosition = {
                x: summaryRect.left - viewportRect.left + (viewportRef.current?.scrollLeft || 0),
                y: summaryRect.top - viewportRect.top + (viewportRef.current?.scrollTop || 0),
                width: summaryRect.width,
                height: summaryRect.height,
              };
            }
            
            // Disable print mode
            window.dispatchEvent(new CustomEvent('summary-print-mode', { detail: { enabled: false } }));
          } catch (error) {
            logger.error("Error capturing summary box:", error);
          }
        }
        
        await exportAnnotationsToPDF({
          pdfUrl,
          annotations: allAnnotations,
          pageIndex: exportAllPages ? undefined : currentPage.page_number - 1,
          projectName: projectName || 'Project',
          summaryImage,
          summaryPosition,
        });
        
        toast.success(`PDF exported successfully${exportAllPages ? ' (all pages)' : ''}`);
      } catch (error) {
        logger.error("Export error:", error);
        toast.error("Failed to export PDF");
      }
    };
    
    window.addEventListener('export-pdf', handleExportEvent);
    window.addEventListener('export-pdf-all', handleExportEvent);
    return () => {
      window.removeEventListener('export-pdf', handleExportEvent);
      window.removeEventListener('export-pdf-all', handleExportEvent);
    };
  }, [pdfDoc, currentPage, resolvedUrl, currentPageIndex, currentPagePiles, currentPageFootings, currentPdfPage, projectName, pages, piles, footings, pdfPages]);
  
  // Update cursor based on active tool
  useEffect(() => {
    if (!viewportRef.current) return;
    
    let cursor = 'default';
    if (activeTool === 'pile' || activeTool === 'footing') {
      cursor = 'crosshair';
    } else if (activeTool === 'pan') {
      cursor = isPanning ? 'grabbing' : 'grab';
    } else if (activeTool === 'select') {
      cursor = 'default';
    }
    
    viewportRef.current.style.cursor = cursor;
  }, [activeTool, isPanning]);
  
  if (loading || !currentPdfPage) {
    return (
      <div ref={containerRef} className="relative w-full h-full flex items-center justify-center">
        <div className="text-muted-foreground">Loading PDF...</div>
      </div>
    );
  }
  
  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full overflow-hidden"
      onMouseDown={(e) => {
        if (activeTool === 'pan' || e.button === 1) {
          handlePanStart(e);
        } else if (activeTool === 'footing') {
          handleMouseDown(e);
        }
      }}
      onMouseMove={(e) => {
        if (isDrawingFooting) {
          handleMouseMove(e);
        } else if (isPanning) {
          handlePanMove(e);
        }
      }}
      onMouseUp={(e) => {
        if (isDrawingFooting) {
          handleMouseUp(e);
        } else if (isPanning) {
          handlePanEnd();
        }
      }}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div 
        ref={viewportRef} 
        className="pdf-viewer-viewport w-full h-full"
        onClick={handleContainerClick}
      >
        <div 
          className="pdf-viewer-container" 
          style={{ 
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: currentPdfPage ? `${currentPdfPage.getViewport({ scale: zoom }).width}px` : '100%',
            height: currentPdfPage ? `${currentPdfPage.getViewport({ scale: zoom }).height}px` : '100%',
            minWidth: currentPdfPage ? `${currentPdfPage.getViewport({ scale: zoom }).width}px` : 'auto',
            minHeight: currentPdfPage ? `${currentPdfPage.getViewport({ scale: zoom }).height}px` : 'auto',
          }}
        >
          {currentPdfPage && (
            <PDFAnnotationPage
              pageNumber={currentPage.page_number}
              pdfPage={currentPdfPage}
              zoom={zoom}
              annotations={annotations}
              onAnnotationClick={handleAnnotationClick}
              renderAnnotation={renderAnnotation}
              onPageGeometryUpdate={handlePageGeometryUpdate}
            />
          )}
          
          {/* Temporary footing rectangle overlay */}
          {tempFootingRect && (
            <div
              style={{
                position: 'absolute',
                left: `${tempFootingRect.x}px`,
                top: `${tempFootingRect.y}px`,
                width: `${tempFootingRect.width}px`,
                height: `${tempFootingRect.height}px`,
                border: '2px dashed #64748b',
                backgroundColor: 'rgba(100, 116, 139, 0.2)',
                pointerEvents: 'none',
                zIndex: 1000,
              }}
            />
          )}
        </div>
      </div>
      
      {contextMenu && (
        <PileContextMenu
          position={{ x: contextMenu.x, y: contextMenu.y }}
          selectedPileIds={contextMenu.selectedIds}
          onClose={() => setContextMenu(null)}
          onUpdate={() => {
            setContextMenu(null);
            onMarkupsChange();
          }}
        />
      )}
    </div>
  );
}
