-- Fix: agregar columna brief_data a proposals si no existe
-- Ejecutar en Supabase SQL Editor si aparece el error:
-- "Could not find the brief_data column of proposals in the schema cache"

ALTER TABLE proposals
ADD COLUMN IF NOT EXISTS brief_data jsonb;
