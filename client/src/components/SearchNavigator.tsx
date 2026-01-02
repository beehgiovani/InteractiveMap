import React, { useState } from "react";
import Draggable from "react-draggable";
import { Lot, LotInfo } from "@/types";
import { Button } from "@/components/ui/button";
import { X, ArrowRight, ArrowLeft, Minimize2, Maximize2 } from "lucide-react";

interface SearchNavigatorProps {
    highlightedLots: Lot[];
    selectedLot: Lot | null;
    onSelectLot: (lot: Lot, shouldEdit?: boolean) => void;
    onClose: () => void;
    lotsData: Map<string, LotInfo>;
    isMobile?: boolean; 
}

export function SearchNavigator({
    highlightedLots,
    selectedLot,
    onSelectLot,
    onClose,
    lotsData,
    isMobile = false
}: SearchNavigatorProps) {
    const [isMinimized, setIsMinimized] = useState(false);
    const nodeRef = React.useRef(null);

    if (highlightedLots.length === 0) return null;

    // Determine current index based on selected lot
    const currentIndex = selectedLot 
        ? highlightedLots.findIndex(l => l.id === selectedLot.id)
        : -1;

    const hasSelection = currentIndex !== -1;

    const handleNext = () => {
        const nextIndex = (currentIndex + 1) % highlightedLots.length;
        onSelectLot(highlightedLots[nextIndex]);
    };

    const handlePrev = () => {
        const prevIndex = (currentIndex - 1 + highlightedLots.length) % highlightedLots.length;
        onSelectLot(highlightedLots[prevIndex]);
    };

    // Mobile: Fixed at bottom (not draggable)
    if (isMobile) {
        return (
            <div className="fixed bottom-4 left-4 right-4 z-[45] animate-in fade-in slide-in-from-bottom">
                <div className="bg-zinc-950/90 backdrop-blur-md border border-white/20 text-white p-4 rounded-xl shadow-2xl flex flex-col gap-3">
                    {/* Header */}
                    <div className="flex justify-between items-center border-b border-white/10 pb-2">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">
                                Resultados da Busca
                            </span>
                            <span className="text-xs text-gray-400">
                                {highlightedLots.length} lotes encontrados
                            </span>
                        </div>
                        
                        <div className="flex items-center gap-1">
                             <span className="text-xs font-mono text-gray-500 mr-2">
                                {hasSelection ? `${currentIndex + 1}/${highlightedLots.length}` : "-"}
                             </span>
                             <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-white/10 rounded-full" onClick={handlePrev} title="Anterior">
                                <ArrowLeft size={16} />
                             </Button>
                             <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-white/10 rounded-full" onClick={handleNext} title="Próximo">
                                <ArrowRight size={16} />
                             </Button>
                            <div className="w-px h-4 bg-white/10 mx-1" />
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-full" onClick={onClose} title="Fechar">
                                <X size={16} />
                            </Button>
                        </div>
                    </div>

                    {/* Selected Lot Info */}
                    {selectedLot && (
                        <div className="bg-white/5 p-3 rounded-lg border border-white/5 flex justify-between items-center animate-in fade-in">
                            <div>
                                 <div className="text-sm font-bold text-white">
                                    Quadra {selectedLot.quadra} - Lote {selectedLot.lote}
                                 </div>
                                 <div className="text-[10px] text-gray-400 uppercase mt-0.5">
                                    {(() => {
                                        const info = lotsData.get(selectedLot.id) || selectedLot.info;
                                        return info?.owner || "Sem proprietário";
                                    })()}
                                 </div>
                            </div>
                            <div className="text-right">
                                 {(() => {
                                     const info = lotsData.get(selectedLot.id) || selectedLot.info;
                                     return (
                                         <>
                                            <div className="text-xs font-bold text-emerald-400">
                                                {info?.price ? `R$ ${info.price}` : ""}
                                            </div>
                                            <div className="text-[10px] text-blue-300">
                                                {info?.area ? `${info.area} m²` : ""}
                                            </div>
                                         </>
                                     )
                                 })()}
                            </div>
                        </div>
                    )}
                    
                    {!selectedLot && (
                         <div className="text-center py-2 text-xs text-gray-500 italic">
                            Use as setas para navegar nos resultados
                         </div>
                    )}
                </div>
            </div>
        );
    }

    // Desktop: Draggable with minimize
    return (
        <Draggable nodeRef={nodeRef} handle=".drag-handle">
            <div 
                ref={nodeRef} 
                className={`fixed bottom-6 right-6 z-40 bg-zinc-950/90 backdrop-blur-md border border-white/20 text-white rounded-xl shadow-2xl transition-all duration-300 ${
                    isMinimized ? 'w-auto' : 'w-[400px]'
                }`}
            >
                {/* Header - Drag Handle */}
                <div className="drag-handle cursor-move bg-gradient-to-r from-white/10 to-transparent p-3 flex items-center justify-between border-b border-white/5 group relative overflow-hidden">
                    <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    
                    {!isMinimized && (
                        <div className="flex flex-col relative z-10">
                            <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">
                                Resultados da Busca
                            </span>
                            <span className="text-xs text-gray-400">
                                {highlightedLots.length} lotes encontrados
                            </span>
                        </div>
                    )}
                    
                    <div className="flex items-center gap-1 relative z-10">
                        {!isMinimized && (
                            <span className="text-xs font-mono text-gray-500 mr-2">
                                {hasSelection ? `${currentIndex + 1}/${highlightedLots.length}` : "-"}
                            </span>
                        )}
                        <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-7 w-7 hover:bg-white/10 rounded-full" 
                            onClick={handlePrev} 
                            title="Anterior"
                        >
                            <ArrowLeft size={14} />
                        </Button>
                        <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-7 w-7 hover:bg-white/10 rounded-full" 
                            onClick={handleNext} 
                            title="Próximo"
                        >
                            <ArrowRight size={14} />
                        </Button>
                        <div className="w-px h-4 bg-white/10 mx-1" />
                        <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-7 w-7 hover:bg-white/10 rounded-full" 
                            onClick={() => setIsMinimized(!isMinimized)} 
                            title={isMinimized ? "Expandir" : "Minimizar"}
                        >
                            {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
                        </Button>
                        <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-7 w-7 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-full" 
                            onClick={onClose} 
                            title="Fechar"
                        >
                            <X size={14} />
                        </Button>
                    </div>
                </div>

                {/* Content - Only show when not minimized */}
                {!isMinimized && (
                    <div className="p-4">
                        {selectedLot ? (
                            <div className="bg-white/5 p-3 rounded-lg border border-white/5 flex justify-between items-center animate-in fade-in">
                                <div>
                                     <div className="text-sm font-bold text-white">
                                        Quadra {selectedLot.quadra} - Lote {selectedLot.lote}
                                     </div>
                                     <div className="text-[10px] text-gray-400 uppercase mt-0.5">
                                        {(() => {
                                            const info = lotsData.get(selectedLot.id) || selectedLot.info;
                                            return info?.owner || "Sem proprietário";
                                        })()}
                                     </div>
                                </div>
                                <div className="text-right">
                                     {(() => {
                                         const info = lotsData.get(selectedLot.id) || selectedLot.info;
                                         return (
                                             <>
                                                <div className="text-xs font-bold text-emerald-400">
                                                    {info?.price ? `R$ ${info.price}` : ""}
                                                </div>
                                                <div className="text-[10px] text-blue-300">
                                                    {info?.area ? `${info.area} m²` : ""}
                                                </div>
                                             </>
                                         )
                                     })()}
                                </div>
                            </div>
                        ) : (
                             <div className="text-center py-2 text-xs text-gray-500 italic">
                                Use as setas para navegar nos resultados
                             </div>
                        )}
                    </div>
                )}
            </div>
        </Draggable>
    );
}
