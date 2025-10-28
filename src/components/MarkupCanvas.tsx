import { useEffect, useRef, useState } from "react";
import { Canvas as FabricCanvas, Circle, Rect, FabricImage, FabricText, Group } from "fabric";
import html2canvas from "html2canvas";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PileColors } from "@/components/PileColorSettings";
import PileContextMenu from "@/components/PileContextMenu";
import { exportCanvasToPDF } from "@/lib/pdfExport";
import { HistoryAction } from "@/hooks/useHistory";

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [isDrawingFooting, setIsDrawingFooting] = useState(false);
  const [footingStart, setFootingStart] = useState<{ x: number; y: number } | null>(null);
  const [tempFootingRect, setTempFootingRect] = useState<Rect | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; selectedIds: string[] } | null>(null);
  const [currentPageData, setCurrentPageData] = useState<{ pageId: string; width: number; height: number } | null>(null);
  const [pageCache, setPageCache] = useState<Map<string, any>>(new Map());
  const { session } = useAuth();
  
  // Use ref to always have latest piles array (avoid stale closure)
  const pilesRef = useRef(piles);
  const renderedPilesRef = useRef<Map<string, Group>>(new Map());
  const lastClickRef = useRef<{ x: number; y: number; timestamp: number } | null>(null);
  
  useEffect(() => {
    pilesRef.current = piles;
  }, [piles]);
  
  // Get current page and filter markups for current page
  const currentPage = pages[currentPageIndex];
  const currentPagePiles = piles.filter(p => p.page_id === currentPage?.id);
  const currentPageFootings = footings.filter(f => f.page_id === currentPage?.id);

  // Function to renumber piles based on local state
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

  // Handle delete objects - optimized batch deletion
  const handleDeleteObjects = async (objects: any[]) => {
    const pilesToDelete: string[] = [];
    const footingsToDelete: string[] = [];
    
    // Collect IDs to delete
    for (const obj of objects) {
      const customData = (obj as any).customData;
      if (customData?.type === "pile") {
        pilesToDelete.push(customData.id);
      } else if (customData?.type === "footing") {
        footingsToDelete.push(customData.id);
      }
    }
    
    // Batch delete piles
    if (pilesToDelete.length > 0) {
      try {
        // Store the piles before deletion for history
        const deletedPiles = pilesRef.current.filter(p => pilesToDelete.includes(p.id));
        
        await supabase.from("piles").delete().in("id", pilesToDelete);
        
        const remainingPiles = pilesRef.current.filter(p => !pilesToDelete.includes(p.id));
        onPilesUpdate(remainingPiles);
        
        // Add to history
        if (deletedPiles.length === 1) {
          onHistoryAdd({ type: 'DELETE_PILE', pile: deletedPiles[0] });
        } else {
          onHistoryAdd({ type: 'DELETE_MULTIPLE_PILES', piles: deletedPiles });
        }
        
        // Renumber based on remaining piles
        await renumberPiles(remainingPiles);
        
        toast.success(`${pilesToDelete.length} pile(s) deleted`);
      } catch (error) {
        logger.error("Error deleting piles:", error);
        toast.error("Failed to delete piles");
      }
    }
    
    // Batch delete footings
    if (footingsToDelete.length > 0) {
      try {
        // Store the footings before deletion for history
        const deletedFootings = footings.filter(f => footingsToDelete.includes(f.id));
        
        await supabase.from("footings").delete().in("id", footingsToDelete);
        onFootingsUpdate(footings.filter(f => !footingsToDelete.includes(f.id)));
        
        // Add to history
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
  };

  // Initialize canvas with better sizing
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth - 32; // Account for padding
    const height = container.clientHeight - 32;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: Math.max(width, 1200),
      height: Math.max(height, 800),
      backgroundColor: "#f5f5f5",
      preserveObjectStacking: true,
      allowTouchScrolling: false,
    });

    // Enable multi-selection (start with false, will be controlled by activeTool effect)
    canvas.selection = false;

    // Enable panning
    let isPanning = false;
    let lastPosX = 0;
    let lastPosY = 0;
    
    // Track selection changes
    canvas.on('selection:created', (e) => {
      const activeObjects = e.selected || [];
      const pileIds = activeObjects
        .filter((obj: any) => obj.customData?.type === "pile")
        .map((obj: any) => obj.customData.id);
      onSelectedPilesChange(pileIds);
    });

    canvas.on('selection:updated', (e) => {
      const activeObjects = e.selected || [];
      const pileIds = activeObjects
        .filter((obj: any) => obj.customData?.type === "pile")
        .map((obj: any) => obj.customData.id);
      onSelectedPilesChange(pileIds);
    });

    canvas.on('selection:cleared', () => {
      onSelectedPilesChange([]);
    });

    // Handle right-click for context menu and middle mouse panning
    canvas.on('mouse:down', (e) => {
      const mouseEvent = e.e as MouseEvent;
      
      // Right click for context menu
      if (mouseEvent.button === 2) {
        e.e.preventDefault();
        const target = canvas.findTarget(e.e as any);
        const activeObjects = canvas.getActiveObjects();
        
        let pileIds: string[] = [];
        
        // Single pile clicked
        if (target && (target as any).customData?.type === "pile") {
          pileIds = [(target as any).customData.id];
        } 
        // Multiple piles selected
        else if (activeObjects.length > 0) {
          pileIds = activeObjects
            .filter((obj: any) => obj.customData?.type === "pile")
            .map((obj: any) => obj.customData.id);
        }
        
        if (pileIds.length > 0) {
          setContextMenu({
            x: mouseEvent.clientX,
            y: mouseEvent.clientY,
            selectedIds: pileIds,
          });
        }
        return;
      }
      
      // Middle mouse button OR left click when pan tool is active
      if (mouseEvent.button === 1 || (activeTool === 'pan' && mouseEvent.button === 0)) {
        isPanning = true;
        canvas.selection = false;
        canvas.defaultCursor = 'grabbing';
        canvas.hoverCursor = 'grabbing';
        lastPosX = mouseEvent.clientX;
        lastPosY = mouseEvent.clientY;
        e.e.preventDefault();
      }
    });

    // Prevent default context menu
    const canvasElement = canvas.getElement();
    canvasElement.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    canvas.on('mouse:move', (e) => {
      if (isPanning && canvas.viewportTransform) {
        const evt = e.e as MouseEvent;
        const deltaX = evt.clientX - lastPosX;
        const deltaY = evt.clientY - lastPosY;
        
        canvas.viewportTransform[4] += deltaX;
        canvas.viewportTransform[5] += deltaY;
        
        lastPosX = evt.clientX;
        lastPosY = evt.clientY;
        canvas.requestRenderAll();
      }
    });

    canvas.on('mouse:up', () => {
      if (isPanning) {
        isPanning = false;
        canvas.selection = activeTool === 'select';
        // Reset cursor based on active tool
        if (activeTool === 'pan') {
          canvas.defaultCursor = 'grab';
          canvas.hoverCursor = 'grab';
        } else {
          canvas.defaultCursor = 'default';
          canvas.hoverCursor = 'move';
        }
      }
    });

    // PDF-style scrolling: Ctrl+scroll to zoom, normal scroll to pan
    canvas.on('mouse:wheel', (opt) => {
      const e = opt.e;
      
      // Only zoom if Ctrl/Cmd is pressed
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        
        const delta = e.deltaY;
        let zoom = canvas.getZoom();
        
        // Smoother zoom increments
        if (delta < 0) {
          zoom *= 1.1; // Zoom in
        } else {
          zoom *= 0.9; // Zoom out
        }
        
        // Limit zoom range
        if (zoom > 5) zoom = 5;
        if (zoom < 0.5) zoom = 0.5;
        
        // Zoom to mouse cursor position
        const pointer = canvas.getViewportPoint(e as any);
        canvas.zoomToPoint(pointer, zoom);
        canvas.requestRenderAll();
      } else {
        // Normal scroll - pan vertically
        if (canvas.viewportTransform) {
          canvas.viewportTransform[5] -= e.deltaY;
          canvas.viewportTransform[4] -= e.deltaX; // Horizontal scroll
          canvas.requestRenderAll();
        }
      }
    });

    // PDF Export event listener
    const handleExportEvent = async () => {
      if (!canvas) return;
      
      try {
        const summaryElement = document.getElementById('project-summary-panel');
        if (!summaryElement) {
          toast.error("Could not find summary panel to export.");
          return;
        }

        // Enable print mode to replace dropdowns with text
        window.dispatchEvent(new CustomEvent('summary-print-mode', { detail: { enabled: true } }));
        
        // Wait for React to re-render with print mode styles
        await new Promise(resolve => setTimeout(resolve, 100));

        // Temporarily remove scale transform to capture full unscaled content
        const originalTransform = (summaryElement as HTMLElement).style.transform;
        (summaryElement as HTMLElement).style.transform = 'scale(1)';
        
        const summaryCanvas = await html2canvas(summaryElement, {
          backgroundColor: null,
          scale: 2, // Higher quality
        });
        const summaryImage = summaryCanvas.toDataURL('image/png');
        
        // Restore original transform and disable print mode
        (summaryElement as HTMLElement).style.transform = originalTransform;
        window.dispatchEvent(new CustomEvent('summary-print-mode', { detail: { enabled: false } }));
        
        // Get the panel's position relative to the canvas container
        const canvasContainerRect = containerRef.current!.getBoundingClientRect();
        const summaryRect = summaryElement.getBoundingClientRect();
        const summaryPosition = {
          x: summaryRect.left - canvasContainerRect.left,
          y: summaryRect.top - canvasContainerRect.top,
          width: summaryRect.width,
          height: summaryRect.height,
        };

        // Find the background image to get precise bounding box
        const backgroundImage = canvas.getObjects().find((obj: any) => obj.customData?.type === 'page');
        if (!backgroundImage) {
          toast.error("Could not find page image to export.");
          return;
        }
        
        const imageBounds = backgroundImage.getBoundingRect();

        const pageId = (event as any).detail?.pageId || currentPage?.id;
        const pageNumber = (event as any).detail?.pageNumber || currentPageIndex;
        const pagePiles = piles.filter(p => p.page_id === pageId);
        const pageFootings = footings.filter(f => f.page_id === pageId);
        
        await exportCanvasToPDF({
          canvas,
          projectName: projectName || "Project",
          pageNumber: pageNumber,
          totalPages: pages.length,
          piles: pagePiles,
          footings: pageFootings,
          pileColors,
          summaryImage,
          summaryPosition,
          clippingRect: {
            left: imageBounds.left,
            top: imageBounds.top,
            width: imageBounds.width,
            height: imageBounds.height,
          },
        });
        toast.success("PDF exported successfully");
      } catch (error) {
        logger.error("Export error:", error);
        toast.error("Failed to export PDF");
      }
    };

    window.addEventListener('export-pdf', handleExportEvent as EventListener);

    setFabricCanvas(canvas);

    return () => {
      window.removeEventListener('export-pdf', handleExportEvent as EventListener);
      canvas.dispose();
    };
  }, []);

  // Separate effect for keyboard shortcuts to avoid stale closures
  useEffect(() => {
    if (!fabricCanvas) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const activeObjects = fabricCanvas.getActiveObjects();
        if (activeObjects.length > 0) {
          handleDeleteObjects(activeObjects);
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

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [fabricCanvas, onUndo, onRedo, handleDeleteObjects]);

  // Update cursor and selection based on active tool
  useEffect(() => {
    if (!fabricCanvas) return;
    
    if (activeTool === "pile" || activeTool === "footing") {
      fabricCanvas.selection = false;
      fabricCanvas.defaultCursor = "crosshair";
      fabricCanvas.hoverCursor = "crosshair";
      fabricCanvas.getObjects().forEach((obj: any) => {
        if (obj.customData?.type === "pile" || obj.customData?.type === "footing") {
          obj.selectable = false;
        }
      });
    } else if (activeTool === "pan") {
      fabricCanvas.selection = false;
      fabricCanvas.defaultCursor = "grab";
      fabricCanvas.hoverCursor = "grab";
      fabricCanvas.getObjects().forEach((obj: any) => {
        if (obj.customData?.type === "pile" || obj.customData?.type === "footing") {
          obj.selectable = false;
        }
      });
    } else {
      // select tool
      fabricCanvas.selection = true;
      fabricCanvas.defaultCursor = "default";
      fabricCanvas.hoverCursor = "move";
      fabricCanvas.getObjects().forEach((obj: any) => {
        if (obj.customData?.type === "pile" || obj.customData?.type === "footing") {
          obj.selectable = true;
        }
      });
    }
    fabricCanvas.renderAll();
  }, [fabricCanvas, activeTool]);

  // Load only the current page with caching and pre-loading
  useEffect(() => {
    if (!fabricCanvas || !currentPage || !containerRef.current) return;

    const loadCurrentPage = async () => {
      try {
        // Check if page is already cached
        if (pageCache.has(currentPage.id)) {
          const cachedData = pageCache.get(currentPage.id);
          
          // Clear canvas and re-add cached image
          fabricCanvas.clear();
          renderedPilesRef.current.clear();
          
          const img = await FabricImage.fromURL(cachedData.dataUrl);
          img.scale(cachedData.scale);
          img.set({
            left: cachedData.left,
            top: cachedData.top,
            selectable: false,
            evented: false,
          });
          
          (img as any).customData = { type: 'page', pageId: currentPage.id };
          fabricCanvas.add(img);
          fabricCanvas.sendObjectToBack(img); // Keep page image behind markups
          
          fabricCanvas.setWidth(cachedData.canvasWidth);
          fabricCanvas.setHeight(cachedData.canvasHeight);
          
          setCurrentPageData({
            pageId: currentPage.id,
            width: cachedData.width,
            height: cachedData.height,
          });
          
          fabricCanvas.renderAll();
          
          // Pre-load adjacent pages in the background
          preloadAdjacentPages();
          return;
        }

        // Show loading state (could add a spinner overlay here)
        
        // Load and cache new page
        // Fetch signed URL for the blueprint since bucket is now private
        const projectId = currentPage.project_id;
        
        if (!projectId) {
          logger.error('Could not find project ID');
          toast.error('Failed to load blueprint');
          return;
        }

        // Ensure user is authenticated before calling secure function
        if (!session) {
          logger.error('No active session for blueprint URL request');
          toast.error('Authentication required');
          return;
        }

        const { data: signedUrlData, error: signedUrlError } = await supabase.functions.invoke("get-blueprint-url", {
          body: { projectId }
        });

        if (signedUrlError || !signedUrlData?.signedUrl) {
          logger.error('Error fetching signed URL:', signedUrlError);
          toast.error('Failed to load blueprint');
          return;
        }

        const loadingTask = pdfjsLib.getDocument(signedUrlData.signedUrl);
        const pdf = await loadingTask.promise;
        const pdfPage = await pdf.getPage(currentPage.page_number);
        
        const viewport = pdfPage.getViewport({ scale: 3 });
        const tempCanvas = document.createElement('canvas');
        const context = tempCanvas.getContext('2d');
        
        if (!context) return;

        tempCanvas.height = viewport.height;
        tempCanvas.width = viewport.width;

        await pdfPage.render({
          canvasContext: context,
          viewport: viewport,
        } as any).promise;

        const dataUrl = tempCanvas.toDataURL('image/png');
        const img = await FabricImage.fromURL(dataUrl);

        const container = containerRef.current;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        const scale = Math.min(
          containerWidth / img.width!,
          containerHeight / img.height!,
          1
        ) * 0.95;
        
        const scaledWidth = img.width! * scale;
        const scaledHeight = img.height! * scale;
        
        const left = (containerWidth - scaledWidth) / 2;
        const top = 20;
        
        img.scale(scale);
        img.set({
          left,
          top,
          selectable: false,
          evented: false,
        });

        (img as any).customData = { type: 'page', pageId: currentPage.id };

        // Clear canvas before adding
        fabricCanvas.clear();
        renderedPilesRef.current.clear();
        fabricCanvas.add(img);
        fabricCanvas.sendObjectToBack(img); // Keep page image behind markups
        
        // Set canvas size
        const canvasWidth = containerWidth;
        const canvasHeight = scaledHeight + 40;
        
        fabricCanvas.setWidth(canvasWidth);
        fabricCanvas.setHeight(canvasHeight);
        
        // Cache the page data
        const newCache = new Map(pageCache);
        newCache.set(currentPage.id, {
          dataUrl,
          scale,
          left,
          top,
          canvasWidth,
          canvasHeight,
          width: scaledWidth,
          height: scaledHeight,
        });
        setPageCache(newCache);
        
        setCurrentPageData({
          pageId: currentPage.id,
          width: scaledWidth,
          height: scaledHeight,
        });

        fabricCanvas.renderAll();
        
        // Pre-load adjacent pages in the background
        preloadAdjacentPages();
      } catch (error) {
        logger.error('Error loading page:', error);
        toast.error('Failed to load page');
      }
    };

    // Pre-load adjacent pages (N-1 and N+1)
    const preloadAdjacentPages = async () => {
      const adjacentPages = [
        pages[currentPageIndex - 1],
        pages[currentPageIndex + 1],
      ].filter(Boolean);

      for (const adjacentPage of adjacentPages) {
        if (pageCache.has(adjacentPage.id)) continue; // Already cached

        try {
          const projectId = adjacentPage.project_id;
          if (!projectId) continue;

          // Skip if no active session
          if (!session) continue;

          const { data: signedUrlData, error: signedUrlError } = await supabase.functions.invoke("get-blueprint-url", {
            body: { projectId }
          });

          if (signedUrlError || !signedUrlData?.signedUrl) continue;

          const loadingTask = pdfjsLib.getDocument(signedUrlData.signedUrl);
          const pdf = await loadingTask.promise;
          const pdfPage = await pdf.getPage(adjacentPage.page_number);
          
          const viewport = pdfPage.getViewport({ scale: 3 });
          const tempCanvas = document.createElement('canvas');
          const context = tempCanvas.getContext('2d');
          
          if (!context) continue;

          tempCanvas.height = viewport.height;
          tempCanvas.width = viewport.width;

          await pdfPage.render({
            canvasContext: context,
            viewport: viewport,
          } as any).promise;

          const dataUrl = tempCanvas.toDataURL('image/png');
          
          if (!containerRef.current) continue;
          
          const container = containerRef.current;
          const containerWidth = container.clientWidth;
          const containerHeight = container.clientHeight;

          const img = await FabricImage.fromURL(dataUrl);
          const scale = Math.min(
            containerWidth / img.width!,
            containerHeight / img.height!,
            1
          ) * 0.95;
          
          const scaledWidth = img.width! * scale;
          const scaledHeight = img.height! * scale;
          
          const left = (containerWidth - scaledWidth) / 2;
          const top = 20;
          
          const canvasWidth = containerWidth;
          const canvasHeight = scaledHeight + 40;
          
          // Cache the pre-loaded page
          const newCache = new Map(pageCache);
          newCache.set(adjacentPage.id, {
            dataUrl,
            scale,
            left,
            top,
            canvasWidth,
            canvasHeight,
            width: scaledWidth,
            height: scaledHeight,
          });
          setPageCache(newCache);
        } catch (error) {
          logger.error('Error pre-loading page:', error);
          // Silently fail pre-loading
        }
      }
    };

    loadCurrentPage();
  }, [fabricCanvas, currentPageIndex, currentPage, pageCache]);

  // Handle canvas clicks and drawing for pile and footing placement
  useEffect(() => {
    if (!fabricCanvas || !currentPageData) return;

    const handleMouseDown = async (e: any) => {
      if (activeTool === "pile") {
        const pointer = fabricCanvas.getPointer(e.e);
        const now = Date.now();
        
        // Prevent duplicates by checking if click is at same position within 200ms
        if (lastClickRef.current) {
          const timeDiff = now - lastClickRef.current.timestamp;
          const distance = Math.sqrt(
            Math.pow(pointer.x - lastClickRef.current.x, 2) + 
            Math.pow(pointer.y - lastClickRef.current.y, 2)
          );
          
          // If clicked within 200ms and within 5 pixels, ignore
          if (timeDiff < 200 && distance < 5) {
            return;
          }
        }
        
        // Update last click
        lastClickRef.current = { x: pointer.x, y: pointer.y, timestamp: now };
        
        // Determine color: use custom color if set, otherwise use default for pile type
        const pileColor = pileConfig.customColor || pileColors[pileConfig.pileType as keyof PileColors] || "#FF6400";
        
        // Create temporary ID for optimistic update
        const tempId = `temp-${Date.now()}`;
        const tempPile = {
          id: tempId,
          page_id: currentPage.id,
          pile_type: pileConfig.pileType,
          blade_size: pileConfig.bladeSize,
          length: pileConfig.length,
          extension: pileConfig.extension,
          position_x: pointer.x,
          position_y: pointer.y,
          is_custom: false,
          radius: 15,
          number: pileConfig.nextPileNumber,
          created_at: new Date().toISOString(),
          color: pileColor, // Use the determined color
        };
        
        // Optimistic update - add pile immediately to UI
        onPilesUpdate([...pilesRef.current, tempPile]);
        onPileNumberUpdate(pileConfig.nextPileNumber + 1);
        
        try {
          const { data, error } = await supabase
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
              color: tempPile.color, // Save the custom color
            })
            .select()
            .single();

          if (error) throw error;
          
          // Replace temp pile with real pile from DB
          onPilesUpdate(pilesRef.current.map(p => p.id === tempId ? data : p));
          // Add to history with pile ID and creation time for accurate tracking
          logger.log('➕ Adding pile to history - ID:', data.id, 'Number:', data.number, 'Created:', data.created_at);
          onHistoryAdd({ type: 'ADD_PILE', pile: data });
        } catch (error) {
          logger.error("Error adding pile:", error);
          // Remove temp pile on error
          onPilesUpdate(pilesRef.current.filter(p => p.id !== tempId));
          onPileNumberUpdate(pileConfig.nextPileNumber);
          toast.error("Failed to add pile");
        }
      } else if (activeTool === "footing" && !isDrawingFooting) {
        const pointer = fabricCanvas.getPointer(e.e);
        setIsDrawingFooting(true);
        setFootingStart(pointer);
        
        // Create temporary rectangle for preview
        const footingColor = footingColors[footingConfig.footingType] || "#64748b";
        const hexToRgba = (hex: string, alpha: number) => {
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };
        
        const rect = new Rect({
          left: pointer.x,
          top: pointer.y,
          width: 0,
          height: 0,
          fill: hexToRgba(footingColor, footingConfig.opacity),
          stroke: footingColor,
          strokeWidth: 2,
          selectable: false,
          evented: false,
        });
        setTempFootingRect(rect);
        fabricCanvas.add(rect);
      }
    };

    const handleMouseMove = (e: any) => {
      if (activeTool === "footing" && isDrawingFooting && footingStart && tempFootingRect) {
        const pointer = fabricCanvas.getPointer(e.e);
        const width = pointer.x - footingStart.x;
        const height = pointer.y - footingStart.y;
        
        tempFootingRect.set({
          width: Math.abs(width),
          height: Math.abs(height),
          left: width < 0 ? pointer.x : footingStart.x,
          top: height < 0 ? pointer.y : footingStart.y,
        });
        fabricCanvas.renderAll();
      }
    };

    const handleMouseUp = async (e: any) => {
      if (activeTool === "footing" && isDrawingFooting && footingStart) {
        const pointer = fabricCanvas.getPointer(e.e);
        
        // Remove temporary rectangle
        if (tempFootingRect) {
          fabricCanvas.remove(tempFootingRect);
          setTempFootingRect(null);
        }
        
        // Only create footing if there's actual size
        const width = Math.abs(pointer.x - footingStart.x);
        const height = Math.abs(pointer.y - footingStart.y);
        
        if (width > 10 && height > 10) {
          // Get hex color for footing type (store as hex, not rgba)
          const footingColor = footingColors[footingConfig.footingType] || "#64748b";
          // Convert hex to rgba with opacity
          const hexToRgba = (hex: string, alpha: number) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
          };
          
          const coordinates = [
            { x: footingStart.x, y: footingStart.y },
            { x: pointer.x, y: pointer.y },
          ];

          const newFooting = {
            page_id: currentPage.id,
            footing_type: footingConfig.footingType,
            shape: "rectangle",
            coordinates: coordinates,
            color: hexToRgba(footingColor, footingConfig.opacity),
          };

          try {
            const { data, error } = await supabase
              .from("footings")
              .insert(newFooting)
              .select()
              .single();

            if (error) throw error;

            onFootingsUpdate([...footings, data]);
            onHistoryAdd({ type: 'ADD_FOOTING', footing: data });
            toast.success("Footing added");
          } catch (error) {
            logger.error("Error adding footing:", error);
            toast.error("Failed to add footing");
          }
        }
        
        setIsDrawingFooting(false);
        setFootingStart(null);
      }
    };

    fabricCanvas.on("mouse:down", handleMouseDown);
    fabricCanvas.on("mouse:move", handleMouseMove);
    fabricCanvas.on("mouse:up", handleMouseUp);

    return () => {
      fabricCanvas.off("mouse:down", handleMouseDown);
      fabricCanvas.off("mouse:move", handleMouseMove);
      fabricCanvas.off("mouse:up", handleMouseUp);
    };
  }, [fabricCanvas, activeTool, isDrawingFooting, footingStart, tempFootingRect, pileConfig, footingConfig, currentPageData]);

  // Render piles with numbers and colors - runs when piles or page change
  useEffect(() => {
    if (!fabricCanvas || !currentPageData) return;

    // Filter piles for current page INSIDE the effect for clean data flow
    const currentPagePiles = piles.filter(p => p.page_id === currentPage?.id);
    const currentPileIds = new Set(currentPagePiles.map(p => p.id));
    
    // Remove piles that no longer exist from canvas - CRITICAL for undo/clear
    renderedPilesRef.current.forEach((group, pileId) => {
      if (!currentPileIds.has(pileId)) {
        fabricCanvas.remove(group);
        renderedPilesRef.current.delete(pileId);
      }
    });

    currentPagePiles.forEach((pile) => {
      // Check if pile already rendered - if so, just update its properties
      const existingGroup = renderedPilesRef.current.get(pile.id);
      
      if (existingGroup) {
        // Update existing pile's visual properties (color, scale, number) but NOT position
        const color = pile.color || pileColors[pile.pile_type as keyof PileColors] || "#FF6400";
        const radius = (pile.radius || 15) * pileConfig.scale;
        const fontSize = Math.max(12, 14 * pileConfig.scale);
        
        const circle = existingGroup.getObjects()[0] as Circle;
        const text = existingGroup.getObjects()[1] as FabricText;
        
        circle.set({ radius, fill: color });
        text.set({ text: pile.number?.toString() || "?", fontSize });
        
        // Update custom data
        (existingGroup as any).customData = { type: "pile", id: pile.id, ...pile };
        
        existingGroup.setCoords();
        return; // Skip creating new pile
      }
      
      // Create new pile if it doesn't exist
      // Use custom color if set, otherwise use pile type color
      const color = pile.color || pileColors[pile.pile_type as keyof PileColors] || "#FF6400";
      const radius = (pile.radius || 15) * pileConfig.scale;
      
      const circle = new Circle({
        left: 0,
        top: 0,
        radius: radius,
        fill: color,
        stroke: "#000000",
        strokeWidth: 2,
        originX: 'center',
        originY: 'center',
      });

      const fontSize = Math.max(12, 14 * pileConfig.scale);
      const text = new FabricText(pile.number?.toString() || "?", {
        left: 0,
        top: 0,
        fontSize: fontSize,
        fill: "#ffffff",
        fontWeight: 'bold',
        fontFamily: 'Arial, sans-serif',
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false,
      });

      // Group circle and text together
      const group = new Group([circle, text], {
        left: pile.position_x,
        top: pile.position_y,
        originX: 'center',
        originY: 'center',
      });

      (group as any).customData = { type: "pile", id: pile.id, ...pile };
      
      // Store reference to rendered pile
      renderedPilesRef.current.set(pile.id, group);
      
      fabricCanvas.add(group);
      fabricCanvas.bringObjectToFront(group); // Ensure piles are on top
      
      // Handle pile movement - update local state immediately, then save to DB
      let isUpdating = false;
      group.on('modified', async () => {
        if (isUpdating) return;
        isUpdating = true;
        
        const pos = group.getCenterPoint();
        
        // Update local state IMMEDIATELY using ref to get latest piles
        const updatedPiles = pilesRef.current.map(p => {
          if (p.id === pile.id) {
            return { ...p, position_x: pos.x, position_y: pos.y };
          }
          return p;
        });
        onPilesUpdate(updatedPiles);
        
        // Save to database and wait for completion
        try {
          await supabase
            .from("piles")
            .update({ 
              position_x: pos.x, 
              position_y: pos.y 
            })
            .eq("id", pile.id);
        } catch (error) {
          logger.error("Error updating pile position:", error);
        } finally {
          isUpdating = false;
        }
      });
    });

    fabricCanvas.renderAll();
  }, [fabricCanvas, piles, currentPageIndex, pileColors, pileConfig.scale, currentPageData]);

  // Helper function to convert hex to rgba
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Render footings - runs when footings, page, or opacity change
  useEffect(() => {
    if (!fabricCanvas || !currentPageData) return;

    // Filter footings for current page INSIDE the effect for clean data flow
    const currentPageFootings = footings.filter(f => f.page_id === currentPage?.id);

    // Remove all footings first
    const objects = fabricCanvas.getObjects();
    objects.forEach((obj: any) => {
      if (obj.customData?.type === "footing") {
        fabricCanvas.remove(obj);
      }
    });

    // Re-render current footings with current opacity
    currentPageFootings.forEach((footing) => {
      const coords = footing.coordinates;
      if (footing.shape === "rectangle" && coords.length === 2) {
        const footingColor = footingColors[footing.footing_type] || "#64748b";
        const rect = new Rect({
          left: Math.min(coords[0].x, coords[1].x),
          top: Math.min(coords[0].y, coords[1].y),
          width: Math.abs(coords[1].x - coords[0].x),
          height: Math.abs(coords[1].y - coords[0].y),
          fill: hexToRgba(footingColor, footingConfig.opacity),
          stroke: footingColor,
          strokeWidth: 2,
          selectable: true,
        });
        (rect as any).customData = { type: "footing", id: footing.id };
        fabricCanvas.add(rect);
      }
    });

    fabricCanvas.renderAll();
  }, [fabricCanvas, footings, currentPageIndex, currentPageData, footingConfig.opacity, footingColors]);

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center overflow-hidden">
      <canvas ref={canvasRef} className="border border-border rounded shadow-lg" />
      {contextMenu && (
        <PileContextMenu
          position={{ x: contextMenu.x, y: contextMenu.y }}
          selectedPileIds={contextMenu.selectedIds}
          onClose={() => setContextMenu(null)}
          onUpdate={() => {
            // Don't refetch - local state already updated
            setContextMenu(null);
          }}
        />
      )}
    </div>
  );
}
