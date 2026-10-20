-- Fungsi, trigger, data referensi, dan Row Level Security.
-- Aturan akses: docs/ARCHITECTURE.md §4 (matriks akses).
--
-- Konvensi: fungsi helper ada di schema `app`, memakai SECURITY DEFINER agar
-- bisa membaca user_roles tanpa terkena RLS (menghindari rekursi kebijakan).

CREATE SCHEMA IF NOT EXISTS app;--> statement-breakpoint
GRANT USAGE ON SCHEMA app TO authenticated;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Helper lingkup akses
-- ---------------------------------------------------------------------------

-- True jika user saat ini memegang salah satu `roles` pada unit yang
-- mencakup `target` (unit itu sendiri atau leluhurnya).
CREATE FUNCTION app.has_role_in(target ltree, roles app_role[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
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

-- Path unit tempat user memegang salah satu `roles`. Dipakai di kebijakan
-- sebagai `kolom <@ (SELECT app.scope_paths(...))` supaya dihitung sekali per query.
CREATE FUNCTION app.scope_paths(roles app_role[])
RETURNS ltree[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT COALESCE(array_agg(u.path), ARRAY[]::ltree[])
  FROM user_roles ur
  JOIN units u ON u.id = ur.unit_id
  JOIN profiles p ON p.id = ur.user_id
  WHERE ur.user_id = auth.uid() AND p.active AND ur.role = ANY (roles);
$$;--> statement-breakpoint

CREATE FUNCTION app.is_superadmin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur JOIN profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid() AND p.active AND ur.role = 'superadmin'
  );
$$;--> statement-breakpoint

-- Mutasi kelompok hanya oleh admin desa/daerah (atau superadmin) yang
-- lingkupnya mencakup kelompok asal DAN tujuan.
CREATE FUNCTION app.can_mutate(from_path ltree, to_path ltree)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT app.is_superadmin() OR EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN units u ON u.id = ur.unit_id
    JOIN profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid()
      AND p.active
      AND ur.role = 'admin'
      AND u.level <> 'kelompok'
      AND from_path <@ u.path
      AND to_path <@ u.path
  );
$$;--> statement-breakpoint

GRANT EXECUTE ON FUNCTION app.has_role_in(ltree, app_role[]), app.scope_paths(app_role[]), app.is_superadmin(), app.can_mutate(ltree, ltree) TO authenticated;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Trigger umum
-- ---------------------------------------------------------------------------

CREATE FUNCTION app.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE FUNCTION app.audit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO audit_log (actor_id, table_name, row_id, action, before, after)
  VALUES (
    auth.uid(),
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- units: path & aturan hierarki
-- ---------------------------------------------------------------------------

CREATE FUNCTION app.units_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  parent units%ROWTYPE;
  label text := 'u' || replace(NEW.id::text, '-', '');
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.parent_id IS DISTINCT FROM OLD.parent_id OR NEW.level <> OLD.level) THEN
    RAISE EXCEPTION 'Induk dan tingkat unit tidak boleh diubah';
  END IF;

  IF NEW.parent_id IS NULL THEN
    IF NEW.level <> 'daerah' THEN
      RAISE EXCEPTION 'Unit tanpa induk harus bertingkat daerah';
    END IF;
    NEW.path := text2ltree(label);
  ELSE
    SELECT * INTO parent FROM units WHERE id = NEW.parent_id;
    IF (parent.level = 'daerah' AND NEW.level <> 'desa')
       OR (parent.level = 'desa' AND NEW.level <> 'kelompok')
       OR parent.level = 'kelompok' THEN
      RAISE EXCEPTION 'Tingkat % tidak boleh berada di bawah %', NEW.level, parent.level;
    END IF;
    NEW.path := parent.path || text2ltree(label);
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER units_before_write BEFORE INSERT OR UPDATE ON units
  FOR EACH ROW EXECUTE FUNCTION app.units_before_write();--> statement-breakpoint
CREATE TRIGGER units_touch BEFORE UPDATE ON units
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- profiles: dibuat otomatis saat akun auth dibuat
-- ---------------------------------------------------------------------------

CREATE FUNCTION app.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO profiles (id, name)
  VALUES (NEW.id, COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'name', ''), NEW.email, 'Tanpa nama'));
  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION app.handle_new_user();--> statement-breakpoint
CREATE TRIGGER profiles_touch BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- user_roles: aturan peran per tingkat
-- ---------------------------------------------------------------------------

