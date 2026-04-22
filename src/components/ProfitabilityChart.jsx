import { PieChart, Pie, Cell } from 'recharts'

// Small pie chart showing profit margin vs costs for a campaign.
// Parent is responsible for the role gate — this component renders whatever
// numbers it's given.
//
// Revenue (blue) and Costs (red) slices; margin % in the centre.
// Loss case (costs > revenue): full red ring, negative % in the centre.

const SIZE        = 80
const INNER       = 25
const OUTER       = 38
const COLOR_REV   = '#3b82f6'  // blue-500
const COLOR_COST  = '#ef4444'  // red-500
const COLOR_LOSS  = '#dc2626'  // red-600
const COLOR_EMPTY = '#334155'  // slate-700

// eslint-disable-next-line no-unused-vars
export default function ProfitabilityChart({ campaignId, revenue = 0, costs = 0 }) {
  const rev  = Math.max(0, Number(revenue) || 0)
  const cost = Math.max(0, Number(costs)   || 0)

  // Edge case: no revenue → show empty placeholder ring, dashes in centre.
  if (rev === 0) {
    return (
      <ChartShell centerMain="—" centerSub="sin datos">
        <PieChart width={SIZE} height={SIZE}>
          <Pie
            data={[{ name: 'empty', value: 1 }]}
            dataKey="value"
            innerRadius={INNER}
            outerRadius={OUTER}
            startAngle={90}
            endAngle={-270}
            isAnimationActive={false}
          >
            <Cell fill={COLOR_EMPTY} />
          </Pie>
        </PieChart>
      </ChartShell>
    )
  }

  const profit   = rev - cost
  const marginPct = Math.round((profit / rev) * 100)
  const isLoss   = profit < 0

  // Pie data: when loss, show all-red; when profitable, show profit-vs-cost ratio.
  const data = isLoss
    ? [{ name: 'Costs', value: 1, color: COLOR_LOSS }]
    : [
        { name: 'Margen', value: Math.max(profit, 0.0001), color: COLOR_REV },
        { name: 'Costos', value: Math.max(cost,   0.0001), color: COLOR_COST },
      ]

  return (
    <ChartShell
      centerMain={`${marginPct}%`}
      centerSub={isLoss ? 'pérdida' : 'margen'}
      centerColor={isLoss ? COLOR_LOSS : COLOR_REV}
    >
      <PieChart width={SIZE} height={SIZE}>
        <Pie
          data={data}
          dataKey="value"
          innerRadius={INNER}
          outerRadius={OUTER}
          startAngle={90}
          endAngle={-270}
          isAnimationActive={false}
          stroke="none"
        >
          {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
        </Pie>
      </PieChart>
    </ChartShell>
  )
}

function ChartShell({ children, centerMain, centerSub, centerColor = '#cbd5e1' }) {
  return (
    <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
      {children}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none leading-tight">
        <span className="text-[11px] font-bold" style={{ color: centerColor }}>{centerMain}</span>
        {centerSub && <span className="text-[8px] text-slate-500 uppercase tracking-wider">{centerSub}</span>}
      </div>
    </div>
  )
}
