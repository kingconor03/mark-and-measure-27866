-- Add document_type column to project_assets to organize files into folders
ALTER TABLE project_assets
  ADD COLUMN IF NOT EXISTS document_type TEXT;

-- Create index for faster folder queries
CREATE INDEX IF NOT EXISTS idx_project_assets_document_type 
  ON project_assets(project_id, document_type);

-- Update existing records to set document_type from meta if available
UPDATE project_assets
SET document_type = meta->>'docType'
WHERE document_type IS NULL AND meta->>'docType' IS NOT NULL;



