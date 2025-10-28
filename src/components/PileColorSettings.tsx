import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Settings } from "lucide-react";

export interface PileColors {
  "76mm": string;
  "89.9mm": string;
  "114.3mm": string;
}

interface PileColorSettingsProps {
  colors: PileColors;
  onColorsChange: (colors: PileColors) => void;
}

const defaultColors: PileColors = {
  "76mm": "#FF6400",
  "89.9mm": "#00A3FF",
  "114.3mm": "#00D68F",
};

export function PileColorSettings({ colors, onColorsChange }: PileColorSettingsProps) {
  const [localColors, setLocalColors] = useState<PileColors>(colors);

  const handleColorChange = (pileType: keyof PileColors, color: string) => {
    const newColors = { ...localColors, [pileType]: color };
    setLocalColors(newColors);
    onColorsChange(newColors);
  };

  const handleReset = () => {
    setLocalColors(defaultColors);
    onColorsChange(defaultColors);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" title="Configure pile colors">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pile Color Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {Object.entries(localColors).map(([pileType, color]) => (
            <div key={pileType} className="flex items-center justify-between gap-4">
              <Label className="min-w-[100px]">{pileType}</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => handleColorChange(pileType as keyof PileColors, e.target.value)}
                  className="h-10 w-20 cursor-pointer rounded border border-border"
                />
                <div
                  className="h-10 w-10 rounded border border-border"
                  style={{ backgroundColor: color }}
                />
              </div>
            </div>
          ))}
          <Button onClick={handleReset} variant="outline" className="w-full">
            Reset to Defaults
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function usePileColors(): [PileColors, (colors: PileColors) => void] {
  const [colors, setColors] = useState<PileColors>(() => {
    const saved = localStorage.getItem("pileColors");
    return saved ? JSON.parse(saved) : defaultColors;
  });

  useEffect(() => {
    localStorage.setItem("pileColors", JSON.stringify(colors));
  }, [colors]);

  return [colors, setColors];
}

export { defaultColors };
