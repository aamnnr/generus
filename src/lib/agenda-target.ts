// Sasaran agenda dipilih per "segmen" (Pra Remaja, Remaja Pelajar, Remaja
// Mandiri) lalu disimpan sebagai target_jenjang_ids + target_kategori_ids.
// Aturan di database: kategori hanya menyaring generus yang punya kategori.

export interface JenjangRef {
  id: string;
  name: string;
  kategori: { id: string; name: string }[];
}

export interface Segment {
  key: string;
  label: string;
  jenjangId: string;
  kategoriId: string | null;
}

/** Segmen dari daftar jenjang: jenjang tanpa kategori = 1 segmen, dengan kategori = 1 per kategori. */
export function segmentsOf(jenjang: JenjangRef[]): Segment[] {
  return jenjang.flatMap((j): Segment[] =>
    j.kategori.length === 0
      ? [{ key: j.id, label: j.name, jenjangId: j.id, kategoriId: null }]
      : j.kategori.map((k) => ({ key: `${j.id}:${k.id}`, label: `${j.name} ${k.name}`, jenjangId: j.id, kategoriId: k.id })),
  );
}

/** Segmen terpilih → kolom target. Semua/tidak ada yang dipilih = tanpa filter. */
export function segmentsToTarget(selectedKeys: string[], jenjang: JenjangRef[]) {
  const all = segmentsOf(jenjang);
  const picked = all.filter((s) => selectedKeys.includes(s.key));
  if (picked.length === 0 || picked.length === all.length) return { jenjangIds: [] as string[], kategoriIds: [] as string[] };

  const jenjangIds = [...new Set(picked.map((s) => s.jenjangId))];
  // Filter kategori hanya perlu bila ada jenjang berkategori yang tidak dipilih seluruh kategorinya.
  const partial = jenjang.some(
    (j) => j.kategori.length > 0 && jenjangIds.includes(j.id) && j.kategori.some((k) => !picked.some((p) => p.kategoriId === k.id)),
  );
  const kategoriIds = partial ? picked.flatMap((s) => (s.kategoriId ? [s.kategoriId] : [])) : [];
  return { jenjangIds, kategoriIds };
}

/** Kolom target → kunci segmen (untuk mengisi form edit & label). */
export function targetToSegments(target: { jenjangIds: string[]; kategoriIds: string[] }, jenjang: JenjangRef[]): string[] {
  return segmentsOf(jenjang)
    .filter(
      (s) =>
        (target.jenjangIds.length === 0 || target.jenjangIds.includes(s.jenjangId)) &&
        (target.kategoriIds.length === 0 || s.kategoriId === null || target.kategoriIds.includes(s.kategoriId)),
    )
    .map((s) => s.key);
}

export function targetLabel(
  target: { jenjangIds: string[]; kategoriIds: string[]; gender: "L" | "P" | null },
  jenjang: JenjangRef[],
): string {
  const all = segmentsOf(jenjang);
  const keys = targetToSegments(target, jenjang);
  const seg = keys.length === all.length ? "Semua jenjang" : all.filter((s) => keys.includes(s.key)).map((s) => s.label).join(", ");
  const gender = target.gender === "L" ? " · Laki-laki" : target.gender === "P" ? " · Perempuan" : "";
  return seg + gender;
}
