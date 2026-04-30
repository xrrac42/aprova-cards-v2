CREATE OR REPLACE FUNCTION public.get_study_cards(p_email text, p_product_id uuid, p_discipline_id uuid, p_mode text, p_new_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, front text, back text, discipline_id uuid, discipline_name text, existing_correct_count integer, existing_incorrect_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := CURRENT_DATE;
BEGIN
  IF p_mode = 'marathon' THEN
    RETURN QUERY
      SELECT c.id, c.front, c.back, c.discipline_id,
        d.name AS discipline_name,
        COALESCE(sp.correct_count, 0)::int AS existing_correct_count,
        COALESCE(sp.incorrect_count, 0)::int AS existing_incorrect_count
      FROM cards c
      JOIN disciplines d ON d.id = c.discipline_id
      LEFT JOIN student_progress sp ON sp.card_id = c.id AND sp.student_email = p_email
      WHERE c.product_id = p_product_id
        AND (p_discipline_id IS NULL OR c.discipline_id = p_discipline_id)
      ORDER BY random()
      LIMIT 100;
  ELSE
    RETURN QUERY
      WITH error_cards AS (
        SELECT c.id, c.front, c.back, c.discipline_id, d.name AS discipline_name,
               COALESCE(sp.correct_count, 0)::int AS existing_correct_count,
               COALESCE(sp.incorrect_count, 0)::int AS existing_incorrect_count,
               0 AS sort_group
        FROM cards c
        JOIN disciplines d ON d.id = c.discipline_id
        JOIN student_progress sp ON sp.card_id = c.id AND sp.student_email = p_email
        WHERE c.product_id = p_product_id
          AND (p_discipline_id IS NULL OR c.discipline_id = p_discipline_id)
          AND sp.rating = 'errei'
          AND sp.next_review <= v_today
          AND p_mode IN ('review', 'mixed')
      ),
      due_cards AS (
        SELECT c.id, c.front, c.back, c.discipline_id, d.name AS discipline_name,
               COALESCE(sp.correct_count, 0)::int AS existing_correct_count,
               COALESCE(sp.incorrect_count, 0)::int AS existing_incorrect_count,
               1 AS sort_group
        FROM cards c
        JOIN disciplines d ON d.id = c.discipline_id
        JOIN student_progress sp ON sp.card_id = c.id AND sp.student_email = p_email
        WHERE c.product_id = p_product_id
          AND (p_discipline_id IS NULL OR c.discipline_id = p_discipline_id)
          AND sp.next_review <= v_today
          AND sp.rating != 'errei'
          AND p_mode IN ('review', 'mixed')
      ),
      new_cards AS (
        SELECT c.id, c.front, c.back, c.discipline_id, d.name AS discipline_name,
               0::int AS existing_correct_count,
               0::int AS existing_incorrect_count,
               2 AS sort_group
        FROM cards c
        JOIN disciplines d ON d.id = c.discipline_id
        WHERE c.product_id = p_product_id
          AND (p_discipline_id IS NULL OR c.discipline_id = p_discipline_id)
          AND NOT EXISTS (
            SELECT 1 FROM student_progress sp
            WHERE sp.card_id = c.id AND sp.student_email = p_email
          )
          AND p_mode IN ('new', 'mixed')
        ORDER BY c."order"
        LIMIT p_new_limit
      ),
      deduplicated AS (
        SELECT DISTINCT ON (r.id) r.id, r.front, r.back, r.discipline_id, r.discipline_name,
               r.existing_correct_count, r.existing_incorrect_count, r.sort_group
        FROM (
          SELECT * FROM error_cards
          UNION ALL
          SELECT * FROM due_cards
          UNION ALL
          SELECT * FROM new_cards
        ) r
        ORDER BY r.id, r.sort_group
      )
      SELECT dd.id, dd.front, dd.back, dd.discipline_id, dd.discipline_name,
             dd.existing_correct_count, dd.existing_incorrect_count
      FROM deduplicated dd
      ORDER BY dd.sort_group, random();
  END IF;
END;
$function$;