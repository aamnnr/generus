// Jalankan perintah dengan variabel dari file env tertentu, mis. server resmi:
//
//   node scripts/with-env.mjs .env.resmi drizzle-kit migrate
//
// Nilai dari file ini menang atas .env, jadi perintah tidak mungkin tanpa
// sengaja mengenai database uji.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { parse } from "dotenv";

const [file, ...cmd] = process.argv.slice(2);
if (!file || cmd.length === 0) {
  console.error("Pemakaian: node scripts/with-env.mjs <file-env> <perintah...>");
  process.exit(1);
}
if (!existsSync(file)) {
  console.error(`✗ ${file} tidak ditemukan. Salin .env.resmi.example menjadi ${file} lalu isi.`);
  process.exit(1);
}
const vars = parse(readFileSync(file));
const host = vars.DATABASE_URL ? new URL(vars.DATABASE_URL).host : "(tidak ada DATABASE_URL)";
console.log(`→ ${file} · database ${host}`);

const child = spawn(cmd.join(" "), { stdio: "inherit", shell: true, env: { ...process.env, ...vars } });
child.on("exit", (code) => process.exit(code ?? 1));
