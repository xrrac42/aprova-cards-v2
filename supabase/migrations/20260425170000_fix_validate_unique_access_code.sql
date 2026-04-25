-- Fix validate_unique_access_code: remove reference to dropped mentor_password column.
-- The cross-check between product access_code and mentor_password is no longer needed
-- since mentor_password was removed. Replace with a no-op that just returns NEW.

CREATE OR REPLACE FUNCTION public.validate_unique_access_code()
RETURNS TRIGGER AS $$
BEGIN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
