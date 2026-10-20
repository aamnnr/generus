-- Fase 4: kurikulum, target periode, capaian, penyampaian, progres kitab.
-- Aturan akses: docs/ARCHITECTURE.md §4 (matriks akses).

-- ---------------------------------------------------------------------------
-- Helper
-- ---------------------------------------------------------------------------

-- Penyusun kurikulum: tim kurikulum atau superadmin (keduanya di tingkat daerah).
CREATE FUNCTION app.is_curriculum_editor()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur JOIN profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid() AND p.active AND ur.role IN ('superadmin', 'kurikulum')
  );
$$;--> statement-breakpoint

-- Generus termasuk sasaran target: jenjang/kategori/jenis kelamin cocok dan
-- masih aktif pada awal periode (yang keluar di tengah periode tetap dihitung).
CREATE FUNCTION app.target_applies(t period_targets, g generus)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT g.jenjang_id = t.jenjang_id
    AND (t.kategori_id IS NULL OR t.kategori_id = g.kategori_id)
    AND (t.gender IS NULL OR t.gender = g.gender)
    AND (
      g.status = 'aktif'
      OR g.status_date >= (SELECT p.starts_on FROM curriculum_periods p WHERE p.id = t.period_id)
    );
$$;--> statement-breakpoint

GRANT EXECUTE ON FUNCTION app.is_curriculum_editor(), app.target_applies(period_targets, generus) TO authenticated;--> statement-breakpoint

-- Audit umum: kunci baris dari `id`, `agenda_id`, atau `target_id`.
CREATE OR REPLACE FUNCTION app.audit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  row_json jsonb := to_jsonb(COALESCE(NEW, OLD));
BEGIN
  INSERT INTO audit_log (actor_id, table_name, row_id, action, before, after)
  VALUES (
    auth.uid(),
    TG_TABLE_NAME,
    COALESCE(row_json ->> 'id', row_json ->> 'agenda_id', row_json ->> 'target_id')::uuid,
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- period_targets: validasi kategori & rentang kitab
-- ---------------------------------------------------------------------------

CREATE FUNCTION app.period_targets_before_write()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  k kitab%ROWTYPE;
BEGIN
  IF NEW.kategori_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM jenjang_kategori WHERE id = NEW.kategori_id AND jenjang_id = NEW.jenjang_id
  ) THEN
    RAISE EXCEPTION 'Kategori tidak sesuai dengan jenjang';
  END IF;
  IF NEW.kitab_id IS NOT NULL THEN
    SELECT * INTO k FROM kitab WHERE id = NEW.kitab_id;
    IF NEW.range_to > k.total THEN
      RAISE EXCEPTION 'Rentang melebihi isi kitab % (maksimal %)', k.title, k.total;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER period_targets_before_write BEFORE INSERT OR UPDATE ON period_targets
  FOR EACH ROW EXECUTE FUNCTION app.period_targets_before_write();--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- achievements: hanya target materi per generus, periode terbit, generus sasaran
-- ---------------------------------------------------------------------------

CREATE FUNCTION app.achievements_before_write()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  t period_targets%ROWTYPE;
  g generus%ROWTYPE;
  mode assessment_mode;
BEGIN
  SELECT * INTO t FROM period_targets WHERE id = NEW.target_id;
  IF t.materi_id IS NULL THEN
    RAISE EXCEPTION 'Capaian target kitab dihitung dari progres kitab, bukan diisi manual';
  END IF;
  SELECT assessment INTO mode FROM materi WHERE id = t.materi_id;
  IF mode <> 'generus' THEN
    RAISE EXCEPTION 'Materi ini dinilai per kelompok (tandai sudah disampaikan)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM curriculum_periods WHERE id = t.period_id AND published_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Periode target belum diterbitkan';
  END IF;
  SELECT * INTO g FROM generus WHERE id = NEW.generus_id;
  IF NOT app.target_applies(t, g) THEN
    RAISE EXCEPTION 'Generus % bukan sasaran target ini', g.name;
  END IF;
  NEW.updated_by := auth.uid();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER achievements_before_write BEFORE INSERT OR UPDATE ON achievements
  FOR EACH ROW EXECUTE FUNCTION app.achievements_before_write();--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- target_deliveries: hanya target materi per kelompok, unit tingkat kelompok
