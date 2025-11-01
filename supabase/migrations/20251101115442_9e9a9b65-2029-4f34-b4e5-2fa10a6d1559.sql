-- Ensure platform admins are always admins in BladePile org

-- 1. Create function to ensure platform admin membership in BladePile
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

-- 2. Update auto-assign trigger to give admin role to BladePile users who are platform admins
CREATE OR REPLACE FUNCTION public.auto_assign_user_to_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _domain text;
  _org_id uuid;
  _is_platform_admin boolean;
  _assign_role text;
BEGIN
  -- Extract domain from email
  _domain := split_part(NEW.email, '@', 2);
  
  -- Check if this user is a platform admin
  _is_platform_admin := EXISTS (
    SELECT 1 FROM platform_admins WHERE user_id = NEW.id
  );
  
  -- Find organization with matching domain
  SELECT id INTO _org_id
  FROM public.organisations
  WHERE _domain = ANY(domains) OR _domain = primary_domain
  LIMIT 1;
  
  -- If matching org found, add user
  IF _org_id IS NOT NULL THEN
    -- If user is platform admin AND joining BladePile org, make them admin
    IF _is_platform_admin AND _domain = 'bladepile.com.au' THEN
      _assign_role := 'admin';
    ELSE
      _assign_role := 'member';
    END IF;
    
    INSERT INTO public.organisation_members (user_id, organisation_id, role)
    VALUES (NEW.id, _org_id, _assign_role)
    ON CONFLICT (user_id, organisation_id) 
    DO UPDATE SET role = CASE 
      WHEN EXCLUDED.role = 'admin' THEN 'admin'
      ELSE organisation_members.role
    END; -- Don't downgrade admins to members
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Ensure conor@bladepile.com.au is set up correctly right now
DO $$
DECLARE
  conor_id uuid;
  plat_org_id uuid := platform_org_id();
BEGIN
  -- Get conor's user ID
  SELECT id INTO conor_id 
  FROM profiles 
  WHERE email = 'conor@bladepile.com.au' 
  LIMIT 1;
  
  IF conor_id IS NOT NULL AND plat_org_id IS NOT NULL THEN
    -- Ensure he's a platform admin
    INSERT INTO platform_admins (user_id)
    VALUES (conor_id)
    ON CONFLICT DO NOTHING;
    
    -- Ensure he's an admin member of BladePile
    INSERT INTO organisation_members (organisation_id, user_id, role)
    VALUES (plat_org_id, conor_id, 'admin')
    ON CONFLICT (organisation_id, user_id)
    DO UPDATE SET role = 'admin';
    
    RAISE NOTICE 'Platform admin setup complete for conor@bladepile.com.au';
  END IF;
END $$;