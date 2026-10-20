/** Kerangka pemuatan halaman (pengganti teks "Memuat…"), muncul dengan fade lembut. */
export function PageLoading() {
  return (
    <div role="status" aria-label="Memuat" className="animate-enter flex flex-col gap-4">
      <span className="sr-only">Memuat…</span>
      <div className="h-8 w-48 animate-pulse rounded-xl bg-muted" />
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-card shadow-card" />
        ))}
      </div>
      <div className="flex flex-col gap-2 rounded-2xl bg-card p-4 shadow-card">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-xl bg-muted" style={{ animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
    </div>
  );
}
