import React from "react";
import { Lot, LotInfo } from "@/types";
import { Button } from "@/components/ui/button";
import { X, ArrowRight, ArrowLeft, Info } from "lucide-react";
import { CombinationResult } from "@/lib/adjacency";

interface SmartCalcNavigatorProps {
    searchResults: CombinationResult[];
    highlightedLots: Lot[];
    onSetHighlightedLots: (lots: Lot[]) => void;
    onClose: () => void;
    lotsData: Map<string, LotInfo>;
    isMobile?: boolean; // Mobile detection
}

export function SmartCalcNavigator({
    searchResults,
    highlightedLots,
    onSetHighlightedLots,
    onClose,
    lotsData,
    isMobile = false
}: SmartCalcNavigatorProps) {
    if (highlightedLots.length === 0) return null;

    // Find current index in results
    const currentIndex = searchResults.findIndex(r => 
        r.lots.length === highlightedLots.length && 
        r.lots.every((l, i) => l.id === highlightedLots[i].id)
    );

    const hasResults = searchResults.length > 0 && currentIndex !== -1;
    const currentResult = hasResults ? searchResults[currentIndex] : null;

    const handleNext = () => {
        if (!hasResults) return;
        const nextIndex = (currentIndex + 1) % searchResults.length;
        onSetHighlightedLots(searchResults[nextIndex].lots);
    };

    const handlePrev = () => {
        if (!hasResults) return;
        const prevIndex = (currentIndex - 1 + searchResults.length) % searchResults.length;
        onSetHighlightedLots(searchResults[prevIndex].lots);
    };

    const totalArea = highlightedLots.reduce((acc, l) => acc + Number((lotsData.get(l.id)||l.info).area || 0), 0).toFixed(2);

    // Mobile: position at bottom, Desktop: position at top
    const containerClasses = isMobile
        ? "fixed bottom-4 left-4 right-4 z-[50] animate-in fade-in slide-in-from-bottom"
        : "absolute top-20 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-5";

    return (
        <div className={containerClasses}>
            <div className="bg-zinc-950/90 backdrop-blur-md border border-white/20 text-white p-3 rounded-xl shadow-2xl flex flex-col gap-3 min-w-[300px] max-w-[90vw]">
                {/* Header / Navigation */}
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">Combinação Selecionada</span>
                        {hasResults && (
                            <span className="text-xs text-gray-400">
                                Opção {currentIndex + 1} de {searchResults.length}
                            </span>
                        )}
                    </div>
                    <div className="flex gap-1">
                        {hasResults && (
                            <>
                                <Button size="icon" variant="ghost" className="h-7 w-7 hover:bg-white/10" onClick={handlePrev} title="Anterior">
                                    <ArrowLeft size={14} />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 hover:bg-white/10" onClick={handleNext} title="Próxima">
                                    <ArrowRight size={14} />
                                </Button>
                            </>
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-500/10 ml-2" onClick={onClose} title="Sair do Modo Calculadora">
                            <X size={16} />
                        </Button>
                    </div>
                </div>

                {/* Content: Info for Lots */}
                <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                    {highlightedLots.map(lot => {
                         const info = lotsData.get(lot.id) || lot.info;
                         return (
                            <div key={lot.id} className="bg-white/5 p-2 rounded border border-white/5 flex flex-col gap-1">
                                <div className="text-xs font-bold text-blue-200">Quadra {lot.quadra} - Lote {lot.lote}</div>
                                <div className="text-[10px] text-gray-400 grid grid-cols-1 gap-0.5">
                                    <span>Area: <b className="text-white">{info.area || '-'} m²</b></span>
                                    {info.testada && <span>Testada: <b className="text-white">{info.testada} m</b></span>}
                                    {info.owner && <span>Dono: <b className="text-white truncate">{info.owner}</b></span>}
                                    {info.price && <span>Preço: <b className="text-emerald-400">R$ {info.price}</b></span>}
                                </div>
                            </div>
                         );
                    })}
                </div>

                {/* Footer: Total */}
                <div className="pt-2 border-t border-white/10 flex justify-between items-center">
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                       <Info size={12} />
                       Visualizando {highlightedLots.length} lotes
                    </div>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded text-emerald-400 font-bold text-sm">
                        Total: {totalArea} m²
                    </div>
                </div>
            </div>
        </div>
    );
}
