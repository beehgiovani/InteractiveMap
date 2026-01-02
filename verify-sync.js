import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://tvsbgbroyauxyliybsvo.supabase.co";
const supabaseKey = "sb_publishable_wCA2Jp5NYsa642jfygTITA_-fedhR-s";

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyDataSync() {
    try {
        console.log('🔍 Verificando sincronização de dados...\n');
        console.log('═'.repeat(60));
        
        // Count total records in Supabase
        const { count: supabaseCount, error } = await supabase
            .from('lots')
            .select('*', { count: 'exact', head: true });
        
        if (error) {
            console.error('❌ Erro ao consultar Supabase:', error.message);
            return;
        }
        
        console.log(`📊 Total de lotes no Supabase: ${supabaseCount}`);
        
        // Get sample data to show what's there
        const { data: sampleData, error: sampleError } = await supabase
            .from('lots')
            .select('id, quadra, lote')
            .order('quadra', { ascending: true })
            .order('lote', { ascending: true })
            .limit(10);
        
        if (!sampleError && sampleData) {
            console.log('\n📋 Primeiros 10 lotes no Supabase:');
            console.log('─'.repeat(60));
            sampleData.forEach(lot => {
                console.log(`  • Quadra ${lot.quadra} - Lote ${lot.lote} (ID: ${lot.id})`);
            });
            console.log('─'.repeat(60));
        }
        
        // Count unique quadras
        const { data: quadras, error: quadrasError } = await supabase
            .from('lots')
            .select('quadra');
        
        if (!quadrasError && quadras) {
            const uniqueQuadras = new Set(quadras.map(q => q.quadra));
            console.log(`\n🔢 Total de quadras únicas: ${uniqueQuadras.size}`);
            console.log(`📝 Quadras: ${Array.from(uniqueQuadras).sort().join(', ')}`);
        }
        
        console.log('\n═'.repeat(60));
        console.log('\n💡 Para verificar os dados do localStorage:');
        console.log('   1. Abra o aplicativo no navegador');
        console.log('   2. Abra DevTools (F12)');
        console.log('   3. Vá para Console');
        console.log('   4. Execute: ');
        console.log('      JSON.parse(localStorage.getItem("lots")).length');
        console.log('      JSON.parse(localStorage.getItem("lotsData")).size');
        console.log('\n📤 Para sincronizar todos os dados:');
        console.log('   1. Abra o aplicativo');
        console.log('   2. Pressione CTRL+M para abrir a ferramenta de migração');
        console.log('   3. Clique em "Iniciar Migração"');
        
        console.log('\n═'.repeat(60));
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

verifyDataSync();
