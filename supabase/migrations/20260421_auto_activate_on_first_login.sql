-- 20260421_auto_activate_on_first_login.sql
-- Auto-activate invited-member profiles on their first login.
--
-- Closes the gap left by invite-member: that function pre-creates a
-- profile with is_active=false. Without this trigger, invited users
-- would show as "Inactivo" in the Team list forever even after accepting
-- and logging in successfully.
--
-- Fires AFTER UPDATE on auth.users when last_sign_in_at transitions from
-- NULL to a real value (first login). Only touches profiles that are
-- currently is_active=false, so it's a no-op for users whose state is
-- already correct and for every subsequent login.

CREATE OR REPLACE FUNCTION public.auto_activate_profile_on_first_login()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- required for SECURITY DEFINER in Supabase
AS $$
BEGIN
  -- First-login transition: last_sign_in_at goes from NULL to a value.
  IF OLD.last_sign_in_at IS NULL AND NEW.last_sign_in_at IS NOT NULL THEN
    UPDATE profiles
       SET is_active  = TRUE,
           updated_at = NOW()
     WHERE id        = NEW.id
       AND is_active = FALSE;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.auto_activate_profile_on_first_login IS
  'Flips profiles.is_active from false to true when the corresponding auth.users row records its first last_sign_in_at. Idempotent on re-logins.';

-- Backfill: activate any users who logged in before this trigger existed
-- Safe to run - only affects inactive profiles with existing sign-in timestamps
UPDATE profiles p
SET is_active = TRUE, updated_at = NOW()
FROM auth.users u
WHERE p.id = u.id
  AND p.is_active = FALSE
  AND u.last_sign_in_at IS NOT NULL;

-- Idempotent re-runs
DROP TRIGGER IF EXISTS on_first_login_activate_profile ON auth.users;

CREATE TRIGGER on_first_login_activate_profile
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
  EXECUTE FUNCTION public.auto_activate_profile_on_first_login();
