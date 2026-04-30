
UPDATE cards SET 
  front = replace(replace(replace(replace(replace(replace(
    front,
    '&#x27;', ''''),
    '&#x22;', '"'),
    '&#x3A;', ':'),
    '&amp;', '&'),
    '&lt;', '<'),
    '&gt;', '>'),
  back = replace(replace(replace(replace(replace(replace(
    back,
    '&#x27;', ''''),
    '&#x22;', '"'),
    '&#x3A;', ':'),
    '&amp;', '&'),
    '&lt;', '<'),
    '&gt;', '>')
WHERE 
  front LIKE '%&#x%' OR back LIKE '%&#x%' OR
  front LIKE '%&amp;%' OR back LIKE '%&amp;%' OR
  front LIKE '%&lt;%' OR back LIKE '%&lt;%' OR
  front LIKE '%&gt;%' OR back LIKE '%&gt;%';
