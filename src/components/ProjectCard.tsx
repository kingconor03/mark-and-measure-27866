import { Card } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { Link } from "react-router-dom";
import blueprintSample from "@/assets/blueprint-sample.png";

interface ProjectCardProps {
  id: string;
  name: string;
  lastModified: string;
  status: "in-progress" | "completed";
  thumbnail?: string;
}

export const ProjectCard = ({ id, name, lastModified, status, thumbnail }: ProjectCardProps) => {
  const statusColors = {
    "in-progress": "bg-primary",
    "completed": "bg-green-500",
  };

  return (
    <Link to={`/editor/${id}`}>
      <Card className="overflow-hidden hover:shadow-lg transition-all duration-200 group cursor-pointer">
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
      </Card>
    </Link>
  );
};
