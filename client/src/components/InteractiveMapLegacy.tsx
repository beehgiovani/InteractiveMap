
import React, { useState, useMemo, useRef, useEffect } from "react";
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import { Lot, MapData, LotInfo } from "@/types";
import LotHoverTooltip from "./LotHoverTooltip";
import QuadraHoverTooltip from "./QuadraHoverTooltip";
import BulkImportModal from "./BulkImportModal";
import QuickFillModal from "./QuickFillModal";
import { GPSCalibrationModal } from "./GPSCalibrationModal";
import { Maximize } from "lucide-react";
import Draggable from 'react-draggable';
import screenCenteringConfig from "@/config/screenCentering.json";
import { exportCalibrationConfig } from "@/lib/geolocation";
import { LayerSelector, MapLayer } from "./LayerSelector";

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
    isDevMode,
    onClick,
    onMouseEnter,
    onMouseLeave,
    lotsData
}: {
    lot: Lot;
    isManual: boolean;
    isSelected: boolean;
    isHovered: boolean;
    isDeleteMode: boolean;
    isQuadraHighlighted: boolean;
    isHighlighted?: boolean; // New Prop
    isDevMode: boolean;
    onClick: (e: React.MouseEvent, lot: Lot) => void;
    onMouseEnter: (id: string, e: React.MouseEvent) => void;
    onMouseLeave: () => void;
    lotsData: Map<string, any>;
}) => {
    let fillColor = "transparent";
    let strokeColor = "transparent";
    let strokeWidth = isSelected ? "2" : "0.5";

    const isPointLot = lot.coordinates.length === 4 && 
                       typeof lot.coordinates[0][0] === 'number' && 
                       Math.abs((lot.coordinates as [number, number][])[0][0] - (lot.coordinates as [number, number][])[1][0]) <= 10;

    // Check owner status
    const lotInfo = lotsData.get(lot.info.id);
    const hasOwner = lotInfo?.owner && lotInfo.owner.trim().length > 0;

    if (isManual) {
        // Owner-based Coloring (Always Visible)
        if (hasOwner) {
             fillColor = "rgba(239, 68, 68, 0.4)"; // Red for Occupied
             strokeColor = "rgba(239, 68, 68, 0.9)";
             strokeWidth = "1";
        } else {
             fillColor = "rgba(34, 197, 94, 0.4)"; // Green for Free
             strokeColor = "rgba(34, 197, 94, 0.9)";
             strokeWidth = "1";
        }
    }

    if (isDeleteMode && isHovered) {
        fillColor = "rgba(255, 0, 0, 0.6)"; 
        strokeColor = "red";
    } else if (isDeleteMode && isQuadraHighlighted) {
         fillColor = "rgba(255, 0, 0, 0.3)"; 
         strokeColor = "red";
    } else if (isHighlighted) {
         // Highlighted (Smart Calc) - Purple
         fillColor = "rgba(168, 85, 247, 0.6)"; 
         strokeColor = "#9333ea";
         strokeWidth = "3";
    } else if (isSelected) {
        fillColor = "rgba(59, 130, 246, 0.6)"; 
        strokeColor = "#1d4ed8";
        strokeWidth = "3";
    } else if (isHovered && !isDeleteMode) {
         // Lighten hover effect on top of base color
         strokeColor = "rgba(255, 255, 255, 1)";
         strokeWidth = "3";
    } else if (!isManual) {
         strokeColor = "rgba(0,0,0,0.1)"; 
         if (isPointLot) {
             fillColor = "rgba(0, 255, 0, 0.3)";
             strokeColor = "green";
         }
    }

    return (
      <g
        onClick={(e) => onClick(e, lot)}
        onMouseEnter={(e) => onMouseEnter(lot.id, e)}
        onMouseLeave={onMouseLeave}
        className={!isDevMode || isDeleteMode ? "cursor-pointer" : ""}
      >
        <polygon
          points={lot.coordinates.map((p) => p.join(",")).join(" ")}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
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
        prev.isDevMode === next.isDevMode
    );
});

