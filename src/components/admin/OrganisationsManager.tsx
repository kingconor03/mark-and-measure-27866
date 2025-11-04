import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Edit, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Organisation {
  id: string;
  name: string;
  primary_domain: string;
  domains: string[];
  is_active: boolean;
  created_at: string;
  member_count?: number;
  project_count?: number;
}

export function OrganisationsManager() {
  const [orgs, setOrgs] = useState<Organisation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState<Organisation | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgDomain, setNewOrgDomain] = useState("");
  const [editName, setEditName] = useState("");
  const [newDomain, setNewDomain] = useState("");

  const loadOrganisations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('platform-organisations', {
        body: { action: 'list' }
      });

      if (error) throw error;
      setOrgs(data?.data || []);
    } catch (error: any) {
      console.error('Error loading organisations:', error);
      toast.error(error.message || "Failed to load organisations");
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

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('platform-organisations', {
        body: {
          action: 'create',
          name: newOrgName.trim(),
          domain: newOrgDomain.trim()
        }
      });

      if (error) throw error;

      toast.success("Organisation created successfully");
      setShowAddDialog(false);
      setNewOrgName("");
      setNewOrgDomain("");
      loadOrganisations();
    } catch (error: any) {
      console.error('Error creating organisation:', error);
      toast.error(error.message || "Failed to create organisation");
    } finally {
      setProcessing(false);
    }
  };

  const updateOrganisation = async () => {
    if (!selectedOrg || !editName.trim()) {
      toast.error("Name is required");
      return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke('platform-organisations', {
        body: {
          action: 'update',
          orgId: selectedOrg.id,
          name: editName.trim()
        }
      });

      if (error) throw error;

      toast.success("Organisation updated successfully");
      setShowEditDialog(false);
      setSelectedOrg(null);
      setEditName("");
      loadOrganisations();
    } catch (error: any) {
      console.error('Error updating organisation:', error);
      toast.error(error.message || "Failed to update organisation");
    } finally {
      setProcessing(false);
    }
  };

  const addDomain = async () => {
    if (!selectedOrg || !newDomain.trim()) {
      toast.error("Domain is required");
      return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke('platform-organisations', {
        body: {
          action: 'update-domains',
          orgId: selectedOrg.id,
          add: [newDomain.trim()]
        }
      });

      if (error) throw error;

      toast.success("Domain added successfully");
      setNewDomain("");
      loadOrganisations();
      
      // Refresh selected org
      const updated = orgs.find(o => o.id === selectedOrg.id);
      if (updated) setSelectedOrg({ ...updated, domains: [...updated.domains, newDomain.trim()] });
    } catch (error: any) {
      console.error('Error adding domain:', error);
      toast.error(error.message || "Failed to add domain");
    } finally {
      setProcessing(false);
    }
  };

  const removeDomain = async (domain: string) => {
    if (!selectedOrg) return;

    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke('platform-organisations', {
        body: {
          action: 'update-domains',
          orgId: selectedOrg.id,
          remove: [domain]
        }
      });

      if (error) throw error;

      toast.success("Domain removed successfully");
      loadOrganisations();
      
      // Refresh selected org
      const updated = orgs.find(o => o.id === selectedOrg.id);
      if (updated) setSelectedOrg(updated);
    } catch (error: any) {
      console.error('Error removing domain:', error);
      toast.error(error.message || "Failed to remove domain");
    } finally {
      setProcessing(false);
    }
  };

  const toggleActive = async (org: Organisation) => {
    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke('platform-organisations', {
        body: {
          action: 'update',
          orgId: org.id,
          is_active: !org.is_active
        }
      });

      if (error) throw error;

      toast.success(`Organisation ${!org.is_active ? 'activated' : 'deactivated'} successfully`);
      loadOrganisations();
    } catch (error: any) {
      console.error('Error toggling organisation status:', error);
      toast.error(error.message || "Failed to update organisation status");
    } finally {
      setProcessing(false);
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
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Organisations</CardTitle>
              <CardDescription>Manage all organisations on the platform</CardDescription>
            </div>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Organisation
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Primary Domain</TableHead>
                <TableHead>Domains</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Projects</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgs.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-medium">{org.name}</TableCell>
                  <TableCell className="font-mono text-xs">{org.primary_domain}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {org.domains.slice(0, 2).map(d => (
                        <Badge key={d} variant="outline" className="text-xs">{d}</Badge>
                      ))}
                      {org.domains.length > 2 && (
                        <Badge variant="outline" className="text-xs">+{org.domains.length - 2}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{org.member_count || 0}</TableCell>
                  <TableCell>{org.project_count || 0}</TableCell>
                  <TableCell>
                    <Badge variant={org.is_active ? "default" : "secondary"}>
                      {org.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedOrg(org);
                          setEditName(org.name);
                          setShowEditDialog(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActive(org)}
                        disabled={processing}
                      >
                        {org.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Organisation Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Organisation</DialogTitle>
            <DialogDescription>Create a new organisation on the platform</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Organisation Name</Label>
              <Input
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="Acme Corp"
              />
            </div>
            <div>
              <Label>Primary Domain</Label>
              <Input
                value={newOrgDomain}
                onChange={(e) => setNewOrgDomain(e.target.value)}
                placeholder="acme.com"
              />
            </div>
            <Button onClick={createOrganisation} disabled={processing} className="w-full">
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Organisation"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Organisation Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Organisation</DialogTitle>
            <DialogDescription>Update organisation details and manage domains</DialogDescription>
          </DialogHeader>
          {selectedOrg && (
            <div className="space-y-4">
              <div>
                <Label>Organisation Name</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              
              <div>
                <Label>Primary Domain</Label>
                <p className="text-sm font-mono bg-muted p-2 rounded">{selectedOrg.primary_domain}</p>
              </div>

              <div>
                <Label>Additional Domains</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    placeholder="additional-domain.com"
                  />
                  <Button onClick={addDomain} disabled={processing}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {selectedOrg.domains.map(domain => (
                    <div key={domain} className="flex items-center justify-between bg-muted p-2 rounded">
                      <span className="text-sm font-mono">{domain}</span>
                      {domain !== selectedOrg.primary_domain && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDomain(domain)}
                          disabled={processing}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={updateOrganisation} disabled={processing} className="w-full">
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
