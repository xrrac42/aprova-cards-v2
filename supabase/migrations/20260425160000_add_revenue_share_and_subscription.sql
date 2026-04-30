-- revenue_share: percentage the mentor receives from each payment (platform keeps the rest)
ALTER TABLE public.mentors
  ADD COLUMN IF NOT EXISTS revenue_share NUMERIC(5,2) NOT NULL DEFAULT 50.00;

-- price_cents: default monthly subscription price for the product in cents
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price_cents INTEGER;

-- stripe_subscription_id: Stripe Subscription ID created on checkout.session.completed
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_stripe_subscription_id
  ON public.payments(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
