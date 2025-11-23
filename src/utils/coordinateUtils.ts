/**
 * Coordinate conversion utilities for viewport-based PDF viewer.
 * Handles conversion between screen coordinates and normalized PDF coordinates
 * with proper accounting for viewport scrolling.
 */

export interface PageGeometry {
  pageWidth: number; // Page's natural width (at 100% zoom, in PDF units)
  pageHeight: number; // Page's natural height (at 100% zoom, in PDF units)
  zoom: number;
  // Position of the PAGE relative to the VIEWPORT's TOP-LEFT SCROLLED corner
  pageOffsetX: number;
  pageOffsetY: number;
}

/**
 * Converts mouse coordinates from within the viewport's content area
 * to normalized PDF page coordinates (0..1).
 * 
 * @param contentMouseX - Mouse X relative to the viewport's full, scrollable content.
 * @param contentMouseY - Mouse Y relative to the viewport's full, scrollable content.
 * @param geo - The geometry of the target page within the viewport.
 * @returns An object with xNorm and yNorm from 0 to 1, or null if click was outside page bounds.
 */
export function screenToNorm(
  contentMouseX: number,
  contentMouseY: number,
  geo: PageGeometry
): { xNorm: number; yNorm: number } | null {
  // 1. Get coordinates relative to the page's top-left corner
  const relativeX = contentMouseX - geo.pageOffsetX;
  const relativeY = contentMouseY - geo.pageOffsetY;

  // 2. Check if the click is outside the page's bounds
  const pageRenderedWidth = geo.pageWidth * geo.zoom;
  const pageRenderedHeight = geo.pageHeight * geo.zoom;
  if (relativeX < 0 || relativeY < 0 || relativeX > pageRenderedWidth || relativeY > pageRenderedHeight) {
    return null; // Click was outside the page (in the margin)
  }

  // 3. Adjust for zoom to get coordinates in the page's "natural" pixel space
  const naturalX = relativeX / geo.zoom;
  const naturalY = relativeY / geo.zoom;

  // 4. Normalize and return
  const xNorm = naturalX / geo.pageWidth;
  const yNorm = naturalY / geo.pageHeight;

  return { xNorm, yNorm };
}

/**
 * Converts normalized PDF coordinates (0..1) to screen coordinates
 * relative to the viewport's scrollable content area.
 * 
 * @param xNorm - Normalized X coordinate (0..1)
 * @param yNorm - Normalized Y coordinate (0..1)
 * @param geo - The geometry of the target page within the viewport.
 * @returns Screen coordinates relative to the viewport's scrollable content.
 */
export function normToScreen(
  xNorm: number,
  yNorm: number,
  geo: PageGeometry
): { x: number; y: number } {
  // 1. Convert normalized to natural pixel coordinates
  const naturalX = xNorm * geo.pageWidth;
  const naturalY = yNorm * geo.pageHeight;

  // 2. Apply zoom
  const zoomedX = naturalX * geo.zoom;
  const zoomedY = naturalY * geo.zoom;

  // 3. Add page offset relative to viewport content
  const x = geo.pageOffsetX + zoomedX;
  const y = geo.pageOffsetY + zoomedY;

  return { x, y };
}

