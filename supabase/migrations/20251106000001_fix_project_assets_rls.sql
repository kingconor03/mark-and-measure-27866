-- Fix project_assets RLS for normal selects
-- Allow org members to read assets for their projects and platform admins to read all

alter table public.project_assets enable row level security;

drop policy if exists pa_select on public.project_assets;

-- Use helper function to avoid RLS recursion
create policy pa_select on public.project_assets
for select using (
  public.is_platform_admin()
  or exists (
    select 1 from projects p
    where p.id = project_assets.project_id
      and (
        -- Legacy: direct ownership
        (p.organisation_id is null and p.user_id = auth.uid())
        or
        -- Multi-tenant: org membership
        (p.organisation_id is not null and public.is_org_member(p.organisation_id))
      )
  )
);

-- Keep existing insert/update/delete policies if they exist, or create minimal ones
drop policy if exists pa_insert on public.project_assets;
drop policy if exists pa_update on public.project_assets;
drop policy if exists pa_delete on public.project_assets;

-- Allow members to insert assets for their org projects
create policy pa_insert on public.project_assets
for insert with check (
  public.is_platform_admin()
  or exists (
    select 1 from projects p
    where p.id = project_assets.project_id
      and (
        (p.organisation_id is null and p.user_id = auth.uid())
        or
        (p.organisation_id is not null and public.is_org_member(p.organisation_id))
      )
  )
);

-- Allow members to update/delete assets for their org projects
create policy pa_update on public.project_assets
for update using (
  public.is_platform_admin()
  or exists (
    select 1 from projects p
    where p.id = project_assets.project_id
      and (
        (p.organisation_id is null and p.user_id = auth.uid())
        or
        (p.organisation_id is not null and public.is_org_member(p.organisation_id))
      )
  )
);

create policy pa_delete on public.project_assets
for delete using (
  public.is_platform_admin()
  or exists (
    select 1 from projects p
    where p.id = project_assets.project_id
      and (
        (p.organisation_id is null and p.user_id = auth.uid())
        or
        (p.organisation_id is not null and public.is_org_member(p.organisation_id))
      )
  )
);

