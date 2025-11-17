import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseClient.auth.getUser(token);

    if (!user) {
      throw new Error('Unauthorized');
    }

    const { projectId } = await req.json();

    if (!projectId || typeof projectId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid project ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the project belongs to the authenticated user and get the PDF URL
    const { data: project, error: projectError } = await supabaseClient
      .from('projects')
      .select('user_id, pdf_url, organisation_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return new Response(
        JSON.stringify({ error: 'Project not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check authorization: legacy user-owned or org member
    let isAuthorized = false;
    if (project.organisation_id) {
      // Multi-tenant: check org membership
      const { data: membership } = await supabaseClient
        .from('organisation_members')
        .select('id')
        .eq('organisation_id', project.organisation_id)
        .eq('user_id', user.id)
        .maybeSingle();
      
      isAuthorized = !!membership;
    } else {
      // Legacy: check direct ownership
      isAuthorized = project.user_id === user.id;
    }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Project does not belong to user or their organization' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!project.pdf_url) {
      return new Response(
        JSON.stringify({ error: 'No PDF associated with project' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine bucket and path based on org or legacy structure
    let bucket: string;
    let pdfPath: string;
    
    if (project.organisation_id) {
      // Multi-tenant: org-assets bucket with org-{id} prefix
      bucket = 'org-assets';
      // pdf_url could be either "org-assets/path" or full URL
      if (project.pdf_url.startsWith('org-assets/')) {
        pdfPath = project.pdf_url.replace('org-assets/', '');
      } else {
        const urlMatch = project.pdf_url.match(/org-assets\/(.+)/);
        if (!urlMatch) {
          return new Response(
            JSON.stringify({ error: 'Invalid PDF URL format for organization project' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        pdfPath = urlMatch[1];
      }
      
      // Validate org-scoped path
      const expectedPrefix = `org-${project.organisation_id}/projects/${projectId}/`;
      if (!pdfPath.startsWith(expectedPrefix)) {
        return new Response(
          JSON.stringify({ error: 'Invalid PDF path for this organization and project' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Legacy: blueprints bucket with user_id prefix
      bucket = 'blueprints';
      const urlParts = project.pdf_url.split('/blueprints/');
      if (urlParts.length !== 2) {
        return new Response(
          JSON.stringify({ error: 'Invalid PDF URL format for legacy project' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      pdfPath = urlParts[1];
      
      const expectedPrefix = `${user.id}/${projectId}/`;
      if (!pdfPath.startsWith(expectedPrefix)) {
        return new Response(
          JSON.stringify({ error: 'Invalid PDF path for this user and project' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // Additional path validation to prevent traversal
    if (pdfPath.includes('..') || pdfPath.includes('//')) {
      return new Response(
        JSON.stringify({ error: 'Invalid path detected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate a signed URL valid for 1 hour
    const { data: signedUrlData, error: signedUrlError } = await supabaseClient
      .storage
      .from(bucket)
      .createSignedUrl(pdfPath, 3600);

    if (signedUrlError) {
      console.error('Error creating signed URL:', signedUrlError);
      throw signedUrlError;
    }

    return new Response(
      JSON.stringify({ signedUrl: signedUrlData.signedUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-blueprint-url function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
