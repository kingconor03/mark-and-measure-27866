import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1';

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

    // Validate projectId format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!projectId || typeof projectId !== 'string' || !uuidRegex.test(projectId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid project ID format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing PDF for project ${projectId}`);

    // Verify the project belongs to the authenticated user and get the trusted PDF path
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
        JSON.stringify({ error: 'No PDF associated with this project' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine bucket and path based on org or legacy structure
    let bucket: string;
    let pdfPath: string;
    
    if (project.organisation_id) {
      // Multi-tenant: org-assets bucket with org-{id} prefix
      bucket = 'org-assets';
      const urlMatch = project.pdf_url.match(/org-assets\/(.+)/);
      if (!urlMatch) {
        return new Response(
          JSON.stringify({ error: 'Invalid PDF URL format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      pdfPath = urlMatch[1];
      
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
      pdfPath = project.pdf_url.split('/blueprints/')[1];
      
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

    console.log(`Using trusted PDF path: ${pdfPath} from bucket: ${bucket}`);

    // Download PDF from storage
    const { data: pdfData, error: downloadError } = await supabaseClient
      .storage
      .from(bucket)
      .download(pdfPath);

    if (downloadError) {
      console.error('Error downloading PDF:', downloadError);
      throw downloadError;
    }

    // Load PDF and validate it
    const pdfBuffer = await pdfData.arrayBuffer();
    
    // Validate PDF magic bytes
    const header = new Uint8Array(pdfBuffer.slice(0, 5));
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

    let pdfDoc;
    let pageCount;
    
    try {
      pdfDoc = await PDFDocument.load(pdfBuffer);
      pageCount = pdfDoc.getPageCount();
      
      // Validate page count
      if (pageCount > 500) {
        return new Response(
          JSON.stringify({ error: 'PDF has too many pages (maximum 500 allowed)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`PDF has ${pageCount} pages`);
    } catch (error) {
      console.error('PDF validation failed:', error);
      return new Response(
        JSON.stringify({ error: 'Invalid or corrupted PDF file' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get the storage path for the PDF
    const storagePath = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/${bucket}/${pdfPath}`;

    // Create page records for each page in the PDF
    const pageRecords = [];
    for (let i = 1; i <= pageCount; i++) {
      pageRecords.push({
        project_id: projectId,
        page_number: i,
        image_url: storagePath
      });
    }

    const { error: insertError } = await supabaseClient
      .from('pages')
      .insert(pageRecords);

    if (insertError) {
      console.error('Error inserting pages:', insertError);
      throw insertError;
    }

    // Create asset record for the PDF
    if (project.organisation_id) {
      const { error: assetError } = await supabaseClient
        .from('project_assets')
        .insert({
          project_id: projectId,
          kind: 'pdf',
          path: pdfPath,
          meta: { page_count: pageCount }
        });

      if (assetError) {
        console.error('Error creating asset record:', assetError);
      }
    }

    // Update project status
    const { error: updateError } = await supabaseClient
      .from('projects')
      .update({ status: 'completed' })
      .eq('id', projectId);

    if (updateError) {
      console.error('Error updating project:', updateError);
      throw updateError;
    }

    console.log(`Successfully processed PDF for project ${projectId} with ${pageCount} pages`);

    return new Response(
      JSON.stringify({ success: true, pageCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-pdf function:', error);
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
