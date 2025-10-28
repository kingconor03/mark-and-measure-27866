import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { HistoryAction } from "@/hooks/useHistory";

interface BulkPileEditPanelProps {
  selectedPileIds: string[];
  onUpdate: () => void;
  piles: any[];
  onPilesChange: (piles: any[]) => void;
  onHistoryAdd?: (action: HistoryAction) => void;
}

export default function BulkPileEditPanel({ selectedPileIds, onUpdate, piles, onPilesChange, onHistoryAdd }: BulkPileEditPanelProps) {
  const [pileType, setPileType] = useState<string>("");
  const [bladeSize, setBladeSize] = useState<string>("");
  const [extension, setExtension] = useState<string>("");
  const [color, setColor] = useState<string>("#FF6400");

    const handleApplyChanges = async () => {
    if (selectedPileIds.length === 0) return;

    try {
      const updates: any = {};
      if (pileType) updates.pile_type = pileType;
      if (bladeSize) updates.blade_size = bladeSize;
      if (extension) updates.extension = extension;
      
      // If pile type changed, update color to match new pile type
      if (pileType && color) {
        updates.color = color;
      } else if (color) {
        updates.color = color;
      }

      if (Object.keys(updates).length === 0) {
        toast.info("No changes to apply");
        return;
      }

      // Store old piles for history
      const oldPiles = piles.filter(pile => selectedPileIds.includes(pile.id));

      await supabase
        .from("piles")
        .update(updates)
        .in("id", selectedPileIds);

      // Update local state immediately to avoid refetching and position snap-back
      const updatedPiles = piles.map(pile => {
        if (selectedPileIds.includes(pile.id)) {
          return { ...pile, ...updates };
        }
        return pile;
      });
      onPilesChange(updatedPiles);

      // Add to history for each pile
      if (onHistoryAdd) {
        const newPiles = updatedPiles.filter(pile => selectedPileIds.includes(pile.id));
        oldPiles.forEach((oldPile, index) => {
          onHistoryAdd({ 
            type: 'UPDATE_PILE', 
            oldPile, 
            newPile: newPiles[index] 
          });
        });
      }

      toast.success(`Updated ${selectedPileIds.length} pile(s)`);
      
      // Reset selections
      setPileType("");
      setBladeSize("");
      setExtension("");
      setColor("#FF6400");
    } catch (error) {
      console.error("Error updating piles:", error);
      toast.error("Failed to update piles");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Bulk Edit ({selectedPileIds.length} selected)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Pile Type</Label>
          <Select value={pileType} onValueChange={setPileType}>
            <SelectTrigger>
              <SelectValue placeholder="Keep current" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="76mm">76mm</SelectItem>
              <SelectItem value="89.9mm">89.9mm</SelectItem>
              <SelectItem value="114.3mm">114.3mm</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Blade Size</Label>
          <Select value={bladeSize} onValueChange={setBladeSize}>
            <SelectTrigger>
              <SelectValue placeholder="Keep current" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="250mm">250mm</SelectItem>
              <SelectItem value="350mm">350mm</SelectItem>
              <SelectItem value="400mm">400mm</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Extension</Label>
          <Select value={extension} onValueChange={setExtension}>
            <SelectTrigger>
              <SelectValue placeholder="Keep current" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="None">None</SelectItem>
              <SelectItem value="0.5m">0.5m</SelectItem>
              <SelectItem value="1.0m">1.0m</SelectItem>
              <SelectItem value="1.5m">1.5m</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Color</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-full cursor-pointer rounded border border-border"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Changes color for selected piles only
          </p>
        </div>

        <Button onClick={handleApplyChanges} className="w-full">
          Apply Changes
        </Button>
      </CardContent>
    </Card>
  );
}
