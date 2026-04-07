
-- ═══════════════════════════════════════════════════════════
-- PERFORMANCE INDEXES
-- ═══════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_cards_product_id ON public.cards(product_id);
CREATE INDEX IF NOT EXISTS idx_cards_discipline_id ON public.cards(discipline_id);
CREATE INDEX IF NOT EXISTS idx_student_progress_email ON public.student_progress(student_email);
CREATE INDEX IF NOT EXISTS idx_student_progress_card_id ON public.student_progress(card_id);
CREATE INDEX IF NOT EXISTS idx_student_progress_product_id ON public.student_progress(product_id);
CREATE INDEX IF NOT EXISTS idx_student_sessions_email ON public.student_sessions(student_email);
CREATE INDEX IF NOT EXISTS idx_student_sessions_date ON public.student_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_student_sessions_product_id ON public.student_sessions(product_id);
CREATE INDEX IF NOT EXISTS idx_student_access_email ON public.student_access(email);
CREATE INDEX IF NOT EXISTS idx_student_access_product ON public.student_access(product_id);
CREATE INDEX IF NOT EXISTS idx_disciplines_product_id ON public.disciplines(product_id);

-- ═══════════════════════════════════════════════════════════
-- CASCADE DELETES: discipline → cards
-- Drop existing FK and recreate with CASCADE
-- ═══════════════════════════════════════════════════════════
ALTER TABLE public.cards 
  DROP CONSTRAINT IF EXISTS cards_discipline_id_fkey;

ALTER TABLE public.cards 
  ADD CONSTRAINT cards_discipline_id_fkey 
  FOREIGN KEY (discipline_id) REFERENCES public.disciplines(id) ON DELETE CASCADE;

-- CASCADE DELETES: product → disciplines
ALTER TABLE public.disciplines 
  DROP CONSTRAINT IF EXISTS disciplines_product_id_fkey;

ALTER TABLE public.disciplines 
  ADD CONSTRAINT disciplines_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

-- CASCADE DELETES: product → cards
ALTER TABLE public.cards 
  DROP CONSTRAINT IF EXISTS cards_product_id_fkey;

ALTER TABLE public.cards 
  ADD CONSTRAINT cards_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

-- CASCADE DELETES: product → student_access
ALTER TABLE public.student_access 
  DROP CONSTRAINT IF EXISTS student_access_product_id_fkey;

ALTER TABLE public.student_access 
  ADD CONSTRAINT student_access_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

-- CASCADE DELETES: product → student_progress
ALTER TABLE public.student_progress 
  DROP CONSTRAINT IF EXISTS student_progress_product_id_fkey;

ALTER TABLE public.student_progress 
  ADD CONSTRAINT student_progress_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

-- CASCADE DELETES: card → student_progress
ALTER TABLE public.student_progress 
  DROP CONSTRAINT IF EXISTS student_progress_card_id_fkey;

ALTER TABLE public.student_progress 
  ADD CONSTRAINT student_progress_card_id_fkey 
  FOREIGN KEY (card_id) REFERENCES public.cards(id) ON DELETE CASCADE;

-- CASCADE DELETES: product → student_sessions
ALTER TABLE public.student_sessions 
  DROP CONSTRAINT IF EXISTS student_sessions_product_id_fkey;

ALTER TABLE public.student_sessions 
  ADD CONSTRAINT student_sessions_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

-- CASCADE DELETES: discipline → student_sessions
ALTER TABLE public.student_sessions 
  DROP CONSTRAINT IF EXISTS student_sessions_discipline_id_fkey;

ALTER TABLE public.student_sessions 
  ADD CONSTRAINT student_sessions_discipline_id_fkey 
  FOREIGN KEY (discipline_id) REFERENCES public.disciplines(id) ON DELETE CASCADE;

-- CASCADE DELETES: mentor → products
ALTER TABLE public.products 
  DROP CONSTRAINT IF EXISTS products_mentor_id_fkey;

ALTER TABLE public.products 
  ADD CONSTRAINT products_mentor_id_fkey 
  FOREIGN KEY (mentor_id) REFERENCES public.mentors(id) ON DELETE CASCADE;

-- ═══════════════════════════════════════════════════════════
-- VALIDATION: cards must have non-empty front and back
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.validate_card_content()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF TRIM(NEW.front) = '' OR NEW.front IS NULL THEN
    RAISE EXCEPTION 'Card front cannot be empty';
  END IF;
  IF TRIM(NEW.back) = '' OR NEW.back IS NULL THEN
    RAISE EXCEPTION 'Card back cannot be empty';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_card_before_insert
  BEFORE INSERT OR UPDATE ON public.cards
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_card_content();

-- ═══════════════════════════════════════════════════════════
-- VALIDATION: student_progress must have student_email
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.validate_progress_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF TRIM(NEW.student_email) = '' OR NEW.student_email IS NULL THEN
    RAISE EXCEPTION 'student_email cannot be empty';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_progress_email_trigger
  BEFORE INSERT OR UPDATE ON public.student_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_progress_email();

-- ═══════════════════════════════════════════════════════════
-- VALIDATION: student_sessions must have product_id
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.validate_session_product()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.product_id IS NULL THEN
    RAISE EXCEPTION 'product_id cannot be null on student_sessions';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_session_product_trigger
  BEFORE INSERT OR UPDATE ON public.student_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_session_product();
