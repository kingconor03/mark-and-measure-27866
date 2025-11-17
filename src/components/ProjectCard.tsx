import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Clock, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import blueprintSample from "@/assets/blueprint-sample.png";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProjectCardProps {
  id: string;
  name: string;
  lastModified: string;
  status: "in-progress" | "completed";
  thumbnail?: string;
  onDelete?: () => void;
}

export const ProjectCard = ({ id, name, lastModified, status, thumbnail, onDelete }: ProjectCardProps) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const statusColors = {
    "in-progress": "bg-primary",
    "completed": "bg-green-500",
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Project deleted successfully");
      if (onDelete) onDelete();
    } catch (error: any) {
      console.error("Error deleting project:", error);
      toast.error("Failed to delete project: " + (error.message || "Unknown error"));
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <>
      <Card className="overflow-hidden hover:shadow-lg transition-all duration-200 group relative">
        <Link to={`/project/${id}`} className="block">
          {/* Thumbnail */}
          <div className="aspect-video bg-muted overflow-hidden">
            <img
              src={thumbnail || blueprintSample}
              alt={name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            />
          </div>

          {/* Content */}
          <div className="p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-semibold text-card-foreground line-clamp-1">{name}</h3>
              <div
                className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${statusColors[status]}`}
                title={status}
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>{lastModified}</span>
            </div>
          </div>
        </Link>

        {/* Delete Button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-destructive hover:text-destructive-foreground"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowDeleteDialog(true);
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{name}"? This action cannot be undone and will delete all associated files, pages, and markups.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
