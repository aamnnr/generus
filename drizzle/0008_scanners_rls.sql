-- Fase 3: petugas scan, roster untuk pemindai (token ber-hash), hak tulis scan.

-- ---------------------------------------------------------------------------
-- Helper
-- ---------------------------------------------------------------------------

-- Pengelola agenda: admin/superadmin di unit agenda atau di atasnya.
CREATE FUNCTION app.can_manage_agenda(p_agenda uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1 FROM agendas a
    WHERE a.id = p_agenda
      AND app.scope_paths(ARRAY['superadmin', 'admin']::app_role[]) @> a.unit_path
  );
$$;--> statement-breakpoint

-- Petugas scan aktif untuk agenda ini.
CREATE FUNCTION app.is_agenda_scanner(p_agenda uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1 FROM agenda_scanners s JOIN profiles p ON p.id = s.user_id
    WHERE s.agenda_id = p_agenda AND s.user_id = auth.uid() AND s.expires_at > now() AND p.active
  );
$$;--> statement-breakpoint

GRANT EXECUTE ON FUNCTION app.can_manage_agenda(uuid), app.is_agenda_scanner(uuid) TO authenticated;--> statement-breakpoint

-- Isi QR pada kartu. Diawali penanda agar QR lain (mis. URL) langsung ditolak.
CREATE FUNCTION app.qr_payload(token text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$ SELECT 'GNR1:' || token $$;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Hak tulis presensi: tambahkan petugas scan
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.can_write_attendance(p_agenda uuid, p_generus uuid)
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
  IF a.locked_at IS NULL AND app.is_agenda_scanner(a.id) THEN
    RETURN true;
  END IF;
  RETURN admin_paths @> g.unit_path AND a.locked_at IS NULL AND now() <= a.delegate_until;
END;
$$;--> statement-breakpoint

-- Petugas scan juga bisa melihat agendanya.
DROP POLICY agendas_select ON agendas;--> statement-breakpoint
CREATE POLICY agendas_select ON agendas FOR SELECT TO authenticated USING (
  (SELECT app.scope_paths(ARRAY['superadmin', 'admin', 'kyai']::app_role[])) @> unit_path
  OR (SELECT app.scope_paths(ARRAY['superadmin', 'admin', 'kyai']::app_role[])) <@ unit_path
  OR app.is_agenda_scanner(id)
);--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Roster untuk pemindai
-- ---------------------------------------------------------------------------

-- Daftar peserta sasaran + hash SHA-256 isi QR (bukan token aslinya), untuk
-- dicocokkan di perangkat saat offline. Hanya untuk pengelola & petugas scan.
CREATE FUNCTION app.agenda_roster(p_agenda uuid)
RETURNS TABLE (
  generus_id uuid,
  name text,
  gender gender,
  kelompok text,
  desa text,
  token_hash text,
  status attendance_status
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT (app.can_manage_agenda(p_agenda) OR app.is_agenda_scanner(p_agenda)) THEN
    RAISE EXCEPTION 'Anda bukan pengelola atau petugas scan agenda ini';
  END IF;
  RETURN QUERY
  SELECT g.id, g.name, g.gender, k.name, d.name,
         CASE WHEN g.qr_active THEN encode(sha256(convert_to(app.qr_payload(g.qr_token), 'UTF8')), 'hex') END,
         at.status
  FROM agendas a
  JOIN generus g ON app.agenda_is_target(a, g)
  JOIN units k ON k.id = g.kelompok_id
  JOIN units d ON d.id = k.parent_id
  LEFT JOIN attendance at ON at.agenda_id = a.id AND at.generus_id = g.id
  WHERE a.id = p_agenda
  ORDER BY g.name;
END;
$$;--> statement-breakpoint

GRANT EXECUTE ON FUNCTION app.agenda_roster(uuid) TO authenticated;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- agenda_scanners: RLS
-- ---------------------------------------------------------------------------

ALTER TABLE agenda_scanners ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON agenda_scanners TO authenticated;--> statement-breakpoint

CREATE POLICY agenda_scanners_select ON agenda_scanners FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR app.can_manage_agenda(agenda_id));--> statement-breakpoint
CREATE POLICY agenda_scanners_write ON agenda_scanners FOR ALL TO authenticated
  USING (app.can_manage_agenda(agenda_id))
  WITH CHECK (app.can_manage_agenda(agenda_id));--> statement-breakpoint

-- Audit umum: tabel tanpa kolom `id` (mis. agenda_scanners) tetap bisa dicatat.
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
    COALESCE(row_json ->> 'id', row_json ->> 'agenda_id')::uuid,
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;--> statement-breakpoint

CREATE TRIGGER agenda_scanners_audit AFTER INSERT OR UPDATE OR DELETE ON agenda_scanners
  FOR EACH ROW EXECUTE FUNCTION app.audit();