CREATE FUNCTION app.user_roles_check()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  lvl unit_level;
BEGIN
  SELECT level INTO lvl FROM units WHERE id = NEW.unit_id;
  IF NEW.role IN ('superadmin', 'kurikulum') AND lvl <> 'daerah' THEN
    RAISE EXCEPTION 'Peran % hanya untuk unit tingkat daerah', NEW.role;
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER user_roles_check BEFORE INSERT OR UPDATE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION app.user_roles_check();--> statement-breakpoint
CREATE TRIGGER user_roles_audit AFTER INSERT OR UPDATE OR DELETE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION app.audit();--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- generus: path, validasi jenjang/kategori, status, mutasi
-- ---------------------------------------------------------------------------

CREATE FUNCTION app.generus_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  k units%ROWTYPE;
  has_kategori boolean;
BEGIN
  SELECT * INTO k FROM units WHERE id = NEW.kelompok_id;
  IF k.level <> 'kelompok' THEN
    RAISE EXCEPTION 'Generus harus terdaftar di unit tingkat kelompok';
  END IF;
  NEW.unit_path := k.path;

  SELECT EXISTS (SELECT 1 FROM jenjang_kategori WHERE jenjang_id = NEW.jenjang_id) INTO has_kategori;
  IF has_kategori AND NEW.kategori_id IS NULL THEN
    RAISE EXCEPTION 'Kategori wajib diisi untuk jenjang ini';
  END IF;
  IF NOT has_kategori AND NEW.kategori_id IS NOT NULL THEN
    RAISE EXCEPTION 'Jenjang ini tidak memakai kategori';
  END IF;
  IF NEW.kategori_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM jenjang_kategori WHERE id = NEW.kategori_id AND jenjang_id = NEW.jenjang_id
  ) THEN
    RAISE EXCEPTION 'Kategori tidak sesuai dengan jenjang';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.kelompok_id <> OLD.kelompok_id
     AND auth.uid() IS NOT NULL
     AND NOT app.can_mutate(OLD.unit_path, NEW.unit_path) THEN
    RAISE EXCEPTION 'Mutasi kelompok hanya boleh dilakukan admin desa/daerah';
  END IF;

  IF TG_OP = 'INSERT' OR NEW.status <> OLD.status THEN
    IF NEW.status = 'aktif' THEN
      NEW.qr_active := true;
    ELSE
      NEW.qr_active := false;
    END IF;
    IF TG_OP = 'UPDATE' THEN
      NEW.status_date := COALESCE(NEW.status_date, current_date);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE FUNCTION app.generus_after_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.kelompok_id <> OLD.kelompok_id THEN
    INSERT INTO generus_mutations (generus_id, from_unit_id, to_unit_id, mutated_by)
    VALUES (NEW.id, OLD.kelompok_id, NEW.kelompok_id, auth.uid());
  END IF;
  IF NEW.status <> OLD.status THEN
    INSERT INTO generus_status_history (generus_id, from_status, to_status, status_date, note, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, NEW.status_date, NEW.status_note, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER generus_before_write BEFORE INSERT OR UPDATE ON generus
  FOR EACH ROW EXECUTE FUNCTION app.generus_before_write();--> statement-breakpoint
CREATE TRIGGER generus_touch BEFORE UPDATE ON generus
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();--> statement-breakpoint
CREATE TRIGGER generus_after_update AFTER UPDATE ON generus
  FOR EACH ROW EXECUTE FUNCTION app.generus_after_update();--> statement-breakpoint
CREATE TRIGGER generus_audit AFTER INSERT OR UPDATE OR DELETE ON generus
  FOR EACH ROW EXECUTE FUNCTION app.audit();--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Data referensi jenjang (PRD §4)
-- ---------------------------------------------------------------------------

INSERT INTO jenjang (name, sort_order) VALUES ('Pra Remaja', 1), ('Remaja', 2);--> statement-breakpoint
INSERT INTO jenjang_kategori (jenjang_id, name, sort_order)
SELECT j.id, k.name, k.sort_order
FROM jenjang j
CROSS JOIN (VALUES ('Pelajar', 1), ('Mandiri', 2)) AS k(name, sort_order)
WHERE j.name = 'Remaja';--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE units ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE jenjang ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE jenjang_kategori ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE generus ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE generus_mutations ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE generus_status_history ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON units, profiles, user_roles, jenjang, jenjang_kategori, generus TO authenticated;--> statement-breakpoint
GRANT SELECT ON generus_mutations, generus_status_history, audit_log TO authenticated;--> statement-breakpoint

-- units: nama wilayah tidak sensitif, semua akun boleh membaca.
CREATE POLICY units_select ON units FOR SELECT TO authenticated USING (true);--> statement-breakpoint
CREATE POLICY units_write ON units FOR ALL TO authenticated
  USING (app.is_superadmin()) WITH CHECK (app.is_superadmin());--> statement-breakpoint

-- profiles: diri sendiri, superadmin, atau admin yang lingkupnya mencakup
-- salah satu unit tempat user itu berperan.
CREATE POLICY profiles_select ON profiles FOR SELECT TO authenticated USING (
  id = auth.uid()
  OR app.is_superadmin()
  OR EXISTS (
    SELECT 1 FROM user_roles ur JOIN units u ON u.id = ur.unit_id
    WHERE ur.user_id = profiles.id AND app.has_role_in(u.path, ARRAY['admin']::app_role[])
  )
);--> statement-breakpoint
CREATE POLICY profiles_update_self ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());--> statement-breakpoint
CREATE POLICY profiles_superadmin ON profiles FOR ALL TO authenticated
  USING (app.is_superadmin()) WITH CHECK (app.is_superadmin());--> statement-breakpoint
