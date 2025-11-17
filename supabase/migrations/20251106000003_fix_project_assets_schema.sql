-- Fix project_assets schema to match code expectations
-- This ensures document_type column exists and has proper index

ALTER TABLE public.project_assets
  ADD COLUMN IF NOT EXISTS document_type TEXT;

-- Create index for faster folder queries if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_project_assets_document_type 
  ON public.project_assets(project_id, document_type);

-- Update existing records without document_type to have a default
UPDATE public.project_assets
SET document_type = CASE
  WHEN kind = 'page_image' THEN 'markup'
  WHEN meta->>'isMarkupSource' = 'true' THEN 'markup'
  WHEN meta->>'docType' IS NOT NULL THEN meta->>'docType'
  ELSE 'installation_details'
END
WHERE document_type IS NULL;

