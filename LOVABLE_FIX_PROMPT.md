# Prompt for Lovable: Fix Blank White Canvas in PDF Viewer

## Problem Description

The PDF viewer (`src/components/PDFViewer.tsx`) is showing a blank white canvas instead of rendering PDF pages. The viewer was recently refactored to use a viewport-based system with the new `PDFAnnotationPage` component, but PDFs are not displaying.

## Current Behavior

- User opens a PDF file in the viewer
- Viewer shows blank white canvas (or stays on "Loading PDF...")
- No PDF content is rendered
- Console may or may not show errors

## What Was Changed

We recently refactored the PDF viewer to:

1. **Viewport-based rendering** - Changed from single-page canvas to multi-page viewport with scrolling
2. **New PDFAnnotationPage component** - Created `src/components/PDFAnnotationPage.tsx` to render individual pages
3. **URL resolution** - Added logic to handle signed URLs for private storage buckets
4. **Coordinate system** - Integrated with new annotation coordinate utilities

## Files to Check

### Primary Files:
- `src/components/PDFViewer.tsx` - Main viewer component
- `src/components/PDFAnnotationPage.tsx` - Page rendering component
- `src/utils/coordinateUtils.ts` - Coordinate conversion (may not be needed for basic rendering)

### Related Files:
- `src/components/PDFViewer.css` - Styling
- `src/pages/ProjectFolderView.tsx` - How the viewer is called

## What to Debug

1. **Check if PDF is loading:**
   - Verify `loadPDF()` function is being called
   - Check if `resolvedUrl` is being set correctly
   - Verify PDF.js document is loading successfully
   - Check if `pages` array is being populated

2. **Check if pages are rendering:**
   - Verify `PDFAnnotationPage` component is receiving `pdfPage` prop
   - Check if canvas elements are being created
   - Verify canvas rendering is happening (check for canvas elements in DOM)
   - Check if canvas dimensions are set correctly

3. **Check URL resolution:**
   - Verify `resolvedUrl` state is being set
   - Check if signed URL creation is working
   - Verify the URL is accessible (try opening in browser)

4. **Check rendering logic:**
   - Verify `PDFAnnotationPage` useEffect is running
   - Check if canvas context is being obtained
   - Verify PDF.js render promise is resolving
   - Check for any errors in the render function

## Expected Fixes

1. **Ensure PDF pages render:**
   - Fix any issues with `PDFAnnotationPage` rendering logic
   - Ensure canvas elements are visible and sized correctly
   - Verify PDF.js rendering is completing successfully

2. **Fix URL loading:**
   - Ensure `resolvedUrl` is set before `loadPDF()` is called
   - Fix any issues with signed URL creation
   - Handle both public and private bucket URLs correctly

3. **Fix component lifecycle:**
   - Ensure `PDFAnnotationPage` receives the `pdfPage` prop correctly
   - Fix any timing issues with URL resolution and PDF loading
   - Ensure pages array is populated before rendering

4. **Add better error handling:**
   - Show user-friendly error messages if PDF fails to load
   - Log detailed error information to console
   - Handle edge cases (missing URLs, failed fetches, etc.)

## Debugging Steps

1. Add console.log statements to track:
   - When `loadPDF()` is called
   - When `resolvedUrl` is set
   - When pages array is populated
   - When `PDFAnnotationPage` renders
   - Any errors in the render process

2. Check browser console for:
   - PDF.js errors
   - Network errors (failed URL requests)
   - CORS errors
   - Any React errors

3. Inspect DOM to see:
   - If canvas elements exist
   - If they have dimensions (width/height)
   - If they're visible (not hidden by CSS)
   - If viewport container has correct dimensions

## Specific Issues to Look For

1. **Missing resolvedUrl:** The `loadPDF()` function might be called before `resolvedUrl` is set, or `resolvedUrl` might be null/undefined

2. **PDFAnnotationPage not receiving pdfPage:** The `pages` array might be empty or `pdfPage` prop might be undefined

3. **Canvas not rendering:** The PDF.js render promise might be failing silently, or canvas context might not be available

4. **CSS issues:** Canvas might be rendering but hidden or sized incorrectly by CSS

5. **Timing issues:** URL resolution, PDF loading, and component rendering might have race conditions

## Test After Fix

1. Open a PDF in the viewer
2. Verify PDF pages appear
3. Check console for any errors
4. Verify scrolling works
5. Verify zoom controls work

## Additional Context

The viewer should:
- Load PDF from a URL (either public or signed URL)
- Render all pages in a scrollable viewport
- Show pages with drop shadows on gray background
- Support zoom and pan

The old version worked with a single canvas rendering one page at a time. The new version should render all pages at once in a scrollable viewport.

---

**Please debug the PDF viewer and fix the blank canvas issue. Check all the areas mentioned above and ensure PDFs render correctly. Add helpful error messages and logging to make debugging easier in the future.**


