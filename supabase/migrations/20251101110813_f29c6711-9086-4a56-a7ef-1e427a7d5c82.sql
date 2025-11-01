-- Helper function to count admins in an org
CREATE OR REPLACE FUNCTION public.admin_count(p_org uuid)
RETURNS integer 
LANGUAGE sql 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer 
  FROM organisation_members
  WHERE organisation_id = p_org AND role = 'admin'
$$;

-- Trigger function to prevent removing or demoting the last admin
CREATE OR REPLACE FUNCTION public.prevent_last_admin_change()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_id uuid := coalesce(NEW.organisation_id, OLD.organisation_id);
  before_count int;
  after_role text;
BEGIN
  before_count := public.admin_count(org_id);
  after_role := coalesce(NEW.role::text, OLD.role::text);

  -- On delete: forbid if this row is an admin and it is the last one
  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'admin' AND before_count = 1 THEN
      RAISE EXCEPTION 'Cannot remove the last admin of this organisation';
    END IF;
    RETURN OLD;
  END IF;

  -- On update: forbid admin -> member or viewer when it is the last admin
  IF TG_OP = 'UPDATE' THEN
    IF OLD.role = 'admin' AND after_role <> 'admin' AND before_count = 1 THEN
      RAISE EXCEPTION 'Cannot demote the last admin of this organisation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on organisation_members
DROP TRIGGER IF EXISTS trg_prevent_last_admin_change ON organisation_members;
CREATE TRIGGER trg_prevent_last_admin_change
BEFORE UPDATE OR DELETE ON organisation_members
FOR EACH ROW EXECUTE FUNCTION public.prevent_last_admin_change();