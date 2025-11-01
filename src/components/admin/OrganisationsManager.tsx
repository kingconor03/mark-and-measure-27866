import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, Edit, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Organisation {
  id: string;
  name: string;
  primary_domain: string;
  domains: string[];
  is_active: boolean;
  created_at: string;
  member_count: number;
  project_count: number;
}

export function OrganisationsManager() {
  const [orgs, setOrgs] = useState<Organisation[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newOrgOpen, setNewOrgOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgDomain, setNewOrgDomain] = useState("");

  const loadOrganisations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('organisation_stats')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrgs(data || []);
    } catch (error) {
      console.error('Error loading organisations:', error);
      toast.error("Failed to load organisations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrganisations();
  }, []);

  const createOrganisation = async () => {
    if (!newOrgName.trim() || !newOrgDomain.trim()) {
      toast.error("Name and domain are required");
      return;
    }

    setCreating(true);
    try {
      const response = await supabase.functions.invoke('manage-organisation', {
        body: {
          action: 'create',
          name: newOrgName.trim(),
          primaryDomain: newOrgDomain.trim(),
          domains: [newOrgDomain.trim()]
        }
      });

      if (response.error) throw response.error;

      toast.success("Organisation created successfully");
      setNewOrgOpen(false);
      setNewOrgName("");
      setNewOrgDomain("");
      loadOrganisations();
    } catch (error: any) {
      console.error('Error creating organisation:', error);
      toast.error(error.message || "Failed to create organisation");
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (orgId: string, currentStatus: boolean) => {
    try {
      const response = await supabase.functions.invoke('manage-organisation', {
        body: {
          action: 'update',
          orgId,
          isActive: !currentStatus
        }
      });

      if (response.error) throw response.error;

      toast.success(`Organisation ${!currentStatus ? 'activated' : 'deactivated'}`);
      loadOrganisations();
    } catch (error: any) {
      console.error('Error updating organisation:', error);
      toast.error(error.message || "Failed to update organisation");
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Organisations</CardTitle>
              <CardDescription>Manage all organisations and their domains</CardDescription>
            </div>
            <Dialog open={newOrgOpen} onOpenChange={setNewOrgOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Organisation
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Organisation</DialogTitle>
                  <DialogDescription>
                    Add a new organisation with its primary domain
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="orgName">Organisation Name</Label>
                    <Input
                      id="orgName"
                      value={newOrgName}
                      onChange={(e) => setNewOrgName(e.target.value)}
                      placeholder="Acme Construction"
                    />
                  </div>
                  <div>
                    <Label htmlFor="orgDomain">Primary Domain</Label>
                    <Input
                      id="orgDomain"
                      value={newOrgDomain}
                      onChange={(e) => setNewOrgDomain(e.target.value)}
                      placeholder="acme.com.au"
                    />
                  </div>
                  <Button 
                    onClick={createOrganisation} 
                    disabled={creating}
                    className="w-full"
                  >
                    {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                    Create Organisation
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Primary Domain</TableHead>
                <TableHead>All Domains</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Projects</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgs.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {org.name}
                  </TableCell>
                  <TableCell>{org.primary_domain}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {org.domains.map((domain) => (
                        <Badge key={domain} variant="secondary" className="text-xs">
                          {domain}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{org.member_count}</TableCell>
                  <TableCell>{org.project_count}</TableCell>
                  <TableCell>
                    <Badge variant={org.is_active ? "default" : "secondary"}>
                      {org.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(org.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleActive(org.id, org.is_active)}
                    >
                      {org.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
