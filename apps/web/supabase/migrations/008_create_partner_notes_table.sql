-- Create partner_notes table (for activities)
-- This table stores activities/interactions with partners
CREATE TABLE IF NOT EXISTS public.partner_notes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  type TEXT NOT NULL CHECK (type IN ('in-app_chat', 'whatsapp', 'phone', 'actual_date', 'other')),
  location TEXT,
  description TEXT,
  google_calendar_event_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for partner_notes
CREATE INDEX IF NOT EXISTS idx_partner_notes_partner_id ON public.partner_notes(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_notes_start_time ON public.partner_notes(start_time);

-- Enable RLS on partner_notes
ALTER TABLE public.partner_notes ENABLE ROW LEVEL SECURITY;

-- RLS policies for partner_notes (drop if exists, then create)
DROP POLICY IF EXISTS "Users can view own partner notes" ON public.partner_notes;
CREATE POLICY "Users can view own partner notes"
  ON public.partner_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.partners
      WHERE partners.id = partner_notes.partner_id
      AND partners.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own partner notes" ON public.partner_notes;
CREATE POLICY "Users can insert own partner notes"
  ON public.partner_notes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.partners
      WHERE partners.id = partner_notes.partner_id
      AND partners.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own partner notes" ON public.partner_notes;
CREATE POLICY "Users can update own partner notes"
  ON public.partner_notes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.partners
      WHERE partners.id = partner_notes.partner_id
      AND partners.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own partner notes" ON public.partner_notes;
CREATE POLICY "Users can delete own partner notes"
  ON public.partner_notes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.partners
      WHERE partners.id = partner_notes.partner_id
      AND partners.user_id = auth.uid()
    )
  );

-- Trigger for updated_at on partner_notes
DROP TRIGGER IF EXISTS update_partner_notes_updated_at ON public.partner_notes;
CREATE TRIGGER update_partner_notes_updated_at BEFORE UPDATE ON public.partner_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();




