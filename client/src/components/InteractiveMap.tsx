/**
 * Componente de Mapa Interativo
 * 
 * Renderiza os lotes do mapa como polígonos SVG clicáveis
 * Cada lote pode ser clicado para abrir a interface de gerenciamento
 */

import React, { useState } from "react";
import { Lot } from "@/types";
import { mapData } from "@/data/mapData";

interface InteractiveMapProps {
  onLotClick: (lot: Lot) => void;
  selectedLotId?: string;
}

export default function InteractiveMap({
  onLotClick,
  selectedLotId,
}: InteractiveMapProps) {
  const [hoveredLotId, setHoveredLotId] = useState<string | null>(null);

  // Calcular o viewBox baseado nas coordenadas dos lotes
  const allLots = mapData.quadras.flatMap((q) => q.lots);
  const allCoordinates = allLots.flatMap((lot) => lot.coordinates);
  const minX = Math.min(...allCoordinates.map((c) => c[0])) - 20;
  const minY = Math.min(...allCoordinates.map((c) => c[1])) - 20;
  const maxX = Math.max(...allCoordinates.map((c) => c[0])) + 20;
  const maxY = Math.max(...allCoordinates.map((c) => c[1])) + 20;

  const width = maxX - minX;
  const height = maxY - minY;

  return (
    <div className="w-full h-full flex flex-col bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Cabeçalho do mapa */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6">
        <h1 className="text-3xl font-bold">Mapa Interativo - Jardim Acapulco</h1>
        <p className="text-blue-100 mt-2">Clique em um lote para gerenciar suas informações</p>
      </div>

      {/* SVG do mapa */}
      <div className="flex-1 overflow-auto p-6 bg-gray-50">
        <svg
          viewBox={`${minX} ${minY} ${width} ${height}`}
          className="w-full h-full max-w-4xl mx-auto bg-white rounded border-2 border-gray-200"
          style={{ minHeight: "500px" }}
        >
          {/* Renderizar cada quadra e seus lotes */}
          {mapData.quadras.map((quadra) => (
            <g key={quadra.id}>
              {/* Renderizar cada lote */}
              {quadra.lots.map((lot) => {
                const isSelected = selectedLotId === lot.id;
                const isHovered = hoveredLotId === lot.id;
                const polygonPoints = lot.coordinates
                  .map((coord) => `${coord[0]},${coord[1]}`)
                  .join(" ");

                return (
                  <g key={lot.id}>
                    {/* Polígono do lote */}
                    <polygon
                      points={polygonPoints}
                      fill={
                        isSelected
                          ? "#1e40af"
                          : isHovered
                            ? "#3b82f6"
                            : "#f0f9ff"
                      }
                      stroke={
                        isSelected
                          ? "#1e3a8a"
                          : isHovered
                            ? "#1e40af"
                            : "#cbd5e1"
                      }
                      strokeWidth="2"
                      className="cursor-pointer transition-all duration-200"
                      onClick={() => onLotClick(lot)}
                      onMouseEnter={() => setHoveredLotId(lot.id)}
                      onMouseLeave={() => setHoveredLotId(null)}
                      style={{
                        filter: isHovered ? "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))" : "none",
                      }}
                    />

                    {/* Texto do lote (Quadra e Lote) */}
                    <text
                      x={(lot.coordinates[0][0] + lot.coordinates[2][0]) / 2}
                      y={(lot.coordinates[0][1] + lot.coordinates[2][1]) / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-xs font-semibold pointer-events-none select-none"
                      fill={isSelected ? "#ffffff" : "#334155"}
                      fontSize="12"
                    >
                      <tspan x={(lot.coordinates[0][0] + lot.coordinates[2][0]) / 2} dy="0">
                        Q{lot.quadra}
                      </tspan>
                      <tspan
                        x={(lot.coordinates[0][0] + lot.coordinates[2][0]) / 2}
                        dy="14"
                      >
                        L{lot.lote}
                      </tspan>
                    </text>
                  </g>
                );
              })}
            </g>
          ))}
        </svg>
      </div>

      {/* Legenda */}
      <div className="bg-gray-100 p-4 border-t border-gray-200">
        <div className="flex gap-6 flex-wrap text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-100 border-2 border-gray-400 rounded"></div>
            <span>Lote disponível</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-400 border-2 border-blue-600 rounded"></div>
            <span>Lote em foco</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-700 border-2 border-blue-900 rounded"></div>
            <span>Lote selecionado</span>
          </div>
        </div>
      </div>
    </div>
  );
}
