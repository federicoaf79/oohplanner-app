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
 * FÓRMULA (V1, demo 25/04/2026)
 * ──────────────────────────────────────────────────────────────────────────────
 *
 *   months   = item.duration ?? monthsByCalendar(item.start, item.end)
 *              ?? monthsByCalendar(proposal.start, proposal.end)
 *              (monthsByCalendar respeta 28/29/30/31 días reales por mes)
 *
 *   discount = item.discount_pct ?? proposal.discount_pct ?? 0
 *
 *   revenue_gross = (item.rate ?? site.base_rate ?? site.sale_price) × months
 *   revenue_net   = revenue_gross × (1 - discount/100)
 *
 *   fixed_prorated = (cost_rent + cost_electricity + cost_taxes
 *                    + cost_maintenance + cost_imponderables) × months
 *   colocation     = cost_colocation
 *   print          = is_digital ? 0 : print_cost_per_m2 × area_m2
 *   design         = cost_design
 *
 *   --- Comisiones: TODAS sobre revenue_net (regla unificada) ---
 *   seller_commission = revenue_net × seller_pct / 100
 *   agency_commission = revenue_net × agency_pct / 100
 *   owner_commission  = revenue_net × cost_owner_commission_pct / 100
 *                     + cost_owner_commission            // monto fijo opcional
 *   hidden_facilitator = 0                               // V1.1
 *
 *   cost_total = fixed_prorated + colocation + print + design
 *              + seller_commission + agency_commission
 *              + owner_commission + hidden_facilitator
 *
 *   margin     = revenue_net - cost_total
 *   margin_pct = margin / revenue_net × 100
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * DEUDA TÉCNICA (post-demo)
 * ──────────────────────────────────────────────────────────────────────────────
 *   - Crear proposals.agency_commission_pct y migrar desde inventory.
 *   - UI: contact con rol agency/reseller/media_group → auto-completa agency_pct.
 *   - Supervisor + gerente: leer profiles.supervisor_commission_pct + scope.
 *   - Facilitador oculto: facilitator_agreements / campaign_commissions.
 */

const DIGITAL_FORMATS = new Set(['digital', 'urban_furniture_digital']);

const toNum = (v) => (Number.isFinite(+v) ? +v : 0);

/** Días calendario inclusivos entre dos fechas. 0 si inválido. */
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

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT 1 — Per-site profitability (pure math)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Rentabilidad de UN cartel bajo parámetros explícitos.
 * No lee de proposal/item — el caller provee los opts.
 *
 * @param site  fila de inventory con todos los cost_* + format + dimensiones
 * @param opts  {
 *   months:             duración efectiva en meses (default 1 = un mes estándar)
 *   itemRate:           precio pactado mensual; si null usa site.base_rate o sale_price
 *   discountPct:        descuento al cliente (0..100)
 *   sellerCommissionPct: override; si null usa site.cost_seller_commission_pct
 *   agencyCommissionPct: override global a nivel propuesta
 * }
 */
