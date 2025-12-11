-- Ensure update_updated_at_column function exists (should already exist from initial schema)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create partners table (if it doesn't exist)
-- All fields are optional except user_id
CREATE TABLE IF NOT EXISTS public.partners (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  internal_id TEXT, -- User-friendly identifier
  first_name TEXT, -- Made optional (no mandatory fields)
  last_name TEXT,
  email TEXT,
  phone_number TEXT,
  description TEXT,
  description_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for partners
CREATE INDEX IF NOT EXISTS idx_partners_user_id ON public.partners(user_id);
CREATE INDEX IF NOT EXISTS idx_partners_internal_id ON public.partners(user_id, internal_id);

-- Enable RLS on partners
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- RLS policies for partners (drop if exists, then create)
DROP POLICY IF EXISTS "Users can view own partners" ON public.partners;
CREATE POLICY "Users can view own partners"
  ON public.partners FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own partners" ON public.partners;
CREATE POLICY "Users can insert own partners"
  ON public.partners FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own partners" ON public.partners;
CREATE POLICY "Users can update own partners"
  ON public.partners FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own partners" ON public.partners;
CREATE POLICY "Users can delete own partners"
  ON public.partners FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at on partners
DROP TRIGGER IF EXISTS update_partners_updated_at ON public.partners;
CREATE TRIGGER update_partners_updated_at BEFORE UPDATE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Partner photos table
CREATE TABLE IF NOT EXISTS public.partner_photos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE NOT NULL,
  storage_path TEXT NOT NULL, -- Path in Supabase Storage
  file_name TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for partner photos
CREATE INDEX IF NOT EXISTS idx_partner_photos_partner_id ON public.partner_photos(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_photos_uploaded_at ON public.partner_photos(uploaded_at);

-- Enable RLS on partner_photos
ALTER TABLE public.partner_photos ENABLE ROW LEVEL SECURITY;

-- RLS policies for partner_photos (drop if exists, then create)
DROP POLICY IF EXISTS "Users can view own partner photos" ON public.partner_photos;
CREATE POLICY "Users can view own partner photos"
  ON public.partner_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.partners
      WHERE partners.id = partner_photos.partner_id
      AND partners.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own partner photos" ON public.partner_photos;
CREATE POLICY "Users can insert own partner photos"
  ON public.partner_photos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.partners
      WHERE partners.id = partner_photos.partner_id
      AND partners.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own partner photos" ON public.partner_photos;
CREATE POLICY "Users can update own partner photos"
  ON public.partner_photos FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.partners
      WHERE partners.id = partner_photos.partner_id
      AND partners.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own partner photos" ON public.partner_photos;
CREATE POLICY "Users can delete own partner photos"
  ON public.partner_photos FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.partners
      WHERE partners.id = partner_photos.partner_id
      AND partners.user_id = auth.uid()
    )
  );

-- Trigger for updated_at on partner_photos
DROP TRIGGER IF EXISTS update_partner_photos_updated_at ON public.partner_photos;
CREATE TRIGGER update_partner_photos_updated_at BEFORE UPDATE ON public.partner_photos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

