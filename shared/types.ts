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
  documentation?: string;
  owner?: string;
  price?: number;
  area?: number;
  photos?: string[];
  documents?: { name: string; url: string }[];
  ownerContact?: string;
}

export interface Lot {
  id: string;
  quadra: string;
  lote: string;
  coordinates: [number, number][]; // Array de [x, y] para SVG
  info: LotInfo;
  center?: [number, number] | { x: number, y: number } | null;
}

export interface Quadra {
  id: string;
  name: string;
  lots: Lot[];
  center?: [number, number] | { x: number, y: number } | null;
}

export interface MapData {
  quadras: Quadra[];
}
