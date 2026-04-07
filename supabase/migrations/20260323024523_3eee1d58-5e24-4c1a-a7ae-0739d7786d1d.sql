UPDATE cards SET
  front = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    front,
    '&#x27;', ''''),
    '&#039;', ''''),
    '&#x22;', '"'),
    '&quot;', '"'),
    '&amp;', '&'),
    '&lt;', '<'),
    '&gt;', '>'),
  back = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    back,
    '&#x27;', ''''),
    '&#039;', ''''),
    '&#x22;', '"'),
    '&quot;', '"'),
    '&amp;', '&'),
    '&lt;', '<'),
    '&gt;', '>');