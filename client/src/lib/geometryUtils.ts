import * as turf from '@turf/turf';
import { Feature, Polygon, FeatureCollection, MultiPolygon } from 'geojson';
import { Lot, LotInfo } from '../types';

/**
 * Transforms SVG-like coordinates [x, y] to GeoJSON Polygon coordinates.
 * Turf expects [lon, lat] (or [x, y]), and a closed loop (first = last).
 */
const toTurfPolygon = (coordinates: [number, number][]) => {
    // Ensure closed loop
    const coords = [...coordinates];
    if (coords.length > 0) {
        const first = coords[0];
        const last = coords[coords.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
            coords.push(first);
        }
    }
    // Turf expects [[[x,y], [x,y], ...]] separate rings
    return turf.polygon([coords]);
};

/**
 * Transforms Turf Polygon coordinates back to SVG-like coordinates [x, y][].
 * Removes the last closing point if it's identical to the first.
 */
const fromTurfPolygon = (feature: Feature<Polygon>): [number, number][] => {
    const ring = feature.geometry.coordinates[0]; // Outer ring
    if (!ring) return [];

    // Remove closing point if identical to first (standard SVG poly behavior usually doesn't need it closed physically in points array if <polygon> element is used, but for consistency lets keep it open unless needed)
    // Actually, <polygon> auto-closes. Let's return as is but maybe pop last?
    // Let's pop last if equal to first.
    const unique = [...ring];
    const first = unique[0];
    const last = unique[unique.length - 1];

    if (unique.length > 2 && first[0] === last[0] && first[1] === last[1]) {
        unique.pop();
    }
    
    // Turf uses numbers, we return tuples
    return unique.map(p => [p[0], p[1]]);
};

/**
 * MERGE LOTS
 * Takes an array of lots, calculates the union of their geometries,
 * and returns a single merged lot template (new coordinates and center).
 * The caller is responsible for handling ID/Info merging.
 */
export const mergeLotsGeometry = (lots: Lot[]): { coordinates: [number, number][] | [number, number][][], center: [number, number] } | null => {
    if (lots.length < 2) return null;

    try {
        // Handle input: coordinates could be Polygon or MultiPolygon
        let polys = lots.map(l => {
            // Helper to convert any lot coords to a Turf Feature
            if (Array.isArray(l.coordinates[0][0])) {
                // MultiPolygon Input ([x,y][][])
                return turf.multiPolygon([l.coordinates as any]); 
                // Wait, turf.multiPolygon takes [[[x,y]...], [[x,y]...]]
                // Our format: [ring1, ring2]
                // Turf expects: [[ring1], [ring2]] (if separate polygons) or [[[outer, inner]], [[outer]]]
                // Actually, let's simplify: Convert everything to Polygons first?
                // No, just treat as feature.
                // If it's MultiPolygon in our app, it's array of rings.
                // Turf multiPolygon expects array of Polygons (array of array of rings).
                // Let's iterate and explode if needed.
                return turf.multiPolygon([l.coordinates as any]); // Simplified cast
            } else {
                // Polygon Input ([x,y][])
                return toTurfPolygon(l.coordinates as [number, number][]);
            }
        });
        
        // Turf v7: union takes a FeatureCollection
        let collection = turf.featureCollection(polys as any) as FeatureCollection<Polygon | MultiPolygon>;
        let result = turf.union(collection);

        if (!result) return null;
        
        let finalCoords: [number, number][] | [number, number][][] = [];
        let isMulti = false;

        // Check for MultiPolygon (gaps)
        if (result.geometry.type === 'MultiPolygon') {
            console.warn("Merge resulted in MultiPolygon. Attempting auto-healing (buffering)...");
            
            // Retry with small buffer
            const bufferedPolys = polys.map((p: any) => turf.buffer(p, 0.1, { units: 'meters' })).filter((p): p is Feature<Polygon | MultiPolygon> => p !== undefined);
            const bufferedCollection = turf.featureCollection(bufferedPolys);
            const bufferedResult = turf.union(bufferedCollection);
            
            if (bufferedResult && bufferedResult.geometry.type === 'Polygon') {
                console.log("✓ Auto-healing successful. Gaps bridged.");
                result = turf.simplify(bufferedResult, { tolerance: 0.01, highQuality: true });
            } else {
                 console.warn("Merge persisting as MultiPolygon. Returning as multi-part lot.");
                 
                 const multi = result as Feature<import("geojson").MultiPolygon>;
                 // Flatten to Array of Rings [[x,y]...]
                 // coordinates: Position[][][] (Polygon[]) -> Position[][] (Ring[]) -> each Ring is Position[]
                 const rings = multi.geometry.coordinates.flatMap(poly => poly); 
                 finalCoords = rings.map((ring: any) => ring.map((p: any) => [p[0], p[1]]));
                 isMulti = true;
            }
        }

        if (!isMulti) {
            const unionPoly = result as Feature<Polygon>;
            finalCoords = fromTurfPolygon(unionPoly);
        }

        const center = turf.centerOfMass(result).geometry.coordinates as [number, number];

        return {
            coordinates: finalCoords, 
            center: center
        };

    } catch (e: any) {
        console.error("Error merging geometries:", e);
        return null;
    }
};

