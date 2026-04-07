CREATE OR REPLACE FUNCTION public.find_defective_cards()
 RETURNS TABLE(id uuid, front text, back text, discipline_id uuid, product_id uuid, defect_type text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH all_defects AS (
    -- Formato corrompido (artefato de importação "">)
    SELECT c.id, c.front, c.back, c.discipline_id, c.product_id, 'Formato corrompido'::text AS defect_type
    FROM cards c
    WHERE c.front ILIKE '%"">%' OR c.back ILIKE '%"">%'

    UNION ALL

    -- Conteúdo vazio
    SELECT c.id, c.front, c.back, c.discipline_id, c.product_id, 'Conteúdo vazio'::text
    FROM cards c
    WHERE TRIM(c.front) = '' OR c.front IS NULL
       OR TRIM(c.back) = '' OR c.back IS NULL

    UNION ALL

    -- Entidades HTML
    SELECT c.id, c.front, c.back, c.discipline_id, c.product_id, 'Entidades HTML'::text
    FROM cards c
    WHERE c.front LIKE '%&#%' OR c.back LIKE '%&#%'

    UNION ALL

    -- Conteúdo truncado
    SELECT c.id, c.front, c.back, c.discipline_id, c.product_id, 'Conteúdo truncado'::text
    FROM cards c
    WHERE LENGTH(TRIM(c.front)) < 10 OR LENGTH(TRIM(c.back)) < 10
  )
  SELECT DISTINCT ON (ad.id) ad.id, ad.front, ad.back, ad.discipline_id, ad.product_id, ad.defect_type
  FROM all_defects ad
  ORDER BY ad.id, ad.defect_type;
$function$