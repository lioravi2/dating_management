-- Remove internal_id column from partners table (UUID is sufficient)
-- Drop the index first (if it exists)
DROP INDEX IF EXISTS public.idx_partners_internal_id;

-- Then drop the column
ALTER TABLE public.partners
  DROP COLUMN IF EXISTS internal_id;

