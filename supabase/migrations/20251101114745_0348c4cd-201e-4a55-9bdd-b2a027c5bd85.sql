-- Fix organization creation and auto-assignment for BladePile users

-- 1. Drop the overly permissive org creation policy
DROP POLICY IF EXISTS "Authenticated users can create organisations" ON organisations;

-- 2. Only platform admins can create new organizations
CREATE POLICY "Platform admins can create organisations"
ON organisations
FOR INSERT
TO authenticated
WITH CHECK (is_platform_admin(auth.uid()));

-- 3. Update the first member policy to only allow 'member' role by default
-- This prevents the admin enforcement trigger from blocking org creation
DROP POLICY IF EXISTS "Users can add themselves as first member" ON organisation_members;

CREATE POLICY "Users can add themselves as first member"
ON organisation_members
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id 
  AND role = 'member'
  AND NOT EXISTS (
    SELECT 1 
    FROM organisation_members om
    WHERE om.organisation_id = organisation_members.organisation_id
  )
);

-- 4. Ensure auto-assign happens immediately after profile creation
-- Update the trigger to fire after profile insert
DROP TRIGGER IF EXISTS on_profile_created ON profiles;

CREATE TRIGGER on_profile_created
AFTER INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION auto_assign_user_to_org();