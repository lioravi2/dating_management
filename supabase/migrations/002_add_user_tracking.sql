-- Add last_login and email_verified_at columns to users table

-- First, drop the old email_verified column if it exists and add email_verified_at
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

-- Drop old email_verified column if it exists (for existing databases)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' 
             AND table_name = 'users' 
             AND column_name = 'email_verified') THEN
    ALTER TABLE public.users DROP COLUMN email_verified;
  END IF;
END $$;

-- Add email_verified_at column
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- Function to update last_login and email_verified_at when user logs in
-- Note: This does NOT update updated_at to avoid triggering that field on login
CREATE OR REPLACE FUNCTION public.handle_user_login()
RETURNS TRIGGER AS $$
BEGIN
  -- Update last_login on every login
  -- Only update email_verified_at if it's currently NULL and email just got verified
  -- This ensures email_verified_at is only set once, when email is first verified
  UPDATE public.users
  SET 
    last_login = NOW(),
    email_verified_at = CASE 
      WHEN email_verified_at IS NULL AND NEW.email_confirmed_at IS NOT NULL 
      THEN NEW.email_confirmed_at 
      ELSE email_verified_at 
    END
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update last_login on successful authentication
-- This fires when auth.users is updated (e.g., after email confirmation)
DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;
CREATE TRIGGER on_auth_user_login
  AFTER UPDATE OF email_confirmed_at, last_sign_in_at ON auth.users
  FOR EACH ROW
  WHEN (NEW.email_confirmed_at IS NOT NULL OR NEW.last_sign_in_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_user_login();

-- Also update email_verified_at when user profile is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, email_verified_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email_confirmed_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

