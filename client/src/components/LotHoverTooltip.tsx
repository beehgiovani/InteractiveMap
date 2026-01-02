/**
 * LotHoverTooltip Component
 * 
 * Displays quick information about a lot on hover with edit option
 */

import { Lot } from "@/types";
import { Button } from "./ui/button";
import { Edit2, MapPin, User, Ruler, DollarSign, ExternalLink } from "lucide-react";

interface LotHoverTooltipProps {
  lot: Lot;
  position: { x: number; y: number };
  onEdit: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export default function LotHoverTooltip({ lot, position, onEdit, onMouseEnter, onMouseLeave }: LotHoverTooltipProps) {
  const { quadra, lote, info } = lot;
  const { owner, area, price } = info;

  return (
    <div
      className="fixed pointer-events-none z-50 animate-in fade-in zoom-in-95 duration-200"
      style={{
        left: `${position.x + 20}px`,
        top: `${position.y - 10}px`,
      }}
    >
      <div 
        className="bg-zinc-950/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl ring-1 ring-white/5 p-4 min-w-[280px] pointer-events-auto relative overflow-hidden group"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 blur-3xl rounded-full -mr-10 -mt-10 pointer-events-none" />
        {/* Header */}
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-500/20 rounded-lg">
              <MapPin size={16} className="text-blue-400" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">Lote {lote}</h3>
              <p className="text-blue-300/70 text-xs">Quadra {quadra}</p>
            </div>
          </div>
        </div>

        {/* Quick Info */}
        <div className="space-y-2 mb-3">
          {owner && (
            <div className="flex items-center gap-2 text-xs">
              <User size={12} className="text-gray-400" />
              <span className="text-gray-300 truncate">{owner}</span>
            </div>
          )}
          {area && (
            <div className="flex items-center gap-2 text-xs">
              <Ruler size={12} className="text-gray-400" />
              <span className="text-gray-300">{area} m²</span>
            </div>
          )}
          {price && (
            <div className="flex items-center gap-2 text-xs">
              <DollarSign size={12} className="text-gray-400" />
              <span className="text-emerald-400 font-medium">R$ {price.toLocaleString('pt-BR')}</span>
            </div>
          )}
          {!owner && !area && !price && (
            <p className="text-gray-500 text-xs italic">Sem informações cadastradas</p>
          )}
        </div>

        {/* Website Link */}
        {info.website && (
            <a 
              href={info.website} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs py-2 rounded-md mb-3 transition-all shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 font-bold animate-pulse"
              onClick={(e) => e.stopPropagation()} // Prevent map click
            >
              <ExternalLink size={14} className="mr-2" />
              ACESSAR LINK
            </a>
        )}

        {/* Edit Button */}
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          size="sm"
          className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs h-7 shadow-lg shadow-blue-500/20"
        >
          <Edit2 size={12} className="mr-1.5" />
          Editar Lote
        </Button>
      </div>
    </div>
  );
}
