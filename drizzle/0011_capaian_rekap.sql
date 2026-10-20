-- Fase 4e: rekap capaian lintas unit. Agregat saja (tanpa data per generus),
-- sehingga Tim Kurikulum boleh membaca walau tidak punya akses ke tabel generus.

-- Boleh membaca rekap unit ini: superadmin/admin/kyai yang lingkupnya mencakup
-- unit tersebut, atau penyusun kurikulum (seluruh daerah).
CREATE FUNCTION app.can_read_rekap(p_unit uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT app.is_curriculum_editor() OR EXISTS (
    SELECT 1 FROM units u
    WHERE u.id = p_unit AND app.has_role_in(u.path, ARRAY['superadmin', 'admin', 'kyai']::app_role[])
  );
$$;--> statement-breakpoint

-- Pasangan (target, generus) yang dinilai per generus atau lewat kitab, di bawah
-- `p_path`. Syarat sasaran = app.target_applies, ditulis ulang di sini agar bisa
-- dioptimalkan planner. Target pilihan tidak dihitung. p_jenjang NULL = semua jenjang.
-- Bukan SECURITY DEFINER: bila dipanggil langsung oleh user, RLS tetap berlaku.
CREATE FUNCTION app.capaian_pairs(p_period uuid, p_jenjang uuid, p_path ltree)
RETURNS TABLE (target_id uuid, unit_path ltree, done boolean, prog boolean)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT t.id, g.unit_path,
    COALESCE(CASE WHEN t.kitab_id IS NULL THEN a.status = 'tuntas' ELSE kp.position >= t.range_to END, false),
    COALESCE(CASE WHEN t.kitab_id IS NULL THEN a.status = 'proses'
                  ELSE kp.position >= t.range_from AND kp.position < t.range_to END, false)
  FROM period_targets t
  JOIN curriculum_periods p ON p.id = t.period_id
  LEFT JOIN materi m ON m.id = t.materi_id
  JOIN generus g ON g.unit_path <@ p_path
    AND g.jenjang_id = t.jenjang_id
    AND (t.kategori_id IS NULL OR t.kategori_id = g.kategori_id)
    AND (t.gender IS NULL OR t.gender = g.gender)
    AND (g.status = 'aktif' OR g.status_date >= p.starts_on)
  LEFT JOIN achievements a ON a.target_id = t.id AND a.generus_id = g.id
  LEFT JOIN LATERAL (
    SELECT x.position FROM kitab_progress x
    WHERE x.generus_id = g.id AND x.kitab_id = t.kitab_id AND x.recorded_on <= p.ends_on
    ORDER BY x.recorded_on DESC, x.created_at DESC LIMIT 1
  ) kp ON t.kitab_id IS NOT NULL
  WHERE t.period_id = p_period
    AND (p_jenjang IS NULL OR t.jenjang_id = p_jenjang)
    AND NOT t.optional
    AND (t.kitab_id IS NOT NULL OR m.assessment = 'generus');
$$;--> statement-breakpoint

-- Rekap per unit (desa/kelompok/daerah) untuk daftar unit yang diminta.
-- Unit yang tidak boleh dibaca user dilewati.
CREATE FUNCTION app.capaian_rekap_units(p_period uuid, p_jenjang uuid, p_units uuid[])
RETURNS TABLE (
  unit_id uuid, generus int, slots int, tuntas int, proses int,
  kelompok int, delivered int, deliverable int
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
#variable_conflict use_column
DECLARE
  u units%ROWTYPE;
  starts date;
BEGIN
  SELECT starts_on INTO starts FROM curriculum_periods WHERE id = p_period AND published_at IS NOT NULL;
  IF starts IS NULL AND NOT app.is_curriculum_editor() THEN
    RETURN;
  END IF;
  SELECT starts_on INTO starts FROM curriculum_periods WHERE id = p_period;

  FOR u IN SELECT * FROM units WHERE id = ANY (p_units) LOOP
    CONTINUE WHEN NOT app.can_read_rekap(u.id);
    unit_id := u.id;
    SELECT count(*)::int INTO generus FROM generus g
      WHERE g.unit_path <@ u.path
        AND (p_jenjang IS NULL OR g.jenjang_id = p_jenjang)
        AND (g.status = 'aktif' OR g.status_date >= starts);
    SELECT count(*)::int, count(*) FILTER (WHERE x.done)::int, count(*) FILTER (WHERE x.prog)::int
      INTO slots, tuntas, proses
      FROM app.capaian_pairs(p_period, p_jenjang, u.path) x;
    SELECT count(*)::int INTO kelompok FROM units k WHERE k.level = 'kelompok' AND k.path <@ u.path;
    SELECT count(d.target_id)::int, count(*)::int INTO delivered, deliverable
      FROM units k
      CROSS JOIN period_targets t
      JOIN materi m ON m.id = t.materi_id AND m.assessment = 'kelompok'
      LEFT JOIN target_deliveries d ON d.target_id = t.id AND d.kelompok_id = k.id
      WHERE k.level = 'kelompok' AND k.path <@ u.path
        AND t.period_id = p_period AND (p_jenjang IS NULL OR t.jenjang_id = p_jenjang) AND NOT t.optional;
    RETURN NEXT;
  END LOOP;
END;
$$;--> statement-breakpoint

-- Rekap per target di bawah satu unit.
CREATE FUNCTION app.capaian_rekap_targets(p_period uuid, p_jenjang uuid, p_unit uuid)
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
  SELECT path INTO upath FROM units WHERE id = p_unit;
  RETURN QUERY
    WITH pairs AS (SELECT * FROM app.capaian_pairs(p_period, p_jenjang, upath)),
    kel AS (SELECT k.id FROM units k WHERE k.level = 'kelompok' AND k.path <@ upath)
    SELECT t.id,
      (SELECT count(*)::int FROM pairs x WHERE x.target_id = t.id),
      (SELECT count(*)::int FROM pairs x WHERE x.target_id = t.id AND x.done),
      (SELECT count(*)::int FROM pairs x WHERE x.target_id = t.id AND x.prog),
      (SELECT count(*)::int FROM target_deliveries d WHERE d.target_id = t.id AND d.kelompok_id IN (SELECT id FROM kel)),
      (SELECT count(*)::int FROM kel)
    FROM period_targets t
    JOIN curriculum_periods p ON p.id = t.period_id
    WHERE t.period_id = p_period
      AND (p_jenjang IS NULL OR t.jenjang_id = p_jenjang)
      AND (p.published_at IS NOT NULL OR app.is_curriculum_editor());
END;
$$;--> statement-breakpoint

GRANT EXECUTE ON FUNCTION app.can_read_rekap(uuid), app.capaian_rekap_units(uuid, uuid, uuid[]),
  app.capaian_rekap_targets(uuid, uuid, uuid) TO authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app.capaian_pairs(uuid, uuid, ltree) FROM PUBLIC;
