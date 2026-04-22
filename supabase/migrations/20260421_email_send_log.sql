-- 20260421_email_send_log.sql
-- Audit log + rate-limiting substrate for outbound emails.
--
-- Notes:
--   * org_id is nullable to accommodate admin-originated sends (admins live
--     in admin_users and may not have a profiles row). Per-org rate limits
--     apply when org_id is present; otherwise the edge function rate-limits
--     per sent_by.
--   * sent_by references auth.users(id), NOT profiles(id), so admin senders
--     without a profiles row can still be logged.
--   * No INSERT policy: inserts go through the send-email / send-support-
--     ticket edge functions with the service role. Clients cannot forge
--     audit rows.

CREATE TABLE IF NOT EXISTS email_send_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid REFERENCES organisations(id) ON DELETE SET NULL,
  sent_by         uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  subject         text NOT NULL,
  purpose         text NOT NULL CHECK (purpose IN ('invite','support','notification','admin')),
  resend_id       text,
  status          text NOT NULL CHECK (status IN ('sent','failed')),
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_log_org_created ON email_send_log(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_log_sent_by     ON email_send_log(sent_by, created_at DESC);

ALTER TABLE email_send_log ENABLE ROW LEVEL SECURITY;

-- Owners / managers see their own org's log
DROP POLICY IF EXISTS "email_log_select_org_leaders" ON email_send_log;
CREATE POLICY "email_log_select_org_leaders"
  ON email_send_log FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM profiles
      WHERE id = auth.uid() AND role IN ('owner','manager')
    )
  );

-- Admins see everything
DROP POLICY IF EXISTS "email_log_select_admins" ON email_send_log;
CREATE POLICY "email_log_select_admins"
  ON email_send_log FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()));
