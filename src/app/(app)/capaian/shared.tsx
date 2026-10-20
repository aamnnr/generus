/** Bilah progres: hijau = tuntas, kuning = proses. */
export function ProgressBar({ done, proses, total }: { done: number; proses: number; total: number }) {
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  return (
    <div
      className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
      role="img"
      aria-label={`${done} tuntas, ${proses} proses dari ${total}`}
    >
      <div className="bg-status-hadir" style={{ width: `${pct(done)}%` }} />
      <div className="bg-status-terlambat" style={{ width: `${pct(proses)}%` }} />
    </div>
  );
}
