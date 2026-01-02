
import { supabase } from '../supabase';

// Helper to parse "1.234,56" -> 1234.56
const parseMoney = (valueStr: string | number): number => {
    if (typeof valueStr === 'number') return valueStr;
    if (!valueStr) return 0;
    const clean = valueStr.toString().replace(/\./g, "").replace(",", ".");
    return parseFloat(clean) || 0;
};

// Helper to parse "Quadra 1 Lote 09 A" -> { quadra: "1", lote: "09 A" }
const parseQuadraLote = (nomeStr: string) => {
    const normalized = nomeStr.toLowerCase().replace(/\./g, ""); 
    const match = normalized.match(/quadra\s+(\d+)\s+lote\s+(.+)/);
    
    if (match) {
        return {
            quadra: match[1], 
            lote: match[2].toUpperCase().trim() 
        };
    }
    return null;
};

export interface ImportResult {
    total: number;
    processed: number;
    skipped: number;
    errors: number;
    details: string[];
}

// Helper to parse "30764003000" -> { zona: "003", setor: "0764", loteGeo: "003" }
const parseInscricao = (inscricao: string) => {
    if (!inscricao || inscricao.length < 8) return null;
    
    // Clean string (remove dots/hyphens if any)
    const clean = inscricao.replace(/\D/g, '');
    
    // Format: Z SSSS LLL XXX
    // Index:  0 1234 567 890
    
    // Zona: Char 0
    const zonaChar = clean.substring(0, 1);
    const setorChars = clean.substring(1, 5); 
    const loteGeoChars = clean.substring(5, 8);
    
    // Formatting
    const setor = setorChars.padStart(4, '0');
    const loteGeo = loteGeoChars.padStart(3, '0');
    const zona = zonaChar; 
    
    return { zona, setor, loteGeo };
}

