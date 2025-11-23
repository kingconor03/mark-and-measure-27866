/**
 * PDFAnnotationPage - Renders a single PDF page with annotation overlays.
 * This component handles rendering the PDF page and positioning annotations
 * that are stored in normalized coordinates.
 */

import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Annotation } from "@/lib/annotations";
import { PageGeometry } from "@/utils/coordinateUtils";

interface PDFAnnotationPageProps {
  pageNumber: number; // 1-based page number
  pdfPage: any; // pdf.js page object
  zoom: number;
  annotations: Annotation[];
  onAnnotationClick?: (annotation: Annotation) => void;
  renderAnnotation?: (annotation: Annotation, screenPos: { x: number; y: number }, geo: PageGeometry) => React.ReactNode;
}

export function PDFAnnotationPage({
  pageNumber,
  pdfPage,
  zoom,
  annotations,
  onAnnotationClick,
  renderAnnotation,
}: PDFAnnotationPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [pageGeometry, setPageGeometry] = useState<PageGeometry | null>(null);

  // Render the PDF page
  useEffect(() => {
    if (!canvasRef.current || !pdfPage) {
      console.log(`⚠️ Page ${pageNumber}: Missing canvas or pdfPage`, { 
        hasCanvas: !!canvasRef.current, 
        hasPdfPage: !!pdfPage 
      });
      return;
    }

    const render = async () => {
      try {
        console.log(`🎨 Rendering page ${pageNumber}...`);
        const viewport = pdfPage.getViewport({ scale: zoom });
        const canvas = canvasRef.current;
        if (!canvas) {
          console.error(`❌ Page ${pageNumber}: Canvas ref lost during render`);
          return;
        }

        const context = canvas.getContext("2d");
        if (!context) {
          console.error(`❌ Page ${pageNumber}: Failed to get 2D context`);
          return;
        }

        canvas.height = viewport.height;
        canvas.width = viewport.width;
        console.log(`📐 Page ${pageNumber} canvas dimensions: ${canvas.width}x${canvas.height}`);

        await pdfPage.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;

        console.log(`✅ Page ${pageNumber} rendered successfully`);

        // Update page geometry after rendering
        if (wrapperRef.current) {
          const wrapperRect = wrapperRef.current.getBoundingClientRect();
          const viewport = pdfPage.getViewport({ scale: 1 }); // Natural size
          
          setPageGeometry({
            pageWidth: viewport.width,
            pageHeight: viewport.height,
            zoom,
            pageOffsetX: wrapperRect.left,
            pageOffsetY: wrapperRect.top,
          });
        }
      } catch (error) {
        console.error(`❌ Error rendering PDF page ${pageNumber}:`, error);
      }
    };

    render();
  }, [pdfPage, zoom, pageNumber]);

  // Update page geometry on scroll/resize
  useEffect(() => {
    if (!wrapperRef.current || !pdfPage) return;

    const updateGeometry = () => {
      if (!wrapperRef.current) return;
      
      const wrapperRect = wrapperRef.current.getBoundingClientRect();
      const viewport = pdfPage.getViewport({ scale: 1 });
      const viewportElement = wrapperRef.current.closest('.pdf-viewer-viewport') as HTMLElement;
      
      if (viewportElement) {
        setPageGeometry({
          pageWidth: viewport.width,
          pageHeight: viewport.height,
          zoom,
          pageOffsetX: wrapperRect.left - viewportElement.getBoundingClientRect().left + viewportElement.scrollLeft,
          pageOffsetY: wrapperRect.top - viewportElement.getBoundingClientRect().top + viewportElement.scrollTop,
        });
      }
    };

    updateGeometry();
    const viewport = wrapperRef.current.closest('.pdf-viewer-viewport');
    viewport?.addEventListener('scroll', updateGeometry);
    window.addEventListener('resize', updateGeometry);

    return () => {
      viewport?.removeEventListener('scroll', updateGeometry);
      window.removeEventListener('resize', updateGeometry);
    };
  }, [pdfPage, zoom]);

  // Filter annotations for this page
  const pageAnnotations = annotations.filter(a => a.pageIndex === pageNumber - 1); // Convert to 0-based

  return (
    <div
      ref={wrapperRef}
      id={`page-wrapper-${pageNumber}`}
      className="pdf-page-wrapper"
      data-page-number={pageNumber}
      style={{ position: 'relative' }}
    >
      <canvas ref={canvasRef} />
      
      {/* Annotation overlay layer */}
      {pageGeometry && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: pageGeometry.pageWidth * pageGeometry.zoom,
            height: pageGeometry.pageHeight * pageGeometry.zoom,
            pointerEvents: 'none',
          }}
        >
          {pageAnnotations.map((annotation) => {
            // Convert normalized coordinates to pixels within the page
            const naturalX = annotation.xNorm * pageGeometry.pageWidth;
            const naturalY = annotation.yNorm * pageGeometry.pageHeight;
            
            // Apply zoom
            const pixelX = naturalX * pageGeometry.zoom;
            const pixelY = naturalY * pageGeometry.zoom;
            
            return (
              <div
                key={annotation.id}
                style={{
                  position: 'absolute',
                  left: `${pixelX}px`,
                  top: `${pixelY}px`,
                  transform: 'translate(-50%, -50%)', // Center on the point
                  pointerEvents: 'auto',
                }}
                onClick={() => onAnnotationClick?.(annotation)}
              >
                {renderAnnotation ? (
                  renderAnnotation(annotation, { x: pixelX, y: pixelY }, pageGeometry)
                ) : (
                  <DefaultAnnotationRenderer annotation={annotation} pageGeometry={pageGeometry} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Default annotation renderer - renders a simple marker
 */
function DefaultAnnotationRenderer({ annotation, pageGeometry }: { annotation: Annotation; pageGeometry: PageGeometry }) {
  if (annotation.type === "pile_marker") {
    // Use normalized size converted to pixels at current zoom
    const radius = annotation.widthNorm 
      ? (annotation.widthNorm * pageGeometry.pageWidth * pageGeometry.zoom) / 2
      : 15 * pageGeometry.zoom;
    
    return (
      <div
        style={{
          width: `${radius * 2}px`,
          height: `${radius * 2}px`,
          borderRadius: '50%',
          backgroundColor: annotation.color || "#FF6400",
          border: '2px solid black',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 'bold',
          fontSize: `${12 * pageGeometry.zoom}px`,
        }}
      >
        {annotation.meta?.number || "?"}
      </div>
    );
  }
  
  if (annotation.type === "footing") {
    const width = annotation.widthNorm 
      ? annotation.widthNorm * pageGeometry.pageWidth * pageGeometry.zoom
      : 50 * pageGeometry.zoom;
    const height = annotation.heightNorm 
      ? annotation.heightNorm * pageGeometry.pageHeight * pageGeometry.zoom
      : 50 * pageGeometry.zoom;
    
    return (
      <div
        style={{
          width: `${width}px`,
          height: `${height}px`,
          backgroundColor: annotation.color || "rgba(100, 116, 139, 0.5)",
          border: `2px solid ${annotation.color || "#64748b"}`,
        }}
      />
    );
  }
  
  return null;
}

