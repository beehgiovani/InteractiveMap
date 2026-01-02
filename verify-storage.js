import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://tvsbgbroyauxyliybsvo.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2c2JnYnJveWF1eHlsaXlic3ZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ2OTQ0MzAsImV4cCI6MjA1MDI3MDQzMH0.wCA2Jp5NYsa642jfygTITA_-fedhR-s";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testStorage() {
    console.log('🔍 Testando acesso ao bucket de storage...\n');
    
    try {
        // List files in bucket
        const { data, error } = await supabase.storage
            .from('lot-attachments')
            .list('', { limit: 1 });
        
        if (error) {
            console.error('❌ Erro ao acessar bucket:', error.message);
            return;
        }
        
        console.log('✅ Bucket "lot-attachments" está acessível!');
        console.log(`📁 Arquivos encontrados: ${data?.length || 0}`);
        
        // Test upload (create a tiny test file)
        const testContent = new Blob(['test'], { type: 'text/plain' });
        const testFile = new File([testContent], 'test.txt');
        
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('lot-attachments')
            .upload(`test/${Date.now()}.txt`, testFile, {
                cacheControl: '3600',
                upsert: false
            });
        
        if (uploadError) {
            console.warn('⚠️  Upload test failed:', uploadError.message);
            console.log('\n📋 Por favor, configure as políticas de acesso:');
            console.log('   Ver: create-storage-bucket-instructions.md (Passo 3)');
        } else {
            console.log('✅ Upload test successful!');
            
            // Clean up test file
            await supabase.storage
                .from('lot-attachments')
                .remove([uploadData.path]);
            
            console.log('✅ Storage totalmente funcional!\n');
        }
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

testStorage();
