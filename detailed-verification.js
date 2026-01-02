import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = "https://tvsbgbroyauxyliybsvo.supabase.co";
const supabaseKey = "sb_publishable_wCA2Jp5NYsa642jfygTITA_-fedhR-s";

const supabase = createClient(supabaseUrl, supabaseKey);

async function detailedVerification() {
    try {
        console.log('🔍 Análise Detalhada de Sincronização\n');
        console.log('═'.repeat(70));
        
        // Get all lots from Supabase
        const { data: allLots, error } = await supabase
            .from('lots')
            .select('id, quadra, lote, created_at, coordinates')
            .order('quadra', { ascending: true })
            .order('lote', { ascending: true });
        
        if (error) {
            console.error('❌ Erro:', error.message);
            return;
        }
        
        console.log(`\n📊 Total de lotes no Supabase: ${allLots.length}`);
        
        // Group by quadra
        const byQuadra = {};
        allLots.forEach(lot => {
            if (!byQuadra[lot.quadra]) {
                byQuadra[lot.quadra] = [];
            }
            byQuadra[lot.quadra].push(lot);
        });
        
        const quadras = Object.keys(byQuadra).sort((a, b) => {
            const aNum = parseInt(a);
            const bNum = parseInt(b);
            if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
            return a.localeCompare(b);
        });
        
        console.log(`\n🔢 Quadras encontradas: ${quadras.length}`);
        console.log('─'.repeat(70));
        console.log('Quadra | Lotes | Últimos Lotes');
        console.log('─'.repeat(70));
        
        quadras.forEach(quadra => {
            const lots = byQuadra[quadra];
            const lastLots = lots.slice(-3).map(l => l.lote).join(', ');
            console.log(`${quadra.padEnd(7)} | ${String(lots.length).padEnd(5)} | ${lastLots}`);
        });
        
        console.log('─'.repeat(70));
        
        // Check for lots without coordinates
        const noCoords = allLots.filter(lot => !lot.coordinates || (Array.isArray(lot.coordinates) && lot.coordinates.length === 0));
        if (noCoords.length > 0) {
            console.log(`\n⚠️  Lotes sem coordenadas: ${noCoords.length}`);
            noCoords.slice(0, 5).forEach(lot => {
                console.log(`   • Quadra ${lot.quadra} - Lote ${lot.lote}`);
            });
        } else {
            console.log('\n✅ Todos os lotes têm coordenadas');
        }
        
        // Save detailed report to file
        const report = {
            timestamp: new Date().toISOString(),
            totalLots: allLots.length,
            totalQuadras: quadras.length,
            byQuadra: Object.fromEntries(
                Object.entries(byQuadra).map(([q, lots]) => [q, lots.length])
            ),
            lotsWithoutCoordinates: noCoords.length,
            allLotIds: allLots.map(l => l.id)
        };
        
        fs.writeFileSync('supabase-sync-report.json', JSON.stringify(report, null, 2));
        console.log('\n📄 Relatório detalhado salvo em: supabase-sync-report.json');
        
        console.log('\n═'.repeat(70));
        console.log('\n💡 Como verificar no navegador:');
        console.log('');
        console.log('   1. Abra o aplicativo (npm run dev)');
        console.log('   2. Pressione F12 para abrir DevTools');
        console.log('   3. No Console, execute:');
        console.log('');
        console.log('      const lots = JSON.parse(localStorage.getItem("lots") || "[]")');
        console.log('      console.log(`Total localStorage: ${lots.length}`)');
        console.log('');
        console.log('      // Agrupar por quadra');
        console.log('      const byQ = {}');
        console.log('      lots.forEach(l => {');
        console.log('        if (!byQ[l.quadra]) byQ[l.quadra] = 0');
        console.log('        byQ[l.quadra]++');
        console.log('      })');
        console.log('      console.table(byQ)');
        console.log('');
        console.log(`   4. Compare com: ${allLots.length} lotes no Supabase`);
        console.log('\n═'.repeat(70));
        
        console.log('\n✅ Se os números forem iguais, a sincronização está completa!');
        console.log('❌ Se forem diferentes, use CTRL+M no app para re-sincronizar.');
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

detailedVerification();
