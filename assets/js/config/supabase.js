import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// ⚠️ SUBSTITUI PELOS TEUS DADOS
const SUPABASE_URL = "https://iimmqvhlrpbmabypvrap.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpbW1xdmhscnBibWFieXB2cmFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjI5NjgsImV4cCI6MjA5MTgzODk2OH0.L6Dc4KGsW9NuJfqC0VURdzEEjQBtYjabmwzPT8bIxn4";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
