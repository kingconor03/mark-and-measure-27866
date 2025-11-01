-- Function to auto-assign users to organizations based on their email domain
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
  
  -- If matching org found, add user as member
  IF _org_id IS NOT NULL THEN
    INSERT INTO public.organisation_members (user_id, organisation_id, role)
    VALUES (NEW.id, _org_id, 'viewer')
    ON CONFLICT (user_id, organisation_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on profiles table to auto-assign on user creation
DROP TRIGGER IF EXISTS on_profile_created_auto_assign ON public.profiles;
CREATE TRIGGER on_profile_created_auto_assign
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_user_to_org();

-- Also run for existing users who aren't in an org yet
DO $$
DECLARE
  _profile RECORD;
  _domain text;
  _org_id uuid;
BEGIN
  FOR _profile IN 
    SELECT p.id, p.email 
    FROM public.profiles p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.organisation_members om 
      WHERE om.user_id = p.id
    )
  LOOP
    _domain := split_part(_profile.email, '@', 2);
    
    SELECT id INTO _org_id
    FROM public.organisations
    WHERE _domain = ANY(domains) OR _domain = primary_domain
    LIMIT 1;
    
    IF _org_id IS NOT NULL THEN
      INSERT INTO public.organisation_members (user_id, organisation_id, role)
      VALUES (_profile.id, _org_id, 'viewer')
      ON CONFLICT (user_id, organisation_id) DO NOTHING;
    END IF;
  END LOOP;
END $$;