import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Member {
  id: string;
  user_id: string;
  role: 'admin' | 'member' | 'viewer';
  created_at: string;
  profiles: { email: string } | null;
}

interface OrgMembersManagerProps {
  orgId: string;
  orgName: string;
  currentUserId: string;
}

export function OrgMembersManager({ orgId, orgName, currentUserId }: OrgMembersManagerProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('viewer');
  const [inviting, setInviting] = useState(false);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('list-org-members', {
        body: { orgId },
      });

      if (response.error) throw response.error;
      setMembers(response.data || []);
    } catch (error) {
      console.error('Error loading members:', error);
      toast.error("Failed to load members");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, [orgId]);

  const updateRole = async (userId: string, newRole: 'admin' | 'member' | 'viewer') => {
    try {
      const response = await supabase.functions.invoke('update-member-role', {
        body: { orgId, targetUserId: userId, role: newRole },
      });

      if (response.error) throw response.error;
      
      toast.success("Role updated successfully");
      loadMembers();
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast.error(error.message || "Failed to update role");
    }
  };

  const removeMember = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to remove ${email} from this organization?`)) return;

    try {
      const response = await supabase.functions.invoke('remove-org-member', {
        body: { orgId, targetUserId: userId },
      });

      if (response.error) throw response.error;
      
      toast.success("Member removed successfully");
      loadMembers();
    } catch (error: any) {
      console.error('Error removing member:', error);
      toast.error(error.message || "Failed to remove member");
    }
  };

  const inviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    setInviting(true);
    try {
      const response = await supabase.functions.invoke('invite-org-member', {
        body: { orgId, email: inviteEmail, role: inviteRole },
      });

      if (response.error) throw response.error;
      
      const data = response.data;
      if (data.magicLink) {
        toast.success(`Invitation sent! Magic link: ${data.magicLink}`, { duration: 10000 });
      } else {
        toast.success(data.message || "Member invited successfully");
      }
      
      setInviteEmail("");
      setInviteRole('viewer');
      loadMembers();
    } catch (error: any) {
      console.error('Error inviting member:', error);
      toast.error(error.message || "Failed to invite member");
    } finally {
      setInviting(false);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'default';
      case 'member': return 'secondary';
      case 'viewer': return 'outline';
      default: return 'secondary';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Invite New Member</CardTitle>
          <CardDescription>Add a new member to {orgName}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={inviteMember} className="flex items-end gap-3">
            <div className="flex-1">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>
            <div className="w-40">
              <Label htmlFor="role">Role</Label>
              <Select value={inviteRole} onValueChange={(val: any) => setInviteRole(val)}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={inviting}>
              {inviting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Invite
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Organization Members</CardTitle>
          <CardDescription>Manage roles and permissions for {orgName}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const isCurrentUser = member.user_id === currentUserId;
                const email = member.profiles?.email || member.user_id;
                
                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {email}
                        {isCurrentUser && <Badge variant="outline">You</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={member.role}
                        onValueChange={(val) => updateRole(member.user_id, val as any)}
                        disabled={isCurrentUser && member.role === 'admin'}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue>
                            <Badge variant={getRoleBadgeVariant(member.role)}>
                              {member.role}
                            </Badge>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{new Date(member.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMember(member.user_id, email)}
                        disabled={isCurrentUser}
                        title={isCurrentUser ? "You cannot remove yourself" : "Remove member"}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
