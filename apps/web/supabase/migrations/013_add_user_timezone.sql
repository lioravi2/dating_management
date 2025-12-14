-- Add timezone column to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Jerusalem';

-- Update all existing users to Jerusalem timezone
UPDATE public.users
SET timezone = 'Asia/Jerusalem'
WHERE timezone IS NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.users.timezone IS 'User timezone (IANA timezone identifier, e.g., Asia/Jerusalem, America/New_York)';

