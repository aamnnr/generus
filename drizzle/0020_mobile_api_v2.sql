-- API Android mengikuti perubahan PWA sejak 0014:
-- - superadmin sistem (0015/0016): mobile_me menyertakan is_system_admin;
--   mobile_is_superadmin juga benar untuk superadmin sistem tanpa peran daerah.
-- - pengelola agenda per tingkat (0018): can_manage memakai app.can_manage_agenda_at;
--   unit pembuat agenda = unit peran admin sendiri, atau semua unit di bawah superadmin.
-- - halaman agenda (getAgendaSummary/getRoster di src/lib/agenda.ts): ringkasan per
--   kelompok, daftar peserta per kelompok / hasil pencarian.
-- Fungsi lama tetap ada (aplikasi versi lama masih memakainya).

CREATE OR REPLACE FUNCTION public.mobile_me()
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
    'is_system_admin', app.is_system_admin(),
    'roles', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', ur.id, 'role', ur.role, 'unit_id', u.id, 'unit_name', u.name, 'level', u.level) ORDER BY u.path)
      FROM user_roles ur JOIN units u ON u.id = ur.unit_id
      WHERE ur.user_id = p.id), '[]'::jsonb)
  )
  FROM profiles p
  WHERE p.id = auth.uid();
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.mobile_is_superadmin()
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT app.is_superadmin() OR app.is_system_admin();
$$;--> statement-breakpoint

-- Versi lama (dengan seluruh peserta), hanya hak kelola yang disesuaikan.
CREATE OR REPLACE FUNCTION public.mobile_agenda(p_id uuid)
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
    'can_manage', app.can_manage_agenda_at(a.unit_path),
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

-- Detail agenda tanpa daftar nama: ringkasan presensi per kelompok dihitung di
-- database (padanan getAgenda + getAgendaSummary + listScanners). Null bila tidak terlihat.
CREATE FUNCTION public.mobile_agenda_detail(p_id uuid)
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
    'can_manage', app.can_manage_agenda_at(a.unit_path),
    'is_scanner', app.is_agenda_scanner(a.id),
    'summary', coalesce((
      SELECT jsonb_agg(s ORDER BY s.desa, s.kelompok)
      FROM (
        SELECT k.id AS kelompok_id, k.name AS kelompok, d.id AS desa_id, d.name AS desa,
               count(*)::int AS total,
               count(*) FILTER (WHERE p.status = 'hadir')::int AS hadir,
               count(*) FILTER (WHERE p.status = 'terlambat')::int AS terlambat,
               count(*) FILTER (WHERE p.status = 'izin')::int AS izin,
               count(*) FILTER (WHERE p.status = 'sakit')::int AS sakit,
               count(*) FILTER (WHERE p.status = 'alpa')::int AS alpa,
               count(*) FILTER (WHERE p.status IS NULL)::int AS belum
        FROM (
          SELECT g.kelompok_id, at.status
          FROM generus g
          LEFT JOIN attendance at ON at.agenda_id = a.id AND at.generus_id = g.id
          WHERE app.agenda_is_target(a, g)
          UNION ALL
          SELECT g.kelompok_id, at.status
          FROM attendance at JOIN generus g ON g.id = at.generus_id
          WHERE at.agenda_id = a.id AND NOT app.agenda_is_target(a, g)
        ) p
        JOIN units k ON k.id = p.kelompok_id
        JOIN units d ON d.id = k.parent_id
        GROUP BY k.id, k.name, d.id, d.name
      ) s), '[]'::jsonb),
    'scanners', coalesce((
      SELECT jsonb_agg(jsonb_build_object('user_id', s.user_id, 'name', p.name, 'email', p.email, 'expires_at', s.expires_at) ORDER BY p.name)
      FROM agenda_scanners s JOIN profiles p ON p.id = s.user_id
      WHERE s.agenda_id = a.id), '[]'::jsonb)
  )
  FROM agendas a JOIN units u ON u.id = a.unit_id
  WHERE a.id = p_id;
$$;--> statement-breakpoint

-- Peserta agenda beserta presensi & hak tulis, untuk satu kelompok atau hasil
-- pencarian nama (padanan getRoster dengan RosterFilter). Hak tulis dihitung per
-- baris, jadi panggil dengan filter untuk agenda besar.
CREATE FUNCTION public.mobile_agenda_peserta(p_agenda uuid, p_kelompok uuid DEFAULT NULL, p_q text DEFAULT NULL, p_limit int DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.desa, r.kelompok, r.name), '[]'::jsonb)
  FROM (
    SELECT x.*, app.can_write_attendance(p_agenda, x.generus_id) AS can_write
    FROM (
      SELECT g.id AS generus_id, g.name, g.gender, k.name AS kelompok, d.name AS desa,
             at.status, at.method, at.recorded_at
      FROM agendas a
      JOIN generus g ON app.agenda_is_target(a, g)
      JOIN units k ON k.id = g.kelompok_id
      JOIN units d ON d.id = k.parent_id
      LEFT JOIN attendance at ON at.agenda_id = a.id AND at.generus_id = g.id
      WHERE a.id = p_agenda
        AND (p_kelompok IS NULL OR g.kelompok_id = p_kelompok)
        AND (nullif(trim(p_q), '') IS NULL OR g.name ILIKE '%' || trim(p_q) || '%')
      UNION ALL
      -- Presensi tersimpan untuk generus yang kini bukan sasaran (mis. agenda diubah).
      SELECT g.id, g.name, g.gender, k.name, d.name, at.status, at.method, at.recorded_at
      FROM attendance at
      JOIN agendas a ON a.id = at.agenda_id
      JOIN generus g ON g.id = at.generus_id
      JOIN units k ON k.id = g.kelompok_id
      JOIN units d ON d.id = k.parent_id
      WHERE at.agenda_id = p_agenda AND NOT app.agenda_is_target(a, g)
        AND (p_kelompok IS NULL OR g.kelompok_id = p_kelompok)
        AND (nullif(trim(p_q), '') IS NULL OR g.name ILIKE '%' || trim(p_q) || '%')
      ORDER BY desa, kelompok, name
      LIMIT p_limit
    ) x
  ) r;
$$;--> statement-breakpoint

-- Unit tempat user boleh membuat agenda: unit peran admin-nya sendiri, atau semua
-- unit di bawah superadmin (padanan listAgendaUnits). Tipe kembalian sama dengan 0014.
CREATE OR REPLACE FUNCTION public.mobile_agenda_units()
RETURNS TABLE (id uuid, name text, level unit_level, parent_name text)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT u.id, u.name, u.level, p.name
  FROM units u LEFT JOIN units p ON p.id = u.parent_id
  WHERE u.path <@ (SELECT app.scope_paths(ARRAY['superadmin']::app_role[]))
     OR u.path = ANY (app.scope_paths(ARRAY['admin']::app_role[]))
  ORDER BY u.level, coalesce(p.name, ''), u.name;
$$;--> statement-breakpoint

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
