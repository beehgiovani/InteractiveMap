import React, { useState, useEffect } from "react";
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
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const nodeRef = React.useRef(null);

    // Minimum swipe distance (in px)
    const minSwipeDistance = 50;

    // Haptic feedback helper
    const vibrate = (pattern: number | number[] = 10) => {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    };

    if (highlightedLots.length === 0) return null;

    // Determine current index based on selected lot
    const currentIndex = selectedLot 
        ? highlightedLots.findIndex(l => l.id === selectedLot.id)
        : -1;

    const hasSelection = currentIndex !== -1;

    const handleNext = () => {
        vibrate(10); // Light haptic feedback
        const nextIndex = (currentIndex + 1) % highlightedLots.length;
        onSelectLot(highlightedLots[nextIndex]);
    };

    const handlePrev = () => {
        vibrate(10); // Light haptic feedback
        const prevIndex = (currentIndex - 1 + highlightedLots.length) % highlightedLots.length;
        onSelectLot(highlightedLots[prevIndex]);
    };

    // Touch handlers for swipe gestures
    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe) {
            handleNext(); // Swipe left = next
        } else if (isRightSwipe) {
            handlePrev(); // Swipe right = previous
        }
    };

    // Keyboard navigation for accessibility
    useEffect(() => {
        if (!isMobile) return; // Only on mobile
        
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                handlePrev();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                handleNext();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex, highlightedLots, isMobile]);

    // Mobile: Bottom sheet with swipe-to-dismiss
    if (isMobile) {
        return (
            <>
                {/* Backdrop with tap to close */}
                <div 
                    className="fixed inset-0 bg-black/40 z-[45] animate-in fade-in"
                    onClick={onClose}
                />
                
                {/* Bottom Sheet */}
                <div className="fixed bottom-0 left-0 right-0 z-[46] animate-in slide-in-from-bottom duration-300">
                    {/* Drag Handle */}
                    <div className="bg-zinc-950/95 backdrop-blur-xl rounded-t-3xl pt-3 pb-2 flex justify-center border-t-4 border-blue-500/30">
                        <div className="w-12 h-1.5 bg-white/30 rounded-full" />
                    </div>
                    
                    <div className="bg-zinc-950/95 backdrop-blur-xl text-white pb-safe">
                        {/* Header - Larger touch targets */}
                        <div className="px-6 pb-4 border-b border-white/10">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex flex-col">
                                    <span className="text-xs uppercase font-bold text-blue-400 tracking-wider">
                                        Resultados da Busca
                                    </span>
                                    <span className="text-sm text-gray-400 mt-1">
                                        {highlightedLots.length} lotes encontrados
                                    </span>
                                </div>
                                
                                {/* Close button - 48px touch target */}
                                <button 
                                    onClick={onClose}
                                    className="h-12 w-12 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 active:bg-white/20 transition-colors"
                                    aria-label="Fechar"
                                >
                                    <X size={20} className="text-gray-400" />
                                </button>
                            </div>
                            
                            {/* Navigation - Large touch-friendly buttons */}
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handlePrev}
                                    className="flex-1 h-14 flex items-center justify-center gap-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 active:bg-blue-600/40 border border-blue-500/30 transition-colors"
                                    aria-label="Anterior"
                                >
                                    <ArrowLeft size={20} className="text-blue-400" />
                                    <span className="text-sm font-bold text-blue-300">Anterior</span>
                                </button>
                                
                                <div className="px-4 py-2 bg-white/5 rounded-lg">
                                    <span className="text-lg font-mono font-bold text-white">
                                        {hasSelection ? `${currentIndex + 1}/${highlightedLots.length}` : "-"}
                                    </span>
                                </div>
                                
                                <button
                                    onClick={handleNext}
                                    className="flex-1 h-14 flex items-center justify-center gap-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 active:bg-blue-600/40 border border-blue-500/30 transition-colors"
                                    aria-label="Próximo"
                                >
                                    <span className="text-sm font-bold text-blue-300">Próximo</span>
                                    <ArrowRight size={20} className="text-blue-400" />
                                </button>
                            </div>
                        </div>

                        {/* Selected Lot Info - Larger, more readable */}
                        <div 
                            className="px-6 py-4"
                            onTouchStart={onTouchStart}
                            onTouchMove={onTouchMove}
                            onTouchEnd={onTouchEnd}
                        >
                            {selectedLot ? (
                                <div className="bg-gradient-to-br from-white/10 to-white/5 p-5 rounded-2xl border border-white/10 animate-in fade-in">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <div className="text-lg font-bold text-white mb-1">
                                                Quadra {selectedLot.quadra} - Lote {selectedLot.lote}
                                            </div>
                                            <div className="text-sm text-gray-400 uppercase">
                                                {(() => {
                                                    const info = lotsData.get(selectedLot.id) || selectedLot.info;
                                                    return info?.owner || "Sem proprietário";
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-3 mt-4">
                                        {(() => {
                                            const info = lotsData.get(selectedLot.id) || selectedLot.info;
                                            return (
                                                <>
                                                    {info?.price && (
                                                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                                                            <div className="text-xs text-emerald-400 uppercase font-bold mb-1">Preço</div>
                                                            <div className="text-base font-bold text-emerald-300">R$ {info.price}</div>
                                                        </div>
                                                    )}
                                                    {info?.area && (
                                                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                                                            <div className="text-xs text-blue-400 uppercase font-bold mb-1">Área</div>
                                                            <div className="text-base font-bold text-blue-300">{info.area} m²</div>
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-sm text-gray-500 italic">
                                    Use as setas para navegar nos resultados
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </>
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
