# Testing PDF Viewer - Local Setup Guide

## Changes Made

1. **New Viewport-Based PDF Viewer** - Refactored `PDFViewer.tsx` to use a scrollable viewport with document-like styling
2. **PDFAnnotationPage Component** - New component for rendering individual PDF pages with annotation overlays
3. **Coordinate Utilities** - Added `coordinateUtils.ts` for viewport-aware coordinate conversion
4. **CSS Styling** - Added `PDFViewer.css` for native document viewer appearance
5. **URL Resolution** - Added logic to handle both public and signed URLs for private storage buckets

## Testing Locally

### 1. Check Browser Console
When you open a PDF in the viewer, check the browser console (F12) for:
- `"Resolving file URL: ..."` - Should show the URL being resolved
- `"Loading PDF from URL: ..."` - Should show the resolved URL
- `"PDF loaded successfully, pages: X"` - Confirms PDF loaded
- Any error messages

### 2. Common Issues & Fixes

#### Issue: Stuck on "Loading image..." or "Loading PDF..."
**Possible causes:**
- CORS issues with the PDF URL
- Bucket is private and signed URL creation failed
- PDF.js worker not loading correctly

**Debug steps:**
1. Open browser DevTools (F12) → Console tab
2. Check for red error messages
3. Look for network errors in the Network tab
4. Check if the PDF URL is accessible (try opening it directly)

#### Issue: PDF shows but is blank
- Check if pages array is populated (console log should show "Successfully loaded X pages")
- Check if canvas elements are rendering
- Verify PDF.js worker is loaded (should see no errors about worker)

#### Issue: Annotations not showing
- Annotations should render if you have any in the `annotations` prop
- Check if `pageGeometry` is being calculated (look for errors in console)

### 3. Manual Testing Checklist

- [ ] Open a project and click "View" on a PDF file
- [ ] PDF should load and display pages in a gray viewport
- [ ] Pages should have drop shadows and look like documents
- [ ] Scroll should work smoothly
- [ ] Middle mouse button or Ctrl+drag should pan the document
- [ ] Zoom controls in header should work
- [ ] Console should show successful loading messages (no errors)

### 4. URL Resolution

The viewer now tries to:
1. Use the provided URL if it's already a full HTTP/HTTPS URL
2. Create a signed URL if it's a storage path like "org-assets/..."
3. Fall back to public URL format if signed URL creation fails

If PDFs aren't loading:
1. Check if the bucket is private (need signed URLs)
2. Check if user is authenticated (session required for signed URLs)
3. Try accessing the PDF URL directly in browser to see if it's accessible

### 5. If Still Not Working

**Quick Debug Steps:**
1. Open DevTools → Console
2. Look for error messages starting with "Error"
3. Check Network tab → filter by "pdf" or the file name
4. Look for 403 (Forbidden) or 404 (Not Found) errors
5. Try a different PDF file to see if it's file-specific

**Common Fixes:**
- If you see CORS errors, the bucket might need CORS configuration in Supabase
- If you see 403 errors, the bucket is private and signed URL creation might be failing
- If you see "Failed to load PDF", check the exact error message in console

### 6. Environment Variables

Make sure these are set in your `.env` file:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## Files Changed

- `src/components/PDFViewer.tsx` - Main viewer component
- `src/components/PDFAnnotationPage.tsx` - NEW: Page rendering component
- `src/components/PDFViewer.css` - NEW: Viewer styling
- `src/utils/coordinateUtils.ts` - NEW: Coordinate conversion utilities
- `src/lib/annotations.ts` - Annotation types and utilities
- `src/lib/annotationStore.ts` - Annotation data conversion
- `src/lib/pdfExportNew.ts` - New PDF export system

## Next Steps if Working

Once the viewer is working, you can:
1. Add annotations by clicking on pages (currently just logs to console)
2. Test pan and zoom functionality
3. Verify annotations stay aligned during zoom/pan
4. Test export functionality with the new annotation system


