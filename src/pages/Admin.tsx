import { useEffect, useState } from "react";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, Shield, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganisation } from "@/hooks/useOrganisation";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function Admin() {
  const { isPlatformAdmin, loading: orgLoading } = useOrganisation();
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [orgMembers, setOrgMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgLoading && !isPlatformAdmin) {
      navigate("/dashboard");
      toast.error("Unauthorized access");
    }
  }, [isPlatformAdmin, orgLoading, navigate]);

  useEffect(() => {
    if (isPlatformAdmin) {
      fetchData();
    }
  }, [isPlatformAdmin]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, orgsRes, membersRes] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('organisations').select('*'),
        supabase.from('organisation_members').select('*, organisations(name), profiles(email)')
      ]);

      if (usersRes.data) setUsers(usersRes.data);
      if (orgsRes.data) setOrganizations(orgsRes.data);
      if (membersRes.data) setOrgMembers(membersRes.data);
    } catch (error) {
      console.error('Error fetching admin data:', error);
      toast.error("Failed to load admin data");
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', userId);
      if (error) throw error;
      toast.success("User deleted successfully");
      fetchData();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error("Failed to delete user");
    }
  };

  const deleteOrganization = async (orgId: string) => {
    if (!confirm("Are you sure you want to delete this organization?")) return;
    
    try {
      const { error } = await supabase.from('organisations').delete().eq('id', orgId);
      if (error) throw error;
      toast.success("Organization deleted successfully");
      fetchData();
    } catch (error) {
      console.error('Error deleting organization:', error);
      toast.error("Failed to delete organization");
    }
  };

  const updateMemberRole = async (memberId: string, newRole: 'admin' | 'member' | 'viewer') => {
    try {
      const { error } = await supabase
        .from('organisation_members')
        .update({ role: newRole })
        .eq('id', memberId);
      
      if (error) throw error;
      toast.success("Role updated successfully");
      fetchData();
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error("Failed to update role");
    }
  };

  if (orgLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen flex bg-background">
      <DashboardSidebar />
      
      <main className="flex-1 p-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Platform Administration</h1>
          </div>
          <p className="text-muted-foreground">
            Manage users, organizations, and system settings
          </p>
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="organizations">Organizations</TabsTrigger>
            <TabsTrigger value="members">Organization Members</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>All Users</CardTitle>
                <CardDescription>View and manage all users in the system</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>User ID</TableHead>
                      <TableHead>Created At</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.email}</TableCell>
                        <TableCell className="font-mono text-xs">{user.id}</TableCell>
                        <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteUser(user.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="organizations">
            <Card>
              <CardHeader>
                <CardTitle>All Organizations</CardTitle>
                <CardDescription>View and manage all organizations</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Primary Domain</TableHead>
                      <TableHead>All Domains</TableHead>
                      <TableHead>Created At</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {organizations.map((org) => (
                      <TableRow key={org.id}>
                        <TableCell className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          {org.name}
                        </TableCell>
                        <TableCell>{org.primary_domain}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {org.domains.map((domain: string) => (
                              <Badge key={domain} variant="secondary">{domain}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>{new Date(org.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteOrganization(org.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="members">
            <Card>
              <CardHeader>
                <CardTitle>Organization Members</CardTitle>
                <CardDescription>View and manage organization memberships and roles</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User Email</TableHead>
                      <TableHead>Organization</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orgMembers.map((member: any) => (
                      <TableRow key={member.id}>
                        <TableCell>{member.profiles?.email || 'N/A'}</TableCell>
                        <TableCell>{member.organisations?.name || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                            {member.role}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(member.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateMemberRole(member.id, 'admin')}
                              disabled={member.role === 'admin'}
                            >
                              Admin
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateMemberRole(member.id, 'member')}
                              disabled={member.role === 'member'}
                            >
                              Member
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateMemberRole(member.id, 'viewer')}
                              disabled={member.role === 'viewer'}
                            >
                              Viewer
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
