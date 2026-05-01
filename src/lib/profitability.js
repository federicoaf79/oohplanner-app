/**
 * src/lib/profitability.js
 *
 * Fuente única de verdad para el cálculo de rentabilidad en OOH Planner.
 * Mirrors la lógica de supabase/functions/plan-pauta/index.ts::calcMargin.
 * Si cambia la fórmula acá, cambiarla allá también.
 *
 * Consumidores:
 *   - src/pages/app/Campaigns.jsx         → calculateProposalProfitability (donut por propuesta)
 *   - src/pages/app/Reports.jsx           → calculateSiteProfitability + calculateMonthlyFleetMargin
 *   - src/pages/app/Dashboard.jsx         → calculateSiteProfitability (opportunity ranker)
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * MODELO V2 (2026-04-25) — Producción pass-through con markup granular
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * El dueño compra producción (impresión + colocación + diseño) a proveedores
 * y la revende al cliente con markup. Configurado a nivel ORGANIZACIÓN, no por
 * cartel. En Campaign (post-aceptación) se pueden aplicar bonificaciones o
 * descuentos por item. Comisiones no cambian: siguen calculándose sobre
 * alquiler_net (revenue del espacio).
 *
 * orgProduccionConfig (nuevo, opcional):
 *   { has_internal_designer, internal_designer_price_per_billboard,
 *     external_designer_cost_per_hour, external_designer_markup_pct,
 *     external_designer_default_hours,
 *     colocacion_cost_per_m2, colocacion_markup_pct,
 *     impresion_cost_per_m2, impresion_markup_pct }
 *
 * produccionAjustes (nuevo, opcional, per-item):
 *   { printPct, colocacionPct, disenoPct,
 *     printDisabled, colocacionDisabled, disenoDisabled,
 *     montoFijo }
 *
 * Producción se factura ONE-TIME al inicio de campaña (item.start_date).
 * calculateMonthlyFleetMargin solo suma producción en el mes de start_date.
 *
 * Backwards compat: si orgProduccionConfig es null, trata cost_print_per_m2,
 * cost_colocation, cost_design como costos internos que reducen margen.
 * Margin resultante = margin del modelo V1.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * FÓRMULA V2
 * ──────────────────────────────────────────────────────────────────────────────
 *
 *   months         = item.duration ?? monthsByCalendar(item.start, item.end)
 *                    ?? monthsByCalendar(proposal.start, proposal.end)
 *   discount       = item.discount_pct ?? proposal.discount_pct ?? 0
 *   revenue_gross  = rate × months
 *   alquiler_net   = revenue_gross × (1 - discount/100)
 *
 *   [si orgProduccionConfig — MODELO NUEVO]
 *   produccion_costo_real     = impresion_real + colocacion_real + diseno_real
 *   produccion_cobrada_std    = impresion_std  + colocacion_std  + diseno_std
 *   produccion_cobrada_efec   = std × (1 + ajuste_pct/100) por componente
 *                               - monto_fijo global
 *                               (componentes disabled → 0)
 *
 *   [si !orgProduccionConfig — BACKWARDS COMPAT]
 *   produccion_costo_real     = cost_print_per_m2×area + cost_colocation + cost_design
 *   produccion_cobrada_std    = 0  (no charge to client)
 *   produccion_cobrada_efec   = 0
 *
 *   fixed_prorated = (cost_rent + cost_electricity + cost_taxes
 *                    + cost_maintenance + cost_imponderables) × months
 *
 *   seller_comm = alquiler_net × seller_pct/100       [SIN CAMBIOS]
 *   agency_comm = alquiler_net × agency_pct/100       [SIN CAMBIOS]
 *   owner_comm  = alquiler_net × cost_owner_commission_pct/100 + cost_owner_commission
 *
 *   revenue_total = alquiler_net + produccion_cobrada_efec
 *   cost_total    = fixed_prorated + produccion_costo_real
 *                 + seller_comm + agency_comm + owner_comm
 *
 *   margin     = revenue_total - cost_total
 *   margin_pct = margin / revenue_total × 100
 */

