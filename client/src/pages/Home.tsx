/**
 * Página Principal - Mapa Interativo
 * 
 * Exibe o mapa interativo e gerencia a seleção de lotes
 * Integra o componente de mapa com a pasta de lote
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Lot, LotInfo } from "@/types";
import InteractiveMap from "@/components/InteractiveMap";
import { LotInspector } from "@/components/LotInspector";
import { SmartCalcModal } from "@/components/SmartCalcModal";
import { SmartCalcNavigator } from "@/components/SmartCalcNavigator";
import { SearchNavigator } from "@/components/SearchNavigator";
import { MobileSearchNavigator } from "@/components/mobile/MobileSearchNavigator";
import { MobileQuickActions } from "@/components/MobileQuickActions";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { CombinationResult } from "@/lib/adjacency";
import { useIsMobile } from "@/hooks/useMobile";
import { useHistory } from "@/hooks/useHistory";
import { useSupabaseLots } from "@/hooks/useSupabaseLots";
import { batchUpsertLots, batchDeleteLots } from "@/lib/supabaseLots";



// Componente simples de Error Boundary
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-100 border-2 border-red-500 text-red-700 m-4 rounded h-full overflow-auto">
          <h2 className="text-xl font-bold mb-2">Algo deu errado!</h2>
          <p className="font-mono bg-white p-2 rounded border border-red-200">
            {this.state.error?.toString()}
          </p>
          <p className="mt-4">Verifique o console do navegador para mais detalhes.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Home() {
  // Hook para capturar erros globais (fora do ciclo de renderização do React)
  useEffect(() => {
    console.log("HOME COMPONENT MOUNTED"); // DEBUG LOG
    const handleError = (event: ErrorEvent) => {
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = 'position:fixed; top:0; left:0; right:0; z-index:9999; background:red; color:white; padding:20px; font-weight:bold;';
      errorDiv.innerText = `Erro Global: ${event.message} em ${event.filename}:${event.lineno}`;
      document.body.appendChild(errorDiv);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  // Auto-detect mobile device (phone/tablet vs computer)
  const isMobile = useIsMobile();

  // State for Lot Selection & Editing
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [highlightedLots, setHighlightedLots] = useState<Lot[]>([]); // New state for Smart Calc selection
  const [calcResults, setCalcResults] = useState<CombinationResult[]>([]); // GLOBAL SMART CALC STATE
  const [isSmartCalcOpen, setIsSmartCalcOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false); // New state for Search
  const [highlightSource, setHighlightSource] = useState<'search' | 'smart_calc' | null>(null); // Track source of highlights
  const [startEditing, setStartEditing] = useState(false); // New state
  // Supabase integration with real-time sync
  const {
    lots: supabaseLots,
    lotsData: supabaseLotsData,
    loading: supabaseLoading,
    error: supabaseError,
    lastSynced,
    updateLot: supabaseUpdateLot,
    deleteLot: supabaseDeleteLot,
    createLot: supabaseCreateLot,
    setLots: setSupabaseLots,
    setLotsData: setSupabaseLotsData,
  } = useSupabaseLots();

  // Create aliases for backward compatibility
  const lotsData = supabaseLotsData;
  const setLotsData = setSupabaseLotsData;
  
  // Removed Firestore cloud check - Supabase handles sync automatically

  // Removed loadLocalData and downloadFromCloud - Supabase hook handles data loading

  // Use Supabase lots with history support
  const [manualLots, setManualLots, { undo, redo, canUndo, canRedo, reset }] = useHistory<Lot[]>(supabaseLots);

  // Sync Supabase data to local History state when loaded
  useEffect(() => {
    if (!supabaseLoading && supabaseLots.length > 0 && manualLots.length === 0) {
      console.log(`📥 Syncing ${supabaseLots.length} lots from Supabase to Map State`);
      reset(supabaseLots);
    }
  }, [supabaseLots, supabaseLoading, manualLots.length, reset]);

  // localStorage auto-save handled by useSupabaseLots hook


  // Supabase handles real-time sync automatically - no manual dirty tracking needed

  const handleBatchUpdate = async (newLots: Lot[], newLotsData: Map<string, LotInfo>, changedIds?: string[]) => {
      console.log(`Promoting Batch Update: ${newLots.length} lots, ${newLotsData.size} info records. Changed: ${changedIds?.length ?? 'ALL'}`);
      
      // Update local state
      setSupabaseLots(newLots);
      setSupabaseLotsData(newLotsData);
      
      // Sync to Supabase
      try {
          // OPTIMIZATION: Only upsert changed lots if specified
          if (changedIds && changedIds.length > 0) {
              const lotsToUpsert = newLots.filter(l => changedIds.includes(l.id));
              if (lotsToUpsert.length > 0) {
                   await batchUpsertLots(lotsToUpsert, newLotsData);
                   console.log(`Incremental sync: ${lotsToUpsert.length} lots updated.`);
              }
          } else if (changedIds && changedIds.length === 0) {
              // Explicitly empty changedIds (e.g. after Delete), so no upsert needed.
              // Logic: The deleted lot is handled by handleDeleteIds. The remaining lots are unchanged.
              console.log('No lots to upsert (Delete handled separately or no changes).');
          } else {
              // Fallback: Full Sync (if changedIds is undefined)
              // This covers cases where we might not be tracking IDs strictly yet or want to be safe
              await batchUpsertLots(newLots, newLotsData);
              console.log('Full batch update synced to Supabase (Fallback)');
          }
      } catch (error) {
          console.error('Failed to sync batch update:', error);
      }
  };
  
  const handleDeleteIds = async (deletedIds: string[]) => {
      try {
          await batchDeleteLots(deletedIds);
          console.log(`Deleted ${deletedIds.length} lots from Supabase`);
      } catch (error) {
          console.error('Failed to delete lots:', error);
      }
  };




  // Clean Legacy Data Effect
  useEffect(() => {
     let hasChanges = false;
     const newMap = new Map(lotsData);
     
     newMap.forEach((info, key) => {
         if (info.notes && info.notes.includes("Generated via Free Quadra")) {
             newMap.set(key, { ...info, notes: info.notes.replace("Generated via Free Quadra", "").trim() });
             hasChanges = true;
         }
     });

     if (hasChanges) {
         setLotsData(newMap);
         console.log("Legacy branding removed from lots.");
     }
  }, []); // Run once on mount (after initial load)

  const handleLotClick = (lot: Lot | null, shouldEdit: boolean = false) => {
    if (!lot) {
        setSelectedLot(null);
        return;
    }

    // Atualizar as informações do lote com os dados salvos
    const savedInfo = lotsData.get(lot.id);
    setStartEditing(shouldEdit); // Set editing intent based on click source

    if (savedInfo) {
      setSelectedLot({
        ...lot,
        info: savedInfo,
      });
    } else {
      // Ensure 'info' is initialized if missing
      setSelectedLot({
          ...lot,
          info: lot.info || {
              id: lot.id,
              quadra: lot.quadra,
              lote: lot.lote,
              notes: "",
              createdAt: new Date(),
              updatedAt: new Date()
          }
      });
    }
  };

  const handleSaveLotInfo = async (lotInfo: LotInfo) => {
    try {
      // 1. Get current info to compare (for propagation logic)
      const currentInfo = lotsData.get(lotInfo.id);
      const sectorChanged = currentInfo?.setor !== lotInfo.setor;
      const zoneChanged = currentInfo?.zona !== lotInfo.zona;

      if (sectorChanged || zoneChanged) {
           console.log(`📡 Propagating Zone/Sector change to Quadra ${lotInfo.quadra}`);
           
           // Find all siblings in same quadra
           const siblings = manualLots.filter(l => l.quadra === lotInfo.quadra);
           
           if (siblings.length > 0) {
               const lotsToUpdate: Lot[] = [];
               const infoToUpdate = new Map<string, LotInfo>();

               siblings.forEach(sibling => {
                   // Get existing info or create new
                   const oldSiblingInfo = lotsData.get(sibling.id) || {
                       id: sibling.id,
                       quadra: sibling.quadra,
                       lote: sibling.lote,
                       createdAt: new Date(),
                       updatedAt: new Date(),
                       notes: ""
                   };

                   // Create updated info object
                   const newSiblingInfo: LotInfo = {
                       ...oldSiblingInfo,
                       zona: lotInfo.zona,   // Propagate Zone
                       setor: lotInfo.setor, // Propagate Sector
                       updatedAt: new Date()
                   };

                   // If it's the lot actually being edited, use the full passed info (which might have other edits like price)
                   if (sibling.id === lotInfo.id) {
                       infoToUpdate.set(lotInfo.id, lotInfo);
                   } else {
                       infoToUpdate.set(sibling.id, newSiblingInfo);
                   }
                   
                   // Prepare Lot object for local update (merging info)
                   lotsToUpdate.push({ ...sibling, info: infoToUpdate.get(sibling.id)! });
               });

               // BATCH UPDATE TO SUPABASE
               await batchUpsertLots(lotsToUpdate, infoToUpdate);

               // UPDATE LOCAL STATE
               setSupabaseLotsData(prev => {
                   const next = new Map(prev);
                   infoToUpdate.forEach((val, key) => next.set(key, val));
                   return next;
               });
               
               // Update Manual Lots
               setManualLots(prev => prev.map(l => {
                   const updatedInfo = infoToUpdate.get(l.id);
                   return updatedInfo ? { ...l, info: updatedInfo } : l;
               }));

               // Update Selected Lot if it matches
               if (selectedLot && selectedLot.id === lotInfo.id) {
                    setSelectedLot({ ...selectedLot, info: lotInfo });
               }

               return; // Exit, we handled everything in batch
           }
      }

      // Fallback: Standard Single Update (if no propagation needed or empty quadra?)
      // Update Supabase
      await supabaseUpdateLot(lotInfo.id, {}, lotInfo);
      
      // Update local selected lot
      if (selectedLot) {
        setSelectedLot({
          ...selectedLot,
          info: lotInfo,
        });
      }

      // Optimistically update manualLots to reflect changes immediately on map
      setManualLots(prev => prev.map(l => 
          l.id === lotInfo.id ? { ...l, info: lotInfo } : l
      ));
    } catch (error) {
      console.error('Failed to save lot info:', error);
    }
  };

  const handleCloseLotFolder = () => {
    setSelectedLot(null);
  };

  const handleExportBackup = () => {
      const backup = {
          lots: manualLots,
          data: Object.fromEntries(lotsData),
          timestamp: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mapa-acapulco-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
  };
  // Manual sync not needed - Supabase real-time handles everything automatically

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-gray-100">
        <AppSidebar 
            selectedLot={selectedLot} 
            lotsData={lotsData}
            manualLots={manualLots}
            onSelectLot={handleLotClick}
            onExportBackup={handleExportBackup}
            lastSaved={lastSynced}
            highlightedLots={highlightedLots}
            onSetHighlightedLots={setHighlightedLots}
            onSetHighlightSource={setHighlightSource}
            onOpenSmartCalc={() => setIsSmartCalcOpen(true)}
            isMobile={isMobile}
        />
        
        <SidebarInset className="relative flex flex-col flex-1 h-full overflow-hidden">
             {/* Map Container */}
             <div className="flex-1 relative w-full h-full">
                {/* Floating Sidebar Trigger (Mobile/Desktop Collapsed) */}
                <div className="absolute top-4 left-4 z-50 flex items-center gap-2">
                    <SidebarTrigger className="bg-white shadow-md border border-gray-200 rounded-lg" />
                    {supabaseLoading && (
                        <div className="bg-blue-600 text-white text-xs px-2 py-1 rounded shadow-md animate-pulse">
                            ⏳ Carregando...
                        </div>
                    )}
                </div>

                <ErrorBoundary>
                    <InteractiveMap
                        onLotClick={handleLotClick}
                        selectedLotId={selectedLot?.id}
                        manualLots={manualLots}
                        setManualLots={setManualLots}
                        lotsData={lotsData}
                        onBatchUpdate={handleBatchUpdate}
                        onDeleteIds={handleDeleteIds}
                        onExportBackup={handleExportBackup}
                        onCloudSync={() => console.log('Manual sync not needed with Supabase')}
                        highlightedLots={highlightedLots}
                        isMobile={isMobile}
                        undo={undo}
                        redo={redo}
                        canUndo={canUndo}
                        canRedo={canRedo}
                    />
            </ErrorBoundary>
             </div>
        </SidebarInset>

        {/* LOT INSPECTOR (FLOATING) */}
        <LotInspector 
           lot={selectedLot}
           onClose={handleCloseLotFolder}
           onSave={handleSaveLotInfo}
           lotsData={lotsData}
           isMobile={isMobile}
        />

        {/* SEARCH NAVIGATOR (FLOATING ON MAP) */}
        {highlightSource === 'search' && (
            isMobile ? (
                <MobileSearchNavigator 
                    highlightedLots={highlightedLots}
                    selectedLot={selectedLot}
                    onSelectLot={(lot) => {
                        handleLotClick(lot, false);
                        setHighlightSource('search');
                    }}
                    onClose={() => {
                        setHighlightedLots([]);
                        setHighlightSource(null);
                    }}
                    lotsData={lotsData}
                />
            ) : (
                <SearchNavigator 
                    highlightedLots={highlightedLots}
                    selectedLot={selectedLot}
                    onSelectLot={(lot) => {
                        handleLotClick(lot, false);
                        setHighlightSource('search');
                    }}
                    onClose={() => {
                        setHighlightedLots([]);
                        setHighlightSource(null);
                    }}
                    lotsData={lotsData}
                    isMobile={false}
                />
            )
        )}

        {/* SMART CALC NAVIGATOR (FLOATING ON MAP) */}
        {highlightSource === 'smart_calc' && (
            <SmartCalcNavigator 
                searchResults={calcResults}
                highlightedLots={highlightedLots}
                onSetHighlightedLots={(lots) => {
                    setHighlightedLots(lots);
                    setHighlightSource(lots.length > 0 ? 'smart_calc' : null);
                }}
                onClose={() => {
                    setHighlightedLots([]);
                    setHighlightSource(null);
                    setCalcResults([]);
                }}
                lotsData={lotsData}
                isMobile={isMobile}
            />
        )}

        {/* SMART CALC MODAL */}
        <SmartCalcModal 
            isOpen={isSmartCalcOpen}
            onOpenChange={setIsSmartCalcOpen}
            manualLots={manualLots}
            lotsData={lotsData}
            onSetHighlightedLots={(lots) => {
                setHighlightedLots(lots);
                setHighlightSource(lots.length > 0 ? 'smart_calc' : null);
            }}
            onSelectLot={handleLotClick}
            highlightedLots={highlightedLots}
            calcResults={calcResults}
            setCalcResults={setCalcResults}
            isMobile={isMobile}
        />

      </div>
    </SidebarProvider>
  );
}