export const importLotData = async (
    jsonData: any[], 
    onProgress?: (current: number, total: number) => void
): Promise<ImportResult> => {
    const result: ImportResult = {
        total: jsonData.length,
        processed: 0,
        skipped: 0,
        errors: 0,
        details: []
    };

    const total = jsonData.length;

    for (let i = 0; i < total; i++) {
        const item = jsonData[i];
        
        // Report Progress
        if (onProgress) onProgress(i + 1, total);

        try {
            // 1. Parse Keys
            if (!item.nome_lote) {
                result.errors++;
                result.details.push(`Skipped: Missing 'nome_lote'`);
                continue;
            }

            const identifiers = parseQuadraLote(item.nome_lote);
            if (!identifiers) {
                result.errors++;
                result.details.push(`Skipped: Invalid format "${item.nome_lote}"`);
                continue;
            }

            const { quadra, lote } = identifiers;

            // Helper to generate ID candidates
            const candidates = [
                `${parseInt(quadra)}-${lote.replace(/\s+/g, '_')}`,         // "1-09_A" (Primary match)
                `${parseInt(quadra)}-${lote}`,                             // "1-09 A"
                `${parseInt(quadra)}-${lote.replace(/\s+/g, '')}`,          // "1-09A"
                `${parseInt(quadra)}-${parseInt(lote)}`,                   // "1-9"
                `${quadra}-${lote}`,                                       // "01-09 A"
                `${quadra}-${lote.replace(/\s+/g, '_')}`                   // "01-09_A"
            ];
            
            const validCandidates = [...new Set(candidates)];
            
            // 3. Find Match in DB
            // Strategy A: Try to match by Inscricao parts (Zona, Setor, LoteGeo)
            let matchingId: string | null = null;
            const inscricaoInfo = parseInscricao(item.inscricao);
            
            if (inscricaoInfo) {
                const zonas = [inscricaoInfo.zona, parseInt(inscricaoInfo.zona).toString()];
                const setors = [inscricaoInfo.setor, parseInt(inscricaoInfo.setor).toString()];
                const loteGeos = [inscricaoInfo.loteGeo, parseInt(inscricaoInfo.loteGeo).toString()];
                
                const uZonas = [...new Set(zonas)];
                const uSetors = [...new Set(setors)];
                const uLoteGeos = [...new Set(loteGeos)];

                const { data: inscricaoMatch } = await supabase
                    .from('lots')
                    .select('id')
                    .in('zona', uZonas)
                    .in('setor', uSetors)
                    .in('lote_geo', uLoteGeos)
                    .limit(1);
                    
                if (inscricaoMatch && inscricaoMatch.length > 0) {
                    matchingId = inscricaoMatch[0].id;
                }
            }

            // Strategy B: If no match by Inscricao, match by ID (derived from Name)
            if (!matchingId) {
                const { data: foundLots, error: searchError } = await supabase
                    .from('lots')
                    .select('id')
                    .in('id', validCandidates)
                    .limit(1);

                if (searchError) throw searchError;

                if (foundLots && foundLots.length > 0) {
                    matchingId = foundLots[0].id;
                }
            }

            if (!matchingId) {
                result.errors++;
                result.details.push(`Not Found: "${item.nome_lote}"`);
                continue;
            }

            // 4. Prepare Payload
            const area = parseMoney(item.metragem);
            const vVenal = parseMoney(item.valor_venal);
            const vEdif = parseMoney(item.valor_venal_edificado);
            const price = Math.max(vVenal, vEdif);
            
            // Prepare potential new data
            const newOwner = item.nome_proprietario || null;
            const newNotes = item.descricao_imovel || null;
            const newOwnerCpf = item.cpf_cnpj || null;
            
            // 5. Fetch Current Data to Compare
            const { data: currentLot, error: currentError } = await supabase
                .from('lots')
                .select('area, price, owner, notes, owner_cpf, zona, setor, lote_geo')
                .eq('id', matchingId)
                .single();

            if (currentError) throw currentError;

            // Check for changes
            // Note: DB returns null for empty fields often, JS might have undefined/null.
            // Be careful with Loose Equality or normalizing nulls.
            const curArea = currentLot.area || 0;
            const curPrice = currentLot.price || 0;
            const curOwner = currentLot.owner || '';
            const curNotes = currentLot.notes || '';
            const curCpf = currentLot.owner_cpf || '';
            const curZona = currentLot.zona || '';
            const curSetor = currentLot.setor || '';
            const curLoteGeo = currentLot.lote_geo || '';

            const newZona = inscricaoInfo ? inscricaoInfo.zona : curZona;
            const newSetor = inscricaoInfo ? inscricaoInfo.setor : curSetor;
            const newLoteGeo = inscricaoInfo ? inscricaoInfo.loteGeo : curLoteGeo;

            const hasChanged = 
                Math.abs(curArea - area) > 0.01 || 
                Math.abs(curPrice - price) > 0.01 ||
                curOwner.trim() !== (newOwner || '').trim() ||
                curNotes.trim() !== (newNotes || '').trim() ||
                curCpf.replace(/\D/g,'') !== (newOwnerCpf || '').replace(/\D/g,'') ||
                (inscricaoInfo && (curZona !== newZona || curSetor !== newSetor || curLoteGeo !== newLoteGeo));

            if (hasChanged) {
                const payload: any = {
                    area: area,
                    price: price,
                    owner: newOwner,
                    notes: newNotes,
                    updated_at: new Date().toISOString(),
                    owner_cpf: newOwnerCpf,
                };
                
                if (inscricaoInfo) {
                    payload.zona = newZona;
                    payload.setor = newSetor;
                    payload.lote_geo = newLoteGeo;
                }

                // Update
                const { error: updateError } = await supabase
                    .from('lots')
                    .update(payload)
                    .eq('id', matchingId);

                if (updateError) throw updateError;

                result.processed++;
                result.details.push(`Updated: ${matchingId}`);
            } else {
                result.skipped++;
            }

        } catch (e: any) {
            result.errors++;
            result.details.push(`Error "${item.nome_lote}": ${e.message}`);
        }
    }

    return result;
};
