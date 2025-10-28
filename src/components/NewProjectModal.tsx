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
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface NewProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated?: () => void;
}

export const NewProjectModal = ({ open, onOpenChange, onProjectCreated }: NewProjectModalProps) => {
  const [projectName, setProjectName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    const MAX_SIZE = 50 * 1024 * 1024; // 50MB
    
    if (!selectedFile) return;
    
    if (selectedFile.type !== "application/pdf") {
      toast.error("Please select a valid PDF file");
      return;
    }
    
    if (selectedFile.size > MAX_SIZE) {
      toast.error("File size must be less than 50MB");
      return;
    }
    
    setFile(selectedFile);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName || !file || !user) {
      toast.error("Please provide a project name and upload a PDF");
      return;
    }

    setLoading(true);

    try {
      // Create project record
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .insert({
          name: projectName,
          user_id: user.id,
          status: "processing"
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // Upload PDF using the secure edge function
      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectId', project.id);
      formData.append('fileName', file.name);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const { data: uploadData, error: uploadError } = await supabase.functions.invoke("upload-blueprint", {
        body: formData,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        }
      });

      if (uploadError) throw uploadError;
      if (!uploadData?.success) throw new Error('Upload failed');

      // Construct the storage URL for the PDF
      const pdfUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/blueprints/${uploadData.path}`;

      // Update project with PDF URL
      await supabase
        .from("projects")
        .update({ pdf_url: pdfUrl })
        .eq("id", project.id);

      // Call edge function to process PDF (async - don't wait)
      supabase.functions.invoke("process-pdf", {
        body: { projectId: project.id }
      }).catch(error => {
        console.error("PDF processing error:", error);
      });

      toast.success("Project created! Processing PDF...");
      setProjectName("");
      setFile(null);
      onOpenChange(false);
      
      if (onProjectCreated) {
        onProjectCreated();
      }
      
      // Navigate to processing page immediately (polling will handle status)
      navigate(`/processing/${project.id}`, { 
        state: { 
          projectName: project.name, 
          fileName: file.name,
          totalPages: 0 // Will be determined during processing
        } 
      });

    } catch (error: any) {
      toast.error(error.message || "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
          <DialogDescription>
            Upload a blueprint PDF to create a new markup project
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="project-name">Project Name</Label>
            <Input
              id="project-name"
              placeholder="e.g., Downtown Bridge Foundation"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="file-upload">Blueprint PDF</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
              <input
                id="file-upload"
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
                disabled={loading}
              />
              <label
                htmlFor="file-upload"
                className="flex flex-col items-center gap-2 cursor-pointer"
              >
                <Upload className="h-10 w-10 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {file ? file.name : "Click to upload or drag and drop"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF files only (max 50MB)
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Project
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default NewProjectModal;
