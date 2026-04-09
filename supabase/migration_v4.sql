-- migration_v4.sql — Tabla de corredores publicitarios
-- Ejecutar en: Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS corridors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid REFERENCES organisations(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  inventory_ids uuid[],
  active      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE corridors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage corridors"
  ON corridors FOR ALL
  USING (org_id = public.current_org_id());