-- ---------------------------------------------------------------------------

CREATE FUNCTION app.target_deliveries_before_write()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  t period_targets%ROWTYPE;
  k units%ROWTYPE;
  mode assessment_mode;
BEGIN
  SELECT * INTO t FROM period_targets WHERE id = NEW.target_id;
  SELECT assessment INTO mode FROM materi WHERE id = t.materi_id;
  IF mode IS DISTINCT FROM 'kelompok' THEN
    RAISE EXCEPTION 'Target ini dinilai per generus, bukan per kelompok';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM curriculum_periods WHERE id = t.period_id AND published_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Periode target belum diterbitkan';
  END IF;
  SELECT * INTO k FROM units WHERE id = NEW.kelompok_id;
  IF k.level <> 'kelompok' THEN
    RAISE EXCEPTION 'Penyampaian materi dicatat per kelompok';
  END IF;
  NEW.unit_path := k.path;
  NEW.recorded_by := auth.uid();
  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER target_deliveries_before_write BEFORE INSERT OR UPDATE ON target_deliveries
  FOR EACH ROW EXECUTE FUNCTION app.target_deliveries_before_write();--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- kitab_progress: posisi dalam batas kitab, tanggal tidak di masa depan
-- ---------------------------------------------------------------------------

CREATE FUNCTION app.kitab_progress_before_write()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  k kitab%ROWTYPE;
BEGIN
  SELECT * INTO k FROM kitab WHERE id = NEW.kitab_id;
  IF NEW.position < 1 OR NEW.position > k.total THEN
    RAISE EXCEPTION 'Posisi % harus antara 1 dan %', k.title, k.total;
  END IF;
  IF NEW.recorded_on > current_date THEN
    RAISE EXCEPTION 'Tanggal progres tidak boleh di masa depan';
  END IF;
  NEW.recorded_by := auth.uid();
  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER kitab_progress_before_write BEFORE INSERT OR UPDATE ON kitab_progress
  FOR EACH ROW EXECUTE FUNCTION app.kitab_progress_before_write();--> statement-breakpoint

-- Posisi terkini per (generus, kitab). security_invoker: mengikuti RLS kitab_progress.
CREATE VIEW kitab_progress_latest WITH (security_invoker = true) AS
  SELECT DISTINCT ON (generus_id, kitab_id) id, generus_id, kitab_id, position, recorded_on, note, recorded_by, created_at
  FROM kitab_progress
  ORDER BY generus_id, kitab_id, recorded_on DESC, created_at DESC;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- updated_at & audit
-- ---------------------------------------------------------------------------

CREATE TRIGGER curriculum_periods_touch BEFORE UPDATE ON curriculum_periods
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();--> statement-breakpoint
CREATE TRIGGER kitab_touch BEFORE UPDATE ON kitab
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();--> statement-breakpoint
CREATE TRIGGER materi_touch BEFORE UPDATE ON materi
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();--> statement-breakpoint
CREATE TRIGGER period_targets_touch BEFORE UPDATE ON period_targets
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();--> statement-breakpoint
CREATE TRIGGER target_deliveries_touch BEFORE UPDATE ON target_deliveries
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();--> statement-breakpoint

CREATE TRIGGER curriculum_periods_audit AFTER INSERT OR UPDATE OR DELETE ON curriculum_periods
  FOR EACH ROW EXECUTE FUNCTION app.audit();--> statement-breakpoint
CREATE TRIGGER period_targets_audit AFTER INSERT OR UPDATE OR DELETE ON period_targets
  FOR EACH ROW EXECUTE FUNCTION app.audit();--> statement-breakpoint
CREATE TRIGGER achievements_audit AFTER INSERT OR UPDATE OR DELETE ON achievements
  FOR EACH ROW EXECUTE FUNCTION app.audit();--> statement-breakpoint
CREATE TRIGGER target_deliveries_audit AFTER INSERT OR UPDATE OR DELETE ON target_deliveries
  FOR EACH ROW EXECUTE FUNCTION app.audit();--> statement-breakpoint
CREATE TRIGGER kitab_progress_audit AFTER UPDATE OR DELETE ON kitab_progress
  FOR EACH ROW EXECUTE FUNCTION app.audit();--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Data referensi: lintasan Al-Qur'an (posisi = nomor ayat urut mushaf)
