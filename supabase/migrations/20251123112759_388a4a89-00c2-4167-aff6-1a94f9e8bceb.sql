-- Fix infinite recursion in organisation_members policies
-- The issue is that SELECT policies on organisation_members query organisation_members,
-- creating infinite recursion. We need to use SECURITY DEFINER functions to break the cycle.

-- First, drop the problematic policies
DROP POLICY IF EXISTS "Members can view their org members" ON organisation_members;
DROP POLICY IF EXISTS "Platform admins can view all memberships" ON organisation_members;
DROP POLICY IF EXISTS "Admins can delete members" ON organisation_members;
DROP POLICY IF EXISTS "Admins can insert members" ON organisation_members;
DROP POLICY IF EXISTS "Admins can update members" ON organisation_members;

-- Recreate policies using existing SECURITY DEFINER functions that don't cause recursion
CREATE POLICY "Members can view their org members"
ON organisation_members FOR SELECT
TO public
USING (
  user_id = auth.uid() 
  OR organisation_id IN (
    SELECT organisation_id FROM user_org_ids(auth.uid())
  )
);

CREATE POLICY "Platform admins can view all memberships"
ON organisation_members FOR SELECT
TO public
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Admins can delete members"
ON organisation_members FOR DELETE
TO public
USING (
  is_platform_admin(auth.uid())
  OR has_role_in_org(auth.uid(), organisation_id, 'admin'::app_role)
);

CREATE POLICY "Admins can insert members"
ON organisation_members FOR INSERT
TO public
WITH CHECK (
  is_platform_admin(auth.uid())
  OR has_role_in_org(auth.uid(), organisation_id, 'admin'::app_role)
);

CREATE POLICY "Admins can update members"
ON organisation_members FOR UPDATE
TO public
USING (
  is_platform_admin(auth.uid())
  OR has_role_in_org(auth.uid(), organisation_id, 'admin'::app_role)
);