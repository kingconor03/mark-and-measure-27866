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

    // Get BladePile org ID
    const { data: bladepileOrg } = await supabase
      .from('organisations')
      .select('id')
      .eq('primary_domain', 'bladepile.com.au')
      .single();

    if (!bladepileOrg) {
      return new Response(JSON.stringify({ error: 'BladePile org not found' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    switch (action) {
      case 'list': {
        const { status, orgId } = params;
        let query = supabase
          .from('certification_requests')
          .select(`
            *,
            organisation:organisation_id (name),
            project:project_id (name),
            requester:created_by (email)
          `)
          .eq('processing_org_id', bladepileOrg.id);

        if (status) query = query.eq('status', status);
        if (orgId) query = query.eq('organisation_id', orgId);

        query = query.order('created_at', { ascending: false });

        const { data, error } = await query;
        if (error) throw error;

        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'update': {
        const { id, status, note, files } = params;
        
        // Get current request
        const { data: currentReq } = await supabase
          .from('certification_requests')
          .select('notes_history, admin_comments')
          .eq('id', id)
          .single();

        const updates: any = {
          status,
          updated_at: new Date().toISOString(),
        };

        // Append note to history
        if (note) {
          const history = currentReq?.notes_history || [];
          history.push({
            timestamp: new Date().toISOString(),
            user_id: user.id,
            note,
          });
          updates.notes_history = history;
          updates.admin_comments = note;
        }

        if (files) {
          updates.certification_files = files;
        }

        const { data, error } = await supabase
          .from('certification_requests')
          .update(updates)
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        return new Response(JSON.stringify({ data }), {
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});