export default function InteractiveMap({
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
  highlightedLots = []
}: InteractiveMapProps) {

  const [scale, setScale] = useState(1);
  const [viewState, setViewState] = useState({ x: 0, y: 0, scale: 1 });
  
  // Tooltip & Zoom States
  const [tooltipLot, setTooltipLot] = useState<Lot | null>(null);
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
  const [isDevMode, setIsDevMode] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showQuickFill, setShowQuickFill] = useState(false);
  const [activeLayer, setActiveLayer] = useState<MapLayer>('base');
  const [showGPSCalibration, setShowGPSCalibration] = useState(false);
  const [gpsCalibrationHandler, setGPSCalibrationHandler] = useState<((x: number, y: number) => void) | null>(null);
  // Default to 'draw-lot' or 'move' as user prefers. Let's start with 'move' but enable DevMode basics.
  const [editorMode, setEditorMode] = useState<'move' | 'create-grid' | 'draw-lot' | 'delete' | 'edit-vertex' | 'edit-info'>('move');
  
  // Drag State
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [draggedQuadraId, setDraggedQuadraId] = useState<string | null>(null);
  const [quadraOffsets, setQuadraOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const [exportJson, setExportJson] = useState<string>('');
  
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

  // Optimization: Pre-calculate Highlighted IDs
  const highlightedLotIds = useMemo(() => new Set(highlightedLots.map(l => l.id)), [highlightedLots]);


  // --- LOD & CULLING LOGIC ---
  // Strickland binding to active Quadra OR Hovered Quadra (Preview Mode)
  const visibleLots = useMemo(() => {
    // DEV MODE: Always show ALL lots
    // if (isDevMode) return manualLots;

    // Show nothing if no Quadra is active AND no Quadra is hovered (via label or lot)
    if (!activeQuadraId && !hoveredQuadraId && !hoveredQuadraLabel) return [];
    
    return manualLots.filter(lot => 
        lot.quadra === activeQuadraId || 
        lot.quadra === hoveredQuadraId ||
        lot.quadra === hoveredQuadraLabel
    );
  }, [activeQuadraId, hoveredQuadraId, hoveredQuadraLabel, manualLots, isDevMode]);


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
  const findNearestVertex = (target: {x: number, y: number}, threshold: number = 10) => {
    // Existing helper for snapping to vertices of manual lots
    let nearest: {x: number, y: number} | null = null;
    let minDist = Infinity;
    manualLots.forEach(lot => {
      // Skip MultiPolygon (snapping to disjoint lots not supported yet)
      if (lot.coordinates.length > 0 && Array.isArray(lot.coordinates[0][0])) return;

      (lot.coordinates as [number, number][]).forEach(coord => {
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
  };


  const handleMapClick = (e: React.MouseEvent) => {
      // DRAG GUARD: Check if it was a drag or a click
      if (dragStartRef.current) {
          const dx = e.clientX - dragStartRef.current.x;
          const dy = e.clientY - dragStartRef.current.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist > 5) return; // It was a drag, ignore click
      }

      // GPS Calibration Mode - Highest Priority
      if (showGPSCalibration && gpsCalibrationHandler) {
          const coords = getMapCoordinates(e);
          gpsCalibrationHandler(coords.x, coords.y);
          return; // Don't process any other click logic
      }

      if (!isDevMode) {
          // User Mode: Click on background -> Clear Quadra Selection & Return to Overview
          if (activeQuadraId) {
             setActiveQuadraId(null);
             if (wrapperRef.current) {
                 wrapperRef.current.resetTransform(1000, "easeOutCubic");
             }
          }
          return;
      }
      
      let coords = getMapCoordinates(e);

      // Apply Snap if available
      if (snapPoint && editorMode === 'draw-lot') {
          coords = snapPoint;
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
             // Added 'lot' mode check to be explicit
            setManualLots(manualLots.filter(l => l.id !== lotId));
            
            if (onDeleteIds) {
                onDeleteIds([lotId]);
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
                      createdAt: new Date(),
                      updatedAt: new Date()
                  }
              });
          }
      });

      setManualLots([...manualLots, ...newLots]);
      setGridPoints([]);
      setShowQuadraConfig(false);
      setQuadraConfig({ id: '', columns: [] });
      alert("Quadra Gerada com Sucesso!");
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
    // 0. Manual Right Click Pan
    if (isRightDragging && wrapperRef.current && wrapperRef.current.instance) {
        const dx = e.clientX - lastMousePos.x;
        const dy = e.clientY - lastMousePos.y;
        
        const { transformState } = wrapperRef.current.instance;
        wrapperRef.current.setTransform(
            transformState.positionX + dx,
            transformState.positionY + dy,
            transformState.scale,
            0 // animation time
        );
        
        setLastMousePos({ x: e.clientX, y: e.clientY });
        return; 
    }

    // Standard Mouse Move Logic
    const coords = getMapCoordinates(e);

    // Track mouse for Tooltip
    setTooltipPosition({ x: e.clientX, y: e.clientY });




    if (editorMode === 'create-grid') return;
    
    // ... (Rest of existing move logic: drag, draw-lot, etc)
    if (draggedQuadraId && wrapperRef.current) { // Removed isDragging state check here, as it's now a ref for TransformWrapper
// ...
      const scale = wrapperRef.current.state.scale;
      if (editorMode === 'move') {
        const dx = (e.clientX - dragStart.x) / scale;
        const dy = (e.clientY - dragStart.y) / scale;
        setQuadraOffsets(prev => {
          const current = prev[draggedQuadraId] || { x: 0, y: 0 };
          return { ...prev, [draggedQuadraId]: { x: current.x + dx, y: current.y + dy } };
        });
        setDragStart({ x: e.clientX, y: e.clientY });
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
        const snapped = findNearestVertex(coords, 5);
        const finalCoords = snapped || coords;

        setManualLots(prev => prev.map(lot => {
            if (lot.id === selectedLotForEditing) {
                // TYPE SAFETY: Check if it's a simple Polygon (array of points) or MultiPolygon (array of arrays of points)
                // We only support vertex editing for simple Polygons in this Legacy mode.
                const isMultiPolygon = Array.isArray(lot.coordinates[0]) && Array.isArray((lot.coordinates[0] as any)[0]);
                
                if (isMultiPolygon) {
                    console.warn("Editing MultiPolygons is not supported in Legacy Mode");
                    return lot;
                }

                // Safe cast: We know it's [number, number][]
                const currentCoords = lot.coordinates as [number, number][];
                const newCoords = [...currentCoords];
                
                newCoords[editingVertexIndex] = [finalCoords.x, finalCoords.y];
                const newCenter = calculateCenter(newCoords.map(p => ({x: p[0], y: p[1]})));
                
                return { ...lot, coordinates: newCoords, center: newCenter };
            }
            return lot;
        }));
    }
  };

  const handleMouseUp = () => {
    setIsRightDragging(false);
    // isDragging is now a ref, not state
    setDraggedQuadraId(null);
    setDraggingPointIndex(null);
    setEditingVertexIndex(null);
  };

  const handleLotClick = (e: React.MouseEvent, lot: Lot) => {
      // DISTANCE CHECK for "Smart Drag Guard"
      // If we have a start position, check how far we moved.
      if (dragStartRef.current) {
          const dx = e.clientX - dragStartRef.current.x;
          const dy = e.clientY - dragStartRef.current.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          // If moved more than 5 pixels, it's a drag, not a click.
          if (dist > 5) {
              console.log("Ignored Lot Click (Drag detected)");
              return; 
          }
      }
      
      e.stopPropagation();
      if (editorMode === 'delete') {
          handleDeleteLot(lot.id);
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
           if (editorMode !== 'draw-lot' && editorMode !== 'edit-vertex') {
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
              }
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDevMode, editorMode, currentPoints, gridPoints]);

  // REACTIVE ZOOM EFFECT (Unifies Click & Sidebar Selection)
  useEffect(() => {
      // 2. QUADRA SELECTION & ZOOM
      // If we have highlighted lots (Smart Calc), we DON'T want the generic Quadra Zoom to override our specific Lot Pan.
      if (activeQuadraId && mapDataComplete && highlightedLots.length === 0 && wrapperRef.current && wrapperRef.current.instance) {
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

                    const isMobile = containerWidth < 768;
                    const targetScale = isMobile ? 1.5 : 3.8;

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
  }, [activeQuadraId, centeringOffset, mapDataComplete, highlightedLots.length]); // Added highlightedLots.length dep

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
      if (highlightedLots.length > 0 && wrapperRef.current) {
          // SYNC QUADRA SELECTION
          // If the lots belong to a quadra, make it active so the map context updates (labels, etc.)
          const targetQuadra = highlightedLots[0].quadra;
          if (targetQuadra !== activeQuadraId) {
              setActiveQuadraId(targetQuadra);
          }

          // Calculate Center of Highlighted Lots
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          
          highlightedLots.forEach(lot => {
              if (!lot.coordinates || lot.coordinates.length === 0) return;

              // Check if MultiPolygon (elements are arrays of points) or Polygon (elements are points)
              // We check the first element. If check fails (empty), we skip.
              const firstElem = lot.coordinates[0];
              let points: [number, number][];

              // If firstElem[0] is array, then it's [number, number][][], so we flat()
              // If firstElem[0] is number, then it's [number, number][], already points
              if (Array.isArray(firstElem) && Array.isArray(firstElem[0])) {
                  points = (lot.coordinates as [number, number][][]).flat();
              } else {
                  points = lot.coordinates as [number, number][];
              }

              points.forEach(([x, y]) => {
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

  const handleQuadraClick = (quadraId: string) => {
      setActiveQuadraId(quadraId);
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



    return (
        <div ref={containerRef} className="w-full h-full bg-gray-100 flex flex-col relative" onContextMenu={(e) => e.preventDefault()}>
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
                    contentStyle={{ width: '100%', height: '100%' }}
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
                        <image
                            href={activeLayer === 'base' 
                                ? '/map-background-hq.jpg' 
                                : '/map-background-satellite.jpg'
                            }
                            x={MAP_BOUNDS.minX}
                            y={MAP_BOUNDS.minY}
                            width={MAP_BOUNDS.width}
                            height={MAP_BOUNDS.height}
                            opacity={1.0}
                            preserveAspectRatio="none"
                            style={{
                                filter: activeLayer === 'satellite' ? 'sepia(0.4) saturate(1.5)' : 'none'
                            }}
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
                                onClick={handleLotClick}
                                onMouseEnter={(id, event) => {
                          setHoveredLotId(id);
                          
                          // Cancel any pending close timer if we re-enter or switch lots
                          if (tooltipCloseTimeoutRef.current) {
                              clearTimeout(tooltipCloseTimeoutRef.current);
                              tooltipCloseTimeoutRef.current = null;
                          }



                          if (!isDevMode && editorMode !== 'delete') {
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
      const fontSize = isMobile ? "24px" : "14px";
      const fontWeight = isMobile ? "900" : "bold";
      
      if (!q.center) return null;

      const [cx, cy] = Array.isArray(q.center) 
          ? [q.center[0], q.center[1]] 
          // @ts-ignore
          : [q.center.x, q.center.y];

      return (
          <g 
             key={q.id} 
             style={{ 
                 pointerEvents: 'all', // Ensure they capture clicks
                 cursor: 'pointer',
                 transition: 'opacity 0.2s ease',
                 opacity: opacity
             }}
             onClick={(e) => {
                 e.stopPropagation();
                 handleQuadraClick(q.id);
             }}
             onMouseEnter={() => !isMobile && setHoveredQuadraLabel(q.id)}
             onMouseLeave={() => !isMobile && setHoveredQuadraLabel(null)}
          >
              <circle 
                  cx={cx} 
                  cy={cy} 
                  r={isMobile ? "20" : "12"} 
                  fill="rgba(0,0,0,0.7)" 
              />
              <text
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  dy=".35em"
                  fill="white"
                  fontSize={fontSize} // Dynamic Font
                  fontWeight={fontWeight}
                  style={{ userSelect: "none" }}
              >
                  {q.id}
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
      if (isMobile) {
          circleRadius = 8; // Fixed large size, not dependent on scale (or less dependent)
          fontSize = 10;
          fontColor = "black";
          circleFill = "white"; // White bubble with black text for contrast? Or keep black?
          // User asked for "bolinhas maiores".
          circleRadius = 18; 
          fontSize = 14; 
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
                  strokeWidth={isMobile ? 2 : 0}
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

                      // Fix for TS Error & Safety: 
                      // Check if MultiPolygon (nested array). If so, SKIP editing for now.
                      // Flattening them would solve the display TS error, but 'handleMouseMove' expects a simple array 
                      // and using a flat index on a nested structure would corrupt the data.
                      if (lot.coordinates.length > 0 && Array.isArray(lot.coordinates[0]) && Array.isArray((lot.coordinates[0] as any)[0])) {
                          return null;
                      }

                      const points = lot.coordinates as [number, number][];

                      return points.map((p, i) => (
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

        {/* --- UI CONTROLS (Dev Mode) --- */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-50 items-end">
            <button 
                className={`px-4 py-2 rounded shadow font-bold ${isDevMode ? 'bg-red-500 text-white' : 'bg-white text-gray-800'}`}
                onClick={() => setIsDevMode(!isDevMode)}
            >
                {isDevMode ? 'DEV MODE ON' : 'DEV MODE OFF'}
            </button>
            
            {isDevMode && (
                <div className="bg-white p-3 rounded shadow flex flex-col gap-2 animate-in fade-in slide-in-from-right-10">
                    <div className="flex justify-between items-center mb-1">
                        <div className="text-xs font-bold text-gray-500">FERRAMENTAS</div>
                         <div className="text-[10px] font-bold bg-gray-200 px-2 py-0.5 rounded text-gray-600">
                            Total: {manualLots.length}
                        </div>
                    </div>
                    <div className="flex gap-2">
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
            )}

             {/* MOVED: Corrigir Dados Button */}
             {isDevMode && (
                <button
                    className="bg-red-600 text-white px-3 py-1 rounded shadow-lg text-sm z-50 hover:bg-red-700 w-full"
                    onClick={() => {
                         if(!confirm("Isso irá recalcular o CENTRO de todos os lotes e salvar no banco. Continuar?")) return;
                         
                         const fixedLots = manualLots.map(lot => {
                             const coords = lot.coordinates.map(p => ({
                                 x: Number(p[0]), 
                                 y: Number(p[1])
                             }));
                             const center = calculateCenter(coords);
                             return { ...lot, center };
                         });

                         setManualLots(fixedLots);
                         alert(`Dados corrigidos! ${fixedLots.length} lotes atualizados.`);
                    }}
                >
                    🔧 Corrigir Dados
                </button>
            )}

            {/* MOVED: Calibration Panel */}
            {isDevMode && (
                <div className="bg-white p-3 rounded shadow-lg z-50 w-64 border-2 border-orange-500 animate-in fade-in slide-in-from-right-5">
                    <h4 className="font-bold text-sm mb-2 text-orange-700">Calibrar Centralização</h4>
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
                        className="w-full bg-orange-600 text-white text-xs font-bold py-1 rounded"
                        onClick={() => alert(activeQuadraId ? "Clique em uma Quadra para testar!" : "Selecione uma quadra primeiro.")}
                    >
                        Testar Alinhamento
                    </button>
                </div>
            )}

            {isDevMode && (
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
                    <div className="grid grid-cols-2 gap-2 mt-1 pt-2 border-t border-gray-200">
                         <button
                            className="bg-gray-700 text-white px-2 py-1.5 rounded shadow text-[10px] font-bold z-50 hover:bg-gray-800 flex items-center justify-center gap-1"
                            onClick={onExportBackup}
                            title="Salvar backup localmente"
                        >
                            💾 Backup Local
                        </button>
                        <button
                            className="bg-blue-600 text-white px-2 py-1.5 rounded shadow text-[10px] font-bold z-50 hover:bg-blue-700 flex items-center justify-center gap-1"
                            onClick={onCloudSync}
                            title="Forçar envio para nuvem"
                        >
                            ☁️ Sync Nuvem
                        </button>
                    </div>
                </div>
            )}

        </div>

        <BulkImportModal 
            isOpen={showImportModal}
            onClose={() => setShowImportModal(false)}
            currentLotsData={lotsData}
            manualLots={manualLots}
            onSave={(newLotsData) => {
                 // Convert Map to Object for logging? 
                 // Just proceed. 
                 
                 // Create new ManualLots
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
                    // Fallback
                    setManualLots(updatedLots);
                }
                alert("Dados importados aplicados ao mapa! O salvamento deve ocorrer automaticamente se configurado.");
            }} 
        />

        <QuickFillModal 
            isOpen={showQuickFill}
            onClose={() => setShowQuickFill(false)}
            manualLots={manualLots}
            lotsData={lotsData}
            onSaveLot={async (lotId, updates) => {
                const lot = manualLots.find(l => l.id === lotId);
                if (!lot) return;

                const newInfo = { ...lot.info, ...updates };
                const updatedLot = { ...lot, info: newInfo };
                
                const updatedLots = manualLots.map(l => l.id === lotId ? updatedLot : l);
                
                const newDataMap = new Map(lotsData);
                newDataMap.set(lotId, newInfo);
                
                if (onBatchUpdate) {
                     onBatchUpdate(updatedLots, newDataMap, [lotId]);
                } else {
                     setManualLots(updatedLots);
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
            <div className="absolute bottom-4 left-4 flex gap-2 z-50">
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

        {/* LAYER SELECTOR - Top left corner */}
        <div className="absolute top-4 left-4 z-50">
            <LayerSelector 
                activeLayer={activeLayer}
                onLayerChange={setActiveLayer}
            />
        </div>





        {/* ZOOM CONTROLS */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-50">
            <button
                className="bg-white p-2 rounded shadow hover:bg-gray-50 border"
                onClick={() => wrapperRef.current?.zoomIn()}
                title="Aproximar"
            >
                <span className="text-xl font-bold text-gray-700">+</span>
            </button>
            <button
                className="bg-white p-2 rounded shadow hover:bg-gray-50 border"
                onClick={() => wrapperRef.current?.zoomOut()}
                title="Afastar"
            >
                <span className="text-xl font-bold text-gray-700">-</span>
            </button>
        </div>

        
        {/* QUADRA SUMMARY TOOLTIP */}
        {/* QUADRA SUMMARY TOOLTIP */}
        {/* QUADRA SUMMARY TOOLTIP */}
        {activeQuadraId && mapDataComplete.quadras.find(q => q.id === activeQuadraId) && highlightedLots.length === 0 && (
            <Draggable bounds="parent" handle=".drag-handle" nodeRef={quadraTooltipRef}>
                <div ref={quadraTooltipRef} className="absolute top-4 right-4 z-50 pointer-events-auto">
                     <div className="drag-handle cursor-move absolute top-2 right-2 p-1 text-white/20 hover:text-white/80 transition-colors z-50">
                        <Maximize size={12} />
                    </div>
                    <QuadraHoverTooltip 
                        quadraId={activeQuadraId}
                        lots={manualLots.filter(l => l.quadra === activeQuadraId)}
                        lotsData={lotsData}
                    />
                </div>
            </Draggable>
        )}

    </div>
  );
}