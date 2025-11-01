-- Phase 1: Multi-tenant Foundation

-- Create app_role enum for organization roles
CREATE TYPE public.app_role AS ENUM ('admin', 'member', 'viewer');

-- Organizations table
CREATE TABLE public.organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  primary_domain TEXT NOT NULL UNIQUE,
  domains TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Organisation members with roles
CREATE TABLE public.organisation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organisation_id, user_id)
);

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, organisation_id, role)
);

-- Add organisation_id to existing tables (nullable for backward compatibility)
ALTER TABLE public.projects ADD COLUMN organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE;
ALTER TABLE public.projects ADD COLUMN created_by UUID REFERENCES auth.users(id);

-- Create indexes for performance
CREATE INDEX idx_organisation_members_org ON public.organisation_members(organisation_id);
CREATE INDEX idx_organisation_members_user ON public.organisation_members(user_id);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_org ON public.user_roles(organisation_id);
CREATE INDEX idx_projects_org ON public.projects(organisation_id);

-- Security definer function to check if user has role in org (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role_in_org(_user_id UUID, _org_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND organisation_id = _org_id
      AND role = _role
  )
$$;

-- Security definer function to check if user is member of org
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organisation_members
    WHERE user_id = _user_id
      AND organisation_id = _org_id
  )
$$;

-- Security definer function to get user's org ids
CREATE OR REPLACE FUNCTION public.user_org_ids(_user_id UUID)
RETURNS TABLE(organisation_id UUID)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organisation_id
  FROM public.organisation_members
  WHERE user_id = _user_id
$$;

-- Enable RLS on new tables
ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organisation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organisations
CREATE POLICY "Users can view orgs they belong to"
  ON public.organisations FOR SELECT
  TO authenticated
  USING (public.is_org_member(auth.uid(), id));

-- RLS Policies for organisation_members
CREATE POLICY "Users can view members of their orgs"
  ON public.organisation_members FOR SELECT
  TO authenticated
  USING (public.is_org_member(auth.uid(), organisation_id));

CREATE POLICY "Admins can insert members"
  ON public.organisation_members FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role_in_org(auth.uid(), organisation_id, 'admin'));

CREATE POLICY "Admins can update members"
  ON public.organisation_members FOR UPDATE
  TO authenticated
  USING (public.has_role_in_org(auth.uid(), organisation_id, 'admin'));

CREATE POLICY "Admins can delete members"
  ON public.organisation_members FOR DELETE
  TO authenticated
  USING (public.has_role_in_org(auth.uid(), organisation_id, 'admin'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage roles in their org"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role_in_org(auth.uid(), organisation_id, 'admin'));

-- Update projects RLS to support org-based access (when org_id is set)
CREATE POLICY "Users can view projects in their orgs"
  ON public.projects FOR SELECT
  TO authenticated
  USING (
    -- Legacy: user owns project directly
    (organisation_id IS NULL AND auth.uid() = user_id)
    OR
    -- Multi-tenant: user is member of project's org
    (organisation_id IS NOT NULL AND public.is_org_member(auth.uid(), organisation_id))
  );

CREATE POLICY "Members can create projects in their orgs"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Legacy: user creates for themselves
    (organisation_id IS NULL AND auth.uid() = user_id)
    OR
    -- Multi-tenant: user is at least a member
    (organisation_id IS NOT NULL AND public.is_org_member(auth.uid(), organisation_id))
  );

CREATE POLICY "Members can update projects in their orgs"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (
    (organisation_id IS NULL AND auth.uid() = user_id)
    OR
    (organisation_id IS NOT NULL AND public.is_org_member(auth.uid(), organisation_id))
  );

CREATE POLICY "Admins can delete projects in their orgs"
  ON public.projects FOR DELETE
  TO authenticated
  USING (
    (organisation_id IS NULL AND auth.uid() = user_id)
    OR
    (organisation_id IS NOT NULL AND public.has_role_in_org(auth.uid(), organisation_id, 'admin'))
  );

-- Trigger to sync organisation_members to user_roles
CREATE OR REPLACE FUNCTION public.sync_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Upsert role
    INSERT INTO public.user_roles (user_id, organisation_id, role)
    VALUES (NEW.user_id, NEW.organisation_id, NEW.role)
    ON CONFLICT (user_id, organisation_id, role) DO NOTHING;
    
    -- Remove old role if role changed
    IF TG_OP = 'UPDATE' AND OLD.role != NEW.role THEN
      DELETE FROM public.user_roles
      WHERE user_id = NEW.user_id
        AND organisation_id = NEW.organisation_id
        AND role = OLD.role;
    END IF;
    
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Remove all roles for this user in this org
    DELETE FROM public.user_roles
    WHERE user_id = OLD.user_id
      AND organisation_id = OLD.organisation_id;
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER sync_user_role_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.organisation_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_role();

-- Trigger for updating organisations updated_at
CREATE TRIGGER update_organisations_updated_at
  BEFORE UPDATE ON public.organisations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();