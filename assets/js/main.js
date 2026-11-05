import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// example: contact form insert (RLS policy allows anonymous inserts)
// await supabase.from("contact_messages").insert({ name, email, body });
console.log("supabase client ready", !!supabase);
