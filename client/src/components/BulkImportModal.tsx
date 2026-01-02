import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Lot, LotInfo } from '@/types';
import { X, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Save } from 'lucide-react';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newLotsData: Map<string, LotInfo>, newLotsList?: Lot[]) => void;
  currentLotsData: Map<string, LotInfo>;
  manualLots: Lot[];
}

interface ImportRow {
  quadra: string;
  lote: string;
  area: string;
  valor: string;
  proprietario: string;
  status?: string;
  _rowNum: number;
  _status: 'valid' | 'invalid' | 'warning';
  _message?: string;
  originalData?: any; // Store full JSON object for geometry restoration
}

export default function BulkImportModal({ isOpen, onClose, onSave, currentLotsData, manualLots }: BulkImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<ImportRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        if (typeof bstr !== 'string') {
            throw new Error("Falha ao ler o arquivo (formato incorreto).");
        }

        let processed = false;
        
        // 1. Attempt JSON Parsing Strategy
        // We try this if extension is .json OR if content looks like JSON
        const trimmed = bstr.trim();
        const looksLikeJson = trimmed.startsWith('{') || trimmed.startsWith('[');
        const isJsonExt = uploadedFile.name.toLowerCase().endsWith('.json');

        if (isJsonExt || looksLikeJson) {
            try {
                const json = JSON.parse(bstr);
                let data = Array.isArray(json) ? json : (json.data || json.lots || []);
                
                // Smart Fallback: If standard keys failed, search for ANY array in the object
                if ((!Array.isArray(data) || data.length === 0) && !Array.isArray(json)) {
                    console.log("Standard keys (data, lots) not found. Searching for any array...");
                    const keys = Object.keys(json);
                    for (const key of keys) {
                        if (Array.isArray(json[key]) && json[key].length > 0) {
                            console.log(`Found array in key: ${key}`);
                            data = json[key];
                            break;
                        }
                    }
                }
                
                if (Array.isArray(data) && data.length > 0) {
                     console.log("JSON successfully parsed.");
                     processJsonData(data);
                     processed = true;
                } else if (isJsonExt) {
                    // Explicit JSON file but empty or invalid structure
                    console.error("JSON Structure Keys:", Object.keys(json));
                    throw new Error(`JSON válido porém sem dados. Chaves encontradas: ${Object.keys(json).join(", ")}`);
                }
            } catch (e) {
                console.warn("JSON parse attempt failed:", e);
                if (isJsonExt) {
                    // If it claimed to be JSON, this is a hard error
                    alert("Erro ao processar JSON: " + (e instanceof Error ? e.message : String(e)));
                    setIsProcessing(false);
                    return; 
                }
                // If not explicitly JSON, we continue to try Excel
            }
        }

        if (processed) {
            setIsProcessing(false);
            return;
        }

        // 2. Attempt Excel/CSV Strategy
        let data: any[] = [];
        try {
            const wb = XLSX.read(bstr, { type: 'binary' });
            if (wb.SheetNames.length > 0) {
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                data = XLSX.utils.sheet_to_json(ws, { header: 1 });
            }
        } catch (e) {
            console.warn("Excel parse attempt failed:", e);
        }

        // 3. Final Validation
        if (!data || data.length < 2) {
             alert("Não foi possível ler dados do arquivo. Verifique se é um Excel/CSV válido ou Backup JSON.");
             setIsProcessing(false);
             return;
        }

        // 4. Header Processing
        if (!data[0] || !Array.isArray(data[0])) {
             console.error("Invalid Excel Header Format:", data[0]);
             alert("Estrutura do arquivo Excel inválida (cabeçalho não encontrado).");
             setIsProcessing(false);
             return;
        }

        const headers = (data[0] as any[]).map(h => String(h || "").toLowerCase().trim());
        processArrayData(data, headers);

      } catch (err) {
          console.error("Import Error:", err);
          alert("Erro crítico ao processar arquivo: " + (err instanceof Error ? err.message : "Erro desconhecido"));
      } finally {
          setIsProcessing(false);
      }
    };
    
    // Read strategy: Text is safer for JSON, BinaryString for Excel.
    // However, readAsBinaryString is deprecated in some contexts but XLSX lib likes it.
    // Text can be parsed by XLSX too usually.
    // Let's stick to simple switch based on extension, but if "All Files" logic is used, inconsistent.
    // Safe bet: Text is best for JSON.
    if (uploadedFile.name.toLowerCase().endsWith('.json')) {
        reader.readAsText(uploadedFile);
    } else {
        reader.readAsBinaryString(uploadedFile);
    }
  };

  const processJsonData = (data: any[]) => {
      const rows: ImportRow[] = [];
      data.forEach((item, i) => {
          // Flexible key matching (support top level or inside 'info')
          // Priority: Top Level > Info Object
          const info = item.info || {};
          
          const quadraRaw = getItemValue(item, ['quadra', 'Quadra', 'q']) || getItemValue(info, ['quadra', 'Quadra', 'q']);
          const loteRaw = getItemValue(item, ['lote', 'Lote', 'l']) || getItemValue(info, ['lote', 'Lote', 'l']);
          
          if (!quadraRaw && !loteRaw) return;

          let quadra = String(quadraRaw).trim();
          // Normalize Quadra
          if (!quadra.toLowerCase().startsWith('quadra') && /^\d+$/.test(quadra)) {
                quadra = `Quadra ${quadra}`;
          }

          const lote = String(loteRaw).trim();

          // Validation
          const exists = manualLots.some(l => 
                l.quadra.toLowerCase() === quadra.toLowerCase() && 
                l.lote.replace(/\D/g, '') === lote.replace(/\D/g, '')
          );
          
          const status = exists ? 'valid' : 'warning';
          const message = exists ? '' : 'Lote não encontrado no mapa.';

          // Extract other fields, checking both levels
          const area = getItemValue(item, ['area', 'Area', 'área', 'Área']) || getItemValue(info, ['area', 'Area', 'área', 'Área']) || '';
          const valor = getItemValue(item, ['valor', 'Valor', 'preco', 'price']) || getItemValue(info, ['valor', 'Valor', 'preco', 'price']) || '';
          const proprietario = getItemValue(item, ['proprietario', 'Proprietario', 'owner', 'dono']) || getItemValue(info, ['proprietario', 'Proprietario', 'owner', 'dono']) || '';

          rows.push({
               quadra,
               lote,
               area: String(area),
               valor: String(valor),
               proprietario: String(proprietario),
               _rowNum: i + 1,
               _status: status,
               _message: message,
               originalData: item // Preserve original for geometry
          });
      });
      setPreviewData(rows);
  };

  const getItemValue = (obj: any, keys: string[]) => {
      if (!obj) return undefined;
      for (const k of keys) {
          if (obj[k] !== undefined && obj[k] !== null) return obj[k];
      }
      return undefined;
  };

  const processArrayData = (data: any[], headers: string[]) => {
        // Find indices
        const idxQuadra = headers.findIndex(h => h.includes('quadra'));
        const idxLote = headers.findIndex(h => h.includes('lote'));
        const idxArea = headers.findIndex(h => h.includes('area') || h.includes('área'));
        const idxValor = headers.findIndex(h => h.includes('valor') || h.includes('preço'));
        const idxProp = headers.findIndex(h => h.includes('prop') || h.includes('dono'));
        
        if (idxQuadra === -1 || idxLote === -1) {
            alert("Não foi possível encontrar as colunas obrigatórias 'Quadra' e 'Lote'. Verifique o cabeçalho.");
            return;
        }

        const rows: ImportRow[] = [];
        
        // Process Rows
        for (let i = 1; i < data.length; i++) {
            const row = data[i] as any[];
            if (!row || row.length === 0) continue;

            const quadraRaw = row[idxQuadra] ? String(row[idxQuadra]).trim() : '';
            const loteRaw = row[idxLote] ? String(row[idxLote]).trim() : '';
            
            // Skip empty rows
            if (!quadraRaw && !loteRaw) continue;

            // Clean Quadra Name (Ensure "Quadra " prefix if number)
            let quadra = quadraRaw;
            if (!quadra.toLowerCase().startsWith('quadra')) {
                // If it's just a number, prefix it
                quadra = `Quadra ${quadra}`;
            }

            // Validation
            let status: 'valid' | 'invalid' | 'warning' = 'valid';
            let message = '';
            
            // Try to match with manualLots
            const exists = manualLots.some(l => 
                l.quadra.toLowerCase() === quadra.toLowerCase() && 
                l.lote.replace(/\D/g, '') === loteRaw.replace(/\D/g, '')
            );

            if (!exists) {
                status = 'warning';
                message = 'Lote não encontrado no mapa (será apenas dado, sem desenho)';
            }

            rows.push({
                quadra: quadra,
                lote: loteRaw,
                area: idxArea > -1 ? String(row[idxArea] || '') : '',
                valor: idxValor > -1 ? String(row[idxValor] || '') : '',
                proprietario: idxProp > -1 ? String(row[idxProp] || '') : '',
                _rowNum: i + 1,
                _status: status,
                _message: message
            });
        }
        setPreviewData(rows);
  };
    
    /* REMOVED PREVIOUS LOGIC TO AVOID DUPLICATION */

  const handleApply = () => {
      const newMap = new Map(currentLotsData);
      const newLotsList: Lot[] = []; // List for full geometry updates
      let updatedCount = 0;

      previewData.forEach(row => {
          // 1. Geometry Restoration Check
          if (row.originalData && row.originalData.coordinates && Array.isArray(row.originalData.coordinates)) {
              // It's a full backup lot!
              const raw = row.originalData;
              
              // Validate Coordinates
              if (raw.coordinates.length >= 3) {
                  const restoredLot: Lot = {
                      id: raw.id || `${row.quadra}-${row.lote}`, // Ensure ID
                      quadra: String(row.quadra).trim(),
                      lote: String(row.lote).trim(),
                      coordinates: raw.coordinates, // Restore Shape
                      center: raw.center || [0,0],
                      info: {
                          ...raw.info,
                          // Ensure critical info matches what we parsed (or use raw if better?)
                          // Logic: Backup restore means "Make it like the file".
                          id: raw.id || raw.info?.id || `${row.quadra}-${row.lote}`,
                          quadra: row.quadra,
                          lote: row.lote,
                          owner: row.proprietario || raw.info?.owner || "",
                          price: row.valor ? parseFloat(row.valor.replace(/[^0-9.,]/g, '').replace(',', '.')) : raw.info?.price,
                          area: row.area ? parseFloat(row.area.replace(/[^0-9.,]/g, '').replace(',', '.')) : raw.info?.area
                      }
                  };
                  newLotsList.push(restoredLot);
              }
          }

          // 2. Data Update (Existing Logic - Fallback or Data Only)
          // Construct ID. Assume the system uses the ID found in manualLots if possible.
          // We need to find the MATCHING lot ID from manualLots to update the map correctly.
          const targetLot = manualLots.find(l => 
             l.quadra.toLowerCase() === row.quadra.toLowerCase() && 
             l.lote.replace(/\D/g, '') === row.lote.replace(/\D/g, '') // Loose match on numbers
          );

          if (targetLot) {
              const currentInfo = newMap.get(targetLot.id) || targetLot.info || {};
              newMap.set(targetLot.id, {
                  ...currentInfo,
                  id: targetLot.id,
                  area: row.area ? parseFloat(row.area.replace(/[^0-9.,]/g, '').replace(',', '.')) : currentInfo.area,
                  price: row.valor ? parseFloat(row.valor.replace(/[^0-9.,]/g, '').replace(',', '.')) : currentInfo.price,
                  owner: row.proprietario || currentInfo.owner,

              });
              updatedCount++;
          }
      });

      onSave(newMap, newLotsList); // Pass the list of FULL lots
      alert(`${updatedCount} lotes atualizados e ${newLotsList.length} geometrias restauradas!`);
      onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
      <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
            <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                <FileSpreadsheet className="text-green-500"/> Importar Dados em Massa
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white">
                <X size={20} />
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
            
            {previewData.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 text-center text-gray-400 border-2 border-dashed border-white/10 m-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <Upload size={48} className="mb-4 text-blue-500/50" />
                    <h3 className="text-lg font-bold text-white mb-2">Clique para carregar arquivo</h3>
                    <p className="text-sm max-w-md mx-auto mb-4 text-gray-400">
                        Suporta .xlsx, .csv, .xml ou <strong>.json (Backup)</strong>. <br/>
                        Para Excel: Quadra, Lote, Área, Valor, Proprietário
                    </p>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept=".xlsx, .xls, .csv, .xml, .json" 
                        onChange={handleFileUpload} 
                    />
                    <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-blue-900/20 hover:bg-blue-500 transition-colors">
                        Selecionar Arquivo
                    </button>
                </div>
            ) : (
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-3 bg-blue-500/10 text-blue-200 text-sm border-b border-white/10 px-4 flex justify-between items-center backdrop-blur-sm">
                        <span><strong>{previewData.length}</strong> linhas encontradas. Verifique os dados abaixo.</span>
                        <button onClick={() => setPreviewData([])} className="text-red-400 hover:text-red-300 hover:underline text-xs">Limpar / Reenviar</button>
                    </div>
                    
                    <div className="flex-1 overflow-auto custom-scrollbar">
                        <table className="w-full text-sm text-left border-collapse min-w-[600px]">
                            <thead className="bg-black/40 sticky top-0 z-10 shadow-sm text-gray-400 font-bold backdrop-blur-sm">
                                <tr>
                                    <th className="p-3 border-b border-white/10 pl-4">Linha</th>
                                    <th className="p-3 border-b border-white/10">Status</th>
                                    <th className="p-3 border-b border-white/10">Quadra</th>
                                    <th className="p-3 border-b border-white/10">Lote</th>
                                    <th className="p-3 border-b border-white/10">Área</th>
                                    <th className="p-3 border-b border-white/10">Valor</th>
                                    <th className="p-3 border-b border-white/10">Proprietário</th>
                                </tr>
                            </thead>
                            <tbody>
                                {previewData.map((row, i) => (
                                    <tr key={i} className={`border-b border-white/5 hover:bg-white/5 transition-colors ${row._status === 'warning' ? 'bg-yellow-500/10' : ''}`}>
                                        <td className="p-3 pl-4 text-gray-500 font-mono">{row._rowNum}</td>
                                        <td className="p-3">
                                            {row._status === 'valid' && <CheckCircle size={16} className="text-green-500" />}
                                            {row._status === 'warning' && <span title={row._message}><AlertCircle size={16} className="text-yellow-500" /></span>}
                                        </td>
                                        <td className="p-3 font-bold text-white">{row.quadra}</td>
                                        <td className="p-3 text-gray-300">{row.lote}</td>
                                        <td className="p-3 text-gray-300">{row.area}</td>
                                        <td className="p-3 text-gray-300">{row.valor}</td>
                                        <td className="p-3 text-gray-400 truncate max-w-[200px]">{row.proprietario}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end gap-3">
            <button 
                onClick={onClose}
                className="px-4 py-2 text-gray-400 font-bold hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
                Cancelar
            </button>
            <button 
                onClick={handleApply}
                disabled={previewData.length === 0 || isProcessing}
                className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg shadow-lg shadow-green-900/20 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
                <Save size={18} />
                Importar Dados
            </button>
        </div>

      </div>
    </div>
  );
}
