# Prompt for Lovable: Integrate Viewport-Based PDF Viewer into Markup Editor

## Objective

Integrate the new viewport-based PDF viewer system (from `PDFViewer.tsx`) into the markup editing tool (`MarkupCanvas.tsx`). Replace the Fabric.js canvas-based rendering with the new viewport system that provides a native document viewer experience with proper coordinate handling.

## Current State

### MarkupCanvas (`src/components/MarkupCanvas.tsx`)
- Currently uses Fabric.js canvas for rendering
- Renders PDF pages as FabricImage objects on a canvas
- Handles pile and footing creation/editing
- Uses normalized coordinates for annotations (already integrated)
- Has zoom, pan, and tool selection functionality

### New PDF Viewer System
- Viewport-based with native scrolling (`PDFViewer.tsx`)
- PDFAnnotationPage component for rendering individual pages
- Proper coordinate conversion utilities (`src/utils/coordinateUtils.ts`)
- Gray background with document-like page appearance
- Better handling of multi-page documents

## Goal

Replace the Fabric.js canvas approach in MarkupCanvas with the viewport-based system while preserving all editing functionality.

## What Needs to Be Done

### 1. Replace Canvas Rendering with Viewport

**Current:** Fabric.js canvas with PDF rendered as image
**New:** Viewport with PDFAnnotationPage components

**Changes needed:**
- Remove Fabric.js canvas initialization
- Replace with viewport structure (similar to PDFViewer)
- Use PDFAnnotationPage for each page
- Keep the gray background and document styling

### 2. Preserve Annotation Editing

**Current functionality to preserve:**
- Pile creation on click
- Footing drawing (drag to create rectangle)
- Pile/footing selection
- Pile/footing movement/resizing
- Bulk editing
- Context menu for piles
- Delete functionality

**How to implement:**
- Use the annotation overlay system (already exists in PDFAnnotationPage)
- Add click/drag handlers to the viewport for creating annotations
- Use the coordinate conversion utilities for click positions
- Render annotations as overlays on top of PDF pages

### 3. Coordinate System Integration

**Already implemented:**
- Normalized coordinate storage (0..1 range)
- screenToAnnotation() and annotationToScreen() functions
- PageTransform tracking

**Needs updating:**
- Convert click positions using viewport coordinate utilities
- Update annotation rendering to use viewport coordinates
- Ensure annotations stay aligned during zoom/pan

### 4. Tool System Integration

**Current tools:**
- Select tool (move/resize annotations)
- Pile tool (click to place)
- Footing tool (drag to create)
- Pan tool

**Implementation:**
- Keep toolbar and tool selection
- Update click handlers to work with viewport
- Tool-specific cursors and behaviors

### 5. Zoom and Pan

**Current:** Fabric.js zoom/pan via viewportTransform
**New:** Viewport scroll-based panning + zoom via scale prop

**Changes:**
- Use viewport scrollLeft/scrollTop for panning
- Pass zoom scale to PDFAnnotationPage components
- Update coordinate calculations to account for zoom
- Keep zoom controls in header/toolbar

### 6. Page Navigation

**Current:** Single page view with page selector
**New:** Multi-page viewport showing all pages

**Considerations:**
- Show all pages in scrollable viewport (like PDFViewer)
- OR keep single page view but use viewport system
- Update page navigation if keeping single page

## Step-by-Step Implementation

### Phase 1: Basic Viewport Structure

1. **Replace canvas container with viewport:**
   ```tsx
   // Remove Fabric.js canvas
   // Add viewport structure similar to PDFViewer
   <div ref={viewportRef} className="pdf-viewer-viewport">
     <div className="pdf-viewer-container">
       {pages.map((page, index) => (
         <PDFAnnotationPage ... />
       ))}
     </div>
   </div>
   ```

2. **Update PDF page loading:**
   - Remove Fabric.js image rendering
   - Use PDFAnnotationPage component
   - Pass pdfPage objects directly

3. **Import necessary components:**
   - PDFAnnotationPage
   - PDFViewer.css
   - coordinateUtils

### Phase 2: Annotation Rendering

1. **Create annotation renderers:**
   - Pile marker renderer (circle with number)
   - Footing renderer (rectangle with opacity)
   - Pass renderAnnotation prop to PDFAnnotationPage

2. **Convert annotation data:**
   - Use existing Annotation types
   - Convert piles/footings to Annotation format
   - Pass annotations to PDFAnnotationPage

3. **Handle annotation interaction:**
   - Click handlers for selection
   - Drag handlers for movement
   - Resize handles if needed

### Phase 3: Tool Functionality

1. **Pile tool:**
   - Click handler on viewport/container
   - Convert click position to normalized coordinates
   - Create new pile annotation
   - Save to database

2. **Footing tool:**
   - Mouse down/move/up handlers
   - Track drawing rectangle
   - Convert final rectangle to normalized coordinates
   - Create footing annotation

