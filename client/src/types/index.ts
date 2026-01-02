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
  refCode?: string; // Código de referência do imóvel na imobiliária
  
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
  center?: [number, number] | { x: number, y: number } | null;
  info: LotInfo;
  status?: 'disponivel' | 'vendido' | 'reservado'; // Added status
}

export interface Quadra {
  id: string;
  name: string;
  bubbleLabel?: string; // Short label for rendering
  lots: Lot[];
  center?: [number, number] | { x: number, y: number } | null;
}

export interface MapData {
  quadras: Quadra[];
}

/**
 * Helper function to determine lot completion status
 * @param lot - The lot to check
 * @returns 'empty' | 'partial' | 'complete'
 */
export function getLotCompletionStatus(lot: Lot): 'empty' | 'partial' | 'complete' {
  const { notes, owner, area, price, documentation } = lot.info;
  
  // Count filled fields
  const filledFields = [
    notes && notes.trim().length > 0,
    owner && owner.trim().length > 0,
    area !== undefined && area > 0,
    price !== undefined && price > 0,
    documentation && documentation.trim().length > 0
  ].filter(Boolean).length;
  
  if (filledFields === 0) return 'empty';
  if (filledFields >= 3) return 'complete'; // At least 3 fields filled
  return 'partial';
}
