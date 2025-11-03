import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SidebarCounts {
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
      const { data, error } = await supabase.rpc('sidebar_counts_for_me');
      if (error) throw error;
      setCounts((data as SidebarCounts) || {});
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