-- Fix update_updated_at_column function for users table
-- It should NOT update updated_at when only last_login or email_verified_at changes

-- Create a specific function for users table that excludes last_login and email_verified_at
CREATE OR REPLACE FUNCTION public.update_users_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update updated_at if fields other than last_login or email_verified_at changed
  -- Check if any non-login fields changed
  IF (OLD.email IS DISTINCT FROM NEW.email) OR
     (OLD.full_name IS DISTINCT FROM NEW.full_name) OR
     (OLD.account_type IS DISTINCT FROM NEW.account_type) THEN
    -- Other fields changed, so update updated_at
    NEW.updated_at = NOW();
  END IF;
  -- If only last_login or email_verified_at changed, don't update updated_at
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the old trigger and create a new one with the specific function
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_users_updated_at_column();

