
-- Migration: 20251016000843
-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'processing',
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects"
  ON public.projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own projects"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
  ON public.projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
  ON public.projects FOR DELETE
  USING (auth.uid() = user_id);

-- Create pages table (for multi-page PDFs)
CREATE TABLE public.pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  page_number INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pages of own projects"
  ON public.pages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = pages.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create pages for own projects"
  ON public.pages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = pages.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Create piles table
CREATE TABLE public.piles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID REFERENCES public.pages(id) ON DELETE CASCADE NOT NULL,
  pile_type TEXT NOT NULL,
  blade_size TEXT NOT NULL,
  length TEXT NOT NULL,
  extension TEXT,
  position_x FLOAT NOT NULL,
  position_y FLOAT NOT NULL,
  is_custom BOOLEAN DEFAULT FALSE,
  radius FLOAT,
  number INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.piles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view piles of own projects"
  ON public.piles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pages
      JOIN public.projects ON projects.id = pages.project_id
      WHERE pages.id = piles.page_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create piles for own projects"
  ON public.piles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pages
      JOIN public.projects ON projects.id = pages.project_id
      WHERE pages.id = piles.page_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update piles of own projects"
  ON public.piles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.pages
      JOIN public.projects ON projects.id = pages.project_id
      WHERE pages.id = piles.page_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete piles of own projects"
  ON public.piles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.pages
      JOIN public.projects ON projects.id = pages.project_id
      WHERE pages.id = piles.page_id
      AND projects.user_id = auth.uid()
    )
  );

-- Create footings table
CREATE TABLE public.footings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID REFERENCES public.pages(id) ON DELETE CASCADE NOT NULL,
  footing_type TEXT NOT NULL,
  shape TEXT NOT NULL,
  coordinates JSONB NOT NULL,
  width TEXT,
  depth TEXT,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.footings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view footings of own projects"
  ON public.footings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pages
      JOIN public.projects ON projects.id = pages.project_id
      WHERE pages.id = footings.page_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create footings for own projects"
  ON public.footings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pages
      JOIN public.projects ON projects.id = pages.project_id
      WHERE pages.id = footings.page_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update footings of own projects"
  ON public.footings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.pages
      JOIN public.projects ON projects.id = pages.project_id
      WHERE pages.id = footings.page_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete footings of own projects"
  ON public.footings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.pages
      JOIN public.projects ON projects.id = pages.project_id
      WHERE pages.id = footings.page_id
      AND projects.user_id = auth.uid()
    )
  );

-- Create storage bucket for blueprints
INSERT INTO storage.buckets (id, name, public) VALUES ('blueprints', 'blueprints', false);

-- Storage policies for blueprints bucket
CREATE POLICY "Users can view own blueprints"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'blueprints' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can upload own blueprints"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'blueprints' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own blueprints"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'blueprints' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to update updated_at on projects
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Migration: 20251016000908
-- Fix security warning: set search_path on update_updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Migration: 20251016014633
-- Make blueprints bucket public so PDFs can be loaded
UPDATE storage.buckets 
SET public = true 
WHERE id = 'blueprints';

-- Migration: 20251017130717
-- Add color column to piles table for custom pile colors
ALTER TABLE public.piles 
ADD COLUMN color text;

-- Migration: 20251019015911
-- Add minimum depth and minimum torque fields to piles table
ALTER TABLE public.piles
ADD COLUMN IF NOT EXISTS min_depth text,
ADD COLUMN IF NOT EXISTS min_torque text;

-- Add color field to footings table if it doesn't exist already
-- (This ensures footings can have their own colors like piles);

-- Migration: 20251019020453
-- Ensure width and depth columns exist for footings (they may already exist)
-- These are already in the schema but let's make sure they're accessible
COMMENT ON COLUMN public.footings.width IS 'Width measurement for strip footings';
COMMENT ON COLUMN public.footings.depth IS 'Depth measurement for strip footings';

-- Migration: 20251019022205
-- Create user preferences table for floating summary customization
CREATE TABLE public.floating_summary_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  scale numeric NOT NULL DEFAULT 1.0,
  text_size numeric NOT NULL DEFAULT 0.875,
  key_size numeric NOT NULL DEFAULT 0.75,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.floating_summary_preferences ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own preferences" 
ON public.floating_summary_preferences 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences" 
ON public.floating_summary_preferences 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences" 
ON public.floating_summary_preferences 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_floating_summary_preferences_updated_at
BEFORE UPDATE ON public.floating_summary_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Migration: 20251019071112
-- Add heading_size column to floating_summary_preferences table
ALTER TABLE floating_summary_preferences 
ADD COLUMN IF NOT EXISTS heading_size numeric NOT NULL DEFAULT 1.0;

-- Migration: 20251021202140
-- Add missing RLS policies for pages table
CREATE POLICY "Users can update pages of own projects"
ON pages FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = pages.project_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete pages of own projects"
ON pages FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = pages.project_id
    AND projects.user_id = auth.uid()
  )
);

-- Make blueprints storage bucket private and set file size limit
UPDATE storage.buckets
SET public = false,
    file_size_limit = 52428800
WHERE name = 'blueprints';
