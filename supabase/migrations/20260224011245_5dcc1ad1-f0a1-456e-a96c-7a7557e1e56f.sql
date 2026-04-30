
-- Add cover_image_url to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cover_image_url text;

-- Create product-covers storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('product-covers', 'product-covers', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Product covers are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-covers');

-- Allow authenticated and anon uploads (admin manages via app)
CREATE POLICY "Anyone can upload product covers"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-covers');

CREATE POLICY "Anyone can update product covers"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-covers');

CREATE POLICY "Anyone can delete product covers"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-covers');
