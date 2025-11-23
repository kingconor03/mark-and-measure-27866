/**
 * Annotation system for PDF markup.
 * All annotations are stored in normalized PDF coordinates (0..1 range)
 * and rendered as overlays on top of the PDF.
 */

export type AnnotationType = "pile_marker" | "footing" | "highlight" | "text" | "shape";

/**
 * Base annotation interface using normalized PDF coordinates.
 * Coordinates are relative to the PDF page dimensions (0..1 range).
 */
export interface Annotation {
  id: string;
  pageIndex: number; // Zero-based page index
  type: AnnotationType;
  xNorm: number; // Normalized X position (0..1 relative to page width)
  yNorm: number; // Normalized Y position (0..1 relative to page height)
  widthNorm?: number; // Normalized width (0..1 relative to page width)
  heightNorm?: number; // Normalized height (0..1 relative to page height)
  rotationDeg?: number; // Rotation in degrees
  color?: string; // Color for rendering
  meta?: Record<string, any>; // Additional metadata (pile_type, footing_type, etc.)
}

/**
 * Page transform information for coordinate conversion.
 * This represents how a PDF page is displayed on screen.
 */
export interface PageTransform {
  // Page dimensions in PDF units (or base rendered pixels)
  pdfPageWidth: number;
  pdfPageHeight: number;
  
  // Position of the page on screen (top-left corner)
  offsetX: number;
  offsetY: number;
  
  // Current zoom level
  zoom: number;
  
  // Actual rendered dimensions on screen (after zoom)
  renderedWidth: number;
  renderedHeight: number;
}

/**
 * Convert screen coordinates to normalized PDF coordinates.
 * 
 * @param screenX - X coordinate on screen (pixels)
 * @param screenY - Y coordinate on screen (pixels)
 * @param pageTransform - Page transform information
 * @returns Normalized coordinates (0..1 range)
 */
export function screenToAnnotation(
  screenX: number,
  screenY: number,
  pageTransform: PageTransform
): { xNorm: number; yNorm: number } {
  // Get coordinates relative to page top-left
  const cx = screenX - pageTransform.offsetX;
  const cy = screenY - pageTransform.offsetY;

  // Convert to PDF units (accounting for zoom)
  const px = cx / pageTransform.zoom;
  const py = cy / pageTransform.zoom;

  // Normalize to 0..1 range relative to PDF page dimensions
  const xNorm = px / pageTransform.pdfPageWidth;
  const yNorm = py / pageTransform.pdfPageHeight;

  // Clamp to valid range
  return {
    xNorm: Math.max(0, Math.min(1, xNorm)),
    yNorm: Math.max(0, Math.min(1, yNorm)),
  };
}

/**
 * Convert normalized PDF coordinates to screen coordinates.
 * 
 * @param annotation - Annotation with normalized coordinates
 * @param pageTransform - Page transform information
 * @returns Screen coordinates (pixels)
 */
export function annotationToScreen(
  annotation: Pick<Annotation, "xNorm" | "yNorm" | "widthNorm" | "heightNorm">,
  pageTransform: PageTransform
): { 
  screenX: number; 
  screenY: number;
  screenWidth?: number;
  screenHeight?: number;
} {
  // Convert normalized coordinates to PDF units
  const px = annotation.xNorm * pageTransform.pdfPageWidth;
  const py = annotation.yNorm * pageTransform.pdfPageHeight;

  // Convert to screen coordinates (accounting for zoom)
  const cx = px * pageTransform.zoom;
  const cy = py * pageTransform.zoom;

  // Add page offset
  const screenX = cx + pageTransform.offsetX;
  const screenY = cy + pageTransform.offsetY;

  const result: { 
    screenX: number; 
    screenY: number;
    screenWidth?: number;
    screenHeight?: number;
  } = { screenX, screenY };

  // Convert dimensions if provided
  if (annotation.widthNorm !== undefined) {
    result.screenWidth = annotation.widthNorm * pageTransform.pdfPageWidth * pageTransform.zoom;
  }
  if (annotation.heightNorm !== undefined) {
    result.screenHeight = annotation.heightNorm * pageTransform.pdfPageHeight * pageTransform.zoom;
  }

  return result;
}

/**
 * Helper to get page transform from Fabric.js canvas and page image.
 * This extracts the current page's transform information.
 */
export function getPageTransform(
  pageImage: { left: number; top: number; width: number; height: number; scaleX: number; scaleY: number },
  zoom: number = 1
): PageTransform {
  // For PDF pages rendered at scale 3, we need to account for that
  // The pageImage dimensions are already scaled, so we use them directly
  const baseWidth = pageImage.width / (pageImage.scaleX || 1);
  const baseHeight = pageImage.height / (pageImage.scaleY || 1);
  
  return {
    pdfPageWidth: baseWidth,
    pdfPageHeight: baseHeight,
    offsetX: pageImage.left,
    offsetY: pageImage.top,
    zoom: zoom,
    renderedWidth: pageImage.width,
    renderedHeight: pageImage.height,
  };
}

/**
 * Serialize annotations to JSON for storage/transmission.
 */
export function serializeAnnotations(annotations: Annotation[]): string {
  return JSON.stringify(annotations, null, 2);
}

/**
 * Deserialize annotations from JSON.
 */
export function deserializeAnnotations(json: string): Annotation[] {
  return JSON.parse(json);
}


