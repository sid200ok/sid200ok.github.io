import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import "./auth.js"; // Initializes auth UI

// Export the client so other modules (like incubation.js) can use it
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("✅ Supabase client initialized. Auth & Incubation modules ready.");

// Import incubation logic after client is ready
import("./incubation.js");