const DIGITAL_FORMATS = new Set(['digital', 'urban_furniture_digital']);

const toNum = (v) => (Number.isFinite(+v) ? +v : 0);

/** Días calendario inclusivos entre dos fechas. 0 si inválido. */
// eslint-disable-next-line no-unused-vars
function daysBetween(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start) || isNaN(end) || end < start) return 0;
  const MS_DAY = 1000 * 60 * 60 * 24;
  return Math.round((end - start) / MS_DAY) + 1;
}

/**
 * Meses calendario entre dos fechas, respetando días reales de cada mes
 * (28/29 feb, 30 abr/jun/sep/nov, 31 el resto). 1 mes entero = 1.0 exacto.
 */
export function monthsByCalendar(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start) || isNaN(end) || end < start) return 0;

  const MS_DAY = 1000 * 60 * 60 * 24;
  let total = 0;
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);

  while (cursor <= end) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month, daysInMonth);
    const periodStart = start > monthStart ? start : monthStart;
    const periodEnd = end < monthEnd ? end : monthEnd;
    const daysInPeriod = Math.round((periodEnd - periodStart) / MS_DAY) + 1;
    total += daysInPeriod / daysInMonth;
    cursor = new Date(year, month + 1, 1);
  }

  return total;
}

/**
 * Área imprimible en m².
 *   Prioridad 1: print_width_cm × print_height_cm / 10_000   (columna explícita)
 *   Prioridad 2: width_m × height_m                          (dimensión física — fallback)
 */
function printAreaM2(site) {
  const wCm = toNum(site?.print_width_cm);
  const hCm = toNum(site?.print_height_cm);
  if (wCm > 0 && hCm > 0) return (wCm * hCm) / 10_000;
  const wM = toNum(site?.width_m);
  const hM = toNum(site?.height_m);
  return wM * hM;
}

/** Días de overlap entre dos rangos de fechas (0 si no se tocan). */
function overlapDays(aStart, aEnd, bStart, bEnd) {
  if (!aStart || !aEnd || !bStart || !bEnd) return 0;
  const start = aStart > bStart ? aStart : bStart;
  const end = aEnd < bEnd ? aEnd : bEnd;
  if (end < start) return 0;
  const MS_DAY = 1000 * 60 * 60 * 24;
  return Math.round((end - start) / MS_DAY) + 1;
}

/** True si `date` cae dentro del rango [mStart, mEnd] (inclusive). */
function dateInRange(date, mStart, mEnd) {
  if (!date) return false;
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d)) return false;
  return d >= mStart && d <= mEnd;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT 1 — Per-site profitability (pure math)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Rentabilidad de UN cartel bajo parámetros explícitos.
 * No lee de proposal/item — el caller provee los opts.
 *
 * @param site  fila de inventory con todos los cost_* + format + dimensiones
 * @param opts  {
 *   months:             duración efectiva en meses (default 1)
 *   itemRate:           precio pactado mensual; si null usa site.base_rate
 *   discountPct:        descuento al cliente (0..100) — aplicado a alquiler, no a producción
 *   sellerCommissionPct: override; si null usa site.cost_seller_commission_pct
 *   agencyCommissionPct: override global a nivel propuesta
 *   orgProduccionConfig: objeto con markups + costos de producción a nivel org (NUEVO V2)
 *                        si null → backwards compat (modelo V1)
 *   produccionAjustes:   ajustes per-item aplicados post-aceptación (NUEVO V2)
 *                        { printPct, colocacionPct, disenoPct,
 *                          printDisabled, colocacionDisabled, disenoDisabled,
 *                          montoFijo }
 * }
 */
