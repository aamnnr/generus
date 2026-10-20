-- Ekstensi yang dibutuhkan sebelum tabel dibuat.
-- Di Supabase, schema `extensions` sudah ada dan masuk search_path.
CREATE SCHEMA IF NOT EXISTS extensions;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS ltree WITH SCHEMA extensions;
