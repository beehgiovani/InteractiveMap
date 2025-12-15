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
  ownerContact?: string; // New: Phone/Email
  price?: number;
  area?: number;
  photos?: string[]; // New: List of image URLs
  documents?: { name: string; url: string; }[]; // New: List of document URLs
}

export interface Lot {
  id: string;
  quadra: string;
  lote: string;
  coordinates: [number, number][]; // Array de [x, y] para SVG
  center?: [number, number] | { x: number, y: number } | null;
  info: LotInfo;
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
