-- Create platform_admins table
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- RLS policies for platform_admins
CREATE POLICY "Users can view their own platform admin status"
ON public.platform_admins
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Only platform admins can manage platform admins"
ON public.platform_admins
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = auth.uid()
  )
);

-- Seed Blade Pile organization
INSERT INTO public.organisations (name, primary_domain, domains)
VALUES ('Blade Pile', 'bladepile.com.au', ARRAY['bladepile.com.au'])
ON CONFLICT (primary_domain) DO NOTHING;

-- Note: Platform admin user will need to be added manually with their actual user_id after first sign-up
-- Example for reference:
-- INSERT INTO public.platform_admins(user_id) 
-- VALUES ('YOUR_USER_UUID_HERE') 
-- ON CONFLICT DO NOTHING;