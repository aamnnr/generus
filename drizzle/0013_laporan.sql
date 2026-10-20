-- Fase 5: dashboard & laporan. Agregat presensi dihitung langsung dari agenda
-- yang sudah dikunci (saat dikunci, semua sasaran punya baris presensi), per
-- kelompok sekali lalu dijumlahkan per unit. Materialized view belum dibutuhkan
-- pada skala satu daerah (±5.000 generus); lihat docs/PLAN.md Fase 5.
--
-- Hanya superadmin/admin/kyai dalam lingkup. Tim Kurikulum tidak mengakses presensi.

CREATE FUNCTION app.can_read_laporan(p_unit uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1 FROM units u
    WHERE u.id = p_unit AND app.has_role_in(u.path, ARRAY['superadmin', 'admin', 'kyai']::app_role[])
  );
$$;--> statement-breakpoint

-- capaian_pairs kini juga mengembalikan generus_id (untuk laporan per generus).
DROP FUNCTION app.capaian_pairs(uuid, uuid, ltree);--> statement-breakpoint
CREATE FUNCTION app.capaian_pairs(p_period uuid, p_jenjang uuid, p_path ltree)
RETURNS TABLE (target_id uuid, generus_id uuid, unit_path ltree, done boolean, prog boolean)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT t.id, g.id, g.unit_path,
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
REVOKE EXECUTE ON FUNCTION app.capaian_pairs(uuid, uuid, ltree) FROM PUBLIC;--> statement-breakpoint

