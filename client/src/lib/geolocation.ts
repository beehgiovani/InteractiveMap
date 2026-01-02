import calibrationConfig from "@/config/gpsCalibration.json";

// Control Points: [SVG_X, SVG_Y, LAT, LNG]
// Calibration points are loaded from config file (part of project)

export interface CalibrationPoint {
    svg: { x: number, y: number };
    geo: { lat: number, lng: number };
}

const DEFAULT_CONTROL_POINTS: CalibrationPoint[] = [
    // Point 1 (Ex: Top Left Corner)
    { svg: { x: 100, y: 100 }, geo: { lat: -23.950000, lng: -46.300000 } },
    // Point 2 (Ex: Top Right Corner)
    { svg: { x: 900, y: 100 }, geo: { lat: -23.950000, lng: -46.200000 } },
    // Point 3 (Ex: Bottom Left Corner)
    { svg: { x: 100, y: 700 }, geo: { lat: -23.990000, lng: -46.300000 } }
];

// Cache for loaded calibration points
let cachedCalibrationPoints: CalibrationPoint[] | null = null;

function getControlPoints(): CalibrationPoint[] {
    // Return cached points if available
    if (cachedCalibrationPoints) {
        return cachedCalibrationPoints;
    }
    
    // Try config file first (project configuration)
    if (calibrationConfig.points && calibrationConfig.points.length === 3) {
        cachedCalibrationPoints = calibrationConfig.points as CalibrationPoint[];
        // console.log("✓ Calibração GPS carregada da configuração do projeto");
        return cachedCalibrationPoints;
    }
    
    // Fallback to localStorage (for testing/calibration)
    const saved = localStorage.getItem("gps_calibration_points");
    if (saved) {
        try {
            const points = JSON.parse(saved);
            cachedCalibrationPoints = points;
            console.log("✓ Calibração GPS carregada do localStorage");
            return points;
        } catch {
            console.warn("Failed to parse calibration points from localStorage");
        }
    }
    
    console.warn("⚠️ Usando pontos de controle PADRÃO (não calibrados). O mapa pode estar desalinhado.");
    return DEFAULT_CONTROL_POINTS;
}

export function saveCalibrationPoints(points: CalibrationPoint[]) {
    localStorage.setItem("gps_calibration_points", JSON.stringify(points));
    cachedCalibrationPoints = points;
}

/**
 * Export current calibration from localStorage to downloadable JSON
 * This JSON should be saved as src/config/gpsCalibration.json and committed to repo
 */
export function exportCalibrationConfig(): string {
    const points = JSON.parse(localStorage.getItem("gps_calibration_points") || "[]");
    const config = {
        points,
        updatedAt: new Date().toISOString(),
        note: "Este arquivo contém os pontos de calibração GPS para o mapa. Gerado pelo GPSCalibrationModal."
    };
    return JSON.stringify(config, null, 2);
}

export function getCalibrationStatus(): { isCalibrated: boolean, points: CalibrationPoint[] } {
    const saved = localStorage.getItem("gps_calibration_points");
    return {
        isCalibrated: !!saved,
        points: getControlPoints()
    };
}

/**
 * Solves for Affine Transformation Matrix parameters (a, b, c, d, e, f)
 * x' = ax + by + c
 * y' = dx + ey + f
 * 
 * Where (x, y) is SVG and (x', y') is (Lat, Lng)
 * 
 * Note: This assumes the map projection is somewhat linear (Mercator at small scale is fine).
 */
function solveAffineMatrix(points: CalibrationPoint[]) {
    // We need to solve 2 systems of linear equations:
    // 1. For Latitude: Lat = a*x + b*y + c
    // 2. For Longitude: Lng = d*x + e*y + f
    
    // Using Cramer's rule or simple elimination for 3 points is sufficient.
    const p1 = points[0];
    const p2 = points[1];
    const p3 = points[2];

    const D = p1.svg.x * (p2.svg.y - p3.svg.y) + p2.svg.x * (p3.svg.y - p1.svg.y) + p3.svg.x * (p1.svg.y - p2.svg.y);

    if (D === 0) {
        console.warn("Geolocation Error: collinear control points. Navigation will be inaccurate.");
        return null;
    }

    // Solve for Lat (a, b, c)
    const a = (p1.geo.lat * (p2.svg.y - p3.svg.y) + p2.geo.lat * (p3.svg.y - p1.svg.y) + p3.geo.lat * (p1.svg.y - p2.svg.y)) / D;
    const b = (p1.geo.lat * (p3.svg.x - p2.svg.x) + p2.geo.lat * (p1.svg.x - p3.svg.x) + p3.geo.lat * (p2.svg.x - p1.svg.x)) / D;
    const c = p1.geo.lat - a * p1.svg.x - b * p1.svg.y;

    // Solve for Lng (d, e, f)
    const d = (p1.geo.lng * (p2.svg.y - p3.svg.y) + p2.geo.lng * (p3.svg.y - p1.svg.y) + p3.geo.lng * (p1.svg.y - p2.svg.y)) / D;
    const e = (p1.geo.lng * (p3.svg.x - p2.svg.x) + p2.geo.lng * (p1.svg.x - p3.svg.x) + p3.geo.lng * (p2.svg.x - p1.svg.x)) / D;
    const f = p1.geo.lng - d * p1.svg.x - e * p1.svg.y;

    if ([a, b, c, d, e, f].some(v => isNaN(v))) {
        console.error("Matrix solution resulted in NaN parameters", {a,b,c,d,e,f, D, points});
        return null;
    }

    return { a, b, c, d, e, f };
}



export function svgToGeo(x: number, y: number): { lat: number, lng: number } | null {
    if (isNaN(x) || isNaN(y)) return null;
    
    const matrix = solveAffineMatrix(getControlPoints());
    if (!matrix) return null;
    
    const lat = matrix.a * x + matrix.b * y + matrix.c;
    const lng = matrix.d * x + matrix.e * y + matrix.f;
    
    if (isNaN(lat) || isNaN(lng)) return null;

    return { lat, lng };
}

export function geoToSvg(lat: number, lng: number): { x: number, y: number } | null {
    const matrix = solveAffineMatrix(getControlPoints());
    if (!matrix) return null;

    const { a, b, c, d, e, f } = matrix;
    
    // Inverse Matrix Math
    // [Lat - c]   [a b] [x]
    // [Lng - f] = [d e] [y]
    
    const det = a * e - b * d;
    if (Math.abs(det) < 1e-10) {
        console.warn("Matrix not invertible");
        return null;
    }

    const dx = lat - c;
    const dy = lng - f;

    // x = (1/det) * (e*dx - b*dy)
    // y = (1/det) * (-d*dx + a*dy)

    const x = (e * dx - b * dy) / det;
    const y = (-d * dx + a * dy) / det;

    return { x, y };
}

export function openNavigation(x: number, y: number) {
    const coords = svgToGeo(x, y);
    if (!coords) {
        alert("Erro na calibração do mapa. Coordenadas não disponíveis.");
        return;
    }
    // Universal Maps URL (works on Android/iOS/Web)
    const url = `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;
    window.open(url, '_blank');
}
