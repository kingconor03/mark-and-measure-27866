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

interface NewProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated?: () => void;
}

type DocumentType = "engineering" | "soil_report" | "architectural";

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

    // Remove existing document of same type
    setDocuments(prev => [...prev.filter(d => d.type !== type), { type, file, label }]);
    toast.success(`${label} uploaded`);
  };

  const removeDocument = (type: DocumentType) => {
    setDocuments(prev => prev.filter(d => d.type !== type));
    if (selectedMarkupDoc === type) {
      setSelectedMarkupDoc("");
    }
  };

  const handleFinish = async (action: "markup" | "quote") => {
    if (!user || !currentOrg) {
      toast.error("User or organization not found");
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
      const uploadedFiles: { type: DocumentType; path: string; fileName: string }[] = [];
      
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
          fileName: doc.file.name
        });

        // Store in project_assets
        await supabase.from("project_assets").insert({
          project_id: project.id,
          path: uploadData.path,
          kind: "other",
          meta: { fileName: doc.file.name, label: doc.label, docType: doc.type }
        });
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
        const markupDoc = uploadedFiles.find(f => f.type === selectedMarkupDoc);
        if (!markupDoc) throw new Error("Markup document not found");

        const pdfUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/blueprints/${markupDoc.path}`;

        await supabase
          .from("projects")
          .update({ pdf_url: pdfUrl })
          .eq("id", project.id);

        // Process PDF for markup
        supabase.functions.invoke("process-pdf", {
          body: { projectId: project.id }
        }).catch(error => {
          console.error("PDF processing error:", error);
        });

        toast.success("Project created! Processing PDF...");
        resetForm();
        onOpenChange(false);
        
        if (onProjectCreated) onProjectCreated();
        
        navigate(`/processing/${project.id}`, { 
          state: { 
            projectName: project.name, 
            fileName: markupDoc.fileName,
            totalPages: 0
          } 
        });
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
  };

  const canProceedToStep2 = projectName.trim().length > 0;
  const canProceedToStep3 = documents.length > 0;
  const canFinish = selectedMarkupDoc !== "" || documents.length > 0;

  const DocumentUploadCard = ({ type, label }: { type: DocumentType; label: string }) => {
    const uploaded = documents.find(d => d.type === type);
    
    return (
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-medium">{label}</Label>
          {uploaded && (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          )}
        </div>
        {uploaded ? (
          <div className="flex items-center justify-between p-2 bg-muted rounded">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="text-sm truncate max-w-[200px]">{uploaded.file.name}</span>
            </div>
            <Button 
              type="button" 
              variant="ghost" 
              size="sm"
              onClick={() => removeDocument(type)}
              disabled={loading}
            >
              Remove
            </Button>
          </div>
        ) : (
          <div className="border-2 border-dashed rounded p-4 text-center">
            <input
              id={`upload-${type}`}
              type="file"
              accept=".pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleDocumentUpload(type, label, file);
              }}
              className="hidden"
              disabled={loading}
            />
            <label htmlFor={`upload-${type}`} className="cursor-pointer">
              <Upload className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Upload PDF (max 50MB)</p>
            </label>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) resetForm();
      onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>New Project - Step {step} of 4</DialogTitle>
          <DialogDescription>
            {step === 1 && "Enter project details"}
            {step === 2 && "Upload project documents"}
            {step === 3 && "Select document for markup"}
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
              <DocumentUploadCard type="engineering" label="Engineering Drawing" />
              <DocumentUploadCard type="soil_report" label="Soil Report" />
              <DocumentUploadCard type="architectural" label="Architectural Drawing" />
              
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
          {step === 3 && (
            <div className="space-y-4">
              <Label>Select document for markup tool</Label>
              <RadioGroup value={selectedMarkupDoc} onValueChange={setSelectedMarkupDoc}>
                {documents.map((doc) => (
                  <div key={doc.type} className="flex items-center space-x-2 border rounded p-3">
                    <RadioGroupItem value={doc.type} id={doc.type} />
                    <Label htmlFor={doc.type} className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <div>
                          <p className="font-medium">{doc.label}</p>
                          <p className="text-xs text-muted-foreground">{doc.file.name}</p>
                        </div>
                      </div>
                    </Label>
                  </div>
                ))}
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
                  onClick={() => setStep(4)}
                  disabled={!selectedMarkupDoc}
                >
                  Next
                </Button>
              </div>
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
                  disabled={loading}
                  size="lg"
                  className="h-auto py-4"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <div className="text-left">
                    <p className="font-semibold">Request a Quote</p>
                    <p className="text-xs opacity-80">Submit all documents for admin review</p>
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
