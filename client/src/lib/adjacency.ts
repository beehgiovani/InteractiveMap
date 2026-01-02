
import { Lot } from "@/types";

// Tolerance for vertex matching (in map units)
const VERTEX_TOLERANCE = 0.5; 

export interface CombinationResult {
    lots: Lot[];
    totalArea: number;
}

/**
 * Checks if two lots are neighbors by comparing their vertices.
 * Returns true if they share at least TWO vertices (an edge) (within tolerance).
 * "Corner" touches (1 vertex) are not enough for merging lots generally.
 */
function areNeighbors(lot1: Lot, lot2: Lot): boolean {
    if (lot1.quadra !== lot2.quadra) return false; // Optimization: restrict to same quadra for now

    let sharedVertices = 0;
    const usedIndices = new Set<number>();

    // Check distance between any pair of vertices
    for (const p1 of lot1.coordinates) {
        for (let i = 0; i < lot2.coordinates.length; i++) {
            if (usedIndices.has(i)) continue; // Avoid double counting if geometry is messy

            const p2 = lot2.coordinates[i];
            const dx = p1[0] - p2[0];
            const dy = p1[1] - p2[1];
            const distSq = dx*dx + dy*dy;
            
            if (distSq < VERTEX_TOLERANCE * VERTEX_TOLERANCE) {
                sharedVertices++;
                usedIndices.add(i);
                if (sharedVertices >= 2) return true; // Found an edge!
            }
        }
    }
    return false;
}

/**
 * Finds combinations of contiguous lots that sum up to a target area.
 * Supports: Single, Pair, Triplet.
 */
export function findContiguousCombinations(
    allLots: Lot[], 
    targetArea: number, 
    tolerancePercent: number = 0.05
): CombinationResult[] {
    const results: CombinationResult[] = [];
    const minArea = targetArea * (1 - tolerancePercent);
    const maxArea = targetArea * (1 + tolerancePercent);

    // 1. Pre-filter lots that have a defined area
    const lotsWithArea = allLots.filter(l => (l.info.area || 0) > 0);

    // Helper to check if a sum is valid
    const isSumValid = (sum: number) => sum >= minArea && sum <= maxArea;

    // Helper to add unique result
    const addResult = (lots: Lot[]) => {
        // Sort by ID to ensure uniqueness of set
        lots.sort((a,b) => a.id.localeCompare(b.id));
        
        // Check duplicates in results
        const isDuplicate = results.some(r => 
            r.lots.length === lots.length && 
            r.lots.every((l, i) => l.id === lots[i].id)
        );

        if (!isDuplicate) {
            const total = lots.reduce((acc, l) => acc + (l.info.area || 0), 0);
            results.push({ lots, totalArea: total });
        }
    };

    // --- PHASE 1: Single Lots ---
    for (const lot of lotsWithArea) {
        const area = lot.info.area!;
        if (isSumValid(area)) {
            addResult([lot]);
        }
    }

    // --- PHASE 2: Pairs ---
    // We only check lots in the same quadra to speed up
    // Group by Quadra
    const lotsByQuadra: Record<string, Lot[]> = {};
    for (const lot of lotsWithArea) {
        if (!lotsByQuadra[lot.quadra]) lotsByQuadra[lot.quadra] = [];
        lotsByQuadra[lot.quadra].push(lot);
    }

    Object.values(lotsByQuadra).forEach(quadraLots => {
        for (let i = 0; i < quadraLots.length; i++) {
            for (let j = i + 1; j < quadraLots.length; j++) {
                const l1 = quadraLots[i];
                const l2 = quadraLots[j];
                
                const sum = (l1.info.area!) + (l2.info.area!);
                
                // Opt: If sum is already too big, maybe skip? (cant sort easily)
                // If sum is within range...
                if (isSumValid(sum)) {
                    // Check adjacency
                    if (areNeighbors(l1, l2)) {
                        addResult([l1, l2]);
                    }
                }
            }
        }
    });

    // --- PHASE 3: Triplets ---
    // Iterate over found adjacent Pairs and try to add a 3rd neighbor
    // Only if we haven't found too many results?
    
    // To do this efficiently:
    // 1. Build an adjacency map for the quadra
    Object.values(lotsByQuadra).forEach(quadraLots => {
        const adjMap = new Map<string, Lot[]>();
        
        // Build graph
        for (let i = 0; i < quadraLots.length; i++) {
            for (let j = i + 1; j < quadraLots.length; j++) {
                 const l1 = quadraLots[i];
                 const l2 = quadraLots[j];
                 if (areNeighbors(l1, l2)) {
                     if (!adjMap.has(l1.id)) adjMap.set(l1.id, []);
                     if (!adjMap.has(l2.id)) adjMap.set(l2.id, []);
                     adjMap.get(l1.id)!.push(l2);
                     adjMap.get(l2.id)!.push(l1);
                 }
            }
        }

        // Search triplets using the graph
        // For each edge (A, B)
        for (const [idA, neighborsA] of Array.from(adjMap.entries())) {
            const lotA = quadraLots.find(l => l.id === idA)!;
            
            for (const lotB of neighborsA) {
                // Ensure order to avoid duplicates (A < B)
                if (lotA.id >= lotB.id) continue;

                const currentSum = (lotA.info.area!) + (lotB.info.area!);
                
                // Find neighbor C of A or B
                // We need C > B to avoid dupes (A < B < C) ? No, that limits "V" shapes.
                // We need a unique set {A,B,C}.
                // Candidates for C are neighbors of A UNION neighbors of B.
                
                const candidates = new Set<Lot>();
                adjMap.get(lotA.id)?.forEach(n => candidates.add(n));
                adjMap.get(lotB.id)?.forEach(n => candidates.add(n));

                candidates.forEach(lotC => {
                    // Avoid using A or B again
                    if (lotC.id === lotA.id || lotC.id === lotB.id) return;
                    
                    // Enforce order A < B < C for unique checking? 
                    // No, because A and C might not be neighbors of each other, just connected via B.
                    // To avoid duplicates, we can simply addResult and let the deduper handle it, 
                    // or enforce A.id < B.id < C.id IF they are fully connected?
                    // But they aren't fully connected.
                    
                    // Simple Dedup: Ensure we iterate only once per combination.
                    // Let's rely on addResult's sorting/deduping which is robust.
                    
                    const total = currentSum + (lotC.info.area!);
                    if (isSumValid(total)) {
                        addResult([lotA, lotB, lotC]);
                    }
                });
            }
        }
    });

    return results.sort((a,b) => Math.abs(a.totalArea - targetArea) - Math.abs(b.totalArea - targetArea));
}
