-- Defensive migration for environments that missed older email migration.
ALTER TABLE public.mentors
  ADD COLUMN IF NOT EXISTS email text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'mentors_email_key'
  ) THEN
    CREATE UNIQUE INDEX mentors_email_key ON public.mentors (email);
  END IF;
END
$$;
