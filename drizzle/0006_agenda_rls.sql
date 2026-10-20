-- Agenda & presensi: trigger, fungsi sasaran, hak tulis, penguncian, RLS.
-- Lihat docs/ARCHITECTURE.md §4 dan PRD §5.3.

-- ---------------------------------------------------------------------------
-- agendas: path, validasi waktu
-- ---------------------------------------------------------------------------

CREATE FUNCTION app.agendas_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  SELECT path INTO NEW.unit_path FROM units WHERE id = NEW.unit_id;
  IF NEW.ends_at <= NEW.starts_at THEN
    RAISE EXCEPTION 'Waktu selesai harus setelah waktu mulai';
  END IF;
  IF NEW.late_after < NEW.starts_at OR NEW.late_after > NEW.ends_at THEN
    RAISE EXCEPTION 'Batas terlambat harus di antara waktu mulai dan selesai';
  END IF;
  IF NEW.delegate_until < NEW.ends_at THEN
    RAISE EXCEPTION 'Batas pelengkapan presensi tidak boleh sebelum agenda selesai';
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER agendas_before_write BEFORE INSERT OR UPDATE ON agendas
  FOR EACH ROW EXECUTE FUNCTION app.agendas_before_write();--> statement-breakpoint
CREATE TRIGGER agendas_touch BEFORE UPDATE ON agendas
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();--> statement-breakpoint
CREATE TRIGGER agendas_audit AFTER INSERT OR UPDATE OR DELETE ON agendas
  FOR EACH ROW EXECUTE FUNCTION app.audit();--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Sasaran agenda
-- ---------------------------------------------------------------------------

-- True bila generus termasuk peserta yang diharapkan pada agenda ini:
-- berada di wilayah agenda, cocok filter jenjang/kategori/gender, dan masih
-- aktif pada tanggal agenda (generus yang kemudian menikah/pindah tetap
-- dihitung untuk agenda sebelumnya).
CREATE FUNCTION app.agenda_is_target(a agendas, g generus)
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT g.unit_path <@ a.unit_path
    AND (cardinality(a.target_jenjang_ids) = 0 OR g.jenjang_id = ANY (a.target_jenjang_ids))
    AND (cardinality(a.target_kategori_ids) = 0 OR g.kategori_id IS NULL OR g.kategori_id = ANY (a.target_kategori_ids))
    AND (a.target_gender IS NULL OR g.gender = a.target_gender)
    AND (g.status = 'aktif' OR g.status_date > a.starts_at::date);
$$;--> statement-breakpoint

GRANT EXECUTE ON FUNCTION app.agenda_is_target(agendas, generus) TO authenticated;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Hak tulis presensi
-- ---------------------------------------------------------------------------

-- Pengelola agenda: admin/superadmin di unit agenda atau di atasnya.
-- Delegasi: admin yang lingkupnya mencakup generus (mis. admin kelompok pada
-- agenda desa/daerah), selama agenda belum dikunci dan belum lewat batas.
CREATE FUNCTION app.can_write_attendance(p_agenda uuid, p_generus uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  a agendas%ROWTYPE;
  g generus%ROWTYPE;
  admin_paths ltree[] := app.scope_paths(ARRAY['superadmin', 'admin']::app_role[]);
BEGIN
  SELECT * INTO a FROM agendas WHERE id = p_agenda;
  SELECT * INTO g FROM generus WHERE id = p_generus;
  IF a.id IS NULL OR g.id IS NULL OR a.cancelled_at IS NOT NULL THEN
    RETURN false;
  END IF;
  IF NOT app.agenda_is_target(a, g) THEN
    RETURN false;
  END IF;
  IF admin_paths @> a.unit_path THEN
    RETURN true;
  END IF;
  RETURN admin_paths @> g.unit_path AND a.locked_at IS NULL AND now() <= a.delegate_until;
END;
$$;--> statement-breakpoint

GRANT EXECUTE ON FUNCTION app.can_write_attendance(uuid, uuid) TO authenticated;--> statement-breakpoint

CREATE FUNCTION app.attendance_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.agenda_id <> OLD.agenda_id OR NEW.generus_id <> OLD.generus_id) THEN
    RAISE EXCEPTION 'Agenda dan generus pada presensi tidak boleh diubah';
  END IF;
  IF TG_OP = 'INSERT' OR NEW.status <> OLD.status THEN
    NEW.recorded_by := COALESCE(auth.uid(), NEW.recorded_by);
    NEW.recorded_at := now();
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER attendance_before_write BEFORE INSERT OR UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION app.attendance_before_write();--> statement-breakpoint
CREATE TRIGGER attendance_touch BEFORE UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();--> statement-breakpoint
-- Perubahan & penghapusan dicatat. Insert tidak (volume besar saat scan);
-- pencatatnya sudah ada di recorded_by/recorded_at.
CREATE TRIGGER attendance_audit AFTER UPDATE OR DELETE ON attendance
  FOR EACH ROW EXECUTE FUNCTION app.audit();--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Penguncian
