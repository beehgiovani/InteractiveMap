import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = "https://tvsbgbroyauxyliybsvo.supabase.co";
const supabaseKey = "sb_publishable_wCA2Jp5NYsa642jfygTITA_-fedhR-s";

async function createTableViaAPI() {
    try {
        console.log('🚀 Criando tabela via Supabase API...\n');
        
        // Read SQL file
        const sqlPath = path.join(__dirname, 'supabase', 'migrations', '001_create_lots_table.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        // Split into individual statements
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));
        
        console.log(`📝 Executando ${statements.length} comandos SQL...\n`);
        
        // Try using Supabase REST API with raw SQL
        // This uses the postgrest endpoint
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
            method: 'POST',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                sql: sql
            })
        });
        
        if (response.ok) {
            console.log('✅ SQL executado com sucesso!');
            const data = await response.json();
            console.log('Resposta:', data);
        } else {
            const errorText = await response.text();
            console.log('⚠️  Método API falhou:', errorText.substring(0, 200));
            console.log('\n');
            console.log('═══════════════════════════════════════════════════════════');
            console.log('📋 SOLUÇÃO: Execute o SQL manualmente no Dashboard');
            console.log('═══════════════════════════════════════════════════════════\n');
            console.log('1️⃣  Acesse: https://supabase.com/dashboard/project/tvsbgbroyauxyliybsvo/sql/new');
            console.log('2️⃣  Copie e cole o SQL abaixo:');
            console.log('3️⃣  Clique em "RUN"\n');
            console.log('─'.repeat(60));
            console.log(sql);
            console.log('─'.repeat(60));
        }
        
        // Verify
        console.log('\n📊 Verificando se a tabela existe...');
        const checkResponse = await fetch(`${supabaseUrl}/rest/v1/lots?limit=1`, {
            method: 'GET',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
            }
        });
        
        if (checkResponse.ok) {
            const data = await checkResponse.json();
            console.log('✅ SUCESSO! A tabela "lots" existe!');
            console.log(`📈 Registros atuais: ${data.length}`);
        } else {
            const error = await checkResponse.text();
            if (error.includes('Could not find')) {
                console.log('❌ A tabela ainda não foi criada.');
                console.log('\n👉 Use o método manual acima.');
            } else {
                console.log('Erro:', error.substring(0, 200));
            }
        }
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('📋 Por favor, crie a tabela manualmente:');
        console.log('═══════════════════════════════════════════════════════════\n');
        console.log('🌐 URL: https://supabase.com/dashboard/project/tvsbgbroyauxyliybsvo/sql/new');
        console.log('📄 Arquivo SQL: supabase/migrations/001_create_lots_table.sql\n');
    }
}

createTableViaAPI();
