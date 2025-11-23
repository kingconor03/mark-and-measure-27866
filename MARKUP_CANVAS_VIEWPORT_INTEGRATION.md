# MarkupCanvas Viewport Integration - Implementation Summary

## Status
**This is a VERY LARGE refactoring task** (1400+ lines of Fabric.js code to replace).

The current MarkupCanvas is deeply integrated with Fabric.js:
- Canvas initialization and lifecycle management
- PDF rendering as FabricImage objects
- Pile/footing rendering as Fabric objects (Circle, Rect, Group)
- Event handling (mouse down/move/up, wheel, selection)
- Object movement and modification
- Zoom and pan via Fabric.js transforms
- Export functionality

## Required Changes

### 1. Remove Fabric.js Dependencies
- Remove `Canvas`, `Circle`, `Rect`, `FabricImage`, `FabricText`, `Group` imports
- Remove `canvasRef` and `fabricCanvas` state
- Remove all Fabric.js initialization code (~300 lines)

### 2. Add Viewport Structure
- Add `viewportRef` for scrollable container
- Use `PDFAnnotationPage` component for rendering
- Load PDF pages as pdf.js page objects (not FabricImage)
- Implement viewport-based pan (via scroll)
- Implement zoom via CSS transform or scale prop

### 3. Convert Annotations
- Convert piles/footings to `Annotation[]` format
- Use `PDFAnnotationPage` with custom `renderAnnotation` prop
- Use `PileMarkerRenderer` and `FootingRenderer` components

### 4. Update Event Handlers
- Replace Fabric.js mouse events with DOM events on viewport
- Update coordinate conversion to use `screenToNorm` from `coordinateUtils`
- Handle clicks for pile/footing creation
- Handle drag for footing creation and annotation movement
- Handle selection via annotation IDs (not Fabric objects)

### 5. Update Rendering
- Remove all Fabric.js rendering effects
- Use `PDFAnnotationPage` for page rendering
- Use annotation renderers for piles/footings
- Handle zoom by passing `zoom` prop to `PDFAnnotationPage`

## Implementation Approach

Given the size, this should be done in phases:
1. **Phase 1**: Replace PDF loading to use pdf.js objects
2. **Phase 2**: Replace rendering with viewport structure  
3. **Phase 3**: Update event handlers for viewport coordinates
4. **Phase 4**: Update annotation creation/movement/selection
5. **Phase 5**: Update zoom/pan to use viewport scrolling

## Current State

The refactor has been started:
- ✅ Imports updated (viewport components added)
- ✅ State updated (viewport refs added)
- ⚠️ Canvas initialization still uses Fabric.js
- ⚠️ PDF loading still creates FabricImage
- ⚠️ Rendering still uses Fabric objects
- ⚠️ Event handlers still use Fabric.js events

## Next Steps

The file needs complete rewriting of:
- Lines 227-523: Canvas initialization (remove, replace with viewport)
- Lines 601-932: PDF loading (update to pdf.js objects)
- Lines 935-1187: Event handlers (update for viewport)
- Lines 1189-1430: Rendering effects (replace with annotation system)
- Lines 1432-1449: Return statement (replace with viewport structure)

This is approximately 1000+ lines that need replacement.

