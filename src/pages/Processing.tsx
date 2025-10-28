import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Processing = () => {
  const { projectId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("Analyzing blueprint...");

  const { projectName, fileName, totalPages } = location.state || {
    projectName: "Unknown Project",
    fileName: "blueprint.pdf",
    totalPages: 0,
  };

  useEffect(() => {
    if (!projectId) {
      navigate("/dashboard");
      return;
    }

    let pollInterval: NodeJS.Timeout;
    let hasNavigated = false;

    const pollProjectStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          toast.error("Session expired");
          navigate("/auth");
          return;
        }

        const { data, error } = await supabase.functions.invoke("check-project-status", {
          body: { projectId },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          }
        });

        if (error) throw error;

        const { status, pagesConverted } = data;

        if (status === "completed") {
          setProgress(100);
          setStatusMessage("Complete!");
          clearInterval(pollInterval);
          
          if (!hasNavigated) {
            hasNavigated = true;
            setTimeout(() => {
              navigate(`/editor/${projectId}`);
            }, 500);
          }
        } else if (status === "processing") {
          // Calculate progress based on pages converted
          if (totalPages > 0) {
            const calculatedProgress = Math.min(95, (pagesConverted / totalPages) * 100);
            setProgress(calculatedProgress);
            setStatusMessage(`Converting pages... ${pagesConverted}/${totalPages}`);
          } else {
            // Estimated progress if we don't know total pages
            setProgress(prev => Math.min(95, prev + 5));
            setStatusMessage(`Converting pages... ${pagesConverted} pages ready`);
          }
        } else if (status === "failed") {
          clearInterval(pollInterval);
          toast.error("PDF processing failed. Please try again.");
          navigate("/dashboard");
        }
      } catch (error) {
        console.error("Error polling project status:", error);
        clearInterval(pollInterval);
        toast.error("Failed to check processing status");
        navigate("/dashboard");
      }
    };

    // Poll immediately, then every 2 seconds
    pollProjectStatus();
    pollInterval = setInterval(pollProjectStatus, 2000);

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [projectId, navigate, totalPages]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Spinner */}
        <div className="flex justify-center">
          <Loader2 className="h-16 w-16 text-primary animate-spin" />
        </div>

        {/* Project Info */}
        <div>
          <h1 className="text-2xl font-bold mb-2">{projectName}</h1>
          <p className="text-sm text-muted-foreground">Processing {fileName}</p>
        </div>

        {/* Progress Bar */}
        <div className="w-full">
          <div className="bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="bg-primary h-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {progress < 100 ? `${statusMessage} ${Math.round(progress)}%` : "Complete!"}
          </p>
        </div>

        {/* Info Text */}
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          We're converting your PDF to high-quality images and preparing the canvas. 
          This usually takes 10-30 seconds depending on the file size.
        </p>
      </div>
    </div>
  );
};

export default Processing;
