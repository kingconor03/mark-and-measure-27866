/**
 * Footing Renderer - Renders a footing annotation as an interactive rectangle
 * 
 * This component renders a footing rectangle that:
 * - Sizes based on normalized width/height from annotation
 * - Applies opacity from footingConfig
 * - Uses color from annotation or footing type color map
 * - Supports selection state (blue border when selected)
 * - Supports click and drag interactions
 * 
 * The rectangle dimensions are calculated from normalized coordinates
 * and scaled by the current zoom level to match the PDF page size.
 */

import { Annotation } from "@/lib/annotations";
import { PageGeometry } from "@/utils/coordinateUtils";

interface FootingRendererProps {
  annotation: Annotation;
  pageGeometry: PageGeometry;
  opacity: number;
  footingColors: Record<string, string>;
  isSelected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onDragStart?: (e: React.MouseEvent) => void;
}

export function FootingRenderer({
  annotation,
  pageGeometry,
  opacity,
  footingColors,
  isSelected = false,
  onClick,
  onDragStart,
}: FootingRendererProps) {
  const width = annotation.widthNorm 
    ? annotation.widthNorm * pageGeometry.pageWidth * pageGeometry.zoom
    : 50 * pageGeometry.zoom;
  const height = annotation.heightNorm 
    ? annotation.heightNorm * pageGeometry.pageHeight * pageGeometry.zoom
    : 50 * pageGeometry.zoom;

  // Extract color - could be rgba string or hex
  let bgColor = annotation.color;
  if (!bgColor) {
    const footingType = annotation.meta?.footing_type;
    bgColor = footingColors[footingType] || "rgba(100, 116, 139, 0.5)";
  }

  // If color is hex, convert to rgba with opacity
  if (bgColor.startsWith("#")) {
    const r = parseInt(bgColor.slice(1, 3), 16);
    const g = parseInt(bgColor.slice(3, 5), 16);
    const b = parseInt(bgColor.slice(5, 7), 16);
    bgColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
  } else if (bgColor.startsWith("rgba")) {
    // Update opacity in rgba string
    bgColor = bgColor.replace(/rgba\(([^)]+)\)/, (match, values) => {
      const parts = values.split(',').map((s: string) => s.trim());
      if (parts.length === 4) {
        return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${opacity})`;
      }
      return match;
    });
  }

  return (
    <div
      onClick={onClick}
      onMouseDown={onDragStart}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: bgColor,
        border: isSelected ? '3px solid #0066ff' : `2px solid ${annotation.meta?.footing_type ? footingColors[annotation.meta.footing_type] : "#64748b"}`,
        cursor: 'move',
        boxShadow: isSelected ? '0 0 8px rgba(0, 102, 255, 0.6)' : undefined,
        position: 'relative',
        zIndex: isSelected ? 1000 : 1,
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    />
  );
}