export function calculateSiteProfitability(site, opts = {}) {
  const {
    months = 1,
    itemRate = null,
    discountPct = 0,
    sellerCommissionPct = null,
    agencyCommissionPct = 0,
  } = opts;

  if (!site) return null;

  const isDigital = DIGITAL_FORMATS.has(site.format);

  // Revenue
  const ratePerMonth =
    itemRate != null
      ? toNum(itemRate)
      : toNum(site.base_rate) || toNum(site.sale_price);
  const revenueGross = ratePerMonth * months;
  const revenueNet = revenueGross * (1 - toNum(discountPct) / 100);

  // Costos estructurales prorrateados
  const fixedProrated =
    (toNum(site.cost_rent) +
      toNum(site.cost_electricity) +
      toNum(site.cost_taxes) +
      toNum(site.cost_maintenance) +
      toNum(site.cost_imponderables)) *
    months;

  // Variables por campaña
  const colocation = toNum(site.cost_colocation);
  const print = isDigital ? 0 : toNum(site.cost_print_per_m2 ?? site.print_cost_per_m2) * printAreaM2(site);
  const design = toNum(site.cost_design);

  // Comisiones — TODAS sobre revenue_net
  const sellerPct =
    sellerCommissionPct != null
      ? toNum(sellerCommissionPct)
      : toNum(site.cost_seller_commission_pct);
  const sellerCommission = revenueNet * (sellerPct / 100);
  const agencyCommission = revenueNet * (toNum(agencyCommissionPct) / 100);
  const ownerCommission =
    revenueNet * (toNum(site.cost_owner_commission_pct) / 100) +
    toNum(site.cost_owner_commission);
  const hiddenFacilitatorCommission = 0; // V1.1

  const costTotal =
    fixedProrated +
    colocation +
    print +
    design +
    sellerCommission +
    agencyCommission +
    ownerCommission +
    hiddenFacilitatorCommission;

  const margin = revenueNet - costTotal;
  const marginPct = revenueNet > 0 ? (margin / revenueNet) * 100 : 0;

  return {
    site_id: site.id,
    site_name: site.name,
    months,
    revenue_gross: revenueGross,
    revenue_net: revenueNet,
    costs: {
      fixed_prorated: fixedProrated,
      colocation,
      print,
      design,
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

/**
 * Rentabilidad agregada de una propuesta completa.
 * Acepta proposals con items joined con inventory (alias 'site' o 'billboard').
 */
export function calculateProposalProfitability(proposal) {
  // Acepta alias: 'items' (shape canónico) o 'proposal_items' (como vienen del Supabase join).
  const items = Array.isArray(proposal?.items)
    ? proposal.items
    : Array.isArray(proposal?.proposal_items)
    ? proposal.proposal_items
    : [];

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
      });
    })
    .filter(Boolean);

  const agg = perItem.reduce(
    (acc, pi) => {
      acc.revenue_gross += pi.revenue_gross;
      acc.revenue_net += pi.revenue_net;
      acc.costs.fixed_prorated += pi.costs.fixed_prorated;
      acc.costs.colocation += pi.costs.colocation;
      acc.costs.print += pi.costs.print;
      acc.costs.design += pi.costs.design;
      acc.costs.seller_commission += pi.costs.seller_commission;
      acc.costs.agency_commission += pi.costs.agency_commission;
      acc.costs.owner_commission += pi.costs.owner_commission;
      acc.costs.hidden_facilitator_commission += pi.costs.hidden_facilitator_commission;
      acc.cost_total += pi.cost_total;
      return acc;
    },
    {
      revenue_gross: 0,
      revenue_net: 0,
      costs: {
        fixed_prorated: 0,
        colocation: 0,
        print: 0,
        design: 0,
        seller_commission: 0,
        agency_commission: 0,
        owner_commission: 0,
        hidden_facilitator_commission: 0,
      },
      cost_total: 0,
    }
  );

  const margin = agg.revenue_net - agg.cost_total;
  const marginPct = agg.revenue_net > 0 ? (margin / agg.revenue_net) * 100 : 0;

  return {
    revenue_gross: agg.revenue_gross,
    revenue_net: agg.revenue_net,
    cost_breakdown: agg.costs, // objeto con las 8 líneas para owner view / Reports
    cost_total: agg.cost_total,
    margin,
    margin_pct: marginPct,
    agency_commission_pct_applied: agencyCommissionPct,
    per_item: perItem,
    // Backwards-compat flat scalars para destructure { revenue, costs } legacy
    revenue: agg.revenue_net,
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
 * A diferencia de `totalFixedCosts` inventory-wide, este scopea los costos a
 * los carteles que efectivamente tuvieron overlap con el mes (se vendieron).
 *
 * Input:
 *   proposals  propuestas activas/aceptadas con sus fechas
 *   items      proposal_items con site_id, proposal_id, rate, duration, fechas
 *              (el caller puede pre-joinear site dentro del item si quiere ahorrar lookup)
 *   inventory  array de sites para lookup por id (usado si item.site no está presente)
 *   monthStart, monthEnd  fechas del mes en cuestión (ej: '2026-04-01', '2026-04-30')
 *
 * @returns { revenue_gross, revenue_net, cost_total, margin, margin_pct, sites_activos }
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
  let revenueNet = 0;
  let costTotal = 0;

  for (const item of items || []) {
    const proposal = proposalById.get(item.proposal_id);
    if (!proposal) continue;

    // Rango efectivo del item (fallback al proposal si item no tiene fechas)
    const itemStart = new Date(item.start_date || proposal.start_date);
    const itemEnd = new Date(item.end_date || proposal.end_date);
    if (isNaN(itemStart) || isNaN(itemEnd)) continue;

    const overlap = overlapDays(itemStart, itemEnd, mStart, mEnd);
    if (overlap <= 0) continue;

    const site = extractSite(item) || inventoryById.get(item.site_id);
    if (!site) continue;
    siteIdsActivos.add(site.id);

    // Fracción del item que cae en este mes (0..1)
    const itemTotalDays = Math.round((itemEnd - itemStart) / MS_DAY) + 1;
    const monthFraction = overlap / itemTotalDays;

    // Meses totales del item (para prorrateo de costos)
    const itemMonths = resolveMonths(item, proposal);

    // Calcular la rentabilidad total del item y atribuir al mes por fracción
    const itemAgency = toNum(proposal.agency_commission_pct ?? proposal.cost_agency_commission_pct
      ?? site.cost_agency_commission_pct);
    const itemSeller = site.cost_seller_commission_pct != null
      ? toNum(site.cost_seller_commission_pct)
      : toNum(proposal.seller?.commission_pct);
    const itemDiscount = toNum(item.discount_pct ?? proposal.discount_pct);

    const full = calculateSiteProfitability(site, {
      months: itemMonths,
      itemRate: item.rate,
      discountPct: itemDiscount,
      sellerCommissionPct: itemSeller,
      agencyCommissionPct: itemAgency,
    });
    if (!full) continue;

    revenueGross += full.revenue_gross * monthFraction;
    revenueNet += full.revenue_net * monthFraction;
    costTotal += full.cost_total * monthFraction;
  }

  const margin = revenueNet - costTotal;
  const marginPct = revenueNet > 0 ? (margin / revenueNet) * 100 : 0;

  return {
    month_start: mStart,
    month_end: mEnd,
    days_in_month: daysInMonth,
    sites_activos: siteIdsActivos.size,
    revenue_gross: revenueGross,
    revenue_net: revenueNet,
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
