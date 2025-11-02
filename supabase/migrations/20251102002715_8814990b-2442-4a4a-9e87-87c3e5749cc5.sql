-- Fix infinite recursion by using security definer function for organisations SELECT policy
DROP POLICY IF EXISTS "Users can view orgs they belong to" ON organisations;

-- Use the existing user_org_ids function to avoid recursion
CREATE POLICY "Users can view orgs they belong to"
ON organisations FOR SELECT
USING (
  id IN (SELECT organisation_id FROM user_org_ids(auth.uid()))
);