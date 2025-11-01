-- Add policy to allow users to add themselves as the first member when creating an org
CREATE POLICY "Users can add themselves as first member"
ON public.organisation_members
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND NOT EXISTS (
    SELECT 1 
    FROM public.organisation_members 
    WHERE organisation_id = organisation_members.organisation_id
  )
);