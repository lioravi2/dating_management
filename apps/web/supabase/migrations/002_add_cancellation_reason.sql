-- Add cancellation_reason column to subscriptions table
ALTER TABLE public.subscriptions
ADD COLUMN cancellation_reason TEXT;


