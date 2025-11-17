import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  ArrowLeft, 
  Folder, 
  FileText, 
  Download, 
  Eye, 
  Edit,
  Loader2,
  Trash2,
  Upload,
  Plus
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PDFViewer } from "@/components/PDFViewer";
import { useAuth } from "@/hooks/useAuth";
import { useOrganisation } from "@/hooks/useOrganisation";

type DocumentType = "installation_details" | "markup";

interface ProjectAsset {
  id: string;
  path: string;
  kind: string;
  document_type: string | null;
  meta: any;
  created_at: string;
}

const folderConfig: Record<DocumentType, { label: string; icon: typeof Folder }> = {
  installation_details: { label: "Installation Details", icon: Folder },
  markup: { label: "Markup", icon: Folder },
};

export default function ProjectFolderView() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrg } = useOrganisation();
  const [project, setProject] = useState<any>(null);
  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<ProjectAsset | null>(null);
  const [viewingPdf, setViewingPdf] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<ProjectAsset | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showRemarkupPrompt, setShowRemarkupPrompt] = useState(false);

  useEffect(() => {
    if (projectId) {
      fetchProjectData();
    }
  }, [projectId]);

  const fetchProjectData = async () => {
    try {
      // Fetch project
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (projectError) throw projectError;
      setProject(projectData);

      // Fetch all assets for this project (including those without document_type)
      const { data: assetsData, error: assetsError } = await supabase
        .from("project_assets")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (assetsError) throw assetsError;
      
      // Process assets - map old document types to installation_details
      const processedAssets = (assetsData || []).map((asset: any) => {
        // Convert old document types to installation_details
        if (asset.document_type && 
            (asset.document_type === "soil_report" || 
             asset.document_type === "structural" || 
             asset.document_type === "architectural" ||
             asset.document_type === "engineering")) {
          return { ...asset, document_type: "installation_details" };
        }
        // If no document_type but it's not markup, set to installation_details
        if (!asset.document_type && asset.kind !== "page_image") {
          return { ...asset, document_type: "installation_details" };
        }
        return asset;
      });
      
      setAssets(processedAssets);

      // Also check for pages (these are markup page images)
      const { data: pagesData } = await supabase
        .from("pages")
        .select("id, project_id, page_number, image_url, created_at")
        .eq("project_id", projectId)
        .order("page_number");

      if (pagesData && pagesData.length > 0) {
        // Create virtual assets for markup pages
        const markupAssets = pagesData.map((page) => ({
          id: page.id,
          path: page.image_url,
          kind: "page_image",
          document_type: "markup",
          meta: { page_number: page.page_number, fileName: `Page ${page.page_number}` },
          created_at: page.created_at,
        }));
        setAssets((prev) => [...prev, ...markupAssets]);
      }
    } catch (error: any) {
      console.error("Error fetching project:", error);
      toast.error("Failed to load project");
    } finally {
      setLoading(false);
    }
  };

  const getAssetsByFolder = (folder: DocumentType): ProjectAsset[] => {
    if (folder === "installation_details") {
      // Include all assets that are not markup
      return assets.filter((asset) => 
        asset.document_type === "installation_details" || 
        (asset.document_type !== "markup" && asset.kind !== "page_image")
      );
    } else {
      // Markup folder
      return assets.filter((asset) => 
        asset.document_type === "markup" || asset.kind === "page_image"
      );
    }
  };

  const getFileUrl = (asset: ProjectAsset): string => {
    const bucket = project?.organisation_id ? "org-assets" : "blueprints";
    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${bucket}/${asset.path}`;
  };

  const handleDownload = async (asset: ProjectAsset) => {
    try {
      const url = getFileUrl(asset);
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = asset.meta?.fileName || `file-${asset.id}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
      toast.success("File downloaded");
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Failed to download file");
    }
  };

  const handleViewPdf = (asset: ProjectAsset) => {
    // Can view PDFs and markup page images
    if (asset.kind === "pdf" || asset.kind === "page_image" || asset.document_type === "markup") {
      setSelectedFile(asset);
      setViewingPdf(true);
    } else {
      toast.error("This file type cannot be previewed");
    }
  };

  const handleOpenMarkup = () => {
    navigate(`/editor/${projectId}`);
  };

  const handleDeleteFile = async () => {
    if (!fileToDelete) return;

    setDeleting(true);
    try {
      const bucket = project?.organisation_id ? "org-assets" : "blueprints";

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from(bucket)
        .remove([fileToDelete.path]);

      if (storageError) {
        console.error("Storage delete error:", storageError);
        // Continue to delete DB record even if storage fails
      }

      // Delete from project_assets (or pages if it's a page image)
      if (fileToDelete.kind === "page_image") {
        const { error: pageError } = await supabase
          .from("pages")
          .delete()
          .eq("id", fileToDelete.id);

        if (pageError) throw pageError;
      } else {
        const { error: assetError } = await supabase
          .from("project_assets")
          .delete()
          .eq("id", fileToDelete.id);

        if (assetError) throw assetError;
      }

      toast.success("File deleted successfully");
      setFileToDelete(null);
      fetchProjectData(); // Refresh the list
    } catch (error: any) {
      console.error("Error deleting file:", error);
      toast.error("Failed to delete file: " + (error.message || "Unknown error"));
    } finally {
      setDeleting(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !projectId || !user) return;

    if (file.type !== "application/pdf") {
      toast.error("Please select a valid PDF file");
      return;
    }

    const MAX_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_SIZE) {
      toast.error("File size must be less than 50MB");
      return;
    }

    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", projectId);
      formData.append("fileName", file.name);

      const { data: uploadData, error: uploadError } = await supabase.functions.invoke("upload-blueprint", {
        body: formData,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (uploadError) throw uploadError;
      if (!uploadData?.success) throw new Error("Failed to upload file");

      // Store installation_details version in project_assets
      // Note: document_type column must exist (run migration 20251106000003_fix_project_assets_schema.sql)
      const { error: installAssetError } = await supabase.from("project_assets").insert({
        project_id: projectId,
        path: uploadData.path,
        kind: "pdf",
        document_type: "installation_details",
        meta: { fileName: file.name, label: "Installation Details" },
      });

      if (installAssetError) {
        console.error('Error inserting installation_details asset:', installAssetError);
        // Continue - this is not critical for the workflow
      }

      // If markup version exists, also store it
      if (uploadData.markupPath) {
        const { error: markupAssetError } = await supabase.from("project_assets").insert({
          project_id: projectId,
          path: uploadData.markupPath,
          kind: "pdf",
          document_type: "markup",
          meta: { fileName: file.name.replace(/\.pdf$/i, '_markup.pdf'), label: "Installation Details (Markup)" },
        });

        if (markupAssetError) {
          console.error('Error inserting markup asset:', markupAssetError);
          // Continue - this is not critical for the workflow
        }
      }

      toast.success("File uploaded successfully");
      fetchProjectData();
      setShowRemarkupPrompt(true);
    } catch (error: any) {
      console.error("Error uploading file:", error);
      toast.error("Failed to upload file: " + (error.message || "Unknown error"));
    } finally {
      setUploading(false);
      event.target.value = ""; // Reset input
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen">
        <DashboardSidebar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-screen">
        <DashboardSidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Project not found</p>
            <Button onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
          </div>
        </div>
      </div>
    );
  }

  if (viewingPdf && selectedFile) {
    return (
      <PDFViewer
        fileUrl={getFileUrl(selectedFile)}
        fileName={selectedFile.meta?.fileName || "Document"}
        isImage={selectedFile.kind === "page_image"}
        onClose={() => {
          setViewingPdf(false);
          setSelectedFile(null);
        }}
      />
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <DashboardSidebar />
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="border-b bg-card px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/dashboard")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{project.name}</h1>
                <p className="text-sm text-muted-foreground">Project Files</p>
              </div>
            </div>
            <Button onClick={handleOpenMarkup}>
              <Edit className="h-4 w-4 mr-2" />
              Open Markup Editor
            </Button>
          </div>
        </header>

        {/* Folder Content */}
        <div className="p-6 space-y-6">
          {Object.entries(folderConfig).map(([folder, config]) => {
            const folderAssets = getAssetsByFolder(folder as DocumentType);
            const Icon = config.icon;
            const isInstallationDetails = folder === "installation_details";

            return (
              <Card key={folder}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Icon className="h-5 w-5" />
                      {config.label}
                      <span className="text-sm font-normal text-muted-foreground">
                        ({folderAssets.length} {folderAssets.length === 1 ? "file" : "files"})
                      </span>
                    </CardTitle>
                    {isInstallationDetails && (
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          accept=".pdf"
                          onChange={handleFileUpload}
                          className="hidden"
                          id={`upload-${folder}`}
                          disabled={uploading}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById(`upload-${folder}`)?.click()}
                          disabled={uploading}
                        >
                          {uploading ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4 mr-2" />
                              Upload File
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {folderAssets.length === 0 ? (
                    <div className="py-4">
                      <p className="text-sm text-muted-foreground mb-4">
                        No files in this folder
                      </p>
                      {isInstallationDetails && (
                        <>
                          <input
                            type="file"
                            accept=".pdf"
                            onChange={handleFileUpload}
                            className="hidden"
                            id={`upload-empty-${folder}`}
                            disabled={uploading}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => document.getElementById(`upload-empty-${folder}`)?.click()}
                            disabled={uploading}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Your First File
                          </Button>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {folderAssets.map((asset) => (
                        <Card key={asset.id} className="hover:shadow-md transition-shadow group">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">
                                    {asset.meta?.fileName || `File ${asset.id.slice(0, 8)}`}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {new Date(asset.created_at).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {(asset.kind === "pdf" || asset.kind === "page_image" || asset.document_type === "markup") && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleViewPdf(asset)}
                                    title="View"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleDownload(asset)}
                                  title="Download"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                {asset.kind !== "page_image" && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                                    onClick={() => setFileToDelete(asset)}
                                    title="Delete"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Delete File Confirmation Dialog */}
        <AlertDialog open={!!fileToDelete} onOpenChange={(open) => !open && setFileToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete File</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{fileToDelete?.meta?.fileName || "this file"}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteFile}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Re-markup Prompt */}
        <AlertDialog open={showRemarkupPrompt} onOpenChange={setShowRemarkupPrompt}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>New Files Uploaded</AlertDialogTitle>
              <AlertDialogDescription>
                You've uploaded new installation details. Would you like to create new markup drawings for these files?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Not Now</AlertDialogCancel>
              <AlertDialogAction onClick={() => {
                setShowRemarkupPrompt(false);
                navigate(`/editor/${projectId}`);
              }}>
                Create Markup
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}

