import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tvsbgbroyauxyliybsvo.supabase.co';
// Using the SECRET key to have permissions to alter publications
const supabaseKey = 'sb_secret_vroWwehvfjdy3NnM6aQiUA_zp4iNsFB';

const supabase = createClient(supabaseUrl, supabaseKey);

async function enableRealtime() {
  console.log('🔧 Enabling Realtime for lots table...');
  
  try {
    // Execute SQL to enable realtime
    // Note: exec_sql is a custom function. If it doesn't exist, this will fail.
    // If it fails, we will guide the user to the dashboard.
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: 'ALTER PUBLICATION supabase_realtime ADD TABLE public.lots;'
    });
    
    if (error) {
      console.error('❌ Error executing RPC:', error.message);
      
      // Fallback: Try to just check if we can query, verifying the key works
      const { error: queryError } = await supabase.from('lots').select('id').limit(1);
      if (queryError) {
          console.error('❌ Connectivity check failed:', queryError.message);
      } else {
          console.log('✅ Connectivity confirmed with Secret Key.');
      }

      console.log('\n⚠️  Could not auto-enable Realtime (exec_sql function missing or permission denied).');
      console.log('Please enable it manually:');
      console.log('1. Go to: https://supabase.com/dashboard/project/tvsbgbroyauxyliybsvo/database/publications');
      console.log('2. Edit "supabase_realtime" publication');
      console.log('3. Add the "lots" table to the publication');
      console.log('\nOR run this SQL in the SQL Editor (https://supabase.com/dashboard/project/tvsbgbroyauxyliybsvo/sql/new):');
      console.log('ALTER PUBLICATION supabase_realtime ADD TABLE public.lots;');
    } else {
      console.log('✅ Realtime enabled successfully via RPC!');
    }
  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

enableRealtime();
