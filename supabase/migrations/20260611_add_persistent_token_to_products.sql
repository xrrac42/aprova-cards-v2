-- Persistent payment link token tied to the product.
-- Generated once, never consumed. Ideal for landing pages / marketing campaigns.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS persistent_token TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_products_persistent_token
  ON public.products (persistent_token)
  WHERE persistent_token IS NOT NULL;
