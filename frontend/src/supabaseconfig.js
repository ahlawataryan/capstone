import { createClient } from "@supabase/supabase-js";
//I think this is also done in a backend file, but this is the one I made at least. This information is publicly exposed anyways
const supabaseUrl = 'https://nuruihhhemqmyftingxw.supabase.co';
const supabaseAnonKey = 'sb_publishable_kXgK3rIJjEm19aKBacXy4Q_EDdtwKr2';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);