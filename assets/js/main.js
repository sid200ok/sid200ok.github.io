import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import "./auth.js"; // This automatically initializes the auth UI

// Initialize Supabase client for future use (e.g., fetching projects)
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log("✅ Supabase client initialized. Auth module loaded.");

// TODO: Next step will be adding incubation.js to fetch and render projects!
