-- Ensure organisations has is_active (already exists)
-- No change needed, column already exists

-- Update app_role enum to only include admin and member
-- First check if viewer is used anywhere
DO $$ 
BEGIN
  -- We'll keep viewer in the enum but enforce admin only for BladePile via trigger
  -- Removing enum values is complex and may break existing data
END $$;

-- Add notes history to quote_requests if not exists
ALTER TABLE quote_requests 
ADD COLUMN IF NOT EXISTS notes_history jsonb DEFAULT '[]'::jsonb;

-- Add notes history to certification_requests if not exists
ALTER TABLE certification_requests 
ADD COLUMN IF NOT EXISTS notes_history jsonb DEFAULT '[]'::jsonb;

-- Create trigger to prevent non-BladePile orgs from having admin members
CREATE OR REPLACE FUNCTION prevent_non_platform_admin()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply trigger to organisation_members
DROP TRIGGER IF EXISTS enforce_bladepile_admin_only ON organisation_members;
CREATE TRIGGER enforce_bladepile_admin_only
  BEFORE INSERT OR UPDATE ON organisation_members
  FOR EACH ROW
  EXECUTE FUNCTION prevent_non_platform_admin();

-- Create trigger to auto-set processing_org_id to BladePile
CREATE OR REPLACE FUNCTION set_processing_org()
RETURNS TRIGGER AS $$
BEGIN
  NEW.processing_org_id := platform_org_id();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply to quote_requests
DROP TRIGGER IF EXISTS set_quote_processing_org ON quote_requests;
CREATE TRIGGER set_quote_processing_org
  BEFORE INSERT ON quote_requests
  FOR EACH ROW
  WHEN (NEW.processing_org_id IS NULL)
  EXECUTE FUNCTION set_processing_org();

-- Apply to certification_requests
DROP TRIGGER IF EXISTS set_cert_processing_org ON certification_requests;
CREATE TRIGGER set_cert_processing_org
  BEFORE INSERT ON certification_requests
  FOR EACH ROW
  WHEN (NEW.processing_org_id IS NULL)
  EXECUTE FUNCTION set_processing_org();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS ix_qr_proc_status 
ON quote_requests (processing_org_id, status);

CREATE INDEX IF NOT EXISTS ix_cr_proc_status 
ON certification_requests (processing_org_id, status);

-- Add index for organisation_members lookups
CREATE INDEX IF NOT EXISTS ix_org_members_org_role 
ON organisation_members (organisation_id, role);

-- Create RPC for sidebar counts
CREATE OR REPLACE FUNCTION sidebar_counts_for_me()
RETURNS jsonb AS $$
DECLARE
  is_admin boolean;
  plat_org uuid;
  result jsonb;
BEGIN
  is_admin := is_platform_admin(auth.uid());
  plat_org := platform_org_id();
  
  IF is_admin THEN
    -- Platform admin sees all BladePile processing counts
    SELECT jsonb_build_object(
      'quotes_new', COUNT(*) FILTER (WHERE qr.status = 'new'),
      'quotes_awaiting_docs', COUNT(*) FILTER (WHERE qr.status = 'awaiting_docs'),
      'quotes_in_progress', COUNT(*) FILTER (WHERE qr.status = 'in_progress'),
      'certs_new', COUNT(*) FILTER (WHERE cr.status = 'new'),
      'certs_pending', COUNT(*) FILTER (WHERE cr.status = 'in_progress'),
      'certs_awaiting_docs', COUNT(*) FILTER (WHERE cr.status = 'awaiting_docs')
    )
    INTO result
    FROM quote_requests qr
    FULL OUTER JOIN certification_requests cr ON false
    WHERE qr.processing_org_id = plat_org OR cr.processing_org_id = plat_org;
  ELSE
    -- Regular user sees their org's request counts
    SELECT jsonb_build_object(
      'my_quotes_pending', COUNT(*) FILTER (WHERE qr.status IN ('new', 'awaiting_docs', 'in_progress')),
      'my_certs_pending', COUNT(*) FILTER (WHERE cr.status IN ('new', 'in_progress', 'awaiting_docs'))
    )
    INTO result
    FROM quote_requests qr
    FULL OUTER JOIN certification_requests cr ON false
    WHERE qr.organisation_id IN (SELECT organisation_id FROM user_org_ids(auth.uid()))
       OR cr.organisation_id IN (SELECT organisation_id FROM user_org_ids(auth.uid()));
  END IF;
  
  RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;