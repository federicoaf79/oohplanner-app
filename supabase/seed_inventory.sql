-- ============================================================
-- Seed: 15 carteles OOH en CABA con coordenadas reales
-- 5 digitales (LED), 5 espectaculares (billboard), 5 medianeras (ambient)
-- IMPORTANTE: reemplazá 'ORG_ID_AQUI' con el UUID de tu org
-- ============================================================

DO $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Toma la primera org disponible (ajustá si tenés varias)
  SELECT id INTO v_org_id FROM organisations LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No hay organizaciones en la DB. Registrate primero.';
  END IF;

  -- ── DIGITALES (LED) ──────────────────────────────────────
  INSERT INTO inventory (org_id, name, code, format, address, city, latitude, longitude,
    width_ft, height_ft, illuminated, daily_traffic, base_rate, is_available)
  VALUES
    (v_org_id, 'Digital 9 de Julio & Corrientes', 'DIG-001', 'digital',
     'Av. 9 de Julio 1800', 'Buenos Aires (CABA)', -34.6037, -58.3816,
     16, 9, true, 95000, 120000, true),

    (v_org_id, 'Digital Corrientes & Pueyrredón', 'DIG-002', 'digital',
     'Av. Corrientes 3200', 'Buenos Aires (CABA)', -34.6027, -58.4043,
     12, 7, true, 72000, 95000, true),

    (v_org_id, 'Digital Santa Fe & Palermo', 'DIG-003', 'digital',
     'Av. Santa Fe 3400', 'Buenos Aires (CABA)', -34.5858, -58.4120,
     14, 8, true, 68000, 88000, true),

    (v_org_id, 'Digital Córdoba & Florida', 'DIG-004', 'digital',
     'Av. Córdoba 800', 'Buenos Aires (CABA)', -34.5989, -58.3754,
     10, 6, true, 80000, 105000, true),

    (v_org_id, 'Digital Cabildo & Juramento (Belgrano)', 'DIG-005', 'digital',
     'Av. Cabildo 1200', 'Buenos Aires (CABA)', -34.5721, -58.4558,
     12, 7, true, 61000, 82000, true),

  -- ── ESPECTACULARES (billboard) ───────────────────────────
    (v_org_id, 'Espectacular Autopista 25 de Mayo km 3', 'ESP-001', 'billboard',
     'Autopista 25 de Mayo km 3', 'Buenos Aires (CABA)', -34.6256, -58.4012,
     32, 14, true, 180000, 85000, true),

    (v_org_id, 'Espectacular Rivadavia & Nazca (Flores)', 'ESP-002', 'billboard',
     'Av. Rivadavia 6800', 'Buenos Aires (CABA)', -34.6282, -58.4752,
     24, 12, true, 95000, 55000, true),

    (v_org_id, 'Espectacular Belgrano & Lima', 'ESP-003', 'billboard',
     'Av. Belgrano 1500', 'Buenos Aires (CABA)', -34.6134, -58.3828,
     28, 12, true, 110000, 65000, true),

    (v_org_id, 'Espectacular Libertador & Pampa (Núñez)', 'ESP-004', 'billboard',
     'Av. del Libertador 6200', 'Buenos Aires (CABA)', -34.5478, -58.4580,
     32, 14, true, 140000, 75000, true),

    (v_org_id, 'Espectacular Rivadavia & Av. La Plata', 'ESP-005', 'billboard',
     'Av. Rivadavia 4600', 'Buenos Aires (CABA)', -34.6200, -58.4406,
     24, 10, true, 88000, 50000, true),

  -- ── MEDIANERAS (ambient) ─────────────────────────────────
    (v_org_id, 'Medianera Callao & Santa Fe', 'MED-001', 'ambient',
     'Av. Callao 1700', 'Buenos Aires (CABA)', -34.5950, -58.3940,
     20, 15, false, 42000, 32000, true),

    (v_org_id, 'Medianera Las Heras & Austria', 'MED-002', 'ambient',
     'Av. Las Heras 2100', 'Buenos Aires (CABA)', -34.5817, -58.3940,
     18, 12, false, 38000, 28000, true),

    (v_org_id, 'Medianera San Juan & Boedo', 'MED-003', 'ambient',
     'Av. San Juan 3800', 'Buenos Aires (CABA)', -34.6285, -58.4135,
     15, 10, false, 31000, 22000, true),

    (v_org_id, 'Medianera Cabildo & Federico Lacroze', 'MED-004', 'ambient',
     'Av. Cabildo 2800', 'Buenos Aires (CABA)', -34.5706, -58.4556,
     18, 14, false, 35000, 26000, true),

    (v_org_id, 'Medianera Alberdi & Av. Rivadavia', 'MED-005', 'ambient',
     'Av. Rivadavia 5200', 'Buenos Aires (CABA)', -34.6240, -58.4550,
     20, 13, false, 29000, 20000, true);

  RAISE NOTICE '✓ 15 carteles insertados para org_id: %', v_org_id;
END $$;
