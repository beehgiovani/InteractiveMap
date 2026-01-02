import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Fetching one row to check columns...");
    const { data, error } = await supabase.from('lots').select('*').limit(1);
    
    if (error) {
        console.error("Error:", error);
        return;
    }

    if (!data || data.length === 0) {
        console.log("Table is empty.");
        return;
    }

    console.log("Keys found in first row:", Object.keys(data[0]));
    console.log("Sample Data:", data[0]);
}

check();
