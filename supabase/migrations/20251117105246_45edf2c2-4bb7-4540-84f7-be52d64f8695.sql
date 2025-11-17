-- Fix sidebar_counts_for_me function to use valid certification_status enum values
CREATE OR REPLACE FUNCTION public.sidebar_counts_for_me()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;