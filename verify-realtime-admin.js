import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tvsbgbroyauxyliybsvo.supabase.co';
// Using the SECRET key provided by user
const SUPABASE_SERVICE_KEY = 'sb_secret_vroWwehvfjdy3NnM6aQiUA_zp4iNsFB';

console.log('🚀 Starting Admin/Service-Role Realtime verification...');

const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    realtime: {
        params: {
            eventsPerSecond: 10
        }
    }
});

async function run() {
    console.log('\n--- Test: Realtime Subscription (Service Role) ---');
    
    const channel = client
        .channel('admin_verification_channel')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'lots' },
            (payload) => {
                console.log('🎉 EVENT RECEIVED:', payload);
            }
        )
        .subscribe((status, err) => {
            console.log(`Status update: ${status}`);
            
            if (status === 'SUBSCRIBED') {
                console.log('✅ Realtime Connected Successfully with Service Key!');
                console.log('This means Realtime IS enabled on the server.');
                console.log('If Anon key failed, it is likely an RLS Policy issue.');
                process.exit(0);
            }
            
            if (status === 'CHANNEL_ERROR') {
                console.error('❌ Realtime Connection Failed (Service Key):', err);
                // If service key fails, Realtime is likely not configured/enabled for the table.
                process.exit(1);
            }
            
            if (status === 'TIMED_OUT') {
                console.error('❌ Realtime Timed Out (Service Key)');
                 process.exit(1);
            }
        });
}

run();
