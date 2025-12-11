-- Remove internal_id column from partners table (UUID is sufficient)
ALTER TABLE public.partners
  DROP COLUMN IF EXISTS internal_id;

-- Drop the index for internal_id if it exists
DROP INDEX IF EXISTS idx_partners_internal_id;

