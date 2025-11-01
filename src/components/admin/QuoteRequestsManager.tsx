import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, FileText, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface QuoteRequest {
  id: string;
  organisation_id: string;
  project_id: string | null;
  created_by: string;
  status: string;
  notes: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  organisations: { name: string } | null;
  projects: { name: string } | null;
}

export function QuoteRequestsManager() {
  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedQuote, setSelectedQuote] = useState<QuoteRequest | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [processing, setProcessing] = useState(false);

  const loadQuoteRequests = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('quote_requests')
        .select(`
          *,
          organisations!quote_requests_organisation_id_fkey(name),
          projects!quote_requests_project_id_fkey(name)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq('status', statusFilter as any);
      }

      const { data, error } = await query;
      if (error) throw error;
      setQuotes(data || []);
    } catch (error) {
      console.error('Error loading quote requests:', error);
      toast.error("Failed to load quote requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuoteRequests();
  }, [statusFilter]);

  const updateStatus = async (requestId: string, newStatus: string, note?: string) => {
    setProcessing(true);
    try {
      const response = await supabase.functions.invoke('process-quote-request', {
        body: {
          requestId,
          status: newStatus,
          note: note || undefined
        }
      });

      if (response.error) throw response.error;

      toast.success("Quote request updated successfully");
      setSelectedQuote(null);
      setAdminNote("");
      loadQuoteRequests();
    } catch (error: any) {
      console.error('Error updating quote request:', error);
      toast.error(error.message || "Failed to update quote request");
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      new: "default",
      awaiting_docs: "secondary",
      in_progress: "outline",
      completed: "default",
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
              <CardTitle>Quote Requests</CardTitle>
              <CardDescription>Manage all quote requests from organisations</CardDescription>
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
                <SelectItem value="completed">Completed</SelectItem>
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
              {quotes.map((quote) => (
                <TableRow key={quote.id}>
                  <TableCell>{quote.organisations?.name || 'N/A'}</TableCell>
                  <TableCell>{quote.projects?.name || 'N/A'}</TableCell>
                  <TableCell className="font-mono text-xs">{quote.created_by.substring(0, 8)}...</TableCell>
                  <TableCell>{getStatusBadge(quote.status)}</TableCell>
                  <TableCell>{new Date(quote.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(quote.updated_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedQuote(quote)}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedQuote} onOpenChange={(open) => !open && setSelectedQuote(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Quote Request</DialogTitle>
            <DialogDescription>
              Update status and add notes for this quote request
            </DialogDescription>
          </DialogHeader>
          {selectedQuote && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Organisation</p>
                  <p className="font-medium">{selectedQuote.organisations?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Status</p>
                  <p className="font-medium">{getStatusBadge(selectedQuote.status)}</p>
                </div>
              </div>

              {selectedQuote.notes && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Request Notes</p>
                  <p className="text-sm bg-muted p-3 rounded">{selectedQuote.notes}</p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium">Add Admin Note</label>
                <Textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Add internal notes..."
                  className="mt-2"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => updateStatus(selectedQuote.id, 'awaiting_docs', adminNote)}
                  disabled={processing}
                >
                  Mark Awaiting Docs
                </Button>
                <Button
                  size="sm"
                  onClick={() => updateStatus(selectedQuote.id, 'in_progress', adminNote)}
                  disabled={processing}
                >
                  Mark In Progress
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => updateStatus(selectedQuote.id, 'completed', adminNote)}
                  disabled={processing}
                >
                  Mark Completed
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => updateStatus(selectedQuote.id, 'rejected', adminNote)}
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
