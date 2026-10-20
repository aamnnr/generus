-- Rekap capaian lebih cepat: hitung agregat per kelompok SEKALI untuk akar
-- bersama semua unit yang diminta, lalu jumlahkan per unit (bukan menghitung
-- ulang subtree tiap unit). Hasil sama dengan 0011.

CREATE OR REPLACE FUNCTION app.capaian_rekap_units(p_period uuid, p_jenjang uuid, p_units uuid[])
RETURNS TABLE (
  unit_id uuid, generus int, slots int, tuntas int, proses int,
  kelompok int, delivered int, deliverable int
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
#variable_conflict use_column
DECLARE
  starts date;
  root ltree;
  n_paths int;
BEGIN
  SELECT p.starts_on INTO starts FROM curriculum_periods p
    WHERE p.id = p_period AND (p.published_at IS NOT NULL OR app.is_curriculum_editor());
  IF starts IS NULL THEN
    RETURN;
  END IF;

  -- Akar bersama: path unit itu sendiri bila hanya satu, selain itu leluhur bersama terdekat.
  SELECT count(*), CASE WHEN count(*) = 1 THEN (array_agg(u.path))[1] ELSE lca(array_agg(u.path)) END
    INTO n_paths, root
    FROM units u WHERE u.id = ANY (p_units);
  IF n_paths = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH kel AS (
    SELECT k.id, k.path FROM units k WHERE k.level = 'kelompok' AND k.path <@ root
  ),
  pairs AS (
    SELECT x.unit_path, count(*) AS slots, count(*) FILTER (WHERE x.done) AS tuntas, count(*) FILTER (WHERE x.prog) AS proses
    FROM app.capaian_pairs(p_period, p_jenjang, root) x
    GROUP BY x.unit_path
  ),
  gen AS (
    SELECT g.unit_path, count(*) AS n FROM generus g
    WHERE g.unit_path <@ root
      AND (p_jenjang IS NULL OR g.jenjang_id = p_jenjang)
      AND (g.status = 'aktif' OR g.status_date >= starts)
    GROUP BY g.unit_path
  ),
  kt AS (
    SELECT t.id FROM period_targets t JOIN materi m ON m.id = t.materi_id AND m.assessment = 'kelompok'
    WHERE t.period_id = p_period AND (p_jenjang IS NULL OR t.jenjang_id = p_jenjang) AND NOT t.optional
  ),
  dl AS (
    SELECT d.kelompok_id, count(*) AS n FROM target_deliveries d WHERE d.target_id IN (SELECT id FROM kt) GROUP BY d.kelompok_id
  ),
  perk AS (
    SELECT kel.id, kel.path,
      COALESCE(gen.n, 0) AS gen, COALESCE(pairs.slots, 0) AS slots, COALESCE(pairs.tuntas, 0) AS tuntas,
      COALESCE(pairs.proses, 0) AS proses, COALESCE(dl.n, 0) AS delivered
    FROM kel
    LEFT JOIN pairs ON pairs.unit_path = kel.path
    LEFT JOIN gen ON gen.unit_path = kel.path
    LEFT JOIN dl ON dl.kelompok_id = kel.id
  )
  SELECT u.id,
    COALESCE(sum(perk.gen), 0)::int,
    COALESCE(sum(perk.slots), 0)::int,
    COALESCE(sum(perk.tuntas), 0)::int,
    COALESCE(sum(perk.proses), 0)::int,
    count(perk.id)::int,
    COALESCE(sum(perk.delivered), 0)::int,
    (count(perk.id) * (SELECT count(*) FROM kt))::int
  FROM units u
  LEFT JOIN perk ON perk.path <@ u.path
  WHERE u.id = ANY (p_units) AND app.can_read_rekap(u.id)
  GROUP BY u.id;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION app.capaian_rekap_targets(p_period uuid, p_jenjang uuid, p_unit uuid)
RETURNS TABLE (target_id uuid, slots int, tuntas int, proses int, delivered int, kelompok int)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
#variable_conflict use_column
DECLARE
  upath ltree;
BEGIN
  IF NOT app.can_read_rekap(p_unit) THEN
    RAISE EXCEPTION 'Anda tidak punya akses ke rekap unit ini';
  END IF;
  SELECT u.path INTO upath FROM units u WHERE u.id = p_unit;
  RETURN QUERY
    WITH pairs AS (
      SELECT x.target_id, count(*) AS slots, count(*) FILTER (WHERE x.done) AS tuntas, count(*) FILTER (WHERE x.prog) AS proses
      FROM app.capaian_pairs(p_period, p_jenjang, upath) x
      GROUP BY x.target_id
    ),
    kel AS (SELECT k.id FROM units k WHERE k.level = 'kelompok' AND k.path <@ upath),
    dl AS (
      SELECT d.target_id, count(*) AS n FROM target_deliveries d JOIN kel ON kel.id = d.kelompok_id GROUP BY d.target_id
    )
    SELECT t.id,
      COALESCE(pairs.slots, 0)::int, COALESCE(pairs.tuntas, 0)::int, COALESCE(pairs.proses, 0)::int,
      COALESCE(dl.n, 0)::int, (SELECT count(*) FROM kel)::int
    FROM period_targets t
    JOIN curriculum_periods p ON p.id = t.period_id
    LEFT JOIN pairs ON pairs.target_id = t.id
    LEFT JOIN dl ON dl.target_id = t.id
    WHERE t.period_id = p_period
      AND (p_jenjang IS NULL OR t.jenjang_id = p_jenjang)
      AND (p.published_at IS NOT NULL OR app.is_curriculum_editor());
END;
$$;
