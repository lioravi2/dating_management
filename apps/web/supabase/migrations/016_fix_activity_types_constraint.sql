-- Fix activity types constraint - Update to new values: date, chat, phone, other
-- This migration handles the inline CHECK constraint by recreating the column

-- Step 1: Update existing data to map old types to new types
-- This ensures all data is valid before we change the constraint
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

-- Step 2: Drop ALL existing constraints on the type column
-- This handles both named and inline constraints
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all check constraints that reference the type column
    FOR r IN (
        SELECT conname, conrelid::regclass
        FROM pg_constraint
        WHERE conrelid = 'public.partner_notes'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%type%'
    ) LOOP
        EXECUTE 'ALTER TABLE public.partner_notes DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
    END LOOP;
END $$;

-- Step 3: Recreate the column with the new constraint
-- We'll use a temporary column to preserve data

-- Add temporary column (nullable first, we'll make it NOT NULL after copying data)
ALTER TABLE public.partner_notes
ADD COLUMN IF NOT EXISTS type_temp TEXT;

-- Copy all data to temporary column
UPDATE public.partner_notes
SET type_temp = type;

-- Make temporary column NOT NULL
ALTER TABLE public.partner_notes
ALTER COLUMN type_temp SET NOT NULL;

-- Add the new constraint to temporary column
ALTER TABLE public.partner_notes
DROP CONSTRAINT IF EXISTS partner_notes_type_temp_check;
ALTER TABLE public.partner_notes
ADD CONSTRAINT partner_notes_type_temp_check CHECK (type_temp IN ('date', 'chat', 'phone', 'other'));

-- Drop the old column (this removes any remaining inline constraint)
ALTER TABLE public.partner_notes
DROP COLUMN IF EXISTS type;

-- Rename temporary column to original name
ALTER TABLE public.partner_notes
RENAME COLUMN type_temp TO type;

-- Rename constraint to standard name (drop old one first if it exists)
ALTER TABLE public.partner_notes
DROP CONSTRAINT IF EXISTS partner_notes_type_check;
ALTER TABLE public.partner_notes
RENAME CONSTRAINT partner_notes_type_temp_check TO partner_notes_type_check;

