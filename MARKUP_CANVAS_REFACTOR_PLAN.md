# MarkupCanvas Refactor Plan

## Strategy

Since MarkupCanvas is very large (1460 lines), I'll refactor it systematically:

1. Keep single-page view (uses currentPageIndex)
2. Replace Fabric.js canvas with viewport structure
3. Use PDFAnnotationPage for rendering
4. Convert piles/footings to annotations dynamically
5. Update all click/drag handlers to use viewport coordinates

## Key Changes Needed

### State Management
- Remove: fabricCanvas, canvasRef
- Add: viewportRef, pdfPages state (array of pdf.js page objects)
- Keep: All existing props and state for piles/footings/configs

### PDF Loading
- Change from: Rendering PDF to FabricImage
- Change to: Loading pdf.js page objects and passing to PDFAnnotationPage

### Annotation Conversion
- Convert piles/footings to Annotation[] in useMemo
- Pass to PDFAnnotationPage via renderAnnotation prop

### Click Handlers
- Update to use viewport coordinates (screenToNorm)
- Convert clicks to normalized coordinates
- Create annotations and save to DB

### Rendering
- Remove: Fabric.js rendering logic
- Use: PDFAnnotationPage component
- Custom renderers for piles/footings

## Implementation Steps

1. Replace canvas initialization section
2. Replace PDF loading logic  
3. Create annotation conversion logic
4. Update click handlers
5. Update return statement
6. Remove Fabric.js dependencies

