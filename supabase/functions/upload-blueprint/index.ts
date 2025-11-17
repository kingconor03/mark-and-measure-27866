import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_FILE_SIZE = 52428800; // 50MB in bytes
const MAX_PAGE_COUNT = 500;

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
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate Content-Type
    const contentType = req.headers.get('Content-Type');
    if (!contentType?.includes('multipart/form-data')) {
      return new Response(
        JSON.stringify({ error: 'Invalid content type. Expected multipart/form-data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const projectId = formData.get('projectId') as string;
    const fileName = formData.get('fileName') as string;

    if (!file || !projectId || !fileName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: file, projectId, or fileName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ error: `File size exceeds maximum allowed size of 50MB` }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return new Response(
        JSON.stringify({ error: 'Invalid file type. Only PDF files are allowed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Read file buffer for validation
    const fileBuffer = await file.arrayBuffer();
    
    // Validate PDF magic bytes
    const header = new Uint8Array(fileBuffer.slice(0, 5));
    const isPDF = 
      header[0] === 0x25 && // %
      header[1] === 0x50 && // P
      header[2] === 0x44 && // D
      header[3] === 0x46 && // F
      header[4] === 0x2D;   // -

    if (!isPDF) {
      return new Response(
        JSON.stringify({ error: 'Invalid PDF file format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify project ownership and get organisation_id
    const { data: project, error: projectError } = await supabaseClient
      .from('projects')
      .select('user_id, organisation_id')
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

    // Determine bucket and path based on org or legacy structure
    let bucket: string;
    let installationPath: string;
    let markupPath: string;
    
    if (project.organisation_id) {
      // Multi-tenant: org-assets bucket with org-{id} prefix
      bucket = 'org-assets';
      // Save original in installation_details folder
      installationPath = `org-${project.organisation_id}/projects/${projectId}/installation_details/${fileName}`;
      // Save markup copy in markup folder
      const markupFileName = fileName.replace(/\.pdf$/i, '_markup.pdf');
      markupPath = `org-${project.organisation_id}/projects/${projectId}/markup/${markupFileName}`;
    } else {
      // Legacy: blueprints bucket with user_id prefix
      bucket = 'blueprints';
      // Save original in installation_details folder
      installationPath = `${user.id}/${projectId}/installation_details/${fileName}`;
      // Save markup copy in markup folder
      const markupFileName = fileName.replace(/\.pdf$/i, '_markup.pdf');
      markupPath = `${user.id}/${projectId}/markup/${markupFileName}`;
    }
    
    // Upload original PDF to installation_details folder
    const { data: installationUploadData, error: installationUploadError } = await supabaseClient
      .storage
      .from(bucket)
      .upload(installationPath, fileBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (installationUploadError) {
      console.error('Error uploading installation file:', installationUploadError);
      throw installationUploadError;
    }

    // Upload markup copy to markup folder
    const { data: markupUploadData, error: markupUploadError } = await supabaseClient
      .storage
      .from(bucket)
      .upload(markupPath, fileBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (markupUploadError) {
      console.error('Error uploading markup file:', markupUploadError);
      // If markup upload fails, continue anyway - original is saved
      console.warn('Markup file upload failed, but original file was saved successfully');
    }

    // Return the installation path (original file)
    const pdfPath = installationUploadData.path;

    console.log(`Successfully uploaded PDF for project ${projectId} to ${pdfPath}`);
    if (markupUploadData) {
      console.log(`Successfully uploaded markup copy to ${markupUploadData.path}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        path: pdfPath,
        markupPath: markupUploadData?.path || null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in upload-blueprint function:', error);
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
