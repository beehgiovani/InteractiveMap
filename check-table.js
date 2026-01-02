import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// Supabase credentials
const supabaseUrl = "https://tvsbgbroyauxyliybsvo.supabase.co";
const supabaseKey = "sb_publishable_wCA2Jp5NYsa642jfygTITA_-fedhR-s";

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTable() {
    try {
        console.log('🚀 Criando tabela "lots" no Supabase...\n');
        
        // Tentar inserir um registro de teste para verificar se a tabela existe
        console.log('📊 Verificando se a tabela já existe...');
        const { data: testData, error: testError } = await supabase
            .from('lots')
            .select('id')
            .limit(1);
        
        if (!testError) {
            console.log('✅ A tabela "lots" já existe!');
            console.log(`📈 Total de registros: ${testData?.length || 0}`);
            return;
        }
        
        console.log('⚠️  A tabela não existe ainda.');
        console.log('📝 Por favor, siga as instruções abaixo para criar a tabela:\n');
        
        const sqlPath = path.join(__dirname, 'supabase', 'migrations', '001_create_lots_table.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        console.log('═══════════════════════════════════════════════════════════');
        console.log('📋 INSTRUÇÕES PARA CRIAR A TABELA MANUALMENTE:');
        console.log('═══════════════════════════════════════════════════════════\n');
        console.log('1️⃣  Acesse: https://supabase.com/dashboard/project/tvsbgbroyauxyliybsvo/sql/new');
        console.log('2️⃣  Copie e cole o SQL abaixo no editor:');
        console.log('3️⃣  Clique em "RUN" para executar\n');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('SQL A SER EXECUTADO:');
        console.log('═══════════════════════════════════════════════════════════\n');
        console.log(sql);
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('📄 O SQL também está disponível em:');
        console.log('   ' + sqlPath);
        console.log('═══════════════════════════════════════════════════════════\n');
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

createTable();
