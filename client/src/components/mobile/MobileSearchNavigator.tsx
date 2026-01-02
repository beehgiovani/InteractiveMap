import React, { useState, useEffect } from "react";
import { Lot, LotInfo } from "@/types";
import { X, ArrowRight, ArrowLeft } from "lucide-react";

interface MobileSearchNavigatorProps {
    highlightedLots: Lot[];
    selectedLot: Lot | null;
    onSelectLot: (lot: Lot, shouldEdit?: boolean) => void;
    onClose: () => void;
    lotsData: Map<string, LotInfo>;
}

export function MobileSearchNavigator({
    highlightedLots,
    selectedLot,
    onSelectLot,
    onClose,
    lotsData,
}: MobileSearchNavigatorProps) {
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);

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
    }, [currentIndex, highlightedLots]);

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

                    {/* Selected Lot Info - Swipeable */}
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
                                
                                {/* Swipe indicator */}
                                <div className="mt-4 text-center">
                                    <span className="text-xs text-gray-500 italic">← Deslize para navegar →</span>
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
