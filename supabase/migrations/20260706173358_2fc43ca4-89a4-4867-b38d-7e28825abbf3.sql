ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS locale text
  CHECK (locale IS NULL OR locale IN ('en','es','pt-BR','fr','de','ja','hi','bn'));