CREATE INDEX IF NOT EXISTS idx_products_access_code ON public.products(access_code);
CREATE INDEX IF NOT EXISTS idx_student_access_email_product ON public.student_access(email, product_id);