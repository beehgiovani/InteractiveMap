import React, { useState } from "react";
import { Plus, Search, Calculator, Upload, X } from "lucide-react";

interface MobileQuickActionsProps {
    onSearch: () => void;
    onSmartCalc: () => void;
    onExport: () => void;
    onAddLot?: () => void;
}

export function MobileQuickActions({ 
    onSearch, 
    onSmartCalc, 
    onExport,
    onAddLot 
}: MobileQuickActionsProps) {
    const [isOpen, setIsOpen] = useState(false);

    const vibrate = (pattern: number | number[] = 10) => {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    };

    const handleAction = (action: () => void) => {
        vibrate(15);
        action();
        setIsOpen(false);
    };

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/40 z-[60] animate-in fade-in"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Action Menu */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 z-[61] flex flex-col gap-3 animate-in slide-in-from-bottom-4">
                    <button
                        onClick={() => handleAction(onSearch)}
                        className="h-14 px-6 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-full shadow-lg flex items-center gap-3 font-medium transition-all"
                    >
                        <Search size={20} />
                        Buscar
                    </button>
                    
                    <button
                        onClick={() => handleAction(onSmartCalc)}
                        className="h-14 px-6 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white rounded-full shadow-lg flex items-center gap-3 font-medium transition-all"
                    >
                        <Calculator size={20} />
                        Calculadora
                    </button>
                    
                    <button
                        onClick={() => handleAction(onExport)}
                        className="h-14 px-6 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded-full shadow-lg flex items-center gap-3 font-medium transition-all"
                    >
                        <Upload size={20} />
                        Exportar
                    </button>
                </div>
            )}

            {/* FAB */}
            <button
                onClick={() => {
                    vibrate(10);
                    setIsOpen(!isOpen);
                }}
                className={`fixed bottom-6 right-6 z-[62] h-16 w-16 rounded-full shadow-2xl flex items-center justify-center transition-all ${
                    isOpen 
                        ? 'bg-red-600 hover:bg-red-700 active:bg-red-800 rotate-45' 
                        : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                }`}
                aria-label={isOpen ? "Fechar" : "Ações rápidas"}
            >
                {isOpen ? <X size={28} className="text-white" /> : <Plus size={28} className="text-white" />}
            </button>
        </>
    );
}
