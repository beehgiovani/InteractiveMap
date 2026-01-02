import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database connection config
// Using the pooler endpoint which should support IPv4
const config = {
    host: 'aws-0-us-east-1.pooler.supabase.com',
    port: 5432, // Session mode pooler port
    database: 'postgres',
    user: 'postgres.tvsbgbroyauxyliybsvo',
    password: process.env.SUPABASE_DB_PASSWORD || '',
    ssl: {
        rejectUnauthorized: false
    },
    connectionTimeoutMillis: 10000
};

async function createTable() {
    // Check if password is provided
    if (!config.password) {
        console.log('❌ Senha do banco de dados não fornecida!');
        console.log('\n📋 Para obter a senha:');
        console.log('1. Acesse: https://supabase.com/dashboard/project/tvsbgbroyauxyliybsvo/settings/database');
        console.log('2. Na seção "Connection string", copie a senha');
        console.log('3. Execute: SUPABASE_DB_PASSWORD="sua_senha" node create-table-pg.js');
        console.log('\nOu edite o script e cole a senha diretamente.\n');
        return;
    }

    const client = new Client(config);

    try {
        console.log('🔌 Conectando ao banco de dados Supabase...');
        await client.connect();
        console.log('✅ Conectado com sucesso!\n');

        // Read SQL file
        const sqlPath = path.join(__dirname, 'supabase', 'migrations', '001_create_lots_table.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('📝 Executando migração SQL...');
        console.log('─'.repeat(60));
        
        // Execute the SQL
        await client.query(sql);
        
        console.log('─'.repeat(60));
        console.log('✅ Tabela "lots" criada com sucesso!\n');

        // Verify table creation
        const result = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'lots';
        `);

        if (result.rows.length > 0) {
            console.log('✅ Verificação: Tabela confirmada no banco de dados');
            
            // Get column info
            const columns = await client.query(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_schema = 'public' 
                AND table_name = 'lots'
                ORDER BY ordinal_position;
            `);
            
            console.log('\n📊 Estrutura da tabela:');
            console.log('─'.repeat(60));
            columns.rows.forEach(col => {
                console.log(`  • ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? '- NOT NULL' : ''}`);
            });
            console.log('─'.repeat(60));
        }

    } catch (error) {
        console.error('\n❌ Erro ao criar tabela:', error.message);
        console.error('\nDetalhes do erro:', error);
        
        if (error.code === '28P01') {
            console.log('\n⚠️  Erro de autenticação. Verifique se a senha está correta.');
        } else if (error.code === '42P07') {
            console.log('\n✅ A tabela já existe!');
        }
    } finally {
        await client.end();
        console.log('\n🔌 Conexão encerrada.');
    }
}

createTable();