3. **Select tool:**
   - Handle clicks on annotations
   - Show selection UI
   - Enable drag to move
   - Enable delete/context menu

### Phase 4: Integration with Existing Systems

1. **Preserve state management:**
   - Keep piles/footings state arrays
   - Keep tool selection state
   - Keep config states (pileConfig, footingConfig)

2. **Update event handlers:**
   - Convert to use viewport coordinates
   - Update database saves
   - Update history/undo system

3. **Keep existing features:**
   - FloatingProjectSummary
   - PropertiesPanel
   - Toolbar
   - Context menus

## Files to Modify

### Primary Files:
- `src/components/MarkupCanvas.tsx` - Main component to refactor
- `src/components/PDFAnnotationPage.tsx` - May need enhancements for editing
- `src/components/Editor.tsx` - May need minor updates if MarkupCanvas props change

### Utility Files:
- `src/lib/annotations.ts` - Already has coordinate conversion
- `src/utils/coordinateUtils.ts` - Viewport coordinate utilities
- `src/lib/annotationStore.ts` - Annotation data conversion

## Key Considerations

### 1. Performance
- Rendering all pages at once might be heavy
- Consider lazy loading or virtualization if many pages
- Cache rendered pages if needed

### 2. Annotation Interaction
- Need click/drag handlers on annotations
- May need custom annotation renderers with interactive elements
- Handle z-index for overlapping annotations

### 3. Selection UI
- Show selected annotations visually
- Handle multi-select
- Selection handles for resizing

### 4. Coordinate Conversion
- All clicks must convert through viewport coordinate system
- Account for scroll position
- Account for zoom level
- Use normalized coordinates for storage

### 5. Existing Features
- Maintain compatibility with:
  - FloatingProjectSummary
  - PropertiesPanel
  - History/undo system
  - Bulk editing
  - Export functionality

## Testing Checklist

After implementation, verify:
- [ ] PDF pages render correctly
- [ ] Pile tool creates piles on click
- [ ] Footing tool draws rectangles
- [ ] Annotations can be selected
- [ ] Annotations can be moved
- [ ] Annotations can be deleted
- [ ] Zoom controls work
- [ ] Pan/scroll works
- [ ] Coordinate system is accurate
- [ ] Annotations stay aligned during zoom/pan
- [ ] Existing features (summary, properties, etc.) still work
- [ ] Export functionality works

## Migration Strategy

### Option 1: Full Replacement
Replace entire Fabric.js system with viewport system in one go.

**Pros:** Clean, consistent architecture
**Cons:** Risk of breaking existing functionality

### Option 2: Gradual Migration
Keep Fabric.js for annotations, use viewport for PDF rendering.

**Pros:** Lower risk, incremental
**Cons:** Dual systems to maintain

### Option 3: Hybrid Approach
Use viewport for PDF pages, keep Fabric.js overlays for annotations temporarily.

**Pros:** Best of both worlds initially
**Cons:** More complex, need to migrate annotations later

**Recommended: Option 1** - Clean break, use the annotation overlay system properly.

## Example Integration Pattern

```tsx
// MarkupCanvas structure after integration
export default function MarkupCanvas({ ... }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<any[]>([]);
  const [currentPages, setCurrentPages] = useState<any[]>([]);
  
  // Convert piles/footings to annotations
  const annotations = useMemo(() => {
    const anns: Annotation[] = [];
    piles.forEach(pile => {
      // Convert pile to annotation
    });
    footings.forEach(footing => {
      // Convert footing to annotation
    });
    return anns;
  }, [piles, footings]);
  
  // Render annotation function
  const renderAnnotation = (annotation, screenPos, geo) => {
    if (annotation.type === "pile_marker") {
      return <PileMarker annotation={annotation} ... />;
    }
    if (annotation.type === "footing") {
      return <FootingAnnotation annotation={annotation} ... />;
    }
  };
  
  return (
    <div className="pdf-viewer-viewport" ref={viewportRef}>
      <div className="pdf-viewer-container" onClick={handleClick}>
        {currentPages.map((page, index) => (
          <PDFAnnotationPage
            key={page.id}
            pdfPage={page}
            zoom={zoom}
            annotations={annotations.filter(a => a.pageIndex === index)}
            renderAnnotation={renderAnnotation}
            onAnnotationClick={handleAnnotationClick}
          />
        ))}
      </div>
    </div>
  );
}
```

## Important Notes

1. **Preserve existing functionality** - Don't break what works
2. **Use normalized coordinates** - Already implemented, maintain it
3. **Handle all tools** - Pile, footing, select, pan
4. **Test thoroughly** - Ensure all editing works
5. **Keep UI consistent** - Maintain existing look/feel where possible

---

**Please integrate the viewport-based PDF viewer into MarkupCanvas while preserving all editing functionality. Replace Fabric.js canvas rendering with the new viewport system and ensure piles, footings, and all tools continue to work correctly.**

