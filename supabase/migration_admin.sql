-- ============================================================
-- OOH Planner — Admin & Profile Migration
-- ============================================================

-- ============================================================
-- MÓDULO 1: PANEL DE ADMINISTRACIÓN
-- ============================================================

-- Tabla admin_users
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  admin_role text DEFAULT 'admin'
    CHECK (admin_role IN ('super_admin', 'admin', 'support')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "solo super_admin gestiona admins" ON admin_users;
CREATE POLICY "solo super_admin gestiona admins"
ON admin_users FOR ALL
USING (EXISTS (
  SELECT 1 FROM admin_users a WHERE a.id = auth.uid()
  AND a.admin_role = 'super_admin'
));
-- Allow any admin to read (so AdminLayout can verify access)
DROP POLICY IF EXISTS "admins can read own row" ON admin_users;
CREATE POLICY "admins can read own row"
ON admin_users FOR SELECT
USING (id = auth.uid());

-- Campos nuevos en organisations (módulo 1 — suscripción y facturación)
ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz
    DEFAULT (now() + interval '7 days'),
  ADD COLUMN IF NOT EXISTS subscription_status text
    DEFAULT 'trial'
    CHECK (subscription_status IN ('trial','active','expired','suspended')),
  ADD COLUMN IF NOT EXISTS plan_price_usd numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_contact text,
  ADD COLUMN IF NOT EXISTS billing_phone text,
  ADD COLUMN IF NOT EXISTS billing_address text,
  ADD COLUMN IF NOT EXISTS billing_cuit text,
  ADD COLUMN IF NOT EXISTS billing_razon_social text,
  ADD COLUMN IF NOT EXISTS billing_email text,
  ADD COLUMN IF NOT EXISTS notes text;

-- Tabla de planes configurables
CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  price_usd numeric NOT NULL DEFAULT 0,
  max_users integer DEFAULT 5,
  max_inventory integer DEFAULT 50,
  max_proposals_per_month integer DEFAULT 20,
  features text[],
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins can manage plans" ON plans;
CREATE POLICY "admins can manage plans"
ON plans FOR ALL
USING (EXISTS (
  SELECT 1 FROM admin_users WHERE id = auth.uid()
));
DROP POLICY IF EXISTS "authenticated can read active plans" ON plans;
CREATE POLICY "authenticated can read active plans"
ON plans FOR SELECT
USING (auth.role() = 'authenticated' AND is_active = true);

-- Seed planes iniciales
INSERT INTO plans (name, slug, price_usd, max_users,
  max_inventory, max_proposals_per_month, features, sort_order)
VALUES
  ('Starter', 'starter', 200, 5, 50, 20,
   ARRAY['Soporte por email'], 1),
  ('Pro', 'pro', 450, 15, 200, 100,
   ARRAY['Reportes avanzados','Soporte prioritario'], 2),
  ('Custom', 'custom', 0, 999, 999, 999,
   ARRAY['Customización total','Onboarding dedicado'], 3)
ON CONFLICT (slug) DO NOTHING;

-- Tabla de tickets de soporte
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organisations(id),
  created_by uuid REFERENCES profiles(id),
  subject text NOT NULL,
  message text,
  status text DEFAULT 'open'
    CHECK (status IN ('open','in_progress','resolved','closed')),
  priority text DEFAULT 'normal'
    CHECK (priority IN ('low','normal','high','urgent')),
  admin_notes text,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org members can create tickets" ON support_tickets;
CREATE POLICY "org members can create tickets"
ON support_tickets FOR INSERT
WITH CHECK (org_id = current_org_id());
DROP POLICY IF EXISTS "org members can view own tickets" ON support_tickets;
CREATE POLICY "org members can view own tickets"
ON support_tickets FOR SELECT
USING (org_id = current_org_id());
DROP POLICY IF EXISTS "admins can manage all tickets" ON support_tickets;
CREATE POLICY "admins can manage all tickets"
ON support_tickets FOR ALL
USING (EXISTS (
  SELECT 1 FROM admin_users WHERE id = auth.uid()
));

-- ============================================================
-- MÓDULO 2: PERFIL DE EMPRESA Y USUARIO
-- ============================================================

-- Campos nuevos en organisations (módulo 2 — datos de empresa)
ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS office_address text,
  ADD COLUMN IF NOT EXISTS office_phone text,
  ADD COLUMN IF NOT EXISTS office_hours text,
  ADD COLUMN IF NOT EXISTS website text;

-- Campos nuevos en profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS office_hours text,
  ADD COLUMN IF NOT EXISTS bio text;

-- ============================================================
-- POLÍTICAS ADMIN PARA ACCESO CROSS-ORG
-- ============================================================

-- Admins pueden leer y editar todas las organizaciones
DROP POLICY IF EXISTS "admins can read all orgs" ON organisations;
CREATE POLICY "admins can read all orgs"
ON organisations FOR SELECT
USING (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "admins can update all orgs" ON organisations;
CREATE POLICY "admins can update all orgs"
ON organisations FOR UPDATE
USING (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "admins can insert orgs" ON organisations;
CREATE POLICY "admins can insert orgs"
ON organisations FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()));

-- Admins pueden leer todos los perfiles
DROP POLICY IF EXISTS "admins can read all profiles" ON profiles;
CREATE POLICY "admins can read all profiles"
ON profiles FOR SELECT
USING (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()));

-- Admins pueden leer todo el inventario
DROP POLICY IF EXISTS "admins can read all inventory" ON inventory;
CREATE POLICY "admins can read all inventory"
ON inventory FOR SELECT
USING (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()));

-- Admins pueden leer todas las propuestas
DROP POLICY IF EXISTS "admins can read all proposals" ON proposals;
CREATE POLICY "admins can read all proposals"
ON proposals FOR SELECT
USING (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()));
