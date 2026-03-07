-- Convert topics.category from text to text[] (Postgres text array)
ALTER TABLE topics
  ALTER COLUMN category TYPE text[]
  USING ARRAY[category];
