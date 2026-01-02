import React, { useState } from "react";
import { Lot, LotInfo } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription, 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Calculator, Edit2, X, ChevronLeft, ChevronRight } from "lucide-react";
import { findContiguousCombinations, CombinationResult } from "@/lib/adjacency";

interface SmartCalcModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  manualLots: Lot[];
  lotsData: Map<string, LotInfo>;
  onSetHighlightedLots: (lots: Lot[]) => void;
  onSelectLot: (lot: Lot) => void;
  highlightedLots: Lot[];
  calcResults: CombinationResult[];
  setCalcResults: (results: CombinationResult[]) => void;
  isMobile?: boolean; // Mobile detection
}

export function SmartCalcModal({
  isOpen,
  onOpenChange,
  manualLots,
  lotsData,
  onSetHighlightedLots,
  onSelectLot,
  highlightedLots,
  calcResults,
  setCalcResults,
  isMobile = false
}: SmartCalcModalProps) {
  const [calcArea, setCalcArea] = useState("");
  const [isCalculating, setIsCalculating] = useState(false);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);

  const handleSmartCalc = () => {
    if (!calcArea || isNaN(Number(calcArea))) return;
    setIsCalculating(true);
    // Timeout to allow UI render
    setTimeout(() => {
        const target = Number(calcArea);
        
        // 1. Prepare available lots with fresh data
        const availableLots = manualLots.map(lot => {
             const info = lotsData.get(lot.id) || lot.info || {};
             // Ensure area is a number
             return { 
                 ...lot, 
                 info: { 
                     ...info, 
                     area: Number(info.area || 0) 
                 } 
             };
        });

        // Search Logic: Find Single Lots within Range (+/- 100m² OR tolerance)
        const min = target - 100;
        const max = target + 100;

        const results = availableLots.filter(lot => {
            const area = Number(lot.info.area || 0);
            return area >= min && area <= max;
        }).map(lot => ({
            lots: [lot],
            totalArea: Number(lot.info.area || 0)
        } as any));

        // 3. Sort by closeness to target
        results.sort((a, b) => Math.abs(a.totalArea - target) - Math.abs(b.totalArea - target));

        setCalcResults(results);
        setIsCalculating(false);
        
        // Auto-select first result if found
        if (results.length > 0) {
            setCurrentResultIndex(0);
            onSetHighlightedLots(results[0].lots);
        } else {
             onSetHighlightedLots([]);
        }
    }, 100);
  };
  
  const nextResult = () => {
      if (calcResults.length === 0) return;
      const next = (currentResultIndex + 1) % calcResults.length;
      setCurrentResultIndex(next);
      onSetHighlightedLots(calcResults[next].lots);
  };

  const prevResult = () => {
      if (calcResults.length === 0) return;
      const prev = (currentResultIndex - 1 + calcResults.length) % calcResults.length;
      setCurrentResultIndex(prev);
      onSetHighlightedLots(calcResults[prev].lots);
  };

  // MOBILE: Bottom Sheet (map remains visible)
  if (isMobile) {
    if (!isOpen) return null;
    
    return (
      <>
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black/50 z-[110] animate-in fade-in"
          onClick={() => onOpenChange(false)}
        />
        
        {/* Bottom Sheet */}
        <div className="fixed inset-x-0 bottom-0 top-[35%] z-[111] bg-zinc-950/98 rounded-t-3xl shadow-[0_-10px_50px_rgba(59,130,246,0.5)] border-t-4 border-blue-500/70 animate-in slide-in-from-bottom flex flex-col">
          {/* Drag Handle */}
          <div className="w-full flex justify-center pt-3 pb-2">
            <div className="w-12 h-1.5 rounded-full bg-white/20" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <Search className="text-blue-500" size={24} />
              <h2 className="text-xl font-bold text-white">Busca Smart</h2>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={24} className="text-gray-400" />
            </button>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* INPUT SECTION */}
            <div className="space-y-2">
              <label className="text-sm text-gray-400 font-bold uppercase tracking-wider">Área Desejada (m²)</label>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Input 
                    placeholder="Ex: 1000" 
                    type="number"
                    value={calcArea}
                    onChange={(e) => setCalcArea(e.target.value)}
                    className="bg-black/50 border-white/20 text-white pl-12 h-14 text-lg focus:border-blue-500/50"
                    onKeyDown={(e) => e.key === 'Enter' && handleSmartCalc()}
                  />
                  <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
                <Button 
                  size="icon" 
                  className="bg-blue-600 hover:bg-blue-500 text-white h-14 w-14 shrink-0"
                  onClick={handleSmartCalc}
                  disabled={isCalculating}
                >
                  {isCalculating ? <span className="animate-spin text-xl">⌛</span> : <Search size={22} />}
                </Button>
              </div>
            </div>

            {/* RESULTS SECTION */}
            {calcResults.length > 0 && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                <div className="px-4 py-3 bg-white/5 border-b border-white/10 text-sm font-bold text-emerald-400 uppercase flex justify-between items-center rounded-t-xl">
                  <span>Resultados</span>
                  <div className="flex items-center gap-3">
                    <Button size="icon" variant="ghost" className="h-9 w-9 hover:bg-white/10" onClick={prevResult} title="Anterior">
                      <ChevronLeft size={18} />
                    </Button>
                    <span className="text-white text-base font-mono min-w-[60px] text-center">
                      {currentResultIndex + 1} / {calcResults.length}
                    </span>
                    <Button size="icon" variant="ghost" className="h-9 w-9 hover:bg-white/10" onClick={nextResult} title="Próximo">
                      <ChevronRight size={18} />
                    </Button>
                  </div>
                </div>
                <div className="max-h-[180px] overflow-y-auto custom-scrollbar border border-white/10 rounded-b-xl bg-black/20">
                  {calcResults.map((res, i) => (
                    <button 
                      key={i}
                      className={`w-full text-left px-4 py-4 hover:bg-blue-500/10 text-sm transition-colors group flex flex-col gap-2 border-b border-white/5 last:border-0 ${i === currentResultIndex ? 'bg-blue-500/20 border-l-4 border-l-blue-400' : ''}`}
                      onClick={() => {
                        setCurrentResultIndex(i);
                        onSetHighlightedLots(res.lots);
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-blue-400 group-hover:text-blue-300 text-base">
                          Quadra {res.lots[0].quadra}
                        </span>
                        <span className="text-emerald-400 font-bold bg-emerald-400/10 px-2 py-1 rounded border border-emerald-400/20 text-sm">
                          {res.totalArea} m²
                        </span>
                      </div>
                      <div className="text-gray-400 truncate flex items-center gap-2">
                        <span className="text-xs uppercase font-semibold text-gray-600">Lotes:</span>
                        <span className="text-sm">{res.lots.map(l => l.lote).join(", ")}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {calcResults.length === 0 && calcArea && !isCalculating && (
              <div className="text-sm text-gray-500 text-center italic py-6 bg-white/5 rounded-lg">
                Nenhuma combinação encontrada para {calcArea}m².
              </div>
            )}
            
            {/* CURRENT HIGHLIGHTS */}
            {highlightedLots.length > 0 && (
              <div className="pt-4 border-t border-white/10">
                <div className="flex justify-between items-center mb-3">
                  <div className="text-sm font-bold text-blue-300 uppercase">Seleção Atual</div>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => onSetHighlightedLots([])}>
                    <X size={16}/>
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {highlightedLots.map(lot => (
                    <div key={lot.id} className="bg-blue-500/20 text-blue-200 text-sm px-3 py-2 rounded-lg border border-blue-500/30 flex items-center gap-2 cursor-pointer hover:bg-blue-500/40 active:scale-95 transition-all" onClick={() => onSelectLot(lot)}>
                      <span className="font-medium">Q{lot.quadra}-L{lot.lote}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-right text-base font-bold text-emerald-400">
                  Total: {highlightedLots.reduce((acc, l) => acc + Number((lotsData.get(l.id)||l.info).area || 0), 0).toFixed(2)} m²
                </div>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // DESKTOP: Original Dialog
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border-white/20 text-white sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Search className="text-blue-500" />
            Busca Smart
          </DialogTitle>
          <DialogDescription>
            Encontre combinações de lotes ideais.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
             {/* INPUT SECTION */}
             <div className="space-y-2">
               <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Área Desejada (m²)</label>
               <div className="flex gap-2">
                  <div className="relative flex-1">
                      <Input 
                        placeholder="Ex: 1000" 
                        type="number"
                        value={calcArea}
                        onChange={(e) => setCalcArea(e.target.value)}
                        className="bg-black/50 border-white/20 text-white pl-8 focus:border-blue-500/50"
                        onKeyDown={(e) => e.key === 'Enter' && handleSmartCalc()}
                      />
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  </div>
                  <Button 
                    size="icon" 
                    className="bg-blue-600 hover:bg-blue-500 text-white"
                    onClick={handleSmartCalc}
                     disabled={isCalculating}
                  >
                    {isCalculating ? <span className="animate-spin">⌛</span> : <Search size={16} />}
                  </Button>
               </div>
            </div>

            {/* RESULTS SECTION */}
            {calcResults.length > 0 && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                     <div className="px-3 py-2 bg-white/5 border-b border-white/10 text-[10px] font-bold text-emerald-400 uppercase flex justify-between items-center rounded-t-lg">
                        <span>Resultados</span>
                        <div className="flex items-center gap-2">
                             <Button size="icon" variant="ghost" className="h-5 w-5 hover:bg-white/10" onClick={prevResult} title="Anterior">
                                 <ChevronLeft size={14} />
                             </Button>
                             <span className="text-white text-xs font-mono">
                                 {currentResultIndex + 1} / {calcResults.length}
                             </span>
                             <Button size="icon" variant="ghost" className="h-5 w-5 hover:bg-white/10" onClick={nextResult} title="Próximo">
                                 <ChevronRight size={14} />
                             </Button>
                        </div>
                     </div>
                     <div className="max-h-[200px] overflow-y-auto custom-scrollbar border border-white/10 rounded-b-lg bg-black/20">
                         {calcResults.map((res, i) => (
                             <button 
                                key={i}
                                className={`w-full text-left px-3 py-3 hover:bg-blue-500/10 text-xs transition-colors group flex flex-col gap-1 border-b border-white/5 last:border-0 ${i === currentResultIndex ? 'bg-blue-500/20 border-l-2 border-l-blue-400' : ''}`}
                                onClick={() => {
                                    setCurrentResultIndex(i);
                                    onSetHighlightedLots(res.lots);
                                    // onOpenChange(false); // Keep open for browsing
                                }}
                             >
                                 <div className="flex justify-between items-center">
                                     <span className="font-bold text-blue-400 group-hover:text-blue-300">
                                         Quadra {res.lots[0].quadra}
                                     </span>
                                     <span className="text-emerald-400 font-bold bg-emerald-400/10 px-1.5 py-0.5 rounded border border-emerald-400/20">
                                         {res.totalArea} m²
                                     </span>
                                 </div>
                                 <div className="text-gray-400 truncate flex items-center gap-1">
                                     <span className="text-[10px] uppercase font-semibold text-gray-600">Lotes:</span>
                                     {res.lots.map(l => l.lote).join(", ")}
                                 </div>
                             </button>
                         ))}
                     </div>
                </div>
            )}
            
            {calcResults.length === 0 && calcArea && !isCalculating && (
                <div className="text-xs text-gray-500 text-center italic py-4">
                    Nenhuma combinação encontrada para {calcArea}m².
                </div>
            )}
            
             {/* CURRENT HIGHLIGHTS (Mini Inspector) */}
             {highlightedLots.length > 0 && (
                 <div className="mt-4 pt-4 border-t border-white/10">
                     <div className="flex justify-between items-center mb-2">
                         <div className="text-[10px] font-bold text-blue-300 uppercase">Seleção Atual</div>
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => onSetHighlightedLots([])}>
                             <X size={14}/>
                         </Button>
                     </div>
                     <div className="flex flex-wrap gap-2">
                         {highlightedLots.map(lot => (
                             <div key={lot.id} className="bg-blue-500/20 text-blue-200 text-xs px-2 py-1 rounded border border-blue-500/30 flex items-center gap-1 cursor-pointer hover:bg-blue-500/40" onClick={() => onSelectLot(lot)}>
                                 <span>Q{lot.quadra}-L{lot.lote}</span>
                             </div>
                         ))}
                     </div>
                     <div className="mt-2 text-right text-xs font-bold text-emerald-400">
                          Total: {highlightedLots.reduce((acc, l) => acc + Number((lotsData.get(l.id)||l.info).area || 0), 0).toFixed(2)} m²
                     </div>
                 </div>
             )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
