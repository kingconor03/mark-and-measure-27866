import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { logger } from "@/lib/logger";
import MarkupToolbar from "@/components/MarkupToolbar";
import MarkupCanvas from "@/components/MarkupCanvas";
import PropertiesPanel from "@/components/PropertiesPanel";
import FloatingProjectSummary from "@/components/FloatingProjectSummary";
import { usePileColors } from "@/components/PileColorSettings";
import { useFootingColors } from "@/components/FootingColorSettings";
import { useHistory, HistoryAction } from "@/hooks/useHistory";

export default function Editor() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user, session, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [pages, setPages] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [activeTool, setActiveTool] = useState("select");
  const [selectedObject, setSelectedObject] = useState<any>(null);
  const [selectedPileIds, setSelectedPileIds] = useState<string[]>([]);
  const [piles, setPiles] = useState<any[]>([]);
  const [footings, setFootings] = useState<any[]>([]);
  
  // Pile tool settings
  const [pileType, setPileType] = useState("76mm");
  const [bladeSize, setBladeSize] = useState("250mm");
  const [length, setLength] = useState("1.0m");
  const [extension, setExtension] = useState("None");
  const [nextPileNumber, setNextPileNumber] = useState(1);
  const [pileScale, setPileScale] = useState(1);
  const [customPileColor, setCustomPileColor] = useState<string | null>(null);
  
  // Footing tool settings
  const [footingType, setFootingType] = useState("SF1");
  const [drawingMode, setDrawingMode] = useState("rectangle");
  const [footingOpacity, setFootingOpacity] = useState(0.5);
  
  // Pile colors
  const [pileColors, setPileColors] = usePileColors();
  
  // Footing colors
  const [footingColors, setFootingColors] = useFootingColors();
  
  // History for undo/redo
  const { addToHistory, undo, redo, canUndo, canRedo } = useHistory();

  // Auto-adjust blade size when pile type changes
  useEffect(() => {
    const bladeMap: Record<string, string> = {
      "76mm": "250mm",
      "89.9mm": "350mm",
      "114.3mm": "400mm",
    };
    if (bladeMap[pileType]) {
      setBladeSize(bladeMap[pileType]);
    }
  }, [pileType]);

  // Handle pile type change and reset custom color
  const handlePileTypeChange = (newType: string) => {
    setPileType(newType);
    setCustomPileColor(null); // Reset to default color for new pile type
  };

  useEffect(() => {
    // Wait for auth to finish loading before making any decisions
    if (authLoading) {
      return;
    }
    
    // Redirect to auth if no user session
    if (!user || !session) {
      navigate("/auth");
      return;
    }
    
    fetchProjectData();
  }, [user, session, authLoading, projectId]);

  // Clear history when project loads to prevent zombie footings
  const { clearHistory } = useHistory();

  const fetchProjectData = async () => {
    try {
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (projectError) throw projectError;
      setProject(projectData);

      const ids = (projectData as any)?.selected_page_ids ?? [];

      let pagesQuery = supabase
        .from("pages")
        .select("*")
        .eq("project_id", projectId)
        .order("page_number");

      if (ids.length) {
        pagesQuery = supabase
          .from("pages")
          .select("*")
          .in("id", ids);
      }

      const { data: pagesData, error: pagesError } = await pagesQuery;
      if (pagesError) throw pagesError;

      let finalPages = pagesData || [];
      if (ids.length) {
        const order = new Map(ids.map((id: string, i: number) => [id, i]));
        finalPages = [...finalPages].sort((a, b) => {
          const orderA = order.get(a.id);
          const orderB = order.get(b.id);
          const numA = typeof orderA === 'number' ? orderA : 0;
          const numB = typeof orderB === 'number' ? orderB : 0;
          return numA - numB;
        });
      }

      setPages(finalPages);
      setCurrentPage(0);

      if (finalPages.length) {
        const pageIds = finalPages.map(p => p.id);

        const { data: pilesData } = await supabase
          .from("piles")
          .select("*")
          .in("page_id", pageIds)
          .order("number");

        const { data: footingsData } = await supabase
          .from("footings")
          .select("*")
          .in("page_id", pageIds);

        setPiles(pilesData || []);
        setFootings(footingsData || []);

        if (pilesData?.length) {
          const maxNum = Math.max(...pilesData.map(p => p.number || 0));
          setNextPileNumber(maxNum + 1);
        }

        clearHistory();
      }
    } catch (err) {
      logger.error("Error fetching project:", err);
      toast.error("Failed to load project");
    } finally {
      setLoading(false);
    }
  };

  const fetchMarkups = async () => {
    try {
      if (pages.length === 0) return;
      
      const pageIds = pages.map(p => p.id);
      
      const { data: pilesData } = await supabase
        .from("piles")
        .select("*")
        .in("page_id", pageIds)
        .order("number");

      const { data: footingsData } = await supabase
        .from("footings")
        .select("*")
        .in("page_id", pageIds);

      setPiles(pilesData || []);
      setFootings(footingsData || []);
    } catch (error) {
      logger.error("Error fetching markups:", error);
    }
  };

  const handleSave = async () => {
    try {
      await supabase
        .from("projects")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", projectId);
      
      toast.success("Project saved");
      navigate("/dashboard");
    } catch (error) {
      logger.error("Error saving:", error);
      toast.error("Failed to save project");
    }
  };

  const handleExport = async (exportAllPages: boolean = false) => {
    // Dispatch export event with current page details
    const exportEvent = new CustomEvent(exportAllPages ? "export-pdf-all" : "export-pdf", {
      detail: {
        projectName: project.name,
        pageNumber: currentPage,
        pageId: pages[currentPage].id,
        exportAllPages,
      }
    });
    window.dispatchEvent(exportEvent);
  };

  const handleClearAll = async () => {
    try {
      // Optimistic update - clear UI immediately
      setPiles([]);
      setFootings([]);
      setNextPileNumber(1);
      
      // Then clear from database
      const pageIds = pages.map(p => p.id);
      await supabase.from("piles").delete().in("page_id", pageIds);
      await supabase.from("footings").delete().in("page_id", pageIds);
      
      toast.success("All markups cleared");
    } catch (error) {
      logger.error("Error clearing markups:", error);
      toast.error("Failed to clear markups");
      // Refetch on error to restore state
      fetchMarkups();
    }
  };

  const handleUndo = async () => {
    const action = undo();
    if (!action) return;

    logger.log('🔙 Editor handleUndo - Action:', action.type, action);

    try {
      switch (action.type) {
        case 'ADD_PILE':
          logger.log('🔙 Undoing ADD_PILE - Removing pile ID:', action.pile.id, 'Number:', action.pile.number);
          // Find and remove by ID (most reliable)
          const pileToRemove = piles.find(p => p.id === action.pile.id);
          logger.log('🔙 Found pile to remove:', pileToRemove);
          
          // Optimistic update
          setPiles(prev => {
            const updated = prev.filter(p => p.id !== action.pile.id);
            logger.log('🔙 Piles after removal:', updated.length, 'piles');
            // Renumber after removal
            const sorted = [...updated].sort((a, b) => 
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
            const renumbered = sorted.map((p, i) => ({ ...p, number: i + 1 }));
            setNextPileNumber(renumbered.length + 1);
            return renumbered;
          });
          
          await supabase.from("piles").delete().eq("id", action.pile.id);
          
          // Update pile numbers in DB
          const pilesAfterDelete = piles.filter(p => p.id !== action.pile.id);
          const sortedAfterDelete = [...pilesAfterDelete].sort((a, b) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          await Promise.all(sortedAfterDelete.map((p, i) => 
            supabase.from("piles").update({ number: i + 1 }).eq("id", p.id)
          ));
          toast.success("Undone: Pile added");
          break;
        
        case 'DELETE_PILE':
          // Optimistic update - restore pile with original number
          setPiles(prev => {
            const updated = [...prev, action.pile];
            // Renumber all piles
            const sorted = [...updated].sort((a, b) => 
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
            const renumbered = sorted.map((p, i) => ({ ...p, number: i + 1 }));
            setNextPileNumber(renumbered.length + 1);
            return renumbered;
          });
          const { data: restoredPile } = await supabase
            .from("piles")
            .insert({
              page_id: action.pile.page_id,
              pile_type: action.pile.pile_type,
              blade_size: action.pile.blade_size,
              length: action.pile.length,
              extension: action.pile.extension,
              position_x: action.pile.position_x,
              position_y: action.pile.position_y,
              is_custom: action.pile.is_custom,
              radius: action.pile.radius,
              number: action.pile.number,
              color: action.pile.color,
              created_at: action.pile.created_at,
            })
            .select()
            .single();
          if (restoredPile) {
            setPiles(prev => prev.map(p => 
              p.page_id === action.pile.page_id && p.number === action.pile.number ? restoredPile : p
            ));
            // Renumber all piles
            const allPiles = [...piles.filter(p => p.id !== action.pile.id), restoredPile];
            const sorted = [...allPiles].sort((a, b) => 
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
            await Promise.all(sorted.map((p, i) => 
              supabase.from("piles").update({ number: i + 1 }).eq("id", p.id)
            ));
          }
          toast.success("Undone: Pile deleted");
          break;
        
        case 'UPDATE_PILE':
          // Optimistic update
          setPiles(prev => prev.map(p => p.id === action.oldPile.id ? action.oldPile : p));
          await supabase
            .from("piles")
            .update(action.oldPile)
            .eq("id", action.oldPile.id);
          toast.success("Undone: Pile updated");
          break;
        
        case 'ADD_FOOTING':
          // Optimistic update
          setFootings(prev => prev.filter(f => f.id !== action.footing.id));
          await supabase.from("footings").delete().eq("id", action.footing.id);
          toast.success("Undone: Footing added");
          break;
        
        case 'DELETE_FOOTING':
          // Optimistic update
          setFootings(prev => [...prev, action.footing]);
          const { data: restoredFooting } = await supabase
            .from("footings")
            .insert({
              page_id: action.footing.page_id,
              footing_type: action.footing.footing_type,
              shape: action.footing.shape,
              coordinates: action.footing.coordinates,
              color: action.footing.color,
              width: action.footing.width,
              depth: action.footing.depth,
            })
            .select()
            .single();
          if (restoredFooting) setFootings(prev => prev.map(f => f.id === action.footing.id ? restoredFooting : f));
          toast.success("Undone: Footing deleted");
          break;
        
        case 'DELETE_MULTIPLE_PILES':
          // Optimistic update - restore all piles and renumber
          setPiles(prev => {
            const updated = [...prev, ...action.piles];
            const sorted = [...updated].sort((a, b) => 
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
            const renumbered = sorted.map((p, i) => ({ ...p, number: i + 1 }));
            setNextPileNumber(renumbered.length + 1);
            return renumbered;
          });
          const { data: restoredPiles } = await supabase
            .from("piles")
            .insert(action.piles.map(p => ({
              page_id: p.page_id,
              pile_type: p.pile_type,
              blade_size: p.blade_size,
              length: p.length,
              extension: p.extension,
              position_x: p.position_x,
              position_y: p.position_y,
              is_custom: p.is_custom,
              radius: p.radius,
              number: p.number,
              color: p.color,
              created_at: p.created_at,
            })))
            .select();
          if (restoredPiles) {
            const allPiles = [...piles, ...restoredPiles];
            const sorted = [...allPiles].sort((a, b) => 
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
            await Promise.all(sorted.map((p, i) => 
              supabase.from("piles").update({ number: i + 1 }).eq("id", p.id)
            ));
          }
          toast.success(`Undone: ${action.piles.length} piles deleted`);
          break;
      }
    } catch (error) {
      logger.error("Error during undo:", error);
      toast.error("Failed to undo action");
      // Refetch on error
      fetchMarkups();
    }
  };

  const handleRedo = async () => {
    const action = redo();
    if (!action) return;

    try {
      switch (action.type) {
        case 'ADD_PILE':
          // Optimistic update - re-add pile and renumber
          setPiles(prev => {
            const updated = [...prev, action.pile];
            const sorted = [...updated].sort((a, b) => 
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
            const renumbered = sorted.map((p, i) => ({ ...p, number: i + 1 }));
            setNextPileNumber(renumbered.length + 1);
            return renumbered;
          });
          const { data: readdedPile } = await supabase
            .from("piles")
            .insert({
              page_id: action.pile.page_id,
              pile_type: action.pile.pile_type,
              blade_size: action.pile.blade_size,
              length: action.pile.length,
              extension: action.pile.extension,
              position_x: action.pile.position_x,
              position_y: action.pile.position_y,
              is_custom: action.pile.is_custom,
              radius: action.pile.radius,
              number: action.pile.number,
              color: action.pile.color,
              created_at: action.pile.created_at,
            })
            .select()
            .single();
          if (readdedPile) {
            setPiles(prev => prev.map(p => p.number === action.pile.number ? readdedPile : p));
            // Renumber all
            const allPiles = [...piles, readdedPile];
            const sorted = [...allPiles].sort((a, b) => 
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
            await Promise.all(sorted.map((p, i) => 
              supabase.from("piles").update({ number: i + 1 }).eq("id", p.id)
            ));
          }
          toast.success("Redone: Pile added");
          break;
        
        case 'DELETE_PILE':
          // Optimistic update - delete and renumber
          setPiles(prev => {
            const updated = prev.filter(p => p.id !== action.pile.id);
            const sorted = [...updated].sort((a, b) => 
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
            const renumbered = sorted.map((p, i) => ({ ...p, number: i + 1 }));
            setNextPileNumber(renumbered.length + 1);
            return renumbered;
          });
          await supabase.from("piles").delete().eq("id", action.pile.id);
          // Renumber remaining
          const remainingPiles = piles.filter(p => p.id !== action.pile.id);
          const sortedRemaining = [...remainingPiles].sort((a, b) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          await Promise.all(sortedRemaining.map((p, i) => 
            supabase.from("piles").update({ number: i + 1 }).eq("id", p.id)
          ));
          toast.success("Redone: Pile deleted");
          break;
        
        case 'UPDATE_PILE':
          // Optimistic update
          setPiles(prev => prev.map(p => p.id === action.newPile.id ? action.newPile : p));
          await supabase
            .from("piles")
            .update(action.newPile)
            .eq("id", action.newPile.id);
          toast.success("Redone: Pile updated");
          break;
        
        case 'ADD_FOOTING':
          // Optimistic update
          setFootings(prev => [...prev, action.footing]);
          const { data: readdedFooting } = await supabase
            .from("footings")
            .insert({
              page_id: action.footing.page_id,
              footing_type: action.footing.footing_type,
              shape: action.footing.shape,
              coordinates: action.footing.coordinates,
              color: action.footing.color,
              width: action.footing.width,
              depth: action.footing.depth,
            })
            .select()
            .single();
          if (readdedFooting) setFootings(prev => prev.map(f => f.id === action.footing.id ? readdedFooting : f));
          toast.success("Redone: Footing added");
          break;
        
        case 'DELETE_FOOTING':
          // Optimistic update
          setFootings(prev => prev.filter(f => f.id !== action.footing.id));
          await supabase.from("footings").delete().eq("id", action.footing.id);
          toast.success("Redone: Footing deleted");
          break;
        
        case 'DELETE_MULTIPLE_PILES':
          // Optimistic update - delete and renumber
          setPiles(prev => {
            const updated = prev.filter(p => !action.piles.find(ap => ap.id === p.id));
            const sorted = [...updated].sort((a, b) => 
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
            const renumbered = sorted.map((p, i) => ({ ...p, number: i + 1 }));
            setNextPileNumber(renumbered.length + 1);
            return renumbered;
          });
          await supabase.from("piles").delete().in("id", action.piles.map(p => p.id));
          // Renumber remaining
          const pilesAfterMultiDelete = piles.filter(p => !action.piles.find(ap => ap.id === p.id));
          const sortedAfterMultiDelete = [...pilesAfterMultiDelete].sort((a, b) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          await Promise.all(sortedAfterMultiDelete.map((p, i) => 
            supabase.from("piles").update({ number: i + 1 }).eq("id", p.id)
          ));
          toast.success(`Redone: ${action.piles.length} piles deleted`);
          break;
      }
    } catch (error) {
      logger.error("Error during redo:", error);
      toast.error("Failed to redo action");
      // Refetch on error
      fetchMarkups();
    }
  };

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, canUndo, canRedo]);


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!project || pages.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">No blueprint available</p>
          <Button onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{project.name}</h1>
            <p className="text-sm text-muted-foreground">
              Page {currentPage + 1} of {pages.length}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Page Navigation */}
          {pages.length > 1 && (
            <div className="flex items-center gap-2 px-3 py-1.5 border rounded-md bg-background">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
              >
                Previous
              </Button>
              <span className="text-sm font-medium px-2">
                {currentPage + 1} / {pages.length}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(Math.min(pages.length - 1, currentPage + 1))}
                disabled={currentPage === pages.length - 1}
              >
                Next
              </Button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => handleExport(false)}>
              <Download className="h-4 w-4 mr-2" />
              Download Marked Up PDF
            </Button>
            <Button variant="outline" onClick={() => handleExport(true)}>
              <Download className="h-4 w-4 mr-2" />
              Download Full PDF
            </Button>
          </div>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Toolbar */}
        <MarkupToolbar 
          activeTool={activeTool} 
          onToolChange={setActiveTool}
          onClearAll={handleClearAll}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={canUndo}
          canRedo={canRedo}
        />

        {/* Canvas */}
        <div className="flex-1 overflow-hidden bg-canvas-bg relative">
          <MarkupCanvas
            pages={pages}
            currentPageIndex={currentPage}
            activeTool={activeTool}
            piles={piles}
            footings={footings}
            onObjectSelect={setSelectedObject}
            onMarkupsChange={fetchMarkups}
            onPilesUpdate={setPiles}
            onFootingsUpdate={setFootings}
            onSelectedPilesChange={setSelectedPileIds}
            pileConfig={{ pileType, bladeSize, length, extension, nextPileNumber, scale: pileScale, customColor: customPileColor }}
            footingConfig={{ footingType, drawingMode, opacity: footingOpacity }}
            onPileNumberUpdate={(num) => setNextPileNumber(num)}
            pileColors={pileColors}
            projectName={project.name}
            onHistoryAdd={addToHistory}
            onUndo={handleUndo}
            onRedo={handleRedo}
            footingColors={footingColors}
          />
          
          <FloatingProjectSummary 
            piles={piles} 
            footings={footings} 
            pileColors={pileColors}
            footingColors={footingColors}
            onPilesUpdate={setPiles}
            onFootingsUpdate={setFootings}
            onFootingColorChange={(footingType, color) => {
              setFootingColors({ ...footingColors, [footingType]: color });
            }}
          />
        </div>

        {/* Properties Panel */}
        <PropertiesPanel
          activeTool={activeTool}
          pileType={pileType}
          bladeSize={bladeSize}
          length={length}
          extension={extension}
          nextPileNumber={nextPileNumber}
          pileScale={pileScale}
          footingType={footingType}
          drawingMode={drawingMode}
          footingOpacity={footingOpacity}
          pileColors={pileColors}
          onPileTypeChange={handlePileTypeChange}
          onBladeSizeChange={setBladeSize}
          onLengthChange={setLength}
          onExtensionChange={setExtension}
          onNextPileNumberChange={setNextPileNumber}
          onPileScaleChange={setPileScale}
          onFootingTypeChange={setFootingType}
          onDrawingModeChange={setDrawingMode}
          onFootingOpacityChange={setFootingOpacity}
          onPileColorsChange={setPileColors}
          customPileColor={customPileColor}
          onCustomPileColorChange={setCustomPileColor}
          piles={piles}
          footings={footings}
          selectedObject={selectedObject}
          selectedPileIds={selectedPileIds}
          onMarkupsChange={fetchMarkups}
          onPilesChange={setPiles}
          onHistoryAdd={addToHistory}
        />
      </div>
    </div>
  );
}
