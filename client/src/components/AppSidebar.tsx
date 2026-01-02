import React, { useState } from "react";
import { Lot, LotInfo } from "@/types";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { 
  Map as MapIcon, 
  Search, 
  Layers, 
  User,
  Calculator,
  ArrowRightCircle
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { syncLotsToFirestore } from "@/lib/firestoreSync";
import { auth } from "@/lib/auth"; 
import { useLocation } from "wouter"; 
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Progress } from "./ui/progress";

interface AppSidebarProps {
  lotsData: Map<string, LotInfo>;
  manualLots: Lot[];
  onSelectLot: (lot: Lot | null) => void;
  onExportBackup: () => void;
  lastSaved: Date | null;
  highlightedLots: Lot[]; 
  onSetHighlightedLots: (lots: Lot[]) => void; 
  onOpenSmartCalc: () => void;
  selectedLot: Lot | null;
  isMobile?: boolean; // Mobile detection prop
}

export function AppSidebar({
  lotsData = new Map(),
  manualLots = [],
  onSelectLot,
  onExportBackup,
  lastSaved,
  highlightedLots = [],
  onSetHighlightedLots,
  onOpenSmartCalc,
  selectedLot,
  isMobile = false
}: AppSidebarProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Lot[]>([]); 
  const [importProgress, setImportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    auth.logout();
    setLocation("/login");
    toast.info("Sessão encerrada");
  };

  const handleChangePassword = () => {
    const newPass = prompt("Digite a nova senha:");
    if (newPass) {
      auth.changePassword(newPass);
      toast.success("Senha alterada com sucesso!");
    }
  };

  // Search Logic
  React.useEffect(() => {
      if (!searchTerm.trim()) {
          setSearchResults([]);
          onSetHighlightedLots([]); // Clear highlights when search is empty
          return;
      }
      const terms = searchTerm.toLowerCase().split(' ').filter(t => t.length > 0);
      
      const results = manualLots.filter(l => {
          const info = lotsData.get(l.id) || l.info;
          const owner = info.owner?.toLowerCase() || '';
          const aliases = info.aliases?.join(' ').toLowerCase() || '';
          const displayId = info.displayId?.toLowerCase() || '';
          // const notes = info.notes?.toLowerCase() || ''; // Notes excluded from search as per request
          
          const searchable = `quadra ${l.quadra} lote ${l.lote} q${l.quadra} l${l.lote} ${l.quadra} ${l.lote} ${owner} ${aliases} ${displayId}`;
          return terms.every(term => searchable.includes(term));
      });

      setSearchResults(results.slice(0, 50)); 
      onSetHighlightedLots(results); // Highlight ALL matches on the map
  }, [searchTerm, manualLots]);

  // --- GENERAL MAP INFO ---
  const uniqueQuadras = new Set(manualLots.map(l => l.quadra)).size;
  const totalLotesCount = manualLots.length;
  const stats = {
      totalQuadras: uniqueQuadras > 0 ? uniqueQuadras : "-", 
      totalLotes: totalLotesCount > 0 ? totalLotesCount : "-"
  };
  const notesCount = Array.from(lotsData.values()).filter(l => (l.notes || "").length > 0).length;

  // On DESKTOP: Show quadra details when a lot is selected
  // On MOBILE: Skip quadra details (tooltip already shows this info)
  if (selectedLot && !isMobile) {
    // Show Quadra Info for the selected lot
    const quadraId = selectedLot.quadra;
    const quadraLots = manualLots.filter(l => l.quadra === quadraId);
    
    // Status Logic Helper
    const getLotStatus = (lot: Lot) => {
        const info = lotsData.get(lot.id) || lot.info;
        if (info?.isAvailable) return 'disponivel';
        if (info?.status === 'ocupado' || info?.status === 'vendido') return 'ocupado';
        if (info?.status === 'livre' || info?.status === 'reservado') return 'livre';
        return 'neutro';
    };

    const totalLots = quadraLots.length;
    const available = quadraLots.filter(l => getLotStatus(l) === 'disponivel').length;
    const ocupado = quadraLots.filter(l => getLotStatus(l) === 'ocupado').length;
    const livre = quadraLots.filter(l => getLotStatus(l) === 'livre').length;
    
    // Sort lots numerically
    const sortedLots = [...quadraLots].sort((a, b) => {
        const nA = parseInt(a.lote.replace(/\D/g, '')) || 0;
        const nB = parseInt(b.lote.replace(/\D/g, '')) || 0;
        return nA - nB;
    });

    // Mobile-specific styling with MAXIMUM contrast
    const sidebarClasses = isMobile
      ? "border-r-4 border-cyan-400 bg-black backdrop-blur-xl text-white shadow-[0_0_60px_rgba(6,182,212,0.8)]"
      : "border-r border-white/20 bg-zinc-950/95 backdrop-blur-xl text-white shadow-xl";

    return (
      <Sidebar className={sidebarClasses}>
        <SidebarHeader className="bg-white/5 border-b border-white/10 p-6">
          <div className="flex items-center justify-between">
             <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Quadra {quadraId}</h2>
                <p className="text-blue-200 text-xs font-semibold tracking-wide mt-1 uppercase">Informações da Quadra</p>
             </div>
             <Button variant="ghost" size="icon" onClick={() => onSelectLot(null)} className="text-gray-400 hover:text-white">
                 <ArrowRightCircle size={20} className="rotate-180" />
             </Button>
          </div>
        </SidebarHeader>
        
        <SidebarContent className="p-4 gap-6">
            
                <div className="bg-green-500/10 border border-green-500/20 p-3 rounded-lg text-center flex flex-col justify-center min-w-[60px]">
                    <div className="text-2xl font-bold text-green-400 leading-none mb-1">{available}</div>
                    <div className="text-[10px] uppercase text-green-200/50 font-bold break-all">Disponíveis</div>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-center flex flex-col justify-center min-w-[60px]">
                    <div className="text-2xl font-bold text-red-400 leading-none mb-1">{ocupado}</div>
                    <div className="text-[10px] uppercase text-red-200/50 font-bold break-all">Ocupados</div>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-lg text-center flex flex-col justify-center min-w-[60px]">
                    <div className="text-2xl font-bold text-yellow-400 leading-none mb-1">{livre}</div>
                    <div className="text-[10px] uppercase text-yellow-200/50 font-bold break-all">Livres</div>
                </div>
           

            <Separator className="bg-white/10" />

            <div className="space-y-2">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Lotes na Quadra</h3>
                <div className="grid grid-cols-4 gap-2">
                    {sortedLots.map(l => {
                         const status = getLotStatus(l);
                         return (
                            <div 
                                key={l.id} 
                                onClick={() => onSelectLot(l)}
                                className={`
                                    cursor-pointer rounded-md p-2 text-center text-xs font-bold border transition-all
                                    flex items-center justify-center min-h-[36px] break-all leading-tight
                                    ${selectedLot && l.id === selectedLot.id ? 'bg-blue-600 text-white border-blue-400 scale-105 shadow-lg' : 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-300'}
                                    ${selectedLot && status === 'ocupado' && l.id !== selectedLot.id ? 'opacity-50 text-red-300/50 border-red-500/10' : ''}
                                    ${selectedLot && status === 'disponivel' && l.id !== selectedLot.id ? 'text-green-300/70 border-green-500/10' : ''}
                                    ${selectedLot && status === 'livre' && l.id !== selectedLot.id ? 'text-yellow-300/70 border-yellow-500/10' : ''}
                                `}
                            >
                                {l.lote}
                            </div>
                        );
                    })}
                </div>
            </div>

        </SidebarContent>
      </Sidebar>
    );
  }

  // Mobile-specific styling with MAXIMUM contrast and visibility
  const sidebarClasses = isMobile
    ? "border-r-4 border-cyan-400 bg-black backdrop-blur-xl text-white shadow-[0_0_60px_rgba(6,182,212,0.8)]"
    : "border-r border-white/20 bg-zinc-950/95 backdrop-blur-xl text-white";

  // Button size classes for mobile touch optimization
  const buttonSizeClasses = isMobile
    ? "min-h-12 text-base px-4 py-3" // 48px height for touch
    : "min-h-9 text-xs px-3 py-2";   // Original desktop

  return (
    <Sidebar className={sidebarClasses}>
      <SidebarHeader className="border-b border-white/10 px-6 py-8 relative overflow-hidden shrink-0">
         <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 to-transparent" />
        <h1 className="text-3xl font-black tracking-tight text-white mb-1 drop-shadow-lg">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">ACAPULCO</span> MAP
        </h1>
        <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-[10px] text-blue-200/60 font-mono tracking-[0.2em] uppercase">Sistema Inteligente v2.1</p>
        </div>
      </SidebarHeader>

      <SidebarContent className="flex flex-col gap-6 p-2 pr-4 scrollbar-thin">
        {/* GLOBAL SEARCH */}
        <SidebarGroup className="shrink-0 relative overflow-visible z-50">
            <div className="px-4 pb-2 relative">
                <div className="relative z-20">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" size={16} />
                    <Input 
                        placeholder="Buscar Lote (Ex: Q15 L10)..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-9 bg-black/50 border-white/20 text-white placeholder:text-gray-400 focus:bg-white/5 focus:border-blue-500/50 transition-all font-medium relative z-10"
                    />
                </div>
                
                {/* SEARCH RESULTS */}
                {searchTerm && (
                    <div className="absolute left-4 top-[calc(100%+0.5rem)] w-[calc(100%-2rem)] bg-zinc-950/95 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl shadow-2xl animate-in slide-in-from-top-2 duration-200 z-50 ring-1 ring-white/10">
                        <div className="px-4 py-3 bg-white/5 border-b border-white/5 text-[10px] font-bold text-gray-400 uppercase tracking-widest flex justify-between items-center shrink-0">
                            <span className="flex items-center gap-2">
                                <Search size={10} className="text-blue-400" />
                                Resultados
                            </span>
                            <span className="bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded text-[9px]">{searchResults.length}</span>
                        </div>
                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-2 space-y-1">
                            {searchResults.length === 0 ? (
                                <div className="p-8 text-center text-sm text-gray-500 italic flex flex-col items-center gap-2">
                                    <Search size={24} className="opacity-20" />
                                    <span>Nenhum lote encontrado.</span>
                                </div>
                            ) : (
                                <>
                                    {searchResults.map((lot, index) => (
                                        <button
                                            key={lot.id}
                                            onClick={() => {
                                                onSelectLot(lot);
                                                setSearchTerm(""); 
                                            }}
                                            className="w-full text-left p-3 rounded-xl bg-white/5 hover:bg-blue-600/20 border border-transparent hover:border-blue-500/30 transition-all group flex items-center justify-between animate-in fade-in slide-in-from-bottom-2"
                                            style={{ animationDelay: `${index * 50}ms` }}
                                        >
                                            <div className="flex flex-col gap-0.5">
                                                <div className="flex items-baseline gap-2">
                                                    <span className="font-black text-lg text-white group-hover:text-blue-200 tracking-tight">Lote {lot.lote}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-gray-400 text-[10px] lowercase">
                                                    <span className="bg-white/10 px-1 py-0.5 rounded text-gray-300 uppercase font-bold tracking-wider">Q{lot.quadra}</span>
                                                    <span>quadra {lot.quadra}</span>
                                                </div>
                                            </div>
                                            <div className="w-8 h-8 rounded-full bg-white/5 group-hover:bg-blue-500/20 flex items-center justify-center transition-colors">
                                                <ArrowRightCircle size={16} className="text-gray-500 group-hover:text-blue-400 -rotate-45 group-hover:rotate-0 transition-all duration-300" />
                                            </div>
                                        </button>
                                    ))}
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Visão Geral</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="grid grid-cols-2 gap-3 p-1">
                <div className="bg-gradient-to-br from-blue-900/40 to-black/40 p-5 rounded-2xl border border-blue-500/20 hover:border-blue-500/40 transition-all group backdrop-blur-sm cursor-default relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 blur-2xl rounded-full -mr-8 -mt-8 pointer-events-none" />
                    <div className="text-4xl font-black text-white group-hover:scale-110 transition-transform origin-left tracking-tighter drop-shadow-lg z-10 relative">{stats.totalQuadras}</div>
                    <div className="text-[10px] text-blue-200/70 font-bold uppercase tracking-widest mt-2 group-hover:text-blue-200 transition-colors z-10 relative">Quadras</div>
                </div>
                 <div className="bg-gradient-to-br from-cyan-900/40 to-black/40 p-5 rounded-2xl border border-cyan-500/20 hover:border-cyan-500/40 transition-all group backdrop-blur-sm cursor-default relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-cyan-500/10 blur-2xl rounded-full -mr-8 -mt-8 pointer-events-none" />
                    <div className="text-4xl font-black text-white group-hover:scale-110 transition-transform origin-left tracking-tighter drop-shadow-lg z-10 relative">{stats.totalLotes}</div>
                    <div className="text-[10px] text-cyan-200/70 font-bold uppercase tracking-widest mt-2 group-hover:text-cyan-200 transition-colors z-10 relative">Lotes</div>
                </div>
            </div>
            <div className="px-1 mt-3">
                <div className="bg-gradient-to-r from-amber-500/10 to-orange-900/20 p-5 rounded-2xl border border-amber-500/20 flex items-center justify-between hover:border-amber-500/40 transition-all cursor-default relative overflow-hidden group">
                     <div className="absolute inset-0 bg-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                     <span className="text-[10px] text-amber-200/80 font-bold uppercase tracking-widest z-10">Lotes com<br/>Anotações</span>
                     <span className="text-3xl font-black text-amber-500 tracking-tighter z-10 group-hover:scale-110 transition-transform">{notesCount}</span>
                </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-2">
          <SidebarGroupLabel className="mb-2">Ferramentas</SidebarGroupLabel>
          <SidebarGroupContent className="px-2">
            <Button 
                className={`w-full bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-600/20 mb-3 justify-start gap-2 h-auto whitespace-normal text-left ${buttonSizeClasses}`}
                onClick={onOpenSmartCalc}
            >
                <Search size={isMobile ? 20 : 16} className="shrink-0" />
                <span>Busca Smart</span>
            </Button>
            
            <div className="relative">
                <input 
                    type="file" 
                    accept=".json"
                    className="hidden"
                    id="import-json-trigger"
                    onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        
                        // Clear value so same file can be selected again
                        e.target.value = '';
                        
                        const confirmImport = confirm(`Importar dados de "${file.name}"? Isso atualizará lotes existentes.`);
                        if (!confirmImport) return;

                        try {
                            setIsImporting(true);
                            setImportProgress(0);
                            
                            const { importLotData } = await import("@/lib/dataImport"); // Dynamic import
                            const text = await file.text();
                            const json = JSON.parse(text);
                            
                            if (!Array.isArray(json)) throw new Error("O arquivo deve conter uma lista JSON.");
                            
                            const res = await importLotData(json, (current, total) => {
                                const pct = Math.round((current / total) * 100);
                                setImportProgress(pct);
                            });

                            if (res.errors > 0) {
                                console.warn("Import warning:", res.details);
                                toast.warning(`Importado: ${res.processed} | Alterações: ${res.processed} | Sem mudanças: ${res.skipped} | Erros: ${res.errors}.`);
                            } else {
                                toast.success(`Sucesso! ${res.processed} lotes atualizados. ${res.skipped} sem alterações.`);
                            }
                            
                        } catch (err: any) {
                            console.error(err);
                            toast.error(err.message);
                        } finally {
                            setIsImporting(false);
                            setImportProgress(0);
                        }
                    }}
                />
                
                {isImporting ? (
                     <div className="w-full bg-emerald-900/10 border border-emerald-500/20 mb-3 p-3 rounded-md">
                         <div className="flex justify-between items-center mb-2">
                             <span className="text-[10px] uppercase text-emerald-400 font-bold tracking-wider">Importando...</span>
                             <span className="text-xs text-white font-mono">{importProgress}%</span>
                         </div>
                         <Progress value={importProgress} className="h-1 bg-emerald-900/50" />
                     </div>
                ) : (
                    <Button 
                        variant="ghost"
                        className={`w-full bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-600/20 mb-3 justify-start gap-2 h-auto whitespace-normal text-left ${buttonSizeClasses}`}
                        onClick={() => document.getElementById('import-json-trigger')?.click()}
                    >
                        <Layers size={isMobile ? 20 : 16} className="shrink-0" />
                        <span>Importar Dados</span>
                    </Button>
                )}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>



        <SidebarGroup className="mt-auto pt-4 border-t border-white/5 mx-2">
          <SidebarGroupLabel className="mb-3 text-xs font-bold text-gray-500 uppercase tracking-widest">Legenda do Mapa</SidebarGroupLabel>
          <SidebarGroupContent>
             <div className="grid grid-cols-2 gap-3 pb-2">
                {/* Disponível - Green */}
                <div className="flex items-center gap-3 bg-green-500/5 border border-green-500/10 p-3 rounded-xl hover:bg-green-500/10 transition-colors">
                   <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-pulse"></div> 
                   <span className="font-bold text-[10px] text-green-200 uppercase tracking-widest">Disponível</span>
                </div>
                
                {/* Ocupado - Red */}
                <div className="flex items-center gap-3 bg-red-500/5 border border-red-500/10 p-3 rounded-xl hover:bg-red-500/10 transition-colors">
                   <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div> 
                   <span className="font-bold text-[10px] text-red-200 uppercase tracking-widest">Ocupado</span>
                </div>

                {/* Livre - Yellow */}
                <div className="flex items-center gap-3 bg-yellow-500/5 border border-yellow-500/10 p-3 rounded-xl hover:bg-yellow-500/10 transition-colors">
                   <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]"></div> 
                   <span className="font-bold text-[10px] text-yellow-200 uppercase tracking-widest">Livre</span>
                </div>

                {/* Neutro - Gray */}
                <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-3 rounded-xl hover:bg-white/10 transition-colors">
                   <div className="w-2.5 h-2.5 rounded-full bg-gray-500"></div> 
                   <span className="font-bold text-[10px] text-gray-300 uppercase tracking-widest">Neutro</span>
                </div>
             </div>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>

      <SidebarFooter className="p-4 space-y-3 border-t border-white/10 bg-zinc-950/50">
          <Button 
            variant="outline" 
            className={`w-full justify-start border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all h-auto whitespace-normal ${buttonSizeClasses}`}
            onClick={handleChangePassword}
          >
            <div className="p-1 bg-white/10 rounded mr-2 shrink-0"><User size={isMobile ? 16 : 12} /></div>
            Trocar Senha
          </Button>
          <Button 
            variant="destructive" 
            className={`w-full justify-start bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:text-red-300 h-auto whitespace-normal transition-all ${buttonSizeClasses}`}
            onClick={handleLogout}
          >
            <div className="p-1 bg-red-500/20 rounded mr-2"><div className="w-2 h-2 rounded-full bg-red-500 box-shadow-glow" /></div>
            Sair do Sistema
          </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
