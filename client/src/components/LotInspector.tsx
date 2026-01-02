import React, { useState, useEffect } from "react";
import Draggable from "react-draggable";
import { Lot, LotInfo } from "@/types";
import { X, Edit2, Save, Maximize2, Minimize2, Image, FileText, User, Phone, DollarSign, Ruler, Globe, ExternalLink, Navigation, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";

import { uploadImageToImgBB } from "@/lib/imgbb";
import { toast } from "sonner";
import { openNavigation } from "@/lib/geolocation";

interface LotInspectorProps {
    lot: Lot | null;
    onClose: () => void;
    onSave: (info: LotInfo) => void;
    lotsData: Map<string, LotInfo>;
    isEditable?: boolean;
    isMobile?: boolean;
}

export function LotInspector({ lot, onClose, onSave, lotsData, isEditable = true, isMobile = false }: LotInspectorProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    
    // Form State
    const [notes, setNotes] = useState("");
    const [owner, setOwner] = useState("");
    const [ownerContact, setOwnerContact] = useState("");
    const [price, setPrice] = useState("");
    const [area, setArea] = useState("");
    const [website, setWebsite] = useState("");
    const [zona, setZona] = useState("");
    const [setor, setSetor] = useState("");
    const [loteGeo, setLoteGeo] = useState("");
    const [status, setStatus] = useState<NonNullable<LotInfo['status']>>("neutro");
    const [isAvailable, setIsAvailable] = useState(false);
    const [ownerCpf, setOwnerCpf] = useState("");
    const [photos, setPhotos] = useState<string[]>([]);
    const [showCpf, setShowCpf] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [refCode, setRefCode] = useState("");

    const nodeRef = React.useRef(null);

    const prevLotRef = React.useRef<Lot | null>(null);

    // Helper to generate normalized IPTU string for comparison
    const getIptu = (z: string, s: string, l: string) => {
        if (!z || !s || !l) return null;
        return `${z}${(/^\d+$/.test(s) ? s.padStart(4, '0') : s)}${(/^\d+$/.test(l) ? l.padStart(3, '0') : l)}000`;
    };

    // Helper to check for duplicate IPTU
    const checkDuplicateIptu = (currentId: string, z: string, s: string, l: string) => {
        const currentIptu = getIptu(z, s, l);
        if (!currentIptu) return null;

        for (const existingLotInfo of lotsData.values()) {
            // Skip self and skip if no info (shouldn't happen with values())
            if (existingLotInfo.id === currentId) continue;

            const existingIptu = getIptu(existingLotInfo.zona || "", existingLotInfo.setor || "", existingLotInfo.loteGeo || "");
            
            if (existingIptu && existingIptu === currentIptu) {
                return existingLotInfo;
            }
        }
        return null;
    };

    // Sync State with Lot & Auto-Save on Switch
    useEffect(() => {
        if (!lot) return;

        // 1. Auto-Save if switching lots (ID changed) while editing
        if (prevLotRef.current && prevLotRef.current.id !== lot.id && isEditing) {
            // Check for duplicates using CURRENT state values
            const duplicate = checkDuplicateIptu(prevLotRef.current.id, zona, setor, loteGeo);
            
            if (duplicate) {
                toast.error(`ERRO AO SALVAR LOTE ANTERIOR: Inscrição Imobiliária duplicada! Já existe na Quadra ${duplicate.quadra}, Lote ${duplicate.lote}. As alterações não foram salvas.`, {
                    duration: 8000,
                    style: {
                        background: 'white',
                        color: 'red',
                        border: '1px solid red'
                    }
                });
            } else {
                const infoToSave: LotInfo = {
                    ...(prevLotRef.current.info || {
                        id: prevLotRef.current.id,
                        quadra: prevLotRef.current.quadra,
                        lote: prevLotRef.current.lote,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        notes: ""
                    }),
                    notes,
                    owner,
                    ownerContact,
                    price: price ? Number(price) : undefined,
                    area: area ? Number(area) : undefined,
                    website,
                    zona,
                    setor,
                    loteGeo,
                    ownerCpf,
                    photos,
                    status,
                    isAvailable,
                    refCode,
                    updatedAt: new Date(),
                };
                onSave(infoToSave);
                toast.success("Dados anteriores salvos automaticamente");
            }
        }

        // 2. Update Internal State from Lot Prop
        // If it's a NEW lot (different ID), we reset everything (Exit edit mode, minimize, etc.)
        // If it's the SAME lot (same ID), we just update the fields (keep edit mode if active)
        const isNewLot = !prevLotRef.current || prevLotRef.current.id !== lot.id;

        prevLotRef.current = lot;

        const info = lot.info || {};
        
        // Always sync data
        setNotes(info.notes || "");
        setOwner(info.owner || "");
        setOwnerContact(info.ownerContact || "");
        setPrice(info.price?.toString() || "");
        setArea(info.area?.toString() || "");
        setWebsite(info.website || "");
        setZona(info.zona || "");
        setSetor(info.setor || "");
        setLoteGeo(info.loteGeo || "");
        setOwnerCpf(info.ownerCpf || "");
        setPhotos(info.photos || []);
        setStatus(info.status || "neutro");
        setIsAvailable(info.isAvailable || false);
        setRefCode(info.refCode || "");

        if (isNewLot) {
            setIsEditing(false); // Reset edit mode ONLY if it's a new lot
            setIsMinimized(false); // Expand on new selection
        }
        
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lot]);

    if (!lot) return null;

    const handleSave = () => {
        // Validation: Duplicate IPTU
        const duplicate = checkDuplicateIptu(lot.id, zona, setor, loteGeo);
        if (duplicate) {
             toast.error(`Inscrição Imobiliária duplicada! Já existe na Quadra ${duplicate.quadra}, Lote ${duplicate.lote}.`, {
                        style: {
                            background: 'white',
                            color: 'red',
                            border: '1px solid red'
                        }
                    });
            return;
        }

        const updatedInfo: LotInfo = {
            ...(lot.info || {
                id: lot.id,
                quadra: lot.quadra,
                lote: lot.lote,
                createdAt: new Date(),
                updatedAt: new Date(),
                notes: ""
            }),
            notes,
            owner,
            ownerContact,
            price: price ? Number(price) : undefined,
            area: area ? Number(area) : undefined,
            website,
            zona,
            setor,
            loteGeo,
            ownerCpf,
            photos,
            status,
            isAvailable,
            refCode,
            updatedAt: new Date(),
        };
        onSave(updatedInfo);
        setIsEditing(false);
        toast.success("Informações salvas!");
    };

    // Formats: (XX) XXXX-XXXX or (XX) XXXXX-XXXX
    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let v = e.target.value.replace(/\D/g, "");
        v = v.substring(0, 11); // Limit to 11 digits
        if (v.length > 10) {
            v = v.replace(/^(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
        } else if (v.length > 6) {
            v = v.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
        } else if (v.length > 2) {
            v = v.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
        } else if (v.length > 0) {
             v = v.replace(/^(\d{0,2})/, "($1");
        }
        setOwnerContact(v);
    };

    // Formats: XXX.XXX.XXX-XX or XX.XXX.XXX/XXXX-XX
    const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let v = e.target.value.replace(/\D/g, "");
        if (v.length > 11) {
             // CNPJ (Up to 14)
             v = v.substring(0, 14);
             v = v.replace(/^(\d{2})(\d)/, "$1.$2")
                  .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
                  .replace(/\.(\d{3})(\d)/, ".$1/$2")
                  .replace(/(\d{4})(\d)/, "$1-$2");
        } else {
             // CPF (Up to 11)
             v = v.substring(0, 11);
             v = v.replace(/(\d{3})(\d)/, "$1.$2")
                  .replace(/(\d{3})(\d)/, "$1.$2")
                  .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
        }
        setOwnerCpf(v);

        // Auto-Fill Name from existing CPF
        // Only if we have a "complete" looking CPF (at least 11 digits raw)
        const rawCpf = v.replace(/\D/g, "");
        if (rawCpf.length >= 11) {
            // console.log(`🔍 Buscando proprietário para CPF: ${rawCpf}`);
            // Search in existing data
            for (const existingInfo of lotsData.values()) {
                if (!existingInfo.ownerCpf) continue;
                // Compare raw versions
                const existingRaw = existingInfo.ownerCpf.replace(/\D/g, "");
                
                if (existingRaw === rawCpf) {
                    // console.log(`✅ Match encontrado: ${existingInfo.owner}`);
                    // Match found!
                    if (existingInfo.owner && existingInfo.owner !== owner) {
                         setOwner(existingInfo.owner);
                         toast.info(`Nome preenchido automaticamente: ${existingInfo.owner}`);
                         
                         // Optional: Auto-fill contact too if empty
                         if (existingInfo.ownerContact && !ownerContact) {
                             setOwnerContact(existingInfo.ownerContact);
                         }
                    }
                    break;
                }
            }
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const toastId = toast.loading("Enviando foto...");
        try {
            const url = await uploadImageToImgBB(file);
            const newPhotos = [...photos, url];
            setPhotos(newPhotos);
            toast.success("Foto adicionada!", { id: toastId });
        } catch (error) {
            toast.error("Erro ao enviar foto", { id: toastId });
        } finally {
            setIsUploading(false);
        }
    };

    const handleCopyIptu = () => {
        if (zona && setor && loteGeo) {
            // Formatted stripped version: ZONA SETOR LOTE 000 (just numbers)
            // User asked: "sem os -"
            // Example: 30764001000
            const iptu = `${zona}${(/^\d+$/.test(setor) ? setor.padStart(4, '0') : setor)}${(/^\d+$/.test(loteGeo) ? loteGeo.padStart(3, '0') : loteGeo)}000`;
             navigator.clipboard.writeText(iptu);
             toast.success("Inscrição copiada!");
        }
    };

    // MOBILE: Fullscreen Drawer
    if (isMobile) {
        return (
            <>
                {/* Backdrop */}
                <div 
                    className="fixed inset-0 bg-black/50 z-[100] animate-in fade-in"
                    onClick={onClose}
                />
                
                {/* Drawer */}
                <div className="fixed inset-x-0 bottom-0 top-16 z-[101] bg-black/80 backdrop-blur-2xl border-t border-white/20 overflow-hidden flex flex-col animate-in slide-in-from-bottom-full rounded-t-3xl shadow-[0_-8px_32px_rgba(0,0,0,0.5)]">
                    {/* Header - Sticky */}
                    <div className="bg-white/5 p-4 flex items-center justify-between border-b border-white/10 shadow-lg backdrop-blur-md">
                        <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${isAvailable ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse' : status === 'ocupado' ? 'bg-red-500' : status === 'livre' ? 'bg-yellow-500' : 'bg-gray-500'}`} />
                            <div className="flex flex-col">
                                <h3 className="font-bold text-white text-lg leading-none">
                                    Lote {lot.lote}
                                </h3>
                                <span className="text-xs text-blue-200/70 font-medium uppercase tracking-widest">
                                    Quadra {lot.quadra}
                                </span>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full bg-white/5 hover:bg-white/20 text-gray-300 hover:text-white transition-all active:scale-90" onClick={onClose}>
                            <X size={22} />
                        </Button>
                    </div>

                    {/* Toolbar - Sticky */}
                    <div className="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/5 backdrop-blur-sm">
                        <span className="text-xs text-gray-400 uppercase tracking-wider font-bold">Detalhes</span>
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs bg-white/5 hover:bg-white/10 text-gray-300"
                                onClick={() => {
                                    // Calculate centroid
                                    if (lot.coordinates && lot.coordinates.length > 0) {
                                        let points: [number, number][];
                                        // Check if coordinates are MultiPolygon (array of arrays of points)
                                        // lot.coordinates[0] is the first element. If it's an array of arrays (first element is array), it's Multi.
                                        // lots are either [number, number][] or [number, number][][]
                                        // If it is [number, number][][], the first element is [number, number][].
                                        // If it is [number, number][], the first element is [number, number].
                                        // We check if the first element's first element is a number.
                                        
                                        const firstEl = lot.coordinates[0];
                                        const isMulti = Array.isArray(firstEl) && Array.isArray(firstEl[0]);

                                        if (isMulti) {
                                            points = (lot.coordinates as [number, number][][]).flat();
                                        } else {
                                            points = lot.coordinates as [number, number][];
                                        }

                                        if (points.length > 0) {
                                            const center = points.reduce((acc, curr) => ({ x: acc.x + curr[0], y: acc.y + curr[1] }), { x: 0, y: 0 });
                                            const x = center.x / points.length;
                                            const y = center.y / points.length;
                                            openNavigation(x, y);
                                        }
                                    }
                                }}
                            >
                                <Navigation size={14} className="mr-1 text-blue-400" /> GPS
                            </Button>
                            {isEditable && (
                                <Button 
                                    size="sm" 
                                    variant={isEditing ? "default" : "secondary"}
                                    onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                                    className={`h-8 text-xs ${isEditing ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'}`}
                                >
                                    {isEditing ? <><Save size={14} className="mr-1"/> Salvar</> : <><Edit2 size={14} className="mr-1"/> Editar</>}
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Content - Scrollable */}
                    <div className="flex-1 overflow-y-auto p-4">
                        <div className="space-y-4" key={isEditing ? 'editing' : 'viewing'}>
                            
                            {/* PRICE & AREA */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-xs text-gray-500 uppercase flex items-center gap-1"><DollarSign size={12}/> Preço (R$)</Label>
                                    {isEditing ? (
                                        <Input className="h-11 bg-black/50 text-white border-white/20 text-base" value={price} onChange={e => setPrice(e.target.value)} type="number" placeholder="0.00" />
                                    ) : (
                                        <div className="font-mono text-xl text-green-400 font-bold">
                                            {price ? Number(price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : "--"}
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-gray-500 uppercase flex items-center gap-1"><Ruler size={12}/> Área (m²)</Label>
                                    {isEditing ? (
                                        <Input className="h-11 bg-black/50 text-white border-white/20 text-base" value={area} onChange={e => setArea(e.target.value)} type="number" placeholder="0" />
                                    ) : (
                                        <div className="font-mono text-xl text-blue-400 font-bold">
                                            {area ? `${area} m²` : "--"}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <Separator className="bg-white/10" />

                            {/* LOCATION INFO (New) */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-xs text-gray-500 uppercase">Zona</Label>
                                    {isEditing ? (
                                        <Input className="h-9 bg-black/50 text-white border-white/20 text-sm" value={zona} onChange={e => setZona(e.target.value)} placeholder="Ex: Z1" />
                                    ) : (
                                        <div className="text-base text-gray-300 font-medium">{zona || "--"}</div>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-gray-500 uppercase">Setor</Label>
                                    {isEditing ? (
                                        <Input className="h-9 bg-black/50 text-white border-white/20 text-sm" value={setor} onChange={e => setSetor(e.target.value)} placeholder="Ex: A" />
                                    ) : (
                                        <div className="text-base text-gray-300 font-medium">{setor || "--"}</div>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-gray-500 uppercase">Lote Geo</Label>
                                    {isEditing ? (
                                        <Input className="h-9 bg-black/50 text-white border-white/20 text-sm" value={loteGeo} onChange={e => setLoteGeo(e.target.value)} placeholder="000" />
                                    ) : (
                                        <div className="text-base text-gray-300 font-medium">{loteGeo || "--"}</div>
                                    )}
                                </div>
                            </div>

                            {/* IPTU INSCRIPTION (Mobile) */}
                            <div className="mt-3 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-center relative group backdrop-blur-md shadow-inner">
                                <Label className="text-[10px] text-blue-400 uppercase tracking-widest mb-1 block">Inscrição Imobiliária (IPTU)</Label>
                                <div className="font-mono text-lg font-bold text-blue-100 tracking-wider flex items-center justify-center gap-2">
                                    {zona && setor && loteGeo ? (
                                        <>
                                            <span>{`${zona}-${(/^\d+$/.test(setor) ? setor.padStart(4, '0') : setor)}-${(/^\d+$/.test(loteGeo) ? loteGeo.padStart(3, '0') : loteGeo)}-000`}</span>
                                            <button onClick={handleCopyIptu} className="p-1.5 hover:bg-blue-500/20 rounded-md transition-colors text-blue-400 hover:text-blue-300" title="Copiar sem formatação">
                                                <Copy size={16} />
                                            </button>
                                        </>
                                    ) : <span className="text-gray-500 text-sm">--</span>}
                                </div>
                            </div>
                            
                            <Separator className="bg-white/10" />

                            {/* AVAILABILITY STATUS */}
                            <div className="space-y-2">
                                <Label className="text-xs text-gray-500 uppercase">Status & Disponibilidade</Label>
                                <div className="bg-white/5 p-3 rounded-lg border border-white/10 space-y-3">
                                    {/* Availability Toggle */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-gray-200 flex items-center gap-2">
                                                {isAvailable ? <span className="text-green-500">●</span> : <span className="text-gray-500">○</span>}
                                                Disponível p/ Venda
                                            </span>
                                            <span className="text-[10px] text-gray-500">
                                                Visível no mapa (Imobiliária)
                                            </span>
                                        </div>
                                        {isEditing ? (
                                            <button 
                                                onClick={() => {
                                                    if (!isAvailable) {
                                                        const code = window.prompt("Digite o código de referência da imobiliária:", refCode);
                                                        if (code && code.trim().length > 0) {
                                                            setRefCode(code);
                                                            setIsAvailable(true);
                                                        } else {
                                                            toast.error("É necessário informar o código para disponibilizar o lote.");
                                                        }
                                                    } else {
                                                        setIsAvailable(false);
                                                    }
                                                }}
                                                className={`w-12 h-6 rounded-full transition-colors relative ${isAvailable ? 'bg-green-600' : 'bg-gray-600'}`}
                                            >
                                                <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${isAvailable ? 'left-7' : 'left-1'}`} />
                                            </button>
                                        ) : (
                                            <div className={`px-2 py-1 rounded text-xs font-bold ${isAvailable ? 'bg-green-900/30 text-green-400 border border-green-500/30' : 'bg-gray-800 text-gray-400'}`}>
                                                {isAvailable ? "SIM" : "NÃO"}
                                            </div>
                                        )}
                                    </div>

                                    {/* REFERENCE CODE (Only if Available) */}
                                    {isAvailable && (
                                        <div className="animate-in slide-in-from-top-2 fade-in duration-200 pt-2 border-t border-white/5 mt-2">
                                            <Label className="text-[10px] text-green-400 uppercase font-bold mb-1 block">Código de Referência</Label>
                                            {isEditing ? (
                                                <Input 
                                                    className="h-9 bg-black/50 text-white border-green-500/30 focus:border-green-500/60 text-sm" 
                                                    value={refCode} 
                                                    onChange={e => setRefCode(e.target.value)} 
                                                    placeholder="Cód. Imobiliária" 
                                                />
                                            ) : (
                                                <div className="bg-green-500/10 border border-green-500/20 rounded px-3 py-1.5 text-green-300 font-mono text-sm tracking-wider font-bold">
                                                    {refCode || <span className="opacity-50 text-xs font-sans font-normal italic">Sem código</span>}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <Separator className="bg-white/10" />

                                    {/* Condition Status */}
                                    <div className="space-y-2">
                                        <Label className="text-[10px] text-gray-400 uppercase">Condição / Ocupação</Label>
                                        {isEditing ? (
                                            <div className="grid grid-cols-3 gap-1 bg-black/50 rounded-lg p-1 border border-white/10">
                                                <button onClick={() => setStatus('neutro')} className={`py-1.5 rounded text-xs font-bold transition-all ${status === 'neutro' ? 'bg-gray-600 text-white shadow' : 'text-gray-500 hover:text-white'}`}>Neutro</button>
                                                <button onClick={() => setStatus('livre')} className={`py-1.5 rounded text-xs font-bold transition-all ${status === 'livre' ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:text-white'}`}>Livre</button>
                                                <button onClick={() => setStatus('ocupado')} className={`py-1.5 rounded text-xs font-bold transition-all ${status === 'ocupado' ? 'bg-red-600 text-white shadow' : 'text-gray-500 hover:text-white'}`}>Ocupado</button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${status === 'ocupado' ? 'bg-red-500' : status === 'livre' ? 'bg-blue-500' : 'bg-gray-500'}`} />
                                                <span className="text-sm font-medium text-gray-300 capitalize">{status}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            <Separator className="bg-white/10" />

                            {/* OWNER INFO */}
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <Label className="text-xs text-gray-500 uppercase flex items-center gap-1"><User size={12}/> Proprietário</Label>
                                    {isEditing ? (
                                        <Input className="h-11 bg-black/50 text-white border-white/20 text-base" value={owner} onChange={e => setOwner(e.target.value)} placeholder="Nome do proprietário" />
                                    ) : (
                                        <div className="text-base text-gray-200 font-medium">{owner || <span className="text-gray-600 italic">Não informado</span>}</div>
                                    )}
                                </div>
                                <div className="space-y-1">
                                     <Label className="text-xs text-gray-500 uppercase flex items-center gap-1"><Phone size={12}/> Contato</Label>
                                     {isEditing ? (
                                        <Input className="h-11 bg-black/50 text-white border-white/20 text-base" value={ownerContact} onChange={handlePhoneChange} placeholder="(00) 00000-0000" />
                                    ) : (
                                        <div className="text-base text-gray-200">{ownerContact || <span className="text-gray-600 italic">--</span>}</div>
                                    )}
                                </div>
                                 <div className="space-y-1">
                                     <Label className="text-xs text-gray-500 uppercase flex items-center gap-1"><Globe size={12}/> Website / Link</Label>
                                     {isEditing ? (
                                        <Input className="h-11 bg-black/50 text-white border-white/20 text-base" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." />
                                    ) : (

                                        website ? (
                                            <a 
                                                href={website} 
                                                target="_blank" 
                                                rel="noreferrer" 
                                                className="flex items-center justify-center w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs py-2 rounded-md transition-all shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 font-bold animate-pulse mt-1"
                                            >
                                                <ExternalLink size={14} className="mr-2" />
                                                ACESSAR LINK
                                            </a>
                                        ) : <span className="text-gray-600 italic text-base">--</span>
                                    )}
                                </div>
                                <div className="space-y-1">
                                     <Label className="text-xs text-gray-500 uppercase flex items-center gap-1">CPF (Proprietário)</Label>
                                     <div className="flex items-center gap-2">
                                         {isEditing ? (
                                            <Input className="h-11 bg-black/50 text-white border-white/20 text-base flex-1" value={ownerCpf} onChange={handleCpfChange} placeholder="000.000.000-00" />
                                         ) : (
                                            <div className="text-base text-gray-200 font-mono tracking-wider flex-1">
                                                {showCpf ? (ownerCpf || "--") : (ownerCpf ? "•••.•••.•••-••" : "--")}
                                            </div>
                                         )}
                                         <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-10 w-10 text-gray-400 hover:text-white"
                                            onClick={() => setShowCpf(!showCpf)}
                                            title={showCpf ? "Ocultar CPF" : "Mostrar CPF"}
                                         >
                                            {showCpf ? <span className="text-lg">👁️</span> : <span className="text-lg opacity-50">👁️‍🗨️</span>} 
                                         </Button>
                                     </div>
                                </div>
                            </div>

                            <Separator className="bg-white/10" />

                            {/* PHOTOS */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs text-gray-500 uppercase flex items-center gap-1"><Image size={12}/> Fotos</Label>
                                    {isEditing && (
                                        <label className="cursor-pointer bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 text-xs px-3 py-1.5 rounded transition-colors flex items-center gap-1">
                                            Add Foto
                                            <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={isUploading} />
                                        </label>
                                    )}
                                </div>
                                
                                {photos.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        {photos.map((url, idx) => (
                                            <div key={idx} className="relative group aspect-video rounded-md overflow-hidden bg-black/50 border border-white/10">
                                                <img src={url} alt={`Foto ${idx+1}`} className="w-full h-full object-cover" />
                                                {isEditing && (
                                                    <button 
                                                        className="absolute top-1 right-1 bg-red-500/80 p-1.5 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={() => setPhotos(photos.filter((_, i) => i !== idx))}
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-6 text-sm text-gray-600 bg-white/5 rounded border border-white/5 border-dashed">
                                        Sem fotos
                                    </div>
                                )}
                            </div>

                            <Separator className="bg-white/10" />

                            {/* NOTES */}
                            <div className="space-y-1">
                                 <Label className="text-xs text-gray-500 uppercase flex items-center gap-1"><FileText size={12}/> Notas Internas</Label>
                                 {isEditing ? (
                                     <Textarea className="bg-black/50 text-white border-white/20 min-h-[100px] text-base" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anotações sobre o lote..." />
                                 ) : (
                                     <div className="text-base text-gray-300 whitespace-pre-wrap leading-relaxed bg-white/5 p-3 rounded max-h-[150px] overflow-y-auto">
                                         {notes || <span className="text-gray-600 italic">Sem anotações.</span>}
                                     </div>
                                 )}
                            </div>

                        </div>
                    </div>

                    {/* Footer - Sticky (only when editing) */}
                    {isEditing && (
                        <div className="bg-zinc-900 p-4 border-t border-white/20 flex gap-2">
                            <Button onClick={handleSave} className="flex-1 bg-green-600 hover:bg-green-700 h-11 text-base">
                                <Save size={16} className="mr-2" /> Salvar
                            </Button>
                            <Button onClick={() => setIsEditing(false)} variant="outline" className="flex-1 h-11 text-base">
                                Cancelar
                            </Button>
                        </div>
                    )}
                </div>
            </>
        );
    }

    // DESKTOP: Draggable Panel (original)
    return (
        <Draggable nodeRef={nodeRef} handle=".drag-handle">
            <div ref={nodeRef} className={`fixed top-24 right-6 z-40 bg-zinc-900/80 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/80 rounded-2xl overflow-hidden transition-all duration-300 ring-1 ring-white/5 ${isMinimized ? "w-72 h-auto" : "w-[400px] max-h-[85vh]"}`}>
                
                {/* Header / Drag Handle */}
                <div className="drag-handle cursor-move bg-gradient-to-r from-white/10 to-transparent p-4 flex items-center justify-between border-b border-white/5 group relative overflow-hidden">
                    <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    
                    <div className="flex items-center gap-3 relative z-10">
                        <div className={`w-3 h-3 rounded-full ring-2 ring-white/10 ${isAvailable ? 'bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.8)]' : status === 'ocupado' ? 'bg-red-500' : status === 'livre' ? 'bg-blue-500' : 'bg-gray-500'}`} />
                        <div>
                             <h3 className="font-bold text-white text-lg tracking-tight leading-none">
                                Quadra {lot.quadra}
                            </h3>
                             <span className="text-xs font-mono text-blue-300/80 uppercase tracking-widest">Lote {lot.lote}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity relative z-10">
                         <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg" onClick={() => setIsMinimized(!isMinimized)}>
                            {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg" onClick={onClose}>
                            <X size={14} />
                        </Button>
                    </div>
                </div>

                {/* Content */}
                {!isMinimized && (
                    <div className="flex flex-col h-full">
                         {/* Toolbar */}
                        <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10">
                            <span className="text-xs text-gray-400 uppercase tracking-wider font-bold">Detalhes</span>
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs bg-white/5 hover:bg-white/10 text-gray-300"
                                    onClick={() => {
                                        // Calculate centroid
                                        if (lot.coordinates && lot.coordinates.length > 0) {
                                            let points: [number, number][];
                                            const firstEl = lot.coordinates[0];
                                            const isMulti = Array.isArray(firstEl) && Array.isArray(firstEl[0]);

                                            if (isMulti) {
                                                points = (lot.coordinates as [number, number][][]).flat();
                                            } else {
                                                points = lot.coordinates as [number, number][];
                                            }

                                            if (points.length > 0) {
                                                const center = points.reduce((acc, curr) => ({ x: acc.x + curr[0], y: acc.y + curr[1] }), { x: 0, y: 0 });
                                                const x = center.x / points.length;
                                                const y = center.y / points.length;
                                                openNavigation(x, y);
                                            }
                                        }
                                    }}
                                    title="Abrir no GPS"
                                >
                                    <Navigation size={12} className="mr-1 text-blue-400" /> GPS
                                </Button>
                                {isEditable && (
                                    <Button 
                                        size="sm" 
                                        variant={isEditing ? "default" : "secondary"}
                                        onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                                        className={`h-7 text-xs ${isEditing ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'}`}
                                    >
                                        {isEditing ? <><Save size={12} className="mr-1"/> Salvar</> : <><Edit2 size={12} className="mr-1"/> Editar</>}
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 p-4 overflow-y-auto max-h-[60vh] custom-scrollbar">
                            {/* Content container - Key restored to prevent reconciliation errors */}
                            <div className="space-y-4" key={isEditing ? 'editing' : 'viewing'}>
                                
                                {/* PRICE & AREA */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-[10px] text-gray-500 uppercase flex items-center gap-1"><DollarSign size={10}/> Preço (R$)</Label>
                                        {isEditing ? (
                                            <Input className="h-8 bg-black/50 text-white border-white/20" value={price} onChange={e => setPrice(e.target.value)} type="number" placeholder="0.00" />
                                        ) : (
                                            <div className="font-mono text-lg text-green-400 font-bold">
                                                {price ? Number(price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : "--"}
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] text-gray-500 uppercase flex items-center gap-1"><Ruler size={10}/> Área (m²)</Label>
                                        {isEditing ? (
                                            <Input className="h-8 bg-black/50 text-white border-white/20" value={area} onChange={e => setArea(e.target.value)} type="number" placeholder="0" />
                                        ) : (
                                            <div className="font-mono text-lg text-blue-400 font-bold">
                                                {area ? `${area} m²` : "--"}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <Separator className="bg-white/10" />

                                {/* LOCATION INFO (New) */}
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="space-y-1">
                                        <Label className="text-[10px] text-gray-500 uppercase">Zona</Label>
                                        {isEditing ? (
                                            <Input className="h-7 bg-black/50 text-white border-white/20 text-xs" value={zona} onChange={e => setZona(e.target.value)} placeholder="Ex: Z1" />
                                        ) : (
                                            <div className="text-sm text-gray-300 font-medium">{zona || "--"}</div>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] text-gray-500 uppercase">Setor</Label>
                                        {isEditing ? (
                                            <Input className="h-7 bg-black/50 text-white border-white/20 text-xs" value={setor} onChange={e => setSetor(e.target.value)} placeholder="Ex: A" />
                                        ) : (
                                            <div className="text-sm text-gray-300 font-medium">{setor || "--"}</div>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] text-gray-500 uppercase">Lote Geo</Label>
                                        {isEditing ? (
                                            <Input className="h-7 bg-black/50 text-white border-white/20 text-xs" value={loteGeo} onChange={e => setLoteGeo(e.target.value)} placeholder="000" />
                                        ) : (
                                            <div className="text-sm text-gray-300 font-medium">{loteGeo || "--"}</div>
                                        )}
                                    </div>
                                </div>

                                {/* IPTU INSCRIPTION (Desktop) */}
                                <div className="mt-2 bg-blue-900/10 border border-blue-500/20 rounded p-2 text-center relative group">
                                    <Label className="text-[10px] text-blue-400 uppercase tracking-widest mb-1 block">Inscrição Imobiliária (IPTU)</Label>
                                    <div className="font-mono text-base font-bold text-blue-100 tracking-wider flex items-center justify-center gap-2">
                                        {zona && setor && loteGeo ? (
                                            <>
                                                <span>{`${zona}-${(/^\d+$/.test(setor) ? setor.padStart(4, '0') : setor)}-${(/^\d+$/.test(loteGeo) ? loteGeo.padStart(3, '0') : loteGeo)}-000`}</span>
                                                <button onClick={handleCopyIptu} className="p-1 hover:bg-blue-500/20 rounded-md transition-colors text-blue-400 hover:text-blue-300" title="Copiar sem formatação">
                                                    <Copy size={14} />
                                                </button>
                                            </>
                                        ) : <span className="text-gray-500 text-sm">--</span>}
                                    </div>
                                </div>

                                <Separator className="bg-white/10" />

                                {/* AVAILABILITY STATUS (Desktop) */}
                                <div className="space-y-2">
                                    <Label className="text-[10px] text-gray-500 uppercase">Status & Disponibilidade</Label>
                                    <div className="bg-white/5 p-2 rounded border border-white/10 space-y-2">
                                        {/* Availability Toggle */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-gray-200 flex items-center gap-1">
                                                    {isAvailable ? <span className="text-green-500">●</span> : <span className="text-gray-500">○</span>}
                                                    Disponível p/ Venda
                                                </span>
                                            </div>
                                            {isEditing ? (
                                                <button 
                                                    onClick={() => {
                                                        if (!isAvailable) {
                                                            const code = window.prompt("Digite o código de referência da imobiliária:", refCode);
                                                            if (code && code.trim().length > 0) {
                                                                setRefCode(code);
                                                                setIsAvailable(true);
                                                            } else {
                                                                toast.error("É necessário informar o código para disponibilizar o lote.");
                                                            }
                                                        } else {
                                                            setIsAvailable(false);
                                                        }
                                                    }}
                                                    className={`w-8 h-4 rounded-full transition-colors relative ${isAvailable ? 'bg-green-600' : 'bg-gray-600'}`}
                                                >
                                                    <div className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform ${isAvailable ? 'left-4.5' : 'left-0.5'}`} style={{ left: isAvailable ? '18px' : '2px' }} />
                                                </button>
                                            ) : (
                                                <div className={`px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold ${isAvailable ? 'bg-green-900/30 text-green-400 border border-green-500/30' : 'bg-gray-800 text-gray-400'}`}>
                                                    {isAvailable ? "SIM" : "NÃO"}
                                                </div>
                                            )}
                                        </div>

                                        <Separator className="bg-white/10" />

                                        {/* Condition Status */}
                                        <div className="flex items-center justify-between">
                                             <Label className="text-[10px] text-gray-400 uppercase">Condição</Label>
                                             {isEditing ? (
                                                 <div className="flex bg-black/50 rounded p-0.5 border border-white/10">
                                                     <button onClick={() => setStatus('neutro')} className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${status === 'neutro' ? 'bg-gray-600 text-white shadow' : 'text-gray-500 hover:text-white'}`}>Neutro</button>
                                                     <button onClick={() => setStatus('livre')} className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${status === 'livre' ? 'bg-yellow-600 text-white shadow' : 'text-gray-500 hover:text-white'}`}>Livre</button>
                                                     <button onClick={() => setStatus('ocupado')} className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${status === 'ocupado' ? 'bg-red-600 text-white shadow' : 'text-gray-500 hover:text-white'}`}>Ocupado</button>
                                                 </div>
                                             ) : (
                                                 <div className="flex items-center gap-1.5">
                                                     <div className={`w-1.5 h-1.5 rounded-full ${status === 'ocupado' ? 'bg-red-500' : status === 'livre' ? 'bg-yellow-500' : 'bg-gray-500'}`} />
                                                     <span className="text-xs font-medium text-gray-300 capitalize">{status}</span>
                                                 </div>
                                             )}
                                        </div>
                                    </div>
                                </div>

                                <Separator className="bg-white/10" />

                                {/* OWNER INFO */}
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <Label className="text-[10px] text-gray-500 uppercase flex items-center gap-1"><User size={10}/> Proprietário</Label>
                                        {isEditing ? (
                                            <Input className="h-8 bg-black/50 text-white border-white/20" value={owner} onChange={e => setOwner(e.target.value)} placeholder="Nome do proprietário" />
                                        ) : (
                                            <div className="text-sm text-gray-200 font-medium">{owner || <span className="text-gray-600 italic">Não informado</span>}</div>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                         <Label className="text-[10px] text-gray-500 uppercase flex items-center gap-1"><Phone size={10}/> Contato</Label>
                                         {isEditing ? (
                                            <Input className="h-8 bg-black/50 text-white border-white/20" value={ownerContact} onChange={handlePhoneChange} placeholder="(00) 00000-0000" />
                                        ) : (
                                            <div className="text-sm text-gray-200">{ownerContact || <span className="text-gray-600 italic">--</span>}</div>
                                        )}
                                    </div>
                                     <div className="space-y-1">
                                         <Label className="text-[10px] text-gray-500 uppercase flex items-center gap-1"><Globe size={10}/> Website / Link</Label>
                                         {isEditing ? (
                                            <Input className="h-8 bg-black/50 text-white border-white/20" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." />
                                        ) : (
                                            website ? (
                                                <a 
                                                    href={website} 
                                                    target="_blank" 
                                                    rel="noreferrer" 
                                                    className="flex items-center justify-center w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs py-2 rounded-md transition-all shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 font-bold animate-pulse mt-1"
                                                >
                                                    <ExternalLink size={14} className="mr-2" />
                                                    ACESSAR LINK
                                                </a>
                                            ) : <span className="text-gray-600 italic text-sm">--</span>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                         <Label className="text-[10px] text-gray-500 uppercase flex items-center gap-1">CPF (Proprietário)</Label>
                                         <div className="flex items-center gap-2">
                                             {isEditing ? (
                                                <Input className="h-8 bg-black/50 text-white border-white/20 text-xs flex-1" value={ownerCpf} onChange={handleCpfChange} placeholder="000.000.000-00" />
                                             ) : (
                                                <div className="text-sm text-gray-200 font-mono tracking-wider flex-1">
                                                    {showCpf ? (ownerCpf || "--") : (ownerCpf ? "•••.•••.•••-••" : "--")}
                                                </div>
                                             )}
                                             <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-6 w-6 text-gray-400 hover:text-white"
                                                onClick={() => setShowCpf(!showCpf)}
                                                title={showCpf ? "Ocultar CPF" : "Mostrar CPF"}
                                             >
                                                {showCpf ? <span className="text-xs">👁️</span> : <span className="text-xs opacity-50">👁️‍🗨️</span>} 
                                             </Button>
                                         </div>
                                    </div>
                                </div>

                                <Separator className="bg-white/10" />

                                {/* PHOTOS */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-[10px] text-gray-500 uppercase flex items-center gap-1"><Image size={10}/> Fotos</Label>
                                        {isEditing && (
                                            <label className="cursor-pointer bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 text-[10px] px-2 py-1 rounded transition-colors flex items-center gap-1">
                                                Add Foto
                                                <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={isUploading} />
                                            </label>
                                        )}
                                    </div>
                                    
                                    {photos.length > 0 ? (
                                        <div className="grid grid-cols-2 gap-2">
                                            {photos.map((url, idx) => (
                                                <div key={idx} className="relative group aspect-video rounded-md overflow-hidden bg-black/50 border border-white/10">
                                                    <img src={url} alt={`Foto ${idx+1}`} className="w-full h-full object-cover" />
                                                    {isEditing && (
                                                        <button 
                                                            className="absolute top-1 right-1 bg-red-500/80 p-1 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onClick={() => setPhotos(photos.filter((_, i) => i !== idx))}
                                                        >
                                                            <X size={10} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-4 text-xs text-gray-600 bg-white/5 rounded border border-white/5 border-dashed">
                                            Sem fotos
                                        </div>
                                    )}
                                </div>

                                <Separator className="bg-white/10" />

                                {/* NOTES */}
                                <div className="space-y-1">
                                     <Label className="text-[10px] text-gray-500 uppercase flex items-center gap-1"><FileText size={10}/> Notas Internas</Label>
                                     {isEditing ? (
                                         <Textarea className="bg-black/50 text-white border-white/20 min-h-[80px]" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anotações sobre o lote..." />
                                     ) : (
                                         <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed bg-white/5 p-2 rounded max-h-[100px] overflow-y-auto custom-scrollbar">
                                             {notes || <span className="text-gray-600 italic">Sem anotações.</span>}
                                         </div>
                                     )}
                                </div>

                            </div>
                        </div>
                        {isEditing && (
                            <div className="bg-zinc-900/90 p-3 border-t border-white/10 flex gap-2 backdrop-blur-sm">
                                <Button onClick={handleSave} size="sm" className="flex-1 bg-green-600 hover:bg-green-700">
                                    <Save size={14} className="mr-2" /> Salvar
                                </Button>
                                <Button onClick={() => setIsEditing(false)} size="sm" variant="outline" className="flex-1">
                                    Cancelar
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Draggable>
    );
}

