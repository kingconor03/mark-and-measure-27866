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

    const { orgId, email, role = 'viewer' } = await req.json();

    if (!orgId || !email) {
      throw new Error('orgId and email are required');
    }

    if (!['admin', 'member', 'viewer'].includes(role)) {
      throw new Error('Invalid role');
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
        JSON.stringify({ error: 'Forbidden: Only admins can invite members' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingProfile) {
      // User exists, check if already a member
      const { data: existingMember } = await supabase
        .from('organisation_members')
        .select('id')
        .eq('organisation_id', orgId)
        .eq('user_id', existingProfile.id)
        .maybeSingle();

      if (existingMember) {
        return new Response(
          JSON.stringify({ error: 'User is already a member of this organization' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Add existing user to org
      const { error: insertError } = await supabase
        .from('organisation_members')
        .insert({
          organisation_id: orgId,
          user_id: existingProfile.id,
          role
        });

      if (insertError) throw insertError;

      console.log(`Added existing user ${email} to org ${orgId} as ${role}`);

      return new Response(
        JSON.stringify({ success: true, message: 'User added to organization' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // User doesn't exist, create magic link invitation
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: `${Deno.env.get('SUPABASE_URL')}/dashboard`
      }
    });

    if (inviteError) throw inviteError;

    // Add the user to the org once they're created
    if (inviteData?.user?.id) {
      const { error: insertError } = await supabase
        .from('organisation_members')
        .insert({
          organisation_id: orgId,
          user_id: inviteData.user.id,
          role
        });

      if (insertError) {
        console.error('Error adding invited user to org:', insertError);
      }
    }

    console.log(`Sent invitation to ${email} for org ${orgId} as ${role}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Invitation sent',
        magicLink: inviteData.properties?.action_link 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error inviting member:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
