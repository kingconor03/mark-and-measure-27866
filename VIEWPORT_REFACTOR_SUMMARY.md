# Viewport-Based PDF Viewer Refactor - Summary

## Overview

The PDF markup editor has been completely refactored from a Fabric.js-based canvas system to a native document viewer-style viewport system. This provides a more intuitive, native-feeling PDF viewing experience while maintaining all editing functionality.

## Major Changes

### 1. Removed Fabric.js Dependencies

**Before:**
- Used Fabric.js Canvas for all rendering
- PDF pages rendered as FabricImage objects
- Piles/footings were Fabric.js objects (Circle, Rect, Group)
- All interactions via Fabric.js events

**After:**
- No Fabric.js dependencies
- PDF pages rendered using pdf.js directly to HTML5 canvas
- Annotations rendered as React components in overlay divs
- Interactions via native DOM events

### 2. Viewport-Based Architecture

**New Structure:**
```
MarkupCanvas
  └── Viewport (scrollable container with gray background)
      └── Container (centers page content)
          └── PDFAnnotationPage
              ├── Canvas (PDF page rendering)
              └── Annotation Overlay (absolutely positioned div)
                  └── Individual annotation renderers
```

**Key Components:**
- `MarkupCanvas.tsx` - Main editor component (refactored from Fabric.js)
- `PDFAnnotationPage.tsx` - Renders single PDF page with annotations
- `PDFViewer.css` - Styles for viewport layout (gray background, shadows)
- `coordinateUtils.ts` - Viewport-aware coordinate conversion
- `annotation-renderers/` - Custom React components for piles/footings

### 3. Normalized Coordinate System

**Key Concept:**
All annotations stored in normalized coordinates (0..1 range) relative to PDF page dimensions. This ensures:
- Annotations stay aligned during zoom/pan
- Coordinates persist correctly across zoom levels
- No dependency on screen pixel positions

**Conversion Functions:**
- `screenToNorm()` - Convert mouse click to normalized coordinates
- `normToScreen()` - Convert normalized coords to screen pixels for rendering

**Storage:**
- Piles/footings can have `xNorm`, `yNorm`, `widthNorm`, `heightNorm` properties
- Legacy pixel coordinates automatically converted when loading
- New annotations always stored with normalized coords

### 4. Annotation System

**Annotation Format:**
```typescript
interface Annotation {
  id: string;
  pageIndex: number; // 0-based
  type: "pile_marker" | "footing" | ...
  xNorm: number; // 0..1
  yNorm: number; // 0..1
  widthNorm?: number;
  heightNorm?: number;
  color?: string;
  meta?: Record<string, any>;
}
```

**Rendering:**
- Annotations converted from piles/footings arrays to Annotation[]
- Custom renderer functions: `PileMarkerRenderer`, `FootingRenderer`
- Rendered as absolutely positioned divs above PDF canvas
- Size/position calculated from normalized coords based on current zoom

### 5. Export System

**New Export (`pdfExportNew.ts`):**
- Uses `pdf-lib` to draw annotations directly onto original PDF
- Preserves original PDF quality and metadata
- Supports single page or all pages export
- Includes summary box overlay
- Draws vector shapes/text (not screenshots)

**Export Options:**
- "Download Marked Up PDF" - Exports current page only
- "Download Full PDF" - Exports all pages with their annotations

## Preserved Features

All existing functionality maintained:
- ✅ Pile creation (click to place)
- ✅ Footing creation (drag to draw)
- ✅ Selection (single and multi-select)
- ✅ Dragging annotations to move them
- ✅ Delete (keyboard or context menu)
- ✅ Context menu for piles
- ✅ Keyboard shortcuts (Delete, Undo/Redo)
- ✅ History/undo-redo system
- ✅ Zoom and pan
- ✅ FloatingProjectSummary with pin functionality
- ✅ Export with summary box

## Key Files

### Core Components
- `src/components/MarkupCanvas.tsx` - Main editor (1100 lines, down from 1460)
- `src/components/PDFAnnotationPage.tsx` - Page renderer with annotation overlay
- `src/components/PDFViewer.css` - Viewport styling

### Utilities
- `src/utils/coordinateUtils.ts` - Coordinate conversion functions
- `src/lib/annotations.ts` - Annotation type definitions
- `src/lib/annotationStore.ts` - Legacy conversion utilities
- `src/lib/pdfExportNew.ts` - PDF export using pdf-lib

### Renderers
- `src/components/annotation-renderers/PileMarkerRenderer.tsx`
- `src/components/annotation-renderers/FootingRenderer.tsx`

## Technical Details

### Zoom Implementation
- Uses debounced state updates to prevent flashing
- Zooms to mouse cursor position (keeps point under cursor fixed)
- Updates viewport scroll to maintain position
- Dispatches transform events for FloatingProjectSummary

### Pan Implementation
- Middle mouse button or pan tool
- Updates viewport scroll position directly
- Constrained to page boundaries
- Smooth dragging experience

### Coordinate Flow
1. User clicks on viewport
2. Click position converted to viewport scroll-space coordinates
3. `screenToNorm()` converts to normalized PDF coordinates (0..1)
4. Normalized coords stored in database
5. When rendering: `normToScreen()` converts back to screen pixels
6. Annotation positioned in overlay div

### Page Geometry
Tracks:
- `pageWidth/pageHeight` - PDF page natural size (at scale 1)
- `zoom` - Current zoom level
- `pageOffsetX/pageOffsetY` - Page position relative to viewport's scrolled content

Updated on:
- PDF page load
- Zoom changes
- Viewport scroll
- Window resize

## Migration Notes

### Legacy Support
- Existing piles/footings with pixel coordinates automatically converted
- Uses base scale of 3 for legacy coordinate conversion
- Backward compatible with existing database records

### Database Schema
- Can add `xNorm`, `yNorm`, `widthNorm`, `heightNorm` columns in future
- For now, normalized coords stored in memory/state
- Legacy pixel coordinates still saved for compatibility

## Future Improvements

- [ ] Add normalized coord columns to database schema
- [ ] Migrate all legacy coordinates to normalized format
- [ ] Add annotation types: highlight, text, shapes
- [ ] Improve annotation selection UX (selection box)
- [ ] Add annotation rotation support

## Testing Checklist

- [x] PDF loads and displays correctly
- [x] Markers (piles) appear on canvas
- [x] Footings appear on canvas
- [x] Click to create piles works
- [x] Drag to create footings works
- [x] Drag to move annotations works
- [x] Zoom works smoothly
- [x] Pan works smoothly
- [x] Selection works
- [x] Context menu works
- [x] Export works (single page and all pages)
- [x] Summary box included in export
- [x] Pin summary works

