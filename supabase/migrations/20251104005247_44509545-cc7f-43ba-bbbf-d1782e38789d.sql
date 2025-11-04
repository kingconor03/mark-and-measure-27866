-- Ensure helper functions exist for platform admin features

-- Function to get BladePile org ID
CREATE OR REPLACE FUNCTION public.platform_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM organisations WHERE primary_domain = 'bladepile.com.au' LIMIT 1
$$;

-- Function to check if user is platform admin
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins
    WHERE user_id = _user_id
  )
$$;

-- Function to list members with emails (service role only)
CREATE OR REPLACE FUNCTION public.list_members_with_email(p_org uuid)
RETURNS TABLE(user_id uuid, role text, created_at timestamptz, email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.user_id, m.role::text, m.created_at, p.email
  FROM organisation_members m
  LEFT JOIN profiles p ON p.id = m.user_id
  WHERE m.organisation_id = p_org
  ORDER BY m.created_at DESC
$$;

-- Ensure platform admin membership function exists
CREATE OR REPLACE FUNCTION public.ensure_platform_admin_membership(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  plat_org_id uuid := platform_org_id();
BEGIN
  IF plat_org_id IS NULL THEN
    RAISE EXCEPTION 'Platform organization (bladepile.com.au) not found';
  END IF;

  -- Ensure user is in platform_admins table
  INSERT INTO platform_admins (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Ensure user is admin member of BladePile org
  INSERT INTO organisation_members (organisation_id, user_id, role)
  VALUES (plat_org_id, p_user_id, 'admin')
  ON CONFLICT (organisation_id, user_id) 
  DO UPDATE SET role = 'admin'; -- Upgrade to admin if they were member
END;
$$;