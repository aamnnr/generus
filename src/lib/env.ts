import "server-only";
import { z } from "zod";

// Variabel environment sisi server. Dibaca saat pertama dipakai agar build
// tidak gagal di lingkungan yang belum punya database.
const schema = z.object({
  DATABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
});

let cached: z.infer<typeof schema> | undefined;

export function env() {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
      throw new Error(`Environment tidak valid: ${missing}. Lihat .env.example.`);
    }
    cached = parsed.data;
  }
  return cached;
}
