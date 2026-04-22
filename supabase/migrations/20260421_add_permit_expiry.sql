-- 20260421_add_permit_expiry.sql
-- Add permit_expiry column to inventory for tracking billboard permit expiration dates.
-- Queried by the notification dropdown (src/components/NotificationDropdown.jsx)
-- to surface permits expiring within 90 days.

ALTER TABLE inventory
ADD COLUMN IF NOT EXISTS permit_expiry DATE;

-- Partial index: only non-null values, which is what the notification query filters on.
CREATE INDEX IF NOT EXISTS idx_inventory_permit_expiry
  ON inventory (permit_expiry)
  WHERE permit_expiry IS NOT NULL;

COMMENT ON COLUMN inventory.permit_expiry IS
  'Fecha de vencimiento del permiso/habilitación del cartel. Se usa para alertas de renovación.';
