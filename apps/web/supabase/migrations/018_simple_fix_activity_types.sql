-- Simple fix for activity types - direct approach
-- Since we don't have many rows, this is straightforward

-- Step 1: Update all existing data to new types
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

-- Step 2: Drop the old constraint (try both named and find inline ones)
ALTER TABLE public.partner_notes
DROP CONSTRAINT IF EXISTS partner_notes_type_check;

-- Step 3: Find and drop any inline constraints on type column
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
    END IF;
END $$;

-- Step 4: Simply add the new constraint
ALTER TABLE public.partner_notes
ADD CONSTRAINT partner_notes_type_check CHECK (type IN ('date', 'chat', 'phone', 'other'));

