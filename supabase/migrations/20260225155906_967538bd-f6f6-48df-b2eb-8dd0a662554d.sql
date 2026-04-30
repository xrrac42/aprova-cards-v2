
CREATE TABLE IF NOT EXISTS public.system_incidents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL,
  severity text NOT NULL,
  title text NOT NULL,
  description text,
  metadata jsonb,
  resolved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.system_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to system_incidents"
ON public.system_incidents
FOR ALL
USING (true)
WITH CHECK (true);
