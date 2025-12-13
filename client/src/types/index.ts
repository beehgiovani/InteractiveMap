/**
 * Tipos compartilhados para o mapa interativo de lotes
 */

export interface LotInfo {
  id: string;
  quadra: string;
  lote: string;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Lot {
  id: string;
  quadra: string;
  lote: string;
  coordinates: [number, number][]; // Array de [x, y] para SVG
  info: LotInfo;
}

export interface Quadra {
  id: string;
  name: string;
  lots: Lot[];
}

export interface MapData {
  quadras: Quadra[];
}
