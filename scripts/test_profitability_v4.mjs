// Local verification script for profitability.js v2 extensions.
// Not shipped. Run with: node scripts/test_profitability_v4.mjs
//
// Expected outputs are commented next to each assertion.
// Success = all tests print reasonable numbers with no NaN or undefined.

import { calculateSiteProfitability } from '../src/lib/profitability.js';

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-US', { maximumFractionDigits: 0 }) : n);

const sampleSite = {
  id: 's1',
  name: 'Test Billboard 8x4',
  format: 'billboard',
  base_rate: 5_000_000,
  width_m: 8,
  height_m: 4,
  print_width_cm: 800,
  print_height_cm: 400,
  cost_rent: 1_500_000,
  cost_electricity: 100_000,
  cost_taxes: 150_000,
  cost_maintenance: 250_000,
  cost_imponderables: 0,
  cost_seller_commission_pct: 5,
  cost_agency_commission_pct: 1.5,
  cost_owner_commission_pct: 10,
  cost_owner_commission: 0,
};

const orgConfig = {
  has_internal_designer: false,
  internal_designer_price_per_billboard: 20_000,
  external_designer_cost_per_hour: 20_000,
  external_designer_markup_pct: 30,
  external_designer_default_hours: 3.5,
  colocacion_cost_per_m2: 25_000,
  colocacion_markup_pct: 30,
  impresion_cost_per_m2: 32_500,
  impresion_markup_pct: 30,
};

// ─────────────────────────────────────────────────────────────────────────
// Test 1: modelo nuevo sin ajustes — happy path
// ─────────────────────────────────────────────────────────────────────────
const r1 = calculateSiteProfitability(sampleSite, {
  months: 2,
  itemRate: 5_000_000,
  discountPct: 0,
  sellerCommissionPct: 5,
  agencyCommissionPct: 1.5,
  orgProduccionConfig: orgConfig,
  produccionAjustes: {},
});

console.log('── Test 1 — Sin ajustes ───────────────────────────────────────');
console.log('  Area m²:                ', 8 * 4, '(8m × 4m)');
console.log('  Impresión real:         ', fmt(r1.cost_breakdown.impresion_real),  '  (expected 32500 × 32 = 1,040,000)');
console.log('  Impresión standard:     ', fmt(r1.cost_breakdown.impresion_standard), '  (expected × 1.30 = 1,352,000)');
console.log('  Colocación real:        ', fmt(r1.cost_breakdown.colocacion_real), '  (expected 25000 × 32 = 800,000)');
console.log('  Colocación standard:    ', fmt(r1.cost_breakdown.colocacion_standard), '  (expected × 1.30 = 1,040,000)');
console.log('  Diseño real:            ', fmt(r1.cost_breakdown.diseno_real),   '  (expected 20000 × 3.5 = 70,000)');
console.log('  Diseño standard:        ', fmt(r1.cost_breakdown.diseno_standard), '  (expected × 1.30 = 91,000)');
console.log('  Producción costo real:  ', fmt(r1.cost_breakdown.produccion_costo_real), '  (expected 1,910,000)');
console.log('  Producción cobrada std: ', fmt(r1.cost_breakdown.produccion_cobrada_standard), '  (expected 2,483,000)');
console.log('  Producción cobrada efec:', fmt(r1.cost_breakdown.produccion_cobrada_efectiva), '  (expected = std)');
console.log('  Producción profit:      ', fmt(r1.cost_breakdown.produccion_profit), '  (expected 573,000)');
console.log('  Alquiler net:           ', fmt(r1.alquiler_net), '  (expected 10,000,000)');
console.log('  Revenue total:          ', fmt(r1.revenue_total), '  (expected 12,483,000)');
console.log('  Cost total:             ', fmt(r1.cost_total));
console.log('  Margin:                 ', fmt(r1.margin));
console.log('  Margin %:               ', r1.margin_pct.toFixed(2) + '%');

// ─────────────────────────────────────────────────────────────────────────
// Test 2: bonificación -50% colocación → margen debe BAJAR
// ─────────────────────────────────────────────────────────────────────────
const r2 = calculateSiteProfitability(sampleSite, {
  months: 2,
  itemRate: 5_000_000,
  discountPct: 0,
  sellerCommissionPct: 5,
  agencyCommissionPct: 1.5,
  orgProduccionConfig: orgConfig,
  produccionAjustes: { colocacionPct: -50 },
});

console.log('\n── Test 2 — Colocación -50% ────────────────────────────────────');
console.log('  Colocación efectiva:    ', fmt(r2.cost_breakdown.colocacion_efectiva), '  (expected = std × 0.5 = 520,000)');
console.log('  Producción cobrada efec:', fmt(r2.cost_breakdown.produccion_cobrada_efectiva));
console.log('  Bonificación total:     ', fmt(r2.cost_breakdown.produccion_bonificacion_total), '  (expected 520,000)');
console.log('  Margin %:               ', r2.margin_pct.toFixed(2) + '%');
console.log('  Δ vs Test 1:            ', (r2.margin_pct - r1.margin_pct).toFixed(2) + ' pp (debe ser < 0)');

// ─────────────────────────────────────────────────────────────────────────
// Test 3: colocación deshabilitada completamente
// ─────────────────────────────────────────────────────────────────────────
const r3 = calculateSiteProfitability(sampleSite, {
  months: 2,
  itemRate: 5_000_000,
  discountPct: 0,
  sellerCommissionPct: 5,
  agencyCommissionPct: 1.5,
  orgProduccionConfig: orgConfig,
  produccionAjustes: { colocacionDisabled: true },
});

