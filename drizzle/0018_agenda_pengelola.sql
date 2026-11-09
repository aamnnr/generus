-- Pengelola agenda dipersempit:
-- - admin hanya mengelola agenda di unit perannya sendiri (admin daerah → agenda
--   daerah, admin desa → agenda desa, admin kelompok → agenda kelompok);
-- - superadmin (daerah) dan superadmin sistem mengelola semua agenda di lingkupnya.
-- Sebelumnya admin juga mengelola agenda di unit bawahannya.
--
-- Melihat agenda tidak berubah. Delegasi presensi kini hanya untuk admin di
-- BAWAH unit agenda (mis. admin kelompok pada agenda desa), untuk generus di
-- lingkupnya, sebelum batas pelengkapan & sebelum dikunci. Admin di atas unit
-- agenda (mis. admin daerah pada agenda desa) hanya membaca.

-- True bila user boleh membuat/mengubah/membatalkan/mengunci agenda di unit `p`.
CREATE FUNCTION app.can_manage_agenda_at(p ltree)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT app.scope_paths(ARRAY['superadmin']::app_role[]) @> p
    OR p = ANY (app.scope_paths(ARRAY['admin']::app_role[]));
$$;--> statement-breakpoint

GRANT EXECUTE ON FUNCTION app.can_manage_agenda_at(ltree) TO authenticated;--> statement-breakpoint

CREATE OR REPLACE FUNCTION app.can_manage_agenda(p_agenda uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1 FROM agendas a
    WHERE a.id = p_agenda AND app.can_manage_agenda_at(a.unit_path)
  );
$$;--> statement-breakpoint

DROP POLICY agendas_write ON agendas;--> statement-breakpoint
CREATE POLICY agendas_write ON agendas FOR ALL TO authenticated
  USING (app.can_manage_agenda_at(unit_path))
  WITH CHECK (app.can_manage_agenda_at(unit_path));--> statement-breakpoint

CREATE OR REPLACE FUNCTION app.can_write_attendance(p_agenda uuid, p_generus uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  a agendas%ROWTYPE;
  g generus%ROWTYPE;
BEGIN
  SELECT * INTO a FROM agendas WHERE id = p_agenda;
  SELECT * INTO g FROM generus WHERE id = p_generus;
  IF a.id IS NULL OR g.id IS NULL OR a.cancelled_at IS NOT NULL THEN
    RETURN false;
  END IF;
  IF NOT app.agenda_is_target(a, g) THEN
    RETURN false;
  END IF;
  IF app.can_manage_agenda_at(a.unit_path) THEN
    RETURN true;
  END IF;
  IF a.locked_at IS NULL AND app.is_agenda_scanner(a.id) THEN
    RETURN true;
  END IF;
  RETURN a.locked_at IS NULL AND now() <= a.delegate_until AND EXISTS (
    SELECT 1 FROM unnest(app.scope_paths(ARRAY['superadmin', 'admin']::app_role[])) AS s(path)
    WHERE s.path <@ a.unit_path AND s.path @> g.unit_path
  );
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION app.lock_agenda(p_agenda uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  a agendas%ROWTYPE;
BEGIN
  SELECT * INTO a FROM agendas WHERE id = p_agenda;
  IF a.id IS NULL OR NOT app.can_manage_agenda_at(a.unit_path) THEN
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
$$;
