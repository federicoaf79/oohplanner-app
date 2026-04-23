import { useMemo, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { FORMAT_MAP } from '../../lib/constants'
import { formatCurrency } from '../../lib/utils'

// Fix: Leaflet's default icon uses asset paths that Vite mangles.
// We override with DivIcon and null out the default entirely.
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl: '', shadowUrl: '' })

function createDivIcon(format, isSelected = false, colorOverride = null) {
  const color = colorOverride ?? FORMAT_MAP[format]?.color ?? '#94a3b8'
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

function FitBounds({ sites }) {
  const map = useMap()
  useEffect(() => {
    if (sites.length === 0) return
    if (sites.length === 1) {
      map.setView([sites[0].latitude, sites[0].longitude], 14)
      return
    }
    const bounds = L.latLngBounds(sites.map(s => [s.latitude, s.longitude]))
    map.fitBounds(bounds, { padding: [40, 40] })
  }, [sites, map])
  return null
}

export default function ProposalMap({ sites = [], className = '', mapRef, mapHeight = '100%', getMarkerColor = null, showLegend = true }) {
  const validSites = sites.filter(s => s.latitude && s.longitude)

  const center = useMemo(() => {
    if (validSites.length === 0) return CABA_CENTER
    const avgLat = validSites.reduce((s, p) => s + p.latitude, 0) / validSites.length
    const avgLng = validSites.reduce((s, p) => s + p.longitude, 0) / validSites.length
    return [avgLat, avgLng]
  }, [validSites])

  return (
    <div ref={mapRef} className={`rounded-xl overflow-hidden border border-surface-700 ${className}`}>
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: mapHeight, width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />
        <FitBounds sites={validSites} />
        {validSites.map(site => (
          <Marker
            key={site.site_id}
            position={[site.latitude, site.longitude]}
            icon={createDivIcon(site.format, false, getMarkerColor ? getMarkerColor(site) : null)}
          >
            <Popup maxWidth={240}>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', lineHeight: 1.4 }}>
                <p style={{ fontWeight: 700, marginBottom: 4 }}>{site.name}</p>
                <p style={{ color: '#64748b', marginBottom: 6 }}>{site.address}</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 10px', fontSize: 12 }}>
                  <span style={{ color: '#64748b' }}>Formato:</span>
                  <span style={{ color: FORMAT_MAP[site.format]?.color ?? '#94a3b8', fontWeight: 600 }}>
                    {FORMAT_MAP[site.format]?.label ?? site.format ?? '—'}
                  </span>
                  <span style={{ color: '#64748b' }}>Tipo:</span>
                  <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                    {site.owner_type === 'owned' ? 'Propio'
                      : site.owner_type === 'rented' ? 'Comercializado'
                      : '—'}
                  </span>
                  {site.rate && (
                    <>
                      <span style={{ color: '#64748b' }}>Precio:</span>
                      <span style={{ color: '#e2e8f0' }}>
                        {formatCurrency(site.rate, 'ARS')}/mes
                      </span>
                    </>
                  )}
                  {site.impactsPerMonth && (
                    <>
                      <span style={{ color: '#64748b' }}>Impactos:</span>
                      <span style={{ color: '#e2e8f0' }}>
                        ~{(site.impactsPerMonth / 1000).toFixed(0)}k/mes
                      </span>
                    </>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Legend — format colors. Callers using a custom marker-color scheme
          (e.g. Dashboard's owner_type colouring) should pass showLegend={false}
          and render their own legend to avoid a double-legend UX. */}
      {showLegend && (
        <div className="flex items-center gap-4 border-t border-surface-700 bg-surface-800 px-4 py-2.5">
          {Object.entries(FORMAT_MAP).map(([key, { label, color }]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full border-2 border-white/40" style={{ background: color }} />
              <span className="text-xs text-slate-500">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