export function calculateSiteProfitability(site, opts = {}) {
  const {
    months = 1,
    itemRate = null,
    discountPct = 0,
    sellerCommissionPct = null,
    agencyCommissionPct = 0,
    orgProduccionConfig = null,
    produccionAjustes = {},
  } = opts;

  if (!site) return null;

  const isDigital = DIGITAL_FORMATS.has(site.format);
  const areaM2 = printAreaM2(site);

  // ── Revenue del espacio (alquiler) ─────────────────────────────────────
  const ratePerMonth =
    itemRate != null
      ? toNum(itemRate)
      : toNum(site.base_rate) || toNum(site.sale_price);
  const revenueGross = ratePerMonth * months;
  const alquilerNet = revenueGross * (1 - toNum(discountPct) / 100);

  // ── Producción ─────────────────────────────────────────────────────────
  let impresionReal = 0, impresionStd = 0, impresionEfec = 0;
  let colocacionReal = 0, colocacionStd = 0, colocacionEfec = 0;
  let disenoReal = 0, disenoStd = 0, disenoEfec = 0;
  let produccionBonificacionMontoFijo = 0;

  if (orgProduccionConfig) {
    // ─── MODELO V2 — org config provista ──────────────────────────────
    const orgC = orgProduccionConfig;
    const aj = produccionAjustes || {};

    // Costos reales (lo que paga el dueño a proveedores)
    impresionReal = isDigital ? 0 : toNum(orgC.impresion_cost_per_m2) * areaM2;
    colocacionReal = isDigital ? 0 : toNum(orgC.colocacion_cost_per_m2) * areaM2;

    if (orgC.has_internal_designer) {
      // Diseñador en nómina → costo real = 0, se cobra un precio simbólico
      disenoReal = 0;
      disenoStd = toNum(orgC.internal_designer_price_per_billboard);
    } else {
      // Diseñador externo → costo real × markup
      disenoReal = toNum(orgC.external_designer_cost_per_hour) *
                   toNum(orgC.external_designer_default_hours);
      disenoStd = disenoReal * (1 + toNum(orgC.external_designer_markup_pct) / 100);
    }

    // Cobrado standard (con markups, sin ajustes)
    impresionStd = impresionReal * (1 + toNum(orgC.impresion_markup_pct) / 100);
    colocacionStd = colocacionReal * (1 + toNum(orgC.colocacion_markup_pct) / 100);

    // Cobrado efectivo (con ajustes item-level)
    impresionEfec = aj.printDisabled
      ? 0
      : impresionStd * (1 + toNum(aj.printPct) / 100);
    colocacionEfec = aj.colocacionDisabled
      ? 0
      : colocacionStd * (1 + toNum(aj.colocacionPct) / 100);
    disenoEfec = aj.disenoDisabled
      ? 0
      : disenoStd * (1 + toNum(aj.disenoPct) / 100);

    produccionBonificacionMontoFijo = toNum(aj.montoFijo);
  } else {
    // ─── BACKWARDS COMPAT (V1) ────────────────────────────────────────
    // Producción como costo interno del dueño. Client NO se le cobra separado.
    // Reduce margin como en el modelo V1. Mismo resultado que la fórmula
    // anterior (legacy consumers que no pasan orgProduccionConfig).
    impresionReal = isDigital
      ? 0
      : toNum(site.print_cost_per_m2) * areaM2; // cost_print_per_m2 deprecada (Sprint 6)
    colocacionReal = toNum(site.cost_colocation);
    disenoReal = toNum(site.cost_design);
    // Std / efec = 0 por diseño: en V1 no se cobraba producción al cliente.
    impresionStd = 0;  impresionEfec = 0;
    colocacionStd = 0; colocacionEfec = 0;
    disenoStd = 0;     disenoEfec = 0;
  }

  const produccionCostoReal = impresionReal + colocacionReal + disenoReal;
  const produccionCobradaStandard = impresionStd + colocacionStd + disenoStd;
  const produccionCobradaEfectiva = Math.max(
    0,
    impresionEfec + colocacionEfec + disenoEfec - produccionBonificacionMontoFijo
  );
  const produccionBonificacionTotal = produccionCobradaStandard - produccionCobradaEfectiva;
  const produccionProfit = produccionCobradaEfectiva - produccionCostoReal;

  // ── Costos estructurales prorrateados ──────────────────────────────────
  const fixedProrated =
    (toNum(site.cost_rent) +
      toNum(site.cost_electricity) +
      toNum(site.cost_taxes) +
      toNum(site.cost_maintenance) +
      toNum(site.cost_imponderables)) *
    months;

  // ── Comisiones (SIN CAMBIOS — siguen sobre alquiler_net) ──────────────
  const sellerPct =
    sellerCommissionPct != null
      ? toNum(sellerCommissionPct)
      : toNum(site.cost_seller_commission_pct);
  const sellerCommission = alquilerNet * (sellerPct / 100);
  const agencyCommission = alquilerNet * (toNum(agencyCommissionPct) / 100);
  // cost_owner_commission_pct + cost_owner_commission deprecadas (Sprint 6)
  // Comisiones de asociado ahora viven en site_commissions / campaign_commissions
  const ownerCommission = 0;
  const hiddenFacilitatorCommission = 0; // V1.1

  // ── Revenue total + costo total + margen ──────────────────────────────
  const revenueTotal = alquilerNet + produccionCobradaEfectiva;

  const costTotal =
    fixedProrated +
    produccionCostoReal +
    sellerCommission +
    agencyCommission +
    ownerCommission +
    hiddenFacilitatorCommission;

  const margin = revenueTotal - costTotal;
  const marginPct = revenueTotal > 0 ? (margin / revenueTotal) * 100 : 0;

  return {
    site_id: site.id,
    site_name: site.name,
    months,
    revenue_gross: revenueGross,
    alquiler_net: alquilerNet,
    revenue_total: revenueTotal,
    // backwards-compat alias: algunos consumidores leen revenue_net para "ingreso del alquiler"
    revenue_net: alquilerNet,
    cost_breakdown: {
      fixed_prorated: fixedProrated,
      produccion_costo_real: produccionCostoReal,
      produccion_cobrada_standard: produccionCobradaStandard,
      produccion_cobrada_efectiva: produccionCobradaEfectiva,
      produccion_profit: produccionProfit,
      produccion_bonificacion_total: produccionBonificacionTotal,
      impresion_real: impresionReal,
      impresion_standard: impresionStd,
      impresion_efectiva: impresionEfec,
      colocacion_real: colocacionReal,
      colocacion_standard: colocacionStd,
      colocacion_efectiva: colocacionEfec,
      diseno_real: disenoReal,
      diseno_standard: disenoStd,
      diseno_efectiva: disenoEfec,
      seller_commission: sellerCommission,
      agency_commission: agencyCommission,
      owner_commission: ownerCommission,
      hidden_facilitator_commission: hiddenFacilitatorCommission,
    },
    // backwards-compat: nombre viejo `costs` con las mismas 8 líneas que V1
    costs: {
      fixed_prorated: fixedProrated,
      colocation: colocacionReal,
      print: impresionReal,
      design: disenoReal,
      seller_commission: sellerCommission,
      agency_commission: agencyCommission,
      owner_commission: ownerCommission,
      hidden_facilitator_commission: hiddenFacilitatorCommission,
    },
    cost_total: costTotal,
    margin,
    margin_pct: marginPct,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT 2 — Per-proposal aggregator (drop-in para Campaigns.jsx)
// ═══════════════════════════════════════════════════════════════════════════

function resolveMonths(item, proposal) {
  if (toNum(item?.duration) > 0) return toNum(item.duration);
  const itemMonths = monthsByCalendar(item?.start_date, item?.end_date);
  if (itemMonths > 0) return itemMonths;
  return monthsByCalendar(proposal?.start_date, proposal?.end_date);
}

function extractSite(item) {
  return item?.site || item?.billboard || null;
}

/** Extrae orgProduccionConfig de un proposal. null si no está presente. */
function extractOrgProduccionConfig(proposal) {
  const org = proposal?.org || proposal?.organisation || proposal?.organization;
  if (!org) return null;
  // Verificamos que al menos UNA columna nueva esté presente; sino es una org pre-migration.
  const hasV2 =
    'has_internal_designer' in org ||
    'impresion_cost_per_m2' in org ||
    'colocacion_cost_per_m2' in org ||
    'external_designer_cost_per_hour' in org;
  return hasV2 ? org : null;
}

/** Construye el objeto produccionAjustes desde las columnas de un proposal_item. */
function extractProduccionAjustes(item) {
  return {
    printPct: toNum(item?.produccion_print_ajuste_pct),
    colocacionPct: toNum(item?.produccion_colocacion_ajuste_pct),
    disenoPct: toNum(item?.produccion_diseno_ajuste_pct),
    printDisabled: !!item?.produccion_print_disabled,
    colocacionDisabled: !!item?.produccion_colocacion_disabled,
    disenoDisabled: !!item?.produccion_diseno_disabled,
    montoFijo: toNum(item?.produccion_ajuste_monto_fijo),
  };
}

/**
 * Rentabilidad agregada de una propuesta completa.
 * Acepta proposals con items joined con inventory (alias 'site' o 'billboard')
 * y con la org embedded (alias 'org' o 'organisation').
 */
export function calculateProposalProfitability(proposal) {
  // Acepta alias: 'items' (shape canónico) o 'proposal_items' (como vienen del Supabase join).
  const items = Array.isArray(proposal?.items)
    ? proposal.items
    : Array.isArray(proposal?.proposal_items)
    ? proposal.proposal_items
    : [];

  const orgProduccionConfig = extractOrgProduccionConfig(proposal);

  // Agency Fee: global a la propuesta (fallback: primer site con pct > 0)
  const sites = items.map(extractSite).filter(Boolean);
  const firstWithAgency = sites.find((s) => toNum(s.cost_agency_commission_pct) > 0);
  const agencyCommissionPct =
    proposal?.agency_commission_pct != null
      ? toNum(proposal.agency_commission_pct)
      : proposal?.cost_agency_commission_pct != null
      ? toNum(proposal.cost_agency_commission_pct)
      : toNum(firstWithAgency?.cost_agency_commission_pct);

  const defaultSellerPct = toNum(proposal?.seller?.commission_pct);
  const defaultDiscountPct = toNum(proposal?.discount_pct);

  const perItem = items
    .map((item) => {
      const site = extractSite(item);
      if (!site) return null;
      const months = resolveMonths(item, proposal);
      const discountPct = toNum(item?.discount_pct ?? defaultDiscountPct);
      const sellerCommissionPct =
        site.cost_seller_commission_pct != null
          ? toNum(site.cost_seller_commission_pct)
          : defaultSellerPct;
      return calculateSiteProfitability(site, {
        months,
        itemRate: item?.rate,
        discountPct,
        sellerCommissionPct,
        agencyCommissionPct,
        orgProduccionConfig,
        produccionAjustes: extractProduccionAjustes(item),
      });
    })
    .filter(Boolean);

  const agg = perItem.reduce(
    (acc, pi) => {
      const b = pi.cost_breakdown;
      acc.revenue_gross += pi.revenue_gross;
      acc.alquiler_net += pi.alquiler_net;
      acc.revenue_total += pi.revenue_total;
      acc.cost_breakdown.fixed_prorated += b.fixed_prorated;
      acc.cost_breakdown.produccion_costo_real += b.produccion_costo_real;
      acc.cost_breakdown.produccion_cobrada_standard += b.produccion_cobrada_standard;
      acc.cost_breakdown.produccion_cobrada_efectiva += b.produccion_cobrada_efectiva;
      acc.cost_breakdown.produccion_profit += b.produccion_profit;
      acc.cost_breakdown.produccion_bonificacion_total += b.produccion_bonificacion_total;
      acc.cost_breakdown.impresion_real += b.impresion_real;
      acc.cost_breakdown.impresion_standard += b.impresion_standard;
      acc.cost_breakdown.impresion_efectiva += b.impresion_efectiva;
      acc.cost_breakdown.colocacion_real += b.colocacion_real;
      acc.cost_breakdown.colocacion_standard += b.colocacion_standard;
      acc.cost_breakdown.colocacion_efectiva += b.colocacion_efectiva;
      acc.cost_breakdown.diseno_real += b.diseno_real;
      acc.cost_breakdown.diseno_standard += b.diseno_standard;
      acc.cost_breakdown.diseno_efectiva += b.diseno_efectiva;
      acc.cost_breakdown.seller_commission += b.seller_commission;
      acc.cost_breakdown.agency_commission += b.agency_commission;
      acc.cost_breakdown.owner_commission += b.owner_commission;
      acc.cost_breakdown.hidden_facilitator_commission += b.hidden_facilitator_commission;
      acc.cost_total += pi.cost_total;
      return acc;
    },
    {
      revenue_gross: 0,
      alquiler_net: 0,
      revenue_total: 0,
      cost_breakdown: {
        fixed_prorated: 0,
        produccion_costo_real: 0,
        produccion_cobrada_standard: 0,
        produccion_cobrada_efectiva: 0,
        produccion_profit: 0,
        produccion_bonificacion_total: 0,
        impresion_real: 0, impresion_standard: 0, impresion_efectiva: 0,
        colocacion_real: 0, colocacion_standard: 0, colocacion_efectiva: 0,
        diseno_real: 0, diseno_standard: 0, diseno_efectiva: 0,
        seller_commission: 0,
        agency_commission: 0,
        owner_commission: 0,
        hidden_facilitator_commission: 0,
      },
      cost_total: 0,
    }
  );

  const margin = agg.revenue_total - agg.cost_total;
  const marginPct = agg.revenue_total > 0 ? (margin / agg.revenue_total) * 100 : 0;

  return {
    revenue_gross: agg.revenue_gross,
    alquiler_net: agg.alquiler_net,
    revenue_total: agg.revenue_total,
    // backwards-compat alias: revenue_net apunta a alquiler_net (lo que era antes)
    revenue_net: agg.alquiler_net,
    cost_breakdown: agg.cost_breakdown,
    cost_total: agg.cost_total,
    margin,
    margin_pct: marginPct,
    agency_commission_pct_applied: agencyCommissionPct,
    per_item: perItem,
    // Backwards-compat flat scalars: el destructure legacy { revenue, costs } sigue funcionando
    revenue: agg.revenue_total,
    costs: agg.cost_total,
  };
}

/** Alias retro-compatible. calculateProfitability === calculateProposalProfitability. */
export const calculateProfitability = calculateProposalProfitability;

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT 3 — Monthly fleet margin (para trend chart de Reports)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Margen agregado de la flota para UN mes calendario.
 *
 * Scopea los costos a los carteles que efectivamente tuvieron overlap con el
 * mes. Producción (V2): solo se suma al mes que contiene item.start_date.
 * Alquiler (cost y revenue): prorrateado por días de overlap.
 *
 * Input:
 *   proposals  propuestas con org embedded (para leer orgProduccionConfig)
 *   items      proposal_items con site_id, proposal_id, rate, duration, fechas,
 *              y columnas produccion_* (ajustes V2)
 *   inventory  array de sites para lookup por id
 *   monthStart, monthEnd  fechas del mes (ej: '2026-04-01', '2026-04-30')
 */
export function calculateMonthlyFleetMargin({ proposals, items, inventory, monthStart, monthEnd }) {
  const mStart = monthStart instanceof Date ? monthStart : new Date(monthStart);
  const mEnd = monthEnd instanceof Date ? monthEnd : new Date(monthEnd);
  const MS_DAY = 1000 * 60 * 60 * 24;
  const daysInMonth = Math.round((mEnd - mStart) / MS_DAY) + 1;

  const inventoryById = new Map((inventory || []).map((s) => [s.id, s]));
  const proposalById = new Map((proposals || []).map((p) => [p.id, p]));
  const siteIdsActivos = new Set();

  let revenueGross = 0;
  let alquilerNet = 0;
  let revenueTotal = 0;
  let costTotal = 0;

  for (const item of items || []) {
    const proposal = proposalById.get(item.proposal_id);
    if (!proposal) continue;

    const itemStart = new Date(item.start_date || proposal.start_date);
    const itemEnd = new Date(item.end_date || proposal.end_date);
    if (isNaN(itemStart) || isNaN(itemEnd)) continue;

    const overlap = overlapDays(itemStart, itemEnd, mStart, mEnd);
    if (overlap <= 0) continue;

    const site = extractSite(item) || inventoryById.get(item.site_id);
    if (!site) continue;
    siteIdsActivos.add(site.id);

    const itemTotalDays = Math.round((itemEnd - itemStart) / MS_DAY) + 1;
    const monthFraction = overlap / itemTotalDays;
    const itemMonths = resolveMonths(item, proposal);

    const itemAgency = toNum(proposal.agency_commission_pct ?? proposal.cost_agency_commission_pct
      ?? site.cost_agency_commission_pct);
    const itemSeller = site.cost_seller_commission_pct != null
      ? toNum(site.cost_seller_commission_pct)
      : toNum(proposal.seller?.commission_pct);
    const itemDiscount = toNum(item.discount_pct ?? proposal.discount_pct);

    const orgProduccionConfig = extractOrgProduccionConfig(proposal);
    const produccionAjustes = extractProduccionAjustes(item);

    const full = calculateSiteProfitability(site, {
      months: itemMonths,
      itemRate: item.rate,
      discountPct: itemDiscount,
      sellerCommissionPct: itemSeller,
      agencyCommissionPct: itemAgency,
      orgProduccionConfig,
      produccionAjustes,
    });
    if (!full) continue;

    // Alquiler: prorrateado linealmente por días de overlap
    const alquilerProrated = full.alquiler_net * monthFraction;
    const revenueGrossProrated = full.revenue_gross * monthFraction;

    // Producción: one-time al start_date. Solo la imputamos al mes que lo contiene.
    const produccionCobradaEnMes = dateInRange(itemStart, mStart, mEnd)
      ? full.cost_breakdown.produccion_cobrada_efectiva
      : 0;
    const produccionCostoEnMes = dateInRange(itemStart, mStart, mEnd)
      ? full.cost_breakdown.produccion_costo_real
      : 0;

    // Costos prorrateados del espacio (fixed + comisiones) × monthFraction
    const costoProrratedEspacio =
      (full.cost_breakdown.fixed_prorated +
        full.cost_breakdown.seller_commission +
        full.cost_breakdown.agency_commission +
        full.cost_breakdown.owner_commission) *
      monthFraction;

    revenueGross += revenueGrossProrated;
    alquilerNet += alquilerProrated;
    revenueTotal += alquilerProrated + produccionCobradaEnMes;
    costTotal += costoProrratedEspacio + produccionCostoEnMes;
  }

  const margin = revenueTotal - costTotal;
  const marginPct = revenueTotal > 0 ? (margin / revenueTotal) * 100 : 0;

  return {
    month_start: mStart,
    month_end: mEnd,
    days_in_month: daysInMonth,
    sites_activos: siteIdsActivos.size,
    revenue_gross: revenueGross,
    alquiler_net: alquilerNet,
    revenue_total: revenueTotal,
    // backwards-compat alias para consumidores que leen revenue_net en este export
    revenue_net: alquilerNet,
    cost_total: costTotal,
    margin,
    margin_pct: marginPct,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Color para donut/círculo. NO VERDE (regla de marca).
 * brand → teal → amber → rose según margen %.
 */
export function profitabilityColor(marginPct) {
  if (marginPct >= 25) return 'brand';
  if (marginPct >= 10) return 'teal';
  if (marginPct >= 0) return 'amber';
  return 'rose';
}
