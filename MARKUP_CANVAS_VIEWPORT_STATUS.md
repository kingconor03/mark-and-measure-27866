# MarkupCanvas Viewport Integration - Current Status

## What's Been Completed ✅

1. **Imports Updated**: Added viewport components, coordinate utilities, and annotation renderers
2. **State Structure Updated**: Added viewport refs, zoom state, and annotation-related state
3. **Annotation Renderers Created**: 
   - `PileMarkerRenderer.tsx` - Renders pile markers
   - `FootingRenderer.tsx` - Renders footings
4. **Documentation Created**: Planning documents for the integration

## What Remains ⚠️

This is a **MASSIVE refactoring task** - approximately **1000+ lines** need to be replaced:

### Major Sections to Replace:

1. **Lines 227-523**: Canvas Initialization (~300 lines)
   - Currently: Fabric.js canvas setup, event handlers, zoom/pan logic
   - Needs: Remove entirely, replace with viewport structure

2. **Lines 601-932**: PDF Loading (~330 lines)
   - Currently: Loads PDF as FabricImage objects, caches as data URLs
   - Needs: Load as pdf.js page objects, pass to PDFAnnotationPage

3. **Lines 935-1187**: Event Handlers (~250 lines)
   - Currently: Fabric.js mouse events for pile/footing creation
   - Needs: DOM events on viewport, use screenToNorm for coordinates

4. **Lines 1189-1430**: Rendering Effects (~240 lines)
   - Currently: Fabric.js rendering of piles/footings
   - Needs: Convert to annotations, use PDFAnnotationPage renderAnnotation prop

5. **Lines 1432-1449**: Return Statement (~18 lines)
   - Currently: Fabric canvas element
   - Needs: Viewport structure with PDFAnnotationPage

## Complexity Analysis

The current MarkupCanvas has deep Fabric.js integration:
- Every pile/footing is a Fabric object (Circle, Rect, Group)
- Movement/modification uses Fabric.js events
- Selection uses Fabric.js selection system
- Zoom/pan uses Fabric.js transforms
- Export relies on Fabric.js canvas rendering

Replacing this with a viewport system requires:
- Converting all interactions to DOM events
- Managing selection via annotation IDs (not Fabric objects)
- Handling drag/move via React state and coordinates
- Re-implementing zoom/pan via CSS/scroll
- Updating export to use annotation-based system

## Recommendation

Given the scale of this refactor, there are two approaches:

### Option A: Incremental Migration (Recommended)
1. Keep Fabric.js canvas for now
2. Add viewport as a parallel system
3. Gradually migrate features one by one
4. Remove Fabric.js once all features migrated

### Option B: Complete Rewrite (Current Attempt)
1. Remove all Fabric.js dependencies
2. Rewrite entire component with viewport system
3. Test thoroughly after rewrite

## Current Implementation Status

The refactor has been started but is incomplete. The component currently has:
- ✅ New imports and state structure
- ⚠️ Old Fabric.js initialization still present (will cause conflicts)
- ⚠️ Old PDF loading still present
- ⚠️ Old rendering still present
- ⚠️ Return statement not updated

**The file is currently in a broken state** - it has both old and new code mixed, which will cause errors.

## Next Steps

To complete this integration properly, you should:

1. **Backup the current file** first
2. **Remove all Fabric.js code** systematically
3. **Implement viewport-based PDF loading**
4. **Implement annotation conversion and rendering**
5. **Implement viewport-based event handlers**
6. **Test each feature thoroughly**

Or consider the incremental approach for a safer migration.

