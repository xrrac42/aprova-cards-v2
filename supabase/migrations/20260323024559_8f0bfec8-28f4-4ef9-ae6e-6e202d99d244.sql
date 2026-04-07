CREATE OR REPLACE FUNCTION public.sanitize_cards_html_entities()
RETURNS TRIGGER AS $$
BEGIN
  NEW.front := REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    NEW.front,
    '&#x27;', ''''),
    '&#039;', ''''),
    '&#x22;', '"'),
    '&quot;', '"'),
    '&amp;', '&'),
    '&lt;', '<'),
    '&gt;', '>');
  NEW.back := REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    NEW.back,
    '&#x27;', ''''),
    '&#039;', ''''),
    '&#x22;', '"'),
    '&quot;', '"'),
    '&amp;', '&'),
    '&lt;', '<'),
    '&gt;', '>');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path TO 'public';

DROP TRIGGER IF EXISTS sanitize_cards_html_entities_before_write ON cards;
CREATE TRIGGER sanitize_cards_html_entities_before_write
BEFORE INSERT OR UPDATE ON cards
FOR EACH ROW EXECUTE FUNCTION sanitize_cards_html_entities();