-- ============================================================
-- FIX: Reasigna todos los carteles del inventario a la org
-- correcta (la que tiene al menos un owner registrado).
--
-- Ejecutar en Supabase SQL Editor (con rol service_role).
-- ============================================================

DO $$
DECLARE
  v_correct_org_id UUID;
  v_rows_updated   INT;
BEGIN
  -- Org con owner registrado (la real, no orgs de test vacías)
  SELECT o.id INTO v_correct_org_id
  FROM organisations o
  JOIN profiles p ON p.org_id = o.id AND p.role = 'owner'
  ORDER BY o.created_at DESC
  LIMIT 1;

  IF v_correct_org_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró una org con owner. Registrate primero.';
  END IF;

  -- Reasigna carteles que NO pertenecen a la org correcta
  UPDATE inventory
  SET org_id = v_correct_org_id
  WHERE org_id != v_correct_org_id;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  RAISE NOTICE '✓ org_id correcto: %', v_correct_org_id;
  RAISE NOTICE '✓ Carteles reasignados: %', v_rows_updated;
END $$;
