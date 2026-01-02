
import React, { useMemo } from 'react';
import { Lot, LotInfo } from "@/types";
import { User, Ruler, DollarSign, MapPin } from "lucide-react";

interface QuadraHoverTooltipProps {
  quadraId: string;
  lots: Lot[];
  lotsData: Map<string, LotInfo>;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  isMobile?: boolean;
}

export default function QuadraHoverTooltip({ quadraId, lots, lotsData, onMouseEnter, onMouseLeave, isMobile = false }: QuadraHoverTooltipProps) {
  
  const stats = useMemo(() => {
    let totalArea = 0;
    let occupiedCount = 0;
    let totalValue = 0;
    
    // Sort lots numerically
    const sortedLots = [...lots].sort((a, b) => {
        const nA = parseInt(a.lote.replace(/\D/g, '')) || 0;
        const nB = parseInt(b.lote.replace(/\D/g, '')) || 0;
        return nA - nB;
    });

    const rows = sortedLots.map(lot => {
        const info = lotsData.get(lot.id) || lot.info;
        const hasOwner = info.owner && info.owner.trim().length > 0;
        
        if (hasOwner) occupiedCount++;
        if (info.area) totalArea += Number(info.area);
        if (info.price) totalValue += Number(info.price);

        return {
            id: lot.id,
            lote: lot.lote,
            owner: info.owner || "-",
            area: info.area ? `${info.area} m²` : "-",
            price: info.price ? `R$ ${info.price.toLocaleString('pt-BR')}` : "-",
            statusColor: hasOwner ? "text-red-400" : "text-green-400",
            statusBg: hasOwner ? "bg-red-500/10" : "bg-green-500/10"
        };
    });

    return { totalArea, occupiedCount, totalValue, rows, totalLots: lots.length };
  }, [lots, lotsData]);

  // MOBILE: Compact version
  if (isMobile) {
    return (
      <div
        className="fixed top-4 right-4 z-[60] animate-in fade-in slide-in-from-top-4 duration-200 pointer-events-auto"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <div className="bg-zinc-950/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl ring-1 ring-white/5 p-3 w-[180px] text-white">
          {/* Header - Compact */}
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-bold flex items-center gap-1">
              <MapPin size={14} className="text-blue-400"/>
              Q{quadraId.replace('Quadra ', '')}
            </h4>
            <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-blue-200">
              {stats.totalLots}
            </span>
          </div>
          
          {/* Stats Grid - Compact */}
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">🆓 Livres</span>
              <span className="font-bold text-green-400">{stats.totalLots - stats.occupiedCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">🔒 Ocupados</span>
              <span className="font-bold text-red-400">{stats.occupiedCount}</span>
            </div>
            <div className="flex items-center justify-between pt-1.5 border-t border-white/10">
              <span className="text-gray-400">📏 Área</span>
              <span className="font-mono text-emerald-400 font-bold text-[11px]">
                {stats.totalArea.toLocaleString('pt-BR')} m²
              </span>
            </div>
          </div>
          
          {/* Hint - Mobile */}
          <div className="mt-2 pt-2 border-t border-white/10 text-[9px] text-center text-gray-500 italic">
            Toque no lote para ver detalhes
          </div>
        </div>
      </div>
    );
  }

  // DESKTOP: Full version with table
  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] animate-in fade-in slide-in-from-bottom-4 duration-200 pointer-events-auto"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="bg-zinc-950/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl ring-1 ring-white/5 p-0 min-w-[320px] max-w-[400px] overflow-hidden text-white flex flex-col max-h-[400px]">
        
        {/* Header */}
        <div className="p-4 border-b border-white/10 bg-gradient-to-r from-blue-900/40 to-cyan-900/40">
           <div className="flex items-center justify-between mb-2">
               <h3 className="text-lg font-bold flex items-center gap-2">
                   <MapPin size={18} className="text-blue-400"/> Quadra {quadraId.replace('Quadra ', '')}
               </h3>
               <span className="text-xs font-bold bg-white/10 px-2 py-0.5 rounded text-blue-200">
                   {stats.totalLots} Lotes
               </span>
           </div>
           
           {/* Summary Stats */}
           <div className="grid grid-cols-2 gap-2 text-xs">
               <div className="bg-black/20 p-2 rounded border border-white/5">
                   <span className="text-gray-400 block mb-0.5">Área Total</span>
                   <span className="font-mono text-emerald-400 font-bold">{stats.totalArea.toLocaleString('pt-BR')} m²</span>
               </div>
               <div className="bg-black/20 p-2 rounded border border-white/5">
                   <span className="text-gray-400 block mb-0.5">Ocupação</span>
                   <span className="font-mono font-bold">
                       <span className="text-red-400">{stats.occupiedCount}</span> / <span className="text-green-400">{stats.totalLots - stats.occupiedCount}</span>
                   </span>
               </div>
           </div>
        </div>

        {/* Scrollable List */}
        <div className="overflow-y-auto p-0 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent flex-1">
            <table className="w-full text-xs text-left cursor-default">
                <thead className="sticky top-0 bg-zinc-900 shadow-md text-gray-400 font-bold">
                    <tr>
                        <th className="p-2 pl-4">Lote</th>
                        <th className="p-2">Proprietário</th>
                        <th className="p-2">Área</th>
                        <th className="p-2 pr-4 text-right">Valor</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {stats.rows.map(row => (
                        <tr key={row.id} className={`hover:bg-white/5 transition-colors ${row.statusBg}`}>
                            <td className="p-2 pl-4 font-mono font-bold text-gray-300">{row.lote}</td>
                            <td className="p-2 truncate max-w-[100px]" title={row.owner}>{row.owner}</td>
                            <td className="p-2 text-gray-400">{row.area}</td>
                            <td className="p-2 pr-4 text-emerald-500 text-right">{row.price}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        
        <div className="p-2 bg-zinc-900 border-t border-white/10 text-[10px] text-center text-gray-500 italic">
            * Valores e áreas aproximados
        </div>

      </div>
    </div>
  );
}
