-- Dua tingkat superadmin.
--
-- - Superadmin sistem (tabel system_admins): menambah daerah, mengubah data
--   referensi (jenjang), membaca audit log, dan berkuasa di semua daerah.
-- - Superadmin (peran `superadmin` di sebuah daerah): mengelola wilayah, akun,
--   dan peran HANYA di dalam daerah itu.
--
-- Sebelumnya app.is_superadmin() berlaku global untuk wilayah, akun, dan peran.
-- Kebijakan itu diganti dengan pemeriksaan berbasis lingkup di bawah ini.

ALTER TABLE system_admins ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT ON system_admins TO authenticated;--> statement-breakpoint
-- Hanya bisa membaca status diri sendiri; pengisian lewat skrip (koneksi pemilik DB).
CREATE POLICY system_admins_select ON system_admins FOR SELECT TO authenticated
  USING (user_id = auth.uid());--> statement-breakpoint

CREATE FUNCTION app.is_system_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1 FROM system_admins s JOIN profiles p ON p.id = s.user_id
    WHERE s.user_id = auth.uid() AND p.active
  );
$$;--> statement-breakpoint

-- True bila `p_id` superadmin sistem. Dipakai di kebijakan tabel lain, karena
-- baris system_admins milik orang lain tidak terbaca lewat RLS.
CREATE FUNCTION app.is_system_admin_user(p_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (SELECT 1 FROM system_admins WHERE user_id = p_id);
$$;--> statement-breakpoint

-- Superadmin sistem dianggap memegang peran superadmin di setiap daerah.
CREATE OR REPLACE FUNCTION app.has_role_in(target ltree, roles app_role[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT ('superadmin' = ANY (roles) AND app.is_system_admin()) OR EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN units u ON u.id = ur.unit_id
    JOIN profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid()
      AND p.active
      AND ur.role = ANY (roles)
      AND target <@ u.path
  );
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION app.scope_paths(roles app_role[])
RETURNS ltree[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT COALESCE(array_agg(path), ARRAY[]::ltree[])
  FROM (
    SELECT u.path
    FROM user_roles ur
    JOIN units u ON u.id = ur.unit_id
    JOIN profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid() AND p.active AND ur.role = ANY (roles)
    UNION
    SELECT u.path FROM units u
    WHERE u.parent_id IS NULL AND 'superadmin' = ANY (roles) AND app.is_system_admin()
  ) s;
$$;--> statement-breakpoint

-- Superadmin sistem, atau superadmin daerah yang lingkupnya mencakup `target`.
CREATE FUNCTION app.is_superadmin_over(target ltree)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT app.has_role_in(target, ARRAY['superadmin']::app_role[]);
$$;--> statement-breakpoint

-- Boleh mengelola akun `p_id` (profil, peran, status, reset password):
-- superadmin sistem, atau superadmin daerah bila SEMUA peran akun itu ada di
-- dalam lingkupnya dan akun itu bukan superadmin sistem.
CREATE FUNCTION app.can_manage_profile(p_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT app.is_system_admin() OR (
    NOT EXISTS (SELECT 1 FROM system_admins WHERE user_id = p_id)
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = p_id)
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur JOIN units u ON u.id = ur.unit_id
      WHERE ur.user_id = p_id AND NOT app.is_superadmin_over(u.path)
    )
  );
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION app.can_mutate(from_path ltree, to_path ltree)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT app.is_system_admin() OR EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN units u ON u.id = ur.unit_id
    JOIN profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid()
      AND p.active
      AND ur.role IN ('admin', 'superadmin')
      AND u.level <> 'kelompok'
      AND from_path <@ u.path
      AND to_path <@ u.path
  );
$$;--> statement-breakpoint

GRANT EXECUTE ON FUNCTION app.is_system_admin(), app.is_system_admin_user(uuid), app.is_superadmin_over(ltree), app.can_manage_profile(uuid) TO authenticated;--> statement-breakpoint

-- units: daerah baru hanya oleh superadmin sistem; desa/kelompok oleh superadmin
-- yang lingkupnya mencakup unit itu. Path sudah diisi trigger BEFORE saat WITH CHECK dinilai.
DROP POLICY units_write ON units;--> statement-breakpoint
CREATE POLICY units_insert ON units FOR INSERT TO authenticated WITH CHECK (
  CASE WHEN parent_id IS NULL THEN app.is_system_admin() ELSE app.is_superadmin_over(path) END
);--> statement-breakpoint
CREATE POLICY units_update ON units FOR UPDATE TO authenticated
  USING (CASE WHEN parent_id IS NULL THEN app.is_system_admin() ELSE app.is_superadmin_over(path) END)
  WITH CHECK (CASE WHEN parent_id IS NULL THEN app.is_system_admin() ELSE app.is_superadmin_over(path) END);--> statement-breakpoint
CREATE POLICY units_delete ON units FOR DELETE TO authenticated
  USING (CASE WHEN parent_id IS NULL THEN app.is_system_admin() ELSE app.is_superadmin_over(path) END);--> statement-breakpoint

-- profiles
DROP POLICY profiles_select ON profiles;--> statement-breakpoint
CREATE POLICY profiles_select ON profiles FOR SELECT TO authenticated USING (
  id = auth.uid()
  OR app.is_system_admin()
  OR EXISTS (
    SELECT 1 FROM user_roles ur JOIN units u ON u.id = ur.unit_id
    WHERE ur.user_id = profiles.id AND app.has_role_in(u.path, ARRAY['admin', 'superadmin']::app_role[])
  )
);--> statement-breakpoint
DROP POLICY profiles_superadmin ON profiles;--> statement-breakpoint
CREATE POLICY profiles_manage ON profiles FOR ALL TO authenticated
  USING (app.can_manage_profile(id)) WITH CHECK (app.can_manage_profile(id));--> statement-breakpoint

CREATE OR REPLACE FUNCTION app.profiles_guard_active()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL OR app.can_manage_profile(NEW.id) THEN
    RETURN NEW;
  END IF;
  IF NEW.active <> OLD.active THEN
    RAISE EXCEPTION 'Hanya superadmin yang boleh mengaktifkan/menonaktifkan akun';
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Email hanya bisa diubah superadmin';
  END IF;
  IF NEW.must_change_password AND NOT OLD.must_change_password THEN
    RAISE EXCEPTION 'Hanya superadmin yang boleh mewajibkan ganti password';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint

-- user_roles: baca seperti sebelumnya ditambah superadmin dalam lingkup; tulis
-- oleh superadmin yang lingkupnya mencakup unit peran, tidak untuk akun superadmin sistem.
DROP POLICY user_roles_select ON user_roles;--> statement-breakpoint
CREATE POLICY user_roles_select ON user_roles FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR app.is_system_admin()
  OR EXISTS (
    SELECT 1 FROM units u
    WHERE u.id = user_roles.unit_id AND app.has_role_in(u.path, ARRAY['admin', 'superadmin']::app_role[])
  )
);--> statement-breakpoint
DROP POLICY user_roles_write ON user_roles;--> statement-breakpoint
CREATE POLICY user_roles_write ON user_roles FOR ALL TO authenticated
  USING (
    app.is_system_admin() OR (
      app.is_superadmin_over((SELECT path FROM units WHERE id = user_roles.unit_id))
      AND NOT app.is_system_admin_user(user_roles.user_id)
    )
  )
  WITH CHECK (
    app.is_system_admin() OR (
      app.is_superadmin_over((SELECT path FROM units WHERE id = user_roles.unit_id))
      AND NOT app.is_system_admin_user(user_roles.user_id)
    )
  );--> statement-breakpoint

-- Data referensi & audit: hanya superadmin sistem.
DROP POLICY jenjang_write ON jenjang;--> statement-breakpoint
CREATE POLICY jenjang_write ON jenjang FOR ALL TO authenticated
  USING (app.is_system_admin()) WITH CHECK (app.is_system_admin());--> statement-breakpoint
DROP POLICY jenjang_kategori_write ON jenjang_kategori;--> statement-breakpoint
CREATE POLICY jenjang_kategori_write ON jenjang_kategori FOR ALL TO authenticated
  USING (app.is_system_admin()) WITH CHECK (app.is_system_admin());--> statement-breakpoint
DROP POLICY audit_log_select ON audit_log;--> statement-breakpoint
CREATE POLICY audit_log_select ON audit_log FOR SELECT TO authenticated USING (app.is_system_admin());
