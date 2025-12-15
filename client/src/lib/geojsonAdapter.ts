import { MapData, Quadra, Lot, LotInfo } from "@/types";

interface GeoJSONFeature {
    type: "Feature";
    geometry: {
        type: "Polygon" | "Point";
        coordinates: any[];
    };
    properties: {
        quadra?: number | string;
        lote?: number | string;
        tipo?: string;
        [key: string]: any;
    };
}

interface GeoJSON {
    type: "FeatureCollection";
    features: GeoJSONFeature[];
}

// Helper to calculate centroid
// Helper to calculate centroid
function getPolygonCenter(points: [number, number][]): [number, number] {
    if (!points || points.length === 0) return [0, 0];
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    for (const p of points) {
        // Validate numbers
        if (typeof p[0] !== 'number' || isNaN(p[0])) continue;
        if (typeof p[1] !== 'number' || isNaN(p[1])) continue;

        if (p[0] < minX) minX = p[0];
        if (p[0] > maxX) maxX = p[0];
        if (p[1] < minY) minY = p[1];
        if (p[1] > maxY) maxY = p[1];
    }
    
    // Check if we found valid bounds
    if (minX === Infinity || maxX === -Infinity || minY === Infinity || maxY === -Infinity) {
        return [0, 0];
    }

    return [(minX + maxX) / 2, (minY + maxY) / 2];
}

export function parseGeoJSONToMapData(geojson: any): MapData {
    const data = geojson as GeoJSON;
    const quadrasMap = new Map<string, Quadra>();

    data.features.forEach((feature, index) => {
        if (!feature.properties.quadra) return;

        const quadraId = String(feature.properties.quadra);
        const loteId = feature.properties.lote ? String(feature.properties.lote) : `unknown-${index}`;
        const uniqueId = `${quadraId}-${loteId}`;

        // Ensure Quadra exists
        if (!quadrasMap.has(quadraId)) {
            quadrasMap.set(quadraId, {
                id: quadraId,
                name: `Quadra ${quadraId}`,
                lots: []
            });
        }

        const quadra = quadrasMap.get(quadraId)!;

        let coordinates: [number, number][] = [];

        if (feature.geometry.type === "Polygon") {
            const rawCoords = feature.geometry.coordinates[0] as number[][];
            coordinates = rawCoords.map(p => [p[0], p[1]]);
        } else if (feature.geometry.type === "Point") {
            const [x, y] = feature.geometry.coordinates as number[];
            const size = 5; 
            coordinates = [
                [x - size, y - size],
                [x + size, y - size],
                [x + size, y + size],
                [x - size, y + size]
            ];
        }

        const center = getPolygonCenter(coordinates);

        const lot: Lot = {
            id: uniqueId,
            quadra: quadraId,
            lote: loteId,
            coordinates: coordinates,
            center: center,
            info: {
                ...feature.properties,
                id: uniqueId,
                quadra: quadraId,
                lote: loteId,
                notes: (feature.properties.tipo as string) || "",
                createdAt: new Date(),
                updatedAt: new Date()
            }
        };

        quadra.lots.push(lot);
    });

    // Calculate center for Quadras based on their lots
    const quadras = Array.from(quadrasMap.values()).sort((a, b) => {
        const na = parseInt(a.id) || 0;
        const nb = parseInt(b.id) || 0;
        return na - nb;
    });

    quadras.forEach(q => {
        if (q.lots.length > 0) {
            // Simple centroid of all lot centers
            let sumX = 0, sumY = 0;
            q.lots.forEach(l => {
                if (l.center) {
                    if (Array.isArray(l.center)) {
                        sumX += l.center[0];
                        sumY += l.center[1];
                    } else {
                        sumX += l.center.x;
                        sumY += l.center.y;
                    }
                }
            });
            q.center = [sumX / q.lots.length, sumY / q.lots.length];
        } else {
            q.center = [0, 0];
        }
    });

    return { quadras };
}
