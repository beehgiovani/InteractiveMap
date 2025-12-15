
import React, { useState, useMemo, useRef, useEffect } from "react";
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import { Lot, MapData } from "@/types";

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
  onLotClick: (lot: Lot) => void;
  selectedLotId?: string;
  manualLots: Lot[];
  setManualLots: React.Dispatch<React.SetStateAction<Lot[]>>;
}

// Memoized Lot Component for Performance
const LotPolygon = React.memo(({ 
    lot, 
    isManual, 
    isSelected, 
    isHovered, 
    isDeleteMode, 
    isQuadraHighlighted,
    isDevMode,
    onClick,
    onMouseEnter,
    onMouseLeave
}: {
    lot: Lot;
    isManual: boolean;
    isSelected: boolean;
    isHovered: boolean;
    isDeleteMode: boolean;
    isQuadraHighlighted: boolean;
    isDevMode: boolean;
    onClick: (e: React.MouseEvent, lot: Lot) => void;
    onMouseEnter: (id: string) => void;
    onMouseLeave: () => void;
}) => {
    let fillColor = "transparent";
    let strokeColor = "transparent";
    let strokeWidth = isSelected ? "2" : "0.5";

    const isPointLot = lot.coordinates.length === 4 && Math.abs(lot.coordinates[0][0] - lot.coordinates[1][0]) <= 10;

    if (isManual) {
        fillColor = "rgba(255, 100, 100, 0.3)";
        strokeColor = "red";
        strokeWidth = "1";
    }

    if (isDeleteMode && isHovered) {
        fillColor = "rgba(255, 0, 0, 0.6)"; 
        strokeColor = "red";
    } else if (isDeleteMode && isQuadraHighlighted) {
         fillColor = "rgba(255, 0, 0, 0.3)"; 
         strokeColor = "red";
    } else if (isSelected) {
        fillColor = "rgba(59, 130, 246, 0.6)"; 
        strokeColor = "#1d4ed8";
    } else if (isHovered && !isDeleteMode) {
        fillColor = "rgba(191, 219, 254, 0.5)"; 
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
        onMouseEnter={() => onMouseEnter(lot.id)}
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
        prev.isDevMode === next.isDevMode
    );
});

