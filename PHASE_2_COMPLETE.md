# Phase 2 Complete: Data Model Extension

## What Was Added

### New Database Tables

1. **project_assets** - Track all project files (PDFs, page images, etc.)
   - Links assets to projects with metadata
   - Supports multiple asset kinds (pdf, page_image, other)

2. **annotations** - New flexible annotation system
   - Replaces pile/footing tables for multi-tenant mode
   - Stores annotation data as JSONB for flexibility
   - Tracks page_index, type (pile/footing), creator

3. **quote_requests** - Quote request workflow
   - Links to organization and optionally to a project
   - Status tracking: new → awaiting_docs → in_progress → completed/rejected
   - Supports notes from both user and admin

4. **quote_request_files** - Files uploaded for quotes
   - Organized by folder type (soil_report, architectural, engineering, other)
   - Tracks storage path and metadata

5. **certification_requests** - Certification workflow
   - Always links to a specific project
   - Status: new → awaiting_docs → in_progress → approved/rejected
   - Stores result files as JSONB array

6. **certification_files** - Certification documents
   - Extended folder types including install_report, latest_plans
   - Links to certification requests

7. **notifications** - In-app notification system
   - Org-scoped notifications
   - Can target specific users or broadcast to org
   - Types: quote_status_change, cert_status_change, org_invite, role_change

### Storage Buckets

Three new org-scoped buckets with RLS:
- **org-assets** - Project files, PDFs, page images
- **quote-files** - Quote request uploads
- **cert-files** - Certification documents

All storage uses org-prefixed paths: `org-{id}/...`

### Row Level Security

All tables have comprehensive RLS policies:
- Members can view/create in their org
- Admins can update request statuses
- Strict org-scoped access only
- Legacy support for non-org projects

### Backend Functions

- **process-pdf** - Updated to support both legacy and org-scoped storage
  - Validates org membership for multi-tenant projects
  - Creates project_assets records for org projects
  - Supports both `blueprints` (legacy) and `org-assets` (new) buckets

## Database Schema

### Enums Created
- `asset_kind`: pdf, page_image, other
- `annotation_type`: pile, footing
- `quote_status`: new, awaiting_docs, in_progress, completed, rejected
- `certification_status`: new, awaiting_docs, in_progress, approved, rejected
- `quote_folder`: soil_report, architectural, engineering, other
- `cert_folder`: install_report, latest_plans, soil_report, architectural, engineering, other
- `notification_type`: quote_status_change, cert_status_change, org_invite, role_change, other

## Backward Compatibility

- Old `piles` and `footings` tables remain for legacy projects
- New `annotations` table used for org-based projects
- Legacy projects (no organisation_id) continue to work
- Storage supports both legacy `blueprints` and new `org-assets` buckets

## Storage Path Conventions

```
org-assets/
  org-{org-id}/
    projects/
      {project-id}/
        pdf/
          blueprint.pdf
        pages/
          page-1.png
          page-2.png

quote-files/
  org-{org-id}/
    quotes/
      {quote-request-id}/
        soil_report/
          file1.pdf
        architectural/
          drawing1.pdf

cert-files/
  org-{org-id}/
    certs/
      {cert-request-id}/
        install_report/
          report.pdf
        latest_plans/
          plan.pdf
```

## Next Steps

### Phase 3: Workflows (Next)
- Build Quote Request UI
  - Submit form with file uploads by folder
  - View request status and admin notes
  - File library view by folder
- Build Certification Request UI
  - "Ready for Certification" button on projects
  - Upload required documents
  - View certification status
- Admin workflows for processing requests

### Phase 4: Admin Dashboards
- Organization management
- Quote request dashboard with org grouping
- Certification dashboard with badges
- Role management UI

### Phase 5: Polish
- Real-time notifications
- Email notifications
- Performance optimizations
- Request comment threads

## Testing Phase 2

1. Create a project in an organization
2. Upload a PDF - should create project_assets record
3. Verify files stored in org-assets bucket with org prefix
4. Check RLS policies allow org members to access
5. Verify legacy projects still work with blueprints bucket
