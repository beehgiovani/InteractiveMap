import React, { useState } from "react";
import Draggable from "react-draggable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalibrationPoint, saveCalibrationPoints, getCalibrationStatus, exportCalibrationConfig } from "@/lib/geolocation";
import { MapPin, Check, X, Minimize2, Download, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface GPSCalibrationModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onMapClick?: (handler: (x: number, y: number) => void) => void; // Callback to register handler
}

export function GPSCalibrationModal({ isOpen, onOpenChange, onMapClick }: GPSCalibrationModalProps) {
    const [step, setStep] = useState(0); // 0-2 for 3 points
    const [points, setPoints] = useState<CalibrationPoint[]>([]);
    const [currentSVG, setCurrentSVG] = useState<{x: number, y: number} | null>(null);
    const [lat, setLat] = useState("");
    const [lng, setLng] = useState("");
    const [isMinimized, setIsMinimized] = useState(false);
    const nodeRef = React.useRef<HTMLDivElement>(null);

    const { isCalibrated } = getCalibrationStatus();

    // Expose method for parent to call when map is clicked
    const handleMapClick = (x: number, y: number) => {
        if (step < 3 && isOpen) {
            setCurrentSVG({ x, y });
            toast.success(`Ponto capturado! X: ${x.toFixed(1)}, Y: ${y.toFixed(1)}`);
        }
    };

    // Call parent's onMapClick callback with our handler
    React.useEffect(() => {
        if (onMapClick && isOpen) {
            onMapClick(handleMapClick);
        }
    }, [isOpen, step, onMapClick]);

    const handleSavePoint = () => {
        if (!currentSVG || !lat || !lng) {
            toast.error("Preencha todas as coordenadas!");
            return;
        }

        const newPoint: CalibrationPoint = {
            svg: currentSVG,
            geo: { lat: parseFloat(lat), lng: parseFloat(lng) }
        };

        const newPoints = [...points, newPoint];
        setPoints(newPoints);
        setLat("");
        setLng("");
        setCurrentSVG(null);

        if (step === 2) {
            // All 3 points collected
            saveCalibrationPoints(newPoints);
            toast.success("Calibração GPS salva com sucesso!");
            onOpenChange(false);
            setStep(0);
            setPoints([]);
        } else {
            setStep(step + 1);
        }
    };

    const handleReset = () => {
        localStorage.removeItem("gps_calibration_points");
        setPoints([]);
        setStep(0);
        setCurrentSVG(null);
        setLat("");
        setLng("");
        toast.success("Calibração resetada!");
    };

    const handleExportConfig = () => {
        try {
            const configJson = exportCalibrationConfig();
            
            // Create download
            const blob = new Blob([configJson], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'gpsCalibration.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            toast.success("Configuração exportada! Salve em: client/src/config/gpsCalibration.json");
        } catch (error) {
            toast.error("Erro ao exportar configuração");
            console.error(error);
        }
    };

    if (!isOpen) return null;

    return (
        <Draggable handle=".drag-handle" bounds="parent" nodeRef={nodeRef}>
            <div
                ref={nodeRef}
                className="fixed top-20 right-4 w-[380px] bg-black/80 border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-[9999] backdrop-blur-2xl overflow-hidden transition-all duration-300"
                style={{ maxHeight: isMinimized ? "60px" : "90vh" }}
            >
                {/* Header */}
                <div className="drag-handle flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/10 cursor-move rounded-t-2xl backdrop-blur-md">
                    <div className="flex items-center gap-2">
                        <MapPin size={18} className="text-blue-400" />
                        <span className="font-bold text-white text-sm">Calibração GPS</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setIsMinimized(!isMinimized)}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                        >
                            <Minimize2 size={14} />
                        </button>
                        <button
                            onClick={() => onOpenChange(false)}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                {!isMinimized && (
                    <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
                        {/* Status */}
                        <div className={`p-3 rounded-xl text-xs flex items-center justify-center border backdrop-blur-sm ${isCalibrated ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'}`}>
                            <div className="font-bold flex items-center gap-2">
                                {isCalibrated ? <CheckCircle size={14}/> : <AlertCircle size={14}/>}
                                {isCalibrated ? "Calibrado" : "Não Calibrado"}
                            </div>
                        </div>

                        {/* Step Indicator */}
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                            <div className="text-xs font-bold text-blue-300 mb-2 flex justify-between">
                                <span>Progresso</span>
                                <span>{step + 1} / 3</span>
                            </div>
                            <div className="flex gap-1.5">
                                {[0, 1, 2].map(i => (
                                    <div
                                        key={i}
                                        className={`flex-1 h-1.5 rounded-full transition-all ${i < points.length ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : i === step ? 'bg-blue-500 animate-pulse' : 'bg-white/10'}`}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Instructions */}
                        <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                            <ol className="text-[11px] text-gray-400 space-y-2 list-decimal list-inside font-medium leading-relaxed">
                                <li className="text-white">Clique no mapa em um ponto reconhecível.</li>
                                <li>Encontre o mesmo ponto no Google Earth.</li>
                                <li>Cole as coordenadas exatas abaixo.</li>
                            </ol>
                        </div>

                        {/* Current SVG Coords */}
                        {currentSVG && (
                            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-between">
                                <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">Ponto Capturado</span>
                                <div className="font-mono text-xs text-white bg-black/40 px-2 py-1 rounded border border-white/10">X: {currentSVG.x.toFixed(1)} | Y: {currentSVG.y.toFixed(1)}</div>
                            </div>
                        )}

                        {/* GPS Inputs */}
                        <div className="space-y-3">
                            <div>
                                <Label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5 block">Latitude</Label>
                                <Input
                                    type="number"
                                    step="0.000001"
                                    placeholder="-23.950000"
                                    value={lat}
                                    onChange={(e) => setLat(e.target.value)}
                                    className="h-9 bg-black/40 border-white/10 text-white text-sm focus:bg-black/60 transition-colors"
                                    disabled={!currentSVG}
                                />
                            </div>
                            <div>
                                <Label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5 block">Longitude</Label>
                                <Input
                                    type="number"
                                    step="0.000001"
                                    placeholder="-46.300000"
                                    value={lng}
                                    onChange={(e) => setLng(e.target.value)}
                                    className="h-9 bg-black/40 border-white/10 text-white text-sm focus:bg-black/60 transition-colors"
                                    disabled={!currentSVG}
                                />
                            </div>
                        </div>

                        {/* Waiting message */}
                        {!currentSVG && (
                            <div className="text-xs text-center text-gray-500 py-3 bg-white/5 rounded-xl border border-white/5 border-dashed">
                                👆 Clique no mapa para capturar o ponto {step + 1}...
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                            <Button
                                onClick={handleSavePoint}
                                disabled={!currentSVG || !lat || !lng}
                                className="flex-1 h-9 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-900/20 disabled:opacity-50"
                                size="sm"
                            >
                                <Check size={14} className="mr-1.5" />
                                Salvar Ponto
                            </Button>
                            {isCalibrated && (
                                <Button
                                    onClick={handleReset}
                                    size="sm"
                                    variant="ghost"
                                    className="h-9 w-9 px-0 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20"
                                >
                                    <X size={14} />
                                </Button>
                            )}
                        </div>

                        {/* Export Config Button */}
                        {isCalibrated && (
                            <div className="pt-3 border-t border-white/10">
                                <Button
                                    onClick={handleExportConfig}
                                    size="sm"
                                    className="w-full h-9 bg-green-600/90 hover:bg-green-500 text-white text-xs font-bold shadow-lg shadow-green-900/20"
                                >
                                    <Download size={14} className="mr-2" />
                                    Exportar Configuração
                                </Button>
                                <p className="text-[9px] text-gray-600 mt-2 text-center font-mono">
                                    client/src/config/gpsCalibration.json
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Draggable>
    );
}

// Export helper for parent component to capture click
export function shouldCaptureClick(isCalibrating: boolean): boolean {
    return isCalibrating;
}
