import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PileColorSettings, PileColors } from "@/components/PileColorSettings";

interface PileToolSettingsProps {
  pileType: string;
  bladeSize: string;
  length: string;
  extension: string;
  nextNumber: number;
  scale: number;
  pileColors: PileColors;
  customColor: string | null;
  piles: any[];
  onPileTypeChange: (value: string) => void;
  onBladeSizeChange: (value: string) => void;
  onLengthChange: (value: string) => void;
  onExtensionChange: (value: string) => void;
  onNextNumberChange: (value: number) => void;
  onScaleChange: (value: number) => void;
  onPileColorsChange: (colors: PileColors) => void;
  onCustomColorChange: (color: string | null) => void;
}

const pileTypeOptions = [
  { value: "76mm", label: "76mm", defaultBlade: "250mm" },
  { value: "89.9mm", label: "89.9mm", defaultBlade: "350mm" },
  { value: "114.3mm", label: "114.3mm", defaultBlade: "400mm" },
];

const bladeSizeOptions = ["250mm", "300mm", "350mm", "400mm", "Custom..."];
const lengthOptions = ["1.0m", "1.5m", "2.0m", "3.0m", "4.0m", "5.0m", "Custom..."];
const extensionOptions = ["None", "1m", "2m", "3m", "Custom..."];

export default function PileToolSettings({
  pileType,
  bladeSize,
  length,
  extension,
  nextNumber,
  scale,
  pileColors,
  customColor,
  piles,
  onPileTypeChange,
  onBladeSizeChange,
  onLengthChange,
  onExtensionChange,
  onNextNumberChange,
  onScaleChange,
  onPileColorsChange,
  onCustomColorChange,
}: PileToolSettingsProps) {
  // Get the default color for current pile type
  const defaultColor = pileColors[pileType as keyof PileColors] || "#FF6400";
  const displayColor = customColor || defaultColor;
  
  // Get all unique colors currently used in piles (including default colors)
  const usedColors = Array.from(new Set(
    piles.map(p => p.color || pileColors[p.pile_type as keyof PileColors] || "#FF6400")
  ));

  return (
    <div className="space-y-4">
      <div className="pb-4 border-b">
        <PileColorSettings colors={pileColors} onColorsChange={onPileColorsChange} />
      </div>
      
      {/* Custom Color Override for Next Piles */}
      <div className="space-y-2 pb-4 border-b">
        <Label>Custom Color (Next Piles)</Label>
        <div className="flex gap-2 items-center">
          <div className="flex-1 flex items-center gap-2">
            <input
              type="color"
              value={displayColor}
              onChange={(e) => onCustomColorChange(e.target.value)}
              className="w-10 h-10 rounded border border-border cursor-pointer"
            />
            <span className="text-xs text-muted-foreground">
              {customColor ? "Custom color active" : "Using default color"}
            </span>
          </div>
          {customColor && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCustomColorChange(null)}
              className="text-xs"
            >
              Reset
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Set a custom color to distinguish piles with different specifications
        </p>
        
        {/* Previously Used Colors */}
        {usedColors.length > 0 && (
          <div className="mt-3 space-y-2">
            <Label className="text-xs">Previously Used Colors</Label>
            <div className="flex flex-wrap gap-2">
              {usedColors.map((color, index) => (
                <button
                  key={`${color}-${index}`}
                  onClick={() => onCustomColorChange(color)}
                  className={`w-8 h-8 rounded border-2 cursor-pointer transition-all hover:scale-110 ${
                    displayColor === color ? 'border-primary ring-2 ring-primary ring-offset-2' : 'border-border'
                  }`}
                  style={{ backgroundColor: color }}
                  title={`Click to use this color (${color})`}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Click any color to reuse it for the next piles
            </p>
          </div>
        )}
      </div>
      <div className="space-y-2">
        <Label>Pile Type</Label>
        <Select value={pileType} onValueChange={onPileTypeChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pileTypeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Blade Size</Label>
        <Select value={bladeSize} onValueChange={onBladeSizeChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {bladeSizeOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Length</Label>
        <Select value={length} onValueChange={onLengthChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {lengthOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Extension</Label>
        <Select value={extension} onValueChange={onExtensionChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {extensionOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Next Pile #</Label>
        <Input
          type="number"
          value={nextNumber}
          onChange={(e) => onNextNumberChange(parseInt(e.target.value) || 1)}
          min={1}
        />
      </div>

      <div className="space-y-2">
        <Label>Scale</Label>
        <Input
          type="number"
          value={scale}
          onChange={(e) => onScaleChange(parseFloat(e.target.value) || 1)}
          min={0.5}
          max={3}
          step={0.1}
        />
      </div>
    </div>
  );
}
