import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Download, ZoomIn, ZoomOut } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface PDFViewerProps {
  fileUrl: string;
  fileName: string;
  onClose: () => void;
  isImage?: boolean;
}

export function PDFViewer({ fileUrl, fileName, onClose, isImage = false }: PDFViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [loading, setLoading] = useState(true);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const pdfDocRef = useRef<any>(null);

  useEffect(() => {
    if (isImage) {
      loadImage();
    } else {
      loadPDF();
    }
  }, [fileUrl, isImage]);

  useEffect(() => {
    if (pdfDocRef.current && !isImage) {
      renderPage(pageNum);
    }
  }, [pageNum, scale, isImage]);

  const loadImage = () => {
    if (imageRef.current) {
      imageRef.current.onload = () => {
        setLoading(false);
      };
      imageRef.current.src = fileUrl;
    }
  };

  const loadPDF = async () => {
    try {
      setLoading(true);
      const loadingTask = pdfjsLib.getDocument(fileUrl);
      const pdf = await loadingTask.promise;
      pdfDocRef.current = pdf;
      setNumPages(pdf.numPages);
      await renderPage(1);
    } catch (error) {
      console.error("Error loading PDF:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderPage = async (page: number) => {
    if (!pdfDocRef.current || !canvasRef.current) return;

    try {
      const pdfPage = await pdfDocRef.current.getPage(page);
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      if (!context) return;

      const viewport = pdfPage.getViewport({ scale });
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await pdfPage.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;
    } catch (error) {
      console.error("Error rendering page:", error);
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
      <div className="flex-1 overflow-auto bg-muted/30 flex items-center justify-center p-8">
        {loading ? (
          <div className="text-center">
            <p className="text-muted-foreground">Loading {isImage ? "image" : "PDF"}...</p>
          </div>
        ) : isImage ? (
          <div className="bg-white shadow-lg rounded-lg p-4">
            <img 
              ref={imageRef} 
              src={fileUrl} 
              alt={fileName}
              className="max-w-full h-auto"
              style={{ maxHeight: "calc(100vh - 200px)" }}
            />
          </div>
        ) : (
          <div className="bg-white shadow-lg rounded-lg p-4">
            <canvas ref={canvasRef} className="max-w-full" />
          </div>
        )}
      </div>
    </div>
  );
}

