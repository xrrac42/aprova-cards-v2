
CREATE TABLE public.health_check_exceptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL,
  reference_key text NOT NULL,
  resolved_by text,
  resolved_at timestamptz DEFAULT now(),
  note text,
  UNIQUE(type, reference_key)
);

ALTER TABLE public.health_check_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to health_check_exceptions"
  ON public.health_check_exceptions
  FOR ALL
  USING (true)
  WITH CHECK (true);
