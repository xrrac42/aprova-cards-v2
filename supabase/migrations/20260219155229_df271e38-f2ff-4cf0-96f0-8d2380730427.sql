
CREATE OR REPLACE FUNCTION public.validate_unique_access_code()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if access_code conflicts with any mentor_password
  IF EXISTS (SELECT 1 FROM public.mentors WHERE mentor_password = NEW.access_code) THEN
    RAISE EXCEPTION 'O código de acesso "%" já está em uso como senha de mentor', NEW.access_code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER check_product_access_code
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.validate_unique_access_code();

-- Also validate mentor_password doesn't conflict with existing access_codes
CREATE OR REPLACE FUNCTION public.validate_unique_mentor_password()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.products WHERE access_code = NEW.mentor_password) THEN
    RAISE EXCEPTION 'A senha de mentor "%" já está em uso como código de acesso de produto', NEW.mentor_password;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER check_mentor_password
BEFORE INSERT OR UPDATE ON public.mentors
FOR EACH ROW
EXECUTE FUNCTION public.validate_unique_mentor_password();
