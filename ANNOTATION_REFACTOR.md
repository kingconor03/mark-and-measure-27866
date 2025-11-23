# PDF Annotation System Refactor

## Overview

This refactor implements an overlay-based annotation system where:
- The original PDF is preserved as the single source of truth
- All annotations are stored in normalized PDF coordinates (0..1 range)
- Annotations are rendered as overlays that stay aligned with the PDF during zoom/pan
- Export draws annotations onto the original PDF using pdf-lib (not screenshots)

## What Has Been Implemented

### 1. Core Annotation System (`src/lib/annotations.ts`)

- ✅ `Annotation` interface with normalized coordinates
- ✅ `PageTransform` interface for coordinate mapping
- ✅ `screenToAnnotation()` - converts screen pixels to normalized PDF coordinates
- ✅ `annotationToScreen()` - converts normalized coordinates to screen pixels
- ✅ `getPageTransform()` - helper to extract page transform from canvas
- ✅ Serialization/deserialization utilities

### 2. Annotation Store (`src/lib/annotationStore.ts`)

- ✅ `legacyPileToAnnotation()` - converts legacy pile (pixel coords) to Annotation
- ✅ `annotationToLegacyPile()` - converts Annotation back to legacy format (for DB compatibility)
- ✅ `legacyFootingToAnnotation()` - converts legacy footing to Annotation
- ✅ `annotationToLegacyFooting()` - converts Annotation back to legacy footing format

### 3. New PDF Export (`src/lib/pdfExportNew.ts`)

- ✅ `exportAnnotationsToPDF()` - draws annotations onto original PDF using pdf-lib
- ✅ Supports pile markers with circles and numbers
- ✅ Supports footing rectangles with opacity
- ✅ Uses normalized coordinates to position annotations accurately

### 4. MarkupCanvas Refactoring (`src/components/MarkupCanvas.tsx`)

- ✅ Added coordinate conversion utilities imports
- ✅ Added `currentPageTransform` state to track page position/zoom
- ✅ Added `updatePageTransform()` helper function
- ✅ Updated pile creation to use normalized coordinates
- ✅ Updated pile rendering to convert normalized to screen coordinates
- ✅ Updated pile movement to convert screen back to normalized
- ✅ Updated footing creation to use normalized coordinates
- ✅ Updated footing rendering to use normalized coordinates
- ✅ Updated zoom/pan handlers to refresh page transform
- ✅ Stored base PDF dimensions (at scale 3) when loading pages

## What Still Needs Work

### 1. Export Function Integration

The current export in `MarkupCanvas.tsx` still uses the old screenshot-based approach. It needs to:

- Convert current piles/footings to Annotation format
- Get the original PDF URL
- Call `exportAnnotationsToPDF()` instead of `exportCanvasToPDF()`
- Handle the summary panel separately (optional - could be added to new export later)

**Location**: `src/components/MarkupCanvas.tsx` around line 447-515

### 2. Backward Compatibility

The system currently stores normalized coordinates in memory but still saves pixel coordinates to the database for backward compatibility. Consider:

- Migration script to convert existing pixel coordinates to normalized
- Database schema update to store normalized coordinates directly
- OR: Keep dual storage (normalized + pixel) during transition period

### 3. Coordinate Conversion Accuracy

The coordinate conversion logic assumes:
- PDF pages are rendered at scale 3
- Pages are then scaled down to fit container
- Base PDF dimensions are stored when page loads

**Potential issues to verify**:
- Accuracy of coordinate conversion at different zoom levels
- Handling of canvas panning correctly
- Edge cases when page is resized

### 4. Testing

- [ ] Test pile creation at different zoom levels
- [ ] Test pile movement during zoom/pan
- [ ] Test footing creation and rendering
- [ ] Test export with new annotation system
- [ ] Verify annotations stay aligned during zoom
- [ ] Verify annotations stay aligned during pan

### 5. Footing Movement/Editing

Currently footings can be created but movement/resize isn't implemented with coordinate conversion. Should update footing interaction handlers similarly to piles.

## Usage Examples

### Converting Legacy Data to Annotations

```typescript
import { legacyPileToAnnotation } from "@/lib/annotationStore";
import { getPageTransform } from "@/lib/annotations";

// When loading existing piles
const pageImage = fabricCanvas.getObjects().find(obj => obj.customData?.type === 'page');
const transform = getPageTransform(pageImage, canvas.getZoom());

const annotation = legacyPileToAnnotation(
  legacyPile,
  pageIndex,
  transform
);
```

### Creating New Annotations

```typescript
import { screenToAnnotation } from "@/lib/annotations";

// On user click
const pointer = canvas.getPointer(event);
const normalizedCoords = screenToAnnotation(
  pointer.x,
  pointer.y,
  currentPageTransform
);

const newAnnotation: Annotation = {
  id: generateId(),
  pageIndex: currentPageIndex,
  type: "pile_marker",
  xNorm: normalizedCoords.xNorm,
  yNorm: normalizedCoords.yNorm,
  widthNorm: 0.05, // 5% of page width
  heightNorm: 0.05,
  color: "#FF6400",
  meta: { pile_type: "76mm", number: 1 }
};
```

### Exporting Annotations

```typescript
import { exportAnnotationsToPDF } from "@/lib/pdfExportNew";

await exportAnnotationsToPDF({
  pdfUrl: originalPdfUrl,
  annotations: annotationsArray,
  projectName: "My Project",
  pageIndex: 0, // or undefined for all pages
});
```

## Key Design Decisions

1. **Normalized Coordinates (0..1)**: Makes annotations independent of PDF page size and zoom level
2. **Backward Compatibility**: System stores pixel coords in DB while using normalized coords internally
3. **Overlay Rendering**: Annotations are separate from PDF image, always rendered on top
4. **Original PDF as Source**: Export uses original PDF, not screenshot of canvas

## Next Steps

1. Update export function to use new annotation system
2. Add comprehensive testing
3. Create migration script for existing data (optional)
4. Document coordinate system for future developers
5. Consider adding rotation support if needed
6. Add support for other annotation types (text, highlights, etc.)

