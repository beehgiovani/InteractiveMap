import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Search, Calculator, Boxes, Wrench, X } from "lucide-react";
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuLabel, 
    DropdownMenuSeparator, 
    DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

interface SmartToolsProps {
    onOpenSearch: () => void;
    onOpenSmartCalc: () => void;
}

export function SmartTools({ onOpenSearch, onOpenSmartCalc }: SmartToolsProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="absolute top-4 left-4 z-50 flex flex-col gap-2">
            <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
                <DropdownMenuTrigger asChild>
                    <Button 
                        size="lg" 
                        className="h-12 px-4 shadow-2xl bg-zinc-950/90 hover:bg-zinc-900 border border-blue-500/30 text-blue-400 font-bold tracking-wider backdrop-blur-md transition-all hover:scale-105 active:scale-95 rounded-xl flex items-center gap-2 group"
                    >
                        {isOpen ? <X className="text-red-400" /> : <Wrench className="group-hover:rotate-12 transition-transform" />}
                        <span className="hidden sm:inline">FERRAMENTAS</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64 bg-zinc-950/95 border-blue-500/20 text-white backdrop-blur-xl shadow-[0_0_50px_-12px_rgba(59,130,246,0.3)] ml-2 mt-2 rounded-xl p-2 animate-in fade-in slide-in-from-left-2 zoom-in-95 duration-200">
                    <DropdownMenuLabel className="text-xs uppercase font-bold text-gray-500 tracking-widest px-2 py-1.5 mb-1">
                        Ferramentas Inteligentes
                    </DropdownMenuLabel>
                    
                    <DropdownMenuItem 
                        className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-blue-600/10 focus:bg-blue-600/10 transition-colors group"
                        onClick={onOpenSearch}
                    >
                        <div className="bg-blue-500/10 p-2 rounded-md group-hover:bg-blue-500/20 transition-colors">
                             <Search size={18} className="text-blue-400" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-sm text-gray-200">Busca Rápida</span>
                            <span className="text-[10px] text-gray-400">Encontre lotes e quadras</span>
                        </div>
                    </DropdownMenuItem>

                    <DropdownMenuItem 
                        className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-emerald-600/10 focus:bg-emerald-600/10 transition-colors group mt-1"
                        onClick={onOpenSmartCalc}
                    >
                        <div className="bg-emerald-500/10 p-2 rounded-md group-hover:bg-emerald-500/20 transition-colors">
                             <Calculator size={18} className="text-emerald-400" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-sm text-gray-200">Calculadora Smart</span>
                            <span className="text-[10px] text-gray-400">Combinação de áreas</span>
                        </div>
                    </DropdownMenuItem>

                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
