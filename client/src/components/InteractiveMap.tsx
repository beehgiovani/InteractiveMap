
import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import { Lot, MapData, LotInfo, Quadra } from "@/types";

import LotHoverTooltip from "./LotHoverTooltip";
import QuadraHoverTooltip from "./QuadraHoverTooltip";
import BulkImportModal from "./BulkImportModal";
import QuickFillModal from "./QuickFillModal";
import { GPSCalibrationModal } from "./GPSCalibrationModal";
import MigrationTool from "./MigrationTool";
import { Maximize, X, Database, Plus, Minus } from "lucide-react"; // Added Plus/Minus icons
import Draggable from 'react-draggable';
import { ExternalLink } from "lucide-react";
import screenCenteringConfig from "@/config/screenCentering.json";
import { exportCalibrationConfig, geoToSvg, svgToGeo } from "@/lib/geolocation";
import { LayerSelector, MapLayer } from "./LayerSelector";
import { MapContainer, TileLayer, GeoJSON, Marker, ImageOverlay, Polyline, CircleMarker, useMapEvents, ZoomControl, useMap } from 'react-leaflet'; // Added ZoomControl import
import L from 'leaflet';
import { convertLotsToGeoJSON } from '@/lib/convertToGeoJSON';
// ... rest of imports

// --- Custom Zoom Controls Component ---
const CustomZoomControls = ({ zoomIn, zoomOut }: { zoomIn: () => void, zoomOut: () => void }) => {
    return (
        <div className="flex flex-col gap-2">
            <button 
                onClick={zoomIn}
                className="w-10 h-10 bg-zinc-950/90 hover:bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-xl flex items-center justify-center text-white hover:text-blue-400 ring-1 ring-white/5 shadow-2xl transition-all active:scale-95 group"
            >
                <Plus size={20} className="group-hover:scale-110 transition-transform" />
            </button>
            <button 
                onClick={zoomOut}
                className="w-10 h-10 bg-zinc-950/90 hover:bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-xl flex items-center justify-center text-white hover:text-red-400 ring-1 ring-white/5 shadow-2xl transition-all active:scale-95 group"
            >
                <Minus size={20} className="group-hover:scale-110 transition-transform" />
            </button>
        </div>
    );
};

import { mergeLotsGeometry, splitLotGeometry } from '@/lib/geometryUtils';
import 'leaflet/dist/leaflet.css';

// Image is 1024x747. We set the bounds to match the image dimensions so it isn't distorted.
const MAP_BOUNDS = {
    minX: 0,
    minY: 0,
    maxX: 1024,
    maxY: 747,
    width: 1024,
    height: 747
};

interface InteractiveMapProps {
  onLotClick: (lot: Lot, shouldEdit?: boolean) => void;
  selectedLotId?: string | null;
  manualLots: Lot[];
  setManualLots: React.Dispatch<React.SetStateAction<Lot[]>>;
  lotsData: Map<string, any>;
  onBatchUpdate?: (newLots: Lot[], newLotsData: Map<string, LotInfo>, changedIds?: string[]) => void;
  onDeleteIds?: (deletedIds: string[]) => void;
  onExportBackup?: () => void; // New Prop
  onCloudSync?: () => void;    // New Prop
  isMobile?: boolean;          // New Prop for Mobile Adjustments
  highlightedLots?: Lot[];     // New Prop for Smart Calculator
  // History Props
  undo?: () => void;
  redo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}



// Memoized Lot Component for Performance
const LotPolygon = React.memo(({ 
    lot, 
    isManual, 
    isSelected, 
    isHovered, 
    isDeleteMode, 
    isQuadraHighlighted,
    isHighlighted, // New Prop
    isSplitTarget, // New Prop for Split Tool
    isDevMode,
    onClick,
    onMouseEnter,
    onMouseLeave,
    onContextMenu, 
    lotsData,
    fillColor: propsFillColor,
    fillOpacityOverride
}: {
    lot: Lot;
    isManual: boolean;
    isSelected: boolean;
    isHovered: boolean;
    isDeleteMode: boolean;
    isQuadraHighlighted: boolean;
    isHighlighted?: boolean; // New Prop
    isSplitTarget?: boolean; // New Prop
    isDevMode: boolean;
    onClick: (e: React.MouseEvent, lot: Lot) => void;
    onMouseEnter: (id: string, e: React.MouseEvent) => void;
    onMouseLeave: () => void;
    onContextMenu: (e: React.MouseEvent, lot: Lot) => void;
    lotsData: Map<string, any>;
    fillColor?: string;
    fillOpacityOverride?: number;
}) => {
    let fillColor = propsFillColor || "transparent";
    let strokeColor = "transparent";
    let strokeWidth = isSelected ? "1.2" : "0.3"; // Thinner default

    const isMultiPolygon = lot.coordinates.length > 0 && Array.isArray(lot.coordinates[0][0]);
    const isPointLot = !isMultiPolygon && lot.coordinates.length === 4 && Math.abs((lot.coordinates as [number, number][])[0][0] - (lot.coordinates as [number, number][])[1][0]) <= 10;

    // Check owner status
    const lotInfo = lotsData.get(lot.info.id);
    const hasOwner = lotInfo?.owner && lotInfo.owner.trim().length > 0;

    if (isManual) {
        if (propsFillColor) {
             fillColor = propsFillColor;
             strokeColor = propsFillColor;
             strokeWidth = "0.5";
        } else if (hasOwner) {
        // Owner-based Coloring (Always Visible)
             fillColor = "rgba(239, 68, 68, 0.4)"; // Red for Occupied
             strokeColor = "rgba(239, 68, 68, 0.6)"; // More subtle stroke
             strokeWidth = "0.5";
        } else {
             fillColor = "rgba(34, 197, 94, 0.4)"; // Green for Free
             strokeColor = "rgba(34, 197, 94, 0.6)"; // More subtle stroke
             strokeWidth = "0.5";
        }
    }

    if (isDeleteMode && isHovered) {
        fillColor = "rgba(255, 0, 0, 0.6)"; 
        strokeColor = "red";
    } else if (isDeleteMode && isQuadraHighlighted) {
         fillColor = "rgba(255, 0, 0, 0.3)"; 
         strokeColor = "red";
    } else if (isSplitTarget) {
         // SPLIT MODE HIGHLIGHT - Red Dashed or Solid
         fillColor = "rgba(239, 68, 68, 0.2)"; 
         strokeColor = "red";
         strokeWidth = "1.5";
    } else if (isHighlighted) {
         // Highlighted (Smart Calc) - Purple
         fillColor = "rgba(168, 85, 247, 0.6)"; 
         strokeColor = "#9333ea";
         strokeWidth = "1.5";
    } else if (isSelected) {
        fillColor = "rgba(59, 130, 246, 0.5)";  // Blue 500
        strokeColor = "#60a5fa"; // Blue 400 (Lighter, elegant border)
        strokeWidth = "1.2";
    } else if (isHovered && !isDeleteMode) {
         // Lighten hover effect on top of base color
         strokeColor = "rgba(255, 255, 255, 0.6)";
         strokeWidth = "1";
    } else if (!isManual) {
         strokeColor = "rgba(0,0,0,0.15)"; 
         strokeWidth = "0.3";
         if (isPointLot) {
             fillColor = "rgba(0, 255, 0, 0.3)";
             strokeColor = "green";
         }
    }

    const pathData = useMemo(() => {
        const coords = lot.coordinates;
        if (!coords || coords.length === 0) return "";
        
        if (Array.isArray(coords[0][0])) {
             // MultiPolygon: coordinates is [[x,y][], [x,y][]]
             return (coords as [number, number][][]).map(ring => 
                 "M" + ring.map(p => p.join(",")).join(" ") + "Z"
             ).join(" ");
        } else {
             // Polygon: coordinates is [x,y][]
             return "M" + (coords as [number, number][]).map(p => p.join(",")).join(" ") + "Z";
        }
    }, [lot.coordinates]);

    return (
      <g
        onClick={(e) => onClick(e, lot)}
        onMouseEnter={(e) => onMouseEnter(lot.id, e)}
        onMouseLeave={onMouseLeave}
        onContextMenu={(e) => onContextMenu(e, lot)}
        className={!isDevMode || isDeleteMode || isSplitTarget ? "cursor-pointer" : ""}
      >
        <path
          d={pathData}
          fill={fillColor}
          fillOpacity={propsFillColor ? (fillOpacityOverride ?? 0.4) : undefined}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={isSplitTarget ? "5,5" : "none"} // Dashed line for split target
        />
      </g>
    );
}, (prev, next) => {
    // Custom comparison function for React.memo
    return (
        prev.lot.id === next.lot.id &&
        prev.isManual === next.isManual &&
        prev.isSelected === next.isSelected &&
        prev.isHovered === next.isHovered &&
        prev.isDeleteMode === next.isDeleteMode &&
        prev.isQuadraHighlighted === next.isQuadraHighlighted &&
        prev.isHighlighted === next.isHighlighted &&
        prev.isSplitTarget === next.isSplitTarget && // Check new prop
        prev.isDevMode === next.isDevMode &&
        prev.fillColor === next.fillColor &&
        prev.fillOpacityOverride === next.fillOpacityOverride
    );
});

