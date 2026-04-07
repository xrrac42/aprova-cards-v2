
-- Function to find duplicate cards
CREATE OR REPLACE FUNCTION public.find_duplicate_cards()
RETURNS TABLE(discipline_id uuid, front text, quantidade bigint, ids_para_remover uuid[])
LANGUAGE sql
SET search_path = public
AS $$
  SELECT 
    c.discipline_id,
    c.front,
    COUNT(*) as quantidade,
    (array_agg(c.id ORDER BY c.created_at DESC))[2:] as ids_para_remover
  FROM cards c
  GROUP BY c.discipline_id, c.front
  HAVING COUNT(*) > 1;
$$;

-- Function to remove duplicate cards (keeps the oldest)
CREATE OR REPLACE FUNCTION public.remove_duplicate_cards()
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  removidos integer := 0;
BEGIN
  DELETE FROM cards
  WHERE id IN (
    SELECT UNNEST((array_agg(c2.id ORDER BY c2.created_at DESC))[2:])
    FROM cards c2
    GROUP BY c2.discipline_id, c2.front
    HAVING COUNT(*) > 1
  );
  GET DIAGNOSTICS removidos = ROW_COUNT;
  RETURN removidos;
END;
$$;
