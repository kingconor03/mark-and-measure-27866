/**
 * New PDF export system that draws annotations onto the original PDF.
 * Uses normalized coordinates to position annotations accurately.
 */

import { PDFDocument, rgb, PDFPage } from "pdf-lib";
import { Annotation } from "./annotations";
import * as pdfjsLib from "pdfjs-dist";

export interface ExportAnnotationsOptions {
  /** URL to the original PDF file */
  pdfUrl: string;
  /** Array of annotations in normalized coordinates */
  annotations: Annotation[];
  /** Project name for file naming */
  projectName: string;
  /** Page index to export (0-based), or undefined to export all pages */
  pageIndex?: number;
}

/**
 * Convert hex color string to pdf-lib RGB color.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { r, g, b };
}

/**
 * Draw a pile marker annotation on a PDF page.
 */
function drawPileMarker(
  page: PDFPage,
  annotation: Annotation,
  pageWidth: number,
  pageHeight: number
) {
  if (!annotation.widthNorm || !annotation.heightNorm) return;

  const centerX = annotation.xNorm * pageWidth;
  const centerY = pageHeight - (annotation.yNorm * pageHeight); // PDF coordinates are bottom-up
  const radius = (annotation.widthNorm * pageWidth) / 2;

  const color = annotation.color || "#FF6400";
  const rgbColor = hexToRgb(color);

  // Draw filled circle
  page.drawCircle({
    x: centerX,
    y: centerY,
    size: radius,
    color: rgb(rgbColor.r, rgbColor.g, rgbColor.b),
    borderColor: rgb(0, 0, 0),
    borderWidth: 2,
  });

  // Draw pile number if available
  const number = annotation.meta?.number;
  if (number !== undefined) {
    page.drawText(number.toString(), {
      x: centerX - 3, // Rough centering (font size dependent)
      y: centerY - 3,
      size: 12,
      color: rgb(1, 1, 1), // White text
    });
  }
}

/**
 * Draw a footing annotation on a PDF page.
 */
function drawFooting(
  page: PDFPage,
  annotation: Annotation,
  pageWidth: number,
  pageHeight: number
) {
  if (!annotation.widthNorm || !annotation.heightNorm) return;

  const x = annotation.xNorm * pageWidth;
  const y = pageHeight - (annotation.yNorm * pageHeight) - (annotation.heightNorm * pageHeight);
  const width = annotation.widthNorm * pageWidth;
  const height = annotation.heightNorm * pageHeight;

  const color = annotation.color || "#64748b";
  const rgbColor = hexToRgb(color);
  
  // Extract opacity from RGBA color string if present, otherwise default to 0.5
  let opacity = 0.5;
  if (color.startsWith("rgba")) {
    const match = color.match(/rgba\([^)]+,\s*([0-9.]+)\)/);
    if (match) opacity = parseFloat(match[1]);
  }

  // Draw filled rectangle with opacity
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: rgb(rgbColor.r, rgbColor.g, rgbColor.b),
    opacity,
    borderColor: rgb(rgbColor.r * 0.7, rgbColor.g * 0.7, rgbColor.b * 0.7),
    borderWidth: 2,
  });
}

/**
 * Export annotations onto the original PDF.
 * This preserves the original PDF and draws annotations as overlays.
 */
export async function exportAnnotationsToPDF(
  options: ExportAnnotationsOptions
): Promise<void> {
  try {
    // Load the original PDF
    const pdfBytes = await fetch(options.pdfUrl).then((res) => res.arrayBuffer());
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Get all pages or filter by pageIndex
    const pages = pdfDoc.getPages();
    const pagesToExport = options.pageIndex !== undefined
      ? [pages[options.pageIndex]]
      : pages;

    // Group annotations by page index
    const annotationsByPage = new Map<number, Annotation[]>();
    for (const annotation of options.annotations) {
      const pageAnns = annotationsByPage.get(annotation.pageIndex) || [];
      pageAnns.push(annotation);
      annotationsByPage.set(annotation.pageIndex, pageAnns);
    }

    // Draw annotations on each page
    for (let i = 0; i < pagesToExport.length; i++) {
      const page = pagesToExport[i];
      const pageIndex = options.pageIndex !== undefined ? options.pageIndex : i;
      const pageAnnotations = annotationsByPage.get(pageIndex) || [];

      const pageSize = page.getSize();
      const pageWidth = pageSize.width;
      const pageHeight = pageSize.height;

      // Draw each annotation
      for (const annotation of pageAnnotations) {
        switch (annotation.type) {
          case "pile_marker":
            drawPileMarker(page, annotation, pageWidth, pageHeight);
            break;
          case "footing":
            drawFooting(page, annotation, pageWidth, pageHeight);
            break;
          // Add other annotation types as needed
        }
      }
    }

    // Save and download
    const modifiedPdfBytes = await pdfDoc.save();
    const blob = new Blob([modifiedPdfBytes as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;

    const pageSuffix = options.pageIndex !== undefined
      ? `_Page${options.pageIndex + 1}`
      : "";
    link.download = `${options.projectName}${pageSuffix}_annotated.pdf`;
    link.click();

    // Clean up
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error exporting annotations to PDF:", error);
    throw error;
  }
}

/**
 * Get PDF page dimensions from a PDF.js document.
 * Useful for coordinate conversion.
 */
export async function getPdfPageDimensions(
  pdfUrl: string,
  pageIndex: number
): Promise<{ width: number; height: number }> {
  const loadingTask = pdfjsLib.getDocument(pdfUrl);
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(pageIndex + 1); // pdf.js uses 1-based indexing
  const viewport = page.getViewport({ scale: 1 });
  return {
    width: viewport.width,
    height: viewport.height,
  };
}

