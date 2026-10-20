-- profiles.email mengikuti auth.users.email.

CREATE OR REPLACE FUNCTION app.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'name', ''), NEW.email, 'Tanpa nama'), NEW.email);
  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE FUNCTION app.handle_user_email_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE profiles SET email = NEW.email WHERE id = NEW.id;
  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER on_auth_user_email_changed AFTER UPDATE OF email ON auth.users
  FOR EACH ROW WHEN (NEW.email IS DISTINCT FROM OLD.email)
  EXECUTE FUNCTION app.handle_user_email_change();--> statement-breakpoint

UPDATE profiles p SET email = u.email FROM auth.users u WHERE u.id = p.id;--> statement-breakpoint

-- Selain superadmin, user hanya boleh mengubah nama, no. HP, dan
-- menghapus tanda wajib-ganti-password miliknya sendiri.
CREATE OR REPLACE FUNCTION app.profiles_guard_active()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL OR app.is_superadmin() THEN
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
$$;
