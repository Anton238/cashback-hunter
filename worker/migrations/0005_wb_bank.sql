INSERT INTO banks (name)
SELECT 'WB Банк'
WHERE NOT EXISTS (
  SELECT 1 FROM banks WHERE lower(replace(replace(trim(name), ' ', ''), '-', '')) IN ('wbбанк', 'wbbank', 'вббанк', 'wildberriesбанк', 'wildberriesbank')
);
