# Authentication Flow Implementation

## Overview
Implemented a comprehensive authentication and organization management system with route protection.

## Database Changes

### Platform Admins Table
- Created `platform_admins` table to manage users with special privileges
- Platform admins can create organizations with any domain (not limited to their email domain)
- RLS policies ensure proper access control

### Seed Data
- Pre-seeded "Blade Pile" organization with domain `bladepile.com.au`
- To add platform admin users, run this SQL with your user ID:
```sql
INSERT INTO platform_admins(user_id) 
VALUES ('YOUR_USER_UUID_HERE') 
ON CONFLICT DO NOTHING;

INSERT INTO organisation_members (organisation_id, user_id, role)
SELECT id, 'YOUR_USER_UUID_HERE'::uuid, 'admin'
FROM organisations WHERE primary_domain = 'bladepile.com.au'
ON CONFLICT DO NOTHING;
```

## Authentication Flow

### Public Routes
- `/` - Redirects to `/dashboard`
- `/auth` - Sign in/sign up page
  - Supports `?returnTo=` parameter for post-login redirects
  - Never redirects directly to `/create-organization` after auth

### Protected Routes (Auth Required)
- `/create-organization` - Requires auth but NOT org membership
  - Shows organization creation form
  - Normal users: domain prefilled from email (read-only)
  - Platform admins: domain field is editable
  - Auto-redirects to `/dashboard` if user already has org

### Protected Routes (Auth + Org Required)
- `/dashboard` - Main dashboard
- `/editor/:projectId` - Blueprint editor
- `/processing/:projectId` - Processing status page
- `/settings` - User settings

## Route Protection Logic

### ProtectedRoute Component
Centralized route protection that enforces:
1. **Authentication Check**: Redirects to `/auth?returnTo={currentPath}` if not logged in
2. **Organization Check**: Redirects to `/create-organization` if user has no org (when `requireOrg=true`)
3. **Prevents Loops**: Redirects from `/create-organization` to `/dashboard` if user already has org
4. **Loading States**: Shows spinner while checking auth and org status

### Middleware-Style Rules
1. Allow public paths (`/`, `/auth`)
2. Require login before any org check
3. After login:
   - No org → redirect to `/create-organization`
   - Has org → allow normal navigation
   - Has org but visits `/create-organization` → redirect to `/dashboard`
4. Prevents infinite redirect loops with proper state checks

## Platform Admin System

### Features
- Platform admins can create organizations with ANY domain
- Normal users can only create orgs with their email domain
- Visual indicator on create-organization page showing admin status
- Domain field is editable only for platform admins

### Usage
1. Sign up/sign in as a user
2. Have a database admin add your `user_id` to `platform_admins` table
3. You can now create organizations for any domain

## Organization Creation Flow

### Normal Users
1. Sign up with email (e.g., `user@company.com`)
2. After authentication, redirected to `/create-organization`
3. Form shows:
   - Organization Name (editable)
   - Domain: `company.com` (read-only, from email)
4. Submit to create org and redirect to dashboard

### Platform Admins
1. Sign in with platform admin account
2. Visit `/create-organization`
3. Form shows:
   - Organization Name (editable)
   - Domain (editable - can set ANY domain)
4. Can create orgs for clients/partners with custom domains

## Updated Components

### src/hooks/useOrganisation.tsx
- Added `isPlatformAdmin` state and check
- New `checkPlatformAdmin()` function
- Returns `isPlatformAdmin` in hook interface

### src/components/ProtectedRoute.tsx (NEW)
- Centralized route protection logic
- Handles auth and org checks
- Manages loading states and redirects

### src/pages/CreateOrganization.tsx (NEW - replaces Onboarding.tsx)
- Organization creation form
- Platform admin detection and UI
- Editable domain field for admins only
- Auto-redirects if user already has org

### src/pages/Auth.tsx
- Added `returnTo` parameter support
- Never redirects to `/create-organization` directly
- Simplified redirect logic

### src/App.tsx
- Updated routes to use `ProtectedRoute` wrapper
- Added `/create-organization` route
- Removed old `/onboarding` route

### src/pages/Dashboard.tsx
- Removed redundant auth/org checks (handled by ProtectedRoute)
- Simplified to focus on project fetching

## Security Notes

1. **RLS Policies**: All organization and membership checks use RLS at database level
2. **Platform Admin Verification**: Checked server-side via database query
3. **No Client-Side Privilege Escalation**: Admin status never stored in localStorage
4. **Proper Auth Flow**: Always check auth before org membership
5. **Redirect Prevention**: Proper state management prevents infinite redirect loops

## Testing Checklist

- [ ] Sign up new user - should land on `/create-organization`
- [ ] Create org as normal user - domain should be read-only
- [ ] Sign in existing user with org - should land on `/dashboard`
- [ ] Try visiting `/create-organization` with org - should redirect to dashboard
- [ ] Add user to `platform_admins` table
- [ ] Sign in as platform admin - domain field should be editable
- [ ] Create org with custom domain as platform admin
- [ ] Test protected routes without login - should redirect to `/auth?returnTo=...`
- [ ] Complete login - should redirect to saved `returnTo` path
