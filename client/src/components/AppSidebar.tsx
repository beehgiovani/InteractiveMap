
import React, { useState, useEffect } from "react";
import { Lot, LotInfo } from "@/types";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { 
  Map as MapIcon, 
  Home as HomeIcon, 
  Search, 
  Layers, 
  Info, 
  Edit2, 
  Save, 
  X,
  FileText,
  DollarSign,
  User,
  Ruler,
  Phone,
  Image as ImageIcon,
  Link as LinkIcon,
  Trash2,
  CloudUpload,
  ArrowRightCircle
} from "lucide-react";
import { syncLotsToFirestore } from "@/lib/firestoreSync";
import { uploadImageToImgBB } from "@/lib/imgbb";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { auth } from "@/lib/auth"; // Import auth
import { useLocation } from "wouter"; // Import location for redirect
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";

interface AppSidebarProps {
  selectedLot: Lot | null;
  onCloseLot: () => void;
  onSaveLot: (info: LotInfo) => void;
  lotsData: Map<string, LotInfo>;
  manualLots: Lot[];
  onSelectLot: (lot: Lot) => void;
  onExportBackup: () => void;
  lastSaved: Date | null;
}

export function AppSidebar({ selectedLot, onCloseLot, onSaveLot, lotsData, manualLots, onSelectLot, onExportBackup, lastSaved }: AppSidebarProps) {
  // Lot Inspector State (Similar to LotFolder)
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Lot[]>([]); 
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    auth.logout();
    setLocation("/login");
    toast.info("Sessão encerrada");
  };

  const handleChangePassword = () => {
    const newPass = prompt("Digite a nova senha:");
    if (newPass) {
      auth.changePassword(newPass);
      toast.success("Senha alterada com sucesso!");
    }
  };

  const handleSync = async () => {
      if (!manualLots.length) return;
      if (!confirm("Isso fará o upload dos dados locais para a nuvem. Continuar?")) return;
      
      setIsSyncing(true);
      try {
          await syncLotsToFirestore(manualLots, lotsData);
          alert("Sincronização concluída com sucesso!");
      } catch (error) {
          console.error("Sync failed:", error);
          alert("Erro ao sincronizar. Verifique o console.");
      } finally {
          setIsSyncing(false);
      }
  };

  const [notes, setNotes] = useState("");
  const [documentation, setDocumentation] = useState("");
  const [owner, setOwner] = useState("");
  const [ownerContact, setOwnerContact] = useState(""); // New
  const [price, setPrice] = useState("");
  const [area, setArea] = useState("");
  const [photos, setPhotos] = useState<string[]>([]); // New
  const [documents, setDocuments] = useState<{name: string, url: string}[]>([]); // New

  // Sync state when lot changes
  useEffect(() => {
    if (selectedLot) {
      setNotes(selectedLot.info.notes || "");
      setDocumentation(selectedLot.info.documentation || "");
      setOwner(selectedLot.info.owner || "");
      setOwnerContact(selectedLot.info.ownerContact || "");
      setPrice(selectedLot.info.price?.toString() || "");
      setArea(selectedLot.info.area?.toString() || "");
      setPhotos(selectedLot.info.photos || []);
      setDocuments(selectedLot.info.documents || []);
      setDocuments(selectedLot.info.documents || []);
      setIsEditing(false);
    }
  }, [selectedLot]);

  // Search Logic
  useEffect(() => {
      if (!searchTerm.trim()) {
          setSearchResults([]);
          return;
      }
      const term = searchTerm.toLowerCase();
      const results = manualLots.filter(l => 
          l.lote.toLowerCase().includes(term) || 
          l.quadra.toLowerCase().includes(term) ||
          `Q${l.quadra} L${l.lote}`.toLowerCase().includes(term)
      );
      setSearchResults(results.slice(0, 50)); // Limit to 50
  }, [searchTerm, manualLots]);

  const handleSave = () => {
    if (!selectedLot) return;
    
    const updatedInfo: LotInfo = {
      ...selectedLot.info,
      notes,
      documentation,
      owner,
      ownerContact,
      price: price ? Number(price) : undefined,
      area: area ? Number(area) : undefined,
      photos,
      documents,
      updatedAt: new Date(),
    };
    onSaveLot(updatedInfo);
    setIsEditing(false);
  };

  const handleAddPhoto = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        setIsUploading(true);
        const toastId = toast.loading("Enviando imagem para ImgBB...");
        
        try {
            const url = await uploadImageToImgBB(file);
            
            // Auto-save logic
            const newPhotos = [...photos, url];
            setPhotos(newPhotos);
            
            if (selectedLot) {
                const updatedInfo: LotInfo = {
                    ...selectedLot.info,
                    notes,
                    documentation,
                    owner,
                    ownerContact,
                    price: price ? Number(price) : undefined,
                    area: area ? Number(area) : undefined,
                    photos: newPhotos, // Use the new array
                    documents,
                    updatedAt: new Date(),
                };
                onSaveLot(updatedInfo); // Persist immediately
            }

            toast.success("Imagem enviada e salva com sucesso!", { id: toastId });
        } catch (error: any) {
            console.error(error);
            toast.error(`Erro: ${error.message}`, { id: toastId });
        } finally {
            setIsUploading(false);
        }
    };
    input.click();
  };

  const handleAddDocument = () => {
      const name = prompt("Nome do Documento (Ex: Matrícula):");
      if (!name) return;
      
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.txt'; 
      input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) return;

          setIsUploading(true);
          const toastId = toast.loading("Enviando documento para Cloudinary...");

          try {
              const url = await uploadToCloudinary(file);
              
              // Auto-save logic
              const newDocs = [...documents, { name, url }];
              setDocuments(newDocs);

              if (selectedLot) {
                  const updatedInfo: LotInfo = {
                      ...selectedLot.info,
                      notes,
                      documentation,
                      owner,
                      ownerContact,
                      price: price ? Number(price) : undefined,
                      area: area ? Number(area) : undefined,
                      photos, 
                      documents: newDocs, 
                      updatedAt: new Date(),
                  };
                  onSaveLot(updatedInfo); 
              }

              toast.success("Documento enviado e salvo com sucesso!", { id: toastId });
          } catch (error: any) {
              console.error(error);
              toast.error(`Erro: ${error.message}`, { id: toastId });
          } finally {
              setIsUploading(false);
          }
      };
      input.click();
  };

  if (selectedLot) {
    return (
      <Sidebar className="border-r border-white/20 bg-zinc-950/95 backdrop-blur-xl text-white shadow-2xl">
        <SidebarHeader className="bg-gradient-to-r from-blue-900/50 to-cyan-900/50 border-b border-white/10 p-6 relative overflow-hidden shrink-0">
          <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
          <div className="flex items-center justify-between relative z-10">
             <div>
                <h2 className="text-3xl font-bold text-white tracking-tight drop-shadow-md">Lote {selectedLot.lote}</h2>
                <p className="text-blue-200 text-sm font-semibold tracking-wide mt-1">QUADRA {selectedLot.quadra}</p>
             </div>
             <Button variant="ghost" size="icon" onClick={onCloseLot} className="text-blue-200 hover:bg-white/10 hover:text-white h-8 w-8 rounded-full transition-colors">
                 <X size={20} />
             </Button>
          </div>
        </SidebarHeader>
        
        <SidebarContent className="p-4 gap-6">
            
            {/* Status Card */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-5 grid grid-cols-2 gap-4 relative overflow-hidden group hover:border-blue-500/30 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="relative z-10 flex flex-col">
                    <span className="text-blue-200/70 text-[10px] uppercase tracking-widest font-semibold mb-1">Área Total</span>
                    <div className="font-bold text-3xl text-white tracking-tighter shadow-black/50 drop-shadow-sm">
                        {area || "-"} <span className="text-sm font-normal text-blue-200/50 align-baseline ml-0.5">m²</span>
                    </div>
                </div>
                
                <div className="relative z-10 flex flex-col border-l border-white/5 pl-4">
                    <span className="text-blue-200/70 text-[10px] uppercase tracking-widest font-semibold mb-1">Valor Estimado</span>
                    <div className="font-bold text-2xl text-emerald-400 tracking-tight shadow-black/50 drop-shadow-sm break-all">
                        <span className="text-sm font-normal text-emerald-600/70 mr-0.5">R$</span>{price || "-"}
                    </div>
                </div>
            </div>

            {/* Editing Controls */}
            {!isEditing ? (
                 <Button onClick={() => setIsEditing(true)} variant="outline" className="w-full bg-white/5 border-white/10 text-blue-200 hover:bg-blue-600 hover:text-white hover:border-blue-500/50 transition-all font-medium">
                    <Edit2 size={16} className="mr-2"/> Editar Dados do Lote
                 </Button>
            ) : (
                 <div className="flex gap-2 animate-in fade-in zoom-in-95 duration-200">
                     <Button onClick={() => setIsEditing(false)} variant="ghost" className="flex-1 text-gray-400 hover:text-white hover:bg-white/10">Cancelar</Button>
                     <Button onClick={handleSave} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 border border-blue-400/20">Salvar Alterações</Button>
                 </div>
            )}

            <Separator />

            {/* Detail Fields */}
            <div className="space-y-6">
                
                <div className="space-y-3">
                    <label className="text-xs font-bold text-blue-300/80 uppercase flex items-center gap-2">
                        <User size={14} className="text-blue-500" /> Proprietário
                    </label>
                    <div className="bg-black/20 p-4 rounded-xl border border-white/5 space-y-2 backdrop-blur-sm">
                        {isEditing ? (
                            <>
                                <Input placeholder="Nome do Proprietário" value={owner} onChange={e => setOwner(e.target.value)} className="bg-black/50 border-white/20 text-white placeholder:text-gray-500 focus:border-blue-500/50 focus:bg-black/70 transition-colors" />
                                <div className="flex items-center gap-2">
                                    <Phone size={16} className="text-gray-500" />
                                    <Input placeholder="Contato / Telefone" value={ownerContact} onChange={e => setOwnerContact(e.target.value)} className="bg-black/50 border-white/20 text-white placeholder:text-gray-500 focus:border-blue-500/50 focus:bg-black/70 transition-colors" />
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="text-lg font-medium text-white tracking-tight">{owner || "Não informado"}</div>
                                {ownerContact && (
                                    <div className="text-sm text-gray-400 flex items-center gap-2">
                                        <div className="p-1 bg-white/5 rounded-full"><Phone size={10} /></div> {ownerContact}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* PHOTOS */}
                <div className="space-y-3">
                     <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-blue-300/80 uppercase flex items-center gap-2">
                            <ImageIcon size={14} className="text-blue-500" /> Galeria de Fotos
                        </label>
                        {isEditing && <Button size="sm" variant="ghost" className="h-6 text-[10px] text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 uppercase tracking-wider font-bold" onClick={handleAddPhoto}>+ Adicionar URL</Button>}
                     </div>
                     
                     <div className="grid grid-cols-2 gap-3">
                         {photos.length === 0 && !isEditing && <div className="col-span-2 text-center py-6 text-sm text-gray-500 bg-white/5 rounded-lg border border-white/5 border-dashed">Nenhuma foto disponível.</div>}
                         {photos.map((url, i) => (
                             <div key={i} className="relative aspect-video bg-black/40 rounded-lg overflow-hidden group border border-white/10 hover:border-blue-500/50 transition-colors shadow-sm">
                                 <img src={url} alt={`Foto ${i}`} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                 {isEditing && (
                                     <button 
                                        className="absolute top-1 right-1 bg-red-500/90 hover:bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                                        onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}
                                    >
                                         <X size={12} />
                                     </button>
                                 )}
                             </div>
                         ))}
                     </div>
                </div>

                {/* DOCUMENTS */}
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                         <label className="text-xs font-bold text-blue-300/80 uppercase flex items-center gap-2">
                            <FileText size={14} className="text-blue-500" /> Documentos & Links
                        </label>
                         {isEditing && <Button size="sm" variant="ghost" className="h-6 text-[10px] text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 uppercase tracking-wider font-bold" onClick={handleAddDocument}>+ Adicionar Link</Button>}
                    </div>

                    <div className="space-y-2">
                        {documents.length === 0 && !isEditing && <div className="text-center py-4 text-sm text-gray-500 bg-white/5 rounded-lg border border-white/5 border-dashed">Nenhum documento.</div>}
                        {documents.map((doc, i) => (
                            <div key={i} className="flex items-center justify-between text-sm bg-white/5 hover:bg-white/10 p-3 rounded-lg border border-white/10 transition-colors group">
                                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:text-blue-200 flex items-center gap-3 truncate font-medium">
                                    <div className="p-1.5 bg-blue-500/20 rounded text-blue-400"><LinkIcon size={12} /></div> {doc.name}
                                </a>
                                {isEditing && (
                                     <button onClick={() => setDocuments(documents.filter((_, idx) => idx !== i))} className="text-gray-500 hover:text-red-400 p-1 hover:bg-red-400/10 rounded transition-colors">
                                         <Trash2 size={14} />
                                     </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>


                <div className="space-y-3">
                    <label className="text-xs font-bold text-blue-300/80 uppercase flex items-center gap-2">
                        <Info size={14} className="text-blue-500" /> Notas Internas
                    </label>
                     {isEditing ? (
                        <textarea 
                            className="w-full min-h-[120px] text-sm p-4 bg-black/50 border border-white/20 rounded-xl text-gray-100 placeholder:text-gray-500 focus:border-blue-500/50 focus:bg-black/70 outline-none resize-none transition-colors"
                            value={notes} 
                            onChange={e => setNotes(e.target.value)} 
                            placeholder="Digite suas observações aqui..."
                        />
                    ) : (
                        <div className="text-sm text-gray-300/90 whitespace-pre-wrap leading-relaxed p-4 bg-white/5 rounded-xl border border-white/5 font-light">
                            {notes || <span className="text-gray-500 italic">Nenhuma anotação registrada para este lote.</span>}
                        </div>
                    )}
                </div>
                
                 {isEditing && (
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                        <div className="space-y-1.5">
                             <label className="text-[10px] uppercase font-bold text-gray-500">Preço (R$)</label>
                             <Input type="number" value={price} onChange={e => setPrice(e.target.value)} className="bg-white/5 border-white/10 text-white" />
                        </div>
                        <div className="space-y-1.5">
                             <label className="text-[10px] uppercase font-bold text-gray-500">Área (m²)</label>
                             <Input type="number" value={area} onChange={e => setArea(e.target.value)} className="bg-white/5 border-white/10 text-white" />
                        </div>
                    </div>
                )}

            </div>
        </SidebarContent>
      </Sidebar>
    );
  }

  // --- GENERAL MAP INFO (No lot selected) ---
  const uniqueQuadras = new Set(manualLots.map(l => l.quadra)).size;
  const totalLotesCount = manualLots.length;

  const stats = {
      totalQuadras: uniqueQuadras > 0 ? uniqueQuadras : "-", 
      totalLotes: totalLotesCount > 0 ? totalLotesCount : "-"
  };
  const notesCount = Array.from(lotsData.values()).filter(l => l.notes.length > 0).length;

  return (
    <Sidebar className="border-r border-white/20 bg-zinc-950/95 backdrop-blur-xl text-white">
      <SidebarHeader className="border-b border-white/10 px-6 py-8 relative overflow-hidden shrink-0">
         <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 to-transparent" />
        <h1 className="text-3xl font-black tracking-tight text-white mb-1 drop-shadow-lg">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">ACAPULCO</span> MAP
        </h1>
        <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-[10px] text-blue-200/60 font-mono tracking-[0.2em] uppercase">Sistema Inteligente v2.0</p>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* GLOBAL SEARCH */}
        <SidebarGroup>
            <div className="px-4 pb-2">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <Input 
                        placeholder="Buscar Lote (Ex: Q15 L10)..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-9 bg-black/50 border-white/20 text-white placeholder:text-gray-400 focus:bg-white/5 transition-all font-medium"
                    />
                </div>
                
                {/* SEARCH RESULTS */}
                {searchTerm && (
                    <div className="mt-2 bg-black/40 border border-white/10 rounded-xl overflow-hidden backdrop-blur-md shadow-2xl animate-in slide-in-from-top-2">
                        <div className="px-3 py-2 bg-white/5 border-b border-white/10 text-[10px] font-bold text-gray-300 uppercase tracking-wider flex justify-between">
                            <span>Resultados</span>
                            <span>{searchResults.length} encontrados</span>
                        </div>
                        <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                            {searchResults.length === 0 ? (
                                <div className="p-4 text-center text-sm text-gray-500 italic">
                                    Nenhum lote encontrado.
                                </div>
                            ) : (
                                <div className="divide-y divide-white/5">
                                    {searchResults.map(lot => (
                                        <button
                                            key={lot.id}
                                            onClick={() => {
                                                onSelectLot(lot);
                                                setSearchTerm(""); // Clear search on select
                                            }}
                                            className="w-full text-left px-4 py-3 hover:bg-blue-600/20 hover:text-white text-gray-300 transition-colors flex items-center justify-between group"
                                        >
                                            <div>
                                                <span className="font-bold text-blue-400">Lote {lot.lote}</span>
                                                <span className="text-gray-500 text-xs ml-2">Quadra {lot.quadra}</span>
                                            </div>
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                <ArrowRightCircle size={14} className="text-blue-400" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Visão Geral</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="grid grid-cols-2 gap-3 p-1">
                <div className="bg-white/5 p-5 rounded-2xl border border-white/10 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group backdrop-blur-sm cursor-default">
                    <div className="text-4xl font-black text-blue-400 group-hover:scale-110 transition-transform origin-left tracking-tighter shadow-blue-900/50 drop-shadow-lg">{stats.totalQuadras}</div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-2 group-hover:text-blue-200 transition-colors">Quadras</div>
                </div>
                 <div className="bg-white/5 p-5 rounded-2xl border border-white/10 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all group backdrop-blur-sm cursor-default">
                    <div className="text-4xl font-black text-cyan-400 group-hover:scale-110 transition-transform origin-left tracking-tighter shadow-cyan-900/50 drop-shadow-lg">{stats.totalLotes}</div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-2 group-hover:text-cyan-200 transition-colors">Lotes</div>
                </div>
            </div>
            <div className="px-1 mt-3">
                <div className="bg-gradient-to-r from-yellow-500/10 to-amber-500/5 p-5 rounded-2xl border border-yellow-500/20 flex items-center justify-between hover:border-yellow-500/40 transition-colors cursor-default">
                     <span className="text-[10px] text-yellow-500/90 font-bold uppercase tracking-widest">Lotes com<br/>Anotações</span>
                     <span className="text-3xl font-black text-yellow-400 tracking-tighter">{notesCount}</span>
                </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Camadas</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive>
                  <MapIcon />
                  <span>Mapa Base</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <Layers />
                  <span>Satélite (Em breve)</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

         <SidebarGroup>
          <SidebarGroupLabel>Legenda</SidebarGroupLabel>
          <SidebarGroupContent className="px-2 space-y-3">
             <div className="flex items-center gap-3 text-sm text-gray-300">
                <div className="w-5 h-5 rounded-md bg-white border border-gray-300 shadow-sm"></div> <span className="font-medium">Lote Disponível</span>
             </div>
             <div className="flex items-center gap-3 text-sm text-gray-300">
                <div className="w-5 h-5 rounded-md bg-emerald-500/20 border border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]"></div> <span className="font-medium">Área Especial</span>
             </div>
             <div className="flex items-center gap-3 text-sm text-gray-300">
                <div className="w-5 h-5 rounded-md bg-yellow-500/20 border border-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.3)]"></div> <span className="font-medium">Com Anotação</span>
             </div>
             <div className="flex items-center gap-3 text-sm text-gray-300">
                <div className="w-5 h-5 rounded-md bg-blue-500 border border-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.5)]"></div> <span className="font-medium">Selecionado</span>
             </div>
          </SidebarGroupContent>

        </SidebarGroup>

        <SidebarSeparator />

        <SidebarSeparator className="bg-white/10" />

        <div className="p-4 space-y-3 mt-auto">
            <Button 
              variant="outline" 
              className="w-full justify-start text-xs border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all h-9"
              onClick={handleChangePassword}
            >
              <div className="p-1 bg-white/10 rounded mr-2"><User size={12} /></div>
              Trocar Senha
            </Button>
            <Button 
              variant="destructive" 
              className="w-full justify-start text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:text-red-300 h-9 transition-all"
              onClick={handleLogout}
            >
              <div className="p-1 bg-red-500/20 rounded mr-2"><div className="w-2 h-2 rounded-full bg-red-500 box-shadow-glow" /></div>
              Sair do Sistema
            </Button>
            
             <div className="text-[10px] text-center text-gray-600 mt-4 font-mono">
                v2.0.1 • SECURE MODE
             </div>
        </div>

      </SidebarContent>
    </Sidebar>
  );
}
