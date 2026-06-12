-- Create payments table for tracking Stripe payment intents
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_email TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  mentor_id UUID NOT NULL REFERENCES public.mentors(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT NOT NULL UNIQUE,
  amount_cents INTEGER NOT NULL, -- Amount in cents (e.g., 999 = R$9.99)
  currency TEXT NOT NULL DEFAULT 'brl',
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded')) DEFAULT 'pending',
  payment_method TEXT, -- e.g., 'card', 'pix'
  description TEXT,
  metadata JSONB, -- Store additional data like session info
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  succeeded_at TIMESTAMP WITH TIME ZONE
);

-- Create payment_splits table to track split between mentor and platform
CREATE TABLE public.payment_splits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  mentor_id UUID NOT NULL REFERENCES public.mentors(id) ON DELETE CASCADE,
  platform_fee_cents INTEGER NOT NULL, -- Platform fee in cents
  mentor_amount_cents INTEGER NOT NULL, -- Mentor's portion in cents
  split_percentage NUMERIC(5, 2) NOT NULL DEFAULT 70.00, -- Mentor gets this percentage
  transfer_status TEXT CHECK (transfer_status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  stripe_transfer_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payment_webhooks table for webhook logging
CREATE TABLE public.payment_webhooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL, -- e.g., 'payment_intent.succeeded'
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  raw_data JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhooks ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for custom auth
CREATE POLICY "Allow all access to payments" ON public.payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to payment_splits" ON public.payment_splits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to payment_webhooks" ON public.payment_webhooks FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_payments_student_email ON public.payments(student_email);
CREATE INDEX idx_payments_product_id ON public.payments(product_id);
CREATE INDEX idx_payments_mentor_id ON public.payments(mentor_id);
CREATE INDEX idx_payments_stripe_id ON public.payments(stripe_payment_intent_id);
CREATE INDEX idx_payments_status ON public.payments(status);
CREATE INDEX idx_payment_splits_payment_id ON public.payment_splits(payment_id);
CREATE INDEX idx_payment_splits_mentor_id ON public.payment_splits(mentor_id);
CREATE INDEX idx_payment_webhooks_stripe_event_id ON public.payment_webhooks(stripe_event_id);
CREATE INDEX idx_payment_webhooks_event_type ON public.payment_webhooks(event_type);
CREATE INDEX idx_payment_webhooks_processed ON public.payment_webhooks(processed);

-- Add stripe_customer_id to mentors table (if not exists, handled separately)
-- Add stripe_account_id to mentors table for Connect integration
ALTER TABLE public.mentors ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE public.mentors ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;
ALTER TABLE public.mentors ADD COLUMN IF NOT EXISTS stripe_webhook_secret TEXT;

-- Create unique indexes on Stripe fields
CREATE UNIQUE INDEX idx_mentors_stripe_customer_id ON public.mentors(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE UNIQUE INDEX idx_mentors_stripe_account_id ON public.mentors(stripe_account_id) WHERE stripe_account_id IS NOT NULL;
