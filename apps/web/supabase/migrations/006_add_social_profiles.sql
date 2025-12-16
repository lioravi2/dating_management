-- Add social media profile fields to partners table
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS facebook_profile TEXT,
  ADD COLUMN IF NOT EXISTS x_profile TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_profile TEXT,
  ADD COLUMN IF NOT EXISTS instagram_profile TEXT;