const InteractiveMap: React.FC<InteractiveMapProps> = ({
  onLotClick,
  selectedLotId,
  manualLots,
  setManualLots,
  lotsData,
  onBatchUpdate,
  onDeleteIds,
  onExportBackup,
  onCloudSync,
  isMobile = false,
  highlightedLots = [],
  undo,
  redo,
  canUndo,
  canRedo
}) => {

  const [scale, setScale] = useState(1);
  const [viewState, setViewState] = useState({ x: 0, y: 0, scale: 1 });
  
  
  // Tooltip & Zoom States
  const [tooltipLot, setTooltipLot] = useState<Lot | null>(null);
  
  // Topology Editing Ref (Shared Vertices)
  const linkedVerticesRef = useRef<{lotId: string, vertexIndex: number}[]>([]);
  const [tooltipPosition, setTooltipPosition] = useState<{x: number, y: number}>({x: 0, y: 0});
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipCloseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const quadraHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [hoveredLotId, setHoveredLotId] = useState<string | null>(null);
  const [hoveredQuadraLabel, setHoveredQuadraLabel] = useState<string | null>(null); // Immediate Hover for Lots/Label
  
  const [activeQuadraId, setActiveQuadraId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<ReactZoomPanPinchRef>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const isDragging = useRef(false); // Ref for immediate state
  const dragStartRef = useRef<{x: number, y: number} | null>(null); // Ref for precise distance check
  const quadraTooltipRef = useRef<HTMLDivElement>(null); // Ref for Draggable Quadra Tooltip

  // --- EDITOR MODE STATES ---
  const [isDevMode, setIsDevMode] = useState(false); // Default to TRUE for Map Redesign Phase
  const [showImportModal, setShowImportModal] = useState(false);
  const [showQuickFill, setShowQuickFill] = useState(false);
  const [quickFillQuadra, setQuickFillQuadra] = useState<string | null>(null); // State for auto-opening QuickFill
  // Migration
  const [showMigration, setShowMigration] = useState(false);
  const [activeLayer, setActiveLayer] = useState<MapLayer>('custom');
  const [lotOpacity, setLotOpacity] = useState(0.4); // Opacity for lots in satellite/OSM
  const [showGPSCalibration, setShowGPSCalibration] = useState(false);
  const [gpsCalibrationHandler, setGPSCalibrationHandler] = useState<((x: number, y: number) => void) | null>(null);
  const [showMobileDevTools, setShowMobileDevTools] = useState(false); // Mobile drawer state
  // Default to 'draw-lot' or 'move' as user prefers. Let's start with 'move' but enable DevMode basics.
  const [editorMode, setEditorMode] = useState<'move' | 'create-grid' | 'draw-lot' | 'delete' | 'edit-vertex' | 'edit-info' | 'merge' | 'split'>('move');
  
  // --- AUTO-CENTERING LOGIC ---
  const centerOnPoint = (x: number, y: number, targetScale: number = 4) => {
      if (!wrapperRef.current) return;
      
      const { instance } = wrapperRef.current;
      const { wrapperComponent } = instance;
      
      if (!wrapperComponent) return;
      
      const wrapperWidth = wrapperComponent.offsetWidth;
      const wrapperHeight = wrapperComponent.offsetHeight;
      
      // Calculate new position to center the point
      // x, y are in SVG coordinates (0-1024, 0-747)
      // transformX = (wrapperWidth / 2) - (x * scale)
      const newX = (wrapperWidth / 2) - (x * targetScale);
      const newY = (wrapperHeight / 2) - (y * targetScale);
      
      wrapperRef.current.setTransform(newX, newY, targetScale, 1000, "easeOutCubic");
  };

  // Center on Selected Lot
  useEffect(() => {
     if (selectedLotId && mapDataComplete) {
         // Find the lot's center
         // We can use lotsData to find the lot or just look in manualLots
         const lot = manualLots.find(l => l.id === selectedLotId);
         if (lot) {
             // Find center from mapDataComplete which calculates it nicely
             let center: [number, number] | null = null;
             
             // Search in quadras
             for (const quadra of mapDataComplete.quadras) {
                 const found = quadra.lots.find(l => l.id === selectedLotId);
                 if (found) {
                     // The lot in mapDataComplete doesn't store computed center directly on the lot object usually?
                     // Wait, `mapDataComplete` structure in code above:
                     // return { quadras: [ ... { lots: [...], center: [...] } ] }
                     // The `lots` inside `quadra` are just the lots.
                     // We need to re-calculate or cache the center on the lot itself?
                     // Actually `LotPolygon` uses `lot.center` if available or calculates it.
                     // Let's re-calculate quickly for reliability.
                     
                     if (lot.center && typeof lot.center === 'object') {
                         // @ts-ignore
                         center = Array.isArray(lot.center) ? lot.center : [lot.center.x, lot.center.y];
                     } else {
                        // Calculate from coordinates
                         if (lot.coordinates.length > 0) {
                             const coords = (lot.coordinates.length > 0 && Array.isArray(lot.coordinates[0][0])) 
                                 ? lot.coordinates.flat() as [number, number][] 
                                 : lot.coordinates as [number, number][];
                             
                             const xs = coords.map(c => Number(c[0]));
                             const ys = coords.map(c => Number(c[1]));
                             center = [(Math.min(...xs) + Math.max(...xs))/2, (Math.min(...ys) + Math.max(...ys))/2];
                         }
                     }
                     break;
                 }
             }

             if (center) {
                 console.log(`Centering on Lot ${lot.lote} at`, center);
                 // Delay centering to allow sidebar/UI to resize map container
                 setTimeout(() => {
                     centerOnPoint(Number(center![0]), Number(center![1]), 5); 
                 }, 200);
             }
         }
     }
  }, [selectedLotId, manualLots]);


  // Optimization: Pre-calculate Highlighted IDs
  const highlightedLotIds = useMemo(() => new Set(highlightedLots.map(l => l.id)), [highlightedLots]);

  // MERGE DATA: Combine Manual Geometry with Fresh Supabase/Realtime Info
  // This ensures status colors update immediately without waiting for parent state propagation
  const mergedLots = useMemo(() => {
      return manualLots.map(lot => {
          const freshInfo = lotsData.get(lot.id);
          // Only merge if we have fresh info, otherwise use what we have (or defaults)
          if (freshInfo) {
              return { ...lot, info: freshInfo };
          }
          return lot;
      });
  }, [manualLots, lotsData]);
  
  // Track lot status version for GeoJSON updates
  const geoJsonVersion = useMemo(() => {
      return mergedLots.map(l => (l.info?.status || 'n') + (l.info?.isAvailable ? '1' : '0')).join('');
  }, [mergedLots]);
  
  // Split State
  const [splitTargetLotId, setSplitTargetLotId] = useState<string | null>(null);
  const [splitLinePoints, setSplitLinePoints] = useState<{x: number, y: number}[]>([]);
  
  // Drag State
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedLotsForMerge, setSelectedLotsForMerge] = useState<string[]>([]); // New state for merge selection
  const [draggedQuadraId, setDraggedQuadraId] = useState<string | null>(null);
  const [ghostQuadraId, setGhostQuadraId] = useState<string | null>(null); // Single Ghost Label
  const [minimizedQuadraLabels, setMinimizedQuadraLabels] = useState<Set<string>>(new Set()); // Ghost Mode (Deprecated/Replaced by ghostQuadraId but keeping if needed for transition? No, plan said replace.)
  // Actually, I should have removed `minimizedQuadraLabels` earlier if I replaced it. 
  // But wait, the previous tool call FAILED to apply the `ghostQuadraId` state change?
  // Let me check line 226 in previous view.
  // View showed: `const [ghostQuadraId, setGhostQuadraId] = useState<string | null>(null);` (Line 226 in successful previous patch, Step 156 applied STATE, but stuck on chunks 2?).
  // Step 156 showed chunk 0 (state change replacement) applied!
  // So `minimizedQuadraLabels` is gone. `ghostQuadraId` is there.
  
  const [isCalibrationCollapsed, setIsCalibrationCollapsed] = useState(true); // New State
  
  // Custom Calibration State
  const [centeringOffset, setCenteringOffset] = useState<{x: number, y: number}>(() => {
      // Try config file first (project configuration)
      if (screenCenteringConfig.offset && 
          screenCenteringConfig.offset.x !== 0 && 
          screenCenteringConfig.offset.y !== 0) {
          console.log("✓ Centralização carregada da configuração do projeto");
          return screenCenteringConfig.offset;
      }
      
      // Fallback to localStorage (for testing/calibration)
      const saved = localStorage.getItem("map_centering_offset");
      if (saved) {
          return JSON.parse(saved);
      }
      
      // Default values
      return { x: -1000, y: -900 }; 
  });

  const updateCenteringOffset = (newOffset: {x: number, y: number}) => {
      setCenteringOffset(newOffset);
      localStorage.setItem("map_centering_offset", JSON.stringify(newOffset));
  };

  const labelHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Export current centering offset from localStorage to downloadable JSON
   * This JSON should be saved as src/config/screenCentering.json and committed to repo
   */
  const exportCenteringConfig = () => {
      const config = {
          offset: centeringOffset,
          updatedAt: new Date().toISOString(),
          note: "Screen centering offset for map display. Generated from Dev Mode."
      };
      
      const configJson = JSON.stringify(config, null, 2);
      
      // Create download
      const blob = new Blob([configJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'screenCentering.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      alert('✅ Configuração exportada! Salve em: client/src/config/screenCentering.json');
  };

  // Manual Creation State - REMOVED LOCAL STATE
  
  const [currentPoints, setCurrentPoints] = useState<{x: number, y: number}[]>([]);
  // Index of a point being dragged in draw‑lot mode (null when not dragging)
  const [draggingPointIndex, setDraggingPointIndex] = useState<number | null>(null);
  // Smart Creation State
  const [activeQuadra, setActiveQuadra] = useState("1");
  const [nextLotNumber, setNextLotNumber] = useState("1");
  const [snapPoint, setSnapPoint] = useState<{x: number, y: number} | null>(null);
  // Mouse position for arrow preview in draw-lot mode
  const [mousePos, setMousePos] = useState<{x: number, y: number} | null>(null);


  // Grid Creator State
  const [gridPoints, setGridPoints] = useState<{x: number, y: number}[]>([]); 
  const [showQuadraConfig, setShowQuadraConfig] = useState(false);
  const [deleteModeType, setDeleteModeType] = useState<'lot' | 'quadra'>('lot');
  const [quadraConfig, setQuadraConfig] = useState({ 
      id: '', 
      columns: [] as { start: number, end: number }[] 
  });
  const [gridPreviewLots, setGridPreviewLots] = useState<Lot[]>([]);


  // Vertex Editing State
  const [selectedLotForEditing, setSelectedLotForEditing] = useState<string | null>(null);
  const [editingVertexIndex, setEditingVertexIndex] = useState<number | null>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, link: string } | null>(null);

  const handleLotContextMenu = useCallback((e: React.MouseEvent, lot: Lot) => {
      e.preventDefault();
      // Check if lot has a website link
      if (lot.info && lot.info.website && lot.info.website.trim() !== "") {
          setContextMenu({
              x: e.clientX,
              y: e.clientY,
              link: lot.info.website
          });
      } else {
          // Optional: Close if right clicking elsewhere? 
          // Or just do nothing?
          // If we want standard context menu on empty lots, we do nothing.
      }
  }, []);

  // Auto-close Context Menu after 3 seconds
  useEffect(() => {
    if (contextMenu) {
      const timer = setTimeout(() => {
        setContextMenu(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [contextMenu]);

  // REMOVED LOCALSTORAGE EFFECT (Handled in Parent)

  // Derived MapData from manualLots for rendering compatibility
  const mapDataComplete: MapData = useMemo(() => {
      // 1. Agrupar lotes por Quadra
      const quadrasMap = new Map<string, Lot[]>();
      manualLots.forEach(lot => {
          if (!quadrasMap.has(lot.quadra)) {
              quadrasMap.set(lot.quadra, []);
          }
          quadrasMap.get(lot.quadra)?.push(lot);
      });

      // 2. Calcular o CENTRO DA QUADRA (Blindado contra Strings)
      return {
          quadras: Array.from(quadrasMap.entries()).map(([id, lots]) => {
              let totalX = 0;
              let totalY = 0;
              let validCount = 0;

              lots.forEach(l => {
                  let lx = 0, ly = 0;
                  let hasCoordinate = false;

                  // Prioridade 1: Tenta usar o center salvo
                  if (l.center) {
                      if (Array.isArray(l.center)) {
                          lx = Number(l.center[0]); // <--- Força Número
                          ly = Number(l.center[1]); // <--- Força Número
                          hasCoordinate = true;
                      } else if (typeof l.center === 'object') {
                          // @ts-ignore
                          lx = Number(l.center.x); // <--- Força Número
                          // @ts-ignore
                          ly = Number(l.center.y); // <--- Força Número
                          hasCoordinate = true;
                      }
                  }

                  // Prioridade 2: Se falhar, CALCULA baseando nos vértices
                  if ((!hasCoordinate || isNaN(lx) || lx === 0) && l.coordinates && l.coordinates.length > 0) {
                      // Handle MultiPolygon (nested arrays) by flattening
                      let flatCoords: [number, number][] = [];
                      if (l.coordinates.length > 0 && Array.isArray(l.coordinates[0][0])) {
                          // @ts-ignore - Flatten MultiPolygon [[[x,y]...]] -> [[x,y]...]
                          flatCoords = l.coordinates.flat();
                      } else {
                          flatCoords = l.coordinates as [number, number][];
                      }

                      // Garante que map devolva números
                      const xs = flatCoords.map(p => Number(p[0]));
                      const ys = flatCoords.map(p => Number(p[1]));
                      
                      const minX = Math.min(...xs);
                      const maxX = Math.max(...xs);
                      const minY = Math.min(...ys);
                      const maxY = Math.max(...ys);

                      lx = (minX + maxX) / 2;
                      ly = (minY + maxY) / 2;
                      hasCoordinate = true;
                  }

                  // Soma para a média (apenas se for válido)
                  if (hasCoordinate && !isNaN(lx) && !isNaN(ly) && lx !== 0 && ly !== 0) {
                      totalX += lx;
                      totalY += ly;
                      validCount++;
                  }
              });

              // Média final
              let finalCenterX = validCount > 0 ? totalX / validCount : 0;
              let finalCenterY = validCount > 0 ? totalY / validCount : 0;

              // FALLBACK: If center is 0,0 (invalid/broken lots), place them in a "Recovery Zone" at top-left
              if (finalCenterX === 0 && finalCenterY === 0 && lots.length > 0) {
                  // Stack them nicely so they don't overlap perfectly
                  const offset = (parseInt(id.replace(/\D/g, '') || '0') % 20) * 20; 
                  finalCenterX = 50; 
                  finalCenterY = 100 + offset;
              }

              // OVERLAP FIX: If only 1 lot (or very few in similar pos), Quadra Label COVERS Lot Label.
              // We removed the offset as per user request to center it.
              
              const isSingle = lots.length === 1;
              const displayName = isSingle ? `Quadra ${id} (Lote ${lots[0].lote})` : `Quadra ${id}`;
              // Short label for the bubble
              const bubbleLabel = isSingle ? `Q${id}-L${lots[0].lote}` : `Q${id}`;

              return {
                  id,
                  name: displayName,
                  bubbleLabel, // New property for rendering
                  lots,
                  center: [finalCenterX, finalCenterY] 
              };
          })
      };
  }, [manualLots]);
  
  // Optimization: Pre-calculate Manual Lot IDs Set for O(1) lookup
  const manualLotIds = useMemo(() => new Set(manualLots.map(l => l.id)), [manualLots]);

  // Optimization: Pre-calculate Hovered Quadra ID for Delete Mode
  const hoveredQuadraId = useMemo(() => {
     if (!hoveredLotId) return null;
     // Only relevant if the hovered lot is manual (since we only delete manual quadras for now)
     // Finding in array is fine here as it runs once per hover change, not per lot render
     return manualLots.find(l => l.id === hoveredLotId)?.quadra || null;
  }, [hoveredLotId, manualLots]);


  // Strickland binding to active Quadra OR Hovered Quadra (Preview Mode)
  const visibleLots = useMemo(() => {
      // Use MERGED lots to ensure caching/filtering checks fresh status
      const sourceLots = mergedLots;
    // DEV MODE: Always show ALL lots
    // if (isDevMode) return manualLots;

    // Show nothing if no Quadra is active AND no Quadra is hovered (via label or lot) AND no highlighted lots
    // Optimization removed: We must always scan for 'Available' lots even if no Quadra is active.
    // if (!activeQuadraId && !hoveredQuadraId && !hoveredQuadraLabel && highlightedLotIds.size === 0) return [];
    
    // Include lots from: active quadra, hovered quadra, OR highlighted by Smart Calculator
    return sourceLots.filter(lot =>
        lot.quadra === activeQuadraId || 
        lot.quadra === hoveredQuadraId ||
        lot.quadra === hoveredQuadraLabel ||
        highlightedLotIds.has(lot.id) ||
        lot.info?.isAvailable === true || // Show "Available" lots (New boolean)
        lot.info?.status === 'disponivel' || // Show "Available" lots (Legacy status)
        lot.info?.status === 'ocupado' // Show "Occupied" lots (Always visible)
    );
  }, [activeQuadraId, hoveredQuadraId, hoveredQuadraLabel, mergedLots, isDevMode, highlightedLotIds]);


  // Update view state/scale on transform
  const onTransform = (ref: any) => {
      setViewState({
          x: ref.state.positionX,
          y: ref.state.positionY,
          scale: ref.state.scale
      });
  };


  // --- DEBUGGING ---

  
  useEffect(() => {
    console.log("InteractiveMap Mounted");
    console.log("Manual Lots Count:", manualLots.length);
  }, []);

  useEffect(() => {
      console.log("Manual Lots Updated:", manualLots.length);
  }, [manualLots]);



  // --- HANDLERS ---

  const getMapCoordinates = (e: React.MouseEvent) => {
      if (!svgRef.current) return { x: 0, y: 0 };
      
      const svg = svgRef.current;
      const point = svg.createSVGPoint();
      
      point.x = e.clientX;
      point.y = e.clientY;
      
      // Calculate coordinates relative to SVG scale/viewBox using the inverse CTM
      const ctm = svg.getScreenCTM();
      if (!ctm) return { x: 0, y: 0 };
      
      const transformedPoint = point.matrixTransform(ctm.inverse());
      
      return { x: transformedPoint.x, y: transformedPoint.y };
  };

  // Helper to find nearest vertex in existing lots
  // Helper to find nearest vertex in existing lots
  // Exclude list: {lotId, vertexIndex}[] to ignore (e.g., the points we are currently moving)
  const findNearestVertex = (
      target: {x: number, y: number}, 
      threshold: number = 10,
      exclude: {lotId: string, vertexIndex: number}[] = []
  ) => {
    let nearest: {x: number, y: number} | null = null;
    let minDist = Infinity;

    manualLots.forEach(lot => {
      // Skip MultiPolygon (snapping to disjoint lots not supported yet)
      if (lot.coordinates.length > 0 && Array.isArray(lot.coordinates[0][0])) return;

      (lot.coordinates as [number, number][]).forEach((coord, idx) => {
        // Exclude check
        if (exclude.some(ex => ex.lotId === lot.id && ex.vertexIndex === idx)) {
            return;
        }

        const dx = coord[0] - target.x;
        const dy = coord[1] - target.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < threshold && dist < minDist) {
          minDist = dist;
          nearest = { x: coord[0], y: coord[1] };
        }
      });
    });
    return nearest;
  };

  // Helper to find the nearest point in the current drawing buffer
  const findNearestCurrentPoint = (target: {x: number, y: number}, threshold: number = 10) => {
    let nearestIdx: number | null = null;
    let minDist = Infinity;
    currentPoints.forEach((pt, idx) => {
      const dx = pt.x - target.x;
      const dy = pt.y - target.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < threshold && dist < minDist) {
        minDist = dist;
        nearestIdx = idx;
      }
    });
    return nearestIdx;
  };



  const handleVertexMouseDown = (e: React.MouseEvent, lotId: string, vertexIndex: number) => {
    if (editorMode !== 'edit-vertex') return;
    e.stopPropagation(); // Prevent map drag
    setSelectedLotForEditing(lotId);
    setEditingVertexIndex(vertexIndex);

    // TOPOLOGY DETECTION: Find all other lots sharing this vertex
    // 1. Get current vertex coords
    const targetLot = manualLots.find(l => l.id === lotId);
    if (!targetLot) {
        linkedVerticesRef.current = [];
        return;
    }

    // Skip MultiPolygon (snapping to disjoint lots not supported yet)
    if (targetLot.coordinates.length > 0 && Array.isArray(targetLot.coordinates[0][0])) return;
    
    const targetCoords = targetLot.coordinates[vertexIndex] as [number, number];
    if (!targetCoords) return;

    const linked: {lotId: string, vertexIndex: number}[] = [];

    // 2. Scan all lots logic
    manualLots.forEach(l => {
        // Skip MultiPolygons (snapping to disjoint lots not supported yet)
        if (l.coordinates.length > 0 && Array.isArray(l.coordinates[0][0])) return;

        (l.coordinates as [number, number][]).forEach((c, idx) => {
             // Exact match check (or very small epsilon)
             const dist = Math.sqrt(Math.pow(c[0] - targetCoords[0], 2) + Math.pow(c[1] - targetCoords[1], 2));
             if (dist < 0.1) { // 10cm tolerance
                 linked.push({ lotId: l.id, vertexIndex: idx });
             }
        });
    });
    
    linkedVerticesRef.current = linked; // Store for Drag
  };

  const handleExecuteSplit = (targetLotId: string, p1: {x: number, y: number}, p2: {x: number, y: number}) => {
      const lot = manualLots.find(l => l.id === targetLotId);
      if (!lot) return;

      const result = splitLotGeometry(lot, p1, p2);
      if (!result) {
          alert("Falha ao dividir lote using geometria atual.");
          setSplitLinePoints([]);
          return;
      }

      // Create 2 New Lots
      const lotA: Lot = {
          ...lot,
          id: lot.id + "_A",
          lote: lot.lote + " A",
          coordinates: result.poly1.coordinates,
          center: result.poly1.center,
          info: {
              ...lot.info,
              id: lot.id + "_A",
              lote: lot.lote + " A",
              aliases: [lot.info.lote + " A"], // Ensure searchable
              notes: `Desmembrado de ${lot.lote}. ` + (lot.info.notes || ""),
              updatedAt: new Date(),
              history: {
                  type: 'split',
                  originId: lot.id,
                  timestamp: new Date()
              }
          }
      };

      const lotB: Lot = {
          ...lot,
          id: lot.id + "_B",
          lote: lot.lote + " B",
          coordinates: result.poly2.coordinates,
          center: result.poly2.center,
          info: {
              ...lot.info,
              id: lot.id + "_B",
              lote: lot.lote + " B",
              aliases: [lot.info.lote + " B"],
              notes: `Desmembrado de ${lot.lote}. ` + (lot.info.notes || ""),
              updatedAt: new Date(),
              history: {
                  type: 'split',
                  originId: lot.id,
                  timestamp: new Date()
              }
          }
      };

      if (!confirm(`Confirmar divisão do Lote ${lot.lote} em 2 partes?`)) {
        setSplitLinePoints([]);
          return;
      }

      // Replace old with new
    const remaining = manualLots.filter(l => l.id !== lot.id);
    const newLotList = [...remaining, lotA, lotB];
    setManualLots(newLotList);
    
    // Auto-Save Split Action
    if (onBatchUpdate) {
        // We need to pass the corresponding LotInfo for the new lots.
        // Since we are inside InteractiveMap, we might not have the full new LotsData map ready to pass if it's managed by parent.
        // However, onBatchUpdate expects (newLots, newLotsData).
        // Parent (Home.tsx) manages `lotsData`. Use `lotsData` from props and add/update entries.
        
        const newLotsData = new Map(lotsData);
        newLotsData.set(lotA.id, lotA.info);
        newLotsData.set(lotB.id, lotB.info);
        
        onBatchUpdate(newLotList, newLotsData, [lotA.id, lotB.id]); 
        
        // Ensure server deletes the original split lot immediately
        if (onDeleteIds) {
            onDeleteIds([lot.id]);
        } 
    }

    setSplitTargetLotId(null);
    setSplitLinePoints([]);
    alert("Lote dividido com sucesso!");
  };


  const handleMapClick = (e: React.MouseEvent) => {
      // DRAG GUARD: Check if it was a drag or a click
      if (dragStartRef.current) {
          const dx = e.clientX - dragStartRef.current.x;
          const dy = e.clientY - dragStartRef.current.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist > 15) return; // Increased threshold to 15px
      }

      // GPS Calibration Mode - Highest Priority
      if (showGPSCalibration && gpsCalibrationHandler) {
          const coords = getMapCoordinates(e);
          gpsCalibrationHandler(coords.x, coords.y);
          return; // Don't process any other click logic
      }

      let coords = getMapCoordinates(e);

      if (!isDevMode) {
          // User Mode: Click to Center
          console.log("Centering on click:", coords);
          centerOnPoint(coords.x, coords.y, 4); // Medium Zoom
          return;
      }
      
      // Apply Snap if available
      if (snapPoint && editorMode === 'draw-lot') {
          coords = snapPoint;
      }

      if (editorMode === 'merge') {
          // Find clicked lot manually since we want to toggle selection
          // Reverse check to find top-most
          const clickedLot = [...manualLots].reverse().find(lot => {
             // Simple point in polygon check using ray casting (or just reuse helper if available)
             // Or better: Use the event target if it was a LotPolygon click.
             // But LotPolygon clicks are handled by onLotClick prop? 
             // InteractiveMap 'onLotClick' prop usually handles this.
             // Let's check InteractiveMap props wiring.
             
             // Actually, `onLotClick` prop is passed to LotPolygon.
             // We should intercept `onLotClick` from props to handle Editor Modes first.
             return false; 
          });
      }
      
      if (editorMode === 'split') {
          console.log("📍 Map Click in Split Mode", { 
              coords, 
              targetId: splitTargetLotId, 
              currentPoints: splitLinePoints.length 
          });

          if (!splitTargetLotId) {
             // User needs to select a lot first (handled in handleLotClick)
             return;
          }
          // If lot selected, draw the cut line
          if (splitLinePoints.length < 2) {
              setSplitLinePoints([...splitLinePoints, coords]);
              
              // If we just added the 2nd point, execute split
              if (splitLinePoints.length === 1) { // 1 + 1 = 2
                  console.log("✂️ Split Line Defined. Waiting for User Confirmation...");
                  // We DON'T auto-execute anymore strictly.
                  // We show the line and maybe a confirmation dialog or just wait a bit?
                  // User asked to "see what is being done".
                  
                  // Let's use a timeout to let them see it, then confirm?
                  // Or better: keep it in "pending" state until they click confirm button?
                  // "O segundo clique executará o corte" was my previous promise.
                  // Implemented: Delay execution by 500ms to show the line, then ask confirm?
                  // Or just executing after a short delay is usually fine IF they can Undo.
                  
                  // Given "Undo" is coming, instant action is better UX than blocking confirm dialogs.
                  // But user specifically asked "tem que marcar a linha de corte, para eu ver o que ta sendo feito".
                  // Maybe clicking the 2nd point just LOCKS the line, and a "V" button appears?
                  
                  // Strict interpretation: "Opção de undo e de cancelar marcações".
                  // Let's execute after short delay (so they see the red line snap), 
                  // but rely on Undo for reversion.
                  
                  setTimeout(() => {
                      // Check if still potentially valid
                      handleExecuteSplit(splitTargetLotId, splitLinePoints[0], coords);
                  }, 100); 
              }
          }
          return;
      }

      if (editorMode === 'create-grid') {
          if(gridPoints.length < 4) {
              setGridPoints([...gridPoints, coords]);
          }
      } 
      else if (editorMode === 'draw-lot') {
          setCurrentPoints([...currentPoints, coords]);
      } else if (editorMode === 'edit-vertex') {
           // If clicking map background in edit-vertex mode, deselect lot
           setSelectedLotForEditing(null);
      }
  };

  // Helper to calculate center
  const calculateCenter = (points: {x: number, y: number}[]): [number, number] => {
      if (points.length === 0) return [0,0];
      const xs = points.map(p => p.x);
      const ys = points.map(p => p.y);
      return [
          (Math.min(...xs) + Math.max(...xs)) / 2,
          (Math.min(...ys) + Math.max(...ys)) / 2
      ];
  };



      const finishDrawingLot = () => {
          if (currentPoints.length < 3) {
          alert("Mínimo 3 pontos para criar um lote.");
          return;
      }

      // Use smart state
      const quadraInput = activeQuadra;
      const loteInput = nextLotNumber;
      
      // STRICT ID GENERATION: Quadra-Lote
      // This ensures "Single Source of Truth" by making the ID deterministic.
      // If two stored lots have the same ID, one overwrites the other (last write wins), preventing duplicates.
      const newLotId = `${quadraInput}-${loteInput}`; 
      
      // Check for existing lot with this ID
      const existingLotIndex = manualLots.findIndex(l => l.id === newLotId);
      if (existingLotIndex >= 0) {
          const confirmOverwrite = confirm(`O lote ${quadraInput}-${loteInput} já existe! Deseja sobrescrever a geometria dele?`);
          if (!confirmOverwrite) return;
          
          // Update existing
          const updatedLots = [...manualLots];
          updatedLots[existingLotIndex] = {
              ...updatedLots[existingLotIndex],
              coordinates: currentPoints.map(p => [p.x, p.y]),
              center: calculateCenter(currentPoints),
              info: {
                  ...updatedLots[existingLotIndex].info,
                  updatedAt: new Date()
              }
          };
          
          setManualLots(updatedLots);
          setCurrentPoints([]);
          
           // Auto-increment logic
          const numeric = parseInt(loteInput);
          if (!isNaN(numeric)) {
              setNextLotNumber(String(numeric + 1));
          }
          return;
      }

      const center = calculateCenter(currentPoints);

      const newLot: Lot = {
          id: newLotId,
          quadra: quadraInput,
          lote: loteInput,
          coordinates: currentPoints.map(p => [p.x, p.y]),
          center: center,
          info: { 
              id: newLotId, 
              quadra: quadraInput, 
              lote: loteInput, 
              notes: "", 
              createdAt: new Date(), 
              updatedAt: new Date() 
          }
      };

      setManualLots([...manualLots, newLot]);
    setCurrentPoints([]);

    // Auto-Save New Lot
    if (onBatchUpdate) {
          const newLots = [...manualLots, newLot];
          const newLotsData = new Map(lotsData);
          newLotsData.set(newLotId, newLot.info);
          onBatchUpdate(newLots, newLotsData, [newLotId]);
    }
    
    // Auto-increment logic (simple number check)
      const numeric = parseInt(loteInput);
      if (!isNaN(numeric)) {
          setNextLotNumber(String(numeric + 1));
      }
  };

  const handleDeleteLot = (lotId: string) => {
      if (editorMode !== 'delete') return;
      
      const targetLot = manualLots.find(l => l.id === lotId);
      if (!targetLot) return;

      if (deleteModeType === 'quadra') {
        // Delete entire quadra (Strict String Match with Trim)
        const targetQ = String(targetLot.quadra).trim();
        const lotsToDelete = manualLots.filter(l => String(l.quadra).trim() === targetQ);
        const count = lotsToDelete.length;
        
        if (confirm(`Apagar toda a Quadra ${targetQ} (${count} lotes detectados)?`)) {
            const deletedIds = lotsToDelete.map(l => l.id);
            setManualLots(prev => prev.filter(l => String(l.quadra).trim() !== targetQ));
            
            if (onDeleteIds) {
                onDeleteIds(deletedIds);
            }
        }
    } else {
        // Delete single lot
         if (lotId.startsWith('manual-') || targetLot.id.includes(targetLot.quadra) || deleteModeType === 'lot') {
            
          const newLotList = manualLots.filter(l => l.id !== lotId);
          setManualLots(newLotList);
          
          if (onDeleteIds) {
              onDeleteIds([lotId]);
          }
          
          // Auto-Save Delete Action (Update Geometry)
          if (onBatchUpdate) {
               // We just removed a lot. The geometry list is updated.
               // We pass 'lotsData' as is (or copy it). onDeleteIds handles the DB deletion of row.
               // onBatchUpdate updates the 'SupabaseLots' state in Home.tsx which drives the map.
               onBatchUpdate(newLotList, lotsData, []);
          }
        } else {
            alert("Apenas lotes manuais podem ser deletados totalmente por aqui.");
        }
    }
};

  // Bilinear interpolation to find point inside a quadrilateral
  // p1=TL, p2=TR, p3=BR, p4=BL
  // u, v are normalized coordinates [0,1]
  const interpolateQuad = (
      p1: {x: number, y: number}, 
      p2: {x: number, y: number}, 
      p3: {x: number, y: number}, 
      p4: {x: number, y: number}, 
      u: number, 
      v: number
  ) => {
      // Interpolate top and bottom edges X
      const xTop = p1.x + (p2.x - p1.x) * u;
      const xBottom = p4.x + (p3.x - p4.x) * u;
      
      // Interpolate final X
      const x = xTop + (xBottom - xTop) * v;
      
      // Interpolate left and right edges Y
      const yLeft = p1.y + (p4.y - p1.y) * v;
      const yRight = p2.y + (p3.y - p2.y) * v;
      
      // Interpolate final Y
      const y = yLeft + (yRight - yLeft) * u;
      
      // Note: This is a simple approximation. True perspective requires projective mapping, 
      // but simple bilinear interp (lerp of lerps) works for 99% of map "grids".
      // A more robust way for just coordinates:
      const xFinal = (1-u)*(1-v)*p1.x + u*(1-v)*p2.x + u*v*p3.x + (1-u)*v*p4.x;
      const yFinal = (1-u)*(1-v)*p1.y + u*(1-v)*p2.y + u*v*p3.y + (1-u)*v*p4.y;

      return [xFinal, yFinal];
  };

  const handleFinishQuadraGrid = () => {
      if(gridPoints.length !== 4) return;
      const [p1, p2, p3, p4] = gridPoints;
      // p1: TL, p2: TR, p3: BR, p4: BL (assuming user clicks in order or we sort them? User clicks corners)
      // We assume user clicks CW or Z order. PROMPT guided users: TL->TR->BR->BL or TL->TR->BL->BR?
      // Let's guide: 1. Top-Left, 2. Top-Right, 3. Bottom-Right, 4. Bottom-Left

      const columns = quadraConfig.columns;
      if (columns.length === 0) {
          alert("Adicione pelo menos uma coluna de lotes.");
          return;
      }

      const totalCols = columns.length;
      
      const newLots: Lot[] = [];

      columns.forEach((col, colIndex) => {
          const startNum = col.start;
          const endNum = col.end;
          
          // Determine count and direction
          const count = Math.abs(endNum - startNum) + 1;
          const step = endNum >= startNum ? 1 : -1;
          
          // Normalized U range for this column
          const uStart = colIndex / totalCols;
          const uEnd = (colIndex + 1) / totalCols;

          for (let i = 0; i < count; i++) {
              const lotNum = startNum + (i * step);
              
              // Normalized V range for this lot (row)
              const vStart = i / count;
              const vEnd = (i + 1) / count;
              
              const corners = [
                  interpolateQuad(p1, p2, p3, p4, uStart, vStart), // TL
                  interpolateQuad(p1, p2, p3, p4, uEnd, vStart),   // TR
                  interpolateQuad(p1, p2, p3, p4, uEnd, vEnd),     // BR
                  interpolateQuad(p1, p2, p3, p4, uStart, vEnd)    // BL
              ] as [number, number][];

              // STRICT ID GENERATION
              const id = `${quadraConfig.id}-${lotNum}`;
              const center = calculateCenter(corners.map(p => ({x: p[0], y: p[1]})));
              
              const existingIdx = newLots.findIndex(l => l.id === id); // Check inside current batch
              if (existingIdx !== -1) {
                  // If we somehow generate same ID in batch, skip or warn? 
                  // Grid shouldn't produce dupes unless config is weird.
                  continue; 
              }

              newLots.push({
                  id,
                  quadra: quadraConfig.id,
                  lote: String(lotNum),
                  coordinates: corners,
                  center: center,
                  info: {
                      id,
                      quadra: quadraConfig.id,
                      lote: String(lotNum),
                      notes: "Generated via Free Quadra",
                      zona: "3", // Default Zona 3 as requested
                      setor: "0764", // Default Setor example, user can edit
                      createdAt: new Date(),
                      updatedAt: new Date()
                  }
              });
          }
      });

      const allNewLots = [...manualLots, ...newLots];
    setManualLots(allNewLots);
    setGridPoints([]);
    setShowQuadraConfig(false);
    setQuadraConfig({ id: '', columns: [] });
    
    // Auto-Save Grid Generation
    if (onBatchUpdate) {
          const newLotsData = new Map(lotsData);
          newLots.forEach(lot => {
              newLotsData.set(lot.id, lot.info);
          });
          onBatchUpdate(allNewLots, newLotsData, newLots.map(l => l.id));
    }
      
      // Auto-open Quick Fill
      setQuickFillQuadra(columns.length > 0 ? quadraConfig.id : null); // Should be consistent
      setShowQuickFill(true);
      
      // alert("Quadra Gerada com Sucesso!"); // Removed alert to streamline flow
  };

  const handleCreateGrid = () => {
       // Logic moved to effect/interaction
  };

  const generateGridPreview = () => {
      if(gridPoints.length !== 4) return;
      const [p1, p2, p3, p4] = gridPoints;
      
      const columns = quadraConfig.columns;
      if (columns.length === 0) {
          setGridPreviewLots([]);
          return;
      }

      const totalCols = columns.length;
      const previewLots: Lot[] = [];

      columns.forEach((col, colIndex) => {
          const startNum = col.start;
          const endNum = col.end;
          
          const count = Math.abs(endNum - startNum) + 1;
          const step = endNum >= startNum ? 1 : -1;
          
          const uStart = colIndex / totalCols;
          const uEnd = (colIndex + 1) / totalCols;

          for (let i = 0; i < count; i++) {
              const lotNum = startNum + (i * step);
              
              const vStart = i / count;
              const vEnd = (i + 1) / count;
              
              const corners = [
                  interpolateQuad(p1, p2, p3, p4, uStart, vStart),
                  interpolateQuad(p1, p2, p3, p4, uEnd, vStart),
                  interpolateQuad(p1, p2, p3, p4, uEnd, vEnd),
                  interpolateQuad(p1, p2, p3, p4, uStart, vEnd)
              ] as [number, number][];

              const id = `preview-${lotNum}`;
              previewLots.push({
                  id,
                  quadra: quadraConfig.id,
                  lote: String(lotNum),
                  coordinates: corners,
                  center: [0,0], 
                  info: { id, quadra: quadraConfig.id, lote: String(lotNum), notes: "", createdAt: new Date(), updatedAt: new Date() }
              });
          }
      });
      setGridPreviewLots(previewLots);
  };

  useEffect(() => {
      if (showQuadraConfig) {
          generateGridPreview();
      } else {
          setGridPreviewLots([]);
      }
  }, [quadraConfig, showQuadraConfig]);

  // Effect to trigger dialog when 4 points are collected
  useEffect(() => {
     if (editorMode === 'create-grid' && gridPoints.length === 4) {
         setShowQuadraConfig(true);
     }
  }, [gridPoints, editorMode]);

  // RESTORING MOUSE HANDLERS
  const handleMouseDown = (e: React.MouseEvent, quadraId: string) => {
    // CAPTURE START POS for Drag Guard
    dragStartRef.current = { x: e.clientX, y: e.clientY };

    if (!isDevMode || editorMode !== 'move') return;
    e.stopPropagation();
    // isDragging is now a ref, not state
    setDraggedQuadraId(quadraId);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handlePointMouseDown = (e: React.MouseEvent) => {
    if (!isDevMode || editorMode !== 'draw-lot') return;
    e.stopPropagation();
    const coords = getMapCoordinates(e);
    const idx = findNearestCurrentPoint(coords, 10);
    if (idx !== null) {
      setDraggingPointIndex(idx);
    }
  };

  // Right drag state
  const [isRightDragging, setIsRightDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({x: 0, y: 0});

  const handleSVGMouseDown = (e: React.MouseEvent) => {
      // Right Click (Button 2)
      if (e.button === 2) {
          e.preventDefault();
          e.stopPropagation();
          setIsRightDragging(true);
          setLastMousePos({ x: e.clientX, y: e.clientY });
          return;
      }
      
      // Pass through for other interactions if needed?
      // Currently generic logic uses OnClick, but we might have specific mouse down needs.
  };



  // ... (inside component)

  const handleMouseMove = (e: React.MouseEvent) => {
    // Track Tooltip Position
    if (hoveredLotId) {
        setTooltipPosition({ x: e.clientX, y: e.clientY });
    }

    if (isRightDragging && wrapperRef.current && wrapperRef.current.instance) {
        const { scale, positionX, positionY } = wrapperRef.current.instance.transformState;
        const dx = e.clientX - lastMousePos.x;
        const dy = e.clientY - lastMousePos.y;
        wrapperRef.current.setTransform(positionX + dx, positionY + dy, scale, 0);
        setLastMousePos({ x: e.clientX, y: e.clientY });
        return;
    }

    if (!isDevMode) return;

    if (editorMode === 'draw-lot') {
        const coords = getMapCoordinates(e);
        const snapped = findNearestVertex(coords, 10);
        setSnapPoint(snapped);
        setMousePos(coords);
    }

    // Standard Mouse Move Logic
    const coords = getMapCoordinates(e);

    // Track mouse for Tooltip
    setTooltipPosition({ x: e.clientX, y: e.clientY });




    if (editorMode === 'create-grid') return;
    
    // ... (Rest of existing move logic: drag, draw-lot, etc)
    if (draggedQuadraId && wrapperRef.current) { // Removed isDragging state check here, as it's now a ref for TransformWrapper
// ...
      const scale = wrapperRef.current.instance?.transformState.scale || 1;
      if (editorMode === 'move') {
        const dx = (e.clientX - dragStart.x) / scale;
        const dy = (e.clientY - dragStart.y) / scale;
        // setQuadraOffsets... REMOVED (Reverted Draggable Labels)
        // Just keeping generic move logic if needed or empty if it was only for offsets?
        // Wait, 'move' mode moves the map or quadras? 
        // Original code: "setQuadraOffsets". If we revert this, 'move' mode usually pans map (handled by TransformWrapper).
        // BUT if specific logic was here for `draggedQuadraId`, we remove it.
        // We still have `draggedQuadraId` for moving Quadras (logic from Step 33, lines 1087-1096).
        // Oh, wait, `draggedQuadraId` WAS for moving Quadra positions (Offsets).
        // So we remove this block entirely if we don't support moving quadras anymore.
        // User said: "desfaça a ultima atualização de arrastar".
        return;
      }
    }

    if (editorMode === 'draw-lot' && draggingPointIndex !== null) {
      const coords = getMapCoordinates(e);
      setCurrentPoints(prev => {
        const newPoints = [...prev];
        newPoints[draggingPointIndex] = coords;
      return newPoints;
      });
      return;
    }

     if (editorMode === 'draw-lot') {
       const coords = getMapCoordinates(e);
       const snapped = findNearestVertex(coords, 5); 
       setSnapPoint(snapped);
       if (draggingPointIndex === null && currentPoints.length > 0) {
         setMousePos(coords);
       }
     } else {
       setSnapPoint(null);
       setMousePos(getMapCoordinates(e));
     }

    if (editorMode === 'edit-vertex' && editingVertexIndex !== null && selectedLotForEditing) {
        const coords = getMapCoordinates(e);
        
        // Exclude the current vertex + linked vertices from snapping (don't snap to self or moving friends)
        const excludeList = [
            { lotId: selectedLotForEditing, vertexIndex: editingVertexIndex },
            ...linkedVerticesRef.current
        ];
        
        const snapped = findNearestVertex(coords, 1.0, excludeList);
        const finalCoords = snapped || coords;

        // Check for Alt Key (Detach Mode)
        const isDetached = e.altKey;

        setManualLots(prev => prev.map(lot => {
            // If detached, only update selected lot
            if (isDetached) {
                if (lot.id === selectedLotForEditing) {
                    if (Array.isArray(lot.coordinates[0][0])) return lot; // Skip MultiPolygon editing
                    const newCoords = [...(lot.coordinates as [number, number][])];
                    newCoords[editingVertexIndex] = [finalCoords.x, finalCoords.y];
                    const newCenter = calculateCenter(newCoords.map(p => ({x: p[0], y: p[1]})));
                    return { ...lot, coordinates: newCoords, center: newCenter };
                }
                return lot;
            }

            // Normal Mode: Update ALL linked vertices
            // Check if this lot is in our linked list
            const links = linkedVerticesRef.current.filter(link => link.lotId === lot.id);
            
            if (links.length > 0) {
                 if (Array.isArray(lot.coordinates[0][0])) return lot; // Skip MultiPolygon
                 const newCoords = [...(lot.coordinates as [number, number][])];
                 let changed = false;
                 
                 links.forEach(link => {
                     newCoords[link.vertexIndex] = [finalCoords.x, finalCoords.y];
                     changed = true;
                 });

                 if (changed) {
                     const newCenter = calculateCenter(newCoords.map(p => ({x: p[0], y: p[1]})));
                     return { ...lot, coordinates: newCoords, center: newCenter };
                 }
            }
            
            return lot;
        }));
    }
  };

  const handleMouseUp = () => {
    // Check for Vertex Edit End (Auto-Save)
    if (editorMode === 'edit-vertex' && linkedVerticesRef.current.length > 0) {
        // We just finished dragging vertices.
        // Identify affected lots
        const affectedLotIds = Array.from(new Set(linkedVerticesRef.current.map(l => l.lotId)));
        
        if (onBatchUpdate && affectedLotIds.length > 0) {
            // We need to pass the CURRENT manualLots (which have been updated by handleMouseMove)
            // And we should probably provide the associated LotInfo from lotsData.
            // Note: lotsData might NOT have the updated Area if we didn't recalc it.
            // For now, we sync the geometry.
             const currentLotsData = new Map(lotsData);
             
             // Optional: Recalculate Area for affected lots?
             // affectedLotIds.forEach(id => {
             //    const lot = manualLots.find(l => l.id === id);
             //    if (lot) {
             //        const area = calculateArea(lot.coordinates); 
             //        const info = currentLotsData.get(id);
             //        if (info) currentLotsData.set(id, { ...info, area });
             //    }
             // });
             
             onBatchUpdate(manualLots, currentLotsData, affectedLotIds);
        }
    }

    // Check for Quadra Move End (Auto-Save)
    if (editorMode === 'move' && draggedQuadraId) {
        // Find all lots in this quadra
        const affectedLots = manualLots.filter(l => String(l.quadra) === draggedQuadraId);
        const affectedIds = affectedLots.map(l => l.id);
        
        if (onBatchUpdate && affectedIds.length > 0) {
             const currentLotsData = new Map(lotsData);
             onBatchUpdate(manualLots, currentLotsData, affectedIds);
        }
    }

    setIsRightDragging(false);
    // isDragging is now a ref, not state
    setDraggedQuadraId(null);
    setDraggingPointIndex(null);
    setEditingVertexIndex(null);
    linkedVerticesRef.current = [];
  };

  const handleLotClick = (e: React.MouseEvent, lot: Lot) => {
      // DISTANCE CHECK for "Smart Drag Guard"
      // If we have a start position, check how far we moved.
      if (dragStartRef.current) {
          const dx = e.clientX - dragStartRef.current.x;
          const dy = e.clientY - dragStartRef.current.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          // If moved more than 15 pixels, it's a drag, not a click.
          if (dist > 15) {
              console.log("Ignored Lot Click (Drag detected)");
              return; 
          }
      }
      
      // EXCEPTION: In Split Mode (Phase 2), we want clicking on lots to Register as Points (bubble to map)
      // This prevents "switching" selection and allows drawing the cut line over the lot itself.
      if (editorMode === 'split' && splitTargetLotId) {
          return; // Let it bubble to handleMapClick
      }

      e.stopPropagation();
      
      if (editorMode === 'delete') {
          handleDeleteLot(lot.id);
      } else if (editorMode === 'edit-vertex') {
           setSelectedLotForEditing(lot.id);
           setEditingVertexIndex(null); 
      } else if (editorMode === 'edit-info' && manualLotIds.has(lot.id)) {
           const newLote = prompt("Novo número do Lote:", lot.lote);
           const newQuadra = prompt("Nova Quadra:", lot.quadra);
           if (newLote && newQuadra) {
               setManualLots(prev => prev.map(l => {
                   if (l.id === lot.id) {
                       return { ...l, lote: newLote, quadra: newQuadra };
                   }
                   return l;
               }));
           }
      } else if (!isDragging.current && editorMode === 'move') { // Changed from state to ref
           onLotClick(lot);
      } else {
           // ALWAYS allow clicking lots to open info, unless we are in a specific tool mode
           if (editorMode === 'split') {
               // Phase 1: SELECT the lot to split
               if (!splitTargetLotId) {
                   setSplitTargetLotId(lot.id);
                   setSplitLinePoints([]);
                   // No alert, just visual feedback (Red Highlight)
               }
               return;
           }

           if (editorMode !== 'draw-lot') {
               onLotClick(lot);
           }
      }
  };

  // Keyboard Shortcuts
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (!isDevMode) return;

          if (e.key === 'Enter') {
              if (editorMode === 'draw-lot' && currentPoints.length >= 3) {
                  finishDrawingLot();
              }
          } else if (e.key === 'Escape') {
              if (editorMode === 'draw-lot') {
                  setCurrentPoints([]);
              } else if (editorMode === 'create-grid') {
                  setGridPoints([]);
                  setShowQuadraConfig(false);
              } else if (editorMode === 'edit-vertex') {
                  setSelectedLotForEditing(null);
                  setEditingVertexIndex(null);
              } else if (editorMode === 'split') {
                  setSplitTargetLotId(null);
                  setSplitLinePoints([]);
              }
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDevMode, editorMode, currentPoints, gridPoints]);

  // REACTIVE ZOOM EFFECT (Unifies Click & Sidebar Selection)
  useEffect(() => {
      // Skip zoom/centering on mobile (all layers)
      const shouldSkipZoom = isMobile;
      
      // 2. QUADRA SELECTION & ZOOM
      // If we have highlighted lots (Smart Calc), we DON'T want the generic Quadra Zoom to override our specific Lot Pan.
      if (activeQuadraId && mapDataComplete && highlightedLots.length === 0 && wrapperRef.current && wrapperRef.current.instance && !shouldSkipZoom) {
          const quadra = mapDataComplete.quadras.find(q => q.id === activeQuadraId);
          if (quadra && quadra.center) {
              const [cx, cy] = Array.isArray(quadra.center) 
                  ? [quadra.center[0], quadra.center[1]] 
                  // @ts-ignore
                  : [quadra.center.x, quadra.center.y];

              if (cx !== 0 && cy !== 0) {
                    // Use container dimensions for accurate centering
                    let containerWidth = window.innerWidth;
                    let containerHeight = window.innerHeight;

                    if (containerRef.current) {
                        const rect = containerRef.current.getBoundingClientRect();
                        containerWidth = rect.width;
                        containerHeight = rect.height;
                    }

                    // Use prop isMobile instead of recalculating (MOBILE FIX)
                    const targetScale = isMobile ? 2.5 : 3.8;

                    // CALCULATION WITH CALIBRATION OFFSET
                    // Center in the visible CONTAINER, not the window
                    const screenCenterX = (containerWidth / 2) + centeringOffset.x;
                    const screenCenterY = (containerHeight / 2) + centeringOffset.y;

                    const newX = screenCenterX - (cx * targetScale);
                    const newY = screenCenterY - (cy * targetScale);

                    // Execute Animation
                    // Small timeout to allow render cycle to settle if coming from sidebar
                    setTimeout(() => {
                        if (wrapperRef.current) {
                            wrapperRef.current.setTransform(newX, newY, targetScale, 1000, "easeOutCubic");
                        }
                    }, 50);
                  }
          }
      }
  }, [activeQuadraId, centeringOffset, highlightedLots.length, isMobile]);

  // Auto-Zoom to Selected Lot -> Triggers Quadra Select
  useEffect(() => {
     if (selectedLotId) {
         const lot = manualLots.find(l => l.id === selectedLotId);
         if (lot && lot.quadra !== activeQuadraId) {
             setActiveQuadraId(lot.quadra); // This will trigger the Zoom Effect above
         }
     }
     // eslint-disable-next-line
  }, [selectedLotId, manualLots]); // Removed activeQuadraId to prevent reversion loop when manually clicking Quadras

  // Auto-Pan to Highlighted Lots (Smart Calculator)
  useEffect(() => {
      // Skip zoom/centering on mobile (all layers)
      const shouldSkipZoom = isMobile;
      
      if (highlightedLots.length > 0 && wrapperRef.current && !shouldSkipZoom) {
          // SYNC QUADRA SELECTION
          // If the lots belong to a quadra, make it active so the map context updates (labels, etc.)
          const targetQuadra = highlightedLots[0].quadra;
          if (targetQuadra !== activeQuadraId) {
              setActiveQuadraId(targetQuadra);
          }

          // Calculate Center of Highlighted Lots
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          
          highlightedLots.forEach(lot => {
              const flatCoords = (lot.coordinates.length > 0 && Array.isArray(lot.coordinates[0][0]))
                  ? (lot.coordinates as [number, number][][]).flat()
                  : (lot.coordinates as [number, number][]);

              flatCoords.forEach(([x, y]) => {
                  minX = Math.min(minX, x);
                  minY = Math.min(minY, y);
                  maxX = Math.max(maxX, x);
                  maxY = Math.max(maxY, y);
              });
          });

          if (minX !== Infinity) {
              const cx = (minX + maxX) / 2;
              const cy = (minY + maxY) / 2;
              
              let containerWidth = window.innerWidth;
              let containerHeight = window.innerHeight;

              if (containerRef.current) {
                  const rect = containerRef.current.getBoundingClientRect();
                  containerWidth = rect.width;
                  containerHeight = rect.height;
              }

              // Use current scale to maintain zoom level, or minor adjustment?
              // User said "ir com a camera", usually implies panning.
              // Let's keep current zoom if reasonable, or ensure minimum visibility.
              const currentScale = wrapperRef.current.instance.transformState.scale;
              const targetScale = Math.max(currentScale, isMobile ? 1.5 : 2.5); // Ensure at least some zoom

              const screenCenterX = (containerWidth / 2) + centeringOffset.x;
              const screenCenterY = (containerHeight / 2) + centeringOffset.y;

              const newX = screenCenterX - (cx * targetScale);
              const newY = screenCenterY - (cy * targetScale);

              wrapperRef.current.setTransform(newX, newY, targetScale, 600, "easeOutCubic");
              
              // Also trigger quadra highlight if not already? 
              // Actually, we suppressed the tooltip, so we don't need to force quadra selection state.
              // Just visual pan is enough.
          }
      }
  }, [highlightedLots, centeringOffset, isMobile, activeQuadraId]);

    // --- MERGE LOGIC ---

    // Calculate Quadra Centers based on Lot Coordinates (Dynamic Centering)
    const quadraCenters = useMemo(() => {
        const centers: Record<string, {x: number, y: number}> = {};
        const quadraLotCounts: Record<string, number> = {};

        manualLots.forEach(lot => {
            if (!lot.quadra) return;
            
            // Calculate Lot Center
            let lx = 0, ly = 0;
            const flatCoords = (lot.coordinates.length > 0 && Array.isArray(lot.coordinates[0][0]))
                ? (lot.coordinates as [number, number][][]).flat()
                : (lot.coordinates as [number, number][]);

            flatCoords.forEach(p => { lx += p[0]; ly += p[1]; });
            if (flatCoords.length > 0) {
                lx /= flatCoords.length;
                ly /= flatCoords.length;
            }

            if (!centers[lot.quadra]) {
                centers[lot.quadra] = { x: 0, y: 0 };
                quadraLotCounts[lot.quadra] = 0;
            }
            
            centers[lot.quadra].x += lx;
            centers[lot.quadra].y += ly;
            quadraLotCounts[lot.quadra]++;
        });

        // Average them out
        Object.keys(centers).forEach(qId => {
            if (quadraLotCounts[qId] > 0) {
                centers[qId].x /= quadraLotCounts[qId];
                centers[qId].y /= quadraLotCounts[qId];
            }
        });
        return centers;
    }, [manualLots]);

    const handleLotClickForMerge = (lotId: string) => {
        if (selectedLotsForMerge.includes(lotId)) {
            setSelectedLotsForMerge(prev => prev.filter(id => id !== lotId));
        } else {
            setSelectedLotsForMerge(prev => [...prev, lotId]);
        }
    };

    const handleExecuteMerge = async () => {
        if (selectedLotsForMerge.length < 2) {
            alert("Selecione pelo menos 2 lotes para unir.");
            return;
        }

        const lotsToMerge = manualLots.filter(l => selectedLotsForMerge.includes(l.id));
        if (lotsToMerge.length !== selectedLotsForMerge.length) return;

        try {
            const { mergeLotsGeometry } = await import('@/lib/geometryUtils');
            const result = mergeLotsGeometry(lotsToMerge);
            
            if (!result) {
                alert("Erro ao calcular geometria. Lotes podem estar desconectados.");
                return;
            }

            // Create Merged Lot Info
            const sorted = lotsToMerge.sort((a,b) => (parseInt(a.lote)||0) - (parseInt(b.lote)||0));
            
            const mainLot = sorted[0];
            const newLoteLabel = sorted.map(l => l.lote).join(" & ");
            // Alias = all original IDs or 'lote' values
            const aliases = sorted.map(l => l.lote); 
            
            const newId = sorted.map(l => l.id).join("_"); // Unique ID combo

            const confirmMsg = `Unir ${lotsToMerge.length} lotes em um novo lote "${newLoteLabel}"?\n(Os lotes originais serão removidos)`;
            if (!confirm(confirmMsg)) return;

            const mergedLot: Lot = {
                id: newId,
                quadra: mainLot.quadra, // Assume same quadra
                lote: newLoteLabel,
                coordinates: result.coordinates,
                center: result.center,
                info: {
                    ...mainLot.info,
                    id: newId,
                    lote: newLoteLabel,
                    displayId: newLoteLabel,
                    aliases: aliases,
                    notes: `União de: ${aliases.join(', ')}. ` + (mainLot.info.notes || ""),
                    area: lotsToMerge.reduce((acc, l) => acc + (l.info.area || 0), 0), // Sum areas
                    updatedAt: new Date(),
                    history: {
                        type: 'merge',
                        parentIds: lotsToMerge.map(l => l.id),
                        timestamp: new Date()
                    }
                }
            };

            // Remove old, add new
            const remaining = manualLots.filter(l => !selectedLotsForMerge.includes(l.id));
        const newLotList = [...remaining, mergedLot];
        setManualLots(newLotList);
        
        // Auto-Save Merge Action
        if (onBatchUpdate) {
            const newLotsData = new Map(lotsData);
            newLotsData.set(mergedLot.id, mergedLot.info);
            // Delete merged sources? 
            // In typical SQL sync, we might need to delete old rows.
            // Home.tsx `onBatchUpdate` does `batchUpsert`. It doesn't delete.
            // So we might end up with "Ghost Lots" in Supabase if we don't delete.
            // But Map State (SupabaseLots) will match `newLotList`, so ghost lots won't render.
            // However, to be clean, we should probably delete the old IDs via `onDeleteIds`.
            
            onBatchUpdate(newLotList, newLotsData, [mergedLot.id]); 
            
            // Trigger Delete for old IDs
            if (onDeleteIds) {
                onDeleteIds(selectedLotsForMerge);
            }
        }
        
        // Clean up
        setSelectedLotsForMerge([]);
        alert("Lotes unidos com sucesso!");

        } catch (e: any) {
            console.error("Merge error:", e);
            if (e.message === "MULTIPOLYGON_ERROR") {
                alert("Erro: Não foi possível unir os lotes pois eles não estão conectados.\nCertifique-se de que não há espaços entre eles.\n(Resultado foi um MultiPolygon)");
            } else {
                alert("Erro ao unir lotes.");
            }
        }
    };

  const handleQuadraClick = (quadraId: string) => {
      // ALWAYS Activate the Quadra (User req: "ao clicar no label da quadra tem que aparecer os lotes")
      setActiveQuadraId(quadraId);

      if (isDevMode) {
          // Dev Mode: Toggle Ghost Mode (Active One Only)
          // User req: "quando clicar em outro label o que estava 'no fundo' volta para frente"
          setGhostQuadraId(quadraId); 
      }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
      if (!isDevMode) return;
      if (editorMode === 'draw-lot') {
          // Double click adds the final point (handled by click) and then finishes
          // Wait for single click to process first? 
          // Actually, simply invoking finishDrawingLot checks point count.
          // If we want to capture the point *at* double click, the Click handler likely ran once or twice.
          // We can just try to finish.
          finishDrawingLot();
      }
  };


  // Calculate initial scale to fit screen
  const [initialMapScale] = useState(() => {
      if (typeof window !== 'undefined') {
          const w = window.innerWidth;
          // Map width is 1024. If screen is smaller, scale down.
          // We clamp at 1 to avoid zooming in on huge screens by default.
          return Math.min(w / 1024, 1);     
      }
      return 1;
  });





  /* Helper to Auto-Center Leaflet Map on Selected Lot */
  const LeafletAutoCenter = () => {
      const map = useMap();
      
      useEffect(() => {
          if (!selectedLotId || !mapDataComplete) return;

          const lot = manualLots.find(l => l.id === selectedLotId);
          if (!lot) return;

          // 1. Get SVG Center
          let cx = 0, cy = 0;
          if (lot.center) {
              if (Array.isArray(lot.center)) {
                  cx = lot.center[0];
                  cy = lot.center[1];
              } else {
                  // @ts-ignore
                  cx = lot.center.x; 
                  // @ts-ignore
                  cy = lot.center.y;
              }
          } else {
              // Fallback to coordinates
               // Calculate Lot Center
            let lx = 0, ly = 0;
            const flatCoords = (lot.coordinates.length > 0 && Array.isArray(lot.coordinates[0][0]))
                ? (lot.coordinates as [number, number][][]).flat()
                : (lot.coordinates as [number, number][]);

            flatCoords.forEach(p => { lx += p[0]; ly += p[1]; });
            if (flatCoords.length > 0) {
                lx /= flatCoords.length;
                ly /= flatCoords.length;
                cx = lx;
                cy = ly;
            }
          }

          if (cx === 0 && cy === 0) return;

          // 2. Convert to GPS
          const gps = svgToGeo(cx, cy);
          if (gps) {
              // 3. Fly To Logic with Sidebar Offset Calculation
              // We want the point to be centered relative to the *visible* area, considering the sidebar offset.
              // Center Offset X is usually negative (sidebar on right pushes center left) or positive.
              // In Leaflet, we pan the map to fake this.
              
              // Standard Center first
              const zoom = 19; // High zoom for single lot
              map.flyTo([gps.lat, gps.lng], zoom, {
                  animate: true,
                  duration: 1.5
              });
              
              // Note: True pixel offset in Leaflet is harder to sync perfectly with the "centeringOffset" state 
              // without re-projecting after zoom. Ideally, we just center on the lot for now.
              // If user complains about sidebar covering it, we can add `paddingControl` or `panBy`.
          }
      }, [selectedLotId]);

      return null;
  };

  /* Helper Component for handling Leaflet clicks/events */
  const LeafletMapEvents = () => {
    const map = useMapEvents({
      click(e) {
          if (editorMode === 'draw-lot') {
              const svgCoords = geoToSvg(e.latlng.lat, e.latlng.lng);
              if (svgCoords) {
                  // Reuse standard logic
                  setCurrentPoints(prev => [...prev, svgCoords]);
              }
          } else if (editorMode === 'split') {
              // Split Tool Support for Satellite
              const svgCoords = geoToSvg(e.latlng.lat, e.latlng.lng);
              if (svgCoords && splitTargetLotId) {
                   // Logic mirrored from handleMapClick (L626)
                   const p1 = splitLinePoints[0];
                   if (!p1) {
                       setSplitLinePoints([svgCoords]);
                   } else {
                       // Execute Split
                       // Wait a bit to ensure UI updates? No need here.
                       handleExecuteSplit(splitTargetLotId, p1, svgCoords);
                   }
              }
          }
      },
      mousemove(e) {
         if (editorMode === 'draw-lot') {
             const svgCoords = geoToSvg(e.latlng.lat, e.latlng.lng);
             if (svgCoords) {
                 setMousePos(svgCoords);
                 // Snap Logic for Leaflet (Visual only)
                 const snapped = findNearestVertex(svgCoords, 5);
                 setSnapPoint(snapped);
             }
         } else if (editorMode === 'split' && splitLinePoints.length > 0) {
             const svgCoords = geoToSvg(e.latlng.lat, e.latlng.lng);
              if (svgCoords) {
                  setMousePos(svgCoords);
              }
         }
      }
    });
    return null;
  };

    return (
        <div ref={containerRef} className="w-full h-full relative bg-gray-100" onContextMenu={(e) => e.preventDefault()}>
            
            {/* Conditional Rendering: 
                - Use Leaflet ONLY for Satellite and OpenStreetMap layers
                - Use SVG for Custom layer (both desktop and mobile)
            */}
            {activeLayer !== 'custom' ? (
                /* LEAFLET MODE - Satellite or OSM with GeoJSON lots */
                <div className="absolute inset-0 z-0">
                    <MapContainer
                        center={[-23.9527, -46.1939]}
                        zoom={16}
                        style={{ width: '100%', height: '100%' }}
                        zoomControl={true}
                        attributionControl={true}
                    >
                        {/* Tile Layer - Satellite or OpenStreetMap */}
                        {activeLayer === 'satellite' ? (
                            <TileLayer
                                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                attribution='&copy; Esri'
                                maxZoom={19}
                            />
                        ) : (
                            <TileLayer
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution='&copy; OpenStreetMap'
                                maxZoom={19}
                            />
                        )}

                        {/* LEAFLET DEV TOOLS & EVENT HANDLER */}
                        <LeafletMapEvents />
                        <LeafletAutoCenter />

                        {/* DRAWING MODE VISUALS (Leaflet) */}
                        {editorMode === 'draw-lot' && (
                            <>
                                {/* Current Polygon Lines */}
                                {currentPoints.length > 1 && (
                                    <Polyline
                                        positions={currentPoints.map(p => {
                                            const gps = svgToGeo(p.x, p.y);
                                            return gps ? [gps.lat, gps.lng] : [0,0];
                                        })}
                                        pathOptions={{ color: 'blue', weight: 2 }}
                                    />
                                )}
                                
                                {/* Points */}
                                {currentPoints.map((p, i) => {
                                    const gps = svgToGeo(p.x, p.y);
                                    if(!gps) return null;
                                    return (
                                        <CircleMarker
                                            key={`draw-pt-${i}`}
                                            center={[gps.lat, gps.lng]}
                                            radius={5}
                                            pathOptions={{ color: 'white', fillColor: 'blue', fillOpacity: 1 }}
                                        />
                                    );
                                })}

                                {/* Snap Point (Yellow) */}
                                {snapPoint && (() => {
                                    const gps = svgToGeo(snapPoint.x, snapPoint.y);
                                    if(gps) {
                                        return (
                                            <CircleMarker
                                                center={[gps.lat, gps.lng]}
                                                radius={6}
                                                pathOptions={{ color: 'yellow', fill: false, weight: 2 }}
                                            />
                                        )
                                    }
                                    return null;
                                })()}
                            </>
                        )}

                        {/* SPLIT TOOL VISUALS (Leaflet) */}
                        {editorMode === 'split' && splitLinePoints.length > 0 && (
                            <>
                                {/* First Point */}
                                {(() => {
                                    const gps = svgToGeo(splitLinePoints[0].x, splitLinePoints[0].y);
                                    if(gps) {
                                        return (
                                            <CircleMarker
                                                center={[gps.lat, gps.lng]}
                                                radius={5}
                                                pathOptions={{ color: 'red', fillColor: 'white', fillOpacity: 1 }}
                                            />
                                        )
                                    }
                                    return null;
                                })()}
                                
                                {/* Active Line to Mouse */}
                                {mousePos && (() => {
                                    const p1 = svgToGeo(splitLinePoints[0].x, splitLinePoints[0].y);
                                    const p2 = svgToGeo(mousePos.x, mousePos.y);
                                    
                                    if (p1 && p2) {
                                         return (
                                             <Polyline
                                                 positions={[[p1.lat, p1.lng], [p2.lat, p2.lng]]}
                                                 pathOptions={{ color: 'red', weight: 2, dashArray: '5, 10' }}
                                             />
                                         )
                                    }
                                    return null;
                                })()}
                            </>
                        )}

                        {/* VERTEX EDIT MODE VISUALS (Leaflet) */}
                        {editorMode === 'edit-vertex' && manualLots.map(lot => {
                             if (selectedLotForEditing && lot.id !== selectedLotForEditing) return null;
                             if (!selectedLotForEditing && !manualLotIds.has(lot.id)) return null; 

                             // Skip MultiPolygons for vertex editing (not supported yet)
                             if (lot.coordinates.length > 0 && Array.isArray(lot.coordinates[0][0])) return null;

                             return (lot.coordinates as [number, number][]).map((coord, i) => {
                                 const gps = svgToGeo(coord[0], coord[1]);
                                 if (!gps) return null;
                                 
                                 return (
                                     <Marker
                                        key={`vertex-${lot.id}-${i}`}
                                        position={[gps.lat, gps.lng]}
                                        draggable={true}
                                        icon={L.divIcon({
                                             className: 'vertex-edit-icon',
                                             html: `<div style="width: 10px; height: 10px; background: white; border: 2px solid ${lot.id === selectedLotForEditing && i === editingVertexIndex ? 'red' : 'blue'}; border-radius: 50%;"></div>`,
                                             iconSize: [10, 10],
                                             iconAnchor: [5, 5]
                                        })}
                                        eventHandlers={{
                                            dragstart: (e: any) => {
                                                // MOCK EVENT for handleVertexMouseDown
                                                // It expects { stopPropagation: () => void }
                                                const mockEvent = {
                                                    stopPropagation: () => {},
                                                    ...e.originalEvent // Optional: include props if needed
                                                } as any;
                                                handleVertexMouseDown(mockEvent, lot.id, i);
                                            },
                                            drag: (e: any) => {
                                                const latlng = e.target.getLatLng();
                                                const svgCoords = geoToSvg(latlng.lat, latlng.lng);
                                                
                                                if (svgCoords) {
                                                    // Reuse handleMouseMove logic by mocking event? 
                                                    // No, handleMouseMove relies on 'editorMode' and 'editingVertexIndex' state.
                                                    // Better to explicitly call logic here or Trigger standard update?
                                                    
                                                    // We can manually trigger the update logic here because 'drag' event gives us new position directly.
                                                    
                                                    // Reuse logic from handleMouseMove (L1142) but adapted for Leaflet
                                                    // We need to support 'linkedVerticesRef' too!
                                                    
                                                    const isDetached = e.originalEvent.altKey;
                                                    
                                                    setManualLots(prev => prev.map(l => {
                                                        if (isDetached) {
                                                            if (l.id === lot.id) {
                                                                if (Array.isArray(l.coordinates[0][0])) return l; // Skip Multi
                                                                const newCoords = [...(l.coordinates as [number, number][])];
                                                                newCoords[i] = [svgCoords.x, svgCoords.y];
                                                                const newCenter = calculateCenter(newCoords.map(p => ({x: p[0], y: p[1]})));
                                                                return { ...l, coordinates: newCoords, center: newCenter };
                                                            }
                                                            return l;
                                                        }
                                                        
                                                        // Shared Vertex Logic
                                                        const links = linkedVerticesRef.current.filter(link => link.lotId === l.id);
                                                        if (links.length > 0) {
                                                              if (Array.isArray(l.coordinates[0][0])) return l;
                                                              const newCoords = [...(l.coordinates as [number, number][])];
                                                              let changed = false;
                                                              links.forEach(link => {
                                                                  newCoords[link.vertexIndex] = [svgCoords.x, svgCoords.y];
                                                                  changed = true;
                                                              });
                                                              if (changed) {
                                                                  const newCenter = calculateCenter(newCoords.map(p => ({x: p[0], y: p[1]})));
                                                                  return { ...l, coordinates: newCoords, center: newCenter };
                                                              }
                                                        }
                                                        return l;
                                                    }));
                                                }
                                            },
                                            dragend: () => {
                                                setEditingVertexIndex(null);
                                                linkedVerticesRef.current = [];
                                            }
                                        }}
                                     />
                                 );
                             })
                        })}

                        {/* GeoJSON Lots */}
                        <GeoJSON
                            key={`${selectedLotId}-${highlightedLots.length}-${geoJsonVersion}`}
                            data={convertLotsToGeoJSON(mergedLots) as any}
                            style={(feature) => {
                                const isSelected = feature?.properties?.id === selectedLotId;
                                const isHighlighted = highlightedLotIds.has(feature?.properties?.id);
                                
                                const lotStatus = feature?.properties?.info?.status || 'neutro';
                                const isAvailable = feature?.properties?.info?.isAvailable;

                                let fillColor = '#64748b'; // Default Gray (Neutro)
                                let fillOpacity = lotOpacity;

                                if (isAvailable) {
                                    fillColor = '#22c55e'; // Green (Available)
                                    fillOpacity += 0.15;
                                } else if (lotStatus === 'ocupado') {
                                    fillColor = '#ef4444'; // Red
                                } else if (lotStatus === 'livre') {
                                    fillColor = '#eab308'; // Yellow (was Blue)
                                } else if (lotStatus === 'neutro') {
                                    fillColor = '#64748b'; // Gray
                                } else if (lotStatus === 'disponivel') { // Legacy fallback
                                     fillColor = '#22c55e';
                                     fillOpacity += 0.15;
                                } else if (lotStatus === 'vendido') { // Legacy fallback
                                    fillColor = '#ef4444';
                                } else if (lotStatus === 'reservado') { // Legacy fallback
                                    fillColor = '#eab308';
                                }

                                return {
                                    fillColor: isHighlighted ? '#a855f7' : (isSelected ? '#ef4444' : fillColor), // Selection overrides status? User said "when activated (available) always visible"
                                    weight: isHighlighted ? 3 : (isSelected ? 3 : 1),
                                    opacity: 1,
                                    color: 'white',
                                    fillOpacity: isHighlighted ? (lotOpacity + 0.3) : (isSelected ? (lotOpacity + 0.2) : fillOpacity)
                                };
                            }}
                            onEachFeature={(feature, layer) => {
                                layer.on({
                                    click: (e) => {
                                        // Intercept for Dev Tools in Leaflet Mode
                                        if (isDevMode && editorMode === 'merge') {
                                            e.originalEvent.stopPropagation();
                                            handleLotClickForMerge(feature.properties.id);
                                            return;
                                        }
                                        if (isDevMode && editorMode === 'delete') {
                                            e.originalEvent.stopPropagation();
                                            handleDeleteLot(feature.properties.id);
                                            return;
                                        }
                                        
                                        if (editorMode === 'split') {
                                            e.originalEvent.stopPropagation();
                                            if (!splitTargetLotId) {
                                                setSplitTargetLotId(feature.properties.id);
                                                setSplitLinePoints([]);
                                            }
                                            return;
                                        }

                                        const lot = manualLots.find(l => l.id === feature.properties.id);
                                        if (lot) onLotClick(lot);
                                    },
                                    mouseover: (e) => {
                                        e.target.setStyle({ fillOpacity: 0.9 });
                                    },
                                    mouseout: (e) => {
                                        const lotStartStatus = feature.properties.status || 'disponivel';
                                        let baseOpacity = lotOpacity;
                                        if (lotStartStatus === 'disponivel') baseOpacity += 0.2; // Make available lots pop more
                                        
                                        e.target.setStyle({ 
                                            fillOpacity: feature.properties.id === selectedLotId ? (lotOpacity + 0.3) : baseOpacity
                                        });
                                    }
                                });

                                const props = feature.properties;
                                layer.bindPopup(`
                                    <div style="font-family: sans-serif;">
                                        <strong>Quadra ${props.quadra} - Lote ${props.lote}</strong><br/>
                                        ${props.area ? `Área: ${props.area}m²<br/>` : ''}
                                        ${props.status ? `Status: ${props.status}` : ''}
                                    </div>
                                `);
                            }}
                        />

                        {/* Quadra Labels as Markers */}
                        {mapDataComplete.quadras.map(quadra => {
                             const centerGPS = svgToGeo(
                                Array.isArray(quadra.center) ? quadra.center[0] : quadra.center!.x,
                                Array.isArray(quadra.center) ? quadra.center[1] : quadra.center!.y
                             );
                            if (!centerGPS) return null;
                            
                            return (
                                <Marker
                                    key={`quadra-${quadra.id}`}
                                    position={[centerGPS.lat, centerGPS.lng]}
                                    icon={L.divIcon({
                                        className: 'custom-label',
                                        html: `
                                            <div style="
                                                background: black;
                                                color: white;
                                                width: 36px;
                                                height: 36px;
                                                border-radius: 50%;
                                                display: flex;
                                                align-items: center;
                                                justify-content: center;
                                                font-size: 11px;
                                                font-weight: bold;
                                                cursor: pointer;
                                                border: 2px solid white;
                                                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                                            ">
                                                Q${quadra.id}
                                            </div>
                                        `,
                                        iconSize: [36, 36],
                                        iconAnchor: [18, 18]
                                    })}
                                    eventHandlers={{
                                        click: () => {
                                            setActiveQuadraId(quadra.id);
                                        },
                                        mouseover: () => {
                                            if (!isMobile) {
                                                if (labelHoverTimeoutRef.current) {
                                                    clearTimeout(labelHoverTimeoutRef.current);
                                                    labelHoverTimeoutRef.current = null;
                                                }
                                                setHoveredQuadraLabel(quadra.id);
                                            }
                                        },
                                        mouseout: () => {
                                            if (!isMobile) {
                                                labelHoverTimeoutRef.current = setTimeout(() => {
                                                    setHoveredQuadraLabel(null);
                                                }, 300);
                                            }
                                        }
                                    }}
                                />
                            );
                        })}

                        {/* Lot Labels as Markers - Only for active quadra */}
                        {activeQuadraId && visibleLots.map(lot => {
                            const centerGPS = svgToGeo(
                                Array.isArray(lot.center) ? lot.center[0] : lot.center!.x,
                                Array.isArray(lot.center) ? lot.center[1] : lot.center!.y
                            );
                            if (!centerGPS) return null;
                            
                            return (
                                <Marker
                                    key={`lot-label-${lot.id}`}
                                    position={[centerGPS.lat, centerGPS.lng]}
                                    icon={L.divIcon({
                                        className: 'custom-label',
                                        html: `
                                            <div style="
                                                background: black;
                                                color: white;
                                                width: 36px;
                                                height: 36px;
                                                border-radius: 50%;
                                                display: flex;
                                                align-items: center;
                                                justify-content: center;
                                                font-size: 13px;
                                                font-weight: bold;
                                                border: 2px solid white;
                                                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                                            ">
                                                ${lot.lote}
                                            </div>
                                        `,
                                        iconSize: [36, 36],
                                        iconAnchor: [18, 18]
                                    })}
                                />
                            );
                        })}
                    </MapContainer>
                </div>
            ) : (
                /* SVG MODE - Custom map with original image */
                <TransformWrapper
                initialScale={initialMapScale}
                minScale={0.1}
                maxScale={20}
                centerOnInit={true}
                limitToBounds={false}
                onTransformed={(e) => setScale(e.state.scale)}
                // Capture Mouse Down for Distance Check
                onPanningStart={(e) => {
                    // We can't easily get clientX from here directly in all versions,
                    // but we can rely on the wrapper's onMouseDown/TouchStart if we attach it there.
                    // Actually, let's use the valid HTML handlers on the div or svg.
                    isDragging.current = true;
                }}
                onPanningStop={() => {
                    setTimeout(() => { isDragging.current = false; }, 50);
                }}
                ref={wrapperRef}
                disabled={false}
                panning={{ velocityDisabled: true }}
                alignmentAnimation={{ disabled: true }}
            >
                <TransformComponent
                    wrapperStyle={{ width: '100%', height: '100%' }}
                    contentStyle={{ width: `${MAP_BOUNDS.width}px`, height: `${MAP_BOUNDS.height}px` }}
                >
                    <svg
                        ref={svgRef}
                        viewBox={`${MAP_BOUNDS.minX} ${MAP_BOUNDS.minY} ${MAP_BOUNDS.width} ${MAP_BOUNDS.height}`}
                        style={{ width: '100%', height: '100%', display: 'block' }}
                        preserveAspectRatio="xMinYMin meet"

                        // CAPTURE MOUSE DOWN GLOBALLY ON SVG FOR DRAG GUARD
                        onMouseDown={(e) => {
                            dragStartRef.current = { x: e.clientX, y: e.clientY };
                            handleSVGMouseDown(e);
                        }}

                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onClick={handleMapClick}
                        onDoubleClick={handleDoubleClick}
                        className={`${editorMode === 'create-grid' || editorMode === 'draw-lot' || editorMode === 'edit-vertex' ? 'cursor-crosshair' : ''}`}
                    >
                        {/* SVG Filters for Shadow Effect */}
                        <defs>
                            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                                <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.3"/>
                            </filter>
                        </defs>

                        {editorMode === 'split' && splitLinePoints.map((p, i) => (
                             <circle key={i} cx={p.x} cy={p.y} r={5 / scale} fill="red" stroke="white" strokeWidth="2" />
                        ))}
                        {editorMode === 'split' && splitLinePoints.length === 1 && mousePos && (
                            <line 
                                x1={splitLinePoints[0].x} 
                                y1={splitLinePoints[0].y} 
                                x2={mousePos.x} 
                                y2={mousePos.y} 
                                stroke="red" 
                                strokeWidth={2 / scale} 
                                strokeDasharray="5,5" 
                            />
                        )}

                        <image
                            href={
                                activeLayer === 'custom' ? '/map-background-hq.jpg' :
                                activeLayer === 'satellite' ? '/map-background-satellite.jpg' :
                                '/map-background-hq.jpg' // 'base' (OSM): use original map as fallback for now
                            }
                            x={MAP_BOUNDS.minX}
                            y={MAP_BOUNDS.minY}
                            width={MAP_BOUNDS.width}
                            height={MAP_BOUNDS.height}
                            opacity={activeLayer === 'custom' ? 1.0 : 0.0}
                            preserveAspectRatio="none"
                        />

                        {/* LOD: Only show individual lots if scale > 0.4 */}
                        {visibleLots.map(lot => (
                            <LotPolygon
                                key={lot.id}
                                lot={lot}
                                isManual={true}
                                isSelected={selectedLotId === lot.id}
                                isHovered={hoveredLotId === lot.id}
                                isDeleteMode={editorMode === 'delete'}
                                isQuadraHighlighted={editorMode === 'delete' && deleteModeType === 'quadra' && hoveredQuadraId === lot.quadra}
                                isHighlighted={highlightedLotIds.has(lot.id)}
                                isDevMode={isDevMode}
                                isSplitTarget={lot.id === splitTargetLotId} // PASS PROP
                                onContextMenu={handleLotContextMenu} // Context Menu Support
                                fillColor={
                                    lot.info?.isAvailable ? '#22c55e' :
                                    lot.info?.status === 'ocupado' ? '#ef4444' :
                                    lot.info?.status === 'livre' ? '#eab308' :
                                    lot.info?.status === 'neutro' ? '#64748b' :
                                    lot.info?.status === 'disponivel' ? '#22c55e' : // Legacy
                                    lot.info?.status === 'vendido' ? '#ef4444' : // Legacy
                                    lot.info?.status === 'reservado' ? '#eab308' : // Legacy
                                    '#64748b' // Default
                                }
                                fillOpacityOverride={
                                    lot.info?.isAvailable || lot.info?.status === 'disponivel' ? (lotOpacity + 0.15) : undefined
                                }
                                onClick={(e) => {
                                    // Intercept for Merge
                                    if (isDevMode && editorMode === 'merge') {
                                        // We need to know WHICH lot was clicked. 
                                        // The 'handleLotClick' function signature in this file (InteractiveMap) 
                                        // seems to be (event: any, lot: Lot)? No, look at previous view.
                                        // Line 1533 says: onClick={handleLotClick}
                                        // Wait, LotPolygon's onClick prop signature?
                                        // Checking InteractiveMap.tsx earlier view: 
                                        // <LotPolygon ... onClick={(e, l) => ...} /> was seen in Step 1.
                                        // But recent view at Step 488 shows `onClick={handleLotClick}`.
                                        // This means `handleLotClick` handles the event?
                                        // Let's check `handleLotClick` definition.
                                        // Assuming `handleLotClick` takes (event, lot) or (lot, event)?
                                        // Standard from LotPolygon is usually (e, lot).
                                        // I will wrap it assuming (e, lot) is passed by LotPolygon.
                                        // Actually `LotPolygon` typically passes `(e, lot)`.
                                        // Let's assume `handleLotClick` signature matches.
                                        
                                        // FIX: We are inside `visibleLots.map(lot => ...`
                                        // We can pass an arrow function safely.
                                        e.stopPropagation();
                                        handleLotClickForMerge(lot.id);
                                        return;
                                    }
                                    if (isDevMode && editorMode === 'delete') {
                                         e.stopPropagation();
                                         handleDeleteLot(lot.id);
                                         return;
                                    }
                                    handleLotClick(e, lot);
                                }}
                                onMouseEnter={(id, event) => {
                          setHoveredLotId(id);
                          
                          // Cancel any pending close timer if we re-enter or switch lots
                          if (tooltipCloseTimeoutRef.current) {
                              clearTimeout(tooltipCloseTimeoutRef.current);
                              tooltipCloseTimeoutRef.current = null;
                          }



                          if (editorMode !== 'delete' && editorMode !== 'draw-lot' && editorMode !== 'create-grid') {
                              if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                              hoverTimeoutRef.current = setTimeout(() => {
                                  const hovered = manualLots.find(l => l.id === id);
                                  if (hovered) {
                                      setTooltipLot(hovered);
                                      setTooltipPosition({ x: event.clientX, y: event.clientY }); 
                                  }
                              }, 300);
                          }
                      }}
                      onMouseLeave={() => {
                          setHoveredLotId(null);
                          if (hoverTimeoutRef.current) {
                              clearTimeout(hoverTimeoutRef.current);
                              hoverTimeoutRef.current = null;
                          }
                          // Extended Grace Period for Tooltip Entry
                          if (tooltipCloseTimeoutRef.current) clearTimeout(tooltipCloseTimeoutRef.current);
                          tooltipCloseTimeoutRef.current = setTimeout(() => {
                              setTooltipLot(null);
                          }, 300); // 300ms to move to tooltip

                          // QUADRA PERSISTENCE: If we leave a lot in the ACTIVE quadra, allow quadra tooltip to timeout (unless we enter another lot/label)
                          if (hoveredQuadraLabel === lot.quadra) {
                               quadraHoverTimeoutRef.current = setTimeout(() => {
                                  setHoveredQuadraLabel(null);
                              }, 5000); 
                          }
                      }}
                                lotsData={lotsData}
                            />
                        ))}

                        {/* If Zoomed Out, maybe show Quadra placeholders?
                  Already handle Quadra Labels below.
                  Maybe just relying on labels is enough for "First Load" speed.
              */}

              {/* 4. Layer: Quadra Labels (Visible by default) */}
   {mapDataComplete.quadras.map(q => {
      // Logic for Fade
      const isHovered = q.id === activeQuadraId; // OR if we hover actual label area
      // If we are zoomed in properly, or always? 
      // User says "Fade on Hover" -> Opacity 0.1
      
      const opacity = (hoveredQuadraLabel === q.id && !isMobile) ? 0.3 : 0.8; 

      // Mobile: Larger Font, Desktop: Normal
      // Mobile: Scale inversely to maintain fixed pixel size (like Leaflet markers)
      // Reduced font size further as requested "pouquinho de nada" (was 10px desktop, 18 mobile)
      const fontSize = isMobile ? `${12 / scale}px` : "7px";
      const fontWeight = isMobile ? "900" : "bold";
      const radius = isMobile ? (15 / scale) : 9; // Reduced bubble size slightly too
      
      if (!q.center) return null;

      const [cx, cy] = Array.isArray(q.center) 
          ? [q.center[0], q.center[1]] 
          // @ts-ignore
          : [q.center.x, q.center.y];

      // Use Calculated Center if available (Better precision based on actual lots)
      // Otherwise fall back to metadata center
      const finalCx = quadraCenters[q.id]?.x || cx;
      const finalCy = quadraCenters[q.id]?.y || cy;

      // Dev Mode: Move Label Up (negative Y) so it doesn't block center lots
      // User request: "no modo dev on o label das quadras ficam um pouco mais a cima"
      // BUT user also said "coloca os labels das quadras no centro de seus respectivos lotes tambem"
      // So if we have a calculated center, we use it directly. If we are just shifting the main center, maybe apply offset?
      // Let's stick to the Centroid. If Dev Mode, maybe we still shift up slightly to not cover the EXCACT center lot?
      // User said "ignorado e vai para o fundo", so maybe covering is fine if ghostable.
      // Let's keeping the Y offset for Dev Mode just in case it helps visibility, but maybe reduce it since centroid is better.
      // Or remove it if Centroid is perfect. 
      // "volta o label para cima da quadra" -> implies ABOVE (layer-wise) or GEOGRAPHICALLY?
      // "coloca os labels das quadras no centro de seus respectivos lotes" -> GEOGRAPHIC CENTROID.
      
      const adjustedCy = finalCy;
      const adjustedCx = finalCx;
      
      const isGhost = isDevMode && q.id === ghostQuadraId; // Only if in Dev Mode AND matching ID

      return (
          <g 
             key={q.id} 
             style={{ 
                 pointerEvents: isGhost ? 'none' : 'all', // Ghost Mode: Click through!
                 cursor: 'pointer',
                 transition: 'opacity 0.2s ease',
                 opacity: isGhost ? 0.2 : opacity, // Ghost Mode: Faint
             }}
             onMouseDown={(e) => handleMouseDown(e, q.id)}
             onClick={(e) => {
                 e.stopPropagation();
                 handleQuadraClick(q.id);
             }}
             onMouseEnter={() => {
                 if (!isMobile) {
                     if (labelHoverTimeoutRef.current) {
                         clearTimeout(labelHoverTimeoutRef.current);
                         labelHoverTimeoutRef.current = null;
                     }
                     setHoveredQuadraLabel(q.id);
                 }
             }}
             onMouseLeave={() => {
                 if (!isMobile) {
                     labelHoverTimeoutRef.current = setTimeout(() => {
                         setHoveredQuadraLabel(null);
                     }, 300);
                 }
             }}
          >
              <circle 
                  cx={adjustedCx} 
                  cy={adjustedCy} 
                  r={radius} 
                  fill="black" 
                  stroke="white"
                  strokeWidth={isMobile ? (3 / scale) : "0"}
                  filter={isMobile ? "url(#shadow)" : "none"}
              />
              <text
                  x={adjustedCx}
                  y={adjustedCy}
                  textAnchor="middle"
                  dy=".35em"
                  fill="white"
                  fontSize={fontSize} // Dynamic Font
                  fontWeight={fontWeight}
                  style={{ userSelect: "none" }}
              >
                  {`Q${q.id}`}
              </text>
          </g>
      );
  })}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        
  {/* 5. Layer: Lot Labels (Only visible when Quadra Active or High Zoom) */}
  {/* Desktop: Scale > 0.6 check. Mobile: Always show if in visibleLots (which is filtered by Quadra) */}
  {(scale > 0.6 || isMobile) && visibleLots.map(lot => {
      const center = lot.center;
      if (!center) return null;

      const [cx, cy] = Array.isArray(center) 
          ? [center[0], center[1]] 
          : [center.x, center.y];

      if (cx === 0 && cy === 0) return null;

      // Styling Constants
      // DESKTOP DEFAULTS
      let circleRadius = 14 / scale;
      let fontSize = 12 / scale;
      let fontColor = "white";
      let circleFill = editorMode === 'delete' ? "red" : "black";

      // MOBILE OVERRIDES
      // Scale inversely to maintain fixed pixel size (like Leaflet markers)
      if (isMobile) {
          circleRadius = 18 / scale; // 18px fixed size on screen
          fontSize = 14 / scale; 
          fontColor = "white";
          circleFill = "black";
      }

      return (
          <g 
              key={`label-${lot.id}`} 
              style={{ pointerEvents: editorMode === 'delete' ? 'auto' : 'none', cursor: editorMode === 'delete' ? 'pointer' : 'default' }}
              onClick={(e) => {
                  if (editorMode === 'delete') {
                      e.stopPropagation();
                      e.preventDefault();
                      handleDeleteLot(lot.id); // Assuming this is in scope
                  }
              }}
          >
              <circle 
                  cx={cx} 
                  cy={cy} 
                  r={circleRadius} 
                  fill={circleFill} 
                  opacity={isMobile ? 0.9 : 0.7}
                  stroke={isMobile ? "white" : "none"}
                  strokeWidth={isMobile ? (2 / scale) : 0}
                  filter={isMobile ? "url(#shadow)" : "none"}
              />
              <text 
                  x={cx} 
                  y={cy} 
                  fill={fontColor} 
                  fontSize={fontSize} 
                  textAnchor="middle" 
                  dy=".35em" 
                  fontWeight="bold"
              >
                  {lot.lote}
              </text>
          </g>
      );
  })}
              {gridPoints.map((p, i) => (
                  <g key={i}>
                      <circle cx={p.x} cy={p.y} r={8 / scale} fill="orange" stroke="black" strokeWidth={1} />
                      <text x={p.x} y={p.y} fill="black" fontSize={10 / scale} textAnchor="middle" dy=".3em" fontWeight="bold">{i+1}</text>
                   </g>
              ))}
              
              {gridPreviewLots.map((lot, idx) => (
                   <polygon
                      key={`preview-${idx}`}
                      points={lot.coordinates.map((p) => p.join(",")).join(" ")}
                      fill="rgba(0, 255, 0, 0.3)"
                      stroke="green"
                      strokeWidth={1}
                      strokeDasharray="2"
                    />
              ))}

              {editorMode === 'draw-lot' && currentPoints.length > 0 && mousePos && (
                  <line 
                      x1={currentPoints[currentPoints.length - 1].x} 
                      y1={currentPoints[currentPoints.length - 1].y} 
                      x2={mousePos.x} 
                      y2={mousePos.y} 
                      stroke="blue" 
                      strokeWidth="2" 
                      strokeDasharray="4"
                  />
              )}

              {currentPoints.map((p, i) => (
                  <circle 
                      key={i} 
                      cx={p.x} 
                      cy={p.y} 
                      r={5 / scale} 
                      fill="blue"
                      stroke="white"
                      strokeWidth={1}
                      onMouseDown={(e) => handlePointMouseDown(e)}
                      className="cursor-move"
                  />
              ))}
              
              {currentPoints.length > 1 && (
                  <polyline 
                      points={currentPoints.map(p => `${p.x},${p.y}`).join(" ")} 
                      fill="none" 
                      stroke="blue" 
                      strokeWidth="2"
                  />
              )}

              {snapPoint && (
                  <circle cx={snapPoint.x} cy={snapPoint.y} r={6 / scale} fill="none" stroke="yellow" strokeWidth={2} />
              )}

                {/* Vertex Editors */}
                 {editorMode === 'edit-vertex' && manualLots.map(lot => {
                     if (selectedLotForEditing && lot.id !== selectedLotForEditing) return null;
                     if (!selectedLotForEditing && !manualLotIds.has(lot.id)) return null; 

                     // Skip MultiPolygons for now as vertex editing is not yet supported for them
                     if (lot.coordinates.length > 0 && Array.isArray(lot.coordinates[0][0])) return null;

                     return (lot.coordinates as [number, number][]).map((p, i) => (
                         <circle
                             key={`${lot.id}-v-${i}`}
                             cx={p[0]}
                             cy={p[1]}
                             r={6 / scale}
                             fill={selectedLotForEditing === lot.id ? "yellow" : "rgba(255,255,0,0.5)"}
                             stroke="black"
                             strokeWidth={1}
                             className="cursor-move"
                             onMouseDown={(e) => handleVertexMouseDown(e, lot.id, i)}
                         />
                     ));
                 })}


            </svg>
          </TransformComponent>
        </TransformWrapper>
            )}
            
        {/* --- UI CONTROLS (Dev Mode) --- */}
        
        {/* DEV MODE TOGGLE - Moved to Top Left to avoid conflict with LayerSelector */}
        <div className="absolute top-4 left-4 z-[1000]">
            <button 
                className={`px-4 py-2 rounded-xl shadow-lg border backdrop-blur-md font-bold transition-all ${isDevMode ? 'bg-red-500/90 border-red-400 text-white' : 'bg-black/40 border-white/10 text-white hover:bg-black/60'}`}
                onClick={() => setIsDevMode(!isDevMode)}
            >
                {isDevMode ? 'DEV MODE ON' : 'DEV MODE OFF'}
            </button>
        </div>

        {/* MOBILE: Floating Action Button to open drawer */}
        {isDevMode && isMobile && (
            <button
                className="fixed bottom-24 right-4 z-[1001] bg-blue-600 text-white p-4 rounded-full shadow-2xl active:scale-95 transition-transform"
                onClick={() => setShowMobileDevTools(!showMobileDevTools)}
                aria-label="Abrir ferramentas"
            >
                🛠️
            </button>
        )}

        {/* MOBILE: Bottom Drawer with DevTools */}
        {isDevMode && isMobile && showMobileDevTools && (
            <>
                {/* Backdrop */}
                <div 
                    className="fixed inset-0 bg-black/50 z-[1002]"
                    onClick={() => setShowMobileDevTools(false)}
                />
                
                {/* Drawer */}
                <div className="fixed inset-x-0 bottom-0 z-[1003] bg-white rounded-t-3xl shadow-2xl max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom-full">
                    {/* Handle */}
                    <div className="flex justify-center pt-3 pb-2">
                        <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
                    </div>

                    {/* Content */}
                    <div className="p-4 pb-8">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-800">Ferramentas de Desenvolvimento</h3>
                            <div className="text-sm font-bold bg-gray-200 px-3 py-1 rounded-full text-gray-600">
                                {manualLots.length} lotes
                            </div>
                        </div>

                        {/* Tool Buttons - Grid layout for mobile */}
                        <div className="grid grid-cols-3 gap-3 mb-4">
                            <button 
                                className={`flex flex-col items-center justify-center p-4 rounded-lg min-h-[80px] ${editorMode === 'move' ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500' : 'bg-gray-100 text-gray-700'}`}
                                onClick={() => {
                                    setEditorMode('move');
                                    setShowMobileDevTools(false);
                                }}
                            >
                                <span className="text-2xl mb-1">✋</span>
                                <span className="text-xs font-semibold text-center">Mover</span>
                            </button>
                            <button 
                                className={`flex flex-col items-center justify-center p-4 rounded-lg min-h-[80px] ${editorMode === 'draw-lot' ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500' : 'bg-gray-100 text-gray-700'}`}
                                onClick={() => {
                                    setEditorMode('draw-lot');
                                    setShowMobileDevTools(false);
                                }}
                            >
                                <span className="text-2xl mb-1">✏️</span>
                                <span className="text-xs font-semibold text-center">Desenhar</span>
                            </button>
                            <button 
                                className={`flex flex-col items-center justify-center p-4 rounded-lg min-h-[80px] ${editorMode === 'create-grid' ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500' : 'bg-gray-100 text-gray-700'}`}
                                onClick={() => {
                                    setEditorMode('create-grid');
                                    setShowMobileDevTools(false);
                                }}
                            >
                                <span className="text-2xl mb-1">▦</span>
                                <span className="text-xs font-semibold text-center">Grade</span>
                            </button>
                            <button 
                                className={`flex flex-col items-center justify-center p-4 rounded-lg min-h-[80px] ${editorMode === 'edit-vertex' ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500' : 'bg-gray-100 text-gray-700'}`}
                                onClick={() => {
                                    setEditorMode('edit-vertex');
                                    setShowMobileDevTools(false);
                                }}
                            >
                                <span className="text-2xl mb-1">🔧</span>
                                <span className="text-xs font-semibold text-center">Editar</span>
                            </button>
                            <button 
                                className={`flex flex-col items-center justify-center p-4 rounded-lg min-h-[80px] ${editorMode === 'split' ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500' : 'bg-gray-100 text-gray-700'}`}
                                onClick={() => {
                                    setEditorMode('split');
                                    setShowMobileDevTools(false);
                                }}
                            >
                                <span className="text-2xl mb-1">✂️</span>
                                <span className="text-xs font-semibold text-center">Dividir</span>
                            </button>
                            <button 
                                className={`flex flex-col items-center justify-center p-4 rounded-lg min-h-[80px] ${editorMode === 'delete' ? 'bg-red-100 text-red-700 ring-2 ring-red-500' : 'bg-gray-100 text-gray-700'}`}
                                onClick={() => {
                                    setEditorMode('delete');
                                    setShowMobileDevTools(false);
                                }}
                            >
                                <span className="text-2xl mb-1">🗑️</span>
                                <span className="text-xs font-semibold text-center">Apagar</span>
                            </button>
                            <button 
                                className={`flex flex-col items-center justify-center p-4 rounded-lg min-h-[80px] ${editorMode === 'edit-info' ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500' : 'bg-gray-100 text-gray-700'}`}
                                onClick={() => {
                                    setEditorMode('edit-info');
                                    setShowMobileDevTools(false);
                                }}
                            >
                                <span className="text-2xl mb-1">ℹ️</span>
                                <span className="text-xs font-semibold text-center">Info</span>
                            </button>
                        </div>

                        {/* Contextual Tools for active mode */}
                        {editorMode === 'draw-lot' && (
                            <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200 mb-4">
                                <div className="text-sm font-bold text-blue-900 mb-3">Modo: Desenhar Lote</div>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-bold mb-1 text-gray-700">Quadra</label>
                                        <input 
                                            className="w-full border-2 border-gray-300 p-3 rounded-lg text-base" 
                                            value={activeQuadra}
                                            onChange={(e) => setActiveQuadra(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold mb-1 text-gray-700">Próximo Lote</label>
                                        <input 
                                            className="w-full border-2 border-gray-300 p-3 rounded-lg text-base" 
                                            value={nextLotNumber}
                                            onChange={(e) => setNextLotNumber(e.target.value)}
                                        />
                                    </div>
                                    <button 
                                        className="w-full bg-green-600 text-white p-3 rounded-lg text-base font-bold active:scale-95 transition-transform" 
                                        onClick={() => {
                                            finishDrawingLot();
                                            setShowMobileDevTools(false);
                                        }}
                                    >
                                        ✓ Finalizar
                                    </button>
                                    <button 
                                        className="w-full bg-gray-300 text-gray-800 p-3 rounded-lg text-base font-bold active:scale-95 transition-transform" 
                                        onClick={() => setCurrentPoints([])}
                                    >
                                        ✕ Limpar
                                    </button>
                                </div>
                            </div>
                        )}

                        {editorMode === 'delete' && (
                            <div className="p-4 bg-red-50 rounded-lg border-2 border-red-200 mb-4">
                                <div className="text-sm font-bold text-red-900 mb-3">Modo: Apagar</div>
                                <div className="flex gap-2 mb-3">
                                    <button 
                                        className={`flex-1 p-3 rounded-lg text-sm font-bold ${deleteModeType === 'lot' ? 'bg-red-600 text-white' : 'bg-white text-gray-700 border-2 border-gray-300'}`}
                                        onClick={() => setDeleteModeType('lot')}
                                    >
                                        Lote Individual
                                    </button>
                                    <button 
                                        className={`flex-1 p-3 rounded-lg text-sm font-bold ${deleteModeType === 'quadra' ? 'bg-red-600 text-white' : 'bg-white text-gray-700 border-2 border-gray-300'}`}
                                        onClick={() => setDeleteModeType('quadra')}
                                    >
                                        Quadra Inteira
                                    </button>
                                </div>
                                <p className="text-xs text-gray-600 leading-relaxed">
                                    {deleteModeType === 'quadra' 
                                        ? "Toque em qualquer lote para apagar TODA a quadra." 
                                        : "Toque em um lote para apagá-lo individualmente."}
                                </p>
                            </div>
                        )}

                        {editorMode === 'split' && splitTargetLotId && (
                            <div className="p-4 bg-orange-50 rounded-lg border-2 border-orange-200 mb-4">
                                <div className="text-sm font-bold text-orange-900 mb-3">Modo: Dividir Lote</div>
                                <div className="text-xs text-gray-700 mb-3">
                                    Toque em 2 pontos para traçar a linha de corte.
                                </div>
                                <button 
                                    className="w-full bg-red-500 text-white p-3 rounded-lg text-base font-bold active:scale-95 transition-transform" 
                                    onClick={() => {
                                        setSplitTargetLotId(null);
                                        setSplitLinePoints([]);
                                    }}
                                >
                                    ✕ Cancelar Corte
                                </button>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="space-y-2 border-t pt-4 mt-4">
                            <button
                                className="w-full bg-purple-600 text-white p-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                                onClick={() => {
                                    setShowQuickFill(true);
                                    setShowMobileDevTools(false);
                                }}
                            >
                                <span>⚡</span>
                                <span>Preenchimento Rápido</span>
                            </button>
                            <button
                                className="w-full bg-green-600 text-white p-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                                onClick={() => {
                                    setShowImportModal(true);
                                    setShowMobileDevTools(false);
                                }}
                            >
                                <span>📁</span>
                                <span>Importar Excel/JSON</span>
                            </button>
                            <button
                                className="w-full bg-blue-600 text-white p-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                                onClick={() => {
                                    setShowGPSCalibration(true);
                                    setShowMobileDevTools(false);
                                }}
                            >
                                <span>📍</span>
                                <span>Calibrar GPS</span>
                            </button>
                            

                            <div className="grid grid-cols-2 gap-2 pt-2">
                                <button
                                    className="col-span-2 bg-gray-700 text-white p-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-transform"
                                    onClick={() => {
                                        onExportBackup?.();
                                        setShowMobileDevTools(false);
                                    }}
                                >
                                    <span>💾</span>
                                    <span>Backup Local</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        )}

        {/* DESKTOP: Fixed panel top-right */}
        {isDevMode && !isMobile && (
            <div className="absolute top-16 right-4 flex flex-col gap-2 z-[1000] items-end">
                <div className="bg-white p-3 rounded shadow flex flex-col gap-2 animate-in fade-in slide-in-from-right-10">
                    <div className="flex justify-between items-center mb-1">
                        <div className="text-xs font-bold text-gray-500">FERRAMENTAS</div>
                         <div className="text-[10px] font-bold bg-gray-200 px-2 py-0.5 rounded text-gray-600">
                            Total: {manualLots.length}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {/* UNDO BUTTON */}
                        <button 
                            className={`p-2 rounded ${!canUndo ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'}`}
                            title="Desfazer (Undo)"
                            onClick={undo}
                            disabled={!canUndo}
                        >
                           ↩️
                        </button>

                        <button  
                            className={`p-2 rounded ${editorMode === 'move' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'}`}
                            title="Mover Mapa"
                            onClick={() => setEditorMode('move')}
                        >
                           ✋
                        </button>
                         <button 
                            className={`p-2 rounded ${editorMode === 'draw-lot' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'}`}
                             title="Desenhar Lote (Pontos)"
                             onClick={() => setEditorMode('draw-lot')}
                        >
                           ✏️
                        </button>
                         <button 
                            className={`p-2 rounded ${editorMode === 'create-grid' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'}`}
                             title="Grade Automática (3 Pontos)"
                             onClick={() => setEditorMode('create-grid')}
                        >
                           ▦
                        </button>
                         <button 
                            className={`p-2 rounded ${editorMode === 'edit-vertex' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'}`}
                             title="Editar Vértices"
                             onClick={() => setEditorMode('edit-vertex')}
                        >
                           🔧
                        </button>

                         {/* MERGE TOOL */}
                        <div className="w-px h-6 bg-gray-300 mx-1"></div>
                        <button 
                            className={`p-2 rounded ${editorMode === 'merge' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100'}`}
                             title="Unir Lotes (Merge)"
                             onClick={() => {
                                 setEditorMode('merge');
                                 setSelectedLotsForMerge([]);
                             }}
                        >
                           🔗
                        </button>
                         <button 
                            className={`p-2 rounded ${editorMode === 'split' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100'}`}
                             title="Dividir Lote (Split)"
                             onClick={() => {
                                 setEditorMode('split');
                                 setSplitTargetLotId(null);
                                 setSplitLinePoints([]);
                             }}
                        >
                           ✂️
                        </button>
                        
                        {/* SPLIT CANCEL (Contextual for Desktop) */}
                        {editorMode === 'split' && splitTargetLotId && (
                             <button 
                                className="p-2 rounded bg-red-100 text-red-700 animate-in fade-in zoom-in"
                                title="Cancelar Corte"
                                onClick={() => {
                                    setSplitTargetLotId(null);
                                    setSplitLinePoints([]);
                                }}
                            >
                               ✕
                            </button>
                        )}
                         <button 
                            className={`p-2 rounded ${editorMode === 'delete' ? 'bg-red-100 text-red-700' : 'bg-gray-100'}`}
                             title="Apagar (Lote/Quadra)"
                             onClick={() => setEditorMode('delete')}
                        >
                           🗑️
                        </button>
                         <button 
                            className={`p-2 rounded ${editorMode === 'edit-info' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'}`}
                             title="Editar Info (Número)"
                             onClick={() => setEditorMode('edit-info')}
                        >
                           ℹ️
                        </button>
                    </div>

                     <div className="pt-2 border-t border-gray-200 mt-2 flex gap-2 justify-end">
                        {/* Dev Tools Footer */}
                    </div>

                    {/* CONTEXTUAL TOOLBARS */}
                    {editorMode === 'draw-lot' && (
                         <div className="flex flex-col gap-2 mt-2 border-t pt-2">
                             <div className="text-xs">Quadra Atual</div>
                             <input 
                                 className="border p-1 rounded w-full text-sm" 
                                 value={activeQuadra}
                                 onChange={(e) => setActiveQuadra(e.target.value)}
                             />
                              <div className="text-xs">Próximo Lote</div>
                             <input 
                                 className="border p-1 rounded w-full text-sm" 
                                 value={nextLotNumber}
                                 onChange={(e) => setNextLotNumber(e.target.value)}
                             />
                             <button className="bg-green-500 text-white p-1 rounded text-sm w-full" onClick={finishDrawingLot}>
                                 Finalizar (Enter)
                             </button>
                             <button className="bg-gray-300 text-black p-1 rounded text-sm w-full" onClick={() => setCurrentPoints([])}>
                                 Limpar (Esc)
                             </button>
                             <div className="text-[10px] text-gray-500 text-center">
                                 Clique ou Duplo-Clique para fechar.
                             </div>
                         </div>
                    )}

                    {editorMode === 'delete' && (
                        <div className="flex flex-col gap-2 mt-2 border-t pt-2">
                            <div className="text-xs font-bold">Modo de Apagar</div>
                            <div className="flex gap-2 text-xs w-full">
                                <button 
                                    className={`flex-1 px-2 py-1 rounded border ${deleteModeType === 'lot' ? 'bg-red-500 text-white font-bold' : 'bg-gray-100 text-gray-700'}`}
                                    onClick={() => setDeleteModeType('lot')}
                                >
                                    Lote
                                </button>
                                <button 
                                    className={`flex-1 px-2 py-1 rounded border ${deleteModeType === 'quadra' ? 'bg-red-500 text-white font-bold' : 'bg-gray-100 text-gray-700'}`}
                                    onClick={() => setDeleteModeType('quadra')}
                                >
                                    Quadra Inteira
                                </button>
                            </div>

                            <div className="text-[10px] text-gray-500 leading-tight">
                                {deleteModeType === 'quadra' 
                                    ? "Cuidado! Clique em um lote para apagar TODOS da mesma Quadra." 
                                    : "Clique em um lote para apagá-lo individualmente."}
                            </div>
                            
                            {/* Manual Text Input for Unclickable Lots */}
                            {deleteModeType === 'quadra' && (
                                <div className="mt-2 pt-2 border-t border-gray-200">
                                    <div className="text-[10px] font-bold text-red-600 mb-1">Apagar por Nome (Emergência)</div>
                                    <div className="flex gap-1">
                                        <input 
                                            id="manualQuadraDelInput"
                                            className="w-full border p-1 rounded text-xs" 
                                            placeholder="Ex: 41"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    document.getElementById('manualDelBtn')?.click();
                                                }
                                            }}
                                        />
                                        <button 
                                            id="manualDelBtn"
                                            className="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold"
                                            onClick={() => {
                                                try {
                                                    const inputEl = document.getElementById('manualQuadraDelInput') as HTMLInputElement;
                                                    const val = inputEl?.value;
                                                    
                                                    if(!val) return;

                                                    // Helper to normalize "Quadra 41", "41", "q41" -> "41"
                                                    const normalize = (s: any) => String(s).toLowerCase().replace(/quadra/g, '').replace(/q/g, '').trim();
                                                    
                                                    const targetQ = normalize(val);
                                                    
                                                    const lotsToDelete = manualLots.filter(l => normalize(l.quadra) === targetQ);
                                                    const count = lotsToDelete.length;
                                                    
                                                    console.log(`Searching for Quadra matching normalized "${targetQ}"... Found ${count} lots.`);
                                                    
                                                    if (count === 0) {
                                                        alert(`Nenhum lote encontrado na Quadra "${val}" (Normalizado: ${targetQ}).\nVerifique se o número está correto.`);
                                                        return;
                                                    }

                                                    if (window.confirm(`EMERGÊNCIA: Apagar toda a Quadra ${val}? (${count} lotes encontrados)`)) {
                                                        const deletedIds = lotsToDelete.map(l => l.id);
                                                        
                                                        // Filter out the deleted lots
                                                        const remainingLots = manualLots.filter(l => normalize(l.quadra) !== targetQ);
                                                        setManualLots(remainingLots);
                                                        
                                                        if (onDeleteIds) {
                                                            console.log(`Propagating deletion of ${deletedIds.length} IDs.`);
                                                            onDeleteIds(deletedIds);
                                                        } else {
                                                            console.error("onDeleteIds prop is missing in InteractiveMap!");
                                                        }
                                                        
                                                        inputEl.value = '';
                                                        // Use timeout to allow UI render before alert
                                                        setTimeout(() => alert(`Sucesso! ${count} lotes removidos.`), 100);
                                                    } else {
                                                        console.log("Deletion cancelled by user.");
                                                    }
                                                } catch (err) {
                                                    console.error("Error in manual deletion:", err);
                                                    alert("Ocorreu um erro ao tentar apagar. Verifique o console.");
                                                }
                                            }}
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>



            {/* MOVED: Calibration Panel */}
            <div className={`bg-white rounded shadow-lg z-50 w-64 border-2 border-orange-500 transition-all duration-300 ${isCalibrationCollapsed ? 'h-12 overflow-hidden' : 'p-3'}`}>
                <div 
                    className="flex justify-between items-center cursor-pointer p-3 bg-orange-50 hover:bg-orange-100"
                    onClick={() => setIsCalibrationCollapsed(!isCalibrationCollapsed)}
                >
                     <h4 className="font-bold text-sm text-orange-700 m-0">Calibrar Centralização</h4>
                     <span className="text-orange-700 font-bold">{isCalibrationCollapsed ? '▼' : '▲'}</span>
                </div>

                {!isCalibrationCollapsed && (
                    <div className="mt-2 animate-in fade-in slide-in-from-top-2">
                        <div className="text-[10px] text-gray-500 mb-2">
                            Ajuste os sliders para alinhar o zoom.
                        </div>
                        
                        <div className="mb-2">
                            <label className="block text-xs font-bold">Offset X: {centeringOffset.x}px</label>
                            <input 
                                type="range" min="-2000" max="2000" 
                                value={centeringOffset.x}
                                onChange={(e) => updateCenteringOffset({...centeringOffset, x: Number(e.target.value)})}
                                className="w-full"
                            />
                        </div>

                        <div className="mb-2">
                            <label className="block text-xs font-bold">Offset Y: {centeringOffset.y}px</label>
                            <input 
                                type="range" min="-2000" max="2000" 
                                value={centeringOffset.y}
                                onChange={(e) => updateCenteringOffset({...centeringOffset, y: Number(e.target.value)})}
                                className="w-full"
                            />
                        </div>

                {/* Export Calibration Buttons */}
                <div className="pt-3 border-t border-gray-300 space-y-2">
                    <div className="text-xs font-bold text-gray-700 mb-2">📥 Exportar Calibragens</div>
                    
                    <button 
                        className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-bold shadow"
                        onClick={() => {
                            try {
                                const configJson = exportCalibrationConfig();
                                
                                const blob = new Blob([configJson], { type: 'application/json' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = 'gpsCalibration.json';
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                                
                                alert('✅ GPS exportado! Salve em: client/src/config/gpsCalibration.json');
                            } catch (error) {
                                console.error('Erro ao exportar GPS:', error);
                                alert('❌ Erro ao exportar GPS. Verifique se calibrou 3 pontos.');
                            }
                        }}
                    >
                        📍 Exportar GPS
                    </button>
                    
                    <button 
                        className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold shadow"
                        onClick={exportCenteringConfig}
                    >
                        🎯 Exportar Centralização
                    </button>
                    
                    <div className="text-[9px] text-gray-500 text-center italic mt-1">
                        Após exportar, salve os arquivos em client/src/config/
                    </div>
                </div>

                <button 
                    className="w-full bg-orange-600 text-white text-xs font-bold py-1 rounded mt-2"
                    onClick={() => alert(activeQuadraId ? "Clique em uma Quadra para testar!" : "Selecione uma quadra primeiro.")}
                >
                    Testar Alinhamento
                </button>
                </div>
            )}
            </div>

            <div className="flex flex-col gap-2 w-full">
                <button
                    className="bg-purple-600 text-white px-3 py-1 rounded shadow-lg text-sm z-50 hover:bg-purple-700 w-full flex items-center justify-center gap-1"
                    onClick={() => setShowQuickFill(true)}
                >
                    ⚡ Preenchimento Rápido
                </button>
                <button
                    className="bg-green-600 text-white px-3 py-1 rounded shadow-lg text-sm z-50 hover:bg-green-700 w-full flex items-center justify-center gap-1"
                    onClick={() => setShowImportModal(true)}
                >
                    📁 Importar Excel/Json
                </button>
                <button
                    className="bg-blue-600 text-white px-3 py-1 rounded shadow-lg text-sm z-50 hover:bg-blue-700 w-full flex items-center justify-center gap-1"
                    onClick={() => setShowGPSCalibration(true)}
                >
                    📍 Calibrar GPS
                </button>
                
                {/* NEW SYNC & BACKUP BUTTONS */}
                <div className="grid grid-cols-1 gap-2 mt-1 pt-2 border-t border-gray-200">
                     <button
                        className="bg-gray-700 text-white px-2 py-1.5 rounded shadow text-[10px] font-bold z-50 hover:bg-gray-800 flex items-center justify-center gap-1"
                        onClick={onExportBackup}
                        title="Salvar backup localmente"
                    >
                        💾 Backup Local
                    </button>
                </div>
            </div>
        </div>
        )}


            {/* MERGE ACTION PANEL */}
            {isDevMode && editorMode === 'merge' && (
                <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur shadow-lg border border-indigo-200 rounded-lg p-3 flex items-center gap-4 z-[1000]">
                    <div className="flex flex-col">
                        <span className="font-bold text-indigo-900 text-sm">Modo de União</span>
                        <span className="text-xs text-indigo-700">{selectedLotsForMerge.length} lotes selecionados</span>
                    </div>
                    
                    <button 
                        onClick={handleExecuteMerge}
                        disabled={selectedLotsForMerge.length < 2}
                        className={`px-4 py-2 rounded font-bold text-sm transition-colors ${
                            selectedLotsForMerge.length >= 2 
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md' 
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                    >
                        Unir Selecionados
                    </button>
                    
                    <button 
                        onClick={() => {
                            setEditorMode('move');
                            setSelectedLotsForMerge([]);
                        }}
                        className="p-2 hover:bg-gray-100 rounded text-gray-500"
                    >
                        <X size={18} />
                    </button>
                </div>
            )}



        <BulkImportModal 
            isOpen={showImportModal}
            onClose={() => setShowImportModal(false)}
            currentLotsData={lotsData}
            manualLots={manualLots}
            onSave={(newLotsData, newLotsList) => {
                 // 1. Full Backup Restore (Geometry + Data)
                 if (newLotsList && newLotsList.length > 0) {
                     console.log(`Restoring ${newLotsList.length} lots from backup...`);
                     
                     // Create efficient lookup for EXISTING lots
                     const existingMap = new Map(manualLots.map(l => [l.id, l]));
                     
                     // Merge Strategy: Backup wins for geometry and info
                     newLotsList.forEach(restoredLot => {
                         existingMap.set(restoredLot.id, restoredLot);
                     });
                     
                     const finalLots = Array.from(existingMap.values());
                     
                     if (onBatchUpdate) {
                        // Pass empty map for data-only update as we are updating full lots potentially
                        onBatchUpdate(finalLots, newLotsData);
                     } else {
                        setManualLots(finalLots);
                     }
                     
                     alert(`Backup restaurado! ${newLotsList.length} lotes atualizados/criados.`);
                     return;
                 }

                 // 2. Data Only Update (Excel/CSV or Partial JSON)
                 const updatedLots = manualLots.map(lot => {
                    if (newLotsData.has(lot.id)) {
                        const newInfo = newLotsData.get(lot.id)!;
                        return {
                            ...lot,
                            info: {
                                ...lot.info,
                                ...newInfo,
                            }
                        };
                    }
                    return lot;
                });

                if (onBatchUpdate) {
                    onBatchUpdate(updatedLots, newLotsData);
                } else {
                    setManualLots(updatedLots);
                }
                alert("Dados importados aplicados ao mapa!");
            }} 
        />

        <QuickFillModal 
            isOpen={showQuickFill}
            onClose={() => {
                setShowQuickFill(false);
                setQuickFillQuadra(null);
            }}
            lotsData={lotsData}
            manualLots={manualLots}
            onSaveLot={async (id, updates) => {
                 // Adapt to match the onBatchUpdate signature if needed, or handle single update
                 if (onBatchUpdate) {
                     const newInfo = new Map();
                     newInfo.set(id, updates);
                     onBatchUpdate([], newInfo, [id]);
                 }
            }}
        />

        <GPSCalibrationModal 
            isOpen={showGPSCalibration}
            onOpenChange={setShowGPSCalibration}
            onMapClick={(handler) => setGPSCalibrationHandler(() => handler)}
        />

        {/* CONFIG DIALOG FOR GRID */}
        {showQuadraConfig && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded shadow-xl z-[100] border w-80">
                <h3 className="font-bold text-lg mb-4">Configurar Grade (Quadra)</h3>
                
                <div className="mb-4">
                    <label className="block text-sm font-bold mb-1">Número da Quadra</label>
                    <input 
                        className="w-full border p-2 rounded" 
                        value={quadraConfig.id}
                        onChange={(e) => setQuadraConfig({...quadraConfig, id: e.target.value})}
                        placeholder="Ex: 14"
                    />
                </div>

                <div className="mb-4">
                     <label className="block text-sm font-bold mb-1">Colunas de Lotes</label>
                     <div className="max-h-32 overflow-y-auto border p-2 mb-2 bg-gray-50 text-xs">
                         {quadraConfig.columns.map((col, idx) => (
                             <div key={idx} className="flex justify-between items-center mb-1 bg-white p-1 border">
                                 <span>Col {idx+1}: {col.start} à {col.end}</span>
                                 <button 
                                    onClick={() => setQuadraConfig({
                                        ...quadraConfig, 
                                        columns: quadraConfig.columns.filter((_, i) => i !== idx)
                                    })}
                                    className="text-red-500 font-bold px-1"
                                 >x</button>
                             </div>
                         ))}
                     </div>
                     <div className="flex gap-2">
                         <input id="newColStart" placeholder="Início" className="w-1/3 border p-1 text-sm"/>
                         <input id="newColEnd" placeholder="Fim" className="w-1/3 border p-1 text-sm"/>
                         <button 
                            className="bg-blue-500 text-white px-2 rounded text-sm"
                            onClick={() => {
                                const s = parseInt((document.getElementById('newColStart') as HTMLInputElement).value);
                                const e = parseInt((document.getElementById('newColEnd') as HTMLInputElement).value);
                                if (!isNaN(s) && !isNaN(e)) {
                                    setQuadraConfig({
                                        ...quadraConfig,
                                        columns: [...quadraConfig.columns, {start: s, end: e}]
                                    });
                                    (document.getElementById('newColStart') as HTMLInputElement).value = '';
                                    (document.getElementById('newColEnd') as HTMLInputElement).value = '';
                                }
                            }}
                         >Add</button>
                     </div>
                </div>

                <div className="flex justify-end gap-2">
                    <button 
                        className="px-4 py-2 bg-gray-300 rounded"
                        onClick={() => {
                            setShowQuadraConfig(false);
                            setGridPoints([]);
                        }}
                    >
                        Cancelar
                    </button>
                    <button 
                        className="px-4 py-2 bg-green-600 text-white rounded font-bold"
                        onClick={handleFinishQuadraGrid}
                    >
                        GERAR
                    </button>
                </div>
            </div>
        )}

        {/* BACK TO OVERVIEW BUTTON */}
        {activeQuadraId && (
            <div className={`absolute z-[1000] flex gap-2 transition-all ${isMobile ? 'top-28 left-4' : 'bottom-20 left-4'}`}>
                <button 
                    className="bg-white text-gray-800 px-4 py-2 rounded shadow-lg font-bold border hover:bg-gray-50 transition-colors flex items-center gap-2"
                    onClick={() => {
                        setActiveQuadraId(null);
                        if(wrapperRef.current) {
                            wrapperRef.current.resetTransform(1000);
                        }
                    }}
                >
                    <span>←</span> Visão Geral
                </button>
            </div>
        )}

        {/* LAYER SELECTOR - Bottom left corner to avoid overlap (Top-left on Mobile) */}

        {/* CONTROLS OVERLAY - TOP RIGHT */}
        <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2 items-end pointer-events-auto">
            <LayerSelector 
                activeLayer={activeLayer} 
                onLayerChange={setActiveLayer} 
                direction="down"
                align="right"
            />
            <CustomZoomControls 
                zoomIn={() => wrapperRef.current?.zoomIn(0.5)} 
                zoomOut={() => wrapperRef.current?.zoomOut(0.5)} 
            />
            {isMobile && (
                <button
                    onClick={() => setShowGPSCalibration(!showGPSCalibration)}
                    className={`w-10 h-10 rounded-xl backdrop-blur-md border flex items-center justify-center shadow-lg transition-all active:scale-95 ${
                        showGPSCalibration 
                        ? 'bg-blue-600 border-blue-400 text-white shadow-blue-900/50' 
                        : 'bg-black/40 border-white/10 text-white hover:bg-black/60'
                    }`}
                >
                    <div className="flex flex-col items-center">
                        <span className="text-[8px] font-bold">GPS</span>
                        <div className={`w-1.5 h-1.5 rounded-full ${showGPSCalibration ? 'bg-white animate-pulse' : 'bg-gray-400'}`} />
                    </div>
                </button>
            )}
        </div>

        {/* OPACITY CONTROL - Only for Satellite/OSM */}
        {activeLayer !== 'custom' && (
            <div className="absolute bottom-20 right-4 bg-white p-3 rounded-lg shadow-lg z-[1000] w-48">
                <div className="text-xs font-bold text-gray-700 mb-2">Opacidade dos Lotes</div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">0%</span>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={lotOpacity * 100}
                        onChange={(e) => setLotOpacity(parseInt(e.target.value) / 100)}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        style={{
                            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${lotOpacity * 100}%, #e5e7eb ${lotOpacity * 100}%, #e5e7eb 100%)`
                        }}
                    />
                    <span className="text-xs text-gray-500">100%</span>
                </div>
                <div className="text-[10px] text-gray-400 mt-1 text-center">
                    {Math.round(lotOpacity * 100)}%
                </div>
            </div>
        )}



        

        {/* LOT HOVER TOOLTIP (with Reference Code) */}
        {hoveredLotId && !isMobile && (
            (() => {
                const lot = manualLots.find(l => l.id === hoveredLotId);
                if (!lot) return null;
                const info = lotsData.get(lot.id) || lot.info;
                const refCode = info.refCode;
                
                return (
                    <div 
                        className="fixed z-[9999] pointer-events-none bg-black/80 backdrop-blur text-white p-2 rounded shadow-xl border border-white/20 flex flex-col gap-1"
                        style={{
                            left: tooltipPosition.x + 15,
                            top: tooltipPosition.y + 15,
                        }}
                    >
                        <span className="text-xs font-bold">Quadra {lot.quadra} - Lote {lot.lote}</span>
                        {refCode && (
                            <span className="text-[10px] text-green-400 font-mono border-t border-white/10 pt-1">
                                Ref: {refCode}
                            </span>
                        )}
                        {info.isAvailable && (
                            <span className="text-[9px] bg-green-500/20 text-green-300 px-1 rounded w-fit">Disponível</span>
                        )}
                    </div>
                );
            })()
        )}
        
        {/* QUADRA SUMMARY TOOLTIP - Hidden on mobile when LotInspector is open */}
        {activeQuadraId && mapDataComplete.quadras.find(q => q.id === activeQuadraId) && highlightedLots.length === 0 && !(isMobile && selectedLotId) && (
            <Draggable bounds="parent" handle=".drag-handle" nodeRef={quadraTooltipRef}>
                <div ref={quadraTooltipRef} className="absolute top-4 right-4 z-[1000] pointer-events-auto">
                     <div className="drag-handle cursor-move absolute top-2 right-2 p-1 text-white/20 hover:text-white/80 transition-colors z-50">
                        <Maximize size={12} />
                    </div>
                    <QuadraHoverTooltip 
                        quadraId={activeQuadraId}
                        lots={manualLots.filter(l => l.quadra === activeQuadraId)}
                        lotsData={lotsData}
                        isMobile={isMobile}
                    />
                </div>
            </Draggable>
        )}

        {showMigration && (
            <MigrationTool 
                lots={manualLots}
                lotsData={lotsData}
                onClose={() => setShowMigration(false)}
            />
        )}

      {/* Context Menu */}
      {/* Context Menu */}
      {contextMenu && (
        <div 
            className="fixed z-[99999] bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-1.5 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200 ring-1 ring-white/5"
            style={{ left: contextMenu.x, top: contextMenu.y }}
        >
            <button
                onClick={() => {
                    const url = contextMenu.link.startsWith('http') ? contextMenu.link : `https://${contextMenu.link}`;
                    window.open(url, '_blank');
                    setContextMenu(null);
                }}
                className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-200 hover:bg-white/10 hover:text-white rounded-lg w-full text-left transition-all whitespace-nowrap cursor-pointer group"
            >
                <ExternalLink size={16} className="text-blue-400 group-hover:scale-110 transition-transform" />
                <span className="translate-y-[1px]">Abrir Link</span>
            </button>
        </div>
      )}

    </div>
  );
}

export default InteractiveMap;