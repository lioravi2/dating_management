-- Ensure RLS is enabled on partners table
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own partners" ON public.partners;
DROP POLICY IF EXISTS "Users can insert own partners" ON public.partners;
DROP POLICY IF EXISTS "Users can update own partners" ON public.partners;
DROP POLICY IF EXISTS "Users can delete own partners" ON public.partners;

-- Recreate RLS policies for partners
CREATE POLICY "Users can view own partners"
  ON public.partners FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own partners"
  ON public.partners FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own partners"
  ON public.partners FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own partners"
  ON public.partners FOR DELETE
  USING (auth.uid() = user_id);

