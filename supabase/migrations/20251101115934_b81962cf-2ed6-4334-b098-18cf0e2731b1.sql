-- Expand admin portal capabilities for BladePile platform admins

-- 1. Add is_active flag to organisations
ALTER TABLE organisations 
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- 2. Add processing_org_id to quote_requests if not exists
ALTER TABLE quote_requests
ADD COLUMN IF NOT EXISTS processing_org_id uuid REFERENCES organisations(id);

-- 3. Add notes array to quote_requests for admin history
ALTER TABLE quote_requests
ADD COLUMN IF NOT EXISTS notes jsonb DEFAULT '[]'::jsonb;

-- 4. Add processing_org_id to certification_requests if not exists
ALTER TABLE certification_requests
ADD COLUMN IF NOT EXISTS processing_org_id uuid REFERENCES organisations(id);

-- 5. Add certification_files and admin_comments to certification_requests
ALTER TABLE certification_requests
ADD COLUMN IF NOT EXISTS certification_files jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS admin_comments text;

-- 6. Create function to automatically set processing_org_id to BladePile
CREATE OR REPLACE FUNCTION set_processing_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.processing_org_id := platform_org_id();
  RETURN NEW;
END;
$$;

-- 7. Add trigger to auto-set processing_org_id on quote_requests
DROP TRIGGER IF EXISTS set_quote_processing_org ON quote_requests;
CREATE TRIGGER set_quote_processing_org
BEFORE INSERT ON quote_requests
FOR EACH ROW
WHEN (NEW.processing_org_id IS NULL)
EXECUTE FUNCTION set_processing_org();

-- 8. Add trigger to auto-set processing_org_id on certification_requests
DROP TRIGGER IF EXISTS set_cert_processing_org ON certification_requests;
CREATE TRIGGER set_cert_processing_org
BEFORE INSERT ON certification_requests
FOR EACH ROW
WHEN (NEW.processing_org_id IS NULL)
EXECUTE FUNCTION set_processing_org();

-- 9. Enhanced RLS for platform admins on organisations
DROP POLICY IF EXISTS "Platform admins can manage all organisations" ON organisations;
CREATE POLICY "Platform admins can manage all organisations"
ON organisations
FOR ALL
TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

-- 10. Enhanced RLS for platform admins on organisation_members
DROP POLICY IF EXISTS "Platform admins can manage all members" ON organisation_members;
CREATE POLICY "Platform admins can manage all members"
ON organisation_members
FOR ALL
TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

-- 11. Create view for org stats (member count, project count)
CREATE OR REPLACE VIEW organisation_stats AS
SELECT 
  o.id,
  o.name,
  o.primary_domain,
  o.domains,
  o.is_active,
  o.created_at,
  COUNT(DISTINCT om.user_id) as member_count,
  COUNT(DISTINCT p.id) as project_count
FROM organisations o
LEFT JOIN organisation_members om ON o.id = om.organisation_id
LEFT JOIN projects p ON o.id = p.organisation_id
GROUP BY o.id, o.name, o.primary_domain, o.domains, o.is_active, o.created_at;

-- 12. Grant access to the view for platform admins
GRANT SELECT ON organisation_stats TO authenticated;