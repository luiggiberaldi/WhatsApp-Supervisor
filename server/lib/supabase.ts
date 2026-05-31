import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
// Prioritize service role key if it's available, otherwise fallback to the anon key
let supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

// Ignore placeholder keys (e.g. "your-*", "placeholder-*", "change-me") to avoid silent auth failures
const placeholderPattern = /^(your-|placeholder|change[._-]?me|replace[._-]?with)/i;
if (placeholderPattern.test(supabaseKey)) {
  const fallbackKey = process.env.VITE_SUPABASE_ANON_KEY || "";
  if (!placeholderPattern.test(fallbackKey)) {
    console.warn("⚠️ [Server Supabase] SUPABASE_SERVICE_ROLE_KEY is a placeholder. Falling back to VITE_SUPABASE_ANON_KEY.");
    supabaseKey = fallbackKey;
  } else {
    console.warn("⚠️ [Server Supabase] Both SUPABASE_SERVICE_ROLE_KEY and VITE_SUPABASE_ANON_KEY are placeholders. Supabase client disabled.");
    supabaseKey = "";
  }
}

if (!supabaseUrl || !supabaseKey) {
  console.warn("⚠️ [Server Supabase Backup] Warning: Supabase URL or Key is missing in server environment.");
}

export const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

