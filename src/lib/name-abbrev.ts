/**
 * Bentuk nama dari utuh hingga paling singkat, untuk nama yang tidak muat di kartu:
 * kata terakhir, lalu kata sebelumnya, disingkat menjadi huruf awal kapital + titik.
 * Kata pertama tidak pernah disingkat. Sama dengan nameVariants di aplikasi Android.
 *
 * "Muhammad Abdurrahman Al-Fatih Nur" → … "Muhammad Abdurrahman Al-Fatih N." →
 * "Muhammad Abdurrahman A. N." → "Muhammad A. A. N."
 */
export function nameVariants(name: string): string[] {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return [name.trim()];
  const out = [words.join(" ")];
  const cur = [...words];
  for (let i = words.length - 1; i >= 1; i--) {
    if (cur[i].length <= 2 && cur[i].endsWith(".")) continue;
    cur[i] = `${cur[i][0].toUpperCase()}.`;
    out.push(cur.join(" "));
  }
  return out;
}
