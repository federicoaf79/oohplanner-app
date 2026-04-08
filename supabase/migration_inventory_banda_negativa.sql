-- ============================================================
-- Migration: inventory — banda negativa
-- Ejecutar en Supabase SQL Editor
-- ============================================================

ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS banda_negativa_enabled  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS banda_negativa_rate      numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS banda_negativa_min_months integer DEFAULT 6;
