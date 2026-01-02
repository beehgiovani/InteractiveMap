import React, { useState, useEffect } from "react";
import { Lot } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, ArrowRightCircle, Target } from "lucide-react";

interface SmartSearchModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    manualLots: Lot[];
    onSelectLot: (lot: Lot) => void;
}

export function SmartSearchModal({ isOpen, onOpenChange, manualLots, onSelectLot }: SmartSearchModalProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState<Lot[]>([]);

    useEffect(() => {
        if (!isOpen) {
            setSearchTerm("");
            setSearchResults([]);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!searchTerm.trim()) {
            setSearchResults([]);
            return;
        }
        const terms = searchTerm.toLowerCase().split(' ').filter(t => t.length > 0);
        
        const results = manualLots.filter(l => {
            const searchable = `quadra ${l.quadra} lote ${l.lote} q${l.quadra} l${l.lote} ${l.quadra} ${l.lote}`;
            return terms.every(term => searchable.includes(term));
        });

        // Limit to 20 for perf and since it's a modal
        setSearchResults(results.slice(0, 20)); // Limit to 20
    }, [searchTerm, manualLots]);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="bg-zinc-900/90 backdrop-blur-xl border-white/10 text-white sm:max-w-[550px] p-0 gap-0 overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-white/10">
                <DialogHeader className="p-6 border-b border-white/5 bg-gradient-to-r from-blue-600/10 to-transparent">
                    <DialogTitle className="flex items-center gap-3 text-2xl font-light tracking-wide text-white/90">
                        <div className="p-2 rounded-full bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30">
                            <Search size={20} />
                        </div>
                        Busca Rápida
                    </DialogTitle>
                </DialogHeader>

                <div className="p-6 bg-white/5 space-y-4">
                   <div className="relative group">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                            <Search className="text-white/30 group-focus-within:text-blue-400 transition-colors" size={20} />
                        </div>
                        <Input 
                            autoFocus
                            placeholder="Digite Quadra e Lote (ex: Q12 L05)..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-12 h-14 bg-black/40 border-white/10 text-white placeholder:text-white/20 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 focus:bg-black/60 text-lg rounded-xl transition-all shadow-inner"
                        />
                        {searchTerm && (
                            <div className="absolute inset-y-0 right-4 flex items-center">
                                <span className="text-xs text-white/30 font-mono">ESC para fechar</span>
                            </div>
                        )}
                   </div>
                </div>

                <div className="max-h-[400px] overflow-y-auto custom-scrollbar bg-black/20">
                     {searchResults.length === 0 && searchTerm ? (
                         <div className="p-12 text-center text-white/30 italic flex flex-col items-center gap-3">
                             <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                                <Search size={24} className="opacity-50" />
                             </div>
                             <p>Nenhum resultado para "<span className="text-white/50">{searchTerm}</span>"</p>
                         </div>
                     ) : searchResults.length === 0 && !searchTerm ? (
                        <div className="p-16 text-center text-white/20 flex flex-col items-center gap-4">
                             <Target size={48} className="opacity-10 animate-pulse" />
                             <div className="space-y-1">
                                <p className="text-sm font-medium text-white/40">Comece digitando para buscar</p>
                                <p className="text-xs">Exemplos: "Q10", "Lote 5", "12 15"</p>
                             </div>
                        </div>
                     ) : (
                         <div className="p-2 grid gap-2">
                             {searchResults.map((lot, index) => (
                                 <button
                                     key={lot.id}
                                     onClick={() => {
                                         onSelectLot(lot);
                                         onOpenChange(false);
                                     }}
                                     className="w-full text-left p-4 rounded-lg bg-white/5 hover:bg-blue-600/20 border border-transparent hover:border-blue-500/30 transition-all group flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-300"
                                     style={{ animationDelay: `${index * 30}ms` }}
                                 >
                                     <div className="flex flex-col gap-1">
                                         <div className="flex items-baseline gap-2">
                                            <span className="text-sm font-medium text-white/40 uppercase tracking-wider">Lote</span>
                                            <span className="text-xl font-bold text-white group-hover:text-blue-200">{lot.lote}</span>
                                         </div>
                                         <div className="flex items-center gap-2 text-white/50 text-xs">
                                            <span className="bg-white/10 px-1.5 py-0.5 rounded text-white/60">Q{lot.quadra}</span>
                                            <span>Quadra {lot.quadra}</span>
                                         </div>
                                     </div>
                                      <div className="w-10 h-10 rounded-full bg-white/5 group-hover:bg-blue-500/20 flex items-center justify-center transition-colors">
                                         <ArrowRightCircle size={20} className="text-white/20 group-hover:text-blue-400 transition-colors" />
                                      </div>
                                 </button>
                             ))}
                         </div>
                     )}
                </div>
                
                <div className="p-3 bg-black/40 border-t border-white/5 text-[10px] text-white/30 flex justify-between px-6 uppercase tracking-widest font-medium">
                    <span>Sistema de Busca</span>
                    <span>{searchResults.length} Resultados</span>
                </div>
            </DialogContent>
        </Dialog>
    );
}
