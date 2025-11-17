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
      
      // Map the response to the expected format
      const result = data as { kind: string; pending_quotes: number; pending_certs: number; certs_passed_2_weeks: number };
      
      if (result.kind === 'platform') {
        // For platform admins, map to the expected fields
        // Since the RPC returns aggregated counts, distribute them across the expected fields
        // The sidebar sums quotes_new + quotes_awaiting_docs + quotes_in_progress
        // So we'll put the total in quotes_new to make the sum work correctly
        const quotesTotal = result.pending_quotes;
        const certsTotal = result.pending_certs;
        
        setCounts({
          kind: 'platform',
          pending_quotes: result.pending_quotes,
          pending_certs: result.pending_certs,
          certs_passed_2_weeks: result.certs_passed_2_weeks,
          // Legacy compatibility - distribute totals for sidebar display
          quotes_new: quotesTotal,
          quotes_awaiting_docs: 0,
          quotes_in_progress: 0,
          certs_new: certsTotal,
          certs_pending: 0,
          certs_awaiting_docs: 0,
        });
      } else {
        // For tenants, map to the expected fields
        setCounts({
          kind: 'tenant',
          pending_quotes: result.pending_quotes,
          pending_certs: result.pending_certs,
          my_quotes_pending: result.pending_quotes,
          my_certs_pending: result.pending_certs,
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