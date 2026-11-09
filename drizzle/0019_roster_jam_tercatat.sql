-- Roster pemindai menyertakan jam presensi tercatat, agar scan ulang kartu yang
-- sama bisa menampilkan "sudah tercatat pukul 07.12" (mendeteksi kartu dipinjamkan).
-- Tipe kembalian berubah, jadi fungsi dibuat ulang (isi lain sama dengan 0008).

DROP FUNCTION app.agenda_roster(uuid);--> statement-breakpoint

CREATE FUNCTION app.agenda_roster(p_agenda uuid)
RETURNS TABLE (
  generus_id uuid,
  name text,
  gender gender,
  kelompok text,
  desa text,
  token_hash text,
  status attendance_status,
  recorded_at timestamptz
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
         at.status, at.recorded_at
  FROM agendas a
  JOIN generus g ON app.agenda_is_target(a, g)
  JOIN units k ON k.id = g.kelompok_id
  JOIN units d ON d.id = k.parent_id
  LEFT JOIN attendance at ON at.agenda_id = a.id AND at.generus_id = g.id
  WHERE a.id = p_agenda
  ORDER BY g.name;
END;
$$;--> statement-breakpoint

GRANT EXECUTE ON FUNCTION app.agenda_roster(uuid) TO authenticated;
