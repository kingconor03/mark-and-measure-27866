-- Phase 2: Data Model Extension for Quote & Certification Workflows

-- Create enums for new tables
CREATE TYPE public.asset_kind AS ENUM ('pdf', 'page_image', 'other');
CREATE TYPE public.annotation_type AS ENUM ('pile', 'footing');
CREATE TYPE public.quote_status AS ENUM ('new', 'awaiting_docs', 'in_progress', 'completed', 'rejected');
CREATE TYPE public.certification_status AS ENUM ('new', 'awaiting_docs', 'in_progress', 'approved', 'rejected');
CREATE TYPE public.quote_folder AS ENUM ('soil_report', 'architectural', 'engineering', 'other');
CREATE TYPE public.cert_folder AS ENUM ('install_report', 'latest_plans', 'soil_report', 'architectural', 'engineering', 'other');
CREATE TYPE public.notification_type AS ENUM ('quote_status_change', 'cert_status_change', 'org_invite', 'role_change', 'other');

-- Project Assets table
CREATE TABLE public.project_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  kind public.asset_kind NOT NULL,
  path TEXT NOT NULL,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_assets_project_id ON public.project_assets(project_id);
CREATE INDEX idx_project_assets_kind ON public.project_assets(kind);

-- Annotations table (replaces piles/footings for multi-tenant)
CREATE TABLE public.annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  page_index INTEGER NOT NULL,
  type public.annotation_type NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_annotations_project_id ON public.annotations(project_id);
CREATE INDEX idx_annotations_page_index ON public.annotations(page_index);
CREATE INDEX idx_annotations_type ON public.annotations(type);

-- Quote Requests table
CREATE TABLE public.quote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  status public.quote_status NOT NULL DEFAULT 'new',
  notes TEXT,
  admin_notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quote_requests_org_id ON public.quote_requests(organisation_id);
CREATE INDEX idx_quote_requests_status ON public.quote_requests(status);
CREATE INDEX idx_quote_requests_created_by ON public.quote_requests(created_by);

-- Quote Request Files table
CREATE TABLE public.quote_request_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id UUID NOT NULL REFERENCES public.quote_requests(id) ON DELETE CASCADE,
  folder public.quote_folder NOT NULL,
  path TEXT NOT NULL,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quote_files_request_id ON public.quote_request_files(quote_request_id);
CREATE INDEX idx_quote_files_folder ON public.quote_request_files(folder);

-- Certification Requests table
CREATE TABLE public.certification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status public.certification_status NOT NULL DEFAULT 'new',
  notes TEXT,
  admin_notes TEXT,
  result_files JSONB DEFAULT '[]'::jsonb,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cert_requests_org_id ON public.certification_requests(organisation_id);
CREATE INDEX idx_cert_requests_status ON public.certification_requests(status);
CREATE INDEX idx_cert_requests_project_id ON public.certification_requests(project_id);

-- Certification Files table
CREATE TABLE public.certification_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certification_request_id UUID NOT NULL REFERENCES public.certification_requests(id) ON DELETE CASCADE,
  folder public.cert_folder NOT NULL,
  path TEXT NOT NULL,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cert_files_request_id ON public.certification_files(certification_request_id);
CREATE INDEX idx_cert_files_folder ON public.certification_files(folder);

-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  to_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_org_id ON public.notifications(organisation_id);
CREATE INDEX idx_notifications_user_id ON public.notifications(to_user_id);
CREATE INDEX idx_notifications_read ON public.notifications(read_at);

-- Enable RLS on all new tables
ALTER TABLE public.project_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_request_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certification_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_assets
CREATE POLICY "Users can view assets in their org projects"
  ON public.project_assets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_assets.project_id
        AND (
          (projects.organisation_id IS NULL AND projects.user_id = auth.uid())
          OR (projects.organisation_id IS NOT NULL AND is_org_member(auth.uid(), projects.organisation_id))
        )
    )
  );

CREATE POLICY "Members can create assets in their org projects"
  ON public.project_assets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_assets.project_id
        AND (
          (projects.organisation_id IS NULL AND projects.user_id = auth.uid())
          OR (projects.organisation_id IS NOT NULL AND is_org_member(auth.uid(), projects.organisation_id))
        )
    )
  );

CREATE POLICY "Members can delete assets in their org projects"
  ON public.project_assets FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_assets.project_id
        AND (
          (projects.organisation_id IS NULL AND projects.user_id = auth.uid())
          OR (projects.organisation_id IS NOT NULL AND is_org_member(auth.uid(), projects.organisation_id))
        )
    )
  );

-- RLS Policies for annotations
CREATE POLICY "Users can view annotations in their org projects"
  ON public.annotations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = annotations.project_id
        AND (
          (projects.organisation_id IS NULL AND projects.user_id = auth.uid())
          OR (projects.organisation_id IS NOT NULL AND is_org_member(auth.uid(), projects.organisation_id))
        )
    )
  );

CREATE POLICY "Members can create annotations in their org projects"
  ON public.annotations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = annotations.project_id
        AND (
          (projects.organisation_id IS NULL AND projects.user_id = auth.uid())
          OR (projects.organisation_id IS NOT NULL AND is_org_member(auth.uid(), projects.organisation_id))
        )
    )
  );

CREATE POLICY "Members can update annotations in their org projects"
  ON public.annotations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = annotations.project_id
        AND (
          (projects.organisation_id IS NULL AND projects.user_id = auth.uid())
          OR (projects.organisation_id IS NOT NULL AND is_org_member(auth.uid(), projects.organisation_id))
        )
    )
  );

