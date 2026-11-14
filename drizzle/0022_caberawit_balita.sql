-- Jenjang baru:
-- - Balita (urutan 0): hanya didata untuk sensus jamaah. ikut_kegiatan = false →
--   tidak pernah menjadi sasaran agenda/presensi, tidak punya target & capaian,
--   tidak dicetak kartu QR. Naik ke Caberawit lewat fitur kenaikan jenjang.
-- - Caberawit (urutan 1): anak PAUD/TK sampai kelas 6 SD, kategori PAUD/TK & SD.
-- Pra Remaja & Remaja bergeser ke urutan 2 & 3.

INSERT INTO jenjang (name, sort_order, ikut_kegiatan) VALUES
  ('Balita', 0, false),
  ('Caberawit', 1, true)
ON CONFLICT (name) DO NOTHING;--> statement-breakpoint

UPDATE jenjang SET sort_order = 2 WHERE name = 'Pra Remaja';--> statement-breakpoint
UPDATE jenjang SET sort_order = 3 WHERE name = 'Remaja';--> statement-breakpoint

INSERT INTO jenjang_kategori (jenjang_id, name, sort_order)
SELECT j.id, k.name, k.sort_order
FROM jenjang j
CROSS JOIN (VALUES ('PAUD/TK', 1), ('SD', 2)) AS k(name, sort_order)
WHERE j.name = 'Caberawit'
ON CONFLICT ON CONSTRAINT jenjang_kategori_unique DO NOTHING;--> statement-breakpoint

-- Agenda yang masih berjalan/akan datang dengan sasaran "semua jenjang" dibuat
-- untuk Pra Remaja & Remaja. Tetapkan sasaran itu secara eksplisit agar anak
-- Caberawit tidak tiba-tiba masuk daftar peserta (lalu tercatat alpa).
-- Agenda terkunci tidak perlu: pesertanya sudah tersimpan di presensi.
UPDATE agendas
SET target_jenjang_ids = ARRAY(SELECT id FROM jenjang WHERE name IN ('Pra Remaja', 'Remaja') ORDER BY sort_order)
WHERE cardinality(target_jenjang_ids) = 0 AND locked_at IS NULL AND cancelled_at IS NULL;--> statement-breakpoint

-- Sasaran agenda tidak pernah memuat jenjang yang hanya didata (Balita).
CREATE OR REPLACE FUNCTION app.agenda_is_target(a agendas, g generus)
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT g.unit_path <@ a.unit_path
    AND (cardinality(a.target_jenjang_ids) = 0 OR g.jenjang_id = ANY (a.target_jenjang_ids))
    AND (cardinality(a.target_kategori_ids) = 0 OR g.kategori_id IS NULL OR g.kategori_id = ANY (a.target_kategori_ids))
    AND (a.target_gender IS NULL OR g.gender = a.target_gender)
    AND (g.status = 'aktif' OR g.status_date > a.starts_at::date)
    AND EXISTS (SELECT 1 FROM jenjang j WHERE j.id = g.jenjang_id AND j.ikut_kegiatan);
$$;
