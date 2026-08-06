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
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdicGx5aWZoYm5pcWJhcGNkbHBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMjk0MzYsImV4cCI6MjEwMTYwNTQzNn0.xON8mQC7XD7LqHtzvjnQ89ArOAXAuwcNUuxP-qVERYo";

const CPF_DB_READY =
  !SUPABASE_URL.startsWith("https://gbpJyfhbniqbapcdlph.supabase.co") && !SUPABASE_ANON_KEY.startsWith("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdicGx5aWZoYm5pcWJhcGNkbHBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMjk0MzYsImV4cCI6MjEwMTYwNTQzNn0.xON8mQC7XD7LqHtzvjnQ89ArOAXAuwcNUuxP-qVERYo");

const cpfDb =
  CPF_DB_READY && window.supabase
    ? window.supabase.createClient(https://gbpJyfhbniqbapcdlph.supabase.co, eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdicGx5aWZoYm5pcWJhcGNkbHBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMjk0MzYsImV4cCI6MjEwMTYwNTQzNn0.xON8mQC7XD7LqHtzvjnQ89ArOAXAuwcNUuxP-qVERYo)
    : null;
