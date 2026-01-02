
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// DATA TO IMPORT
const DATA = [
    {
        "nome_lote": "Quadra 1 Lote 09 A",
        "inscricao": "30764013000",
        "cpf_cnpj": "06580050810",
        "nome_proprietario": "ESPÓLIO DE CELSO SANTOS FILHO",
        "metragem": "1.652,50",
        "descricao_imovel": "Q.01 LOTE 09-A",
        "valor_venal": "560.627,15",
        "valor_venal_edificado": "0,00",
        "status_processamento": "sucesso"
    },
    {
        "nome_lote": "Quadra 1 Lote 09 B",
        "inscricao": "30764014000",
        "cpf_cnpj": "15310197818",
        "nome_proprietario": "MARCELO CAMPILONGO",
        "metragem": "1.000,00",
        "descricao_imovel": "09-B",
        "valor_venal": "223.630,00",
        "valor_venal_edificado": "764.582,32",
        "status_processamento": "sucesso"
    },
    {
        "nome_lote": "Quadra 1 Lote 1 A",
        "inscricao": "30764001000",
        "cpf_cnpj": "06580050810",
        "nome_proprietario": "ESPÓLIO DE CELSO SANTOS FILHO",
        "metragem": "1.044,25",
        "descricao_imovel": "Q.1 LOTE 1A",
        "valor_venal": "676.475,59",
        "valor_venal_edificado": "0,00",
        "status_processamento": "sucesso"
    }
];

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://tvsbgbroyauxyliybsvo.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing Supabase credentials. Ensure .env is loaded or vars are set.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// --- HELPERS ---

function parseMoney(valueStr) {
    if (!valueStr) return 0;
    // Remove dots ("."), replace comma (",") with dot (".")
    // "1.652,50" -> "1652.50"
    const clean = valueStr.replace(/\./g, "").replace(",", ".");
    return parseFloat(clean) || 0;
}

function parseQuadraLote(nomeStr) {
    // Example: "Quadra 1 Lote 09 A"
    const normalized = nomeStr.toLowerCase().replace(/\./g, ""); // "quadra 1 lote 09 a"
    
    // Regex for "Quadra X Lote Y"
    const match = normalized.match(/quadra\s+(\d+)\s+lote\s+(.+)/);
    
    if (match) {
        return {
            quadra: match[1], // "1"
            lote: match[2].toUpperCase().trim() // "09 A"
        };
    }
    
    // Fallback?
    return null;
}

function drawProgressBar(current, total) {
    const width = 30;
    const percentage = Math.round((current / total) * 100);
    const filled = Math.round((width * current) / total);
    const empty = width - filled;
    const bar = '█'.repeat(filled) + '-'.repeat(empty);
    // Use \r to overwrite the line
    process.stdout.write(`\rProgress: [${bar}] ${percentage}% (${current}/${total})`);
}

// --- MAIN ---

async function runImport() {
    console.log(`🚀 Starting import of ${DATA.length} records...`);
    
    let processed = 0;
    let skipped = 0;
    let errors = 0;

    // Initial draw
    drawProgressBar(0, DATA.length);

    for (let i = 0; i < DATA.length; i++) {
        const item = DATA[i];

        // 1. Parse keys
        const identifiers = parseQuadraLote(item.nome_lote);
        if (!identifiers) {
            process.stdout.write('\n'); // clear line for error
            console.error(`⚠️ Skipping invalid name format: "${item.nome_lote}"`);
            errors++;
            drawProgressBar(i + 1, DATA.length);
            continue;
        }

        const { quadra, lote } = identifiers;

        // 2. Parse values
        const area = parseMoney(item.metragem);
        const vVenal = parseMoney(item.valor_venal);
        const vEdif = parseMoney(item.valor_venal_edificado);
        const price = Math.max(vVenal, vEdif); // Rule: Use the higher value

        const owner = item.nome_proprietario;
        const notes = item.descricao_imovel;

        // Strategy: Try to find the lot with varied IDs to match existing format
        const candidates = [
            `${parseInt(quadra)}-${parseInt(lote)}`, // "1-9" (if lote is number)
            `${parseInt(quadra)}-${lote}`,           // "1-09 A"
            `${quadra}-${lote}`,                      // "01-09 A"
            `${parseInt(quadra)}-${lote.replace(/^0+/, '')}`, // "1-9 A"
            `${parseInt(quadra)}-${lote.replace(/\s+/g, '')}`, // "1-09A" (No Space)
            `${parseInt(quadra)}-${lote.replace(/^0+/, '').replace(/\s+/g, '')}`, // "1-9A" (No Space - likely)
            `${quadra}-${lote.replace(/\s+/g, '')}`   // "01-09A"
        ];
        
        // Remove duplicates and invalid
        const validCandidates = [...new Set(candidates)];
        
        // Query to find which ID exists AND fetch current data
        const { data: foundLots } = await supabase
            .from('lots')
            .select('id, area, price, owner, notes')
            .in('id', validCandidates);
            
        let matchingLot = null;
        if (foundLots && foundLots.length > 0) {
            matchingLot = foundLots[0];
        }

        if (matchingLot) {
            const currentArea = matchingLot.area || 0;
            const currentPrice = matchingLot.price || 0;
            const currentOwner = matchingLot.owner || '';
            const currentNotes = matchingLot.notes || '';

            // Check if update is needed
            const needsUpdate = 
                currentArea !== area || 
                currentPrice !== price || 
                currentOwner !== owner || 
                currentNotes !== notes;

            if (needsUpdate) {
                const payload = {
                    area,
                    price,
                    owner,
                    notes,
                    updated_at: new Date().toISOString()
                };

                const { error } = await supabase.from('lots').update(payload).eq('id', matchingLot.id);
                
                if (error) {
                    process.stdout.write('\n');
                    console.error(`❌ Failed to update ${matchingLot.id}:`, error.message);
                    errors++;
                } else {
                    processed++;
                }
            } else {
                skipped++;
            }
        } else {
            // Optional: log missing lots or count as errors
            errors++;
        }
        
        drawProgressBar(i + 1, DATA.length);
    }

    process.stdout.write('\n');
    console.log(`\n✅ Import finished.`);
    console.log(`   Updated: ${processed}`);
    console.log(`   Skipped (No Changes): ${skipped}`);
    console.log(`   Errors/Not Found: ${errors}`);
}

runImport();
