
-- Add kiwify_product_id to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS kiwify_product_id text;

-- Create student_access table
CREATE TABLE IF NOT EXISTS public.student_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(email, product_id)
);

-- Enable RLS on student_access
ALTER TABLE public.student_access ENABLE ROW LEVEL SECURITY;

-- Allow all access (consistent with other tables in this project)
CREATE POLICY "Allow all access to student_access"
  ON public.student_access
  FOR ALL
  USING (true)
  WITH CHECK (true);
