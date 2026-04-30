CREATE OR REPLACE FUNCTION public.decode_html_entities(input_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  result text := COALESCE(input_text, '');
  hex_match text[];
  dec_match text[];
  codepoint integer;
BEGIN
  result := replace(result, '&amp;', '&');
  result := replace(result, '&lt;', '<');
  result := replace(result, '&gt;', '>');
  result := replace(result, '&quot;', '"');
  result := replace(result, '&apos;', '''');
  result := replace(result, '&#39;', '''');
  result := replace(result, '&#x27;', '''');
  result := replace(result, '&#47;', '/');
  result := replace(result, '&#x2F;', '/');
  result := replace(result, '&#58;', ':');
  result := replace(result, '&#x3A;', ':');

  LOOP
    hex_match := regexp_match(result, '&#x([0-9A-Fa-f]+);');
    EXIT WHEN hex_match IS NULL;
    codepoint := ('x' || lpad(hex_match[1], 8, '0'))::bit(32)::int;
    result := replace(result, '&#x' || hex_match[1] || ';', chr(codepoint));
  END LOOP;

  LOOP
    dec_match := regexp_match(result, '&#([0-9]+);');
    EXIT WHEN dec_match IS NULL;
    codepoint := dec_match[1]::integer;
    result := replace(result, '&#' || dec_match[1] || ';', chr(codepoint));
  END LOOP;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.sanitize_cards_html_entities()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.front := public.decode_html_entities(NEW.front);
  NEW.back := public.decode_html_entities(NEW.back);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sanitize_cards_html_entities_before_write ON public.cards;

CREATE TRIGGER sanitize_cards_html_entities_before_write
BEFORE INSERT OR UPDATE ON public.cards
FOR EACH ROW
EXECUTE FUNCTION public.sanitize_cards_html_entities();

UPDATE public.cards
SET
  front = public.decode_html_entities(front),
  back = public.decode_html_entities(back)
WHERE
  front ~ '&(#x?[0-9A-Fa-f]+|amp|lt|gt|quot|apos);'
  OR back ~ '&(#x?[0-9A-Fa-f]+|amp|lt|gt|quot|apos);';