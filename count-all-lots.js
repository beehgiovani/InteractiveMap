import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://tvsbgbroyauxyliybsvo.supabase.co";
const supabaseKey = "sb_publishable_wCA2Jp5NYsa642jfygTITA_-fedhR-s";

const supabase = createClient(supabaseUrl, supabaseKey);

async function getTotalCount() {
    try {
        console.log('🔍 Contando todos os lotes no Supabase...\n');
        
        // Get exact count without fetching data
        const { count, error } = await supabase
            .from('lots')
            .select('*', { count: 'exact', head: true });
        
        if (error) {
            console.error('❌ Erro:', error.message);
            return;
        }
        
        console.log(`📊 Total REAL de lotes no Supabase: ${count}`);
        
        // Now fetch ALL data using pagination
        let allLots = [];
        let page = 0;
        const pageSize = 1000;
        
        console.log('\n📥 Buscando todos os lotes (com paginação)...');
        
        while (true) {
            const { data, error: fetchError } = await supabase
                .from('lots')
                .select('id, quadra, lote')
                .range(page * pageSize, (page + 1) * pageSize - 1);
            
            if (fetchError) {
                console.error('Erro na página', page, ':', fetchError.message);
                break;
            }
            
            if (!data || data.length === 0) break;
            
            allLots = allLots.concat(data);
            console.log(`   Página ${page + 1}: ${data.length} lotes (Total: ${allLots.length})`);
            
            if (data.length < pageSize) break; // Last page
            page++;
        }
        
        console.log(`\n✅ Total de lotes recuperados: ${allLots.length}`);
        
        // Group by quadra
        const byQuadra = {};
        allLots.forEach(lot => {
            if (!byQuadra[lot.quadra]) {
                byQuadra[lot.quadra] = 0;
            }
            byQuadra[lot.quadra]++;
        });
        
        console.log(`\n🔢 Quadras únicas: ${Object.keys(byQuadra).length}`);
        console.log('\nDistribuição por quadra:');
        console.log('─'.repeat(40));
        
        Object.entries(byQuadra)
            .sort((a, b) => {
                const aNum = parseInt(a[0]);
                const bNum = parseInt(b[0]);
                if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
                return a[0].localeCompare(b[0]);
            })
            .forEach(([quadra, count]) => {
                console.log(`  Quadra ${quadra}: ${count} lotes`);
            });
        
        console.log('─'.repeat(40));
        console.log(`\n📈 RESUMO:`);
        console.log(`   • Total de lotes: ${count}`);
        console.log(`   • Lotes recuperados: ${allLots.length}`);
        console.log(`   • Quadras: ${Object.keys(byQuadra).length}`);
        
        if (count !== allLots.length) {
            console.log(`\n⚠️  AVISO: Há diferença entre count (${count}) e dados recuperados (${allLots.length})`);
        }
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

getTotalCount();
