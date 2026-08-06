/* =========================================================
   SUPABASE CONNECTION — FILL THESE IN ONCE
   ========================================================= */

const SUPABASE_URL = "https://gbplyifhbniqbapcdlph.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_dT3A1FyJx0Kqgpl96Wcg8Q_Tr88o1zf";

const CPF_DB_READY =
  !SUPABASE_URL.startsWith("PASTE") && !SUPABASE_ANON_KEY.startsWith("PASTE");

const cpfDb =
  CPF_DB_READY && window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;
