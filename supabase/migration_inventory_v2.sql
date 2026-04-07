-- ============================================================
-- Migration: inventory v2
-- Agregar owner_type, available_until y campos de costos
-- Ejecutar en Supabase SQL Editor
-- ============================================================

ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS owner_type         text NOT NULL DEFAULT 'owned'
    CHECK (owner_type IN ('owned', 'rented')),
  ADD COLUMN IF NOT EXISTS available_until    timestamptz,
  ADD COLUMN IF NOT EXISTS monthly_rent       numeric(12,2),
  ADD COLUMN IF NOT EXISTS monthly_electricity numeric(12,2),
  ADD COLUMN IF NOT EXISTS monthly_taxes      numeric(12,2);
