# Multi-Tenant Architecture - Phase 1 Implementation

## Overview
BladeMark has been upgraded to support multi-tenant organization-based access control. This allows multiple companies to use the platform with isolated data and role-based permissions.

## What Was Done

### Database Changes
1. **New Tables Created:**
   - `organisations` - Stores company information and approved domains
   - `organisation_members` - Links users to organizations with roles
   - `user_roles` - Secure role storage (prevents privilege escalation)

2. **Role System:**
   - `admin` - Can manage users, roles, and all organization data
   - `member` - Can create projects, annotate, and submit requests
   - `viewer` - Read-only access

3. **Existing Tables Updated:**
   - Added `organisation_id` to `projects` table (nullable for backward compatibility)
   - Added `created_by` to track project creators
   - Updated all RLS policies to support org-scoped access

4. **Security Functions:**
   - `has_role_in_org()` - Check if user has specific role in org
   - `is_org_member()` - Check if user belongs to org
   - `user_org_ids()` - Get all org IDs for a user

### Authentication Flow
1. User signs up with company email
2. System checks for existing organization by domain
3. If found: User added as Viewer (pending admin upgrade)
4. If not found: User can create new organization (becomes admin)
5. All logins redirect through onboarding to ensure org membership

### Feature Flag System
Created `src/config/features.ts` with flags:
- `orgEnabled: true` - Enables multi-tenant features
- `showOrgManagement: true` - Shows org management UI
- `requireDomainApproval: true` - Requires domain matching

### New Pages & Components
- **Onboarding Page** (`/onboarding`) - Handles org assignment/creation
- **useOrganisation Hook** - Manages org state and operations
- Updated **Dashboard** to filter projects by organization
- Updated **NewProjectModal** to assign projects to organization

## Backward Compatibility
- Projects without `organisation_id` still work (legacy mode)
- RLS policies support both legacy (user-owned) and org-scoped access
- Feature flags allow gradual rollout

## Current Limitations
- Users can only belong to one active org (TODO: org switching)
- No UI for admins to manage members yet (Phase 4)
- Quote/certification workflows not yet implemented (Phase 3)

## Next Steps

### Phase 2: Data Model Extension
- Add `project_assets` table
- Add `annotations` table to replace pile/footing tables
- Add `quote_requests` and `certification_requests` tables
- Restructure storage with org prefixes
- Create PDF processing pipeline

### Phase 3: Workflows
- Quote request submission flow
- Certification request flow
- Status management system
- File upload handling per folder

### Phase 4: Admin Dashboards
- Organization management UI
- User role management
- Quote request dashboard
- Certification dashboard
- Request status controls

### Phase 5: Polish
- Notifications system
- Real-time updates via Supabase Realtime
- Performance optimizations
- Email notifications

## Testing the Current Implementation

1. **Sign up with a company email** (e.g., user@acme-construction.com)
2. You'll be prompted to create an organization
3. The domain "acme-construction.com" is now approved
4. Sign up another user with same domain - they'll auto-join as Viewer
5. Create projects - they're scoped to your organization
6. Only members of your org can see the projects

## Security Notes
- All sensitive tables have RLS enabled
- Role checks use security definer functions to prevent recursion
- Org IDs are validated on all mutations
- Storage paths will include org IDs (Phase 2)
- Cross-org access is prevented by RLS policies

## Environment Configuration
No new environment variables needed - all configuration in `features.ts`

To disable multi-tenant features temporarily:
```typescript
// src/config/features.ts
export const features = {
  orgEnabled: false, // Disable org features
  // ...
}
```
