-- Add internal_id to partners table (user-friendly identifier) if it doesn't exist
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'partners') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'partners' AND column_name = 'internal_id') THEN
      ALTER TABLE public.partners ADD COLUMN internal_id TEXT;
    END IF;
    
    -- Make first_name optional (no mandatory fields) - only if it's currently NOT NULL
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'partners' AND column_name = 'first_name' AND is_nullable = 'NO') THEN
      ALTER TABLE public.partners ALTER COLUMN first_name DROP NOT NULL;
    END IF;
  END IF;
END $$;

-- Create index for internal_id lookups (if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_partners_internal_id ON public.partners(user_id, internal_id);

-- Partner photos table (only if it doesn't exist)
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

-- Indexes for partner photos (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_partner_photos_partner_id ON public.partner_photos(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_photos_uploaded_at ON public.partner_photos(uploaded_at);

-- RLS policies for partner_photos
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'partner_photos') THEN
    ALTER TABLE public.partner_photos ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Drop policies if they exist, then recreate (to avoid conflicts)
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

-- Trigger for updated_at on partner_photos (drop and recreate to avoid conflicts)
DROP TRIGGER IF EXISTS update_partner_photos_updated_at ON public.partner_photos;
CREATE TRIGGER update_partner_photos_updated_at BEFORE UPDATE ON public.partner_photos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

