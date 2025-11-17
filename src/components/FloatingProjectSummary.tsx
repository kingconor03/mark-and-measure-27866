import { useState, useEffect } from "react";
import { logger } from "@/lib/logger";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GripVertical, Settings, Pin, PinOff } from "lucide-react";
import { PileColors } from "@/components/PileColorSettings";
import { FootingColors } from "@/components/FootingColorSettings";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import FloatingSummarySettings from "@/components/FloatingSummarySettings";
import { toast } from "sonner";

interface FloatingProjectSummaryProps {
  piles: any[];
  footings: any[];
  pileColors: PileColors;
  footingColors: FootingColors;
  onPilesUpdate: (piles: any[]) => void;
  onFootingsUpdate: (footings: any[]) => void;
  onFootingColorChange?: (footingType: string, color: string) => void;
}

export default function FloatingProjectSummary({ piles, footings, pileColors, footingColors, onPilesUpdate, onFootingsUpdate, onFootingColorChange }: FloatingProjectSummaryProps) {
  const { user } = useAuth();
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [pinnedCanvasCoords, setPinnedCanvasCoords] = useState<{ x: number; y: number } | null>(null);
  const [canvasTransform, setCanvasTransform] = useState<{ zoom: number; viewportTransform: number[] }>({ 
    zoom: 1, 
    viewportTransform: [1, 0, 0, 1, 0, 0] 
  });
  
  // Display preferences
  const [scale, setScale] = useState(1.0);
  const [textSize, setTextSize] = useState(0.875);
  const [keySize, setKeySize] = useState(0.75);
  const [headingSize, setHeadingSize] = useState(1);

  // Dropdown options
  const torqueOptions = ["4000 Nm", "5000 Nm", "Custom"];
  const depthOptions = ["2.3m", "2.8m", "3m", "4m", "Custom"];

  const footingWidthOptions = [
    "300mm", "400mm", "500mm", "600mm", "700mm", "800mm", "900mm", "1000mm", "Custom"
  ];
  
  const footingDepthOptions = [
    "300mm", "400mm", "500mm", "600mm", "700mm", "800mm", "900mm", "1000mm", "Custom"
  ];

  // Load preferences from database
  useEffect(() => {
    if (!user) return;
    
    const loadPreferences = async () => {
      try {
        const { data, error } = await supabase
          .from("floating_summary_preferences")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (error) {
          logger.error("Error loading preferences:", error);
          return;
        }
        
        if (data) {
          setScale(Number(data.scale));
          setTextSize(Number(data.text_size));
          setKeySize(Number(data.key_size));
          // @ts-ignore - heading_size will be available after DB types regenerate
          setHeadingSize(Number(data.heading_size || 1));
        }
        // If data is null, the component will use default values already set in useState
      } catch (error) {
        logger.error("Error loading preferences:", error);
      }
    };
    
    loadPreferences();
  }, [user]);

  // Load saved position and pinned state from localStorage
  useEffect(() => {
    const savedPosition = localStorage.getItem("projectSummaryPosition");
    if (savedPosition) {
      setPosition(JSON.parse(savedPosition));
    }
    const savedPinned = localStorage.getItem("projectSummaryPinned");
    if (savedPinned) {
      setIsPinned(JSON.parse(savedPinned));
    }
  }, []);

  // Save position and pinned state to localStorage when they change
  useEffect(() => {
    localStorage.setItem("projectSummaryPosition", JSON.stringify(position));
  }, [position]);

  useEffect(() => {
    localStorage.setItem("projectSummaryPinned", JSON.stringify(isPinned));
  }, [isPinned]);

  // Listen for canvas transform changes
  useEffect(() => {
    const handleTransformChange = (e: CustomEvent) => {
      setCanvasTransform({
        zoom: e.detail.zoom,
        viewportTransform: e.detail.viewportTransform
      });
    };

    window.addEventListener('canvas-transform-change', handleTransformChange as EventListener);
    return () => {
      window.removeEventListener('canvas-transform-change', handleTransformChange as EventListener);
    };
  }, []);

  // Update position when pinned and canvas transform changes
  useEffect(() => {
    if (isPinned && pinnedCanvasCoords) {
      // Convert canvas coordinates to screen coordinates
      const vt = canvasTransform.viewportTransform;
      const zoom = canvasTransform.zoom;
      const screenX = pinnedCanvasCoords.x * zoom + vt[4];
      const screenY = pinnedCanvasCoords.y * zoom + vt[5];
      setPosition({ x: screenX, y: screenY });
    }
  }, [isPinned, pinnedCanvasCoords, canvasTransform]);

  // Listen for print mode events
  useEffect(() => {
    const handlePrintMode = (e: CustomEvent) => {
      setIsPrintMode(e.detail.enabled);
    };
    
    window.addEventListener('summary-print-mode' as any, handlePrintMode);
    return () => window.removeEventListener('summary-print-mode' as any, handlePrintMode);
  }, []);

  // Helper function to format numbers into ranges
  const formatNumberRanges = (numbers: number[]): string => {
    if (numbers.length === 0) return "";
    
    // Remove duplicates and sort
    const unique = Array.from(new Set(numbers)).sort((a, b) => a - b);
    const ranges: string[] = [];
    let start = unique[0];
    let end = unique[0];
    
    for (let i = 1; i < unique.length; i++) {
      if (unique[i] === end + 1) {
        end = unique[i];
      } else {
        ranges.push(start === end ? `${start}` : `${start}-${end}`);
        start = unique[i];
        end = unique[i];
      }
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`);
    
    return ranges.join(", ");
  };

  // Calculate pile summary with extension and color in the key
  const pileSummary = piles.reduce((acc: any, pile) => {
    const ext = pile.extension && pile.extension !== "None" ? ` + ${pile.extension} Ext` : "";
    const color = pile.color || pileColors[pile.pile_type as keyof PileColors] || "#FF6400";
    const key = `${pile.pile_type} w/ ${pile.blade_size} Blade${ext}|||${color}`; // Include color in key
    if (!acc[key]) {
      acc[key] = { 
        count: 0, 
        color: color,
        numbers: [],
        displayKey: `${pile.pile_type} w/ ${pile.blade_size} Blade${ext}`, // Display without color
        // Get min_depth and min_torque from first pile of this type with defaults
        min_depth: pile.min_depth || "2.8m",
        min_torque: pile.min_torque || "5000 Nm",
        // Store all pile IDs in this group for batch updates
        pileIds: [],
      };
    }
    acc[key].count++;
    acc[key].numbers.push(pile.number);
    acc[key].pileIds.push(pile.id);
    
    return acc;
  }, {});
  
  // Sort pile numbers for each group
  Object.values(pileSummary).forEach((data: any) => {
    data.numbers.sort((a: number, b: number) => a - b);
  });

  // Calculate footing summary with colors and measurements
  const footingSummary = footings.reduce((acc: any, footing) => {
    const key = footing.footing_type;
    const color = footingColors[key as keyof FootingColors] || "#64748b";
    if (!acc[key]) {
      acc[key] = { 
        count: 0, 
        color,
        // Get width and depth from first footing of this type
        width: footing.width || "",
        depth: footing.depth || "",
        // Store all footing IDs in this group for batch updates
        footingIds: [],
      };
    }
    acc[key].count++;
    acc[key].footingIds.push(footing.id);
    return acc;
  }, {});

  // Handle pile type group field updates (updates all piles in the group)
  const handlePileGroupUpdate = async (pileIds: string[], field: 'min_depth' | 'min_torque', value: string) => {
    try {
      // Update all piles in this group with a single query
      await supabase.from("piles").update({ [field]: value }).in("id", pileIds);
      
      // Update local state
      onPilesUpdate(piles.map(p => 
        pileIds.includes(p.id) ? { ...p, [field]: value } : p
      ));
    } catch (error) {
      logger.error(`Error updating ${field}:`, error);
    }
  };

  // Handle footing type group field updates (updates all footings in the group)
  const handleFootingGroupUpdate = async (footingIds: string[], field: 'width' | 'depth', value: string) => {
    try {
      // Update all footings in this group with a single query
      await supabase.from("footings").update({ [field]: value }).in("id", footingIds);
      
      // Update local state
      onFootingsUpdate(footings.map(f => 
        footingIds.includes(f.id) ? { ...f, [field]: value } : f
      ));
    } catch (error) {
      logger.error(`Error updating ${field}:`, error);
    }
  };

  const handleSaveSettings = async (settings: { scale: number; textSize: number; keySize: number; headingSize: number }) => {
    if (!user) return;
    
    try {
      setScale(settings.scale);
      setTextSize(settings.textSize);
      setKeySize(settings.keySize);
      setHeadingSize(settings.headingSize);
      
      // Use upsert to insert or update preferences
      await supabase
        .from("floating_summary_preferences")
        .upsert({
          user_id: user.id,
          scale: settings.scale,
          text_size: settings.textSize,
          key_size: settings.keySize,
          heading_size: settings.headingSize,
        }, {
          onConflict: 'user_id'
        });
      
      toast.success("Settings saved");
    } catch (error) {
      logger.error("Error saving preferences:", error);
      toast.error("Failed to save settings");
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Don't allow dragging when pinned
    if (isPinned) return;
    if ((e.target as HTMLElement).closest('button, input, select, .popover-trigger')) return;
    
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  return (
    <>
      <Card
        id="project-summary-panel"
        className="fixed bg-card/95 backdrop-blur-sm shadow-lg border-2 z-50 min-w-[280px]"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          cursor: isDragging ? "grabbing" : "default",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <div
          className={`bg-primary text-primary-foreground px-4 py-2 flex items-center justify-between rounded-t-lg ${isPinned ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-2">
            {!isPinned && <GripVertical className="h-4 w-4" />}
            <h3 className="font-semibold text-sm">Project Summary</h3>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-primary-foreground/20"
              onClick={(e) => {
                e.stopPropagation();
                if (!isPinned) {
                  // Pinning: convert screen coordinates to canvas coordinates
                  const vt = canvasTransform.viewportTransform;
                  const zoom = canvasTransform.zoom;
                  const canvasX = (position.x - vt[4]) / zoom;
                  const canvasY = (position.y - vt[5]) / zoom;
                  setPinnedCanvasCoords({ x: canvasX, y: canvasY });
                  setIsPinned(true);
                  toast("Summary box pinned to PDF - it will now move and scale with the canvas");
                } else {
                  // Unpinning: keep current screen position
                  setPinnedCanvasCoords(null);
                  setIsPinned(false);
                  toast("Summary box unpinned - you can now move it freely");
                }
              }}
              title={isPinned ? "Unpin summary" : "Pin summary"}
            >
              {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-primary-foreground/20"
              onClick={(e) => {
                e.stopPropagation();
                setSettingsOpen(true);
              }}
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      
      <div className="p-4 space-y-3">
        <div>
          <div className="font-semibold mb-1" style={{ fontSize: `${headingSize}rem` }}>Total Piles: {piles.length}</div>
          {Object.keys(pileSummary).length > 0 && (
            <div className="border-t border-border pt-2 mt-2 space-y-2">
              {Object.entries(pileSummary).map(([key, data]: [string, any]) => (
                <div key={key} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="rounded-full border border-border flex-shrink-0"
                      style={{ 
                        backgroundColor: data.color,
                        width: `${keySize}rem`,
                        height: `${keySize}rem`,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold" style={{ fontSize: `${textSize}rem` }}>{data.displayKey}</div>
                      <div className="text-muted-foreground/80" style={{ fontSize: `${textSize}rem` }}>
                        Total: {data.count} "{formatNumberRanges(data.numbers)}"
                      </div>
                    </div>
                  </div>
                  
                  {/* Editable fields for this pile type */}
                  <div className="ml-5 flex items-center gap-3" style={{ fontSize: `${textSize}rem` }}>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground whitespace-nowrap">Min Depth:</span>
                      {isPrintMode ? (
                        <span className="h-6 text-xs px-2 flex items-center">{data.min_depth || "2.8m"}</span>
                      ) : data.min_depth === "Custom" ? (
                        <input
                          type="text"
                          className="h-6 text-xs w-24 px-2 border rounded"
                          value={data.min_depth}
                          onChange={(e) => handlePileGroupUpdate(data.pileIds, 'min_depth', e.target.value)}
                          placeholder="e.g. 3.5m"
                        />
                      ) : (
                        <Select
                          value={data.min_depth || "2.8m"}
                          onValueChange={(value) => handlePileGroupUpdate(data.pileIds, 'min_depth', value)}
                        >
                          <SelectTrigger className="h-6 text-xs w-24 px-2">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            {depthOptions.map((option) => (
                              <SelectItem key={option} value={option} className="text-xs">
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground whitespace-nowrap">Min Torque:</span>
                      {isPrintMode ? (
                        <span className="h-6 text-xs px-2 flex items-center">{data.min_torque || "5000 Nm"}</span>
                      ) : data.min_torque === "Custom" ? (
                        <input
                          type="text"
                          className="h-6 text-xs w-24 px-2 border rounded"
                          value={data.min_torque}
                          onChange={(e) => handlePileGroupUpdate(data.pileIds, 'min_torque', e.target.value)}
                          placeholder="e.g. 6000 Nm"
                        />
                      ) : (
                        <Select
                          value={data.min_torque || "5000 Nm"}
                          onValueChange={(value) => handlePileGroupUpdate(data.pileIds, 'min_torque', value)}
                        >
                          <SelectTrigger className="h-6 text-xs w-24 px-2">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            {torqueOptions.map((option) => (
                              <SelectItem key={option} value={option} className="text-xs">
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border pt-3">
          <div className="font-semibold mb-1" style={{ fontSize: `${headingSize}rem` }}>Total Footings: {footings.length}</div>
          {Object.keys(footingSummary).length > 0 && (
            <div className="border-t border-border pt-2 mt-2 space-y-2">
              {Object.entries(footingSummary).map(([key, data]: [string, any]) => (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            className="rounded-sm border border-border flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                            style={{ 
                              backgroundColor: data.color,
                              width: `${keySize}rem`,
                              height: `${keySize}rem`,
                            }}
                            title="Click to change color"
                          />
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-3">
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Select Color</p>
                            <input
                              type="color"
                              value={data.color}
                              onChange={(e) => onFootingColorChange?.(key, e.target.value)}
                              className="w-full h-10 cursor-pointer"
                            />
                          </div>
                        </PopoverContent>
                      </Popover>
                      <span style={{ fontSize: `${textSize}rem` }}>{key}</span>
                    </div>
                    <span className="font-medium" style={{ fontSize: `${textSize}rem` }}>{data.count}</span>
                  </div>
                  
                  {/* Show editable width/depth for Strip Footing */}
                  {key === "Strip Footing" && (
                    <div className="ml-5 flex items-center gap-3" style={{ fontSize: `${textSize}rem` }}>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground whitespace-nowrap">Width:</span>
                        {isPrintMode ? (
                          <span className="h-6 px-2 flex items-center" style={{ fontSize: `${textSize}rem` }}>{data.width || ""}</span>
                        ) : (
                          <Select
                            value={data.width || ""}
                            onValueChange={(value) => handleFootingGroupUpdate(data.footingIds, 'width', value)}
                          >
                            <SelectTrigger className="h-6 w-24 px-2" style={{ fontSize: `${textSize}rem` }}>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {footingWidthOptions.map((option) => (
                                <SelectItem key={option} value={option} style={{ fontSize: `${textSize}rem` }}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground whitespace-nowrap">Depth:</span>
                        {isPrintMode ? (
                          <span className="h-6 px-2 flex items-center" style={{ fontSize: `${textSize}rem` }}>{data.depth || ""}</span>
                        ) : (
                          <Select
                            value={data.depth || ""}
                            onValueChange={(value) => handleFootingGroupUpdate(data.footingIds, 'depth', value)}
                          >
                            <SelectTrigger className="h-6 w-24 px-2" style={{ fontSize: `${textSize}rem` }}>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {footingDepthOptions.map((option) => (
                                <SelectItem key={option} value={option} style={{ fontSize: `${textSize}rem` }}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
    
    <FloatingSummarySettings
      open={settingsOpen}
      onOpenChange={setSettingsOpen}
      scale={scale}
      textSize={textSize}
      keySize={keySize}
      onSave={handleSaveSettings}
    />
    </>
  );
}
