-- ============================================================
-- OOH PLANNER — Schema completo
-- Idempotente: se puede ejecutar más de una vez sin errores.
-- Orden: extensiones → tipos → tablas → índices →
--        triggers updated_at → trigger auth → RLS → helpers
-- ============================================================

-- ============================================================
-- EXTENSIONES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TIPOS (solo crea si no existen)
-- ============================================================
DO $$ BEGIN
  CREATE TYPE user_role       AS ENUM ('owner', 'manager', 'salesperson');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE campaign_status AS ENUM ('draft', 'active', 'paused', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE site_format     AS ENUM ('billboard', 'transit', 'street_furniture', 'digital', 'ambient');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE proposal_status AS ENUM ('draft', 'sent', 'accepted', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- TABLAS
-- ============================================================

CREATE TABLE IF NOT EXISTS organisations (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  logo_url   TEXT,
  plan       TEXT NOT NULL DEFAULT 'starter',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id     UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  full_name  TEXT,
  avatar_url TEXT,
  role       user_role NOT NULL DEFAULT 'salesperson',
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  code          TEXT NOT NULL,
  format        site_format NOT NULL,
  address       TEXT,
  city          TEXT NOT NULL,
  latitude      NUMERIC(9,6),
  longitude     NUMERIC(9,6),
  width_ft      NUMERIC,
  height_ft     NUMERIC,
  illuminated   BOOLEAN NOT NULL DEFAULT FALSE,
  daily_traffic INTEGER,
  base_rate     NUMERIC(12,2),
  is_available  BOOLEAN NOT NULL DEFAULT TRUE,
  image_url     TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, code)
);

CREATE TABLE IF NOT EXISTS campaigns (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  client_name TEXT NOT NULL,
  status      campaign_status NOT NULL DEFAULT 'draft',
  budget      NUMERIC(14,2),
  start_date  DATE,
  end_date    DATE,
  owner_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_sites (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  site_id     UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  rate        NUMERIC(12,2),
  start_date  DATE,
  end_date    DATE,
  UNIQUE(campaign_id, site_id)
);

CREATE TABLE IF NOT EXISTS proposals (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  campaign_id  UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  client_name  TEXT NOT NULL,
  client_email TEXT,
  status       proposal_status NOT NULL DEFAULT 'draft',
  total_value  NUMERIC(14,2),
  valid_until  DATE,
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  pdf_url      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proposal_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  site_id     UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  rate        NUMERIC(12,2),
  duration    INTEGER,
  notes       TEXT
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_org_id       ON profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_inventory_org_id      ON inventory(org_id);
CREATE INDEX IF NOT EXISTS idx_inventory_city        ON inventory(city);
CREATE INDEX IF NOT EXISTS idx_campaigns_org_id      ON campaigns(org_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_owner_id    ON campaigns(owner_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sites_campaign ON campaign_sites(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sites_org    ON campaign_sites(org_id);
CREATE INDEX IF NOT EXISTS idx_proposals_org_id      ON proposals(org_id);
CREATE INDEX IF NOT EXISTS idx_proposals_created_by  ON proposals(created_by);

-- ============================================================
-- TRIGGER: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Crea cada trigger solo si no existe
DO $$ BEGIN
  CREATE TRIGGER trg_organisations_updated_at BEFORE UPDATE ON organisations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_proposals_updated_at BEFORE UPDATE ON proposals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_inventory_updated_at BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- TRIGGER: handle_new_user
--
-- Flujo A — registro owner nuevo:
--   metadata: { org_name: "Mi Empresa", full_name: "Ana García" }
--   → crea organisations + profiles (role = 'owner')
--
-- Flujo B — invitación de miembro:
--   metadata: { org_id: "<uuid>", full_name: "...", role: "manager" }
--   → crea solo profiles en la org existente
--
-- Fixes aplicados vs versión anterior:
--   1. search_path explícito en SECURITY DEFINER (obligatorio en Supabase)
--   2. Manejo de slug vacío (org_name con solo caracteres especiales)
--   3. Retry automático en colisión de slug UNIQUE (hasta 10 intentos)
--   4. Bloque EXCEPTION general que re-lanza con mensaje descriptivo
--      en lugar de dejar que Supabase Auth devuelva un error genérico
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public          -- requerido en Supabase para SECURITY DEFINER
AS $$
DECLARE
  v_org_id    UUID;
  v_org_name  TEXT;
  v_base_slug TEXT;
  v_slug      TEXT;
  v_attempt   INT := 0;
BEGIN

  -- ── Flujo A: nuevo owner ──────────────────────────────────
  IF (NEW.raw_user_meta_data->>'org_name') IS NOT NULL
     AND trim(NEW.raw_user_meta_data->>'org_name') <> ''
  THEN
    v_org_name  := trim(NEW.raw_user_meta_data->>'org_name');

    -- Genera slug: minúsculas, reemplaza no-alfanuméricos por '-', limpia extremos
    v_base_slug := trim(
                     both '-' from
                     regexp_replace(lower(v_org_name), '[^a-z0-9]+', '-', 'g')
                   );

    -- Fallback si el slug quedó vacío (ej: org_name = "!!!")
    IF v_base_slug = '' OR v_base_slug IS NULL THEN
      v_base_slug := 'org';
    END IF;

    v_slug := v_base_slug;

    -- Retry en colisión de slug (hasta 10 intentos con sufijo numérico)
    LOOP
      BEGIN
        INSERT INTO public.organisations (name, slug)
        VALUES (v_org_name, v_slug)
        RETURNING id INTO v_org_id;

        EXIT;  -- INSERT exitoso → salir del loop

      EXCEPTION WHEN unique_violation THEN
        v_attempt := v_attempt + 1;
        IF v_attempt > 10 THEN
          RAISE EXCEPTION 'handle_new_user: no se pudo generar slug único para "%"', v_org_name;
        END IF;
        v_slug := v_base_slug || '-' || v_attempt;
      END;
    END LOOP;

    INSERT INTO public.profiles (id, org_id, full_name, role)
    VALUES (
      NEW.id,
      v_org_id,
      NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), ''),
      'owner'
    );

  -- ── Flujo B: miembro invitado ─────────────────────────────
  ELSIF (NEW.raw_user_meta_data->>'org_id') IS NOT NULL THEN

    INSERT INTO public.profiles (id, org_id, full_name, role)
    VALUES (
      NEW.id,
      (NEW.raw_user_meta_data->>'org_id')::UUID,
      NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), ''),
      COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'salesperson')
    );

  END IF;

  RETURN NEW;

EXCEPTION WHEN others THEN
  -- Re-lanza con contexto para que aparezca en los logs de Supabase
  RAISE EXCEPTION 'handle_new_user falló (user_id: %, sqlerrm: %)', NEW.id, SQLERRM;
END;
$$;

-- Recrea el trigger (DROP + CREATE es la forma segura de actualizarlo)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- HELPERS RLS (SECURITY DEFINER + search_path para evitar
-- recursión de políticas y ataques de search_path injection)
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE organisations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory      ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns      ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals      ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_items ENABLE ROW LEVEL SECURITY;

-- Elimina policies previas para que el script sea idempotente
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies
           WHERE schemaname = 'public'
           AND tablename IN ('organisations','profiles','inventory',
                             'campaigns','campaign_sites','proposals','proposal_items')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ── ORGANISATIONS ────────────────────────────────────────────
-- INSERT solo lo hace el trigger (SECURITY DEFINER), nunca el cliente.
CREATE POLICY "org_select_own"
  ON organisations FOR SELECT
  USING (id = public.current_org_id());

CREATE POLICY "org_update_owner"
  ON organisations FOR UPDATE
  USING (id = public.current_org_id() AND public.current_user_role() = 'owner');

-- ── PROFILES ────────────────────────────────────────────────
-- INSERT solo lo hace el trigger (SECURITY DEFINER), nunca el cliente.
CREATE POLICY "profile_select_org"
  ON profiles FOR SELECT
  USING (org_id = public.current_org_id());

CREATE POLICY "profile_update_self_or_owner"
  ON profiles FOR UPDATE
  USING (
    id = auth.uid()
    OR (org_id = public.current_org_id() AND public.current_user_role() = 'owner')
  );

CREATE POLICY "profile_delete_owner"
  ON profiles FOR DELETE
  USING (org_id = public.current_org_id() AND public.current_user_role() = 'owner');

-- ── INVENTORY ───────────────────────────────────────────────
CREATE POLICY "inventory_select_org"
  ON inventory FOR SELECT
  USING (org_id = public.current_org_id());

CREATE POLICY "inventory_insert_manager_owner"
  ON inventory FOR INSERT
  WITH CHECK (org_id = public.current_org_id() AND public.current_user_role() IN ('owner','manager'));

CREATE POLICY "inventory_update_manager_owner"
  ON inventory FOR UPDATE
  USING (org_id = public.current_org_id() AND public.current_user_role() IN ('owner','manager'));

CREATE POLICY "inventory_delete_owner"
  ON inventory FOR DELETE
  USING (org_id = public.current_org_id() AND public.current_user_role() = 'owner');

-- ── CAMPAIGNS ───────────────────────────────────────────────
CREATE POLICY "campaigns_select_org"
  ON campaigns FOR SELECT
  USING (org_id = public.current_org_id());

CREATE POLICY "campaigns_insert_org"
  ON campaigns FOR INSERT
  WITH CHECK (org_id = public.current_org_id());

CREATE POLICY "campaigns_update_role"
  ON campaigns FOR UPDATE
  USING (
    org_id = public.current_org_id()
    AND (owner_id = auth.uid() OR public.current_user_role() IN ('owner','manager'))
  );

CREATE POLICY "campaigns_delete_manager_owner"
  ON campaigns FOR DELETE
  USING (org_id = public.current_org_id() AND public.current_user_role() IN ('owner','manager'));

-- ── CAMPAIGN_SITES ──────────────────────────────────────────
CREATE POLICY "campaign_sites_select_org"
  ON campaign_sites FOR SELECT
  USING (org_id = public.current_org_id());

CREATE POLICY "campaign_sites_insert_org"
  ON campaign_sites FOR INSERT
  WITH CHECK (org_id = public.current_org_id());

CREATE POLICY "campaign_sites_delete_org"
  ON campaign_sites FOR DELETE
  USING (org_id = public.current_org_id());

-- ── PROPOSALS ───────────────────────────────────────────────
CREATE POLICY "proposals_select_org"
  ON proposals FOR SELECT
  USING (org_id = public.current_org_id());

CREATE POLICY "proposals_insert_org"
  ON proposals FOR INSERT
  WITH CHECK (org_id = public.current_org_id());

CREATE POLICY "proposals_update_role"
  ON proposals FOR UPDATE
  USING (
    org_id = public.current_org_id()
    AND (created_by = auth.uid() OR public.current_user_role() IN ('owner','manager'))
  );

CREATE POLICY "proposals_delete_manager_owner"
  ON proposals FOR DELETE
  USING (org_id = public.current_org_id() AND public.current_user_role() IN ('owner','manager'));

-- ── PROPOSAL_ITEMS ──────────────────────────────────────────
CREATE POLICY "proposal_items_select_org"
  ON proposal_items FOR SELECT
  USING (org_id = public.current_org_id());

CREATE POLICY "proposal_items_insert_org"
  ON proposal_items FOR INSERT
  WITH CHECK (org_id = public.current_org_id());

CREATE POLICY "proposal_items_delete_org"
  ON proposal_items FOR DELETE
  USING (org_id = public.current_org_id());

-- ============================================================
-- VERIFICACIÓN (ejecuta al final para confirmar que todo existe)
-- ============================================================
DO $$
DECLARE
  missing TEXT := '';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user') THEN
    missing := missing || ' handle_new_user';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    missing := missing || ' on_auth_user_created';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organisations') THEN
    missing := missing || ' organisations';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    missing := missing || ' profiles';
  END IF;

  IF missing <> '' THEN
    RAISE WARNING 'Objetos faltantes tras ejecutar schema: %', missing;
  ELSE
    RAISE NOTICE '✓ Schema OOH Planner instalado correctamente';
  END IF;
END $$;
