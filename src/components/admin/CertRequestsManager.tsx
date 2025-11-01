import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, FileText, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CertRequest {
  id: string;
  organisation_id: string;
  project_id: string;
  created_by: string;
  status: string;
  notes: string | null;
  admin_comments: string | null;
  created_at: string;
  updated_at: string;
  organisations: { name: string } | null;
  projects: { name: string } | null;
}

export function CertRequestsManager() {
  const [certs, setCerts] = useState<CertRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedCert, setSelectedCert] = useState<CertRequest | null>(null);
  const [adminComments, setAdminComments] = useState("");
  const [processing, setProcessing] = useState(false);

  const loadCertRequests = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('certification_requests')
        .select(`
          *,
          organisations!certification_requests_organisation_id_fkey(name),
          projects!certification_requests_project_id_fkey(name)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq('status', statusFilter as any);
      }

      const { data, error } = await query;
      if (error) throw error;
      setCerts(data || []);
    } catch (error) {
      console.error('Error loading certification requests:', error);
      toast.error("Failed to load certification requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCertRequests();
  }, [statusFilter]);

  const updateStatus = async (requestId: string, newStatus: string, comments?: string) => {
    setProcessing(true);
    try {
      const response = await supabase.functions.invoke('process-cert-request', {
        body: {
          requestId,
          status: newStatus,
          adminComments: comments || undefined
        }
      });

      if (response.error) throw response.error;

      toast.success("Certification request updated successfully");
      setSelectedCert(null);
      setAdminComments("");
      loadCertRequests();
    } catch (error: any) {
      console.error('Error updating certification request:', error);
      toast.error(error.message || "Failed to update certification request");
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      new: "default",
      awaiting_docs: "secondary",
      in_progress: "outline",
      approved: "default",
      rejected: "destructive"
    };
    return <Badge variant={variants[status] || "secondary"}>{status.replace('_', ' ')}</Badge>;
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
              <CardTitle>Certification Requests</CardTitle>
              <CardDescription>Manage all certification requests from organisations</CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Requests</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="awaiting_docs">Awaiting Docs</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organisation</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Requested By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {certs.map((cert) => (
                <TableRow key={cert.id}>
                  <TableCell>{cert.organisations?.name || 'N/A'}</TableCell>
                  <TableCell>{cert.projects?.name || 'N/A'}</TableCell>
                  <TableCell className="font-mono text-xs">{cert.created_by.substring(0, 8)}...</TableCell>
                  <TableCell>{getStatusBadge(cert.status)}</TableCell>
                  <TableCell>{new Date(cert.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(cert.updated_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedCert(cert)}
                    >
                      <Award className="h-4 w-4 mr-1" />
                      Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedCert} onOpenChange={(open) => !open && setSelectedCert(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Certification Request</DialogTitle>
            <DialogDescription>
              Review and approve or reject this certification request
            </DialogDescription>
          </DialogHeader>
          {selectedCert && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Organisation</p>
                  <p className="font-medium">{selectedCert.organisations?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Status</p>
                  <p className="font-medium">{getStatusBadge(selectedCert.status)}</p>
                </div>
              </div>

              {selectedCert.notes && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Request Notes</p>
                  <p className="text-sm bg-muted p-3 rounded">{selectedCert.notes}</p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium">Admin Comments</label>
                <Textarea
                  value={adminComments}
                  onChange={(e) => setAdminComments(e.target.value)}
                  placeholder="Add comments about this certification..."
                  className="mt-2"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => updateStatus(selectedCert.id, 'awaiting_docs', adminComments)}
                  disabled={processing}
                >
                  Request More Docs
                </Button>
                <Button
                  size="sm"
                  onClick={() => updateStatus(selectedCert.id, 'in_progress', adminComments)}
                  disabled={processing}
                >
                  Mark In Progress
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => updateStatus(selectedCert.id, 'approved', adminComments)}
                  disabled={processing}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => updateStatus(selectedCert.id, 'rejected', adminComments)}
                  disabled={processing}
                >
                  Reject
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
