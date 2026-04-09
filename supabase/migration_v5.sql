-- ============================================================
-- OOH Planner — v5: Facturación y mejoras de tickets
-- ============================================================

-- Tabla de facturas
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organisations(id),
  invoice_number text UNIQUE NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  plan_name text NOT NULL,
  amount_usd numeric NOT NULL,
  status text DEFAULT 'pending'
    CHECK (status IN ('pending','sent','paid','overdue')),
  recipient_email text,
  sent_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage invoices" ON invoices;
CREATE POLICY "admins manage invoices"
ON invoices FOR ALL
USING (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "orgs can view own invoices" ON invoices;
CREATE POLICY "orgs can view own invoices"
ON invoices FOR SELECT
USING (org_id = current_org_id());

-- Columna creator_email en support_tickets (para notificaciones de respuesta)
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS creator_email text,
  ADD COLUMN IF NOT EXISTS creator_name text;
