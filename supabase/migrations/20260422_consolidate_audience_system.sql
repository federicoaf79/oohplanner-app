-- 20260422_consolidate_audience_system.sql
-- Consolidation migration: versions the audience-system schema that was
-- originally added to production via the Supabase Dashboard.
--
-- Idempotent: uses IF NOT EXISTS on every ADD COLUMN and CREATE TABLE.
-- Safe to run against the live DB (where these objects already exist) and
-- against a fresh deploy (where it materialises the whole schema).
--
-- Consumers:
--   * supabase/functions/calculate-audience-reach/index.ts
--       reads inventory.{audience_profile, estimated_daily_reach,
--       visibility_score, zone_name}
--   * supabase/functions/plan-pauta/index.ts
--       reads inventory.cluster_audiencia
--   * src/features/proposals/WizardStep3Results.jsx +
--     src/components/AudienceMetrics.jsx
--       invoke calculate-audience-reach and render the payload
--
-- NOTE on PostGIS: the geographic_audience_profiles.geometry column requires
-- the PostGIS extension. Supabase projects enable it per-project. The line
-- below is a safety net for fresh deploys — on projects where it's already
-- enabled it's a no-op.

CREATE EXTENSION IF NOT EXISTS postgis;

-- ── inventory: audience-related columns ──────────────────────────────
ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS cluster_audiencia           text,
  ADD COLUMN IF NOT EXISTS audience_source             text DEFAULT 'propio',
  ADD COLUMN IF NOT EXISTS zone_name                   varchar,
  ADD COLUMN IF NOT EXISTS audience_profile            jsonb,
  ADD COLUMN IF NOT EXISTS estimated_daily_reach       integer,
  ADD COLUMN IF NOT EXISTS visibility_score            numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS audience_data_calculated_at timestamptz,
  ADD COLUMN IF NOT EXISTS audience_data_version       integer DEFAULT 1;

-- ── geographic_audience_profiles ─────────────────────────────────────
-- Zone-level reference data (demographics, footfall, mobility) keyed by
-- zone_name. No org_id — this is global reference data.
CREATE TABLE IF NOT EXISTS geographic_audience_profiles (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_name           varchar NOT NULL,
  zone_type           varchar NOT NULL,
  provincia           varchar DEFAULT 'CABA',
  geometry            geometry,
  poblacion_total     integer NOT NULL,
  densidad_hab_km2    integer NOT NULL,
  area_km2            numeric,
  demo_profile        jsonb NOT NULL DEFAULT '{}'::jsonb,
  interest_affinity   jsonb NOT NULL DEFAULT '{}'::jsonb,
  mobility_factors    jsonb NOT NULL DEFAULT '{}'::jsonb,
  base_daily_footfall integer NOT NULL,
  data_source         varchar DEFAULT 'CENSO_2022_ENMODO_2018',
  last_updated        timestamptz DEFAULT now(),
  created_at          timestamptz DEFAULT now()
);

-- ── points_of_interest ───────────────────────────────────────────────
-- POI catalog used to adjust billboard audience estimates based on nearby
-- attractions. Also global (no org_id).
CREATE TABLE IF NOT EXISTS points_of_interest (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    varchar NOT NULL,
  category                varchar NOT NULL,
  subcategory             varchar,
  latitude                numeric NOT NULL,
  longitude               numeric NOT NULL,
  zone_name               varchar,
  address                 text,
  daily_footfall_estimate integer NOT NULL DEFAULT 1000,
  catchment_radius_m      integer DEFAULT 300,
  operating_hours         jsonb,
  audience_attraction     jsonb DEFAULT '{}'::jsonb,
  data_source             varchar,
  verified                boolean DEFAULT false,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);
