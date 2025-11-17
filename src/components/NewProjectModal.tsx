import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganisation } from "@/hooks/useOrganisation";
import { features } from "@/config/features";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PDFPreviewSelector } from "@/components/PDFPreviewSelector";

interface NewProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated?: () => void;
}

type DocumentType = "installation_details";

interface UploadedDocument {
  type: DocumentType;
  file: File;
  label: string;
}

export const NewProjectModal = ({ open, onOpenChange, onProjectCreated }: NewProjectModalProps) => {
  const [step, setStep] = useState(1);
  const [projectName, setProjectName] = useState("");
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [selectedMarkupDoc, setSelectedMarkupDoc] = useState<string>("");
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [showPageSelector, setShowPageSelector] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { currentOrg } = useOrganisation();
  const navigate = useNavigate();

  const handleDocumentUpload = (type: DocumentType, label: string, file: File) => {
    const MAX_SIZE = 50 * 1024 * 1024; // 50MB
    
    if (file.type !== "application/pdf") {
      toast.error("Please select a valid PDF file");
      return;
    }
    
    if (file.size > MAX_SIZE) {
      toast.error("File size must be less than 50MB");
      return;
    }

    // For installation_details, allow multiple files
    if (type === "installation_details") {
      setDocuments(prev => [...prev, { type, file, label: `${label} - ${file.name}` }]);
      toast.success(`${file.name} uploaded`);
    } else {
      // Remove existing document of same type
      setDocuments(prev => [...prev.filter(d => d.type !== type), { type, file, label }]);
      toast.success(`${label} uploaded`);
    }
  };

  const removeDocument = (type: DocumentType, index?: number) => {
    if (type === "installation_details" && index !== undefined) {
      // Remove specific file by index for installation_details
      setDocuments(prev => {
        const installationDocs = prev.filter(d => d.type === type);
        const otherDocs = prev.filter(d => d.type !== type);
        const updated = installationDocs.filter((_, i) => i !== index);
        return [...otherDocs, ...updated];
      });
    } else {
      // Remove all documents of this type
      setDocuments(prev => prev.filter(d => d.type !== type));
      if (selectedMarkupDoc === type) {
        setSelectedMarkupDoc("");
      }
    }
  };

  const handleFinish = async (action: "markup" | "quote") => {
    if (!user) {
      toast.error("User not found. Please sign in.");
      return;
    }

    // Quote requests require an organisation
    if (action === "quote" && !currentOrg) {
      toast.error("An organisation is required to request a quote. Please create or join an organisation first.");
      return;
    }

    if (documents.length === 0) {
      toast.error("Please upload at least one document");
      return;
    }

    if (!selectedMarkupDoc && action === "markup") {
      toast.error("Please select a document for markup");
      return;
    }

    // For markup, ensure pages were selected
    if (action === "markup" && selectedPages.length === 0) {
      toast.error("Please select at least one page to mark up");
      return;
    }

    console.log('handleFinish called with:', { action, selectedPages, selectedPagesLength: selectedPages.length });
    setLoading(true);

    try {
      // Create project record
      const projectData: any = {
        name: projectName,
        user_id: user.id,
        status: action === "quote" ? "draft" : "processing",
        created_by: user.id
      };

      if (features.orgEnabled && currentOrg) {
        projectData.organisation_id = currentOrg.id;
      }

      const { data: project, error: projectError } = await supabase
        .from("projects")
        .insert(projectData)
        .select()
        .single();

      if (projectError) throw projectError;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      // Upload all documents
      const uploadedFiles: { type: DocumentType; path: string; fileName: string; markupPath?: string | null }[] = [];
      
      for (const doc of documents) {
        const formData = new FormData();
        formData.append('file', doc.file);
        formData.append('projectId', project.id);
        formData.append('fileName', doc.file.name);

        const { data: uploadData, error: uploadError } = await supabase.functions.invoke("upload-blueprint", {
          body: formData,
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          }
        });

        if (uploadError) throw uploadError;
        if (!uploadData?.success) throw new Error(`Failed to upload ${doc.label}`);

        uploadedFiles.push({
          type: doc.type,
          path: uploadData.path,
          fileName: doc.file.name,
          markupPath: uploadData.markupPath || null
        });

        // Store installation_details version in project_assets
        // Note: document_type column must exist (run migration 20251106000003_fix_project_assets_schema.sql)
        const { error: installAssetError } = await supabase.from("project_assets").insert({
          project_id: project.id,
          path: uploadData.path,
          kind: "pdf",
          document_type: "installation_details",
          meta: { fileName: doc.file.name, label: doc.label, docType: doc.type }
        });

        if (installAssetError) {
          console.error('Error inserting installation_details asset:', installAssetError);
          // Continue - this is not critical for the workflow
        }

        // If markup version exists, also store it
        if (uploadData.markupPath) {
          const { error: markupAssetError } = await supabase.from("project_assets").insert({
            project_id: project.id,
            path: uploadData.markupPath,
            kind: "pdf",
            document_type: "markup",
            meta: { fileName: doc.file.name.replace(/\.pdf$/i, '_markup.pdf'), label: `${doc.label} (Markup)`, docType: doc.type }
          });

          if (markupAssetError) {
            console.error('Error inserting markup asset:', markupAssetError);
            // Continue - this is not critical for the workflow
          }
        }
      }

      if (action === "quote") {
        // Create quote request
        const { error: quoteError } = await supabase
          .from("quote_requests")
          .insert({
            project_id: project.id,
            organisation_id: currentOrg.id,
            created_by: user.id,
            status: "new",
            notes: `Project documents uploaded: ${documents.map(d => d.label).join(", ")}`
          });

        if (quoteError) throw quoteError;

        toast.success("Quote request submitted! Admin team will be notified.");
        resetForm();
        onOpenChange(false);
        if (onProjectCreated) onProjectCreated();
        
      } else {
        // Setup for markup - find the selected document
        // selectedMarkupDoc is now "installation_details-{index}" format
        const selectedIndex = selectedMarkupDoc.includes('-') 
          ? parseInt(selectedMarkupDoc.split('-').pop() || '0', 10)
          : 0;
        const installationDocs = uploadedFiles.filter(f => f.type === "installation_details");
        const markupDoc = installationDocs[selectedIndex];
        if (!markupDoc) throw new Error("Markup document not found");

        // Use markup version if available, otherwise use installation version
        const pdfPathToUse = markupDoc.markupPath || markupDoc.path;
        
        // Store the path (not full URL) for org-assets, full URL for legacy blueprints
        // The get-blueprint-url function will handle creating signed URLs
        const bucket = project.organisation_id ? 'org-assets' : 'blueprints';
        let pdfUrl: string;
        
        if (project.organisation_id) {
          // For org-assets, store just the path - the function will create signed URLs
          pdfUrl = `${bucket}/${pdfPathToUse}`;
        } else {
          // For legacy blueprints, store full public URL
          pdfUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${bucket}/${pdfPathToUse}`;
        }

        await supabase
          .from("projects")
          .update({ pdf_url: pdfUrl })
          .eq("id", project.id);

        // Process PDF for markup with selected pages
        // CRITICAL: Capture selectedPages in a local variable BEFORE any async operations
        const pagesToProcess = selectedPages && selectedPages.length > 0 ? [...selectedPages] : [];
        console.log('Processing PDF - selectedPages state:', selectedPages, 'Length:', selectedPages?.length);
        console.log('Processing PDF - pagesToProcess:', pagesToProcess, 'Length:', pagesToProcess.length);
        
        if (pagesToProcess.length === 0) {
          toast.error("No pages selected. Please go back and select pages.");
          setLoading(false);
          return;
        }
        
        // Get fresh session token
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!currentSession) {
          toast.error("Session expired. Please sign in again.");
          setLoading(false);
          return;
        }
        
        console.log('Calling process-pdf with:', { projectId: project.id, selectedPages: pagesToProcess });
        
        const { data: processData, error: processError } = await supabase.functions.invoke("process-pdf", {
          body: { 
            projectId: project.id,
            selectedPages: pagesToProcess // Use the captured copy
          },
          headers: {
            Authorization: `Bearer ${currentSession.access_token}`
          }
        });
        
        if (processError) {
          console.error("PDF processing error:", processError);
          toast.error("Failed to process PDF: " + (processError.message || "Unknown error"));
          setLoading(false);
          return;
        }
        
        console.log('PDF processing response:', processData);

        toast.success("Project created! Processing PDF...");
        
        // Don't reset form until after navigation
        onOpenChange(false);
        
        if (onProjectCreated) onProjectCreated();
        
        // Navigate first, then reset form
        navigate(`/processing/${project.id}`, { 
          state: { 
            projectName: project.name, 
            fileName: markupDoc.fileName,
            totalPages: pagesToProcess.length // Use actual selected pages count
          } 
        });
        
        // Reset form after navigation
        resetForm();
      }

    } catch (error: any) {
      toast.error(error.message || "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setProjectName("");
    setDocuments([]);
    setSelectedMarkupDoc("");
    setSelectedPages([]);
    setShowPageSelector(false);
  };

  const canProceedToStep2 = projectName.trim().length > 0;
  const canProceedToStep3 = documents.length > 0;
  const canFinish = selectedMarkupDoc !== "" || documents.length > 0;

  const DocumentUploadCard = ({ type, label }: { type: DocumentType; label: string }) => {
    const uploadedFiles = documents.filter(d => d.type === type);
    
    return (
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-medium">{label}</Label>
          {uploadedFiles.length > 0 && (
            <span className="text-xs text-muted-foreground">{uploadedFiles.length} file(s)</span>
          )}
        </div>
        {uploadedFiles.length > 0 ? (
          <div className="space-y-2">
            {uploadedFiles.map((doc, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <FileText className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm truncate">{doc.file.name}</span>
                </div>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  onClick={() => removeDocument(type, index)}
                  disabled={loading}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        ) : null}
        <div className="border-2 border-dashed rounded p-4 text-center mt-2">
          <input
            id={`upload-${type}`}
            type="file"
            accept=".pdf"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleDocumentUpload(type, label, file);
              e.target.value = ''; // Reset input to allow same file to be selected again
            }}
            className="hidden"
            disabled={loading}
          />
          <label htmlFor={`upload-${type}`} className="cursor-pointer">
            <Upload className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Upload PDF (max 50MB)</p>
            {uploadedFiles.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">Click to add more files</p>
            )}
          </label>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) {
        // Only reset if we're closing, not during the flow
        resetForm();
      }
      onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Project - Step {step} of 4</DialogTitle>
          <DialogDescription>
            {step === 1 && "Enter project details"}
            {step === 2 && "Upload project documents"}
            {step === 3 && showPageSelector ? "Select pages to mark up" : "Select document for markup"}
            {step === 4 && "Choose action"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Step 1: Project Name */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="project-name">Project Name</Label>
                <Input
                  id="project-name"
                  placeholder="e.g., Downtown Bridge Foundation"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="flex gap-3 justify-end">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={() => setStep(2)}
                  disabled={!canProceedToStep2}
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Upload Documents */}
          {step === 2 && (
            <div className="space-y-4">
              <DocumentUploadCard type="installation_details" label="Installation Details" />
              
              <div className="flex gap-3 justify-end">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setStep(1)}
                >
                  Back
                </Button>
                <Button 
                  onClick={() => setStep(3)}
                  disabled={!canProceedToStep3}
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Select Markup Document */}
          {step === 3 && !showPageSelector && (
            <div className="space-y-4">
              <Label>Select document for markup tool</Label>
              <RadioGroup value={selectedMarkupDoc} onValueChange={setSelectedMarkupDoc}>
                {documents.map((doc, index) => {
                  // Use index as value since we can have multiple installation_details files
                  const value = `${doc.type}-${index}`;
                  return (
                    <div key={value} className="flex items-center space-x-2 border rounded p-3">
                      <RadioGroupItem value={value} id={value} />
                      <Label htmlFor={value} className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <div>
                            <p className="font-medium">{doc.file.name}</p>
                            <p className="text-xs text-muted-foreground">{doc.label}</p>
                          </div>
                        </div>
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>
              
              <div className="flex gap-3 justify-end">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setStep(2)}
                >
                  Back
                </Button>
                <Button 
                  onClick={() => {
                    if (selectedMarkupDoc) {
                      setShowPageSelector(true);
                    }
                  }}
                  disabled={!selectedMarkupDoc}
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {/* Step 3.5: PDF Preview and Page Selection */}
          {step === 3 && showPageSelector && (
            <div className="space-y-4">
              <div>
                <Label>Select pages to mark up</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  {(() => {
                    const selectedIndex = selectedMarkupDoc.includes('-') 
                      ? parseInt(selectedMarkupDoc.split('-').pop() || '0', 10)
                      : 0;
                    const doc = documents[selectedIndex];
                    return doc?.file.name || '';
                  })()}
                </p>
              </div>
              {selectedMarkupDoc && (
                <PDFPreviewSelector
                  file={(() => {
                    const selectedIndex = selectedMarkupDoc.includes('-') 
                      ? parseInt(selectedMarkupDoc.split('-').pop() || '0', 10)
                      : 0;
                    return documents[selectedIndex]?.file;
                  })()}
                  onPagesSelected={(pages) => {
                    console.log('Selected pages:', pages); // Debug log
                    setSelectedPages(pages);
                    setShowPageSelector(false);
                    setStep(4);
                  }}
                  onCancel={() => {
                    setShowPageSelector(false);
                  }}
                />
              )}
            </div>
          )}

          {/* Step 4: Choose Action */}
          {step === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Choose how you want to proceed with this project:
              </p>
              <div className="grid gap-3">
                <Button
                  onClick={() => handleFinish("quote")}
                  disabled={loading || !currentOrg}
                  size="lg"
                  className="h-auto py-4"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <div className="text-left">
                    <p className="font-semibold">Request a Quote</p>
                    <p className="text-xs opacity-80">
                      {!currentOrg 
                        ? "An organisation is required to request a quote" 
                        : "Submit all documents for admin review"}
                    </p>
                  </div>
                </Button>
                <Button
                  onClick={() => handleFinish("markup")}
                  disabled={loading || !selectedMarkupDoc}
                  size="lg"
                  variant="outline"
                  className="h-auto py-4"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <div className="text-left">
                    <p className="font-semibold">Mark Up</p>
                    <p className="text-xs opacity-80">Proceed to markup editor</p>
                  </div>
                </Button>
              </div>
              
              <div className="flex gap-3 justify-end pt-4">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => setStep(3)}
                  disabled={loading}
                >
                  Back
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewProjectModal;
