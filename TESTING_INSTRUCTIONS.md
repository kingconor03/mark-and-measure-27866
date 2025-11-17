# Testing Instructions for PDF Page Selection

## Test Scenario: 3-Page PDF, Select Only Page 3

### Prerequisites
1. Run the SQL migration `supabase/migrations/20251106000003_fix_project_assets_schema.sql` in Supabase SQL editor to add the `document_type` column
2. Ensure you have a 3+ page PDF ready for upload

### Test Steps

1. **Upload PDF and Select Page 3**
   - Navigate to Dashboard
   - Click "New Project"
   - Enter project name
   - Upload a multi-page PDF (3+ pages)
   - Select ONLY page 3 in the PDF preview selector
   - Click "Confirm Selection"
   - Choose "Mark Up" action

2. **Verify Network Calls**
   - Open browser DevTools → Network tab
   - Look for `POST /rest/v1/project_assets` - should return **201** (not 400)
   - Look for `POST /functions/v1/process-pdf` - should have `selectedPages: [3]` in request body
   - Check response: should show `{ success: true, pageCount: 3 }`

3. **Verify Database State**
   - In Supabase SQL Editor, run:
     ```sql
     -- Check that only page 3 was created
     SELECT id, page_number, project_id 
     FROM pages 
     WHERE project_id = '<your-project-id>'
     ORDER BY page_number;
     ```
   - Should return **only 1 row** with `page_number = 3`

4. **Verify Markup UI**
   - Navigate to the Editor for the project
   - Should display **only page 3**
   - Should NOT show pages 1 or 2
   - Page indicator should show "Page 1 of 1" (since only one page exists)

### Expected Results

✅ `project_assets` insert succeeds with `document_type` column  
✅ Edge Function receives `selectedPages: [3]`  
✅ Only 1 row in `pages` table with `page_number = 3`  
✅ Editor shows only page 3, not all pages  
✅ `selected_page_ids` in projects table contains only the ID of page 3

### Key Files Changed

- **Schema**: `supabase/migrations/20251106000003_fix_project_assets_schema.sql`
- **Process PDF**: `supabase/functions/process-pdf/index.ts` (already processes only selected pages)
- **Frontend Inserts**: `src/components/NewProjectModal.tsx`, `src/pages/ProjectFolderView.tsx` (made error handling safe)
- **Editor Loading**: `src/pages/Editor.tsx` (already filters by `selected_page_ids`)

