import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface Organisation {
  id: string;
  name: string;
  primary_domain: string;
  domains: string[];
  created_at: string;
  updated_at: string;
}

export interface OrganisationMember {
  id: string;
  organisation_id: string;
  user_id: string;
  role: 'admin' | 'member' | 'viewer';
  created_at: string;
}

export function useOrganisation() {
  const { user } = useAuth();
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organisation | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'member' | 'viewer' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setOrganisations([]);
      setCurrentOrg(null);
      setUserRole(null);
      setLoading(false);
      return;
    }

    fetchUserOrganisations();
  }, [user]);

  const fetchUserOrganisations = async () => {
    if (!user) return;

    try {
      // Get user's organisations through membership
      const { data: members, error: membersError } = await supabase
        .from('organisation_members')
        .select('*, organisations(*)')
        .eq('user_id', user.id);

      if (membersError) throw membersError;

      if (members && members.length > 0) {
        const orgs = members.map((m: any) => m.organisations);
        setOrganisations(orgs);
        
        // Set first org as current (TODO: allow user to switch)
        setCurrentOrg(orgs[0]);
        setUserRole(members[0].role);
      }
    } catch (error) {
      console.error('Error fetching organisations:', error);
    } finally {
      setLoading(false);
    }
  };

  const createOrganisation = async (name: string, primaryDomain: string) => {
    if (!user) return { error: 'Not authenticated' };

    try {
      // Create organisation
      const { data: org, error: orgError } = await supabase
        .from('organisations')
        .insert({
          name,
          primary_domain: primaryDomain,
          domains: [primaryDomain]
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // Add user as admin
      const { error: memberError } = await supabase
        .from('organisation_members')
        .insert({
          organisation_id: org.id,
          user_id: user.id,
          role: 'admin'
        });

      if (memberError) throw memberError;

      await fetchUserOrganisations();
      return { data: org, error: null };
    } catch (error: any) {
      console.error('Error creating organisation:', error);
      return { error: error.message };
    }
  };

  const findOrganisationByDomain = async (email: string) => {
    const domain = email.split('@')[1];
    
    const { data, error } = await supabase
      .from('organisations')
      .select('*')
      .or(`primary_domain.eq.${domain},domains.cs.{${domain}}`);

    if (error) {
      console.error('Error finding organisation:', error);
      return null;
    }

    return data && data.length > 0 ? data[0] : null;
  };

  const addMemberToOrg = async (orgId: string, userId: string, role: 'admin' | 'member' | 'viewer') => {
    const { error } = await supabase
      .from('organisation_members')
      .insert({
        organisation_id: orgId,
        user_id: userId,
        role
      });

    if (error) {
      console.error('Error adding member:', error);
      return { error: error.message };
    }

    return { error: null };
  };

  return {
    organisations,
    currentOrg,
    userRole,
    loading,
    createOrganisation,
    findOrganisationByDomain,
    addMemberToOrg,
    refetch: fetchUserOrganisations,
    isAdmin: userRole === 'admin',
    isMember: userRole === 'member' || userRole === 'admin',
    isViewer: userRole === 'viewer',
  };
}
