/* =========================================================
   SUPABASE CONNECTION
   ---------------------------------------------------------
   The keys are also embedded directly in index.html,
   admin.html and page.html, so this file is a backup only.
   IMPORTANT: cpfDb must be set on window, not declared with
   const, or other scripts cannot see it.
   ========================================================= */

window.SUPABASE_URL = "https://gbplyifhbniqbapcdlph.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdicGx5aWZoYm5pcWJhcGNkbHBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMjk0MzYsImV4cCI6MjEwMTYwNTQzNn0.xON8mQC7XD7LqHtzvjnQ89ArOAXAuwcNUuxP-qVERYo";
window.CPF_DB_READY = true;

window.cpfDb = window.supabase
  ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY)
  : null;
