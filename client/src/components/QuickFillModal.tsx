import React, { useState, useMemo } from 'react';
import { Lot, LotInfo } from '@/types';
import { X, Search, CheckCircle, AlertCircle, Save, Filter, MapPin } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';

import { toast } from 'sonner';

interface QuickFillModalProps {
    isOpen: boolean;
    onClose: () => void;
    lotsData: Map<string, LotInfo>;
    manualLots: Lot[];
    onSaveLot: (lotId: string, updates: Partial<LotInfo>) => Promise<void>;
}

// Helper to determine if a lot is "complete" for the purpose of this tool
const isLotComplete = (info: LotInfo) => {
    return (
        info.zona && info.zona.length > 0 &&
        info.setor && info.setor.length > 0 &&
        info.loteGeo && info.loteGeo.length > 0 &&
        info.area && info.area > 0
    );
};

export default function QuickFillModal({ isOpen, onClose, lotsData = new Map(), manualLots = [], onSaveLot }: QuickFillModalProps) {
    const [selectedQuadra, setSelectedQuadra] = useState<string | null>(null);
    const [filterText, setFilterText] = useState("");
    const [editingLotId, setEditingLotId] = useState<string | null>(null);
    
    // Temporary state for the lot being edited
    const [editForm, setEditForm] = useState({
        zona: '',
        setor: '',
        loteGeo: '',
        area: '',
        isDirty: false
    });

    // 1. Group Lots by Quadra & Calculate Status
    const quadraStats = useMemo(() => {
        console.log("QuickFillModal: Recalculating Stats. Lots:", manualLots.length, "LotsMap Size:", lotsData.size);
        const stats = new Map<string, { total: number, complete: number }>();
        
        manualLots.forEach(lot => {
            const info = lotsData.get(lot.id) || lot.info;
            const q = lot.quadra;
            
            if (!stats.has(q)) {
                stats.set(q, { total: 0, complete: 0 });
            }
            
            const s = stats.get(q)!;
            s.total++;
            if (isLotComplete(info)) {
                s.complete++;
            }
        });
        
        // Convert to array and sort
        return Array.from(stats.entries())
            .map(([quadra, { total, complete }]) => ({
                quadra,
                total,
                complete,
                isFullyComplete: total > 0 && total === complete,
                percentage: total > 0 ? Math.round((complete / total) * 100) : 0
            }))
            .sort((a, b) => { // Sort numerically if possible
                 const nA = parseInt(a.quadra.replace(/\D/g, '')) || 0;
                 const nB = parseInt(b.quadra.replace(/\D/g, '')) || 0;
                 return nA - nB || a.quadra.localeCompare(b.quadra);
            });

    }, [manualLots, lotsData]);

    // 2. Filter Quadras
    const filteredQuadras = quadraStats.filter(q => 
        q.quadra.toLowerCase().includes(filterText.toLowerCase())
    );

    // 3. Get Lots for Selected Quadra
    const currentQuadraLots = useMemo(() => {
        if (!selectedQuadra) return [];
        return manualLots
            .filter(l => l.quadra === selectedQuadra)
            .sort((a, b) => {
                const nA = parseInt(a.lote.replace(/\D/g, '')) || 0;
                const nB = parseInt(b.lote.replace(/\D/g, '')) || 0;
                return nA - nB;
            });
    }, [selectedQuadra, manualLots]);

    // Handlers
    const startEditing = (lot: Lot) => {
        const info = lotsData.get(lot.id) || lot.info;
        setEditingLotId(lot.id);
        setEditForm({
            zona: info.zona || '',
            setor: info.setor || '',
            loteGeo: info.loteGeo || '',
            area: info.area ? String(info.area).replace('.', ',') : '',
            isDirty: false
        });
    };

    const handleSave = async (lotId: string) => {
        if (!editForm.isDirty) {
            setEditingLotId(null);
            return;
        }

        try {
            // Parse area (PT-BR format to float)
            const areaFloat = parseFloat(editForm.area.replace(/\./g, '').replace(',', '.')) || 0;
            
            await onSaveLot(lotId, {
                zona: editForm.zona,
                setor: editForm.setor,
                loteGeo: editForm.loteGeo,
                area: areaFloat
            });
            
            toast.success("Dados salvos!");
            setEditingLotId(null);
        } catch (e) {
            console.error(e);
            toast.error("Erro ao salvar.");
        }
    };
    
    const handleKeyDown = (e: React.KeyboardEvent, lotId: string) => {
        if (e.key === 'Enter') {
            handleSave(lotId);
        }
        if (e.key === 'Escape') {
            setEditingLotId(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col lg:flex-row overflow-hidden animate-in zoom-in-95 duration-200 text-white">
                
                {/* SIDEBAR: Quadra List */}
                <div className={`w-full lg:w-1/3 min-w-[300px] border-b lg:border-b-0 lg:border-r border-white/10 bg-white/5 flex flex-col ${selectedQuadra ? 'h-[150px] lg:h-auto' : 'h-full'}`}>
                    <div className="p-4 border-b border-white/10 bg-transparent flex justify-between items-center gap-2">
                         <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <Input 
                                placeholder="Filtrar Quadras..." 
                                value={filterText}
                                onChange={e => setFilterText(e.target.value)}
                                className="pl-9 bg-black/40 border-white/10 text-white focus:bg-black/60 transition-all placeholder:text-gray-500 w-full"
                            />
                        </div>
                        {/* Mobile: Collapse Button if needed, or just rely on selection */}
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-2 lg:p-4 custom-scrollbar">
                        <div className="space-y-1">
                            {filteredQuadras.map(stat => (
                                <button
                                    key={stat.quadra}
                                    onClick={() => setSelectedQuadra(stat.quadra)}
                                    className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between transition-all border ${
                                        selectedQuadra === stat.quadra 
                                            ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/20' 
                                            : 'hover:bg-white/10 border-transparent text-gray-300'
                                    }`}
                                >
                                    <div>
                                        <div className="font-bold text-sm">Quadra {stat.quadra}</div>
                                        <div className={`text-[10px] uppercase font-bold tracking-wider mt-0.5 ${selectedQuadra === stat.quadra ? 'text-blue-200' : 'text-gray-500'}`}>
                                            {stat.complete} / {stat.total} Preenchidos
                                        </div>
                                    </div>
                                    
                                    {stat.isFullyComplete ? (
                                        <div className={`p-1 rounded-full ${selectedQuadra === stat.quadra ? 'bg-white/20' : 'bg-green-500/20'}`}>
                                            <CheckCircle size={18} className={selectedQuadra === stat.quadra ? 'text-white' : 'text-green-500'} />
                                        </div>
                                    ) : (
                                        <div className={`p-1 rounded-full ${selectedQuadra === stat.quadra ? 'bg-white/20' : 'bg-yellow-500/20'}`}>
                                            <AlertCircle size={18} className={selectedQuadra === stat.quadra ? 'text-white' : 'text-yellow-500'} />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* MAIN: Lot List */}
                <div className="flex-1 bg-transparent flex flex-col min-w-0 h-full">
                    {/* Header */}
                    <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5 sticky top-0 z-20 backdrop-blur-md">
                        <div>
                             {selectedQuadra ? (
                                <>
                                    <h2 className="text-xl font-black text-white flex items-center gap-2">
                                        <MapPin className="text-blue-500" size={24}/>
                                        Quadra {selectedQuadra}
                                    </h2>
                                    <p className="hidden md:block text-xs text-gray-400 mt-1">Clique em uma linha para editar. Enter para salvar.</p>
                                    <p className="block md:hidden text-xs text-gray-400 mt-1">Toque para editar.</p>
                                </>
                             ) : (
                                <h2 className="text-xl font-bold text-gray-600">Nenhuma quadra selecionada</h2>
                             )}
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white">
                            <X size={24} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-hidden flex flex-col relative">
                        {!selectedQuadra ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-600 p-8 text-center">
                                <Filter size={48} className="mb-4 opacity-20" />
                                <p>Selecione uma quadra {window.innerWidth < 1024 ? 'acima' : 'à esquerda'} para começar.</p>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-auto bg-transparent custom-scrollbar">
                                
                                {/* DESKTOP: TABLE VIEW */}
                                <div className="hidden md:block min-w-full inline-block align-middle">
                                    <div className="border-b border-white/10">
                                        <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-black/40 text-xs font-bold text-gray-400 uppercase tracking-wider sticky top-0 z-10 border-b border-white/10 backdrop-blur-sm">
                                            <div className="col-span-1">Status</div>
                                            <div className="col-span-1">Lote</div>
                                            <div className="col-span-2">Zona</div>
                                            <div className="col-span-2">Setor</div>
                                            <div className="col-span-3">Lote Geo (Fiscal)</div>
                                            <div className="col-span-2">Área (m²)</div>
                                            <div className="col-span-1 text-right">Ação</div>
                                        </div>
                                        
                                        <div className="divide-y divide-white/5 bg-transparent">
                                            {currentQuadraLots.map(lot => {
                                                const info = lotsData.get(lot.id) || lot.info;
                                                const isComplete = isLotComplete(info);
                                                const isEditing = editingLotId === lot.id;

                                                return (
                                                    <div 
                                                        key={lot.id} 
                                                        className={`grid grid-cols-12 gap-4 px-6 py-3 items-center hover:bg-white/5 transition-colors text-sm group ${isEditing ? 'bg-blue-500/10 ring-1 ring-inset ring-blue-500/30' : ''}`}
                                                        onClick={() => !isEditing && startEditing(lot)}
                                                    >
                                                        {/* Status */}
                                                        <div className="col-span-1 flex items-center">
                                                            {isComplete ? (
                                                                <CheckCircle size={16} className="text-green-500" />
                                                            ) : (
                                                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-500 text-[10px] font-bold border border-yellow-500/30">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
                                                                    Faltam
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Lote */}
                                                        <div className="col-span-1 font-bold text-white">
                                                            {lot.lote}
                                                        </div>

                                                        {isEditing ? (
                                                            <>
                                                                <div className="col-span-2">
                                                                    <Input 
                                                                        autoFocus
                                                                        value={editForm.zona}
                                                                        onChange={e => setEditForm({...editForm, zona: e.target.value, isDirty: true})}
                                                                        className="h-8 text-xs font-mono bg-black/50 border-white/20 text-white"
                                                                        placeholder="Zona"
                                                                        onKeyDown={(e) => handleKeyDown(e, lot.id)}
                                                                    />
                                                                </div>
                                                                <div className="col-span-2">
                                                                    <Input 
                                                                        value={editForm.setor}
                                                                        onChange={e => setEditForm({...editForm, setor: e.target.value, isDirty: true})}
                                                                        className="h-8 text-xs font-mono bg-black/50 border-white/20 text-white"
                                                                        placeholder="Setor"
                                                                        onKeyDown={(e) => handleKeyDown(e, lot.id)}
                                                                    />
                                                                </div>
                                                                <div className="col-span-3">
                                                                    <Input 
                                                                        value={editForm.loteGeo}
                                                                        onChange={e => setEditForm({...editForm, loteGeo: e.target.value, isDirty: true})}
                                                                        className="h-8 text-xs font-mono bg-black/50 border-white/20 text-white"
                                                                        placeholder="Lote Geo"
                                                                        onKeyDown={(e) => handleKeyDown(e, lot.id)}
                                                                    />
                                                                </div>
                                                                <div className="col-span-2">
                                                                    <Input 
                                                                        value={editForm.area}
                                                                        onChange={e => setEditForm({...editForm, area: e.target.value, isDirty: true})}
                                                                        className="h-8 text-xs font-mono text-right bg-black/50 border-white/20 text-white"
                                                                        placeholder="0,00"
                                                                        onKeyDown={(e) => handleKeyDown(e, lot.id)}
                                                                    />
                                                                </div>
                                                                <div className="col-span-1 text-right">
                                                                    <Button 
                                                                        size="icon" 
                                                                        className="h-8 w-8 bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-900/20"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleSave(lot.id);
                                                                        }}
                                                                    >
                                                                        <Save size={14} />
                                                                    </Button>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div className="col-span-2 font-mono text-gray-400">{info.zona || '-'}</div>
                                                                <div className="col-span-2 font-mono text-gray-400">{info.setor || '-'}</div>
                                                                <div className="col-span-3 font-mono text-gray-400">{info.loteGeo || '-'}</div>
                                                                <div className="col-span-2 font-mono text-gray-300">
                                                                    {info.area ? info.area.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '-'}
                                                                </div>
                                                                <div className="col-span-1 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <span className="text-[10px] text-blue-400 font-bold uppercase cursor-pointer hover:text-blue-300">Editar</span>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* MOBILE: CARD VIEW */}
                                <div className="block md:hidden p-4 space-y-3 pb-20">
                                    {currentQuadraLots.map(lot => {
                                        const info = lotsData.get(lot.id) || lot.info;
                                        const isComplete = isLotComplete(info);
                                        const isEditing = editingLotId === lot.id;

                                        return (
                                            <div 
                                                key={lot.id}
                                                className={`bg-white/5 border border-white/10 rounded-xl overflow-hidden active:scale-[0.98] transition-all ${isEditing ? 'ring-2 ring-blue-500 bg-blue-500/5' : ''}`}
                                                onClick={() => !isEditing && startEditing(lot)}
                                            >
                                                {/* Card Header */}
                                                <div className="p-3 border-b border-white/5 flex justify-between items-center bg-black/20">
                                                    <div className="flex items-center gap-2">
                                                        <div className="font-black text-lg text-white">Lote {lot.lote}</div>
                                                        {isComplete ? (
                                                            <CheckCircle size={16} className="text-green-500" />
                                                        ) : (
                                                            <AlertCircle size={16} className="text-yellow-500" />
                                                        )}
                                                    </div>
                                                    {!isEditing && <div className="text-xs text-blue-400 font-bold">Toque para Editar</div>}
                                                </div>

                                                {/* Card Body */}
                                                <div className="p-3">
                                                    {isEditing ? (
                                                        <div className="flex flex-col gap-3">
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div>
                                                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Zona</label>
                                                                    <Input 
                                                                        autoFocus
                                                                        value={editForm.zona}
                                                                        onChange={e => setEditForm({...editForm, zona: e.target.value, isDirty: true})}
                                                                        className="h-9 bg-black/50 border-white/20 text-white"
                                                                        placeholder="Zona"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Setor</label>
                                                                    <Input 
                                                                        value={editForm.setor}
                                                                        onChange={e => setEditForm({...editForm, setor: e.target.value, isDirty: true})}
                                                                        className="h-9 bg-black/50 border-white/20 text-white"
                                                                        placeholder="Setor"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-bold text-gray-500 uppercase">Lote Fiscal (Geo)</label>
                                                                <Input 
                                                                    value={editForm.loteGeo}
                                                                    onChange={e => setEditForm({...editForm, loteGeo: e.target.value, isDirty: true})}
                                                                    className="h-9 bg-black/50 border-white/20 text-white"
                                                                    placeholder="000.000.0000-0"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-bold text-gray-500 uppercase">Área (m²)</label>
                                                                <Input 
                                                                    value={editForm.area}
                                                                    onChange={e => setEditForm({...editForm, area: e.target.value, isDirty: true})}
                                                                    className="h-9 bg-black/50 border-white/20 text-white"
                                                                    inputMode="decimal"
                                                                    placeholder="0,00"
                                                                />
                                                            </div>
                                                            <div className="flex gap-2 pt-2">
                                                                <Button 
                                                                    variant="outline"
                                                                    className="flex-1 border-white/10 hover:bg-white/10 text-gray-300"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setEditingLotId(null);
                                                                    }}
                                                                >
                                                                    Cancelar
                                                                </Button>
                                                                <Button 
                                                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleSave(lot.id);
                                                                    }}
                                                                >
                                                                    <Save size={16} className="mr-2" /> Salvar
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="grid grid-cols-2 gap-y-2 text-sm">
                                                            <div>
                                                                <span className="text-gray-500 text-xs block">Zona</span>
                                                                <span className="font-mono text-gray-300">{info.zona || '-'}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-500 text-xs block">Setor</span>
                                                                <span className="font-mono text-gray-300">{info.setor || '-'}</span>
                                                            </div>
                                                            <div className="col-span-2">
                                                                <span className="text-gray-500 text-xs block">Lote Fiscal</span>
                                                                <span className="font-mono text-gray-300">{info.loteGeo || '-'}</span>
                                                            </div>
                                                            <div className="col-span-2 border-t border-white/5 pt-2 mt-1">
                                                                <span className="text-gray-500 text-xs block">Área Total</span>
                                                                <span className="font-mono font-bold text-lg text-white">
                                                                    {info.area ? info.area.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '-'} <span className="text-xs font-normal text-gray-500">m²</span>
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
