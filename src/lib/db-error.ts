/**
 * Pesan yang aman ditampilkan dari error database. Pesan dari trigger kita
 * (RAISE EXCEPTION, kode P0001) sudah berbahasa Indonesia; selain itu pakai
 * pesan umum.
 */
export function dbErrorMessage(err: unknown, fallback = "Terjadi kesalahan. Coba lagi."): string {
  let e: unknown = err;
  for (let i = 0; i < 5 && e; i++) {
    const { code, message, cause } = e as { code?: string; message?: string; cause?: unknown };
    if (code === "P0001" && message) return message;
    if (code === "23505") return "Data yang sama sudah ada.";
    if (code === "23503") return "Data masih dipakai data lain sehingga tidak bisa dihapus.";
    if (code === "42501") return "Anda tidak punya akses untuk tindakan ini.";
    e = cause;
  }
  return fallback;
}
