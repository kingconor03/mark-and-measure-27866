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

    const { orgId, targetUserId, role } = await req.json();

    if (!orgId || !targetUserId || !role) {
      throw new Error('orgId, targetUserId, and role are required');
    }

    if (!['admin', 'member'].includes(role)) {
      throw new Error('Invalid role: only admin or member allowed');
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
        JSON.stringify({ error: 'Forbidden: Only admins can change roles' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prevent caller from demoting themselves if they're the last admin
    if (user.id === targetUserId && role !== 'admin') {
      const { data: adminCountData } = await supabase.rpc('admin_count', { p_org: orgId });
      const adminCount = adminCountData ?? 0;
      
      if (adminCount <= 1) {
        return new Response(
          JSON.stringify({ error: 'You are the last admin and cannot demote yourself' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Update the role (trigger will prevent last admin demotion)
    const { error } = await supabase
      .from('organisation_members')
      .update({ role })
      .eq('organisation_id', orgId)
      .eq('user_id', targetUserId);

    if (error) {
      console.error('Error updating role:', error);
      throw error;
    }

    console.log(`Updated role for user ${targetUserId} to ${role} in org ${orgId}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error updating member role:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
