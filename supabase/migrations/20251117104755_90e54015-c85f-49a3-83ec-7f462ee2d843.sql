-- Add missing columns to project_assets table
ALTER TABLE public.project_assets 
ADD COLUMN IF NOT EXISTS document_type TEXT,
ADD COLUMN IF NOT EXISTS page_number INTEGER;

-- Add index for efficient querying by document_type
CREATE INDEX IF NOT EXISTS idx_project_assets_document_type ON public.project_assets(document_type);

-- Add index for efficient querying by page_number
CREATE INDEX IF NOT EXISTS idx_project_assets_page_number ON public.project_assets(page_number);

-- Add missing column to projects table for storing selected page IDs
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS selected_page_ids UUID[];