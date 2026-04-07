import { useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { FORMAT_MAP } from '../../lib/constants'
import { formatCurrency } from '../../lib/utils'

// Fix: Leaflet's default icon uses asset paths that Vite mangles.
// We override with DivIcon and null out the default entirely.
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl: '', shadowUrl: '' })

function createDivIcon(format, isSelected = false) {
  const color = FORMAT_MAP[format]?.color ?? '#94a3b8'
  const size = isSelected ? 18 : 14
  const shadow = isSelected ? `0 0 0 3px ${color}40, 0 2px 6px rgba(0,0,0,0.6)` : '0 1px 4px rgba(0,0,0,0.5)'
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;
      border-radius:50%;
      background:${color};
      border:2px solid white;
      box-shadow:${shadow};
      transition:all 0.15s ease;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2) - 4],
  })
}

const CABA_CENTER = [-34.6037, -58.3816]

export default function ProposalMap({ sites = [], className = '' }) {
  const validSites = sites.filter(s => s.latitude && s.longitude)

  const center = useMemo(() => {
    if (validSites.length === 0) return CABA_CENTER
    const avgLat = validSites.reduce((s, p) => s + p.latitude, 0) / validSites.length
    const avgLng = validSites.reduce((s, p) => s + p.longitude, 0) / validSites.length
    return [avgLat, avgLng]
  }, [validSites])

  return (
    <div className={`rounded-xl overflow-hidden border border-surface-700 ${className}`}>
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {validSites.map(site => (
          <Marker
            key={site.site_id}
            position={[site.latitude, site.longitude]}
            icon={createDivIcon(site.format)}
          >
            <Popup maxWidth={220}>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', lineHeight: 1.4 }}>
                <p style={{ fontWeight: 700, marginBottom: 4 }}>{site.name}</p>
                <p style={{ color: '#64748b', marginBottom: 4 }}>{site.address}</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{
                    background: `${FORMAT_MAP[site.format]?.color}20`,
                    color: FORMAT_MAP[site.format]?.color,
                    borderRadius: 999, padding: '1px 8px', fontSize: 11, fontWeight: 600
                  }}>
                    {FORMAT_MAP[site.format]?.label ?? site.format}
                  </span>
                  {site.rate && (
                    <span style={{ color: '#94a3b8', fontSize: 11 }}>
                      {formatCurrency(site.rate, 'ARS')}/mes
                    </span>
                  )}
                </div>
                {site.impactsPerMonth && (
                  <p style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>
                    ~{(site.impactsPerMonth / 1000).toFixed(0)}k impactos/mes
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Legend */}
      <div className="flex items-center gap-4 border-t border-surface-700 bg-surface-800 px-4 py-2.5">
        {Object.entries(FORMAT_MAP).map(([key, { label, color }]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full border-2 border-white/40" style={{ background: color }} />
            <span className="text-xs text-slate-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
