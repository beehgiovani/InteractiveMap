import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tvsbgbroyauxyliybsvo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_wCA2Jp5NYsa642jfygTITA_-fedhR-s';

console.log('🚀 Starting headless Realtime verification...');
console.log('Key used:', SUPABASE_KEY);

const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    realtime: {
        params: {
            eventsPerSecond: 10
        }
    }
});

async function run() {
    // 1. Check if we can fetch data
    console.log('\n--- Test 1: Fetching Data ---');
    try {
        const { data, error } = await client.from('lots').select('*').limit(1);
        if (error) {
            console.error('❌ Fetch Error:', error.message);
        } else {
            console.log(`✅ Fetch Success! Found ${data?.length} rows.`);
        }
    } catch (e) {
        console.error('❌ Exception during fetch:', e);
    }

    // 2. Check Realtime
    console.log('\n--- Test 2: Realtime Subscription ---');
    
    const channel = client
        .channel('verification_channel')
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
                console.log('✅ Realtime Connected Successfully!');
                console.log('Waiting 5 seconds for any events (or just to keep connection open)...');
                setTimeout(() => {
                    console.log('Done.');
                    process.exit(0);
                }, 5000);
            }
            
            if (status === 'CHANNEL_ERROR') {
                console.error('❌ Realtime Connection Failed:', err);
                process.exit(1);
            }
            
            if (status === 'TIMED_OUT') {
                console.error('❌ Realtime Timed Out');
                process.exit(1);
            }
        });
}

run();
