import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PileToolSettings from "@/components/PileToolSettings";
import FootingToolSettings from "@/components/FootingToolSettings";
import BulkPileEditPanel from "@/components/BulkPileEditPanel";
import { PileColors } from "@/components/PileColorSettings";
import { HistoryAction } from "@/hooks/useHistory";

interface PropertiesPanelProps {
  activeTool: string;
  pileType: string;
  bladeSize: string;
  length: string;
  extension: string;
  nextPileNumber: number;
  pileScale: number;
  footingType: string;
  drawingMode: string;
  footingOpacity: number;
  pileColors: PileColors;
  customPileColor: string | null;
  onPileTypeChange: (value: string) => void;
  onBladeSizeChange: (value: string) => void;
  onLengthChange: (value: string) => void;
  onExtensionChange: (value: string) => void;
  onNextPileNumberChange: (value: number) => void;
  onPileScaleChange: (value: number) => void;
  onFootingTypeChange: (value: string) => void;
  onDrawingModeChange: (value: string) => void;
  onFootingOpacityChange: (value: number) => void;
  onPileColorsChange: (colors: PileColors) => void;
  onCustomPileColorChange: (color: string | null) => void;
  piles: any[];
  footings: any[];
  selectedObject: any;
  selectedPileIds: string[];
  onMarkupsChange: () => void;
  onPilesChange: (piles: any[]) => void;
  onHistoryAdd?: (action: HistoryAction) => void;
}

export default function PropertiesPanel({
  activeTool,
  pileType,
  bladeSize,
  length,
  extension,
  nextPileNumber,
  pileScale,
  footingType,
  drawingMode,
  footingOpacity,
  pileColors,
  customPileColor,
  onPileTypeChange,
  onBladeSizeChange,
  onLengthChange,
  onExtensionChange,
  onNextPileNumberChange,
  onPileScaleChange,
  onFootingTypeChange,
  onDrawingModeChange,
  onFootingOpacityChange,
  onPileColorsChange,
  onCustomPileColorChange,
  piles,
  footings,
  selectedObject,
  selectedPileIds,
  onMarkupsChange,
  onPilesChange,
  onHistoryAdd,
}: PropertiesPanelProps) {
  // Calculate pile summary
  const pileSummary = piles.reduce((acc: any, pile) => {
    const key = `${pile.pile_type} w/ ${pile.blade_size} Blade`;
    if (!acc[key]) {
      acc[key] = 0;
    }
    acc[key]++;
    return acc;
  }, {});

  // Calculate footing summary
  const footingSummary = footings.reduce((acc: any, footing) => {
    const key = footing.footing_type;
    if (!acc[key]) {
      acc[key] = 0;
    }
    acc[key]++;
    return acc;
  }, {});

  return (
    <div className="w-80 border-l bg-panel-bg p-6 space-y-6 overflow-y-auto">
      {selectedPileIds.length > 0 && (
        <BulkPileEditPanel
          selectedPileIds={selectedPileIds}
          onUpdate={onMarkupsChange}
          piles={piles}
          onPilesChange={onPilesChange}
          onHistoryAdd={onHistoryAdd}
        />
      )}
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {activeTool === "pile" && "Pile Tool Settings"}
            {activeTool === "footing" && "Footing Tool Settings"}
            {(activeTool === "select" || activeTool === "pan") && "Project Summary"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeTool === "pile" && (
            <PileToolSettings
              pileType={pileType}
              bladeSize={bladeSize}
              length={length}
              extension={extension}
              nextNumber={nextPileNumber}
              scale={pileScale}
              pileColors={pileColors}
              customColor={customPileColor}
              piles={piles}
              onPileTypeChange={onPileTypeChange}
              onBladeSizeChange={onBladeSizeChange}
              onLengthChange={onLengthChange}
              onExtensionChange={onExtensionChange}
              onNextNumberChange={onNextPileNumberChange}
              onScaleChange={onPileScaleChange}
              onPileColorsChange={onPileColorsChange}
              onCustomColorChange={onCustomPileColorChange}
            />
          )}

          {activeTool === "footing" && (
            <FootingToolSettings
              footingType={footingType}
              drawingMode={drawingMode}
              footingOpacity={footingOpacity}
              onFootingTypeChange={onFootingTypeChange}
              onDrawingModeChange={onDrawingModeChange}
              onFootingOpacityChange={onFootingOpacityChange}
            />
          )}

          {(activeTool === "select" || activeTool === "pan") && (
            <div className="space-y-4 text-sm">
              <div>
                <div className="font-semibold mb-2">Total Piles: {piles.length}</div>
                {Object.keys(pileSummary).length > 0 && (
                  <div className="border-t border-border pt-2 mt-2 space-y-1">
                    {Object.entries(pileSummary).map(([key, count]) => (
                      <div key={key} className="flex justify-between text-muted-foreground">
                        <span>{key}:</span>
                        <span className="font-medium">{count as number}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-3">
                <div className="font-semibold mb-2">Total Footings: {footings.length}</div>
                {Object.keys(footingSummary).length > 0 && (
                  <div className="border-t border-border pt-2 mt-2 space-y-1">
                    {Object.entries(footingSummary).map(([key, count]) => (
                      <div key={key} className="flex justify-between text-muted-foreground">
                        <span>{key}:</span>
                        <span className="font-medium">{count as number}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedObject && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Selected Object</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div>Type: {selectedObject.type}</div>
            {selectedObject.type === "pile" && (
              <>
                <div>Number: {selectedObject.number}</div>
                <div>Pile Type: {selectedObject.pile_type}</div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
