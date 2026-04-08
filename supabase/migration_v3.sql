-- ============================================================
-- Migration V3: Descuentos, Formatos, Clusters, Costos Inventario
-- Ejecutar en Supabase SQL Editor con rol service_role
-- ============================================================

-- ── FEATURE 1: Descuentos en propuestas ──────────────────────

ALTER TABLE proposals
ADD COLUMN IF NOT EXISTS discount_pct         numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_approved_by uuid REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS discount_approved_at timestamptz,
ADD COLUMN IF NOT EXISTS discount_approver_role text;

ALTER TABLE organisations
ADD COLUMN IF NOT EXISTS max_discount_salesperson numeric DEFAULT 20,
ADD COLUMN IF NOT EXISTS max_discount_manager     numeric DEFAULT 30;

-- Agregar meta mensual por vendedor para el semáforo del dashboard
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS monthly_target_ars numeric DEFAULT 0;

-- ── FEATURE 3: Formatos extensibles ──────────────────────────

CREATE TABLE IF NOT EXISTS formats (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid REFERENCES organisations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  type            text CHECK (type IN (
                    'digital','billboard','ambient','poster',
                    'urban_furniture','urban_furniture_digital','mobile_screen'
                  )),
  is_digital      boolean DEFAULT false,
  is_mobile       boolean DEFAULT false,
  is_illuminated  boolean DEFAULT false,
  default_width_m  numeric,
  default_height_m numeric,
  description     text,
  active          boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

-- Formatos globales (org_id NULL = disponibles para todas las orgs)
INSERT INTO formats (name, type, is_digital, is_illuminated, description) VALUES
  ('Digital LED',             'digital',              true,  true,  'Pantallas electrónicas con rotación de spots en tiempo real'),
  ('Espectacular',            'billboard',            false, true,  'Carteles grandes iluminados en rutas y avenidas principales'),
  ('Medianera',               'ambient',              false, false, 'Carteles pintados o impresos en paredes de edificios'),
  ('Afiche papel',            'poster',               false, false, 'Afiches de papel en soportes fijos'),
  ('Mobiliario urbano papel', 'urban_furniture',      false, false, 'Soportes en mobiliario urbano con impresión en papel'),
  ('Mobiliario urbano digital','urban_furniture_digital',true, true,'Pantallas digitales en mobiliario urbano'),
  ('Pantalla móvil',          'mobile_screen',        true,  true,  'Pantalla LED sobre vehículo en movimiento, recorrido programado')
ON CONFLICT DO NOTHING;

-- ── FEATURE 4: Clusters de audiencia ─────────────────────────

CREATE TABLE IF NOT EXISTS audience_clusters (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name      text NOT NULL,
  age_min   integer,
  age_max   integer,
  gender    text CHECK (gender IN ('all','male','female')),
  nse       text[],
  interests text[],
  zones     jsonb,
  source    text,
  active    boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

INSERT INTO audience_clusters (name, age_min, age_max, gender, nse, interests, source) VALUES
  ('Urban commuter CABA',        25, 45, 'all', ARRAY['ABC1','C2'],       ARRAY['tecnologia','finanzas','retail'],           'INDEC + SAIMO 2024'),
  ('Familia ABC1 zona norte GBA',30, 55, 'all', ARRAY['ABC1'],            ARRAY['retail','gastronomia','moda'],              'INDEC + SAIMO 2024'),
  ('Jóvenes Palermo/Soho',       18, 30, 'all', ARRAY['C2','C3'],         ARRAY['entretenimiento','moda','gastronomia'],     'INDEC + SAIMO 2024'),
  ('Ejecutivos microcentro',     30, 50, 'all', ARRAY['ABC1'],            ARRAY['finanzas','tecnologia','automotriz'],       'INDEC + SAIMO 2024'),
  ('Familias GBA oeste',         25, 45, 'all', ARRAY['C2','C3'],         ARRAY['retail','salud','entretenimiento'],         'INDEC + SAIMO 2024'),
  ('Automovilistas rutas',       25, 55, 'all', ARRAY['ABC1','C2','C3'],  ARRAY['automotriz','gastronomia'],                 'INDEC + SAIMO 2024')
ON CONFLICT DO NOTHING;

-- ── FEATURE 5: Columnas de costo en inventario ────────────────

ALTER TABLE inventory
ADD COLUMN IF NOT EXISTS photo_url                  text,
ADD COLUMN IF NOT EXISTS format_id                  uuid REFERENCES formats(id),
ADD COLUMN IF NOT EXISTS cost_rent                  numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS cost_electricity           numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS cost_taxes                 numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS cost_maintenance           numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS cost_imponderables         numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS cost_owner_commission      numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS cost_print_per_m2          numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS cost_installation          numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS cost_design               numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS cost_seller_commission_pct numeric DEFAULT 5,
ADD COLUMN IF NOT EXISTS cost_agency_commission_pct numeric DEFAULT 0;

-- ── RLS para nuevas tablas ────────────────────────────────────

ALTER TABLE formats           ENABLE ROW LEVEL SECURITY;
ALTER TABLE audience_clusters ENABLE ROW LEVEL SECURITY;

-- Formatos: lectura libre (globales + de la propia org)
CREATE POLICY "formats_select"
  ON formats FOR SELECT
  USING (org_id IS NULL OR org_id = public.current_org_id());

CREATE POLICY "formats_insert"
  ON formats FOR INSERT
  WITH CHECK (org_id = public.current_org_id()
    AND public.current_user_role() IN ('owner','manager'));

CREATE POLICY "formats_update"
  ON formats FOR UPDATE
  USING (org_id = public.current_org_id()
    AND public.current_user_role() IN ('owner','manager'));

CREATE POLICY "formats_delete"
  ON formats FOR DELETE
  USING (org_id = public.current_org_id()
    AND public.current_user_role() = 'owner');

-- Clusters: lectura pública (datos de referencia sin datos privados)
CREATE POLICY "audience_clusters_select"
  ON audience_clusters FOR SELECT
  USING (true);
