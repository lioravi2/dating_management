-- Final fix for activity types constraint
-- This is a simpler, more direct approach

-- Step 1: First, ensure all data is updated to new types
UPDATE public.partner_notes
SET type = CASE
  WHEN type = 'actual_date' THEN 'date'
  WHEN type = 'in-app_chat' THEN 'chat'
  WHEN type = 'whatsapp' THEN 'chat'
  WHEN type = 'phone' THEN 'phone'
  WHEN type = 'other' THEN 'other'
  WHEN type IN ('date', 'chat', 'phone', 'other') THEN type
  ELSE 'chat'
END;

-- Step 2: Temporarily disable the constraint by making column nullable
-- This allows us to work around the constraint
ALTER TABLE public.partner_notes
ALTER COLUMN type DROP NOT NULL;

-- Step 3: Drop ALL constraints on type column using a more aggressive approach
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    -- Find and drop all check constraints on partner_notes that involve 'type'
    FOR constraint_record IN (
        SELECT 
            conname,
            pg_get_constraintdef(oid) as constraint_def
        FROM pg_constraint
        WHERE conrelid = 'public.partner_notes'::regclass
        AND contype = 'c'
        AND (
            pg_get_constraintdef(oid) LIKE '%type%'
            OR conname LIKE '%type%'
        )
    ) LOOP
        EXECUTE format('ALTER TABLE public.partner_notes DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
        RAISE NOTICE 'Dropped constraint: %', constraint_record.conname;
    END LOOP;
END $$;

-- Step 4: Recreate the column properly
-- First, check if type_temp exists and drop it
ALTER TABLE public.partner_notes
DROP COLUMN IF EXISTS type_temp;

-- Add new column with correct constraint
ALTER TABLE public.partner_notes
ADD COLUMN type_temp TEXT NOT NULL;

-- Copy data
UPDATE public.partner_notes
SET type_temp = COALESCE(type, 'chat');

-- Add the new constraint
ALTER TABLE public.partner_notes
ADD CONSTRAINT partner_notes_type_temp_check CHECK (type_temp IN ('date', 'chat', 'phone', 'other'));

-- Drop old column
ALTER TABLE public.partner_notes
DROP COLUMN type;

-- Rename new column
ALTER TABLE public.partner_notes
RENAME COLUMN type_temp TO type;

-- Final step: Verify the constraint exists and is correct
DO $$
BEGIN
    -- Check if constraint exists with correct values
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.partner_notes'::regclass
        AND conname = 'partner_notes_type_check'
        AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%date%chat%phone%other%'
    ) THEN
        -- If it doesn't exist or is wrong, create it
        ALTER TABLE public.partner_notes
        DROP CONSTRAINT IF EXISTS partner_notes_type_check;
        
        ALTER TABLE public.partner_notes
        ADD CONSTRAINT partner_notes_type_check CHECK (type IN ('date', 'chat', 'phone', 'other'));
        
        RAISE NOTICE 'Created new constraint: partner_notes_type_check';
    ELSE
        RAISE NOTICE 'Constraint already exists and is correct';
    END IF;
END $$;