console.log('\n── Test 3 — Colocación disabled ────────────────────────────────');
console.log('  Colocación efectiva:    ', fmt(r3.cost_breakdown.colocacion_efectiva), '  (expected 0)');
console.log('  Producción cobrada efec:', fmt(r3.cost_breakdown.produccion_cobrada_efectiva), '  (= impresión_std + diseño_std)');
console.log('  Bonificación total:     ', fmt(r3.cost_breakdown.produccion_bonificacion_total), '  (expected 1,040,000)');
console.log('  Margin %:               ', r3.margin_pct.toFixed(2) + '%');

// ─────────────────────────────────────────────────────────────────────────
// Test 4: backwards compat — sin orgProduccionConfig, usa site costs viejos
// ─────────────────────────────────────────────────────────────────────────
const r4 = calculateSiteProfitability(
  {
    ...sampleSite,
    cost_print_per_m2: 32_500,
    cost_colocation: 200_000,
    cost_design: 70_000,
  },
  {
    months: 2,
    itemRate: 5_000_000,
    discountPct: 0,
  }
);

console.log('\n── Test 4 — Backwards compat (sin orgProduccionConfig) ─────────');
console.log('  Alquiler net:           ', fmt(r4.alquiler_net));
console.log('  Revenue total:          ', fmt(r4.revenue_total), '  (expected = alquiler_net, sin producción al cliente)');
console.log('  Producción costo real:  ', fmt(r4.cost_breakdown.produccion_costo_real), '  (expected 1,310,000 = 1,040,000 + 200,000 + 70,000)');
console.log('  Producción cobrada efec:', fmt(r4.cost_breakdown.produccion_cobrada_efectiva), '  (expected 0)');
console.log('  Cost total:             ', fmt(r4.cost_total), '  (V1 formula preserved)');
console.log('  Margin %:               ', r4.margin_pct.toFixed(2) + '%', '  (should match V1 for same site)');

// ─────────────────────────────────────────────────────────────────────────
// Test 5: digital → print + colocación = 0 (solo diseño cuenta)
// ─────────────────────────────────────────────────────────────────────────
const digitalSite = { ...sampleSite, format: 'digital' };
const r5 = calculateSiteProfitability(digitalSite, {
  months: 2,
  itemRate: 5_000_000,
  discountPct: 0,
  sellerCommissionPct: 5,
  agencyCommissionPct: 1.5,
  orgProduccionConfig: orgConfig,
});

console.log('\n── Test 5 — Digital (sin producción física) ────────────────────');
console.log('  Impresión real:         ', fmt(r5.cost_breakdown.impresion_real), '  (expected 0)');
console.log('  Colocación real:        ', fmt(r5.cost_breakdown.colocacion_real), '  (expected 0)');
console.log('  Diseño std:             ', fmt(r5.cost_breakdown.diseno_standard), '  (expected 91,000)');
console.log('  Producción cobrada std: ', fmt(r5.cost_breakdown.produccion_cobrada_standard), '  (expected = diseño_std)');

// ─────────────────────────────────────────────────────────────────────────
// Test 6: diseñador interno → usa precio simbólico, no cost/hora
// ─────────────────────────────────────────────────────────────────────────
const orgConfigInternal = { ...orgConfig, has_internal_designer: true };
const r6 = calculateSiteProfitability(sampleSite, {
  months: 2,
  itemRate: 5_000_000,
  discountPct: 0,
  sellerCommissionPct: 5,
  agencyCommissionPct: 1.5,
  orgProduccionConfig: orgConfigInternal,
});

console.log('\n── Test 6 — Diseñador interno ──────────────────────────────────');
console.log('  Diseño real:            ', fmt(r6.cost_breakdown.diseno_real), '  (expected 0 — está en nómina)');
console.log('  Diseño standard:        ', fmt(r6.cost_breakdown.diseno_standard), '  (expected 20,000 — precio simbólico)');
console.log('  Producción cobrada std: ', fmt(r6.cost_breakdown.produccion_cobrada_standard), '  (expected 1,352k+1,040k+20k = 2,412,000)');

// ─────────────────────────────────────────────────────────────────────────
// Test 7: markup 0% → cobrada = real (cliente paga a costo)
// ─────────────────────────────────────────────────────────────────────────
const orgConfigZeroMarkup = {
  ...orgConfig,
  impresion_markup_pct: 0,
  colocacion_markup_pct: 0,
  external_designer_markup_pct: 0,
};
const r7 = calculateSiteProfitability(sampleSite, {
  months: 2,
  itemRate: 5_000_000,
  discountPct: 0,
  sellerCommissionPct: 5,
  agencyCommissionPct: 1.5,
  orgProduccionConfig: orgConfigZeroMarkup,
});

console.log('\n── Test 7 — Markup 0% ──────────────────────────────────────────');
console.log('  Producción costo real:  ', fmt(r7.cost_breakdown.produccion_costo_real));
console.log('  Producción cobrada std: ', fmt(r7.cost_breakdown.produccion_cobrada_standard), '  (expected = real, sin ganancia)');
console.log('  Producción profit:      ', fmt(r7.cost_breakdown.produccion_profit), '  (expected 0)');

console.log('\n✓ Todos los tests completados — verificar valores arriba.\n');
