import React, { useState } from 'react';
import { Layers } from 'lucide-react';

export type MapLayer = 'base' | 'satellite' | 'custom';

interface LayerSelectorProps {
  activeLayer: MapLayer;
  onLayerChange: (layer: MapLayer) => void;
  direction?: 'up' | 'down';
  align?: 'left' | 'right';
}

export function LayerSelector({ activeLayer, onLayerChange, direction = 'up', align = 'left' }: LayerSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const layers = [
    { id: 'custom' as MapLayer, name: 'Mapa Base', icon: '🗺️', description: 'Vetorizado' },
    { id: 'satellite' as MapLayer, name: 'Satélite', icon: '🛰️', description: 'Real' },
    { id: 'base' as MapLayer, name: 'OpenStreetMap', icon: '🌍', description: 'Estradas' }
  ];

  return (
    <div className="relative font-sans">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
            group flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all duration-300
            border backdrop-blur-xl shadow-lg
            ${isOpen 
                ? 'bg-blue-600 border-blue-400 text-white shadow-blue-900/50' 
                : 'bg-black/40 border-white/10 text-gray-200 hover:bg-black/60 hover:text-white hover:border-white/20'
            }
        `}
      >
        <Layers size={18} className={`transition-transform duration-500 ${isOpen ? 'rotate-180 text-white' : 'text-blue-400 group-hover:text-blue-300'}`} />
        <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline-block">Camadas</span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop to close on click outside */}
          <div 
            className="fixed inset-0 z-40 bg-black/5 backdrop-blur-[1px]" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu */}
          <div className={`
                absolute ${align === 'right' ? 'right-0' : 'left-0'} min-w-[200px] z-50 animate-in fade-in zoom-in-95 duration-200
                bg-black/80 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden
                ${direction === 'up' ? 'bottom-full mb-3 slide-in-from-bottom-2' : 'top-full mt-3 slide-in-from-top-2'}
          `}>
             <div className="px-3 py-2 bg-white/5 border-b border-white/5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                Selecione a Visualização
             </div>
            <div className="p-1.5 space-y-1">
                {layers.map((layer) => (
                <button
                    key={layer.id}
                    onClick={() => {
                    onLayerChange(layer.id);
                    setIsOpen(false);
                    }}
                    className={`
                        w-full px-3 py-2 text-left rounded-xl transition-all duration-200 flex items-center gap-3 group relative overflow-hidden
                        ${activeLayer === layer.id 
                            ? 'bg-blue-600/20 text-white border border-blue-500/30 shadow-lg shadow-blue-900/20' 
                            : 'text-gray-400 hover:bg-white/10 hover:text-gray-200 border border-transparent'
                        }
                    `}
                >
                    <span className="text-xl relative z-10 group-hover:scale-110 transition-transform duration-300">{layer.icon}</span>
                    <div className="flex flex-col relative z-10">
                        <span className={`text-sm font-bold ${activeLayer === layer.id ? 'text-blue-200' : 'text-gray-300'}`}>
                            {layer.name}
                        </span>
                        <span className="text-[10px] opacity-60 uppercase tracking-wider font-semibold">
                            {layer.description}
                        </span>
                    </div>
                    
                    {activeLayer === layer.id && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)] animate-pulse" />
                    )}
                </button>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
