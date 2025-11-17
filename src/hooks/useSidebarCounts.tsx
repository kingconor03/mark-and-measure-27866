import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SidebarCounts {
  kind?: 'platform' | 'tenant';
  pending_quotes?: number;
  pending_certs?: number;
  certs_passed_2_weeks?: number;
  // Legacy fields for backward compatibility
  quotes_new?: number;
  quotes_awaiting_docs?: number;
  quotes_in_progress?: number;
  certs_new?: number;
  certs_pending?: number;
  certs_awaiting_docs?: number;
  my_quotes_pending?: number;
  my_certs_pending?: number;
}

export function useSidebarCounts() {
  const [counts, setCounts] = useState<SidebarCounts>({});
  const [loading, setLoading] = useState(true);

  const fetchCounts = async () => {
    try {
      // Call the edge function which handles auth and calls the RPC with user ID
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('sidebar-counts', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      
      // The RPC returns different fields based on user type
      const result = data as any;
      
      // Check if this is a platform admin response (has quotes_new field)
      if (result.quotes_new !== undefined) {
        // Platform admin response
        setCounts({
          kind: 'platform',
          quotes_new: result.quotes_new || 0,
          quotes_awaiting_docs: result.quotes_awaiting_docs || 0,
          quotes_in_progress: result.quotes_in_progress || 0,
          certs_new: result.certs_new || 0,
          certs_pending: result.certs_pending || 0,
          certs_awaiting_docs: result.certs_awaiting_docs || 0,
        });
      } else {
        // Regular user response
        setCounts({
          kind: 'tenant',
          my_quotes_pending: result.my_quotes_pending || 0,
          my_certs_pending: result.my_certs_pending || 0,
        });
      }
    } catch (error) {
      console.error('Error fetching sidebar counts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCounts();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  return { counts, loading, refetch: fetchCounts };
}