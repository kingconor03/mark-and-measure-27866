-- Fix infinite recursion in organisation_members policies
-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Users can view their organisation members" ON organisation_members;
DROP POLICY IF EXISTS "Users can view organisation members" ON organisation_members;
DROP POLICY IF EXISTS "Members can view their organisation" ON organisation_members;
DROP POLICY IF EXISTS "Users can insert organisation members" ON organisation_members;
DROP POLICY IF EXISTS "Users can update organisation members" ON organisation_members;
DROP POLICY IF EXISTS "Users can delete organisation members" ON organisation_members;

-- Create simple, non-recursive policies
-- Users can see their own membership records
CREATE POLICY "Users can view own membership"
ON organisation_members FOR SELECT
USING (user_id = auth.uid());

-- Platform admins can see all memberships
CREATE POLICY "Platform admins can view all memberships"
ON organisation_members FOR SELECT
USING (
  auth.uid() IN (SELECT user_id FROM platform_admins)
);

-- Platform admins and org admins can insert members
CREATE POLICY "Admins can insert members"
ON organisation_members FOR INSERT
WITH CHECK (
  auth.uid() IN (SELECT user_id FROM platform_admins)
  OR
  EXISTS (
    SELECT 1 FROM organisation_members om
    WHERE om.user_id = auth.uid()
    AND om.organisation_id = organisation_members.organisation_id
    AND om.role = 'admin'
  )
);

-- Platform admins and org admins can update members
CREATE POLICY "Admins can update members"
ON organisation_members FOR UPDATE
USING (
  auth.uid() IN (SELECT user_id FROM platform_admins)
  OR
  EXISTS (
    SELECT 1 FROM organisation_members om
    WHERE om.user_id = auth.uid()
    AND om.organisation_id = organisation_members.organisation_id
    AND om.role = 'admin'
  )
);

-- Platform admins and org admins can delete members
CREATE POLICY "Admins can delete members"
ON organisation_members FOR DELETE
USING (
  auth.uid() IN (SELECT user_id FROM platform_admins)
  OR
  EXISTS (
    SELECT 1 FROM organisation_members om
    WHERE om.user_id = auth.uid()
    AND om.organisation_id = organisation_members.organisation_id
    AND om.role = 'admin'
  )
);