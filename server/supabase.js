require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
// Use the service role key on the server so we can bypass RLS for trusted operations.
// Falls back to the publishable/anon key if SERVICE_KEY is not yet set.
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY / SUPABASE_ANON_KEY in server environment."
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;