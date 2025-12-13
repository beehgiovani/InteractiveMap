/**
 * Página Principal - Mapa Interativo
 * 
 * Exibe o mapa interativo e gerencia a seleção de lotes
 * Integra o componente de mapa com a pasta de lote
 */

import React, { useState, useEffect } from "react";
import { Lot, LotInfo } from "@/types";
import InteractiveMap from "@/components/InteractiveMap";
import LotFolder from "@/components/LotFolder";
import { mapData } from "@/data/mapData";

export default function Home() {
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [lotsData, setLotsData] = useState<Map<string, LotInfo>>(new Map());

  // Carregar dados salvos do localStorage ao iniciar
  useEffect(() => {
    const savedData = localStorage.getItem("lotsData");
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        const map = new Map<string, LotInfo>();
        Object.entries(parsed).forEach(([key, value]: [string, any]) => {
          map.set(key, {
            ...value,
            createdAt: new Date(value.createdAt),
            updatedAt: new Date(value.updatedAt),
          });
        });
        setLotsData(map);
      } catch (error) {
        console.error("Erro ao carregar dados salvos:", error);
      }
    }

    // Inicializar dados dos lotes se não existirem
    const allLots = mapData.quadras.flatMap((q) => q.lots);
    allLots.forEach((lot) => {
      if (!lotsData.has(lot.id)) {
        setLotsData((prev) => {
          const newMap = new Map(prev);
          newMap.set(lot.id, lot.info);
          return newMap;
        });
      }
    });
  }, []);

  // Salvar dados no localStorage sempre que mudam
  useEffect(() => {
    const dataToSave: Record<string, LotInfo> = {};
    lotsData.forEach((value, key) => {
      dataToSave[key] = value;
    });
    localStorage.setItem("lotsData", JSON.stringify(dataToSave));
  }, [lotsData]);

  const handleLotClick = (lot: Lot) => {
    // Atualizar as informações do lote com os dados salvos
    const savedInfo = lotsData.get(lot.id);
    if (savedInfo) {
      setSelectedLot({
        ...lot,
        info: savedInfo,
      });
    } else {
      setSelectedLot(lot);
    }
  };

  const handleSaveLotInfo = (lotInfo: LotInfo) => {
    setLotsData((prev) => {
      const newMap = new Map(prev);
      newMap.set(lotInfo.id, lotInfo);
      return newMap;
    });

    // Atualizar o lote selecionado
    if (selectedLot) {
      setSelectedLot({
        ...selectedLot,
        info: lotInfo,
      });
    }
  };

  const handleCloseLotFolder = () => {
    setSelectedLot(null);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Cabeçalho */}
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Mapa Interativo - Jardim Acapulco
          </h1>
          <p className="text-gray-600">
            Clique em qualquer lote para gerenciar suas informações e adicionar notas
          </p>
        </div>

        {/* Mapa Interativo */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden" style={{ minHeight: "600px" }}>
          <InteractiveMap
            onLotClick={handleLotClick}
            selectedLotId={selectedLot?.id}
          />
        </div>

        {/* Estatísticas */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">
              Total de Quadras
            </h3>
            <p className="text-3xl font-bold text-blue-600">
              {mapData.quadras.length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">
              Total de Lotes
            </h3>
            <p className="text-3xl font-bold text-blue-600">
              {mapData.quadras.reduce((sum, q) => sum + q.lots.length, 0)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">
              Lotes com Notas
            </h3>
            <p className="text-3xl font-bold text-blue-600">
              {Array.from(lotsData.values()).filter((info) => info.notes.length > 0).length}
            </p>
          </div>
        </div>
      </div>

      {/* Pasta do Lote */}
      {selectedLot && (
        <LotFolder
          lot={selectedLot}
          onClose={handleCloseLotFolder}
          onSave={handleSaveLotInfo}
        />
      )}
    </div>
  );
}
