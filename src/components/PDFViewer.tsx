import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Download, ZoomIn, ZoomOut } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { PDFAnnotationPage } from "./PDFAnnotationPage";
import { screenToNorm, PageGeometry } from "@/utils/coordinateUtils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import "./PDFViewer.css";

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface PDFViewerProps {
  fileUrl: string;
  fileName: string;
  onClose: () => void;
  isImage?: boolean;
}

export function PDFViewer({ fileUrl, fileName, onClose, isImage = false }: PDFViewerProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [loading, setLoading] = useState(true);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [pages, setPages] = useState<any[]>([]);
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const pdfDocRef = useRef<any>(null);
  const { session } = useAuth();
  
  // Pan state
  const isPanning = useRef(false);
  const lastPanPoint = useRef({ x: 0, y: 0 });

  // Resolve the file URL - handle both public URLs and storage paths
  useEffect(() => {
    const resolveFileUrl = async () => {
      try {
        setLoading(true);
        setResolvedUrl(null);
        
        console.log("🔍 Resolving file URL:", fileUrl);
        
        // Check if fileUrl is a Supabase storage URL (public or authenticated)
        const supabaseStorageMatch = fileUrl.match(/\/storage\/v1\/object\/(public|authenticated)\/([^/]+)\/(.+)$/);
        
        if (supabaseStorageMatch) {
          const [, accessType, bucket, path] = supabaseStorageMatch;
          console.log(`📦 Detected ${accessType} bucket: ${bucket}, path: ${path}`);
          
          // Private buckets (blueprints, org-assets, etc.) need signed URLs
          const privateBuckets = ['blueprints', 'org-assets', 'quote-files', 'cert-files'];
          
          if (privateBuckets.includes(bucket) && session) {
            console.log("🔐 Creating signed URL for private bucket:", bucket);
            
            const { data, error } = await supabase.storage
              .from(bucket)
              .createSignedUrl(path, 3600); // 1 hour expiry
            
            if (error) {
              console.error("❌ Error creating signed URL:", error);
              alert(`Cannot access file in private bucket "${bucket}". Please check your permissions.`);
              setLoading(false);
              return;
            }
            
            if (data?.signedUrl) {
              console.log("✅ Got signed URL successfully");
              setResolvedUrl(data.signedUrl);
              return;
            }
          } else if (accessType === 'public') {
            // Already a public URL, use as-is
            console.log("✅ Using public URL as-is");
            setResolvedUrl(fileUrl);
            return;
          }
        }
        
        // Check if it's already a full URL (non-Supabase)
        if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
          console.log("✅ Using provided URL as-is:", fileUrl);
          setResolvedUrl(fileUrl);
          return;
        }
        
        // Check if it's a storage path format like "blueprints/path/to/file.pdf"
        const storagePathMatch = fileUrl.match(/^(org-assets|blueprints|quote-files|cert-files)\/(.+)$/);
        if (storagePathMatch && session) {
          const bucket = storagePathMatch[1];
          const path = storagePathMatch[2];
          
          console.log("🔐 Fetching signed URL for bucket:", bucket, "path:", path);
          
          const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, 3600);
          
          if (error) {
            console.error("❌ Error creating signed URL:", error);
            alert(`Cannot access file: ${error.message}`);
            setLoading(false);
            return;
          }
          
          if (data?.signedUrl) {
            console.log("✅ Got signed URL successfully");
            setResolvedUrl(data.signedUrl);
            return;
          }
        }
        
        // Fallback: use fileUrl as-is
        console.log("⚠️ Using fileUrl as fallback:", fileUrl);
        setResolvedUrl(fileUrl);
        
      } catch (error) {
        console.error("❌ Error resolving file URL:", error);
        setResolvedUrl(fileUrl);
      }
    };
    
    resolveFileUrl();
  }, [fileUrl, session]);

  useEffect(() => {
    if (!resolvedUrl) return;
    
    if (isImage) {
      loadImage();
    } else {
      loadPDF();
    }
  }, [resolvedUrl, isImage]);

  // No need to render individual pages anymore - PDFAnnotationPage handles it

  const loadImage = () => {
    if (imageRef.current && resolvedUrl) {
      imageRef.current.onload = () => {
        setLoading(false);
      };
      imageRef.current.onerror = () => {
        console.error("Failed to load image");
        setLoading(false);
      };
      imageRef.current.src = resolvedUrl;
    }
  };

  const loadPDF = async () => {
    if (!resolvedUrl) {
      console.error("❌ No resolved URL available");
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      console.log("📄 Loading PDF from URL:", resolvedUrl);
      
      // Configure PDF.js to handle CORS if needed
      const loadingTask = pdfjsLib.getDocument({
        url: resolvedUrl,
        httpHeaders: {},
        withCredentials: false,
      });
      
      const pdf = await loadingTask.promise;
      console.log("✅ PDF loaded successfully, pages:", pdf.numPages);
      
      pdfDocRef.current = pdf;
      setNumPages(pdf.numPages);
      
      // Load all pages
      const pagesArray = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        try {
          const page = await pdf.getPage(i);
          pagesArray.push(page);
          console.log(`✅ Loaded page ${i}/${pdf.numPages}`);
        } catch (pageError) {
          console.error(`❌ Error loading page ${i}:`, pageError);
        }
      }
      
      if (pagesArray.length > 0) {
        setPages(pagesArray);
        console.log(`✅ Successfully loaded ${pagesArray.length} pages, setting pages state`);
      } else {
        console.error("❌ No pages were loaded successfully");
      }
    } catch (error) {
      console.error("❌ Error loading PDF:", error);
      // Show error message to user
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to load PDF: ${errorMsg}\n\nThis might be a storage bucket issue. Please check that the file exists and is accessible.`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading PDF:", error);
    }
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const goToPrevPage = () => {
    setPageNum((prev) => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    setPageNum((prev) => Math.min(numPages, prev + 1));
  };

  // Pan handlers
  const handlePanStart = (e: React.MouseEvent<HTMLDivElement>) => {
    // Use middle mouse button or Ctrl+Click to pan
    if (e.button !== 1 && !e.ctrlKey) return;
    e.preventDefault();
    isPanning.current = true;
    lastPanPoint.current = { x: e.clientX, y: e.clientY };
    if (viewportRef.current) {
      viewportRef.current.style.cursor = 'grabbing';
    }

    // Attach listeners to the window to handle dragging outside the viewport
    window.addEventListener('mousemove', handlePanMove);
    window.addEventListener('mouseup', handlePanEnd);
  };

  const handlePanMove = (e: MouseEvent) => {
    if (!isPanning.current || !viewportRef.current) return;
    const dx = e.clientX - lastPanPoint.current.x;
    const dy = e.clientY - lastPanPoint.current.y;
    
    viewportRef.current.scrollLeft -= dx;
    viewportRef.current.scrollTop -= dy;

    lastPanPoint.current = { x: e.clientX, y: e.clientY };
  };

  const handlePanEnd = () => {
    isPanning.current = false;
    if (viewportRef.current) {
      viewportRef.current.style.cursor = 'default';
    }
    window.removeEventListener('mousemove', handlePanMove);
    window.removeEventListener('mouseup', handlePanEnd);
  };

  // Click handler for creating annotations (if needed)
  const handleContainerClick = (event: React.MouseEvent<HTMLDivElement>) => {
    // We only care about clicks directly on the container, not on annotations.
    if (event.target !== event.currentTarget) return;

    const viewport = viewportRef.current;
    if (!viewport || !pdfDocRef.current) return;

    const viewportRect = viewport.getBoundingClientRect();

    // 1 & 2: Mouse position relative to the total scrolled content
    const contentMouseX = event.clientX - viewportRect.left + viewport.scrollLeft;
    const contentMouseY = event.clientY - viewportRect.top + viewport.scrollTop;

    // 3. Find the target page element
    const pageElements = Array.from(viewport.querySelectorAll('.pdf-page-wrapper'));
    const targetPageElement = pageElements.find(el => {
      const rect = el.getBoundingClientRect();
      const pageTop = rect.top - viewportRect.top + viewport.scrollTop;
      const pageBottom = pageTop + rect.height;
      return contentMouseY >= pageTop && contentMouseY <= pageBottom;
    });

    if (!targetPageElement) return; // Click was in the padding between pages

    // Extract page index from data attribute
    const pageIndex = parseInt(targetPageElement.getAttribute('data-page-number') || '1') - 1;
    const page = pages[pageIndex];
    if (!page) return;

    const pageRect = targetPageElement.getBoundingClientRect();
    const viewportObj = page.getViewport({ scale: 1 });

    // 4. Calculate the page's geometry
    const pageGeo: PageGeometry = {
      pageWidth: viewportObj.width,
      pageHeight: viewportObj.height,
      zoom: scale,
      pageOffsetX: pageRect.left - viewportRect.left + viewport.scrollLeft,
      pageOffsetY: pageRect.top - viewportRect.top + viewport.scrollTop,
    };

    // 5. Convert to normalized coordinates
    const normCoords = screenToNorm(contentMouseX, contentMouseY, pageGeo);

    if (normCoords) {
      // Create and add the new annotation if needed
      console.log('New annotation at:', normCoords, 'on page', pageIndex + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold truncate max-w-md">{fileName}</h2>
          <span className="text-sm text-muted-foreground">
            Page {pageNum} of {numPages}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <div className="flex items-center gap-1 border rounded-md">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleZoomOut}
              disabled={scale <= 0.5}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs px-2 text-muted-foreground">
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleZoomIn}
              disabled={scale >= 3}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          {/* Page Navigation */}
          {numPages > 1 && (
            <div className="flex items-center gap-1 border rounded-md">
              <Button
                variant="ghost"
                size="sm"
                onClick={goToPrevPage}
                disabled={pageNum === 1}
              >
                Previous
              </Button>
              <span className="text-xs px-2 text-muted-foreground">
                {pageNum} / {numPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={goToNextPage}
                disabled={pageNum === numPages}
              >
                Next
              </Button>
            </div>
          )}

          <Button variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* PDF/Image Content */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Loading {isImage ? "image" : "PDF"}...</p>
          </div>
        ) : isImage ? (
          <div className="flex items-center justify-center h-full bg-muted/30 p-8">
            <div className="bg-white shadow-lg rounded-lg p-4">
              <img 
                ref={imageRef} 
                src={fileUrl} 
                alt={fileName}
                className="max-w-full h-auto"
                style={{ maxHeight: "calc(100vh - 200px)" }}
              />
            </div>
          </div>
        ) : resolvedUrl && pages.length > 0 ? (
          <div
            ref={viewportRef}
            className="pdf-viewer-viewport"
            onMouseDown={handlePanStart}
          >
            <div 
              className="pdf-viewer-container"
              onClick={handleContainerClick}
            >
              {pages.map((pdfPage, index) => (
                <PDFAnnotationPage
                  key={index + 1}
                  pageNumber={index + 1}
                  pdfPage={pdfPage}
                  zoom={scale}
                  annotations={annotations.filter(a => a.pageIndex === index)}
                  onAnnotationClick={(annotation) => {
                    console.log('Annotation clicked:', annotation);
                  }}
                />
              ))}
            </div>
          </div>
        ) : resolvedUrl ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Failed to load PDF. Check console for errors.</p>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Resolving file URL...</p>
          </div>
        )}
      </div>
    </div>
  );
}