-- Rekap presensi per unit untuk agenda terkunci yang dimulai dalam [p_from, p_to).
-- Presensi dihitung ke kelompok generus saat ini.
CREATE FUNCTION app.kehadiran_rekap_units(p_from timestamptz, p_to timestamptz, p_units uuid[])
RETURNS TABLE (
  unit_id uuid, generus int, agendas int, total int,
  hadir int, terlambat int, izin int, sakit int, alpa int
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
#variable_conflict use_column
DECLARE
  root ltree;
  n_paths int;
BEGIN
  SELECT count(*), CASE WHEN count(*) = 1 THEN (array_agg(u.path))[1] ELSE lca(array_agg(u.path)) END
    INTO n_paths, root
    FROM units u WHERE u.id = ANY (p_units);
  IF n_paths = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH att AS (
    SELECT g.unit_path, at.agenda_id, at.status
    FROM attendance at
    JOIN agendas a ON a.id = at.agenda_id
    JOIN generus g ON g.id = at.generus_id
    WHERE a.locked_at IS NOT NULL AND a.cancelled_at IS NULL
      AND a.starts_at >= p_from AND a.starts_at < p_to
      AND g.unit_path <@ root
  ),
  perk AS (
    SELECT att.unit_path, count(*) AS total,
      count(*) FILTER (WHERE att.status = 'hadir') AS hadir,
      count(*) FILTER (WHERE att.status = 'terlambat') AS terlambat,
      count(*) FILTER (WHERE att.status = 'izin') AS izin,
      count(*) FILTER (WHERE att.status = 'sakit') AS sakit,
      count(*) FILTER (WHERE att.status = 'alpa') AS alpa
    FROM att GROUP BY att.unit_path
  ),
  gen AS (
    SELECT g.unit_path, count(*) AS n FROM generus g
    WHERE g.unit_path <@ root AND g.status = 'aktif' GROUP BY g.unit_path
  ),
  kel AS (
    SELECT k.path FROM units k WHERE k.level = 'kelompok' AND k.path <@ root
  )
  SELECT u.id,
    COALESCE(sum(gen.n), 0)::int,
    (SELECT count(DISTINCT att.agenda_id)::int FROM att WHERE att.unit_path <@ u.path),
    COALESCE(sum(perk.total), 0)::int,
    COALESCE(sum(perk.hadir), 0)::int,
    COALESCE(sum(perk.terlambat), 0)::int,
    COALESCE(sum(perk.izin), 0)::int,
    COALESCE(sum(perk.sakit), 0)::int,
    COALESCE(sum(perk.alpa), 0)::int
  FROM units u
  LEFT JOIN kel ON kel.path <@ u.path
  LEFT JOIN perk ON perk.unit_path = kel.path
  LEFT JOIN gen ON gen.unit_path = kel.path
  WHERE u.id = ANY (p_units) AND app.can_read_laporan(u.id)
  GROUP BY u.id, u.path;
END;
$$;--> statement-breakpoint

-- Tren kehadiran bulanan satu unit (bulan menurut zona waktu p_tz).
CREATE FUNCTION app.kehadiran_tren(p_unit uuid, p_from timestamptz, p_to timestamptz, p_tz text)
RETURNS TABLE (bulan date, total int, hadir int)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
#variable_conflict use_column
DECLARE
  upath ltree;
BEGIN
  IF NOT app.can_read_laporan(p_unit) THEN
    RAISE EXCEPTION 'Anda tidak punya akses ke laporan unit ini';
  END IF;
  SELECT u.path INTO upath FROM units u WHERE u.id = p_unit;
  RETURN QUERY
    SELECT date_trunc('month', a.starts_at AT TIME ZONE p_tz)::date,
      count(*)::int,
      count(*) FILTER (WHERE at.status IN ('hadir', 'terlambat'))::int
    FROM attendance at
    JOIN agendas a ON a.id = at.agenda_id
    JOIN generus g ON g.id = at.generus_id
    WHERE a.locked_at IS NOT NULL AND a.cancelled_at IS NULL
      AND a.starts_at >= p_from AND a.starts_at < p_to
      AND g.unit_path <@ upath
    GROUP BY 1 ORDER BY 1;
END;
$$;--> statement-breakpoint

-- Laporan per generus di bawah satu unit: presensi dalam rentang, capaian
-- periode (opsional), dan tanda alpa 3× berturut-turut (3 agenda terkunci terakhir).
-- Generus nonaktif tetap muncul bila punya presensi dalam rentang.
CREATE FUNCTION app.laporan_generus(p_from timestamptz, p_to timestamptz, p_unit uuid, p_period uuid)
RETURNS TABLE (
  generus_id uuid, name text, gender gender, kelompok text, desa text, jenjang text, kategori text,
  status generus_status, total int, hadir int, terlambat int, izin int, sakit int, alpa int,
  cap_slots int, cap_tuntas int, alpa_streak boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
#variable_conflict use_column
DECLARE
  upath ltree;
BEGIN
  IF NOT app.can_read_laporan(p_unit) THEN
    RAISE EXCEPTION 'Anda tidak punya akses ke laporan unit ini';
  END IF;
  SELECT u.path INTO upath FROM units u WHERE u.id = p_unit;
  RETURN QUERY
  WITH att AS (
    SELECT at.generus_id, count(*) AS total,
      count(*) FILTER (WHERE at.status = 'hadir') AS hadir,
      count(*) FILTER (WHERE at.status = 'terlambat') AS terlambat,
      count(*) FILTER (WHERE at.status = 'izin') AS izin,
      count(*) FILTER (WHERE at.status = 'sakit') AS sakit,
      count(*) FILTER (WHERE at.status = 'alpa') AS alpa
    FROM attendance at
    JOIN agendas a ON a.id = at.agenda_id
    JOIN generus g ON g.id = at.generus_id
    WHERE a.locked_at IS NOT NULL AND a.cancelled_at IS NULL
      AND a.starts_at >= p_from AND a.starts_at < p_to
      AND g.unit_path <@ upath
    GROUP BY at.generus_id
  ),
  last3 AS (
    SELECT x.generus_id, bool_and(x.status = 'alpa') AND count(*) = 3 AS streak
    FROM (
      SELECT at.generus_id, at.status,
        row_number() OVER (PARTITION BY at.generus_id ORDER BY a.starts_at DESC) AS rn
      FROM attendance at
      JOIN agendas a ON a.id = at.agenda_id
      JOIN generus g ON g.id = at.generus_id
      WHERE a.locked_at IS NOT NULL AND a.cancelled_at IS NULL AND g.unit_path <@ upath
    ) x WHERE x.rn <= 3
    GROUP BY x.generus_id
  ),
  cap AS (
    SELECT c.generus_id, count(*) AS slots, count(*) FILTER (WHERE c.done) AS tuntas
    FROM app.capaian_pairs(p_period, NULL, upath) c
    WHERE p_period IS NOT NULL
    GROUP BY c.generus_id
  )
  SELECT g.id, g.name, g.gender, k.name, d.name, j.name, jk.name, g.status,
    COALESCE(att.total, 0)::int, COALESCE(att.hadir, 0)::int, COALESCE(att.terlambat, 0)::int,
    COALESCE(att.izin, 0)::int, COALESCE(att.sakit, 0)::int, COALESCE(att.alpa, 0)::int,
    COALESCE(cap.slots, 0)::int, COALESCE(cap.tuntas, 0)::int,
    COALESCE(last3.streak, false) AND g.status = 'aktif'
  FROM generus g
  JOIN units k ON k.id = g.kelompok_id
  JOIN units d ON d.id = k.parent_id
  JOIN jenjang j ON j.id = g.jenjang_id
  LEFT JOIN jenjang_kategori jk ON jk.id = g.kategori_id
  LEFT JOIN att ON att.generus_id = g.id
  LEFT JOIN last3 ON last3.generus_id = g.id
  LEFT JOIN cap ON cap.generus_id = g.id
  WHERE g.unit_path <@ upath AND (g.status = 'aktif' OR att.generus_id IS NOT NULL)
  ORDER BY d.name, k.name, g.name;
END;
$$;--> statement-breakpoint

-- Peringatan: generus aktif yang 3 agenda terkunci terakhirnya alpa.
CREATE FUNCTION app.peringatan_alpa(p_unit uuid)
RETURNS TABLE (generus_id uuid, name text, kelompok text, kelompok_id uuid, last_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
#variable_conflict use_column
DECLARE
  upath ltree;
BEGIN
  IF NOT app.can_read_laporan(p_unit) THEN
    RAISE EXCEPTION 'Anda tidak punya akses ke laporan unit ini';
  END IF;
  SELECT u.path INTO upath FROM units u WHERE u.id = p_unit;
  RETURN QUERY
    SELECT g.id, g.name, k.name, k.id, max(x.starts_at)
    FROM (
      SELECT at.generus_id, at.status, a.starts_at,
        row_number() OVER (PARTITION BY at.generus_id ORDER BY a.starts_at DESC) AS rn
      FROM attendance at
      JOIN agendas a ON a.id = at.agenda_id
      JOIN generus g ON g.id = at.generus_id
      WHERE a.locked_at IS NOT NULL AND a.cancelled_at IS NULL AND g.unit_path <@ upath AND g.status = 'aktif'
    ) x
    JOIN generus g ON g.id = x.generus_id
    JOIN units k ON k.id = g.kelompok_id
    WHERE x.rn <= 3
    GROUP BY g.id, g.name, k.name, k.id
    HAVING count(*) = 3 AND bool_and(x.status = 'alpa')
    ORDER BY k.name, g.name;
END;
$$;--> statement-breakpoint

GRANT EXECUTE ON FUNCTION app.can_read_laporan(uuid),
  app.kehadiran_rekap_units(timestamptz, timestamptz, uuid[]),
  app.kehadiran_tren(uuid, timestamptz, timestamptz, text),
  app.laporan_generus(timestamptz, timestamptz, uuid, uuid),
  app.peringatan_alpa(uuid) TO authenticated;
