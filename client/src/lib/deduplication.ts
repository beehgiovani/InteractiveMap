
import { Lot, LotInfo } from "../../../shared/types";

/**
 * Deduplicates a list of lots based on a strict deterministic ID policy (${quadra}-${lote}).
 * Priorities:
 * 1. Strict ID Match (e.g. "15-10")
 * 2. Latest Created/Updated Timestamp
 * 
 * Returns a clean list of unique lots.
 */
export const deduplicateLots = (lots: Lot[]): Lot[] => {
    const lotMap = new Map<string, Lot>();
    const legacyMap = new Map<string, Lot>(); // Key: "quadra-lote", Value: Lot

    lots.forEach(lot => {
        // Normalize Key: "Q-L"
        const key = `${lot.quadra}-${lot.lote}`;
        
        // Is this a STRICT ID?
        const isStrict = lot.id === key;

        if (isStrict) {
            // Priority 1: Strict ID
            // If we already have a strict ID, keep the newer one? 
            // Or just keep the first one? Usually strict IDs shouldn't duplicate.
            // But if they do, use updatedAt.
            if (lotMap.has(key)) {
                const existing = lotMap.get(key)!;
                const existingDate = new Date(existing.info.updatedAt || 0).getTime();
                const newDate = new Date(lot.info.updatedAt || 0).getTime();
                if (newDate > existingDate) {
                    lotMap.set(key, lot);
                }
            } else {
                lotMap.set(key, lot);
            }
        } else {
            // Legacy ID (timestamped)
            if (legacyMap.has(key)) {
                const existing = legacyMap.get(key)!;
                const existingDate = new Date(existing.info.updatedAt || 0).getTime();
                const newDate = new Date(lot.info.updatedAt || 0).getTime();
                if (newDate > existingDate) {
                    legacyMap.set(key, lot);
                }
            } else {
                legacyMap.set(key, lot);
            }
        }
    });

    // Merge: Prefer Strict over Legacy
    legacyMap.forEach((legacyLot, key) => {
        if (!lotMap.has(key)) {
            // If no strict version exists, promoted legacy logic? 
            // Better: Keep legacy ID but treat as unique? 
            // NO. The goal is Single Source of Truth.
            // If we sync this back, we typically want to CONVERT it to strict.
            // But changing ID is dangerous for references.
            // For now, let's just ensure we return ONE lot per Quadra-Lote.
            lotMap.set(key, legacyLot); 
        }
    });

    return Array.from(lotMap.values());
};

/**
 * Merges two maps of LotInfo, preferring the one from the "Strict Lot".
 */
export const deduplicateLotInfo = (infoMap: Map<string, LotInfo>, uniqueLots: Lot[]): Map<string, LotInfo> => {
    const newMap = new Map<string, LotInfo>();
    
    uniqueLots.forEach(lot => {
        // Try to find info for this lot ID
        if (infoMap.has(lot.id)) {
            newMap.set(lot.id, infoMap.get(lot.id)!);
        } else {
            // Fallback: Check if there was info under a different ID for this same Quadra-Lote?
            // This is complex. For now, rely on ID match.
            if (lot.info) newMap.set(lot.id, lot.info);
        }
    });
    
    return newMap;
};
