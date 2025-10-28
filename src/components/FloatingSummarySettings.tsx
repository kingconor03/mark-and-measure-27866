import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { GripVertical } from "lucide-react";

interface FloatingSummarySettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scale: number;
  textSize: number;
  keySize: number;
  onSave: (settings: { scale: number; textSize: number; keySize: number; headingSize: number }) => void;
}

type SelectedArea = 'heading' | 'bodyText' | 'legendKey' | 'scale' | null;

export default function FloatingSummarySettings({ open, onOpenChange, scale, textSize, keySize, onSave }: FloatingSummarySettingsProps) {
  const [localScale, setLocalScale] = useState(scale);
  const [localTextSize, setLocalTextSize] = useState(textSize);
  const [localKeySize, setLocalKeySize] = useState(keySize);
  const [localHeadingSize, setLocalHeadingSize] = useState(1);
  const [selectedArea, setSelectedArea] = useState<SelectedArea>('scale');

  const handleSave = () => {
    onSave({ scale: localScale, textSize: localTextSize, keySize: localKeySize, headingSize: localHeadingSize });
    onOpenChange(false);
  };

  const handleReset = () => {
    setLocalScale(1.0);
    setLocalTextSize(0.875);
    setLocalKeySize(0.75);
    setLocalHeadingSize(1);
    setSelectedArea('scale');
  };

  const renderControls = () => {
    switch (selectedArea) {
      case 'scale':
        return (
          <div className="space-y-2">
            <Label htmlFor="scale">Panel Scale: {localScale.toFixed(1)}x</Label>
            <Slider
              id="scale"
              min={0.5}
              max={2}
              step={0.1}
              value={[localScale]}
              onValueChange={([value]) => setLocalScale(value)}
            />
            <p className="text-xs text-muted-foreground">
              Scales the entire panel
            </p>
          </div>
        );
      case 'heading':
        return (
          <div className="space-y-2">
            <Label htmlFor="headingSize">Heading Size: {localHeadingSize.toFixed(2)}rem</Label>
            <Slider
              id="headingSize"
              min={0.75}
              max={1.5}
              step={0.05}
              value={[localHeadingSize]}
              onValueChange={([value]) => setLocalHeadingSize(value)}
            />
            <p className="text-xs text-muted-foreground">
              Adjusts "Total Piles" and "Total Footings" text size
            </p>
          </div>
        );
      case 'bodyText':
        return (
          <div className="space-y-2">
            <Label htmlFor="textSize">Body Text Size: {localTextSize.toFixed(2)}rem</Label>
            <Slider
              id="textSize"
              min={0.5}
              max={1.5}
              step={0.05}
              value={[localTextSize]}
              onValueChange={([value]) => setLocalTextSize(value)}
            />
            <p className="text-xs text-muted-foreground">
              Adjusts pile/footing details text size
            </p>
          </div>
        );
      case 'legendKey':
        return (
          <div className="space-y-2">
            <Label htmlFor="keySize">Legend Key Size: {localKeySize.toFixed(2)}rem</Label>
            <Slider
              id="keySize"
              min={0.5}
              max={1.5}
              step={0.05}
              value={[localKeySize]}
              onValueChange={([value]) => setLocalKeySize(value)}
            />
            <p className="text-xs text-muted-foreground">
              Adjusts the size of color indicators
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Summary Display Settings</DialogTitle>
          <DialogDescription>
            Click on different areas of the preview to customize them
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-6 py-4">
          {/* Preview Panel */}
          <div className="space-y-4">
            <Label>Preview (Click to Select)</Label>
            <Card
              className="bg-card border-2 cursor-pointer transition-all"
              style={{
                transform: `scale(${localScale})`,
                transformOrigin: "top left",
              }}
              onClick={() => setSelectedArea('scale')}
            >
              <div
                className={`bg-primary text-primary-foreground px-4 py-2 flex items-center justify-between rounded-t-lg transition-all ${
                  selectedArea === 'scale' ? 'ring-2 ring-yellow-400' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4" />
                  <h3 className="font-semibold text-sm">Project Summary</h3>
                </div>
              </div>
              
              <div className="p-4 space-y-3">
                <div>
                  <div
                    className={`font-semibold mb-1 cursor-pointer transition-all ${
                      selectedArea === 'heading' ? 'ring-2 ring-yellow-400 rounded px-1' : ''
                    }`}
                    style={{ fontSize: `${localHeadingSize}rem` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedArea('heading');
                    }}
                  >
                    Total Piles: 5
                  </div>
                  <div className="border-t border-border pt-2 mt-2 space-y-2">
                    <div
                      className={`space-y-2 cursor-pointer transition-all ${
                        selectedArea === 'bodyText' ? 'ring-2 ring-yellow-400 rounded p-1' : ''
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedArea('bodyText');
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`rounded-full border border-border flex-shrink-0 transition-all ${
                            selectedArea === 'legendKey' ? 'ring-2 ring-yellow-400' : ''
                          }`}
                          style={{ 
                            backgroundColor: '#FF6400',
                            width: `${localKeySize}rem`,
                            height: `${localKeySize}rem`,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedArea('legendKey');
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold" style={{ fontSize: `${localTextSize}rem` }}>
                            76mm w/ 250mm Blade
                          </div>
                          <div className="text-muted-foreground/80" style={{ fontSize: `${localTextSize}rem` }}>
                            Total: 3 "1-3"
                          </div>
                        </div>
                      </div>
                      <div className="ml-5 flex items-center gap-3" style={{ fontSize: `${localTextSize}rem` }}>
                        <span className="text-muted-foreground">Min Depth: 2.8m</span>
                        <span className="text-muted-foreground">Min Torque: 5000 Nm</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border pt-3">
                  <div
                    className={`font-semibold mb-1 cursor-pointer transition-all ${
                      selectedArea === 'heading' ? 'ring-2 ring-yellow-400 rounded px-1' : ''
                    }`}
                    style={{ fontSize: `${localHeadingSize}rem` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedArea('heading');
                    }}
                  >
                    Total Footings: 2
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Controls Panel */}
          <div className="space-y-4">
            <Label>
              {selectedArea === 'scale' && 'Panel Scale'}
              {selectedArea === 'heading' && 'Heading Size'}
              {selectedArea === 'bodyText' && 'Body Text Size'}
              {selectedArea === 'legendKey' && 'Legend Key Size'}
            </Label>
            <div className="border rounded-lg p-4 min-h-[200px]">
              {renderControls()}
            </div>
          </div>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={handleReset}>
            Reset to Defaults
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
