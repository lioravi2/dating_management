-- Add internal_id to partners table (user-friendly identifier)
ALTER TABLE public.partners
ADD COLUMN internal_id TEXT;

-- Make first_name optional (no mandatory fields)
ALTER TABLE public.partners
ALTER COLUMN first_name DROP NOT NULL;

-- Create index for internal_id lookups
CREATE INDEX idx_partners_internal_id ON public.partners(user_id, internal_id);

-- Partner photos table
CREATE TABLE public.partner_photos (
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
CREATE INDEX idx_partner_photos_partner_id ON public.partner_photos(partner_id);
CREATE INDEX idx_partner_photos_uploaded_at ON public.partner_photos(uploaded_at);

-- RLS policies for partner_photos
ALTER TABLE public.partner_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own partner photos"
  ON public.partner_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.partners
      WHERE partners.id = partner_photos.partner_id
      AND partners.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own partner photos"
  ON public.partner_photos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.partners
      WHERE partners.id = partner_photos.partner_id
      AND partners.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own partner photos"
  ON public.partner_photos FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.partners
      WHERE partners.id = partner_photos.partner_id
      AND partners.user_id = auth.uid()
    )
  );

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
CREATE TRIGGER update_partner_photos_updated_at BEFORE UPDATE ON public.partner_photos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

