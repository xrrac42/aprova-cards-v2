-- Migrate from Stripe to Kiwify
-- 1. Rename stripe_payment_intent_id → external_payment_id in payments
-- 2. Drop stripe_transfer_id from payment_splits
-- 3. Rename stripe_event_id → external_event_id in payment_webhooks
-- 4. Add kiwify_token to mentors
-- 5. Add payment_link to products

-- payments: rename column
ALTER TABLE public.payments
  RENAME COLUMN stripe_payment_intent_id TO external_payment_id;

-- payments: rename index that pointed at old column
DROP INDEX IF EXISTS idx_payments_stripe_id;
CREATE INDEX IF NOT EXISTS idx_payments_external_payment_id ON public.payments(external_payment_id);

-- payment_splits: drop stripe_transfer_id
ALTER TABLE public.payment_splits
  DROP COLUMN IF EXISTS stripe_transfer_id;

-- payment_webhooks: rename column
ALTER TABLE public.payment_webhooks
  RENAME COLUMN stripe_event_id TO external_event_id;

DROP INDEX IF EXISTS idx_payment_webhooks_stripe_event_id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_webhooks_external_event_id ON public.payment_webhooks(external_event_id);

-- mentors: add kiwify_token
ALTER TABLE public.mentors
  ADD COLUMN IF NOT EXISTS kiwify_token TEXT;

-- products: add payment_link
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS payment_link TEXT;
