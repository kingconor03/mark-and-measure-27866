/**
 * Annotation store for managing annotations in normalized coordinates.
 * Provides utilities to convert between legacy pixel coordinates and normalized coordinates.
 */

import { Annotation, AnnotationType, screenToAnnotation, annotationToScreen, PageTransform } from "./annotations";

/**
 * Convert a legacy pile object (with pixel coordinates) to an Annotation.
 * This is used for migration/backward compatibility.
 */
export function legacyPileToAnnotation(
  pile: {
    id: string;
    page_id: string;
    position_x: number;
    position_y: number;
    pile_type: string;
    blade_size: string;
    length: string;
    extension: string;
    radius?: number;
    number?: number;
    color?: string;
    is_custom?: boolean;
    min_depth?: string;
    min_torque?: string;
  },
  pageIndex: number,
  pageTransform: PageTransform
): Annotation {
  // Convert pixel coordinates to normalized
  const { xNorm, yNorm } = screenToAnnotation(
    pile.position_x,
    pile.position_y,
    pageTransform
  );

  // Calculate normalized size (radius becomes diameter)
  const radius = pile.radius || 15;
  const diameterNorm = (radius * 2) / pageTransform.pdfPageWidth;
  const heightNorm = (radius * 2) / pageTransform.pdfPageHeight;

  return {
    id: pile.id,
    pageIndex,
    type: "pile_marker",
    xNorm,
    yNorm,
    widthNorm: diameterNorm,
    heightNorm,
    color: pile.color || undefined,
    meta: {
      pile_type: pile.pile_type,
      blade_size: pile.blade_size,
      length: pile.length,
      extension: pile.extension,
      radius,
      number: pile.number,
      is_custom: pile.is_custom,
      min_depth: pile.min_depth,
      min_torque: pile.min_torque,
    },
  };
}

/**
 * Convert an Annotation back to legacy pile format (for database compatibility).
 * This assumes the annotation is rendered at the current page transform.
 */
export function annotationToLegacyPile(
  annotation: Annotation,
  pageId: string,
  pageTransform: PageTransform
): {
  position_x: number;
  position_y: number;
  pile_type: string;
  blade_size: string;
  length: string;
  extension: string;
  radius?: number;
  number?: number;
  color?: string;
  is_custom?: boolean;
  min_depth?: string;
  min_torque?: string;
} {
  const { screenX, screenY } = annotationToScreen(annotation, pageTransform);

  return {
    position_x: screenX,
    position_y: screenY,
    pile_type: annotation.meta?.pile_type || "76mm",
    blade_size: annotation.meta?.blade_size || "250mm",
    length: annotation.meta?.length || "1.0m",
    extension: annotation.meta?.extension || "None",
    radius: annotation.meta?.radius || 15,
    number: annotation.meta?.number,
    color: annotation.color,
    is_custom: annotation.meta?.is_custom,
    min_depth: annotation.meta?.min_depth,
    min_torque: annotation.meta?.min_torque,
  };
}

/**
 * Convert a legacy footing object to an Annotation.
 */
export function legacyFootingToAnnotation(
  footing: {
    id: string;
    page_id: string;
    footing_type: string;
    shape: string;
    coordinates: Array<{ x: number; y: number }>;
    color?: string;
    width?: number;
    depth?: number;
  },
  pageIndex: number,
  pageTransform: PageTransform
): Annotation {
  if (footing.shape === "rectangle" && footing.coordinates.length === 2) {
    const [start, end] = footing.coordinates;
    
    // Convert corners to normalized coordinates
    const startNorm = screenToAnnotation(start.x, start.y, pageTransform);
    const endNorm = screenToAnnotation(end.x, end.y, pageTransform);

    // Calculate normalized dimensions
    const widthNorm = Math.abs(endNorm.xNorm - startNorm.xNorm);
    const heightNorm = Math.abs(endNorm.yNorm - startNorm.yNorm);

    // Use top-left corner as anchor
    const xNorm = Math.min(startNorm.xNorm, endNorm.xNorm);
    const yNorm = Math.min(startNorm.yNorm, endNorm.yNorm);

    return {
      id: footing.id,
      pageIndex,
      type: "footing",
      xNorm,
      yNorm,
      widthNorm,
      heightNorm,
      color: footing.color,
      meta: {
        footing_type: footing.footing_type,
        shape: footing.shape,
        width: footing.width,
        depth: footing.depth,
      },
    };
  }

  // Fallback for other shapes
  const center = footing.coordinates[0];
  const centerNorm = screenToAnnotation(center.x, center.y, pageTransform);

  return {
    id: footing.id,
    pageIndex,
    type: "footing",
    xNorm: centerNorm.xNorm,
    yNorm: centerNorm.yNorm,
    color: footing.color,
    meta: {
      footing_type: footing.footing_type,
      shape: footing.shape,
      coordinates: footing.coordinates,
      width: footing.width,
      depth: footing.depth,
    },
  };
}

/**
 * Convert an Annotation back to legacy footing format.
 */
export function annotationToLegacyFooting(
  annotation: Annotation,
  pageId: string,
  pageTransform: PageTransform
): {
  footing_type: string;
  shape: string;
  coordinates: Array<{ x: number; y: number }>;
  color?: string;
  width?: number;
  depth?: number;
} {
  if (annotation.type === "footing" && annotation.widthNorm && annotation.heightNorm) {
    // Rectangle footing
    const topLeft = annotationToScreen(
      { xNorm: annotation.xNorm, yNorm: annotation.yNorm },
      pageTransform
    );
    const bottomRight = annotationToScreen(
      {
        xNorm: annotation.xNorm + annotation.widthNorm,
        yNorm: annotation.yNorm + annotation.heightNorm,
      },
      pageTransform
    );

    return {
      footing_type: annotation.meta?.footing_type || "SF1",
      shape: "rectangle",
      coordinates: [
        { x: topLeft.screenX, y: topLeft.screenY },
        { x: bottomRight.screenX, y: bottomRight.screenY },
      ],
      color: annotation.color,
      width: annotation.meta?.width,
      depth: annotation.meta?.depth,
    };
  }

  // Fallback: use center point
  const center = annotationToScreen(annotation, pageTransform);
  return {
    footing_type: annotation.meta?.footing_type || "SF1",
    shape: annotation.meta?.shape || "rectangle",
    coordinates: [{ x: center.screenX, y: center.screenY }],
    color: annotation.color,
    width: annotation.meta?.width,
    depth: annotation.meta?.depth,
  };
}


