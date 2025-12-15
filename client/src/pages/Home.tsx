/**
 * Página Principal - Mapa Interativo
 * 
 * Exibe o mapa interativo e gerencia a seleção de lotes
 * Integra o componente de mapa com a pasta de lote
 */

import React, { useState, useEffect } from "react";
import { Lot, LotInfo } from "@/types";
import InteractiveMap from "@/components/InteractiveMap";
import LotFolder from "@/components/LotFolder";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";

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

  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [lotsData, setLotsData] = useState<Map<string, LotInfo>>(() => {
    // Carregar dados salvos do localStorage ao iniciar
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
  
  // --- SYNC STATE ---
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"checking" | "syncing" | "uptodate" | "error">("checking");
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncTotal, setSyncTotal] = useState(0);
  const [cloudDate, setCloudDate] = useState<Date | null>(null);

  // --- STARTUP CHECK ---
  useEffect(() => {
      const checkCloud = async () => {
          try {
              // Only check if we haven't checked recently? For now check always on boot.
              const cloudState = await import("../lib/firestoreSync").then(m => m.checkCloudStatus());
              
              if (cloudState.lastUpdated) {
                  setCloudDate(cloudState.lastUpdated);
                  
                  // Simple check: If cloud exists and (local is empty OR cloud is newer)
                  // For Development: Always suggest sync if cloud exists? 
                  // Let's use a "Last Synced" timestamp in localStorage if available.
                  const localLastSync = localStorage.getItem("last_cloud_sync");
                  
                  const localDate = localLastSync ? new Date(localLastSync) : new Date(0);
                  
                  // Check if cloud is significantly newer (> 1 min)
                  if (cloudState.lastUpdated.getTime() > localDate.getTime() + 60000) {
                      setSyncStatus("checking"); // Triggers modal prompt
                      setShowSyncModal(true);
                  }
              }
          } catch (e) {
              console.error("Failed to check cloud:", e);
          }
      };
      checkCloud();
  }, []);

  const handleDownloadFromCloud = async () => {
      setSyncStatus("syncing");
      setSyncProgress(0);
      try {
          const { fetchLotsFromFirestore } = await import("../lib/firestoreSync");
          const { locLots, infoMap } = await fetchLotsFromFirestore((current, total) => {
              setSyncProgress(current);
              setSyncTotal(total);
          });

          // Update State
          // Merge with existing manuaLots? Or Replace?
          // Strategy: Replace "Manual Lots" with Cloud Lots as Source of Truth.
          // BUT: Keep local-only changes? No, "Sync" implies Cloud is Truth.
          
          setManualLots(locLots);
          setLotsData(infoMap); // This needs to be lifted or handled? 
          // Wait, setLotsData is not in Home props passed down usually... 
          // Ah, lotsData is LOCAL in Home.tsx? Let's check.
          
          // Home.tsx doesn't have setLotsData exposed easily... 
          // Wait, Home.tsx HAS lotsData state? 
          // Let me check file content again quickly.
          
          localStorage.setItem("last_cloud_sync", new Date().toISOString());
          setSyncStatus("uptodate");
          setTimeout(() => setShowSyncModal(false), 2000);
      } catch (e) {
          console.error("Sync Download Failed:", e);
          setSyncStatus("error");
      }
  };

  // State lifted from InteractiveMap
  const [manualLots, setManualLots] = useState<Lot[]>(() => {
      try {
          let saved = localStorage.getItem("manualMapData_v2");
          
          // Fallback/Migration: Check v1 if v2 is missing or empty
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
  });

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

  const handleLotClick = (lot: Lot) => {
    // Atualizar as informações do lote com os dados salvos
    const savedInfo = lotsData.get(lot.id);
    if (savedInfo) {
      setSelectedLot({
        ...lot,
        info: savedInfo,
      });
    } else {
      setSelectedLot(lot);
    }
  };

  const handleSaveLotInfo = (lotInfo: LotInfo) => {
    setLotsData((prev) => {
      const newMap = new Map(prev);
      newMap.set(lotInfo.id, lotInfo);
      return newMap;
    });

    // Atualizar o lote selecionado
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
      a.download = `mapa-acapulco-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-gray-100">
        <AppSidebar 
            selectedLot={selectedLot} 
            onCloseLot={handleCloseLotFolder}
            onSaveLot={handleSaveLotInfo}
            lotsData={lotsData}
            manualLots={manualLots}
            onSelectLot={handleLotClick}
            onExportBackup={handleExportBackup}
            lastSaved={lastSaved}
        />
        
        <SidebarInset className="relative flex flex-col flex-1 h-full overflow-hidden">
             {/* Map Container */}
             <div className="flex-1 relative w-full h-full">
                {/* Floating Sidebar Trigger (Mobile/Desktop Collapsed) */}
                <div className="absolute top-4 left-4 z-50">
                    <SidebarTrigger className="bg-white shadow-md border border-gray-200 rounded-lg" />
                </div>

                <ErrorBoundary>
                    <InteractiveMap
                    onLotClick={handleLotClick}
                    selectedLotId={selectedLot?.id}
                    manualLots={manualLots}
                    setManualLots={setManualLots}
                    />
                </ErrorBoundary>
             </div>
        </SidebarInset>

        {/* SYNC MODAL */}
        {showSyncModal && (
            <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                    <h3 className="text-lg font-bold mb-2">Sincronização com a Nuvem</h3>
                    
                    {syncStatus === "checking" && (
                        <div>
                            <p className="text-sm text-gray-600 mb-4">
                                Encontramos dados mais recentes na nuvem ({cloudDate?.toLocaleString()}).
                                Deseja atualizar seu mapa local?
                            </p>
                            <div className="flex justify-end gap-2">
                                <button 
                                    onClick={() => setShowSyncModal(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                                >
                                    Ignorar
                                </button>
                                <button 
                                    onClick={handleDownloadFromCloud}
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                                >
                                    Atualizar Agora
                                </button>
                            </div>
                        </div>
                    )}

                    {syncStatus === "syncing" && (
                        <div>
                            <p className="text-sm text-gray-600 mb-2">Baixando dados... {syncProgress} / {syncTotal}</p>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                                <div 
                                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                                    style={{ width: `${syncTotal > 0 ? (syncProgress / syncTotal) * 100 : 0}%` }}
                                ></div>
                            </div>
                        </div>
                    )}

                    {syncStatus === "uptodate" && (
                        <div className="text-center text-green-600 font-bold py-4">
                            ✅ Mapa Atualizado com Sucesso!
                        </div>
                    )}

                     {syncStatus === "error" && (
                        <div className="text-center text-red-600 py-4">
                            ❌ Erro ao baixar dados. Tente novamente.
                            <br/>
                            <button onClick={() => setShowSyncModal(false)} className="mt-2 text-sm underline text-gray-500">Fechar</button>
                        </div>
                    )}
                </div>
            </div>
        )}

      </div>
    </SidebarProvider>
  );
}
