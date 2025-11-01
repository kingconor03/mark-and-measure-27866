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

    const url = new URL(req.url);
    const orgId = url.searchParams.get('orgId');

    if (!orgId) {
      throw new Error('orgId is required');
    }

    // Verify caller is admin in the org
    const { data: callerMembership } = await supabase
      .from('organisation_members')
      .select('role')
      .eq('organisation_id', orgId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!callerMembership || callerMembership.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Only admins can list members' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all members with their profile info
    const { data: members, error } = await supabase
      .from('organisation_members')
      .select('id, user_id, role, created_at, profiles(email)')
      .eq('organisation_id', orgId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    console.log(`Listed ${members?.length || 0} members for org ${orgId}`);

    return new Response(
      JSON.stringify(members),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error listing members:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
