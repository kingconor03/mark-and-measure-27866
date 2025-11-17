import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { toast } from "sonner";

// @ts-ignore
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface PDFPreviewSelectorProps {
  file: File;
  onPagesSelected: (selectedPages: number[]) => void;
  onCancel: () => void;
}

export function PDFPreviewSelector({ file, onPagesSelected, onCancel }: PDFPreviewSelectorProps) {
  const [loading, setLoading] = useState(true);
  const [pageCount, setPageCount] = useState(0);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [thumbnails, setThumbnails] = useState<Map<number, string>>(new Map());
  const pdfDocRef = useRef<any>(null);

  useEffect(() => {
    loadPDF();
  }, [file]);

  const loadPDF = async () => {
    try {
      setLoading(true);
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      pdfDocRef.current = pdf;
      
      const count = pdf.numPages;
      setPageCount(count);
      
      // Select all pages by default
      const allPages = new Set<number>();
      for (let i = 1; i <= count; i++) {
        allPages.add(i);
      }
      setSelectedPages(allPages);
      
      // Load thumbnails for first 10 pages initially
      const initialThumbnails = new Map<number, string>();
      const loadPromises = [];
      for (let i = 1; i <= Math.min(10, count); i++) {
        loadPromises.push(loadThumbnail(pdf, i, initialThumbnails));
      }
      await Promise.all(loadPromises);
      setThumbnails(initialThumbnails);
      
      // Load remaining thumbnails in background
      if (count > 10) {
        for (let i = 11; i <= count; i++) {
          loadThumbnail(pdf, i, initialThumbnails).then(() => {
            setThumbnails(new Map(initialThumbnails));
          });
        }
      }
    } catch (error) {
      console.error("Error loading PDF:", error);
      toast.error("Failed to load PDF preview");
    } finally {
      setLoading(false);
    }
  };

  const loadThumbnail = async (pdf: any, pageNum: number, thumbnailsMap: Map<number, string>) => {
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 0.5 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      
      if (!context) return;
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;
      
      thumbnailsMap.set(pageNum, canvas.toDataURL("image/png"));
    } catch (error) {
      console.error(`Error loading thumbnail for page ${pageNum}:`, error);
    }
  };

  const togglePage = (pageNum: number) => {
    const newSelected = new Set(selectedPages);
    if (newSelected.has(pageNum)) {
      newSelected.delete(pageNum);
    } else {
      newSelected.add(pageNum);
    }
    setSelectedPages(newSelected);
  };

  const selectAll = () => {
    const all = new Set<number>();
    for (let i = 1; i <= pageCount; i++) {
      all.add(i);
    }
    setSelectedPages(all);
  };

  const selectNone = () => {
    setSelectedPages(new Set());
  };

  const handleConfirm = () => {
    if (selectedPages.size === 0) {
      toast.error("Please select at least one page");
      return;
    }
    onPagesSelected(Array.from(selectedPages).sort((a, b) => a - b));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading PDF preview...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Select pages to mark up</p>
          <p className="text-xs text-muted-foreground">
            {selectedPages.size} of {pageCount} pages selected
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={selectAll}>
            Select All
          </Button>
          <Button variant="outline" size="sm" onClick={selectNone}>
            Select None
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 max-h-[400px] overflow-y-auto p-2">
        {Array.from({ length: pageCount }, (_, i) => i + 1).map((pageNum) => {
          const thumbnail = thumbnails.get(pageNum);
          const isSelected = selectedPages.has(pageNum);
          
          return (
            <div
              key={pageNum}
              className={`relative border-2 rounded-lg overflow-hidden cursor-pointer transition-all ${
                isSelected ? "border-primary ring-2 ring-primary" : "border-muted"
              }`}
              onClick={() => togglePage(pageNum)}
            >
              <div className="aspect-[3/4] bg-muted flex items-center justify-center relative">
                {thumbnail ? (
                  <img
                    src={thumbnail}
                    alt={`Page ${pageNum}`}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                )}
                <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                  Page {pageNum}
                </div>
                {isSelected && (
                  <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-3 justify-end pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleConfirm} disabled={selectedPages.size === 0}>
          Confirm Selection ({selectedPages.size} pages)
        </Button>
      </div>
    </div>
  );
}

