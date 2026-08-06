/* =========================================================
   SUPABASE CONNECTION — FILL THESE IN ONCE
   =========================================================
   Supabase dashboard → Project Settings → API
     • Project URL   → paste into SUPABASE_URL
     • anon public key → paste into SUPABASE_ANON_KEY

   The anon key is safe to publish. It can only read pages
   you have marked as Published. Creating and editing pages
   requires an admin login.
   ========================================================= */

const SUPABASE_URL = "https://gbpJyfhbniqbapcdlph.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_dT3A1FyJx0Kqgpl96Wcg8Q_Tr88o1zf";

const CPF_DB_READY =
  !SUPABASE_URL.startsWith("https://gbpJyfhbniqbapcdlph.supabase.co") && !SUPABASE_ANON_KEY.startsWith("sb_publishable_dT3A1FyJx0Kqgpl96Wcg8Q_Tr88o1zf");

const cpfDb =
  CPF_DB_READY && window.supabase
    ? window.supabase.createClient(https://gbpJyfhbniqbapcdlph.supabase.co, sb_publishable_dT3A1FyJx0Kqgpl96Wcg8Q_Tr88o1zf)
    : null;
