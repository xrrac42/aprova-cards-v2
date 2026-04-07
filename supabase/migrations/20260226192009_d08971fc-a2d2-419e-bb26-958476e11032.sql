CREATE INDEX IF NOT EXISTS idx_mentors_email ON public.mentors(email);
CREATE INDEX IF NOT EXISTS idx_products_access_code_active ON public.products(access_code, active);
CREATE INDEX IF NOT EXISTS idx_student_access_email_product ON public.student_access(email, product_id);