-- Move mentor authentication to Supabase Auth and stop storing plaintext mentor passwords.
DROP TRIGGER IF EXISTS check_mentor_password ON public.mentors;
DROP FUNCTION IF EXISTS public.validate_unique_mentor_password();

ALTER TABLE public.mentors
  DROP COLUMN IF EXISTS mentor_password;
