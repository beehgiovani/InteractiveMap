import { useEffect, useState } from 'react';
import { LeafletMap } from '@/components/LeafletMap';
import { Lot } from '@/types';

export default function LeafletTest() {
  const [lots, setLots] = useState<Lot[]>([]);
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);

  // Load lots from localStorage (same as Home.tsx does)
  useEffect(() => {
    const loadLocalData = () => {
      let savedManualLots = localStorage.getItem("manualMapData_v2");
      
      // Fallback to v1 if v2 is missing
      if (!savedManualLots || savedManualLots === "[]") {
        const savedV1 = localStorage.getItem("manualMapData");
        if (savedV1 && savedV1.length > 2) {
          console.log("📦 Loading from legacy manualMapData...");
          savedManualLots = savedV1;
        }
      }

      if (savedManualLots) {
        try {
          const parsed = JSON.parse(savedManualLots);
          setLots(parsed);
          console.log(`✅ Loaded ${parsed.length} lots from localStorage for Leaflet map`);
        } catch (e) {
          console.error("Error parsing saved manual lots", e);
        }
      } else {
        console.warn("⚠️ No lots found in localStorage!");
      }
    };

    loadLocalData();
  }, []);

  const handleLotClick = (lot: Lot) => {
    console.log('Lot clicked:', lot);
    setSelectedLotId(lot.id);
  };

  return (
    <div className="w-screen h-screen">
      {/* Info Banner */}
      <div className="absolute top-0 left-0 right-0 z-[1001] bg-blue-600 text-white px-4 py-2 text-center font-bold">
        🗺️ TESTE: Leaflet Map com Satélite Real Esri - {lots.length} lotes carregados
      </div>

      {/* Leaflet Map */}
      <div className="pt-10">
        <LeafletMap
          lots={lots}
          onLotClick={handleLotClick}
          selectedLotId={selectedLotId}
        />
      </div>

      {/* Selected Lot Info */}
      {selectedLotId && (
        <div className="absolute bottom-4 right-4 z-[1001] bg-white p-4 rounded-lg shadow-xl max-w-sm">
          <h3 className="font-bold text-lg mb-2">Lote Selecionado</h3>
          <p className="text-sm text-gray-600">ID: {selectedLotId}</p>
          <p className="text-sm text-gray-600">
            {lots.find(l => l.id === selectedLotId)?.quadra && 
              `Quadra ${lots.find(l => l.id === selectedLotId)?.quadra} - Lote ${lots.find(l => l.id === selectedLotId)?.lote}`
            }
          </p>
        </div>
      )}
    </div>
  );
}