export default function InteractiveMap({
  onLotClick,
  selectedLotId,
  manualLots,
  setManualLots
}: InteractiveMapProps) {
  const [scale, setScale] = useState(1);
  const [viewState, setViewState] = useState({ x: 0, y: 0, scale: 1 });
  const [hoveredLotId, setHoveredLotId] = useState<string | null>(null);
  const [hoveredQuadraLabel, setHoveredQuadraLabel] = useState<string | null>(null); // New state for label hover
  const [activeQuadraId, setActiveQuadraId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<ReactZoomPanPinchRef>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const isDragging = useRef(false); // Ref for immediate state
  const dragStartRef = useRef<{x: number, y: number} | null>(null); // Ref for precise distance check

  // --- EDITOR MODE STATES ---
  const [isDevMode, setIsDevMode] = useState(false);
  // Default to 'draw-lot' or 'move' as user prefers. Let's start with 'move' but enable DevMode basics.
  const [editorMode, setEditorMode] = useState<'move' | 'create-grid' | 'draw-lot' | 'delete' | 'edit-vertex' | 'edit-info'>('move');
  
  // Drag State
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [draggedQuadraId, setDraggedQuadraId] = useState<string | null>(null);
  const [quadraOffsets, setQuadraOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const [exportJson, setExportJson] = useState<string>('');
  
  // Custom Calibration State
  const [centeringOffset, setCenteringOffset] = useState<{x: number, y: number}>(() => {
      const saved = localStorage.getItem("map_centering_offset");
      // Default to -1000, -500 as per user verification for this specific environment
      return saved ? JSON.parse(saved) : { x: -1000, y: -900 }; 
  });

  const updateCenteringOffset = (newOffset: {x: number, y: number}) => {
      setCenteringOffset(newOffset);
      localStorage.setItem("map_centering_offset", JSON.stringify(newOffset));
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
                      // Garante que map devolva números
                      const xs = l.coordinates.map(p => Number(p[0]));
                      const ys = l.coordinates.map(p => Number(p[1]));
                      
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
              const finalCenterX = validCount > 0 ? totalX / validCount : 0;
              const finalCenterY = validCount > 0 ? totalY / validCount : 0;
              
              // Log de segurança (pode remover depois)
              // console.log(`Quadra ${id} Center: [${finalCenterX.toFixed(0)}, ${finalCenterY.toFixed(0)}] (de ${validCount} lotes)`);

              return {
                  id,
                  name: `Quadra ${id}`,
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


  // --- LOD & CULLING LOGIC ---
  // Strickland binding to active Quadra OR Hovered Quadra (Preview Mode)
  const visibleLots = useMemo(() => {
    // Show nothing if no Quadra is active AND no Quadra is hovered (via label or lot)
    if (!activeQuadraId && !hoveredQuadraId && !hoveredQuadraLabel) return [];
    
    return manualLots.filter(lot => 
        lot.quadra === activeQuadraId || 
        lot.quadra === hoveredQuadraId ||
        lot.quadra === hoveredQuadraLabel
    );
  }, [activeQuadraId, hoveredQuadraId, hoveredQuadraLabel, manualLots]);


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
      lot.coordinates.forEach(coord => {
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
      if (!isDevMode) return;
      
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
      
      const newLotId = `${quadraInput}-${loteInput}-${Date.now()}`;
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
          // Delete entire quadra
          if (confirm(`Apagar toda a Quadra ${targetLot.quadra}?`)) {
              setManualLots(prev => prev.filter(l => l.quadra !== targetLot.quadra));
          }
      } else {
          // Delete single lot
           if (lotId.startsWith('manual-') || targetLot.id.includes(targetLot.quadra)) {
              setManualLots(manualLots.filter(l => l.id !== lotId));
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

              const id = `${quadraConfig.id}-${lotNum}-${Date.now()}`;
              const center = calculateCenter(corners.map(p => ({x: p[0], y: p[1]})));
              
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

    // 1. Check for Quadra Label Proximity (Scale-invariant radius check)
    // The visual radius is 25 / scale. Let's use 30 / scale for better UX.
    const labelRadius = 30 / scale;
    let foundQuadraLabel = null;
    
    // We can access mapDataComplete here
    if (mapDataComplete && mapDataComplete.quadras) {
        for (const q of mapDataComplete.quadras) {
            if (!q.center) continue;
            const [qx, qy] = q.center as [number, number];
            const dist = Math.sqrt(Math.pow(qx - coords.x, 2) + Math.pow(qy - coords.y, 2));
            if (dist < labelRadius) {
                foundQuadraLabel = q.id;
                break; 
            }
        }
    }
    setHoveredQuadraLabel(foundQuadraLabel);


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
                const newCoords = [...lot.coordinates];
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
      // 1. If we have an Active Quadra (selected via Click or Menu)
      if (activeQuadraId && mapDataComplete && wrapperRef.current && wrapperRef.current.instance) {
          
          const quadraData = mapDataComplete.quadras.find(q => q.id === activeQuadraId);
          if (quadraData?.center) {
                  const [cx, cy] = quadraData.center as [number, number];
                  if (cx && cy) {
                    console.log(`Zooming to Quadra ${activeQuadraId} at [${cx}, ${cy}]`);

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
  }, [activeQuadraId, centeringOffset, mapDataComplete]); // Re-run when Quadra changes or Calibration changes

  // Auto-Zoom to Selected Lot -> Triggers Quadra Select
  useEffect(() => {
     if (selectedLotId) {
         const lot = manualLots.find(l => l.id === selectedLotId);
         if (lot && lot.quadra !== activeQuadraId) {
             setActiveQuadraId(lot.quadra); // This will trigger the Zoom Effect above
         }
     }
  }, [selectedLotId, manualLots, activeQuadraId]);

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
                href="/map-background-hq.jpg"
                x={MAP_BOUNDS.minX}
                y={MAP_BOUNDS.minY}
                width={MAP_BOUNDS.width}
                height={MAP_BOUNDS.height}
                opacity={1.0}
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
                      isDevMode={isDevMode}
                      onClick={handleLotClick}
                      onMouseEnter={setHoveredLotId}
                      onMouseLeave={() => setHoveredLotId(null)}
                  />
              ))}
              
              {/* If Zoomed Out, maybe show Quadra placeholders? 
                  Already handle Quadra Labels below. 
                  Maybe just relying on labels is enough for "First Load" speed.
              */}

              {/* LOT LABELS (L1, L2...) - Also LOD protected, now Strictly bound to Active Quadra */}
              {scale > 0.6 && visibleLots.map(lot => {
                  if (!lot.center) return null;
                  const [cx, cy] = lot.center as [number, number];
                  
                  return (
                      <g key={`label-${lot.id}`} style={{ pointerEvents: 'none' }}>
                          <circle 
                              cx={cx} 
                              cy={cy} 
                              r={14 / scale} 
                              fill="black" 
                              opacity={0.7}
                          />
                          <text 
                              x={cx} 
                              y={cy} 
                              fill="white" 
                              fontSize={12 / scale} 
                              textAnchor="middle" 
                              dy=".35em" 
                              fontWeight="bold"
                          >
                              {lot.lote}
                          </text>
                      </g>
                  );
              })}

              {/* QUADRA LABELS (Q1, Q2...) */}
              {mapDataComplete?.quadras.map(quadra => {
                  const [cx, cy] = quadra.center as [number, number];
                  
                  // Se o centro for inválido (0,0), não desenha a label para não bugar o zoom
                  if (!cx || !cy) return null;

                  const isHovered = hoveredQuadraLabel === quadra.id;

                  // Helper for Quadra Click
                  const handleQuadraClick = (e: React.MouseEvent) => {
                      if (isDragging.current) return; // Prevent focusing if dragging
                      e.stopPropagation();

                      console.log(`Clicked Quadra ${quadra.id}`);
                      // Just set the state - The EFFECT will handle the Zoom/Animation
                      setActiveQuadraId(quadra.id);
                  };

                  return (
                      <g 
                        key={`q-label-${quadra.id}`} 
                        className="cursor-pointer transition-opacity duration-200"
                        onClick={handleQuadraClick}
                        onMouseEnter={() => setHoveredQuadraLabel(quadra.id)}
                        onMouseLeave={() => setHoveredQuadraLabel(null)}
                        style={{ 
                            // Only fade if THIS quadra is active & zoomed, OR if hovered. Otherwise visible.
                            opacity: ((activeQuadraId === quadra.id && scale > 1.2) || hoveredQuadraLabel === quadra.id) ? 0.1 : 0.9, 
                            display: 'block', // Always visible, never hides on zoom
                            transition: 'opacity 0.2s',
                            cursor: 'pointer'
                        }}
                      >
                           <circle cx={cx} cy={cy} r={30 / scale} fill="transparent" />
                           
                           <circle 
                               cx={cx} cy={cy} r={16 / scale} 
                               fill="rgba(0,0,0,0.8)" stroke="white" strokeWidth={1.5 / scale}
                               className="hover:fill-blue-900"
                           />
                          <text 
                              x={cx} y={cy} fill="white" fontSize={10 / scale} 
                              textAnchor="middle" dy=".35em" fontWeight="bold"
                          >
                              Q{quadra.id.replace('Quadra ', '')} 
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

                     return lot.coordinates.map((p, i) => (
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
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-50">
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
                            <div className="flex gap-2 text-xs">
                                <label className="flex items-center gap-1 cursor-pointer">
                                    <button 
                              className={`px-2 py-1 text-xs rounded ${deleteModeType === 'lot' ? 'bg-red-200 font-bold' : 'bg-white'}`}
                              onClick={() => setDeleteModeType('lot')}
                          >
                              Lote (Individual)
                          </button>      </label>
                                <label className="flex items-center gap-1 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="delType" 
                                        checked={deleteModeType === 'quadra'} 
                                        onChange={() => setDeleteModeType('quadra')} 
                                    />
                                    Quadra
                                </label>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>

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

        {isDevMode && (
            <button
                className="absolute top-20 right-4 bg-red-600 text-white px-3 py-1 rounded shadow-lg text-sm z-50 hover:bg-red-700"
                onClick={() => {
                    if(!confirm("Isso irá recalcular o CENTRO de todos os lotes e salvar no banco. Continuar?")) return;
                    
                    const fixedLots = manualLots.map(lot => {
                        // Recalculate center from coordinates using ROBUST Number() casting
                        const coords = lot.coordinates.map(p => ({
                            x: Number(p[0]), 
                            y: Number(p[1])
                        }));
                        const center = calculateCenter(coords);
                        return {
                            ...lot,
                            center: center // Force clean [x, y]
                        };
                    });

                    setManualLots(fixedLots);
                    alert(`Dados corrigidos! ${fixedLots.length} lotes atualizados. O salvamento automático ocorrerá em instantes.`);
                }}
            >
                🔧 Corrigir Dados (Centros)
            </button>
        )}

        {/* CALIBRATION PANEL (DEV MODE) */}
        {isDevMode && (
            <div className="absolute top-32 right-4 bg-white p-3 rounded shadow-lg z-50 w-64 border-2 border-orange-500">
                <h4 className="font-bold text-sm mb-2 text-orange-700">Calibrar Centralização</h4>
                <div className="text-[10px] text-gray-500 mb-2">
                    Ajuste os sliders até o mapa ficar centralizado no seu monitor.
                </div>
                
                <div className="mb-2">
                    <label className="block text-xs font-bold">Offset X (Horizontal): {centeringOffset.x}px</label>
                    <input 
                        type="range" 
                        min="-2000" 
                        max="2000" 
                        value={centeringOffset.x}
                        onChange={(e) => updateCenteringOffset({...centeringOffset, x: Number(e.target.value)})}
                        className="w-full"
                    />
                </div>

                <div className="mb-2">
                    <label className="block text-xs font-bold">Offset Y (Vertical): {centeringOffset.y}px</label>
                    <input 
                        type="range" 
                        min="-2000" 
                        max="2000" 
                        value={centeringOffset.y}
                        onChange={(e) => updateCenteringOffset({...centeringOffset, y: Number(e.target.value)})}
                        className="w-full"
                    />
                </div>

                <button 
                    className="w-full bg-orange-600 text-white text-xs font-bold py-1 rounded"
                    onClick={() => {
                        if (activeQuadraId) {
                            // Re-trigger centering on current quadra
                            const q = manualLots.find(l => l.quadra === activeQuadraId);
                            // Fake a click? Need coordinates.
                            // Better: Just alert user to click a quadra.
                            alert("Clique em uma Quadra agora para testar o novo alinhamento!");
                        } else {
                             alert("Clique em uma Quadra para testar!");
                        }
                    }}
                >
                    Testar Alinhamento
                </button>
            </div>
        )}

    </div>
  );
}