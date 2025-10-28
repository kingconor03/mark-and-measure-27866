import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

interface FootingToolSettingsProps {
  footingType: string;
  drawingMode: string;
  footingOpacity: number;
  onFootingTypeChange: (value: string) => void;
  onDrawingModeChange: (value: string) => void;
  onFootingOpacityChange: (value: number) => void;
}

const footingTypeOptions = [
  "SF1",
  "SF2",
  "Pad Footing",
  "Strip Footing",
  "Custom Type...",
];

export default function FootingToolSettings({
  footingType,
  drawingMode,
  footingOpacity,
  onFootingTypeChange,
  onDrawingModeChange,
  onFootingOpacityChange,
}: FootingToolSettingsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Footing Type</Label>
        <Select value={footingType} onValueChange={onFootingTypeChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {footingTypeOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Drawing Mode</Label>
        <Select value={drawingMode} onValueChange={onDrawingModeChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rectangle">Rectangle</SelectItem>
            <SelectItem value="polygon">Polygon</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Opacity: {Math.round(footingOpacity * 100)}%</Label>
        <Slider
          value={[footingOpacity]}
          onValueChange={([value]) => onFootingOpacityChange(value)}
          min={0.2}
          max={1}
          step={0.05}
          className="w-full"
        />
      </div>
    </div>
  );
}
