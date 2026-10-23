-- API untuk aplikasi Android (generus-mobile). Aplikasi memakai Supabase Auth +
-- PostgREST langsung, jadi query gabungan yang di PWA ditulis di server
-- (src/lib/*.ts) disediakan di sini sebagai fungsi RPC `public.mobile_*`.
--
-- Konvensi:
-- - SECURITY INVOKER (bawaan): RLS & trigger berlaku persis seperti lewat PWA.
--   Fungsi app.* (SECURITY DEFINER) dipanggil seperti di PWA.
-- - Hasil berupa jsonb/tabel dengan kunci snake_case. Hasil yang bisa > 1.000 baris
--   dikembalikan sebagai satu nilai jsonb agar tidak terpotong batas baris PostgREST.
-- - Hanya untuk role `authenticated`; anon tidak boleh memanggil.
-- - Tulis sederhana (insert/update/delete satu tabel) tetap lewat PostgREST.

-- ---------------------------------------------------------------------------
-- Akun & sesi
-- ---------------------------------------------------------------------------

-- Profil + peran user yang login (padanan getCurrentUser di src/lib/auth.ts).
CREATE FUNCTION public.mobile_me()
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'email', p.email,
    'active', p.active,
    'must_change_password', p.must_change_password,
    'roles', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', ur.id, 'role', ur.role, 'unit_id', u.id, 'unit_name', u.name, 'level', u.level) ORDER BY u.path)
      FROM user_roles ur JOIN units u ON u.id = ur.unit_id
      WHERE ur.user_id = p.id), '[]'::jsonb)
  )
  FROM profiles p
  WHERE p.id = auth.uid();
$$;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Beranda
-- ---------------------------------------------------------------------------

-- Agenda berlangsung/berikutnya, ringkasan bulan berjalan, jumlah generus aktif,
-- dan tugas scan (padanan getBerandaSummary + listMyScanTasks di src/lib/agenda.ts).
CREATE FUNCTION public.mobile_beranda(p_tz text DEFAULT 'Asia/Jakarta')
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  WITH mb AS (
    SELECT (date_trunc('month', now() AT TIME ZONE p_tz) AT TIME ZONE p_tz) AS m_from,
           ((date_trunc('month', now() AT TIME ZONE p_tz) + interval '1 month') AT TIME ZONE p_tz) AS m_to
  )
  SELECT jsonb_build_object(
    'hero', (
      SELECT jsonb_build_object(
        'id', a.id, 'title', a.title, 'location', a.location,
        'starts_at', a.starts_at, 'ends_at', a.ends_at,
        'unit_name', u.name, 'level', u.level,
        'targets', (SELECT count(*) FROM generus g WHERE app.agenda_is_target(a, g)),
        'present', (SELECT count(*) FROM attendance at WHERE at.agenda_id = a.id AND at.status IN ('hadir', 'terlambat')),
        'can_manage', app.can_manage_agenda(a.id),
        'is_scanner', app.is_agenda_scanner(a.id))
      FROM agendas a JOIN units u ON u.id = a.unit_id
      WHERE a.cancelled_at IS NULL AND a.ends_at >= now()
      ORDER BY a.starts_at
      LIMIT 1),
    'month', (
      SELECT jsonb_build_object(
        'agendas', count(DISTINCT a.id),
        'locked', count(DISTINCT a.id) FILTER (WHERE a.locked_at IS NOT NULL),
        'present', count(at.*) FILTER (WHERE a.locked_at IS NOT NULL AND at.status IN ('hadir', 'terlambat')),
        'total', count(at.*) FILTER (WHERE a.locked_at IS NOT NULL))
      FROM mb
      JOIN agendas a ON a.starts_at >= mb.m_from AND a.starts_at < mb.m_to AND a.cancelled_at IS NULL
      LEFT JOIN attendance at ON at.agenda_id = a.id),
    -- Generus dengan 3 agenda terkunci terakhirnya berstatus alpa (PRD F-43).
    'alpa_streak', (
      SELECT count(*) FROM (
        SELECT x.generus_id
        FROM (
          SELECT at.generus_id, at.status,
                 row_number() OVER (PARTITION BY at.generus_id ORDER BY a.starts_at DESC) AS rn
          FROM attendance at JOIN agendas a ON a.id = at.agenda_id
          WHERE a.locked_at IS NOT NULL AND a.cancelled_at IS NULL
        ) x
        WHERE x.rn <= 3
        GROUP BY x.generus_id
        HAVING count(*) = 3 AND bool_and(x.status = 'alpa')
      ) s),
    'counts', (
      SELECT jsonb_build_object(
        'total', count(*),
        'pra_remaja', count(*) FILTER (WHERE j.name = 'Pra Remaja'),
        'remaja', count(*) FILTER (WHERE j.name = 'Remaja'))
      FROM generus g JOIN jenjang j ON j.id = g.jenjang_id
      WHERE g.status = 'aktif'),
    'scan_tasks', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'starts_at', a.starts_at, 'unit_name', u.name) ORDER BY a.starts_at)
      FROM agenda_scanners s
      JOIN agendas a ON a.id = s.agenda_id
      JOIN units u ON u.id = a.unit_id
      WHERE s.user_id = auth.uid() AND s.expires_at > now() AND a.cancelled_at IS NULL AND a.locked_at IS NULL), '[]'::jsonb)
  );
$$;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Agenda & presensi
-- ---------------------------------------------------------------------------

-- Kunci agenda yang sudah lewat batas (idempoten).
CREATE FUNCTION public.mobile_lock_due_agendas()
RETURNS void
LANGUAGE sql
SET search_path = public, extensions
AS $$
  SELECT app.lock_due_agendas();
$$;--> statement-breakpoint

-- Daftar agenda: 'mendatang' (urut terdekat) atau 'selesai' (urut terbaru).
CREATE FUNCTION public.mobile_agendas(p_range text, p_page int DEFAULT 1, p_page_size int DEFAULT 30)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  WITH r AS (
    SELECT a.id, a.title, a.location, a.starts_at, a.ends_at, u.name AS unit_name, u.level, a.locked_at, a.cancelled_at,
           row_number() OVER (ORDER BY
             CASE WHEN p_range = 'selesai' THEN NULL ELSE a.starts_at END ASC,
             CASE WHEN p_range = 'selesai' THEN a.starts_at END DESC,
             a.id) AS rn
    FROM agendas a JOIN units u ON u.id = a.unit_id
    WHERE CASE WHEN p_range = 'selesai' THEN a.ends_at < now() ELSE a.ends_at >= now() END
  ), page AS (
    SELECT * FROM r
    WHERE rn > (greatest(p_page, 1) - 1) * p_page_size AND rn <= greatest(p_page, 1) * p_page_size + 1
  )
  SELECT jsonb_build_object(
    'rows', coalesce((SELECT jsonb_agg(to_jsonb(x) - 'rn' ORDER BY x.rn) FROM page x WHERE x.rn <= greatest(p_page, 1) * p_page_size), '[]'::jsonb),
    'has_more', EXISTS (SELECT 1 FROM page x WHERE x.rn > greatest(p_page, 1) * p_page_size)
  );
$$;--> statement-breakpoint

-- Detail agenda + peserta sasaran yang terlihat user beserta presensinya
-- (padanan getAgenda + getRoster + listScanners). Null bila agenda tidak terlihat.
CREATE FUNCTION public.mobile_agenda(p_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT jsonb_build_object(
    'id', a.id, 'title', a.title, 'location', a.location,
    'starts_at', a.starts_at, 'ends_at', a.ends_at, 'late_after', a.late_after, 'delegate_until', a.delegate_until,
    'locked_at', a.locked_at, 'cancelled_at', a.cancelled_at,
    'unit_id', a.unit_id, 'unit_name', u.name, 'level', u.level,
    'target_jenjang_ids', to_jsonb(a.target_jenjang_ids), 'target_kategori_ids', to_jsonb(a.target_kategori_ids),
    'target_gender', a.target_gender, 'recurrence_id', a.recurrence_id,
    'can_manage', (SELECT app.scope_paths(ARRAY['superadmin', 'admin']::app_role[])) @> a.unit_path,
    'is_scanner', app.is_agenda_scanner(a.id),
    'roster', coalesce((
      SELECT jsonb_agg(r ORDER BY r.desa, r.kelompok, r.name)
      FROM (
        SELECT g.id AS generus_id, g.name, g.gender, k.name AS kelompok, d.name AS desa,
               at.status, at.method, at.recorded_at, app.can_write_attendance(a.id, g.id) AS can_write
        FROM generus g
        JOIN units k ON k.id = g.kelompok_id
        JOIN units d ON d.id = k.parent_id
        LEFT JOIN attendance at ON at.agenda_id = a.id AND at.generus_id = g.id
        WHERE app.agenda_is_target(a, g)
        UNION ALL
        -- Presensi tersimpan untuk generus yang kini bukan sasaran (mis. agenda diubah).
        SELECT g.id, g.name, g.gender, k.name, d.name, at.status, at.method, at.recorded_at,
               app.can_write_attendance(a.id, g.id)
        FROM attendance at
        JOIN generus g ON g.id = at.generus_id
        JOIN units k ON k.id = g.kelompok_id
        JOIN units d ON d.id = k.parent_id
        WHERE at.agenda_id = a.id AND NOT app.agenda_is_target(a, g)
      ) r), '[]'::jsonb),
    'scanners', coalesce((
      SELECT jsonb_agg(jsonb_build_object('user_id', s.user_id, 'name', p.name, 'email', p.email, 'expires_at', s.expires_at) ORDER BY p.name)
      FROM agenda_scanners s JOIN profiles p ON p.id = s.user_id
      WHERE s.agenda_id = a.id), '[]'::jsonb)
  )
  FROM agendas a JOIN units u ON u.id = a.unit_id
  WHERE a.id = p_id;
$$;--> statement-breakpoint

-- Simpan presensi (antrian offline). Entri: {generus_id, status, mode}.
-- mode set = checklist (menimpa); scan/search = pemindai (catatan pertama menang).
-- Mengembalikan jumlah entri yang diproses (padanan saveAttendance).
CREATE FUNCTION public.mobile_save_attendance(p_agenda uuid, p_entries jsonb)
RETURNS int
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  manage boolean;
BEGIN
  IF jsonb_typeof(p_entries) <> 'array' OR jsonb_array_length(p_entries) = 0 THEN
    RAISE EXCEPTION 'Belum ada perubahan untuk disimpan';
  END IF;
  IF jsonb_array_length(p_entries) > 2000 THEN
    RAISE EXCEPTION 'Terlalu banyak data dalam satu kiriman';
  END IF;
  SELECT app.can_manage_agenda(a.id) INTO manage FROM agendas a WHERE a.id = p_agenda;

  INSERT INTO attendance (agenda_id, generus_id, status, method)
  SELECT p_agenda, (e->>'generus_id')::uuid, (e->>'status')::attendance_status,
         CASE WHEN coalesce(manage, false) THEN 'manual' ELSE 'delegasi' END::attendance_method
  FROM jsonb_array_elements(p_entries) e
  WHERE coalesce(e->>'mode', 'set') = 'set'
  ON CONFLICT (agenda_id, generus_id) DO UPDATE SET status = excluded.status, method = excluded.method;

  -- Beberapa petugas bisa memindai orang yang sama: catatan pertama dipertahankan.
  INSERT INTO attendance (agenda_id, generus_id, status, method)
  SELECT p_agenda, (e->>'generus_id')::uuid, (e->>'status')::attendance_status, (e->>'mode')::attendance_method
  FROM jsonb_array_elements(p_entries) e
  WHERE e->>'mode' IN ('scan', 'search')
  ON CONFLICT (agenda_id, generus_id) DO NOTHING;

  RETURN jsonb_array_length(p_entries);
END;
$$;--> statement-breakpoint

-- Roster pemindai (hash isi QR, bukan token) + data agenda untuk disimpan di perangkat.
CREATE FUNCTION public.mobile_agenda_roster(p_agenda uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SET search_path = public, extensions
AS $$
DECLARE
  head jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', a.id, 'title', a.title, 'unit_name', u.name, 'level', u.level,
    'starts_at', a.starts_at, 'ends_at', a.ends_at, 'late_after', a.late_after,
    'locked_at', a.locked_at, 'cancelled_at', a.cancelled_at)
  INTO head
  FROM agendas a JOIN units u ON u.id = a.unit_id
  WHERE a.id = p_agenda;
  IF head IS NULL THEN
    RAISE EXCEPTION 'Agenda tidak ditemukan atau Anda tidak punya akses.';
  END IF;
  RETURN jsonb_build_object(
    'agenda', head,
    'rows', coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM app.agenda_roster(p_agenda) r), '[]'::jsonb));
END;
$$;--> statement-breakpoint

CREATE FUNCTION public.mobile_lock_agenda(p_id uuid)
RETURNS void
LANGUAGE sql
SET search_path = public, extensions
AS $$
  SELECT app.lock_agenda(p_id);
$$;--> statement-breakpoint

-- Unit tempat user boleh membuat agenda (admin/superadmin), urut hierarki.
CREATE FUNCTION public.mobile_agenda_units()
RETURNS TABLE (id uuid, name text, level unit_level, parent_name text)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT u.id, u.name, u.level, p.name
  FROM units u LEFT JOIN units p ON p.id = u.parent_id
  WHERE u.path <@ (SELECT app.scope_paths(ARRAY['superadmin', 'admin']::app_role[]))
  ORDER BY u.level, coalesce(p.name, ''), u.name;
$$;--> statement-breakpoint

-- Batalkan satu agenda, atau agenda ini dan pekan-pekan berikutnya dalam satu seri.
CREATE FUNCTION public.mobile_cancel_agenda(p_id uuid, p_series boolean DEFAULT false)
RETURNS int
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  a agendas%ROWTYPE;
  n int;
BEGIN
  SELECT * INTO a FROM agendas WHERE id = p_id;
  IF a.id IS NULL THEN
    RAISE EXCEPTION 'Agenda tidak ditemukan';
  END IF;
  IF p_series AND a.recurrence_id IS NOT NULL THEN
    UPDATE agendas SET cancelled_at = now()
    WHERE recurrence_id = a.recurrence_id AND starts_at >= a.starts_at AND locked_at IS NULL AND cancelled_at IS NULL;
  ELSE
    UPDATE agendas SET cancelled_at = now() WHERE id = p_id AND cancelled_at IS NULL;
  END IF;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;--> statement-breakpoint

-- Riwayat presensi satu generus + statistik agenda terkunci.
CREATE FUNCTION public.mobile_generus_attendance(p_generus uuid, p_limit int DEFAULT 20)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT jsonb_build_object(
    'rows', coalesce((
      SELECT jsonb_agg(r ORDER BY r.starts_at DESC)
      FROM (
        SELECT a.id AS agenda_id, a.title, a.starts_at, u.name AS unit_name, at.status
        FROM attendance at
        JOIN agendas a ON a.id = at.agenda_id
        JOIN units u ON u.id = a.unit_id
        WHERE at.generus_id = p_generus AND a.cancelled_at IS NULL
        ORDER BY a.starts_at DESC
        LIMIT p_limit
      ) r), '[]'::jsonb),
    'stats', (
      SELECT jsonb_build_object(
        'total', count(*),
        'hadir', count(*) FILTER (WHERE at.status IN ('hadir', 'terlambat')),
        'alpa', count(*) FILTER (WHERE at.status = 'alpa'))
      FROM attendance at JOIN agendas a ON a.id = at.agenda_id
      WHERE at.generus_id = p_generus AND a.cancelled_at IS NULL AND a.locked_at IS NOT NULL)
  );
$$;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Generus
-- ---------------------------------------------------------------------------

-- Daftar generus dengan filter & halaman (padanan listGenerus).
-- p_status: aktif | pindah_sambung | menikah | semua. p_kategori hanya bersama p_jenjang.
CREATE FUNCTION public.mobile_generus_list(
  p_q text DEFAULT NULL,
  p_unit uuid DEFAULT NULL,
  p_jenjang text DEFAULT NULL,
  p_kategori text DEFAULT NULL,
  p_status text DEFAULT 'aktif',
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 50
)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  WITH f AS (
    SELECT g.id, g.name, g.gender, g.birth_date, j.name AS jenjang, k.name AS kategori,
           ku.name AS kelompok, du.name AS desa, g.status
    FROM generus g
    JOIN jenjang j ON j.id = g.jenjang_id
    LEFT JOIN jenjang_kategori k ON k.id = g.kategori_id
    JOIN units ku ON ku.id = g.kelompok_id
    JOIN units du ON du.id = ku.parent_id
    WHERE (coalesce(p_status, 'aktif') = 'semua' OR g.status::text = coalesce(p_status, 'aktif'))
      AND (nullif(trim(p_q), '') IS NULL OR g.name ILIKE '%' || trim(p_q) || '%')
      AND (p_unit IS NULL OR g.unit_path <@ (SELECT path FROM units WHERE id = p_unit))
      AND (p_jenjang IS NULL OR j.name = p_jenjang)
      AND (p_kategori IS NULL OR k.name = p_kategori)
  )
  SELECT jsonb_build_object(
    'rows', coalesce((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.name, x.id)
      FROM (SELECT * FROM f ORDER BY name, id LIMIT p_page_size OFFSET (greatest(p_page, 1) - 1) * p_page_size) x), '[]'::jsonb),
    'total', (SELECT count(*) FROM f)
  );
$$;--> statement-breakpoint

-- Kelompok/desa dalam lingkup (padanan listScopeUnits):
-- read = filter daftar; write = tujuan generus baru; mutate = tujuan mutasi.
CREATE FUNCTION public.mobile_scope_units(p_scope text)
RETURNS TABLE (id uuid, name text, level unit_level, desa_name text)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT u.id, u.name, u.level, CASE WHEN u.level = 'desa' THEN u.name ELSE p.name END
  FROM units u LEFT JOIN units p ON p.id = u.parent_id
  WHERE CASE WHEN p_scope = 'read' THEN u.level IN ('desa', 'kelompok') ELSE u.level = 'kelompok' END
    AND CASE p_scope
      WHEN 'read' THEN u.path <@ (SELECT app.scope_paths(ARRAY['superadmin', 'admin', 'kyai']::app_role[]))
      WHEN 'write' THEN u.path <@ (SELECT app.scope_paths(ARRAY['superadmin', 'admin']::app_role[]))
      WHEN 'mutate' THEN EXISTS (
        SELECT 1 FROM user_roles ur JOIN units s ON s.id = ur.unit_id
        WHERE ur.user_id = auth.uid()
          AND (ur.role = 'superadmin' OR (ur.role = 'admin' AND s.level <> 'kelompok'))
          AND u.path <@ s.path)
      ELSE false
    END
  ORDER BY 4, 3, 2;
$$;--> statement-breakpoint

-- Detail generus + riwayat mutasi/status (padanan getGenerus). Token QR hanya
-- disertakan untuk admin/superadmin yang lingkupnya mencakup generus.
CREATE FUNCTION public.mobile_generus_detail(p_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT jsonb_build_object(
    'id', g.id, 'name', g.name, 'gender', g.gender, 'birth_date', g.birth_date,
    'jenjang_id', g.jenjang_id, 'jenjang', j.name, 'kategori_id', g.kategori_id, 'kategori', k.name,
    'kelompok_id', g.kelompok_id, 'kelompok', ku.name, 'desa', du.name,
    'daerah', (SELECT d.name FROM units d WHERE d.path = subpath(ku.path, 0, 1)),
    'school', g.school, 'guardian_name', g.guardian_name, 'guardian_phone', g.guardian_phone, 'notes', g.notes,
    'status', g.status, 'status_date', g.status_date, 'status_note', g.status_note, 'qr_active', g.qr_active,
    'qr_token', CASE WHEN app.has_role_in(g.unit_path, ARRAY['superadmin', 'admin']::app_role[]) THEN g.qr_token END,
    'can_write', app.has_role_in(g.unit_path, ARRAY['superadmin', 'admin']::app_role[]),
    'mutations', coalesce((
      SELECT jsonb_agg(jsonb_build_object('at', m.mutated_at, 'from', fu.name, 'to', tu.name) ORDER BY m.mutated_at DESC)
      FROM generus_mutations m
      JOIN units fu ON fu.id = m.from_unit_id
      JOIN units tu ON tu.id = m.to_unit_id
      WHERE m.generus_id = g.id), '[]'::jsonb),
    'statuses', coalesce((
      SELECT jsonb_agg(jsonb_build_object('at', h.changed_at, 'to', h.to_status, 'date', h.status_date, 'note', h.note) ORDER BY h.changed_at DESC)
      FROM generus_status_history h
      WHERE h.generus_id = g.id), '[]'::jsonb)
  )
  FROM generus g
  JOIN jenjang j ON j.id = g.jenjang_id
  LEFT JOIN jenjang_kategori k ON k.id = g.kategori_id
  JOIN units ku ON ku.id = g.kelompok_id
  JOIN units du ON du.id = ku.parent_id
  WHERE g.id = p_id;
$$;--> statement-breakpoint

-- Terbitkan kartu baru: token QR diganti sehingga kartu lama tidak berlaku.
CREATE FUNCTION public.mobile_reissue_card(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE generus SET qr_token = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)) WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Anda tidak punya akses untuk generus ini.';
  END IF;
END;
$$;--> statement-breakpoint

-- Data kartu QR untuk dicetak: per unit (desa/kelompok) atau daftar id. Maks 600.
CREATE FUNCTION public.mobile_kartu(p_unit uuid DEFAULT NULL, p_ids uuid[] DEFAULT NULL)
RETURNS TABLE (id uuid, name text, token text, gender gender, kelompok text, desa text, daerah text, jenjang text, kategori text)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT g.id, g.name, g.qr_token, g.gender, ku.name, du.name,
         (SELECT d.name FROM units d WHERE d.path = subpath(ku.path, 0, 1)),
         j.name, k.name
  FROM generus g
  JOIN units ku ON ku.id = g.kelompok_id
  JOIN units du ON du.id = ku.parent_id
  JOIN jenjang j ON j.id = g.jenjang_id
  LEFT JOIN jenjang_kategori k ON k.id = g.kategori_id
  WHERE g.status = 'aktif' AND g.qr_active
    AND app.has_role_in(g.unit_path, ARRAY['superadmin', 'admin']::app_role[])
    AND CASE
      WHEN p_ids IS NOT NULL THEN g.id = ANY (p_ids)
      WHEN p_unit IS NOT NULL THEN g.unit_path <@ (SELECT x.path FROM units x WHERE x.id = p_unit)
      ELSE false
    END
  ORDER BY ku.name, g.name
  LIMIT 600;
$$;--> statement-breakpoint

-- Kandidat kenaikan jenjang (padanan listPromotionCandidates). Maks 500.
CREATE FUNCTION public.mobile_promotion_candidates(p_jenjang text, p_kategori text, p_unit uuid)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  WITH c AS (
    SELECT g.id, g.name, g.gender, g.birth_date, g.school, ku.name AS kelompok
    FROM generus g
    JOIN jenjang j ON j.id = g.jenjang_id
    LEFT JOIN jenjang_kategori k ON k.id = g.kategori_id
    JOIN units ku ON ku.id = g.kelompok_id
    WHERE g.status = 'aktif'
      AND j.name = p_jenjang
      AND CASE WHEN p_kategori IS NULL THEN g.kategori_id IS NULL ELSE k.name = p_kategori END
      AND g.unit_path <@ (SELECT x.path FROM units x WHERE x.id = p_unit)
    ORDER BY ku.name, g.birth_date, g.name
    LIMIT 501
  )
  SELECT jsonb_build_object(
    'rows', coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM c ORDER BY kelompok, birth_date, name LIMIT 500) x), '[]'::jsonb),
    'truncated', (SELECT count(*) > 500 FROM c)
  );
$$;--> statement-breakpoint

-- Naikkan jenjang/kategori massal. Hanya generus aktif yang masih di jenjang asal
-- yang diubah, sehingga pengiriman ganda aman. Mengembalikan jumlah yang diubah.
CREATE FUNCTION public.mobile_promote(
  p_from_jenjang text, p_from_kategori text, p_to_jenjang text, p_to_kategori text, p_ids uuid[]
)
RETURNS int
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  from_j uuid; from_k uuid; to_j uuid; to_k uuid;
  n int;
BEGIN
  IF coalesce(array_length(p_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Centang minimal satu generus';
  END IF;
  IF array_length(p_ids, 1) > 500 THEN
    RAISE EXCEPTION 'Maksimal 500 generus sekali proses';
  END IF;
  SELECT j.id INTO from_j FROM jenjang j WHERE j.name = p_from_jenjang;
  SELECT j.id INTO to_j FROM jenjang j WHERE j.name = p_to_jenjang;
  IF from_j IS NULL OR to_j IS NULL THEN
    RAISE EXCEPTION 'Jenjang tidak ditemukan';
  END IF;
  IF p_from_kategori IS NOT NULL THEN
    SELECT k.id INTO from_k FROM jenjang_kategori k WHERE k.jenjang_id = from_j AND k.name = p_from_kategori;
    IF from_k IS NULL THEN RAISE EXCEPTION 'Kategori % tidak ditemukan', p_from_kategori; END IF;
  END IF;
  IF p_to_kategori IS NOT NULL THEN
    SELECT k.id INTO to_k FROM jenjang_kategori k WHERE k.jenjang_id = to_j AND k.name = p_to_kategori;
    IF to_k IS NULL THEN RAISE EXCEPTION 'Kategori % tidak ditemukan', p_to_kategori; END IF;
  END IF;
  UPDATE generus g SET jenjang_id = to_j, kategori_id = to_k
  WHERE g.id = ANY (p_ids) AND g.status = 'aktif' AND g.jenjang_id = from_j
    AND g.kategori_id IS NOT DISTINCT FROM from_k;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Kurikulum
-- ---------------------------------------------------------------------------

-- Periode terbaru dulu + jumlah target. Draf hanya terlihat oleh penyusun (RLS).
CREATE FUNCTION public.mobile_periods()
RETURNS TABLE (id uuid, name text, semester text, starts_on date, ends_on date, published_at timestamptz, target_count int)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT p.id, p.name, p.semester, p.starts_on, p.ends_on, p.published_at,
         (SELECT count(*)::int FROM period_targets pt WHERE pt.period_id = p.id)
  FROM curriculum_periods p
  ORDER BY p.starts_on DESC;
$$;--> statement-breakpoint

-- Buat periode, opsional menyalin semua target dari periode lain. Mengembalikan id baru.
CREATE FUNCTION public.mobile_create_period(
  p_name text, p_semester text, p_starts_on date, p_ends_on date, p_copy_from uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO curriculum_periods (name, semester, starts_on, ends_on, created_by)
  VALUES (p_name, p_semester, p_starts_on, p_ends_on, auth.uid())
  RETURNING id INTO new_id;
  IF p_copy_from IS NOT NULL THEN
    INSERT INTO period_targets (period_id, jenjang_id, kategori_id, gender, sort_order, aspek, mapel,
      materi_id, kitab_id, range_from, range_to, note, strategy, optional)
    SELECT new_id, t.jenjang_id, t.kategori_id, t.gender, t.sort_order, t.aspek, t.mapel,
      t.materi_id, t.kitab_id, t.range_from, t.range_to, t.note, t.strategy, t.optional
    FROM period_targets t WHERE t.period_id = p_copy_from;
  END IF;
  RETURN new_id;
END;
$$;--> statement-breakpoint

-- Target satu periode untuk satu jenjang (padanan listTargets). Pengurutan per
-- aspek dilakukan di aplikasi.
CREATE FUNCTION public.mobile_targets(p_period uuid, p_jenjang uuid)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id, 'period_id', t.period_id, 'jenjang_id', t.jenjang_id, 'kategori_id', t.kategori_id, 'kategori_name', jk.name,
    'gender', t.gender, 'sort_order', t.sort_order, 'aspek', t.aspek, 'mapel', t.mapel,
    'note', t.note, 'strategy', t.strategy, 'optional', t.optional,
    'materi', CASE WHEN m.id IS NOT NULL THEN jsonb_build_object(
      'id', m.id, 'title', m.title, 'body', m.body, 'arabic', m.arabic, 'translation', m.translation,
      'source', m.source, 'assessment', m.assessment) END,
    'kitab', CASE WHEN k.id IS NOT NULL AND t.range_from IS NOT NULL THEN jsonb_build_object(
      'id', k.id, 'title', k.title, 'unit', k.unit, 'total', k.total, 'from', t.range_from, 'to', t.range_to) END
  ) ORDER BY t.sort_order, t.created_at), '[]'::jsonb)
  FROM period_targets t
  LEFT JOIN jenjang_kategori jk ON jk.id = t.kategori_id
  LEFT JOIN materi m ON m.id = t.materi_id
  LEFT JOIN kitab k ON k.id = t.kitab_id
  WHERE t.period_id = p_period AND t.jenjang_id = p_jenjang;
$$;--> statement-breakpoint

-- Pustaka materi + jumlah pemakaian di target.
CREATE FUNCTION public.mobile_materi(p_q text DEFAULT NULL, p_aspek aspek DEFAULT NULL, p_archived boolean DEFAULT false)
RETURNS TABLE (
  id uuid, aspek aspek, mapel text, title text, body text, arabic text, translation text, source text,
  assessment assessment_mode, archived boolean, used_in int
)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT m.id, m.aspek, m.mapel, m.title, m.body, m.arabic, m.translation, m.source, m.assessment, m.archived,
         (SELECT count(*)::int FROM period_targets pt WHERE pt.materi_id = m.id)
  FROM materi m
  WHERE m.archived = coalesce(p_archived, false)
    AND (p_aspek IS NULL OR m.aspek = p_aspek)
    AND (nullif(trim(p_q), '') IS NULL OR m.title ILIKE '%' || trim(p_q) || '%' OR m.mapel ILIKE '%' || trim(p_q) || '%')
  ORDER BY m.mapel, m.title;
$$;--> statement-breakpoint

-- Lintasan kitab + jumlah pemakaian & posisi akhir terbesar yang dipakai target.
CREATE FUNCTION public.mobile_kitab(p_include_archived boolean DEFAULT false)
RETURNS TABLE (id uuid, title text, unit kitab_unit, total int, sort_order int, archived boolean, used_in int, max_to int)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT k.id, k.title, k.unit, k.total, k.sort_order, k.archived,
         (SELECT count(*)::int FROM period_targets pt WHERE pt.kitab_id = k.id),
         (SELECT coalesce(max(pt.range_to), 0)::int FROM period_targets pt WHERE pt.kitab_id = k.id)
  FROM kitab k
  WHERE coalesce(p_include_archived, false) OR NOT k.archived
  ORDER BY k.sort_order, k.title;
$$;--> statement-breakpoint

-- Nama mapel yang pernah dipakai per aspek (saran isian).
CREATE FUNCTION public.mobile_mapel_names()
RETURNS TABLE (aspek aspek, mapel text)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT DISTINCT x.aspek, x.mapel FROM (
    SELECT m.aspek, m.mapel FROM materi m
    UNION
    SELECT t.aspek, t.mapel FROM period_targets t
  ) x
  ORDER BY 1, 2;
$$;--> statement-breakpoint

-- Geser target naik/turun di dalam aspeknya (padanan moveTarget).
CREATE FUNCTION public.mobile_move_target(p_id uuid, p_up boolean)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  cur period_targets%ROWTYPE;
  ids uuid[];
  aspeks aspek[];
  i int;
  j int;
  tmp uuid;
BEGIN
  SELECT * INTO cur FROM period_targets WHERE id = p_id;
  IF cur.id IS NULL THEN RETURN; END IF;
  SELECT array_agg(x.id ORDER BY array_position(ARRAY['alim', 'faqih', 'akhlaq', 'mandiri']::aspek[], x.aspek), x.sort_order, x.created_at),
         array_agg(x.aspek ORDER BY array_position(ARRAY['alim', 'faqih', 'akhlaq', 'mandiri']::aspek[], x.aspek), x.sort_order, x.created_at)
    INTO ids, aspeks
    FROM period_targets x WHERE x.period_id = cur.period_id AND x.jenjang_id = cur.jenjang_id;
  i := array_position(ids, p_id);
  j := i + CASE WHEN p_up THEN -1 ELSE 1 END;
  IF j < 1 OR j > array_length(ids, 1) OR aspeks[j] <> aspeks[i] THEN RETURN; END IF;
  tmp := ids[i]; ids[i] := ids[j]; ids[j] := tmp;
  UPDATE period_targets pt SET sort_order = o.n - 1
  FROM unnest(ids) WITH ORDINALITY AS o(tid, n)
  WHERE pt.id = o.tid AND pt.sort_order <> o.n - 1;
END;
$$;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Capaian
-- ---------------------------------------------------------------------------

-- Hitungan capaian per target untuk satu kelompok + tanda penyampaian
-- (padanan getKelompokSummary; daftar target dari mobile_targets).
CREATE FUNCTION public.mobile_kelompok_summary(p_period uuid, p_jenjang uuid, p_kelompok uuid)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT jsonb_build_object(
    'counts', coalesce((
      SELECT jsonb_agg(c) FROM (
        SELECT t.id,
          count(g.id)::int AS total,
          count(g.id) FILTER (WHERE CASE WHEN t.kitab_id IS NULL THEN a.status = 'tuntas' ELSE kp.position >= t.range_to END)::int AS tuntas,
          count(g.id) FILTER (WHERE CASE WHEN t.kitab_id IS NULL THEN a.status = 'proses'
                                         ELSE kp.position >= t.range_from AND kp.position < t.range_to END)::int AS proses
        FROM period_targets t
        JOIN curriculum_periods p ON p.id = t.period_id
        LEFT JOIN generus g ON g.kelompok_id = p_kelompok AND app.target_applies(t, g)
        LEFT JOIN achievements a ON a.target_id = t.id AND a.generus_id = g.id
        LEFT JOIN LATERAL (
          SELECT x.position FROM kitab_progress x
          WHERE x.generus_id = g.id AND x.kitab_id = t.kitab_id AND x.recorded_on <= p.ends_on
          ORDER BY x.recorded_on DESC, x.created_at DESC LIMIT 1
        ) kp ON t.kitab_id IS NOT NULL
        WHERE t.period_id = p_period AND t.jenjang_id = p_jenjang
        GROUP BY t.id) c), '[]'::jsonb),
    'deliveries', coalesce((
      SELECT jsonb_agg(jsonb_build_object('target_id', d.target_id, 'delivered_on', d.delivered_on, 'note', d.note))
      FROM target_deliveries d JOIN period_targets t ON t.id = d.target_id
      WHERE d.kelompok_id = p_kelompok AND t.period_id = p_period), '[]'::jsonb)
  );
$$;--> statement-breakpoint

-- Generus sasaran satu target di satu kelompok + capaian/posisi terakhir (padanan getTargetRoster).
CREATE FUNCTION public.mobile_target_roster(p_target uuid, p_kelompok uuid)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT coalesce(jsonb_agg(r ORDER BY r.name), '[]'::jsonb) FROM (
    SELECT g.id AS generus_id, g.name, g.gender, k.name AS kategori, g.status = 'aktif' AS aktif,
           coalesce(a.status::text, 'belum') AS status, a.note, kp.position, kp.recorded_on
    FROM period_targets t
    JOIN curriculum_periods p ON p.id = t.period_id
    JOIN generus g ON g.kelompok_id = p_kelompok AND app.target_applies(t, g)
    LEFT JOIN jenjang_kategori k ON k.id = g.kategori_id
    LEFT JOIN achievements a ON a.target_id = t.id AND a.generus_id = g.id
    LEFT JOIN LATERAL (
      SELECT x.position, x.recorded_on FROM kitab_progress x
      WHERE x.generus_id = g.id AND x.kitab_id = t.kitab_id AND x.recorded_on <= p.ends_on
      ORDER BY x.recorded_on DESC, x.created_at DESC LIMIT 1
    ) kp ON t.kitab_id IS NOT NULL
    WHERE t.id = p_target
  ) r;
$$;--> statement-breakpoint

-- Capaian satu generus untuk semua target periode yang berlaku baginya (padanan getGenerusCapaian).
CREATE FUNCTION public.mobile_generus_capaian(p_generus uuid, p_period uuid)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT jsonb_build_object(
    'jenjang_id', (SELECT x.jenjang_id FROM generus x WHERE x.id = p_generus),
    'kelompok_id', (SELECT x.kelompok_id FROM generus x WHERE x.id = p_generus),
    'rows', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'target_id', t.id, 'status', coalesce(a.status::text, 'belum'), 'note', a.note,
        'position', kp.position, 'recorded_on', kp.recorded_on, 'delivered_on', d.delivered_on))
      FROM period_targets t
      JOIN curriculum_periods p ON p.id = t.period_id
      JOIN generus g ON g.id = p_generus AND app.target_applies(t, g)
      LEFT JOIN achievements a ON a.target_id = t.id AND a.generus_id = g.id
      LEFT JOIN target_deliveries d ON d.target_id = t.id AND d.kelompok_id = g.kelompok_id
      LEFT JOIN LATERAL (
        SELECT x.position, x.recorded_on FROM kitab_progress x
        WHERE x.generus_id = g.id AND x.kitab_id = t.kitab_id AND x.recorded_on <= p.ends_on
        ORDER BY x.recorded_on DESC, x.created_at DESC LIMIT 1
      ) kp ON t.kitab_id IS NOT NULL
      WHERE t.period_id = p_period), '[]'::jsonb)
  );
$$;--> statement-breakpoint

-- Simpan banyak status capaian sekaligus. Entri: {target_id, generus_id, status};
-- status "belum" menghapus baris. Mengembalikan jumlah entri.
CREATE FUNCTION public.mobile_save_achievements(p_entries jsonb)
RETURNS int
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF jsonb_typeof(p_entries) <> 'array' OR jsonb_array_length(p_entries) = 0 THEN
    RAISE EXCEPTION 'Tidak ada perubahan untuk disimpan.';
  END IF;
  INSERT INTO achievements (target_id, generus_id, status)
  SELECT (e->>'target_id')::uuid, (e->>'generus_id')::uuid, (e->>'status')::achievement_status
  FROM jsonb_array_elements(p_entries) e
  WHERE e->>'status' IN ('proses', 'tuntas')
  ON CONFLICT (target_id, generus_id) DO UPDATE SET status = excluded.status;

  DELETE FROM achievements a
  USING jsonb_array_elements(p_entries) e
  WHERE e->>'status' = 'belum' AND a.target_id = (e->>'target_id')::uuid AND a.generus_id = (e->>'generus_id')::uuid;

  RETURN jsonb_array_length(p_entries);
END;
$$;--> statement-breakpoint

-- Catat posisi kitab yang sama untuk beberapa generus. Satu catatan per generus
-- per tanggal: catatan ulang di hari yang sama menggantikan yang lama.
-- Posisi sudah diurai di aplikasi (surat:ayat → nomor ayat urut).
CREATE FUNCTION public.mobile_save_kitab_progress(p_kitab uuid, p_generus uuid[], p_position int, p_recorded_on date)
RETURNS int
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  k kitab%ROWTYPE;
BEGIN
  IF coalesce(array_length(p_generus, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Pilih minimal satu generus';
  END IF;
  SELECT * INTO k FROM kitab WHERE id = p_kitab;
  IF k.id IS NULL THEN RAISE EXCEPTION 'Kitab tidak ditemukan'; END IF;
  IF p_position < 1 OR p_position > k.total THEN
    RAISE EXCEPTION 'Posisi harus 1–%', k.total;
  END IF;
  DELETE FROM kitab_progress kp
  WHERE kp.kitab_id = p_kitab AND kp.recorded_on = p_recorded_on AND kp.generus_id = ANY (p_generus);
  INSERT INTO kitab_progress (generus_id, kitab_id, position, recorded_on)
  SELECT gid, p_kitab, p_position, p_recorded_on FROM unnest(p_generus) AS gid;
  RETURN array_length(p_generus, 1);
END;
$$;--> statement-breakpoint

-- Rekap lintas unit (agregat; boleh untuk Tim Kurikulum).
CREATE FUNCTION public.mobile_rekap_units(p_period uuid, p_jenjang uuid, p_units uuid[])
RETURNS TABLE (unit_id uuid, generus int, slots int, tuntas int, proses int, kelompok int, delivered int, deliverable int)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT * FROM app.capaian_rekap_units(p_period, p_jenjang, p_units);
$$;--> statement-breakpoint

CREATE FUNCTION public.mobile_rekap_targets(p_period uuid, p_jenjang uuid, p_unit uuid)
RETURNS TABLE (target_id uuid, slots int, tuntas int, proses int, delivered int, kelompok int)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT * FROM app.capaian_rekap_targets(p_period, p_jenjang, p_unit);
$$;--> statement-breakpoint

-- Unit beserta leluhur (breadcrumb) dan anak langsungnya. rel: self | anc | child.
CREATE FUNCTION public.mobile_unit_with_children(p_unit uuid)
RETURNS TABLE (id uuid, name text, level unit_level, parent_id uuid, rel text)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  WITH me AS (SELECT x.path FROM units x WHERE x.id = p_unit)
  SELECT u.id, u.name, u.level, u.parent_id,
    CASE WHEN u.id = p_unit THEN 'self' WHEN u.parent_id = p_unit THEN 'child' ELSE 'anc' END
  FROM units u, me
  WHERE u.id = p_unit OR u.parent_id = p_unit OR me.path <@ u.path
  ORDER BY nlevel(u.path), u.name;
$$;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Laporan
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.mobile_kehadiran_units(p_from timestamptz, p_to timestamptz, p_units uuid[])
RETURNS TABLE (unit_id uuid, generus int, agendas int, total int, hadir int, terlambat int, izin int, sakit int, alpa int)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT * FROM app.kehadiran_rekap_units(p_from, p_to, p_units);
$$;--> statement-breakpoint

CREATE FUNCTION public.mobile_kehadiran_tren(p_unit uuid, p_from timestamptz, p_to timestamptz, p_tz text)
RETURNS TABLE (bulan date, total int, hadir int)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT * FROM app.kehadiran_tren(p_unit, p_from, p_to, p_tz);
$$;--> statement-breakpoint

-- jsonb (bukan tabel) agar tidak terpotong batas baris PostgREST (bawaan Supabase 1.000).
CREATE FUNCTION public.mobile_laporan_generus(p_from timestamptz, p_to timestamptz, p_unit uuid, p_period uuid)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM app.laporan_generus(p_from, p_to, p_unit, p_period) r;
$$;--> statement-breakpoint

CREATE FUNCTION public.mobile_peringatan_alpa(p_unit uuid)
RETURNS TABLE (generus_id uuid, name text, kelompok text, kelompok_id uuid, last_at timestamptz)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT * FROM app.peringatan_alpa(p_unit);
$$;--> statement-breakpoint

-- Semua kelompok di bawah unit (nama unit boleh dibaca semua akun).
CREATE FUNCTION public.mobile_kelompok_under(p_unit uuid)
RETURNS TABLE (id uuid, name text)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT k.id, k.name FROM units k, units u
  WHERE u.id = p_unit AND k.level = 'kelompok' AND k.path <@ u.path
  ORDER BY k.name;
$$;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Admin: wilayah & akun
-- ---------------------------------------------------------------------------

-- Semua unit + jumlah generus aktif per kelompok (padanan getWilayahTree).
CREATE FUNCTION public.mobile_wilayah()
RETURNS TABLE (id uuid, name text, level unit_level, parent_id uuid, generus_aktif int)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT u.id, u.name, u.level, u.parent_id,
         (SELECT count(*)::int FROM generus g WHERE g.kelompok_id = u.id AND g.status = 'aktif')
  FROM units u
  ORDER BY u.name;
$$;--> statement-breakpoint

-- Daftar akun beserta perannya (lengkap hanya untuk superadmin; RLS).
CREATE FUNCTION public.mobile_accounts(p_q text DEFAULT NULL, p_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'name', p.name, 'email', p.email, 'phone', p.phone, 'active', p.active,
    'must_change_password', p.must_change_password,
    'roles', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', ur.id, 'role', ur.role, 'unit_id', u.id, 'unit_name', u.name, 'level', u.level) ORDER BY u.path)
      FROM user_roles ur JOIN units u ON u.id = ur.unit_id WHERE ur.user_id = p.id), '[]'::jsonb)
  ) ORDER BY p.name), '[]'::jsonb)
  FROM profiles p
  WHERE (p_id IS NULL OR p.id = p_id)
    AND (nullif(trim(p_q), '') IS NULL OR p.name ILIKE '%' || trim(p_q) || '%' OR p.email ILIKE '%' || trim(p_q) || '%');
$$;--> statement-breakpoint

-- Dipakai Edge Function admin-akun untuk memastikan pemanggil superadmin.
CREATE FUNCTION public.mobile_is_superadmin()
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT app.is_superadmin();
$$;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Hak akses: hanya user yang login.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'mobile\_%'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.sig);
  END LOOP;
END;
$$;
