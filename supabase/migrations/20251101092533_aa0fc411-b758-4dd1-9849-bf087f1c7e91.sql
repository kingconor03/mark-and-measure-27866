-- Phase 1B: Update RLS policies for existing annotation tables to support organizations

-- Add organisation_id to pages, piles, footings (via project relationship)
-- These tables don't need the column directly since they reference projects

-- Drop old RLS policies on pages
DROP POLICY IF EXISTS "Users can view pages of own projects" ON public.pages;
DROP POLICY IF EXISTS "Users can create pages for own projects" ON public.pages;
DROP POLICY IF EXISTS "Users can update pages of own projects" ON public.pages;
DROP POLICY IF EXISTS "Users can delete pages of own projects" ON public.pages;

-- Create new org-aware policies for pages
CREATE POLICY "Users can view pages in their orgs"
  ON public.pages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = pages.project_id
        AND (
          -- Legacy: user owns project
          (projects.organisation_id IS NULL AND projects.user_id = auth.uid())
          OR
          -- Multi-tenant: user is member of project's org
          (projects.organisation_id IS NOT NULL AND public.is_org_member(auth.uid(), projects.organisation_id))
        )
    )
  );

CREATE POLICY "Members can create pages in their orgs"
  ON public.pages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = pages.project_id
        AND (
          (projects.organisation_id IS NULL AND projects.user_id = auth.uid())
          OR
          (projects.organisation_id IS NOT NULL AND public.is_org_member(auth.uid(), projects.organisation_id))
        )
    )
  );

CREATE POLICY "Members can update pages in their orgs"
  ON public.pages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = pages.project_id
        AND (
          (projects.organisation_id IS NULL AND projects.user_id = auth.uid())
          OR
          (projects.organisation_id IS NOT NULL AND public.is_org_member(auth.uid(), projects.organisation_id))
        )
    )
  );

CREATE POLICY "Admins can delete pages in their orgs"
  ON public.pages FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = pages.project_id
        AND (
          (projects.organisation_id IS NULL AND projects.user_id = auth.uid())
          OR
          (projects.organisation_id IS NOT NULL AND public.has_role_in_org(auth.uid(), projects.organisation_id, 'admin'))
        )
    )
  );

-- Drop old policies on piles
DROP POLICY IF EXISTS "Users can view piles of own projects" ON public.piles;
DROP POLICY IF EXISTS "Users can create piles for own projects" ON public.piles;
DROP POLICY IF EXISTS "Users can update piles of own projects" ON public.piles;
DROP POLICY IF EXISTS "Users can delete piles of own projects" ON public.piles;

-- Create new org-aware policies for piles
CREATE POLICY "Users can view piles in their orgs"
  ON public.piles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pages
      JOIN public.projects ON projects.id = pages.project_id
      WHERE pages.id = piles.page_id
        AND (
          (projects.organisation_id IS NULL AND projects.user_id = auth.uid())
          OR
          (projects.organisation_id IS NOT NULL AND public.is_org_member(auth.uid(), projects.organisation_id))
        )
    )
  );

CREATE POLICY "Members can create piles in their orgs"
  ON public.piles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pages
      JOIN public.projects ON projects.id = pages.project_id
      WHERE pages.id = piles.page_id
        AND (
          (projects.organisation_id IS NULL AND projects.user_id = auth.uid())
          OR
          (projects.organisation_id IS NOT NULL AND public.is_org_member(auth.uid(), projects.organisation_id))
        )
    )
  );

CREATE POLICY "Members can update piles in their orgs"
  ON public.piles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pages
      JOIN public.projects ON projects.id = pages.project_id
      WHERE pages.id = piles.page_id
        AND (
          (projects.organisation_id IS NULL AND projects.user_id = auth.uid())
          OR
          (projects.organisation_id IS NOT NULL AND public.is_org_member(auth.uid(), projects.organisation_id))
        )
    )
  );

CREATE POLICY "Members can delete piles in their orgs"
  ON public.piles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pages
      JOIN public.projects ON projects.id = pages.project_id
      WHERE pages.id = piles.page_id
        AND (
          (projects.organisation_id IS NULL AND projects.user_id = auth.uid())
          OR
          (projects.organisation_id IS NOT NULL AND public.is_org_member(auth.uid(), projects.organisation_id))
        )
    )
  );

-- Drop old policies on footings
DROP POLICY IF EXISTS "Users can view footings of own projects" ON public.footings;
DROP POLICY IF EXISTS "Users can create footings for own projects" ON public.footings;
DROP POLICY IF EXISTS "Users can update footings of own projects" ON public.footings;
DROP POLICY IF EXISTS "Users can delete footings of own projects" ON public.footings;

-- Create new org-aware policies for footings
CREATE POLICY "Users can view footings in their orgs"
  ON public.footings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pages
      JOIN public.projects ON projects.id = pages.project_id
      WHERE pages.id = footings.page_id
        AND (
          (projects.organisation_id IS NULL AND projects.user_id = auth.uid())
          OR
          (projects.organisation_id IS NOT NULL AND public.is_org_member(auth.uid(), projects.organisation_id))
        )
    )
  );

CREATE POLICY "Members can create footings in their orgs"
  ON public.footings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pages
      JOIN public.projects ON projects.id = pages.project_id
      WHERE pages.id = footings.page_id
        AND (
          (projects.organisation_id IS NULL AND projects.user_id = auth.uid())
          OR
          (projects.organisation_id IS NOT NULL AND public.is_org_member(auth.uid(), projects.organisation_id))
        )
    )
  );

CREATE POLICY "Members can update footings in their orgs"
  ON public.footings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pages
      JOIN public.projects ON projects.id = pages.project_id
      WHERE pages.id = footings.page_id
        AND (
          (projects.organisation_id IS NULL AND projects.user_id = auth.uid())
          OR
          (projects.organisation_id IS NOT NULL AND public.is_org_member(auth.uid(), projects.organisation_id))
        )
    )
  );

CREATE POLICY "Members can delete footings in their orgs"
  ON public.footings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pages
      JOIN public.projects ON projects.id = pages.project_id
      WHERE pages.id = footings.page_id
        AND (
          (projects.organisation_id IS NULL AND projects.user_id = auth.uid())
          OR
          (projects.organisation_id IS NOT NULL AND public.is_org_member(auth.uid(), projects.organisation_id))
        )
    )
  );