-- Complete Schema Migration
-- Run this if you haven't run any migrations yet
-- This combines all migrations in the correct order

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  account_type TEXT DEFAULT 'free' CHECK (account_type IN ('free', 'pro')),
  email_verified_at TIMESTAMPTZ,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partners table
CREATE TABLE IF NOT EXISTS public.partners (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  internal_id TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone_number TEXT,
  description TEXT,
  description_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partner notes table
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

-- Subscriptions table (for Stripe)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'incomplete')),
  plan_type TEXT DEFAULT 'pro' CHECK (plan_type IN ('pro')),
  cancel_at_period_end BOOLEAN DEFAULT false,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  stripe_payment_intent_id TEXT,
  stripe_invoice_id TEXT UNIQUE,
  amount BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL CHECK (status IN ('succeeded', 'pending', 'failed')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partner photos table
CREATE TABLE IF NOT EXISTS public.partner_photos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_partners_user_id ON public.partners(user_id);
CREATE INDEX IF NOT EXISTS idx_partners_internal_id ON public.partners(user_id, internal_id);
CREATE INDEX IF NOT EXISTS idx_partner_notes_partner_id ON public.partner_notes(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_notes_start_time ON public.partner_notes(start_time);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON public.subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_partner_photos_partner_id ON public.partner_photos(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_photos_uploaded_at ON public.partner_photos(uploaded_at);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_photos ENABLE ROW LEVEL SECURITY;

-- Users policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- Partners policies
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

-- Partner notes policies
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

-- Subscriptions policies
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
CREATE POLICY "Users can view own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Partner photos policies
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

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_partners_updated_at ON public.partners;
CREATE TRIGGER update_partners_updated_at BEFORE UPDATE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_partner_notes_updated_at ON public.partner_notes;
CREATE TRIGGER update_partner_notes_updated_at BEFORE UPDATE ON public.partner_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_partner_photos_updated_at ON public.partner_photos;
CREATE TRIGGER update_partner_photos_updated_at BEFORE UPDATE ON public.partner_photos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();