CREATE POLICY "Members can delete annotations in their org projects"
  ON public.annotations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = annotations.project_id
        AND (
          (projects.organisation_id IS NULL AND projects.user_id = auth.uid())
          OR (projects.organisation_id IS NOT NULL AND is_org_member(auth.uid(), projects.organisation_id))
        )
    )
  );

-- RLS Policies for quote_requests
CREATE POLICY "Users can view quote requests in their org"
  ON public.quote_requests FOR SELECT
  USING (is_org_member(auth.uid(), organisation_id));

CREATE POLICY "Members can create quote requests in their org"
  ON public.quote_requests FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), organisation_id) AND auth.uid() = created_by);

CREATE POLICY "Admins can update quote requests in their org"
  ON public.quote_requests FOR UPDATE
  USING (has_role_in_org(auth.uid(), organisation_id, 'admin'));

-- RLS Policies for quote_request_files
CREATE POLICY "Users can view quote files in their org"
  ON public.quote_request_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quote_requests
      WHERE quote_requests.id = quote_request_files.quote_request_id
        AND is_org_member(auth.uid(), quote_requests.organisation_id)
    )
  );

CREATE POLICY "Members can upload quote files"
  ON public.quote_request_files FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quote_requests
      WHERE quote_requests.id = quote_request_files.quote_request_id
        AND is_org_member(auth.uid(), quote_requests.organisation_id)
    )
  );

-- RLS Policies for certification_requests
CREATE POLICY "Users can view cert requests in their org"
  ON public.certification_requests FOR SELECT
  USING (is_org_member(auth.uid(), organisation_id));

CREATE POLICY "Members can create cert requests in their org"
  ON public.certification_requests FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), organisation_id) AND auth.uid() = created_by);

CREATE POLICY "Admins can update cert requests in their org"
  ON public.certification_requests FOR UPDATE
  USING (has_role_in_org(auth.uid(), organisation_id, 'admin'));

-- RLS Policies for certification_files
CREATE POLICY "Users can view cert files in their org"
  ON public.certification_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.certification_requests
      WHERE certification_requests.id = certification_files.certification_request_id
        AND is_org_member(auth.uid(), certification_requests.organisation_id)
    )
  );

CREATE POLICY "Members can upload cert files"
  ON public.certification_files FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.certification_requests
      WHERE certification_requests.id = certification_files.certification_request_id
        AND is_org_member(auth.uid(), certification_requests.organisation_id)
    )
  );

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (
    (to_user_id IS NULL AND is_org_member(auth.uid(), organisation_id))
    OR to_user_id = auth.uid()
  );

CREATE POLICY "Users can mark their notifications as read"
  ON public.notifications FOR UPDATE
  USING (to_user_id = auth.uid());

CREATE POLICY "Admins can create notifications in their org"
  ON public.notifications FOR INSERT
  WITH CHECK (has_role_in_org(auth.uid(), organisation_id, 'admin'));

-- Triggers for updated_at
CREATE TRIGGER update_annotations_updated_at
  BEFORE UPDATE ON public.annotations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_quote_requests_updated_at
  BEFORE UPDATE ON public.quote_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_certification_requests_updated_at
  BEFORE UPDATE ON public.certification_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Storage buckets for org-scoped storage
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('org-assets', 'org-assets', false),
  ('quote-files', 'quote-files', false),
  ('cert-files', 'cert-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for org-assets bucket
CREATE POLICY "Users can view assets in their org"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'org-assets' AND
    EXISTS (
      SELECT 1 FROM public.organisation_members
      WHERE organisation_members.user_id = auth.uid()
        AND (storage.foldername(name))[1] = CONCAT('org-', organisation_members.organisation_id::text)
    )
  );

CREATE POLICY "Members can upload to their org folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'org-assets' AND
    EXISTS (
      SELECT 1 FROM public.organisation_members
      WHERE organisation_members.user_id = auth.uid()
        AND (storage.foldername(name))[1] = CONCAT('org-', organisation_members.organisation_id::text)
    )
  );

CREATE POLICY "Members can delete from their org folder"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'org-assets' AND
    EXISTS (
      SELECT 1 FROM public.organisation_members
      WHERE organisation_members.user_id = auth.uid()
        AND (storage.foldername(name))[1] = CONCAT('org-', organisation_members.organisation_id::text)
    )
  );

-- Storage policies for quote-files bucket
CREATE POLICY "Users can view quote files in their org"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'quote-files' AND
    EXISTS (
      SELECT 1 FROM public.organisation_members
      WHERE organisation_members.user_id = auth.uid()
        AND (storage.foldername(name))[1] = CONCAT('org-', organisation_members.organisation_id::text)
    )
  );

CREATE POLICY "Members can upload quote files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'quote-files' AND
    EXISTS (
      SELECT 1 FROM public.organisation_members
      WHERE organisation_members.user_id = auth.uid()
        AND (storage.foldername(name))[1] = CONCAT('org-', organisation_members.organisation_id::text)
    )
  );

-- Storage policies for cert-files bucket
CREATE POLICY "Users can view cert files in their org"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'cert-files' AND
    EXISTS (
      SELECT 1 FROM public.organisation_members
      WHERE organisation_members.user_id = auth.uid()
        AND (storage.foldername(name))[1] = CONCAT('org-', organisation_members.organisation_id::text)
    )
  );

CREATE POLICY "Members can upload cert files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'cert-files' AND
    EXISTS (
      SELECT 1 FROM public.organisation_members
      WHERE organisation_members.user_id = auth.uid()
        AND (storage.foldername(name))[1] = CONCAT('org-', organisation_members.organisation_id::text)
    )
  );