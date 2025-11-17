import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify platform admin
    const { data: adminCheck } = await supabase
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .single();

    if (!adminCheck) {
      return new Response(JSON.stringify({ error: 'Not a platform admin' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, ...params } = await req.json();

    switch (action) {
      case 'list': {
        const { orgId } = params;
        const { data, error } = await supabase
          .from('organisation_members')
          .select(`
            id,
            user_id,
            role,
            created_at,
            profiles:user_id (
              email
            )
          `)
          .eq('organisation_id', orgId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'invite': {
        const { orgId, email, role } = params;
        
        // Check if user exists
        const { data: existingUser } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', email)
          .single();

        let userId = existingUser?.id;

        if (!userId) {
          // Create user via auth
          const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email,
            email_confirm: true,
          });

          if (createError) throw createError;
          userId = newUser.user.id;
        }

        // Add to organisation
        const { data, error } = await supabase
          .from('organisation_members')
          .insert({
            organisation_id: orgId,
            user_id: userId,
            role: role || 'member',
          })
          .select()
          .single();

        if (error) throw error;
        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'update-role': {
        const { orgId, userId, role } = params;
        const { data, error } = await supabase
          .from('organisation_members')
          .update({ role })
          .eq('organisation_id', orgId)
          .eq('user_id', userId)
          .select()
          .single();

        if (error) throw error;
        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'remove': {
        const { orgId, userId } = params;
        const { error } = await supabase
          .from('organisation_members')
          .delete()
          .eq('organisation_id', orgId)
          .eq('user_id', userId);

        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});