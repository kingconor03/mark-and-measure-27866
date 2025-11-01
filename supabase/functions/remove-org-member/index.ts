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

    const { orgId, targetUserId } = await req.json();

    if (!orgId || !targetUserId) {
      throw new Error('orgId and targetUserId are required');
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
        JSON.stringify({ error: 'Forbidden: Only admins can remove members' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prevent self-removal
    if (user.id === targetUserId) {
      return new Response(
        JSON.stringify({ error: 'You cannot remove yourself from the organization' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete member (trigger will prevent last admin removal)
    const { error } = await supabase
      .from('organisation_members')
      .delete()
      .eq('organisation_id', orgId)
      .eq('user_id', targetUserId);

    if (error) {
      console.error('Error removing member:', error);
      throw error;
    }

    console.log(`Removed user ${targetUserId} from org ${orgId}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error removing member:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
