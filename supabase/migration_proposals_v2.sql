-- ============================================================
-- Migration: proposals v2
-- IMPORTANTE: la tabla ya tiene un campo "status" (proposal_status
-- enum: draft/sent/accepted/rejected). El ciclo de campaña usa
-- workflow_status (text) para no colisionar con ese enum.
-- Ejecutar en Supabase SQL Editor
-- ============================================================

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS workflow_status text DEFAULT 'pending'
    CHECK (workflow_status IN (
      'pending','approved','printing','installation','active','withdraw','renew'
    )),
  ADD COLUMN IF NOT EXISTS brief_data jsonb;

-- Historial de ediciones
CREATE TABLE IF NOT EXISTS proposal_history (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id   uuid        REFERENCES proposals(id) ON DELETE CASCADE,
  edited_by     uuid        REFERENCES profiles(id),
  field_changed text,
  old_value     text,
  new_value     text,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE proposal_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "org members read proposal_history" ON proposal_history
    FOR SELECT USING (
      proposal_id IN (
        SELECT id FROM proposals WHERE org_id = current_org_id()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "org members insert proposal_history" ON proposal_history
    FOR INSERT WITH CHECK (
      proposal_id IN (
        SELECT id FROM proposals WHERE org_id = current_org_id()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
