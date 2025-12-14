-- Update activity types to new values: date, chat, phone, other
-- Step 1: Update existing data to map old types to new types
UPDATE public.partner_notes
SET type = CASE
  WHEN type = 'actual_date' THEN 'date'
  WHEN type = 'in-app_chat' THEN 'chat'
  WHEN type = 'whatsapp' THEN 'chat'
  WHEN type = 'phone' THEN 'phone'
  WHEN type = 'other' THEN 'other'
  -- If type is already one of the new types, keep it
  WHEN type IN ('date', 'chat', 'phone', 'other') THEN type
  -- For any other unexpected values, default to 'chat'
  ELSE 'chat'
END;

-- Step 2: Drop any existing named constraint (if it exists)
ALTER TABLE public.partner_notes
DROP CONSTRAINT IF EXISTS partner_notes_type_check;

-- Step 3: Recreate the column with the new constraint
-- We need to preserve data, so we'll:
-- 1. Add a temporary column
-- 2. Copy data
-- 3. Drop old column
-- 4. Rename temp column

-- Add temporary column with new constraint
ALTER TABLE public.partner_notes
ADD COLUMN type_new TEXT;

-- Copy data to new column
UPDATE public.partner_notes
SET type_new = type;

-- Make it NOT NULL
ALTER TABLE public.partner_notes
ALTER COLUMN type_new SET NOT NULL;

-- Add the new constraint
ALTER TABLE public.partner_notes
ADD CONSTRAINT partner_notes_type_check_new CHECK (type_new IN ('date', 'chat', 'phone', 'other'));

-- Drop old column
ALTER TABLE public.partner_notes
DROP COLUMN type;

-- Rename new column to original name
ALTER TABLE public.partner_notes
RENAME COLUMN type_new TO type;

-- Rename constraint to standard name
ALTER TABLE public.partner_notes
RENAME CONSTRAINT partner_notes_type_check_new TO partner_notes_type_check;

