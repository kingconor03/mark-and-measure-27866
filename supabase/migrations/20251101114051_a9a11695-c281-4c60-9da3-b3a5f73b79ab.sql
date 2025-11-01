-- Remove Viewer role and enforce two-role system with BladePile admin restriction

-- 1. Convert existing viewers to member
UPDATE organisation_members
SET role = 'member'
WHERE role = 'viewer';

-- 2. Update user_roles table (sync table)
UPDATE user_roles
SET role = 'member'
WHERE role = 'viewer';

-- 3. Create platform org helper function
CREATE OR REPLACE FUNCTION public.platform_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM organisations WHERE primary_domain = 'bladepile.com.au' LIMIT 1
$$;

-- 4. Add trigger to prevent non-platform orgs from having admins
CREATE OR REPLACE FUNCTION public.prevent_non_platform_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  plat uuid := platform_org_id();
  tgt_role text := COALESCE(NEW.role::text, OLD.role::text);
  tgt_org uuid := COALESCE(NEW.organisation_id, OLD.organisation_id);
BEGIN
  IF tgt_role = 'admin' AND tgt_org != plat THEN
    RAISE EXCEPTION 'Only BladePile organisation may have admin members';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_non_platform_admin ON organisation_members;
CREATE TRIGGER trg_prevent_non_platform_admin
BEFORE INSERT OR UPDATE ON organisation_members
FOR EACH ROW EXECUTE FUNCTION prevent_non_platform_admin();

-- 5. Update RLS policies to remove viewer references

-- organisation_members policies
DROP POLICY IF EXISTS "Users can view members of their orgs" ON organisation_members;
DROP POLICY IF EXISTS "Admins can insert members" ON organisation_members;
DROP POLICY IF EXISTS "Admins can update members" ON organisation_members;
DROP POLICY IF EXISTS "Admins can delete members" ON organisation_members;

CREATE POLICY "Members can view their org members"
ON organisation_members
FOR SELECT
TO authenticated
USING (
  organisation_id IN (
    SELECT organisation_id FROM organisation_members m
    WHERE m.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage org members"
ON organisation_members
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organisation_members am
    WHERE am.organisation_id = organisation_members.organisation_id
      AND am.user_id = auth.uid()
      AND am.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM organisation_members am
    WHERE am.organisation_id = organisation_members.organisation_id
      AND am.user_id = auth.uid()
      AND am.role = 'admin'
  )
);

-- Keep the policy for first member addition
-- (already exists: "Users can add themselves as first member")

-- 6. Update auto-assign trigger to use 'member' instead of 'viewer'
CREATE OR REPLACE FUNCTION public.auto_assign_user_to_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _domain text;
  _org_id uuid;
BEGIN
  -- Extract domain from email
  _domain := split_part(NEW.email, '@', 2);
  
  -- Find organization with matching domain
  SELECT id INTO _org_id
  FROM public.organisations
  WHERE _domain = ANY(domains) OR _domain = primary_domain
  LIMIT 1;
  
  -- If matching org found, add user as member (not viewer)
  IF _org_id IS NOT NULL THEN
    INSERT INTO public.organisation_members (user_id, organisation_id, role)
    VALUES (NEW.id, _org_id, 'member')
    ON CONFLICT (user_id, organisation_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;