-- Add price and billing interval fields to subscriptions table
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS price_amount BIGINT,
ADD COLUMN IF NOT EXISTS billing_interval TEXT CHECK (billing_interval IN ('day', 'month', 'year'));

-- Add comment for clarity
COMMENT ON COLUMN public.subscriptions.price_amount IS 'Price in cents';
COMMENT ON COLUMN public.subscriptions.billing_interval IS 'Billing interval: day, month, or year';

