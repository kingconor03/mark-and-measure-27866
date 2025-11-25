/**
 * PDF EXPORT SYSTEM - Draws annotations onto original PDF
 * 
 * This module exports annotations directly onto the original PDF document
 * using pdf-lib, preserving the PDF as the single source of truth.
 * 
 * KEY FEATURES:
 * 
 * 1. PRESERVES ORIGINAL PDF:
 *    - Loads original PDF and draws annotations as overlays
 *    - Does not convert PDF to images or screenshots
 *    - Maintains PDF quality and metadata
 * 
 * 2. NORMALIZED COORDINATES:
 *    - All annotations use normalized coordinates (0..1 range)
 *    - Converts to PDF page dimensions during export
 *    - Ensures accurate positioning regardless of original rendering scale
 * 
 * 3. SUPPORTS:
 *    - Single page export (pageIndex specified)
 *    - All pages export (pageIndex undefined)
 *    - Summary box overlay (optional)
 *    - Pile markers with numbers and colors
 *    - Footing rectangles with opacity
 * 
 * 4. EXPORT OPTIONS:
 *    - pdfUrl: URL to original PDF (must be accessible)
 *    - annotations: Array of annotations in normalized coordinates
 *    - pageIndex: Optional, exports specific page (0-based)
 *    - summaryImage: Optional, summary box image data URL
 *    - summaryPosition: Optional, summary box position and size
 * 
 * COORDINATE CONVERSION:
 * - Normalized coords (0..1) are multiplied by PDF page dimensions
 * - PDF coordinates are bottom-up (Y=0 at bottom), so Y is flipped
 * - Text positioning calculated for proper centering
 * 
 * NOTE: This replaces the old screenshot-based export system that used
 * html2canvas and Fabric.js canvas rendering.
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
  /** Summary box image data URL (optional) */
  summaryImage?: string;
  /** Summary box position and size on the page (optional) */
  summaryPosition?: { x: number; y: number; width: number; height: number };
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

  // Draw border circle first
  page.drawCircle({
    x: centerX,
    y: centerY,
    size: radius,
    borderColor: rgb(0, 0, 0),
    borderWidth: 2,
  });
  
  // Draw filled circle
  page.drawCircle({
    x: centerX,
    y: centerY,
    size: radius,
    color: rgb(rgbColor.r, rgbColor.g, rgbColor.b),
  });

  // Draw pile number LAST to ensure it's on top
  const number = annotation.meta?.number;
  if (number !== undefined) {
    const text = number.toString();
    const fontSize = 16; // Slightly larger for better visibility
    // Calculate text width for proper centering (approximate: ~0.55 * fontSize per character)
    const textWidth = text.length * fontSize * 0.55;
    const textHeight = fontSize * 0.35; // Adjust for baseline positioning
    
    page.drawText(text, {
      x: centerX - textWidth / 2,
      y: centerY - textHeight,
      size: fontSize,
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

    // Get all pages from PDF
    const allPages = pdfDoc.getPages();
    
    // Filter annotations by page if exporting single page
    const filteredAnnotations = options.pageIndex !== undefined
      ? options.annotations.filter(ann => ann.pageIndex === options.pageIndex)
      : options.annotations;

    // Group annotations by page index
    const annotationsByPage = new Map<number, Annotation[]>();
    for (const annotation of filteredAnnotations) {
      const pageAnns = annotationsByPage.get(annotation.pageIndex) || [];
      pageAnns.push(annotation);
      annotationsByPage.set(annotation.pageIndex, pageAnns);
    }

    // Determine which pages to include in output
    // For single page export: only that page
    // For full PDF export: all pages, with annotations overlaid where present
    const pagesToInclude = options.pageIndex !== undefined
      ? [options.pageIndex]
      : Array.from({ length: allPages.length }, (_, i) => i);
    
    // Create new PDF document
    const outputPdf = await PDFDocument.create();
    
    // Copy pages and draw annotations
    for (const pageIdx of pagesToInclude) {
      const [copiedPage] = await outputPdf.copyPages(pdfDoc, [pageIdx]);
      outputPdf.addPage(copiedPage);
      
      const pageAnnotations = annotationsByPage.get(pageIdx) || [];

      const pageSize = copiedPage.getSize();
      const pageWidth = pageSize.width;
      const pageHeight = pageSize.height;

      // Draw each annotation
      for (const annotation of pageAnnotations) {
        switch (annotation.type) {
          case "pile_marker":
            drawPileMarker(copiedPage, annotation, pageWidth, pageHeight);
            break;
          case "footing":
            drawFooting(copiedPage, annotation, pageWidth, pageHeight);
            break;
          // Add other annotation types as needed
        }
      }
      
      // Draw summary box if provided and this is the first page being exported
      if (options.summaryImage && options.summaryPosition && pageIdx === pagesToInclude[0]) {
        try {
          const summaryBytes = await fetch(options.summaryImage).then((res) => res.arrayBuffer());
          const summaryImg = await outputPdf.embedPng(summaryBytes);
          
          // Calculate position - summaryPosition is relative to canvas, need to convert to PDF coordinates
          // Assuming summaryPosition is in pixels relative to the page at a certain scale
          // We'll position it at a fixed location (e.g., bottom right)
          const summaryWidth = Math.min(options.summaryPosition.width, pageWidth * 0.4); // Max 40% of page width
          const summaryHeight = (summaryWidth / options.summaryPosition.width) * options.summaryPosition.height;
          const summaryX = pageWidth - summaryWidth - 20; // 20pt margin from right
          const summaryY = 20; // 20pt margin from bottom
          
          copiedPage.drawImage(summaryImg, {
            x: summaryX,
            y: summaryY,
            width: summaryWidth,
            height: summaryHeight,
          });
        } catch (error) {
          console.error("Error embedding summary image:", error);
          // Continue without summary if it fails
        }
      }
    }

    // Save and download
    const modifiedPdfBytes = await outputPdf.save();
    const blob = new Blob([modifiedPdfBytes as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;

    const pageSuffix = options.pageIndex !== undefined
      ? `_Page${options.pageIndex + 1}`
      : "_all_pages";
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


