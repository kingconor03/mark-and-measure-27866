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

interface FootingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => void;
}

const footingTypes = [
  "Spread Footing", "Strip Footing", "Raft Footing", "Pile Cap", "Custom"
];

const widths = ["12", "16", "18", "20", "24", "30", "36"];
const depths = ["12", "16", "18", "20", "24", "30"];

export default function FootingDialog({ open, onOpenChange, onSubmit }: FootingDialogProps) {
  const [footingType, setFootingType] = useState(footingTypes[0]);
  const [width, setWidth] = useState(widths[2]);
  const [depth, setDepth] = useState(depths[2]);

  const handleSubmit = () => {
    onSubmit({
      footingType,
      width,
      depth
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Footing</DialogTitle>
          <DialogDescription>
            Configure the footing properties
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Footing Type</Label>
            <Select value={footingType} onValueChange={setFootingType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {footingTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Width (inches)</Label>
            <Select value={width} onValueChange={setWidth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {widths.map((w) => (
                  <SelectItem key={w} value={w}>
                    {w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Depth (inches)</Label>
            <Select value={depth} onValueChange={setDepth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {depths.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
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
          <Button onClick={handleSubmit}>Add Footing</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
