CREATE TABLE public.student_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_email text NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  mensagem text NOT NULL,
  total_cards_epoca integer NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.student_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to student_feedback"
  ON public.student_feedback
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_student_feedback_email_product ON public.student_feedback (student_email, product_id);