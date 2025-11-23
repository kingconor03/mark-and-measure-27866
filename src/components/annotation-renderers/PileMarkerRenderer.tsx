/**
 * Pile Marker Renderer - Renders a pile marker annotation as an interactive element
 * 
 * This component renders a pile marker (circle with number) that:
 * - Sizes dynamically based on zoom level and pileScale
 * - Uses color from annotation or falls back to pile type color
 * - Supports selection state (blue border when selected)
 * - Supports click and drag interactions
 * - Displays pile number in center
 * 
 * The marker size scales with both zoom and pileScale to maintain
 * consistent appearance relative to the PDF page.
 */

import { Annotation } from "@/lib/annotations";
import { PageGeometry } from "@/utils/coordinateUtils";
import { PileColors } from "@/components/PileColorSettings";

interface PileMarkerRendererProps {
  annotation: Annotation;
  pageGeometry: PageGeometry;
  pileScale: number;
  pileColors: PileColors;
  isSelected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onDragStart?: (e: React.MouseEvent) => void;
}

export function PileMarkerRenderer({
  annotation,
  pageGeometry,
  pileScale,
  pileColors,
  isSelected = false,
  onClick,
  onDragStart,
}: PileMarkerRendererProps) {
  // Calculate radius in pixels at current zoom
  const baseRadius = annotation.meta?.radius || 15;
  const radius = baseRadius * pageGeometry.zoom * pileScale;
  
  const color = annotation.color || pileColors[annotation.meta?.pile_type as keyof PileColors] || "#FF6400";
  const fontSize = 14 * pageGeometry.zoom * pileScale;

  return (
    <div
      onClick={onClick}
      onMouseDown={onDragStart}
      style={{
        width: `${radius * 2}px`,
        height: `${radius * 2}px`,
        borderRadius: '50%',
        backgroundColor: color,
        border: isSelected ? '3px solid #0066ff' : '2px solid black',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontWeight: 'bold',
        fontSize: `${fontSize}px`,
        cursor: 'move',
        boxShadow: isSelected ? '0 0 8px rgba(0, 102, 255, 0.6)' : undefined,
        position: 'relative',
        zIndex: isSelected ? 1000 : 1,
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        // Context menu handled by parent
      }}
    >
      {annotation.meta?.number || "?"}
    </div>
  );
}

