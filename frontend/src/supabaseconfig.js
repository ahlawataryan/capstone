import { createClient } from "@supabase/supabase-js";
//I think this is also done in a backend file, but this is the one I made at least. This information is publicly exposed anyways
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);