/**
 * SPLIT LOT
 * Splits a lot using a cut line defined by 2 points.
 * Returns 2 new geometries.
 */
export const splitLotGeometry = (lot: Lot, lineStart: {x: number, y: number}, lineEnd: {x: number, y: number}): { 
    poly1: { coordinates: [number, number][], center: [number, number] },
    poly2: { coordinates: [number, number][], center: [number, number] }
} | null => {
    try {
        console.log("✂️ splitLotGeometry called", { lotId: lot.id, p1: lineStart, p2: lineEnd });
        
        // Check for MultiPolygon Input
        if (Array.isArray(lot.coordinates[0][0])) {
            console.warn("⚠️ Splitting MultiPolygon is not yet supported.");
            alert("Ainda não é possível dividir lotes multi-partes (unificados).");
            return null;
        }

        const poly = toTurfPolygon(lot.coordinates as [number, number][]) as Feature<Polygon>;
        if (!poly) {
            console.error("❌ Failed to convert to Turf Polygon");
            return null;
        }

        // 1. Define the Cut Line (P1 -> P2)
        // Extrapolate to ensure it covers the whole bounds
        const angle = Math.atan2(lineEnd.y - lineStart.y, lineEnd.x - lineStart.x);
        const hugeDist = 10000; 
        
        // P_Start and P_End of the "Infinite" Cut Line
        const p1 = {
            x: lineStart.x - Math.cos(angle) * hugeDist,
            y: lineStart.y - Math.sin(angle) * hugeDist
        };
        const p2 = {
            x: lineEnd.x + Math.cos(angle) * hugeDist,
            y: lineEnd.y + Math.sin(angle) * hugeDist
        };

        // 2. Create Two "Half-World" Polygons
        // Calculate perpendicular vector for "width" of the half-planes
        const perpAngle = angle + Math.PI / 2;
        
        // Points for "Left" side polygon
        const p1_Left = {
            x: p1.x + Math.cos(perpAngle) * hugeDist,
            y: p1.y + Math.sin(perpAngle) * hugeDist
        };
        const p2_Left = {
            x: p2.x + Math.cos(perpAngle) * hugeDist,
            y: p2.y + Math.sin(perpAngle) * hugeDist
        };

        // Points for "Right" side polygon (opposite direction)
        const p1_Right = {
            x: p1.x - Math.cos(perpAngle) * hugeDist,
            y: p1.y - Math.sin(perpAngle) * hugeDist
        };
        const p2_Right = {
            x: p2.x - Math.cos(perpAngle) * hugeDist,
            y: p2.y - Math.sin(perpAngle) * hugeDist
        };

        // Construct Turf Polygons for the masks
        // Note: Turf coords are [x,y]. loop must be closed.
        const leftMask = turf.polygon([[
            [p1.x, p1.y],
            [p2.x, p2.y],
            [p2_Left.x, p2_Left.y],
            [p1_Left.x, p1_Left.y],
            [p1.x, p1.y]
        ]]);

        const rightMask = turf.polygon([[
            [p1.x, p1.y],
            [p2.x, p2.y],
            [p2_Right.x, p2_Right.y],
            [p1_Right.x, p1_Right.y],
            [p1.x, p1.y]
        ]]);

        console.log("🎭 Masks Created");

        // 3. Intersect
        const split1 = turf.intersect(turf.featureCollection([poly, leftMask]));
        const split2 = turf.intersect(turf.featureCollection([poly, rightMask]));

        console.log("⚔️ Intersect Results:", { split1, split2 });

        if (!split1 || !split2) {
             console.warn("⚠️ Split failed: Line might not cross polygon or one side is empty.");
             return null;
        }

        // 4. Convert back to our format
        const res1 = split1 as Feature<Polygon>;
        const res2 = split2 as Feature<Polygon>;
        
        console.log("✅ Split Successful");

        return {
            poly1: {
                coordinates: fromTurfPolygon(res1),
                center: turf.centerOfMass(res1).geometry.coordinates as [number, number]
            },
            poly2: {
                coordinates: fromTurfPolygon(res2),
                center: turf.centerOfMass(res2).geometry.coordinates as [number, number]
            }
        };

    } catch (e) {
        console.error("❌ Error splitting:", e);
        return null;
    }
};


