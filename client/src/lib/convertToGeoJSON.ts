/**
 * Script to convert SVG coordinates to GPS coordinates
 * Run once to generate GeoJSON data for Leaflet
 */

import { svgToGeo } from './geolocation';

// This would be run against your actual lot data
// For demonstration, here's the structure:

export function convertLotsToGeoJSON(lots: any[]) {
  console.log(`🔄 Converting ${lots.length} lots to GeoJSON...`);
  
  const features = lots.map(lot => {
    // Safe bounds for Guarujá/Acapulco to prevent "World Spanning" errors
    // Lat: ~ -23.95 +/- 0.1
    // Lng: ~ -46.19 +/- 0.1
    const MIN_LAT = -24.1, MAX_LAT = -23.8;
    const MIN_LNG = -46.4, MAX_LNG = -46.0;

    let coordinates: any[] = [];
    let type = 'Polygon';

    // Check if it's a MultiPolygon (array of array of arrays) vs Polygon (array of arrays)
    // Existing logic assumed Polygon (Array of [x,y])
    // The previous code: lot.coordinates.map(([x, y]) => ...) expects Polygon.
    // If it's a MultiPolygon, lot.coordinates is [[[x,y],[x,y]], [[x,y]...]]
    
    // Helper to process a ring of points
    const processRing = (ring: any[]) => {
        return ring.map((pt: any) => {
            // Support both [x,y] and {x,y} formats slightly
            const x = Array.isArray(pt) ? pt[0] : pt.x;
            const y = Array.isArray(pt) ? pt[1] : pt.y;

            if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) return null;
            
            const gps = svgToGeo(x, y);
            if (!gps || isNaN(gps.lat) || isNaN(gps.lng)) return null;

            // Bounding Box Check
            if (gps.lat < MIN_LAT || gps.lat > MAX_LAT || gps.lng < MIN_LNG || gps.lng > MAX_LNG) {
                // console.warn(`⚠️ Point out of bounds for lot ${lot.id}:`, gps);
                return null;
            }

            return [gps.lng, gps.lat];
        }).filter((c: any) => c !== null);
    };

    if (lot.coordinates && lot.coordinates.length > 0) {
        // Heuristic: Check depth
        const isMulti = Array.isArray(lot.coordinates[0][0]);
        
        if (isMulti) {
            type = 'MultiPolygon';
            // MultiPolygon: [ [ [x,y], [x,y] ], [ [x,y]... ] ]
            // GeoJSON MultiPolygon: [ [ [lng,lat]... ], [ [lng,lat]... ] ]
            coordinates = lot.coordinates.map((poly: any[]) => {
                const ring = processRing(poly);
                return ring.length > 2 ? [ring] : null; // GeoJSON Polygons need at least 1 ring, usually wrapped in array
            }).filter(Boolean);
        } else {
            type = 'Polygon';
            // Polygon: [ [x,y], [x,y] ]
            // GeoJSON Polygon: [ [ [lng,lat], [lng,lat]... ] ] (Array of Rings)
            const ring = processRing(lot.coordinates);
            if (ring.length > 2) {
                coordinates = [ring];
            }
        }
    }

    if (!coordinates || coordinates.length === 0) {
      console.warn(`❌ Lot ${lot.id} (${lot.quadra}-${lot.lote}) has no valid coordinates!`);
      return null;
    }

    // console.log(`✓ Lot ${lot.id} (${lot.quadra}-${lot.lote}): Converted as ${type}`);

    return {
      type: 'Feature' as const,
      properties: {
        id: lot.id,
        quadra: lot.quadra,
        lote: lot.lote,
        area: lot.area || null,
        status: lot.status || lot.info?.status || null,
        info: lot.info || {}
      },
      geometry: {
        type: type as any,
        coordinates: coordinates
      }
    };
  }).filter(Boolean);

  console.log(`✅ GeoJSON created with ${features.length} features`);
  
  return {
    type: 'FeatureCollection' as const,
    features
  };
}

// Helper to get center of a quadra for labels
export function getQuadraCenter(lots: any[], quadraId: string) {
  const quadraLots = lots.filter(lot => lot.quadra === quadraId);
  
  let sumLat = 0, sumLng = 0, count = 0;
  
  quadraLots.forEach(lot => {
    lot.coordinates.forEach(([x, y]: [number, number]) => {
      const gps = svgToGeo(x, y);
      if (gps) {
        sumLat += gps.lat;
        sumLng += gps.lng;
        count++;
      }
    });
  });
  
  if (count === 0) return null;
  
  return {
    lat: sumLat / count,
    lng: sumLng / count
  };
}
