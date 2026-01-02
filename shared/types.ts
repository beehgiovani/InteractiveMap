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
  website?: string; // New: External website URL
  testada?: number; // New: Frontage length
  
  // New Fields requested
  zona?: string; 
  setor?: string;
  loteGeo?: string; // Lote Geo (diferente do lote fiscal/físico)
  ownerCpf?: string; // CPF do proprietário
  status?: 'neutro' | 'livre' | 'ocupado' | 'disponivel' | 'vendido' | 'reservado';
  isAvailable?: boolean; // Disponível para venda pela imobiliária
  
  // Advanced Operations
  aliases?: string[]; // Alternative IDs (e.g. ["15", "1A"])
  displayId?: string; // Concatenated Label (e.g. "1 & 15")
  
  // History Tracking for Merge/Split
  history?: LotHistory;
}

export interface LotHistory {
  type: 'merge' | 'split' | 'manual';
  parentIds?: string[]; // For Merge: IDs of original lots
  originId?: string;    // For Split: ID of the original lot
  timestamp: Date;
}

export interface Lot {
  id: string;
  quadra: string;
  lote: string;
  coordinates: [number, number][] | [number, number][][]; // Array de [x, y] (Polygon) ou Array de Arrays (MultiPolygon)
  info: LotInfo;
  center?: [number, number] | { x: number, y: number } | null;
  status?: 'disponivel' | 'vendido' | 'reservado';
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
