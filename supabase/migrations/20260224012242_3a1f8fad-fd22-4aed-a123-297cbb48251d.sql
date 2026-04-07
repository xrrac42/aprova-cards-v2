
-- =============================================
-- PERFORMANCE OPTIMIZATION: Functions + Indices
-- =============================================

-- 1. Composite indices for common queries
CREATE INDEX IF NOT EXISTS idx_progress_email_product ON student_progress(student_email, product_id);
CREATE INDEX IF NOT EXISTS idx_progress_next_review ON student_progress(student_email, product_id, next_review);
CREATE INDEX IF NOT EXISTS idx_sessions_email_product ON student_sessions(student_email, product_id);
CREATE INDEX IF NOT EXISTS idx_cards_product_discipline ON cards(product_id, discipline_id);
CREATE INDEX IF NOT EXISTS idx_cards_discipline ON cards(discipline_id);

-- 2. get_study_cards: returns cards the student needs to study
CREATE OR REPLACE FUNCTION get_study_cards(
  p_email text,
  p_product_id uuid,
  p_discipline_id uuid,
  p_mode text,
  p_new_limit int DEFAULT 50
)
RETURNS TABLE(
  id uuid,
  front text,
  back text,
  discipline_id uuid,
  discipline_name text,
  existing_correct_count int,
  existing_incorrect_count int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := CURRENT_DATE;
BEGIN
  IF p_mode = 'marathon' THEN
    -- Marathon: return ALL cards (errors first, then due, then new)
    RETURN QUERY
      SELECT
        c.id, c.front, c.back, c.discipline_id,
        d.name AS discipline_name,
        COALESCE(sp.correct_count, 0)::int AS existing_correct_count,
        COALESCE(sp.incorrect_count, 0)::int AS existing_incorrect_count
      FROM cards c
      JOIN disciplines d ON d.id = c.discipline_id
      LEFT JOIN student_progress sp ON sp.card_id = c.id AND sp.student_email = p_email
      WHERE c.product_id = p_product_id
        AND (p_discipline_id IS NULL OR c.discipline_id = p_discipline_id)
      ORDER BY
        CASE
          WHEN sp.rating = 'errei' AND sp.next_review <= v_today THEN 0
          WHEN sp.id IS NOT NULL AND sp.next_review <= v_today THEN 1
          ELSE 2
        END,
        c."order";
  ELSE
    -- Mixed/review/new: return only actionable cards
    RETURN QUERY
      WITH error_cards AS (
        SELECT c.id, c.front, c.back, c.discipline_id, d.name AS discipline_name,
               sp.correct_count::int AS existing_correct_count,
               sp.incorrect_count::int AS existing_incorrect_count,
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
               sp.correct_count::int AS existing_correct_count,
               sp.incorrect_count::int AS existing_incorrect_count,
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
      )
      SELECT r.id, r.front, r.back, r.discipline_id, r.discipline_name,
             r.existing_correct_count, r.existing_incorrect_count
      FROM (
        SELECT * FROM error_cards
        UNION ALL
        SELECT * FROM due_cards
        UNION ALL
        SELECT * FROM new_cards
      ) r
      ORDER BY r.sort_group, r.id;
  END IF;
END;
$$;

-- 3. get_student_discipline_stats: returns stats per discipline for a student
CREATE OR REPLACE FUNCTION get_student_discipline_stats(
  p_email text,
  p_product_id uuid
)
RETURNS TABLE(
  discipline_id uuid,
  discipline_name text,
  discipline_order int,
  total_cards bigint,
  studied bigint,
  mastered bigint,
  reviews_due bigint,
  new_available bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := CURRENT_DATE;
BEGIN
  RETURN QUERY
    SELECT
      d.id AS discipline_id,
      d.name AS discipline_name,
      d."order" AS discipline_order,
      COUNT(DISTINCT c.id) AS total_cards,
      COUNT(DISTINCT sp.card_id) AS studied,
      COUNT(DISTINCT CASE WHEN sp.rating IN ('facil', 'medio') THEN sp.card_id END) AS mastered,
      COUNT(DISTINCT CASE WHEN sp.next_review <= v_today THEN sp.card_id END) AS reviews_due,
      COUNT(DISTINCT c.id) - COUNT(DISTINCT sp.card_id) AS new_available
    FROM disciplines d
    LEFT JOIN cards c ON c.discipline_id = d.id AND c.product_id = p_product_id
    LEFT JOIN student_progress sp ON sp.card_id = c.id AND sp.student_email = p_email
    WHERE d.product_id = p_product_id
    GROUP BY d.id, d.name, d."order"
    ORDER BY d."order";
END;
$$;

-- 4. get_mentor_stats: returns aggregated mentor stats
CREATE OR REPLACE FUNCTION get_mentor_stats(
  p_mentor_id uuid
)
RETURNS TABLE(
  product_id uuid,
  product_name text,
  product_active boolean,
  total_students bigint,
  students_today bigint,
  cards_reviewed bigint,
  weekly_avg_cards_per_student int,
  top_engaged_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := CURRENT_DATE;
  v_week_start date := CURRENT_DATE - INTERVAL '6 days';
  v_month_start date := date_trunc('month', CURRENT_DATE)::date;
BEGIN
  RETURN QUERY
    SELECT
      p.id AS product_id,
      p.name AS product_name,
      p.active AS product_active,
      (SELECT COUNT(DISTINCT ss.student_email) FROM student_sessions ss WHERE ss.product_id = p.id) AS total_students,
      (SELECT COUNT(DISTINCT ss.student_email) FROM student_sessions ss WHERE ss.product_id = p.id AND ss.session_date = v_today) AS students_today,
      (SELECT COALESCE(SUM(ss.cards_reviewed), 0) FROM student_sessions ss WHERE ss.product_id = p.id) AS cards_reviewed,
      (SELECT CASE
        WHEN COUNT(DISTINCT ss.student_email) = 0 THEN 0
        ELSE (SUM(ss.cards_reviewed) / COUNT(DISTINCT ss.student_email))::int
       END
       FROM student_sessions ss WHERE ss.product_id = p.id AND ss.session_date >= v_week_start
      ) AS weekly_avg_cards_per_student,
      (SELECT ss.student_email
       FROM student_sessions ss
       WHERE ss.product_id = p.id AND ss.session_date >= v_month_start
       GROUP BY ss.student_email
       ORDER BY SUM(ss.cards_reviewed) DESC
       LIMIT 1
      ) AS top_engaged_email
    FROM products p
    WHERE p.mentor_id = p_mentor_id
    ORDER BY p.name;
END;
$$;
