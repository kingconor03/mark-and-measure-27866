import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Verify caller is platform admin
    const { data: isPlatformAdmin } = await supabase
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!isPlatformAdmin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Only platform admins can process quote requests' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { requestId, status, adminNotes, note } = await req.json();

    if (!requestId || !status) {
      throw new Error('requestId and status are required');
    }

    const updates: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (adminNotes !== undefined) {
      updates.admin_notes = adminNotes;
    }

    // Add note to notes array if provided
    if (note) {
      const { data: currentRequest } = await supabase
        .from('quote_requests')
        .select('notes')
        .eq('id', requestId)
        .single();

      const existingNotes = currentRequest?.notes || [];
      updates.notes = [
        ...existingNotes,
        {
          text: note,
          created_by: user.id,
          created_at: new Date().toISOString()
        }
      ];
    }

    const { data, error } = await supabase
      .from('quote_requests')
      .update(updates)
      .eq('id', requestId)
      .select()
      .single();

    if (error) throw error;

    console.log(`Updated quote request ${requestId} to status: ${status}`);

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing quote request:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
