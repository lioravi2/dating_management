-- Add black_flag column to partners table
ALTER TABLE public.partners
ADD COLUMN IF NOT EXISTS black_flag BOOLEAN DEFAULT FALSE NOT NULL;

-- Add comment to explain the field
COMMENT ON COLUMN public.partners.black_flag IS 'Indicates if this partner is marked with a black flag. When true, description becomes mandatory.';

