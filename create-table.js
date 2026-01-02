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

async function createTableDirectly() {
    try {
        console.log('🚀 Tentando criar a tabela "lots" diretamente...\n');
        
        // Read SQL migration file
        const sqlPath = path.join(__dirname, 'supabase', 'migrations', '001_create_lots_table.sql');
        const fullSql = fs.readFileSync(sqlPath, 'utf8');
        
        // Split the SQL into individual statements
        const statements = fullSql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));
        
        console.log(`📝 Encontradas ${statements.length} declarações SQL\n`);
        
        // Execute each statement individually using the SQL endpoint
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i] + ';';
            console.log(`Executando declaração ${i + 1}/${statements.length}...`);
            
            try {
                // Use fetch to hit the SQL endpoint directly
                const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
                    method: 'POST',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ query: statement })
                });
                
                if (response.ok) {
                    console.log(`✅ Declaração ${i + 1} executada com sucesso`);
                } else {
                    const errorText = await response.text();
                    console.log(`⚠️  Declaração ${i + 1} falhou (pode ser esperado): ${errorText.substring(0, 100)}`);
                }
            } catch (err) {
                console.log(`⚠️  Erro na declaração ${i + 1}:`, err.message);
            }
        }
        
        console.log('\n📊 Verificando se a tabela foi criada...');
        
        // Verify the table exists
        const { data, error } = await supabase
            .from('lots')
            .select('id')
            .limit(1);
        
        if (error) {
            console.log('❌ A tabela ainda não existe. Erro:', error.message);
            console.log('\n═══════════════════════════════════════════════════════════');
            console.log('⚠️  ATENÇÃO: Criação automática não funcionou');
            console.log('═══════════════════════════════════════════════════════════\n');
            console.log('Por favor, crie a tabela manualmente seguindo as instruções:');
            console.log('\n1️⃣  Acesse: https://supabase.com/dashboard/project/tvsbgbroyauxyliybsvo/sql/new');
            console.log('2️⃣  Abra o arquivo: supabase/migrations/001_create_lots_table.sql');
            console.log('3️⃣  Copie todo o conteúdo SQL');
            console.log('4️⃣  Cole no editor SQL do Supabase');
            console.log('5️⃣  Clique em "RUN"');
            console.log('\n═══════════════════════════════════════════════════════════\n');
        } else {
            console.log('✅ SUCESSO! A tabela "lots" foi criada com sucesso!');
            console.log(`📈 Registros atuais: ${data?.length || 0}`);
        }
        
    } catch (error) {
        console.error('❌ Erro geral:', error.message);
    }
}

createTableDirectly();
