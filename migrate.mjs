import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase credentials
const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://tvsbgbroyauxyliybsvo.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_wCA2Jp5NYsa642jfygTITA_-fedhR-s";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
    try {
        console.log('🚀 Starting database migration...');
        console.log(`📍 Supabase URL: ${supabaseUrl}`);
        
        // Read the migration SQL file
        const migrationPath = path.join(__dirname, 'supabase', 'migrations', '001_create_lots_table.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');
        
        console.log('📄 Read migration file:', migrationPath);
        console.log('📝 SQL Content preview:');
        console.log(sql.substring(0, 200) + '...\n');
        
        // Execute the migration using Supabase RPC
        // Note: This requires the sql function to be enabled in Supabase
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
        
        if (error) {
            // If RPC method doesn't work, try direct table creation
            console.log('⚠️  RPC method failed, trying direct table creation...');
            console.log('Error:', error.message);
            
            // Try creating the table directly using the REST API
            const response = await fetch(`${supabaseUrl}/rest/v1/`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseServiceKey,
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                    query: sql
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            console.log('✅ Table created using REST API');
        } else {
            console.log('✅ Migration executed successfully');
            console.log('Data:', data);
        }
        
        // Verify the table was created
        const { data: tableData, error: tableError } = await supabase
            .from('lots')
            .select('*')
            .limit(1);
        
        if (tableError) {
            console.error('❌ Error verifying table:', tableError.message);
            console.log('\n⚠️  The table may not have been created. Please create it manually in the Supabase dashboard.');
            console.log('\n📋 Manual steps:');
            console.log('1. Go to https://supabase.com/dashboard');
            console.log('2. Select your project');
            console.log('3. Go to SQL Editor');
            console.log('4. Copy and paste the SQL from: supabase/migrations/001_create_lots_table.sql');
            console.log('5. Click "Run"');
        } else {
            console.log('✅ Table verified successfully!');
            console.log(`📊 Current rows in table: ${tableData?.length || 0}`);
        }
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        console.log('\n⚠️  Automatic migration failed. Please create the table manually.');
        console.log('\n📋 Manual steps:');
        console.log('1. Go to https://supabase.com/dashboard');
        console.log('2. Select your project');
        console.log('3. Go to SQL Editor');
        console.log('4. Copy and paste the SQL from: supabase/migrations/001_create_lots_table.sql');
        console.log('5. Click "Run"');
        process.exit(1);
    }
}

runMigration();
