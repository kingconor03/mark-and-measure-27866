import { Button } from "@/components/ui/button";
import { MousePointer2, Hand, Hammer, Square, Trash2, Undo2, Redo2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

interface MarkupToolbarProps {
  activeTool: string;
  onToolChange: (tool: string) => void;
  onClearAll: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

const tools = [
  { id: "select", icon: MousePointer2, label: "Select" },
  { id: "pan", icon: Hand, label: "Pan" },
  { id: "pile", icon: Hammer, label: "Add Pile" },
  { id: "footing", icon: Square, label: "Add Footing" },
];

export default function MarkupToolbar({ 
  activeTool, 
  onToolChange, 
  onClearAll,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}: MarkupToolbarProps) {
  return (
    <div className="w-16 border-r bg-card flex flex-col items-center py-4 gap-2">
      {tools.map((tool) => {
        const Icon = tool.icon;
        return (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
              <Button
                variant={activeTool === tool.id ? "default" : "ghost"}
                size="icon"
                onClick={() => onToolChange(tool.id)}
              >
                <Icon className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{tool.label}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
      
      <Separator className="my-2 w-10" />
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onUndo}
            disabled={!canUndo}
          >
            <Undo2 className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>Undo (Ctrl+Z)</p>
        </TooltipContent>
      </Tooltip>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRedo}
            disabled={!canRedo}
          >
            <Redo2 className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>Redo (Ctrl+Y)</p>
        </TooltipContent>
      </Tooltip>
      
      <Separator className="my-2 w-10" />
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClearAll}
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>Clear All</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
