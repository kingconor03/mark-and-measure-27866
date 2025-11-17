-- Create sidebar_counts_for_user RPC that accepts p_user explicitly
-- This allows it to be called from edge functions or server routes with explicit user ID

create or replace function public.sidebar_counts_for_user(p_user uuid)
returns table(kind text, pending_quotes int, pending_certs int, certs_passed_2_weeks int)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  is_platform boolean;
begin
  is_platform := exists (select 1 from platform_admins where user_id = p_user);

  if is_platform then
    return query
      select 'platform'::text,
             coalesce((select count(*) from quote_requests where processing_org_id = platform_org_id() and status in ('new','awaiting_docs','in_progress')),0),
             coalesce((select count(*) from certification_requests where processing_org_id = platform_org_id() and status in ('new','awaiting_docs','in_progress')),0),
             coalesce((select count(*) from certification_requests where processing_org_id = platform_org_id() and status in ('new','awaiting_docs','in_progress') and updated_at < now() - interval '14 days'),0);
  else
    return query
      select 'tenant'::text,
             coalesce((select count(*) from quote_requests qr where qr.organisation_id in (select organisation_id from organisation_members where user_id = p_user) and qr.status in ('new','awaiting_docs','in_progress')),0),
             coalesce((select count(*) from certification_requests cr where cr.organisation_id in (select organisation_id from organisation_members where user_id = p_user) and cr.status in ('new','awaiting_docs','in_progress')),0),
             0;
  end if;
end;
$$;