-- Kolom `active` hanya boleh diubah superadmin.
CREATE FUNCTION app.profiles_guard_active()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.active <> OLD.active AND auth.uid() IS NOT NULL AND NOT app.is_superadmin() THEN
    RAISE EXCEPTION 'Hanya superadmin yang boleh mengaktifkan/menonaktifkan akun';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER profiles_guard_active BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION app.profiles_guard_active();--> statement-breakpoint

-- user_roles: peran sendiri, superadmin, atau admin dalam lingkupnya. Tulis: superadmin.
CREATE POLICY user_roles_select ON user_roles FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR app.is_superadmin()
  OR EXISTS (
    SELECT 1 FROM units u
    WHERE u.id = user_roles.unit_id AND app.has_role_in(u.path, ARRAY['admin']::app_role[])
  )
);--> statement-breakpoint
CREATE POLICY user_roles_write ON user_roles FOR ALL TO authenticated
  USING (app.is_superadmin()) WITH CHECK (app.is_superadmin());--> statement-breakpoint

-- jenjang: semua boleh membaca, superadmin menulis.
CREATE POLICY jenjang_select ON jenjang FOR SELECT TO authenticated USING (true);--> statement-breakpoint
CREATE POLICY jenjang_write ON jenjang FOR ALL TO authenticated
  USING (app.is_superadmin()) WITH CHECK (app.is_superadmin());--> statement-breakpoint
CREATE POLICY jenjang_kategori_select ON jenjang_kategori FOR SELECT TO authenticated USING (true);--> statement-breakpoint
CREATE POLICY jenjang_kategori_write ON jenjang_kategori FOR ALL TO authenticated
  USING (app.is_superadmin()) WITH CHECK (app.is_superadmin());--> statement-breakpoint

-- generus: baca oleh superadmin/admin/kyai dalam lingkup (kurikulum tidak).
-- Tulis oleh superadmin/admin dalam lingkup. Kyai tidak pernah menulis.
CREATE POLICY generus_select ON generus FOR SELECT TO authenticated
  USING (unit_path <@ (SELECT app.scope_paths(ARRAY['superadmin', 'admin', 'kyai']::app_role[])));--> statement-breakpoint
CREATE POLICY generus_insert ON generus FOR INSERT TO authenticated
  WITH CHECK (unit_path <@ (SELECT app.scope_paths(ARRAY['superadmin', 'admin']::app_role[])));--> statement-breakpoint
CREATE POLICY generus_update ON generus FOR UPDATE TO authenticated
  USING (unit_path <@ (SELECT app.scope_paths(ARRAY['superadmin', 'admin']::app_role[])))
  WITH CHECK (unit_path <@ (SELECT app.scope_paths(ARRAY['superadmin', 'admin']::app_role[])));--> statement-breakpoint
CREATE POLICY generus_delete ON generus FOR DELETE TO authenticated
  USING (unit_path <@ (SELECT app.scope_paths(ARRAY['superadmin', 'admin']::app_role[])));--> statement-breakpoint

-- Riwayat mengikuti hak baca generus-nya.
CREATE POLICY generus_mutations_select ON generus_mutations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM generus g WHERE g.id = generus_mutations.generus_id));--> statement-breakpoint
CREATE POLICY generus_status_history_select ON generus_status_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM generus g WHERE g.id = generus_status_history.generus_id));--> statement-breakpoint

-- Audit log: hanya superadmin.
CREATE POLICY audit_log_select ON audit_log FOR SELECT TO authenticated USING (app.is_superadmin());
