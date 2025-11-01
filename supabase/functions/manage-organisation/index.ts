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
        JSON.stringify({ error: 'Forbidden: Only platform admins can manage organisations' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, orgId, name, primaryDomain, domains, isActive } = await req.json();

    if (!action) {
      throw new Error('Action is required');
    }

    switch (action) {
      case 'create': {
        if (!name || !primaryDomain) {
          throw new Error('Name and primary domain are required');
        }

        const { data, error } = await supabase
          .from('organisations')
          .insert({
            name,
            primary_domain: primaryDomain,
            domains: domains || [primaryDomain],
            is_active: true
          })
          .select()
          .single();

        if (error) throw error;

        console.log(`Created organisation: ${name} (${primaryDomain})`);
        return new Response(
          JSON.stringify({ success: true, data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update': {
        if (!orgId) {
          throw new Error('orgId is required for update');
        }

        const updates: any = {};
        if (name !== undefined) updates.name = name;
        if (primaryDomain !== undefined) updates.primary_domain = primaryDomain;
        if (domains !== undefined) updates.domains = domains;
        if (isActive !== undefined) updates.is_active = isActive;

        const { data, error } = await supabase
          .from('organisations')
          .update(updates)
          .eq('id', orgId)
          .select()
          .single();

        if (error) throw error;

        console.log(`Updated organisation: ${orgId}`);
        return new Response(
          JSON.stringify({ success: true, data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'add_domain': {
        if (!orgId || !primaryDomain) {
          throw new Error('orgId and domain are required');
        }

        // Get current org
        const { data: org, error: fetchError } = await supabase
          .from('organisations')
          .select('domains')
          .eq('id', orgId)
          .single();

        if (fetchError) throw fetchError;

        // Add domain if not already present
        const currentDomains = org.domains || [];
        if (!currentDomains.includes(primaryDomain)) {
          const { data, error } = await supabase
            .from('organisations')
            .update({ domains: [...currentDomains, primaryDomain] })
            .eq('id', orgId)
            .select()
            .single();

          if (error) throw error;

          console.log(`Added domain ${primaryDomain} to org ${orgId}`);
          return new Response(
            JSON.stringify({ success: true, data }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Domain already exists' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'remove_domain': {
        if (!orgId || !primaryDomain) {
          throw new Error('orgId and domain are required');
        }

        // Get current org
        const { data: org, error: fetchError } = await supabase
          .from('organisations')
          .select('domains')
          .eq('id', orgId)
          .single();

        if (fetchError) throw fetchError;

        // Remove domain
        const currentDomains = org.domains || [];
        const newDomains = currentDomains.filter((d: string) => d !== primaryDomain);

        const { data, error } = await supabase
          .from('organisations')
          .update({ domains: newDomains })
          .eq('id', orgId)
          .select()
          .single();

        if (error) throw error;

        console.log(`Removed domain ${primaryDomain} from org ${orgId}`);
        return new Response(
          JSON.stringify({ success: true, data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('Error managing organisation:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
