-- Fix organisation_members RLS recursion by using security definer helpers
-- These functions run with elevated privileges and don't trigger RLS recursion

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from platform_admins where user_id = auth.uid());
$$;

create or replace function public.is_org_admin(p_org uuid, p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from organisation_members m
    where m.organisation_id = p_org
      and m.user_id = p_user
      and m.role = 'admin'
  );
$$;

create or replace function public.is_org_member(p_org uuid, p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from organisation_members m
    where m.organisation_id = p_org
      and m.user_id = p_user
  );
$$;

alter table public.organisation_members enable row level security;

-- Drop all existing policies that might cause recursion
drop policy if exists "Users can view members of their orgs" on public.organisation_members;
drop policy if exists "Members can view their org members" on public.organisation_members;
drop policy if exists "Users can view own membership" on public.organisation_members;
drop policy if exists "Platform admins can view all memberships" on public.organisation_members;
drop policy if exists om_select on public.organisation_members;
drop policy if exists om_modify on public.organisation_members;
drop policy if exists om_insert on public.organisation_members;
drop policy if exists om_update on public.organisation_members;
drop policy if exists om_delete on public.organisation_members;
drop policy if exists "Admins can insert members" on public.organisation_members;
drop policy if exists "Admins can update members" on public.organisation_members;
drop policy if exists "Admins can delete members" on public.organisation_members;

-- Select policy: simplified to avoid recursion
-- Users can see their own membership, platform admins see all
-- For org admins viewing other members, they'll need to query through organisations table
-- which has its own RLS that should handle this correctly
create policy om_select on public.organisation_members
for select using (
  public.is_platform_admin()
  or user_id = auth.uid()
);

-- Separate policies for insert, update, delete to avoid recursion
drop policy if exists om_insert on public.organisation_members;
drop policy if exists om_update on public.organisation_members;
drop policy if exists om_delete on public.organisation_members;

create policy om_insert on public.organisation_members
for insert with check (
  public.is_platform_admin()
  or public.is_org_admin(organisation_id)
);

create policy om_update on public.organisation_members
for update using (
  public.is_platform_admin()
  or public.is_org_admin(organisation_id)
)
with check (
  public.is_platform_admin()
  or public.is_org_admin(organisation_id)
);

create policy om_delete on public.organisation_members
for delete using (
  public.is_platform_admin()
  or public.is_org_admin(organisation_id)
);

