-- Add profile picture field to partners table
-- This stores the storage_path of the photo to use as profile picture
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS profile_picture_storage_path TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.partners.profile_picture_storage_path IS 
  'Storage path to the partner photo to use as profile picture. References partner_photos.storage_path.';

-- Create index for faster lookups (optional, but helpful)
CREATE INDEX IF NOT EXISTS idx_partners_profile_picture 
  ON public.partners(profile_picture_storage_path) 
  WHERE profile_picture_storage_path IS NOT NULL;

