-- ---------------------------------------------------------------------------

-- Kunci satu agenda: peserta sasaran yang belum tercatat diisi `alpa`.
-- Baris presensi setelah dikunci sekaligus menjadi snapshot peserta.
CREATE FUNCTION app.lock_agenda_internal(p_agenda uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO attendance (agenda_id, generus_id, status, method)
  SELECT a.id, g.id, 'alpa', 'otomatis'
  FROM agendas a JOIN generus g ON app.agenda_is_target(a, g)
  WHERE a.id = p_agenda
  ON CONFLICT (agenda_id, generus_id) DO NOTHING;
  UPDATE agendas SET locked_at = now() WHERE id = p_agenda AND locked_at IS NULL;
END;
$$;--> statement-breakpoint

-- Dipanggil terjadwal (pg_cron) dan saat halaman agenda dibuka. Idempoten.
CREATE FUNCTION app.lock_due_agendas()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  r record;
  n integer := 0;
BEGIN
  FOR r IN
    SELECT id FROM agendas
    WHERE locked_at IS NULL AND cancelled_at IS NULL AND delegate_until < now()
    ORDER BY delegate_until
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM app.lock_agenda_internal(r.id);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;--> statement-breakpoint

-- Kunci manual oleh pengelola agenda (setelah agenda selesai).
CREATE FUNCTION app.lock_agenda(p_agenda uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  a agendas%ROWTYPE;
BEGIN
  SELECT * INTO a FROM agendas WHERE id = p_agenda;
  IF a.id IS NULL OR NOT (app.scope_paths(ARRAY['superadmin', 'admin']::app_role[]) @> a.unit_path) THEN
    RAISE EXCEPTION 'Hanya pengelola agenda yang boleh mengunci presensi';
  END IF;
  IF a.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'Agenda sudah dibatalkan';
  END IF;
  IF now() < a.ends_at THEN
    RAISE EXCEPTION 'Presensi baru bisa dikunci setelah agenda selesai';
  END IF;
  PERFORM app.lock_agenda_internal(p_agenda);
END;
$$;--> statement-breakpoint

GRANT EXECUTE ON FUNCTION app.lock_due_agendas(), app.lock_agenda(uuid) TO authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app.lock_agenda_internal(uuid) FROM PUBLIC;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE agendas ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON agendas, attendance TO authenticated;--> statement-breakpoint

-- Agenda terlihat bila berada di lingkup user (unit sendiri & di bawahnya)
-- ATAU di atasnya (agenda desa/daerah yang diikuti generus kelompok).
CREATE POLICY agendas_select ON agendas FOR SELECT TO authenticated USING (
  (SELECT app.scope_paths(ARRAY['superadmin', 'admin', 'kyai']::app_role[])) @> unit_path
  OR (SELECT app.scope_paths(ARRAY['superadmin', 'admin', 'kyai']::app_role[])) <@ unit_path
);--> statement-breakpoint
CREATE POLICY agendas_write ON agendas FOR ALL TO authenticated
  USING ((SELECT app.scope_paths(ARRAY['superadmin', 'admin']::app_role[])) @> unit_path)
  WITH CHECK ((SELECT app.scope_paths(ARRAY['superadmin', 'admin']::app_role[])) @> unit_path);--> statement-breakpoint

-- Presensi terlihat bila generus-nya terlihat (RLS generus berlaku di subquery).
CREATE POLICY attendance_select ON attendance FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM generus g WHERE g.id = attendance.generus_id));--> statement-breakpoint
CREATE POLICY attendance_insert ON attendance FOR INSERT TO authenticated
  WITH CHECK (app.can_write_attendance(agenda_id, generus_id));--> statement-breakpoint
CREATE POLICY attendance_update ON attendance FOR UPDATE TO authenticated
  USING (app.can_write_attendance(agenda_id, generus_id))
  WITH CHECK (app.can_write_attendance(agenda_id, generus_id));--> statement-breakpoint
CREATE POLICY attendance_delete ON attendance FOR DELETE TO authenticated
  USING (app.can_write_attendance(agenda_id, generus_id));
