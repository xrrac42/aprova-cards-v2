-- Remove legacy dependency on mentors.mentor_password.
-- Product access_code is already unique by table constraint/index.

DROP TRIGGER IF EXISTS check_product_access_code ON public.products;
DROP FUNCTION IF EXISTS public.validate_unique_access_code();

CREATE OR REPLACE FUNCTION public.validate_unique_access_code()
RETURNS TRIGGER AS $$
BEGIN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER check_product_access_code
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.validate_unique_access_code();
