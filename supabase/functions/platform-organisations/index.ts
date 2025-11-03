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
        const { data, error } = await supabase
          .from('organisation_stats')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'create': {
        const { name, domain } = params;
        const { data, error } = await supabase
          .from('organisations')
          .insert({
            name,
            primary_domain: domain,
            domains: [domain],
            is_active: true,
          })
          .select()
          .single();

        if (error) throw error;
        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'update': {
        const { orgId, name, is_active } = params;
        const updates: any = {};
        if (name !== undefined) updates.name = name;
        if (is_active !== undefined) updates.is_active = is_active;

        const { data, error } = await supabase
          .from('organisations')
          .update(updates)
          .eq('id', orgId)
          .select()
          .single();

        if (error) throw error;
        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'update-domains': {
        const { orgId, add, remove } = params;
        
        // Get current org
        const { data: org, error: fetchError } = await supabase
          .from('organisations')
          .select('domains')
          .eq('id', orgId)
          .single();

        if (fetchError) throw fetchError;

        let domains = org.domains || [];
        
        // Remove domains
        if (remove && remove.length > 0) {
          domains = domains.filter((d: string) => !remove.includes(d));
        }
        
        // Add domains
        if (add && add.length > 0) {
          domains = [...domains, ...add.filter((d: string) => !domains.includes(d))];
        }

        const { data, error } = await supabase
          .from('organisations')
          .update({ domains })
          .eq('id', orgId)
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