/**
 * Dados do mapa do Jardim Acapulco
 * Estrutura de quadras e lotes com coordenadas SVG
 * 
 * As coordenadas são baseadas no layout do mapa original
 * Cada lote é representado por um polígono SVG
 */

import { MapData, Lot, Quadra } from "@/types";

// Função auxiliar para criar um lote
function createLot(
  quadra: string,
  lote: string,
  coordinates: [number, number][]
): Lot {
  return {
    id: `${quadra}-${lote}`,
    quadra,
    lote,
    coordinates,
    info: {
      id: `${quadra}-${lote}`,
      quadra,
      lote,
      notes: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
}

// Dados das quadras e lotes
// As coordenadas são aproximadas baseadas no layout visual do mapa
export const mapData: MapData = {
  quadras: [
    {
      id: "quadra-1",
      name: "Quadra 1",
      lots: [
        createLot("1", "1", [[50, 50], [100, 50], [100, 100], [50, 100]]),
        createLot("1", "2", [[110, 50], [160, 50], [160, 100], [110, 100]]),
        createLot("1", "3", [[170, 50], [220, 50], [220, 100], [170, 100]]),
        createLot("1", "4", [[50, 110], [100, 110], [100, 160], [50, 160]]),
        createLot("1", "5", [[110, 110], [160, 110], [160, 160], [110, 160]]),
        createLot("1", "6", [[170, 110], [220, 110], [220, 160], [170, 160]]),
      ],
    },
    {
      id: "quadra-2",
      name: "Quadra 2",
      lots: [
        createLot("2", "1", [[250, 50], [300, 50], [300, 100], [250, 100]]),
        createLot("2", "2", [[310, 50], [360, 50], [360, 100], [310, 100]]),
        createLot("2", "3", [[370, 50], [420, 50], [420, 100], [370, 100]]),
        createLot("2", "4", [[250, 110], [300, 110], [300, 160], [250, 160]]),
        createLot("2", "5", [[310, 110], [360, 110], [360, 160], [310, 160]]),
        createLot("2", "6", [[370, 110], [420, 110], [420, 160], [370, 160]]),
      ],
    },
    {
      id: "quadra-3",
      name: "Quadra 3",
      lots: [
        createLot("3", "1", [[50, 200], [100, 200], [100, 250], [50, 250]]),
        createLot("3", "2", [[110, 200], [160, 200], [160, 250], [110, 250]]),
        createLot("3", "3", [[170, 200], [220, 200], [220, 250], [170, 250]]),
        createLot("3", "4", [[50, 260], [100, 260], [100, 310], [50, 310]]),
        createLot("3", "5", [[110, 260], [160, 260], [160, 310], [110, 310]]),
        createLot("3", "6", [[170, 260], [220, 260], [220, 310], [170, 310]]),
      ],
    },
    {
      id: "quadra-4",
      name: "Quadra 4",
      lots: [
        createLot("4", "1", [[250, 200], [300, 200], [300, 250], [250, 250]]),
        createLot("4", "2", [[310, 200], [360, 200], [360, 250], [310, 250]]),
        createLot("4", "3", [[370, 200], [420, 200], [420, 250], [370, 250]]),
        createLot("4", "4", [[250, 260], [300, 260], [300, 310], [250, 310]]),
        createLot("4", "5", [[310, 260], [360, 260], [360, 310], [310, 310]]),
        createLot("4", "6", [[370, 260], [420, 260], [420, 310], [370, 310]]),
      ],
    },
  ],
};

// Função para obter todos os lotes
export function getAllLots(): Lot[] {
  return mapData.quadras.flatMap((quadra) => quadra.lots);
}

// Função para obter um lote específico
export function getLotById(id: string): Lot | undefined {
  return getAllLots().find((lot) => lot.id === id);
}

// Função para obter todos os lotes de uma quadra
export function getLotsByQuadra(quadraId: string): Lot[] {
  return getAllLots().filter((lot) => lot.quadra === quadraId);
}
