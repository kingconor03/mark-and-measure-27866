-- Add missing UPDATE policy for blueprints bucket
CREATE POLICY "Users can update own blueprints"
ON storage.objects FOR UPDATE
TO public
USING (
  bucket_id = 'blueprints' 
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'blueprints' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Add UPDATE policy for org-assets bucket
CREATE POLICY "Members can update their org folder"
ON storage.objects FOR UPDATE
TO public
USING (
  bucket_id = 'org-assets' 
  AND EXISTS (
    SELECT 1 FROM organisation_members
    WHERE organisation_members.user_id = auth.uid()
    AND (storage.foldername(objects.name))[1] = concat('org-', organisation_members.organisation_id::text)
  )
)
WITH CHECK (
  bucket_id = 'org-assets' 
  AND EXISTS (
    SELECT 1 FROM organisation_members
    WHERE organisation_members.user_id = auth.uid()
    AND (storage.foldername(objects.name))[1] = concat('org-', organisation_members.organisation_id::text)
  )
);