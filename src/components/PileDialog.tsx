import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => void;
}

const pileTypes = [
  "Standard Screw", "Combo Screw", "Adjustable", "Standard Screw (GRAY)",
  "Double Helix", "Square Shaft", "Helical", "Custom"
];

const bladeSizes = ["10", "12", "14", "16", "18", "Custom"];
const lengths = ["4", "5", "6", "7", "8", "10", "12"];
const extensions = ["None", "1", "2", "3", "4", "5", "6"];

export default function PileDialog({ open, onOpenChange, onSubmit }: PileDialogProps) {
  const [pileType, setPileType] = useState(pileTypes[0]);
  const [bladeSize, setBladeSize] = useState(bladeSizes[2]);
  const [length, setLength] = useState(lengths[2]);
  const [extension, setExtension] = useState(extensions[0]);

  const handleSubmit = () => {
    onSubmit({
      pileType,
      bladeSize,
      length,
      extension: extension === "None" ? null : extension,
      isCustom: pileType === "Custom"
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Pile</DialogTitle>
          <DialogDescription>
            Configure the pile properties
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Pile Type</Label>
            <Select value={pileType} onValueChange={setPileType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pileTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Blade Size</Label>
            <Select value={bladeSize} onValueChange={setBladeSize}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {bladeSizes.map((size) => (
                  <SelectItem key={size} value={size}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Length</Label>
            <Select value={length} onValueChange={setLength}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {lengths.map((len) => (
                  <SelectItem key={len} value={len}>
                    {len}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Extension</Label>
            <Select value={extension} onValueChange={setExtension}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {extensions.map((ext) => (
                  <SelectItem key={ext} value={ext}>
                    {ext}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Add Pile</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
