import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://tvsbgbroyauxyliybsvo.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2c2JnYnJveWF1eHlsaXlic3ZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ2OTQ0MzAsImV4cCI6MjA1MDI3MDQzMH0.wCA2Jp5NYsa642jfygTITA_-fedhR-s";

const supabase = createClient(supabaseUrl, supabaseKey);

async function createStorageBucket() {
    console.log('🗂️  Criando bucket de storage no Supabase...\n');
    
    try {
        // Check if bucket already exists
        const { data: buckets, error: listError } = await supabase.storage.listBuckets();
        
        if (listError) {
            console.error('❌ Erro ao listar buckets:', listError.message);
            return;
        }
        
        const bucketExists = buckets?.some(b => b.name === 'lot-attachments');
        
        if (bucketExists) {
            console.log('✅ Bucket "lot-attachments" já existe!');
            return;
        }
        
        // Create bucket
        const { data, error } = await supabase.storage.createBucket('lot-attachments', {
            public: true, // Public read access
            fileSizeLimit: 5242880, // 5MB limit
            allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'],
        });
        
        if (error) {
            console.error('❌ Erro ao criar bucket:', error.message);
            
            // If error is about permissions, show manual instructions
            if (error.message.includes('permission') || error.message.includes('policy') || error.message.includes('not found')) {
                console.log('\n═══════════════════════════════════════════════════════════');
                console.log('⚠️  Não foi possível criar o bucket automaticamente.');
                console.log('═══════════════════════════════════════════════════════════\n');
                console.log('📋 Por favor, crie manualmente no Supabase Dashboard:\n');
                console.log('1️⃣  Acesse: https://supabase.com/dashboard/project/tvsbgbroyauxyliybsvo/storage/buckets');
                console.log('2️⃣  Clique em "New Bucket"');
                console.log('3️⃣  Configurações:');
                console.log('   • Name: lot-attachments');
                console.log('   • Public bucket: ✅ (marcado)');
                console.log('   • File size limit: 5 MB');
                console.log('   • Allowed MIME types: image/*, application/pdf');
                console.log('4️⃣  Clique em "Create bucket"');
                console.log('\n5️⃣  Configurar políticas de acesso (Policies):');
                console.log('   No bucket criado, vá em "Policies" e adicione:');
                console.log('   ');
                console.log('   Policy 1 - Public Read:');
                console.log('   • Name: Public read access');
                console.log('   • Allowed operation: SELECT');
                console.log('   • Policy definition: true');
                console.log('   ');
                console.log('   Policy 2 - Upload:');
                console.log('   • Name: Allow uploads');
                console.log('   • Allowed operation: INSERT');
                console.log('   • Policy definition: true (ou auth.role() = authenticated)');
                console.log('\n═══════════════════════════════════════════════════════════\n');
            }
            return;
        }
        
        console.log('✅ Bucket "lot-attachments" criado com sucesso!');
        console.log('📊 Configurações:');
        console.log('   • Acesso público: Sim');
        console.log('   • Tamanho máximo: 5 MB');
        console.log('   • Tipos permitidos: Imagens e PDFs');
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

createStorageBucket();
