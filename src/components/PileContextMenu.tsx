import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PileContextMenuProps {
  position: { x: number; y: number };
  selectedPileIds: string[];
  onClose: () => void;
  onUpdate: () => void;
}

export default function PileContextMenu({ position, selectedPileIds, onClose, onUpdate }: PileContextMenuProps) {
  const [pileType, setPileType] = useState("");
  const [bladeSize, setBladeSize] = useState("");
  const [extension, setExtension] = useState("");
  const [color, setColor] = useState("");

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".pile-context-menu")) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const handleBulkUpdate = async () => {
    try {
      const updates: any = {};
      if (pileType) updates.pile_type = pileType;
      if (bladeSize) updates.blade_size = bladeSize;
      if (extension) updates.extension = extension;

      if (Object.keys(updates).length > 0) {
        await supabase
          .from("piles")
          .update(updates)
          .in("id", selectedPileIds);

        toast.success(`Updated ${selectedPileIds.length} pile(s)`);
        onUpdate();
        onClose();
      } else {
        toast.error("Please select at least one property to update");
      }
    } catch (error) {
      console.error("Error updating piles:", error);
      toast.error("Failed to update piles");
    }
  };

  return (
    <Card
      className="pile-context-menu fixed z-[100] p-4 shadow-lg min-w-[280px]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <div className="space-y-4">
        <div className="font-semibold text-sm border-b pb-2">
          Bulk Edit {selectedPileIds.length} Pile(s)
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Pile Type</Label>
            <Select value={pileType} onValueChange={setPileType}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Keep current" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="76mm">76mm</SelectItem>
                <SelectItem value="89.9mm">89.9mm</SelectItem>
                <SelectItem value="114.3mm">114.3mm</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Blade Size</Label>
            <Select value={bladeSize} onValueChange={setBladeSize}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Keep current" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="250mm">250mm</SelectItem>
                <SelectItem value="350mm">350mm</SelectItem>
                <SelectItem value="400mm">400mm</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Extension</Label>
            <Select value={extension} onValueChange={setExtension}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Keep current" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="None">None</SelectItem>
                <SelectItem value="500mm">500mm</SelectItem>
                <SelectItem value="1000mm">1000mm</SelectItem>
                <SelectItem value="1500mm">1500mm</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button size="sm" onClick={handleBulkUpdate} className="flex-1">
              Apply
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
