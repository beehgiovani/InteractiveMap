/**
 * Mobile Home - Full Feature Parity with Desktop
 * 
 * Complete mobile experience with all desktop features:
 * - AppSidebar for navigation
 * - LotInspector for editing
 * - SmartCalc for intelligent lot search
 * - Cloud sync with status indicators
 */

import React, { useState, useEffect, useRef } from "react";
import { Lot, LotInfo } from "@/types";
import InteractiveMap from "@/components/InteractiveMap";
import { LotInspector } from "@/components/LotInspector";
import { SmartCalcModal } from "@/components/SmartCalcModal";
import { SmartCalcNavigator } from "@/components/SmartCalcNavigator";
import { MobileSearchNavigator } from "@/components/mobile/MobileSearchNavigator";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { CombinationResult } from "@/lib/adjacency";
import { syncLotsToFirestore } from "@/lib/firestoreSync";
import { useHistory } from "@/hooks/useHistory";

export default function MobileHome() {
  // State for Lot Selection & Editing
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [highlightedLots, setHighlightedLots] = useState<Lot[]>([]);
  const [calcResults, setCalcResults] = useState<CombinationResult[]>([]);
  const [isSmartCalcOpen, setIsSmartCalcOpen] = useState(false);
  const [highlightSource, setHighlightSource] = useState<'search' | 'smart_calc' | null>(null);
  const [startEditing, setStartEditing] = useState(false);
  
  const [lotsData, setLotsData] = useState<Map<string, LotInfo>>(() => {
    const savedData = localStorage.getItem("lotsData");
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        const map = new Map<string, LotInfo>();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Object.entries(parsed).forEach(([key, value]: [string, any]) => {
          map.set(key, {
            ...value,
            createdAt: new Date(value.createdAt),
            updatedAt: new Date(value.updatedAt),
          });
        });
        return map;
      } catch (error) {
        console.error("Erro ao carregar dados salvos:", error);
      }
    }
    return new Map<string, LotInfo>();
  });
  
  const initialManualLots = (() => {
      try {
          let saved = localStorage.getItem("manualMapData_v2");
          
          if (!saved || saved === "[]") {
              const savedV1 = localStorage.getItem("manualMapData");
              if (savedV1 && savedV1.length > 2) {
                  console.log("Restoring data from legacy manualMapData...");
                  saved = savedV1;
              }
          }

          if (!saved) return [];
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
              return parsed.filter(l => l && l.id && Array.isArray(l.coordinates));
          }
          return [];
      } catch (e) {
          console.error("Failed to load map data", e);
          return [];
      }
  })();

  const [manualLots, setManualLots, { undo, redo, canUndo, canRedo }] = useHistory<Lot[]>(initialManualLots);

  // State for Auto-Save feedback
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Save to localStorage whenever manualLots changes
  useEffect(() => {
    localStorage.setItem("manualMapData_v2", JSON.stringify(manualLots));
    setLastSaved(new Date());
  }, [manualLots]);

  // Salvar dados no localStorage sempre que mudam
  useEffect(() => {
    const dataToSave: Record<string, LotInfo> = {};
    lotsData.forEach((value, key) => {
      dataToSave[key] = value;
    });
    localStorage.setItem("lotsData", JSON.stringify(dataToSave));
  }, [lotsData]);

  // --- CLOUD SYNC LOGIC ---
  const [isSyncingToCloud, setIsSyncingToCloud] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [cloudDate, setCloudDate] = useState<Date | null>(null);
  
  const dirtyLotIdsRef = useRef<Set<string>>(
    (() => {
        try {
            const saved = localStorage.getItem("pending_sync_ids");
            return saved ? new Set(JSON.parse(saved)) : new Set();
        } catch { return new Set(); }
    })()
  );
  
  const deletedLotIdsRef = useRef<Set<string>>(
    (() => {
        try {
            const saved = localStorage.getItem("pending_delete_ids");
            return saved ? new Set(JSON.parse(saved)) : new Set();
        } catch { return new Set(); }
    })()
  );

  const persistQueues = () => {
      localStorage.setItem("pending_sync_ids", JSON.stringify(Array.from(dirtyLotIdsRef.current)));
      localStorage.setItem("pending_delete_ids", JSON.stringify(Array.from(deletedLotIdsRef.current)));
  };

  // Manual polling for updates (optimized - no real-time listener)
  const checkForUpdates = async () => {
      try {
          const { checkCloudStatus } = await import("../lib/firestoreSync");
          const cloudState = await checkCloudStatus();
          
          if (cloudState.lastUpdated) {
              const serverTime = cloudState.lastUpdated.getTime();
              const lastSync = localStorage.getItem("last_cloud_sync");
              const localTime = lastSync ? new Date(lastSync).getTime() : 0;
              
              if (serverTime > localTime + 2000) {
                  console.log("Nova versão disponível na nuvem!", cloudState.lastUpdated);
                  setUpdateAvailable(true);
                  return true;
              }
          }
      } catch (e) {
          console.error("Erro ao verificar atualizações:", e);
      }
      return false;
  };

  // Debounce save to cloud (30s to reduce Firebase writes)
  useEffect(() => {
      const timer = setTimeout(() => {
          if (dirtyLotIdsRef.current.size > 0) {
             console.log(`Auto-syncing ${dirtyLotIdsRef.current.size} dirty records to cloud...`);
             saveToCloud();
          }
      }, 30000);

      return () => clearTimeout(timer);
  }, [manualLots, lotsData]);

  const saveToCloud = async () => {
      if (dirtyLotIdsRef.current.size === 0 && deletedLotIdsRef.current.size === 0) return;

      setIsSyncingToCloud(true);
      try {
          const idsToSync = Array.from(dirtyLotIdsRef.current);
          const idsToDelete = Array.from(deletedLotIdsRef.current);
          
          await syncLotsToFirestore(manualLots, lotsData, idsToSync, idsToDelete);
          
          idsToSync.forEach(id => dirtyLotIdsRef.current.delete(id));
          idsToDelete.forEach(id => deletedLotIdsRef.current.delete(id));
          persistQueues();
          
          const now = new Date();
          setCloudDate(now);
          localStorage.setItem("last_cloud_sync", now.toISOString());
          console.log("Cloud sync finished.");
      } catch (e) {
          console.error("Cloud sync failed:", e);
      } finally {
          setIsSyncingToCloud(false);
      }
  };

  const handleBatchUpdate = (newLots: Lot[], newLotsData: Map<string, LotInfo>, changedIds?: string[]) => {
      console.log(`Promoting Batch Update: ${newLots.length} lots, ${newLotsData.size} info records`);
      
      if (changedIds) {
          changedIds.forEach(id => dirtyLotIdsRef.current.add(id));
      } else {
          newLots.forEach(l => dirtyLotIdsRef.current.add(l.id)); 
      }
      persistQueues();

      setManualLots(newLots);
      setLotsData(newLotsData);
  };
  
  const handleDeleteIds = (deletedIds: string[]) => {
      deletedIds.forEach(id => {
          deletedLotIdsRef.current.add(id);
          dirtyLotIdsRef.current.delete(id); 
      });
      persistQueues();
      saveToCloud(); 
  };

  const handleLotClick = (lot: Lot | null, shouldEdit: boolean = false) => {
    if (!lot) {
        setSelectedLot(null);
        return;
    }

    const savedInfo = lotsData.get(lot.id);
    setStartEditing(shouldEdit);

    if (savedInfo) {
      setSelectedLot({
        ...lot,
        info: savedInfo,
      });
    } else {
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

  const handleSaveLotInfo = (lotInfo: LotInfo) => {
    dirtyLotIdsRef.current.add(lotInfo.id);
    persistQueues();

    setLotsData((prev) => {
      const newMap = new Map(prev);
      newMap.set(lotInfo.id, lotInfo);
      return newMap;
    });

    if (selectedLot) {
      setSelectedLot({
        ...selectedLot,
        info: lotInfo,
      });
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
      a.download = `mapa-mobile-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
  };

  const handleManualCloudSync = async () => {
      const dirtyIds = Array.from(dirtyLotIdsRef.current);
      const deletedIds = Array.from(deletedLotIdsRef.current);
      const hasChanges = dirtyIds.length > 0 || deletedIds.length > 0;

      if (hasChanges) {
          if (!confirm(`Existem ${dirtyIds.length} alterações e ${deletedIds.length} exclusões pendentes. Sincronizar agora?`)) return;
          
          setIsSyncingToCloud(true);
          try {
             await syncLotsToFirestore(manualLots, lotsData, dirtyIds, deletedIds);
             
             dirtyIds.forEach(id => dirtyLotIdsRef.current.delete(id));
             deletedIds.forEach(id => deletedLotIdsRef.current.delete(id));
             persistQueues();
             
             const now = new Date();
             setCloudDate(now);
             localStorage.setItem("last_cloud_sync", now.toISOString());
             alert("Sincronização concluída!");
          } catch (e: any) {
             console.error("Sync Failed:", e);
             alert(`Erro: ${e.message}`);
          } finally {
             setIsSyncingToCloud(false);
          }
      } else {
          if (!confirm("Deseja forçar o re-envio de TODOS os dados?")) return;
           
          setIsSyncingToCloud(true);
          try {
              await syncLotsToFirestore(manualLots, lotsData); 
              
              const now = new Date();
              setCloudDate(now);
              localStorage.setItem("last_cloud_sync", now.toISOString());
              alert("Sincronização completa!");
          } catch (e: any) {
              console.error("Force Sync Failed:", e);
              alert(`Erro: ${e.message}`);
          } finally {
              setIsSyncingToCloud(false);
          }
      }
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-gray-100">
        <AppSidebar 
            selectedLot={selectedLot} 
            lotsData={lotsData}
            manualLots={manualLots}
            onSelectLot={handleLotClick}
            onExportBackup={handleExportBackup}
            lastSaved={lastSaved}
            highlightedLots={highlightedLots}
            onSetHighlightedLots={setHighlightedLots}
            onSetHighlightSource={setHighlightSource}
            onOpenSmartCalc={() => setIsSmartCalcOpen(true)}
            isMobile={true}
        />
        
        <SidebarInset className="relative flex flex-col flex-1 h-full overflow-hidden">
             {/* Map Container */}
             <div className="flex-1 relative w-full h-full">
                {/* Floating Sidebar Trigger (Mobile optimized) */}
                <div className="absolute top-4 left-4 z-50 flex items-center gap-2">
                    <SidebarTrigger className="bg-white shadow-md border border-gray-200 rounded-lg" />
                    {isSyncingToCloud && (
                        <div className="bg-blue-600 text-white text-xs px-2 py-1 rounded shadow-md animate-pulse">
                            ☁️ Salvando...
                        </div>
                    )}
                </div>

                <InteractiveMap
                    onLotClick={handleLotClick}
                    selectedLotId={selectedLot?.id}
                    manualLots={manualLots}
                    setManualLots={setManualLots}
                    lotsData={lotsData}
                    onBatchUpdate={handleBatchUpdate}
                    onDeleteIds={handleDeleteIds}
                    onExportBackup={handleExportBackup}
                    onCloudSync={handleManualCloudSync}
                    highlightedLots={highlightedLots}
                    isMobile={true}
                    undo={undo}
                    redo={redo}
                    canUndo={canUndo}
                    canRedo={canRedo}
                />

                {/* Update Prompt */}
                {updateAvailable && (
                    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 fade-in">
                        <button 
                            className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors text-sm"
                            onClick={() => {
                                checkForUpdates();
                                setUpdateAvailable(false);
                            }}
                        >
                            <span>🔄 Atualização disponível</span>
                        </button>
                    </div>
                )}
             </div>
        </SidebarInset>

        {/* LOT INSPECTOR (FLOATING - Mobile optimized) */}
        {/* Don't show when browsing search results to avoid overlap */}
        {highlightSource !== 'search' && (
            <LotInspector 
               lot={selectedLot}
               onClose={handleCloseLotFolder}
               onSave={handleSaveLotInfo}
               lotsData={lotsData}
               isMobile={true}
            />
        )}

        {/* SEARCH NAVIGATOR (FLOATING ON MAP) */}
        {highlightSource === 'search' && (
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
                isMobile={true}
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
            isMobile={true}
        />

      </div>
    </SidebarProvider>
  );
}