-- ---------------------------------------------------------------------------

INSERT INTO kitab (title, unit, total, sort_order) VALUES
  ('Bacaan Al-Qur''an', 'ayat', 6236, 1),
  ('Makna Al-Qur''an', 'ayat', 6236, 2);--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE curriculum_periods ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE kitab ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE materi ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE period_targets ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE target_deliveries ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE kitab_progress ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON curriculum_periods, kitab, materi, period_targets,
  achievements, target_deliveries, kitab_progress TO authenticated;--> statement-breakpoint
GRANT SELECT ON kitab_progress_latest TO authenticated;--> statement-breakpoint

-- Periode: draf hanya untuk penyusun; yang sudah terbit terlihat semua akun.
CREATE POLICY curriculum_periods_select ON curriculum_periods FOR SELECT TO authenticated
  USING (published_at IS NOT NULL OR app.is_curriculum_editor());--> statement-breakpoint
CREATE POLICY curriculum_periods_write ON curriculum_periods FOR ALL TO authenticated
  USING (app.is_curriculum_editor()) WITH CHECK (app.is_curriculum_editor());--> statement-breakpoint

-- Pustaka materi & kitab: tidak sensitif, semua boleh membaca.
CREATE POLICY kitab_select ON kitab FOR SELECT TO authenticated USING (true);--> statement-breakpoint
CREATE POLICY kitab_write ON kitab FOR ALL TO authenticated
  USING (app.is_curriculum_editor()) WITH CHECK (app.is_curriculum_editor());--> statement-breakpoint
CREATE POLICY materi_select ON materi FOR SELECT TO authenticated USING (true);--> statement-breakpoint
CREATE POLICY materi_write ON materi FOR ALL TO authenticated
  USING (app.is_curriculum_editor()) WITH CHECK (app.is_curriculum_editor());--> statement-breakpoint

-- Target mengikuti hak baca periodenya.
CREATE POLICY period_targets_select ON period_targets FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM curriculum_periods p WHERE p.id = period_targets.period_id));--> statement-breakpoint
CREATE POLICY period_targets_write ON period_targets FOR ALL TO authenticated
  USING (app.is_curriculum_editor()) WITH CHECK (app.is_curriculum_editor());--> statement-breakpoint

-- Capaian & progres kitab: baca mengikuti hak baca generus; tulis oleh
-- admin/superadmin yang lingkupnya mencakup kelompok generus. Kyai & kurikulum tidak menulis.
CREATE POLICY achievements_select ON achievements FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM generus g WHERE g.id = achievements.generus_id));--> statement-breakpoint
CREATE POLICY achievements_write ON achievements FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM generus g WHERE g.id = achievements.generus_id
      AND g.unit_path <@ (SELECT app.scope_paths(ARRAY['superadmin', 'admin']::app_role[]))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM generus g WHERE g.id = achievements.generus_id
      AND g.unit_path <@ (SELECT app.scope_paths(ARRAY['superadmin', 'admin']::app_role[]))
  ));--> statement-breakpoint

CREATE POLICY kitab_progress_select ON kitab_progress FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM generus g WHERE g.id = kitab_progress.generus_id));--> statement-breakpoint
CREATE POLICY kitab_progress_write ON kitab_progress FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM generus g WHERE g.id = kitab_progress.generus_id
      AND g.unit_path <@ (SELECT app.scope_paths(ARRAY['superadmin', 'admin']::app_role[]))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM generus g WHERE g.id = kitab_progress.generus_id
      AND g.unit_path <@ (SELECT app.scope_paths(ARRAY['superadmin', 'admin']::app_role[]))
  ));--> statement-breakpoint

-- Penyampaian per kelompok.
CREATE POLICY target_deliveries_select ON target_deliveries FOR SELECT TO authenticated
  USING (unit_path <@ (SELECT app.scope_paths(ARRAY['superadmin', 'admin', 'kyai']::app_role[])));--> statement-breakpoint
CREATE POLICY target_deliveries_write ON target_deliveries FOR ALL TO authenticated
  USING (unit_path <@ (SELECT app.scope_paths(ARRAY['superadmin', 'admin']::app_role[])))
  WITH CHECK (unit_path <@ (SELECT app.scope_paths(ARRAY['superadmin', 'admin']::app_role[])));
