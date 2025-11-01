-- Fix infinite recursion in platform_admins by creating a security definer function
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins
    WHERE user_id = _user_id
  )
$$;

-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Only platform admins can manage platform admins" ON public.platform_admins;

-- Create new non-recursive policy for platform_admins management
CREATE POLICY "Platform admins can manage platform admins"
ON public.platform_admins
FOR ALL
USING (public.is_platform_admin(auth.uid()));

-- Add INSERT policy for organisations table
CREATE POLICY "Authenticated users can create organisations"
ON public.organisations
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Add UPDATE policy for organisations (admins only)
CREATE POLICY "Admins can update their organisations"
ON public.organisations
FOR UPDATE
USING (is_org_member(auth.uid(), id));

-- Add DELETE policy for organisations (admins only)
CREATE POLICY "Admins can delete their organisations"
ON public.organisations
FOR DELETE
USING (has_role_in_org(auth.uid(), id, 'admin'));