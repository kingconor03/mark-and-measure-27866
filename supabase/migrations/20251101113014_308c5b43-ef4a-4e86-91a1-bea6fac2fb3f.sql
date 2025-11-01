-- Add platform admin policies for cross-org access to requests

-- Platform admins can view all quote requests
CREATE POLICY "Platform admins can view all quote requests"
ON public.quote_requests
FOR SELECT
TO authenticated
USING (is_platform_admin(auth.uid()));

-- Platform admins can update all quote requests
CREATE POLICY "Platform admins can update all quote requests"
ON public.quote_requests
FOR UPDATE
TO authenticated
USING (is_platform_admin(auth.uid()));

-- Platform admins can view all certification requests
CREATE POLICY "Platform admins can view all cert requests"
ON public.certification_requests
FOR SELECT
TO authenticated
USING (is_platform_admin(auth.uid()));

-- Platform admins can update all certification requests
CREATE POLICY "Platform admins can update all cert requests"
ON public.certification_requests
FOR UPDATE
TO authenticated
USING (is_platform_admin(auth.uid()));

-- Platform admins can view all quote request files
CREATE POLICY "Platform admins can view all quote files"
ON public.quote_request_files
FOR SELECT
TO authenticated
USING (is_platform_admin(auth.uid()));

-- Platform admins can view all certification files
CREATE POLICY "Platform admins can view all cert files"
ON public.certification_files
FOR SELECT
TO authenticated
USING (is_platform_admin(auth.uid()));