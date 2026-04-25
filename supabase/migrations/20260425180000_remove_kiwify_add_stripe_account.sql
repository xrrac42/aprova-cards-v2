-- Remove Kiwify fields (no longer used — platform moved to Stripe)
ALTER TABLE public.mentors DROP COLUMN IF EXISTS kiwify_webhook_token;
ALTER TABLE public.mentors DROP COLUMN IF EXISTS mentor_password;
ALTER TABLE public.products DROP COLUMN IF EXISTS kiwify_product_id;

-- Add Stripe Connect account ID for mentor payouts (50/50 split)
ALTER TABLE public.mentors ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_mentors_stripe_account_id
  ON public.mentors(stripe_account_id) WHERE stripe_account_id IS NOT NULL;

-- Add revenue_share if not already present (default 50%)
ALTER TABLE public.mentors
  ADD COLUMN IF NOT EXISTS revenue_share NUMERIC(5,2) NOT NULL DEFAULT 50.00;
