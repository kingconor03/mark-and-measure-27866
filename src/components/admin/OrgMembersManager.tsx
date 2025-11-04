import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Organisation {
  id: string;
  name: string;
  primary_domain: string;
}

interface Member {
  user_id: string;
  email: string;
  role: string;
  created_at: string;
}

interface Props {
  orgId?: string;
  orgName?: string;
  currentUserId: string;
}

export function OrgMembersManager({ orgId: initialOrgId, orgName, currentUserId }: Props) {
  const [orgs, setOrgs] = useState<Organisation[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>(initialOrgId || "");
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");

  const loadOrganisations = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('platform-organisations', {
        body: { action: 'list' }
      });

      if (error) throw error;
      setOrgs(data?.data || []);
    } catch (error: any) {
      console.error('Error loading organisations:', error);
      toast.error("Failed to load organisations");
    }
  };

  const loadMembers = async (orgId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('platform-members', {
        body: {
          action: 'list',
          orgId
        }
      });

      if (error) throw error;
      
      // Map the data to match expected structure
      const formattedMembers = (data?.data || []).map((m: any) => ({
        user_id: m.user_id,
        email: m.profiles?.email || m.user_id,
        role: m.role,
        created_at: m.created_at
      }));
      
      setMembers(formattedMembers);
    } catch (error: any) {
      console.error('Error loading members:', error);
      toast.error("Failed to load members");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrganisations();
  }, []);

  useEffect(() => {
    if (selectedOrgId) {
      loadMembers(selectedOrgId);
    } else {
      setMembers([]);
    }
  }, [selectedOrgId]);

  const inviteMember = async () => {
    if (!selectedOrgId || !inviteEmail.trim()) {
      toast.error("Organisation and email are required");
      return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke('platform-members', {
        body: {
          action: 'invite',
          orgId: selectedOrgId,
          email: inviteEmail.trim(),
          role: inviteRole
        }
      });

      if (error) throw error;

      toast.success("Member invited successfully");
      setShowInviteDialog(false);
      setInviteEmail("");
      setInviteRole("member");
      loadMembers(selectedOrgId);
    } catch (error: any) {
      console.error('Error inviting member:', error);
      toast.error(error.message || "Failed to invite member");
    } finally {
      setProcessing(false);
    }
  };

  const updateRole = async (userId: string, newRole: string) => {
    if (!selectedOrgId) return;

    try {
      const { error } = await supabase.functions.invoke('platform-members', {
        body: {
          action: 'update-role',
          orgId: selectedOrgId,
          userId,
          role: newRole
        }
      });

      if (error) throw error;

      toast.success("Role updated successfully");
      loadMembers(selectedOrgId);
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast.error(error.message || "Failed to update role");
    }
  };

  const removeMember = async (userId: string) => {
    if (!selectedOrgId) return;
    if (!confirm("Are you sure you want to remove this member?")) return;

    try {
      const { error } = await supabase.functions.invoke('platform-members', {
        body: {
          action: 'remove',
          orgId: selectedOrgId,
          userId
        }
      });

      if (error) throw error;

      toast.success("Member removed successfully");
      loadMembers(selectedOrgId);
    } catch (error: any) {
      console.error('Error removing member:', error);
      toast.error(error.message || "Failed to remove member");
    }
  };

  const selectedOrg = orgs.find(o => o.id === selectedOrgId);
  const isBladePile = selectedOrg?.primary_domain === 'bladepile.com.au';

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Members by Organisation</CardTitle>
              <CardDescription>View and manage organisation members</CardDescription>
            </div>
            <Button onClick={() => setShowInviteDialog(true)} disabled={!selectedOrgId}>
              <Plus className="h-4 w-4 mr-2" />
              Invite Member
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {!initialOrgId && (
              <div>
                <Label>Select Organisation</Label>
                <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an organisation" />
                  </SelectTrigger>
                  <SelectContent>
                    {orgs.map(org => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name} ({org.primary_domain})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            )}

            {!loading && selectedOrgId && (
              <div className="space-y-3">
                {members.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No members found. Invite someone to get started.
                  </p>
                ) : (
                  members.map(member => (
                    <div key={member.user_id} className="flex items-center justify-between rounded border p-3">
                      <div className="flex-1">
                        <div className="font-medium">{member.email}</div>
                        <div className="text-xs text-muted-foreground">
                          Joined {new Date(member.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          value={member.role}
                          onValueChange={(val) => updateRole(member.user_id, val)}
                          disabled={!isBladePile && member.role === 'admin'}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {isBladePile && <SelectItem value="admin">Admin</SelectItem>}
                            <SelectItem value="member">Member</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMember(member.user_id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Invite Member Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join {orgName || selectedOrg?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Email Address</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={(val: any) => setInviteRole(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {isBladePile && <SelectItem value="admin">Admin</SelectItem>}
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
              {!isBladePile && (
                <p className="text-xs text-muted-foreground mt-1">
                  Only BladePile organisation can have admin users
                </p>
              )}
            </div>
            <Button onClick={inviteMember} disabled={processing} className="w-full">
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Invitation"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
