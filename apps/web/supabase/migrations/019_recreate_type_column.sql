-- Fix activity types constraint
-- Step 1: Drop the constraint FIRST (so we can update data)
-- Find and drop any constraint on the type column
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find constraint name for type column check
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.partner_notes'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%type%'
    LIMIT 1;
    
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.partner_notes DROP CONSTRAINT %I', constraint_name);
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    END IF;
    
    -- Also try the standard name
    BEGIN
        ALTER TABLE public.partner_notes DROP CONSTRAINT partner_notes_type_check;
        RAISE NOTICE 'Dropped constraint: partner_notes_type_check';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Constraint partner_notes_type_check does not exist or already dropped';
    END;
END $$;

-- Step 2: Now update all existing rows to 'other' (simple approach)
UPDATE public.partner_notes
SET type = 'other'
WHERE type NOT IN ('date', 'chat', 'phone', 'other');

-- Step 3: Recreate the column with new constraint (handles inline constraints)
-- Add temp column
ALTER TABLE public.partner_notes ADD COLUMN IF NOT EXISTS type_new TEXT;

-- Copy data
UPDATE public.partner_notes SET type_new = COALESCE(type, 'other');

-- Make it NOT NULL
ALTER TABLE public.partner_notes ALTER COLUMN type_new SET NOT NULL;

-- Add new constraint
ALTER TABLE public.partner_notes 
DROP CONSTRAINT IF EXISTS partner_notes_type_new_check;
ALTER TABLE public.partner_notes 
ADD CONSTRAINT partner_notes_type_new_check CHECK (type_new IN ('date', 'chat', 'phone', 'other'));

-- Drop old column (removes any inline constraint)
ALTER TABLE public.partner_notes DROP COLUMN IF EXISTS type;

-- Rename
ALTER TABLE public.partner_notes RENAME COLUMN type_new TO type;
ALTER TABLE public.partner_notes 
DROP CONSTRAINT IF EXISTS partner_notes_type_check;
ALTER TABLE public.partner_notes 
RENAME CONSTRAINT partner_notes_type_new_check TO partner_notes_type_check;

