import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Navigation, Clock, ArrowRight, RotateCcw, MapPin,
  Bus, Train, Zap, Car, ParkingSquare, Footprints, X, AlertCircle,
} from 'lucide-react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ROUTES, PARK_AND_RIDE, POPULAR_LOCATIONS } from '../data/mockData'
import { planTrip, planCombinedDriveTransit, formatItinerary } from '../api/otp'

const ROUTE_TYPE_ICON = { bus: Bus, 'light-rail': Train, 'commuter-rail': Train, 'bus-rapid-transit': Zap }
const MODES = [
  { id: 'transit', label: 'Transit only', icon: Bus },
  { id: 'drive-transit', label: 'Drive + Transit', icon: Car },
]
const TIME_MODES = [
  { id: 'now', label: 'Now' },
  { id: 'leave-at', label: 'Leave at' },
  { id: 'arrive-by', label: 'Arrive by' },
]

// ── Geometry helpers ──────────────────────────────────────────────────────────

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function getSuggestedParkAndRides(fromLat, fromLon, toLat, toLon) {
  const directDist = haversineKm(fromLat, fromLon, toLat, toLon)
  if (directDist < 0.5) return []
  return PARK_AND_RIDE
    .map(pr => {
      const driveDist = haversineKm(fromLat, fromLon, pr.lat, pr.lon)
      const transitDist = haversineKm(pr.lat, pr.lon, toLat, toLon)
      const detourRatio = (driveDist + transitDist) / directDist
      return { ...pr, driveDist, detourRatio }
    })
    .filter(pr => pr.detourRatio <= 1.4 && pr.driveDist < directDist)
    .sort((a, b) => a.detourRatio - b.detourRatio)
    .slice(0, 4)
}

// ── Geocoding ──────────────────────────────────────────────────────────────────

async function geocode(query) {
  const params = new URLSearchParams({
    q: query, format: 'json', limit: '6',
    countrycodes: 'us', viewbox: '-105.5,39.4,-104.4,40.2', bounded: '0',
  })
  const res = await fetch(`/api/geocode/search?${params}`, { headers: { 'Accept-Language': 'en' } })
  if (!res.ok) return []
  const data = await res.json()
  return data.map(r => ({
    label: r.display_name.split(',').slice(0, 3).join(', ').trim(),
    full: r.display_name,
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
  }))
}

// ── AddressInput ───────────────────────────────────────────────────────────────

function AddressInput({ value, onChange, onSelect, placeholder, pinColor, onClear }) {
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const debounceRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleChange(e) {
    const val = e.target.value
    onChange(val)
    clearTimeout(debounceRef.current)
    if (val.length < 3) { setSuggestions([]); setOpen(false); return }
    debounceRef.current = setTimeout(async () => {
      const results = await geocode(val)
      setSuggestions(results)
      setOpen(results.length > 0)
    }, 320)
  }

  function pick(suggestion) {
    onChange(suggestion.label)
    onSelect?.(suggestion)
    setSuggestions([])
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative flex-1">
      <MapPin size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${pinColor}`} />
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className="w-full pl-9 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors"
      />
      {value && (
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); onClear(); setSuggestions([]); setOpen(false) }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <X size={13} />
        </button>
      )}
      {open && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-xl z-50 overflow-hidden border border-gray-100">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={() => pick(s)}
              className="w-full flex items-start gap-2.5 px-4 py-3 text-sm hover:bg-gray-50 text-left border-b border-gray-100 last:border-0"
            >
              <MapPin size={13} className="text-gray-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-gray-900 truncate">{s.label}</div>
                <div className="text-gray-400 text-xs truncate">{s.full.split(',').slice(3, 5).join(',').trim()}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── TripLeg ────────────────────────────────────────────────────────────────────

function TripLeg({ leg, isLast }) {
  const knownRoute = leg.routeId ? ROUTES.find(r => r.id === leg.routeId || r.shortName === leg.routeId) : null
  const color = leg.routeColor || knownRoute?.color || '#3B82F6'
  const routeType = leg.routeType || knownRoute?.type || 'bus'
  const TransitIcon = ROUTE_TYPE_ICON[routeType] || Bus

  let iconBg = '#9CA3AF', Icon = Footprints
  if (leg.type === 'drive') { iconBg = '#374151'; Icon = Car }
  else if (leg.type === 'park') { iconBg = '#6366F1'; Icon = ParkingSquare }
  else if (leg.type === 'transit') { iconBg = color; Icon = TransitIcon }

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center shrink-0">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0" style={{ backgroundColor: iconBg }}>
          <Icon size={13} />
        </div>
        {!isLast && <div className="w-px flex-1 bg-gray-200 my-1 min-h-3" />}
      </div>
      <div className="flex-1 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-sm text-gray-900">{leg.desc}</span>
            {leg.type === 'transit' && leg.stops > 0 && (
              <span className="ml-1.5 text-xs text-gray-400">{leg.stops} stops</span>
            )}
            {leg.type === 'drive' && leg.distance && (
              <span className="ml-1.5 text-xs text-gray-400">{leg.distance}</span>
            )}
          </div>
          <span className="text-xs text-gray-400 shrink-0">{leg.time}</span>
        </div>
      </div>
    </div>
  )
}

// ── TripCard ───────────────────────────────────────────────────────────────────

function TripCard({ trip, showDivider }) {
  const [expanded, setExpanded] = useState(false)
  const transitLegs = trip.legs.filter(l => l.type === 'transit')

  return (
    <div className={showDivider ? 'border-t border-gray-100' : ''}>
      <button
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-1 shrink-0">
          {trip.legs.filter(l => ['drive', 'transit'].includes(l.type)).map((leg, i) => {
            const knownRoute = leg.routeId ? ROUTES.find(r => r.id === leg.routeId || r.shortName === leg.routeId) : null
            const legColor = leg.routeColor || knownRoute?.color || (leg.type === 'drive' ? '#374151' : '#3B82F6')
            const routeType = leg.routeType || knownRoute?.type || 'bus'
            const LegIcon = leg.type === 'drive' ? Car : (ROUTE_TYPE_ICON[routeType] || Bus)
            return (
              <div key={i} className="flex items-center gap-0.5">
                {i > 0 && <ArrowRight size={10} className="text-gray-300" />}
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: legColor }}>
                  <LegIcon size={11} />
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-900">{trip.duration}</span>
            {transitLegs.map((l, i) => {
              const knownRoute = l.routeId ? ROUTES.find(r => r.id === l.routeId || r.shortName === l.routeId) : null
              const badgeColor = l.routeColor || knownRoute?.color || '#3B82F6'
              return l.routeId ? (
                <span key={i} className="text-xs text-white px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: badgeColor }}>
                  {l.routeId}
                </span>
              ) : null
            })}
          </div>
        </div>
        <div className="text-sm text-gray-400 shrink-0 flex items-center gap-1">
          {trip.departure}<ArrowRight size={12} />{trip.arrival}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-gray-100 px-4 pt-3 pb-1 bg-gray-50">
          {trip.legs.map((leg, i) => <TripLeg key={i} leg={leg} isLast={i === trip.legs.length - 1} />)}
        </div>
      )}
    </div>
  )
}

// ── Trip result map ────────────────────────────────────────────────────────────

function makeEndpointIcon(color, letter) {
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;flex-direction:column;align-items:center">
      <div style="background:${color};width:30px;height:30px;border-radius:50%;
        border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3);
        display:flex;align-items:center;justify-content:center;
        color:white;font-size:13px;font-weight:800;font-family:system-ui">${letter}</div>
      <div style="width:3px;height:8px;background:${color};border-radius:0 0 2px 2px;margin-top:-1px"></div>
    </div>`,
    iconSize: [30, 38],
    iconAnchor: [15, 38],
    popupAnchor: [0, -40],
  })
}

const ORIGIN_ICON = makeEndpointIcon('#22C55E', 'A')
const DEST_ICON   = makeEndpointIcon('#EF4444', 'B')
const PR_ICON     = makeEndpointIcon('#6366F1', 'P')

function FitBounds({ points, once = false }) {
  const map = useMap()
  const hasFit = useRef(false)
  useEffect(() => {
    if (!points?.length) return
    if (once && hasFit.current) return
    map.fitBounds(points, { padding: [48, 48], maxZoom: 15 })
    hasFit.current = true
  }, [points, map, once])
  return null
}

function tripAllPoints(trip) {
  const pts = []
  for (const leg of trip.legs) {
    if (leg.geometry?.length) pts.push(...leg.geometry)
    else {
      if (leg.fromCoords) pts.push(leg.fromCoords)
      if (leg.toCoords)   pts.push(leg.toCoords)
    }
  }
  return pts
}

// Draws one trip's legs. selected = full color; unselected = faded.
function TripLegs({ trip, selected, onSelect }) {
  return trip.legs.map((leg, i) => {
    const path = leg.geometry?.length
      ? leg.geometry
      : [leg.fromCoords, leg.toCoords].filter(Boolean)
    if (!path.length) return null

    const isWalkOrDrive = leg.type === 'walk' || leg.type === 'drive'
    let color
    if (!selected) {
      color = '#9CA3AF'  // all unselected legs unified gray
    } else if (leg.type === 'drive') {
      color = '#1E3A5F'  // dark navy for driving leg
    } else if (leg.type === 'walk') {
      color = '#9CA3AF'  // light gray for walking
    } else {
      color = leg.routeColor ?? '#3B82F6'
    }

    return (
      <Polyline
        key={i}
        positions={path}
        color={color}
        weight={selected ? (isWalkOrDrive ? 3 : 6) : 5}
        opacity={selected ? (isWalkOrDrive ? 0.8 : 0.9) : 0.5}
        dashArray={isWalkOrDrive ? '6 8' : undefined}
        eventHandlers={onSelect ? { click: onSelect } : {}}
      />
    )
  })
}

// Transfer dots only for the selected route
function TransferMarkers({ trip }) {
  return trip.legs
    .map((leg, i) => i > 0 ? leg.fromCoords : null)
    .filter(Boolean)
    .map((pt, i) => (
      <CircleMarker
        key={i}
        center={pt}
        radius={5}
        pathOptions={{ color: '#fff', fillColor: '#6B7280', fillOpacity: 1, weight: 2 }}
      />
    ))
}

// Small pill label at the midpoint of an unselected route
function AltRouteLabel({ trip, onClick }) {
  const pts = tripAllPoints(trip)
  if (!pts.length) return null
  const mid = pts[Math.floor(pts.length / 2)]
  const icon = L.divIcon({
    className: '',
    html: `<div style="
      background:rgba(255,255,255,0.93);
      border:1.5px solid #E5E7EB;
      border-radius:10px;
      padding:3px 8px;
      font-size:11px;
      font-weight:700;
      color:#374151;
      white-space:nowrap;
      box-shadow:0 1px 5px rgba(0,0,0,0.15);
      cursor:pointer;
    ">${trip.duration}</div>`,
    iconSize: [null, null],
    iconAnchor: [0, 0],
  })
  return <Marker position={mid} icon={icon} eventHandlers={{ click: onClick }} />
}

function TripResultMap({ fromCoords, toCoords, trips, selectedIndex, onSelectIndex }) {
  if (!fromCoords || !toCoords || !trips?.length) return null

  const selected = trips[selectedIndex] ?? trips[0]
  const transitLegs = selected.legs.filter(l => l.type === 'transit')

  // Fit to the union of all trips so all routes are visible at once
  const allPoints = trips.flatMap(tripAllPoints)
  const fitPoints = allPoints.length
    ? allPoints
    : [[fromCoords.lat, fromCoords.lon], [toCoords.lat, toCoords.lon]]

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <MapContainer
        center={[fromCoords.lat, fromCoords.lon]}
        zoom={12}
        style={{ height: 380, width: '100%' }}
        scrollWheelZoom
        key={`${fromCoords.lat},${toCoords.lat}`}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={fitPoints} />

        {/* Unselected routes behind — faded, clickable */}
        {trips.map((trip, i) => i === selectedIndex ? null : (
          <TripLegs key={i} trip={trip} selected={false} onSelect={() => onSelectIndex(i)} />
        ))}

        {/* Duration label on each alternative */}
        {trips.map((trip, i) => i === selectedIndex ? null : (
          <AltRouteLabel key={`lbl-${i}`} trip={trip} onClick={() => onSelectIndex(i)} />
        ))}

        {/* Selected route on top — full color */}
        <TripLegs trip={selected} selected onSelect={null} />
        <TransferMarkers trip={selected} />

        <Marker position={[fromCoords.lat, fromCoords.lon]} icon={ORIGIN_ICON}>
          <Popup><strong>Origin</strong></Popup>
        </Marker>
        <Marker position={[toCoords.lat, toCoords.lon]} icon={DEST_ICON}>
          <Popup><strong>Destination</strong></Popup>
        </Marker>
      </MapContainer>

      {/* Summary bar */}
      <div className="px-4 py-2.5 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-500 flex-wrap">
        <span className="font-bold text-gray-800 text-sm">{selected.duration}</span>
        <span className="text-gray-300">·</span>
        <span>{selected.departure} → {selected.arrival}</span>
        {transitLegs.length > 0 && (
          <>
            <span className="text-gray-300">·</span>
            <div className="flex gap-1">
              {transitLegs.map((l, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-full text-white font-bold"
                  style={{ backgroundColor: l.routeColor ?? '#3B82F6', fontSize: 10 }}
                >
                  {l.routeId}
                </span>
              ))}
            </div>
          </>
        )}
        {trips.length > 1 && (
          <span className="ml-auto text-gray-300 italic">tap a route to switch</span>
        )}
      </div>
    </div>
  )
}

// ── Drive + Transit unified panel ─────────────────────────────────────────────

function PRSelectMarker({ station, isSelected, onSelect }) {
  const pct = Math.round((station.freeSpaces / station.spaces) * 100)
  const availColor = pct > 30 ? '#10B981' : pct > 10 ? '#F59E0B' : '#EF4444'
  const sz = isSelected ? 34 : 26
  const bg = isSelected ? '#6366F1' : '#818CF8'
  const icon = L.divIcon({
    className: '',
    html: `<div style="
      width:${sz}px;height:${sz}px;background:${bg};
      border:${isSelected ? 3 : 2}px solid white;border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      color:white;font-size:${isSelected ? 14 : 11}px;font-weight:800;
      box-shadow:0 2px 8px rgba(0,0,0,.3);cursor:pointer;
    ">P</div>`,
    iconSize: [sz, sz],
    iconAnchor: [sz / 2, sz / 2],
  })

  const routes = ROUTES.filter(r => station.routeIds.includes(r.id))

  return (
    <>
      {isSelected && (
        <CircleMarker
          center={[station.lat, station.lon]}
          radius={24}
          pathOptions={{ color: '#6366F1', fillColor: '#6366F1', fillOpacity: 0.12, weight: 2 }}
        />
      )}
      <Marker position={[station.lat, station.lon]} icon={icon} eventHandlers={{ click: onSelect }}>
        <Popup closeButton={false} offset={[0, -8]}>
          <div style={{ minWidth: 150, fontSize: 12, lineHeight: 1.6 }}>
            <div style={{ fontWeight: 700, color: '#111827' }}>{station.name}</div>
            <div style={{ color: availColor, fontWeight: 600 }}>{station.freeSpaces} / {station.spaces} spaces free</div>
            {routes.length > 0 && (
              <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
                {routes.map(r => (
                  <span key={r.id} style={{
                    background: r.color, color: 'white', borderRadius: 999,
                    padding: '1px 6px', fontSize: 10, fontWeight: 700,
                  }}>{r.shortName}</span>
                ))}
              </div>
            )}
          </div>
        </Popup>
      </Marker>
    </>
  )
}

function DriveTransitPanel({ fromCoords, toCoords, selectedPR, onSelectPR, trip }) {
  const hasBothCoords = !!(fromCoords && toCoords)

  const stations = useMemo(() => {
    if (!hasBothCoords) return PARK_AND_RIDE
    const suggested = getSuggestedParkAndRides(fromCoords.lat, fromCoords.lon, toCoords.lat, toCoords.lon)
    return suggested.length > 0 ? suggested : PARK_AND_RIDE.slice(0, 6)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBothCoords, fromCoords?.lat, fromCoords?.lon, toCoords?.lat, toCoords?.lon])

  // Fit key changes when state transitions so FitBounds re-runs
  const fitKey  = trip ? 'route' : hasBothCoords ? 'area' : 'stations'
  const fitPoints = useMemo(() => {
    if (trip) return tripAllPoints(trip)
    const prs = stations.map(s => [s.lat, s.lon])
    if (!hasBothCoords) return prs
    return [[fromCoords.lat, fromCoords.lon], [toCoords.lat, toCoords.lon], ...prs]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey])

  const transitLegs = trip ? trip.legs.filter(l => l.type === 'transit') : []

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* Single map for the whole flow */}
      <MapContainer
        center={[39.7392, -104.9903]}
        zoom={10}
        style={{ height: 360, width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds key={fitKey} points={fitPoints} />

        {/* Selectable P&R markers — hidden once route is shown */}
        {!trip && stations.map(s => (
          <PRSelectMarker
            key={s.id}
            station={s}
            isSelected={selectedPR?.id === s.id}
            onSelect={() => onSelectPR(s)}
          />
        ))}

        {/* Route polylines + P&R landmark once planned */}
        {trip && (
          <>
            <TripLegs trip={trip} selected onSelect={null} />
            <TransferMarkers trip={trip} />
            {selectedPR && (
              <Marker position={[selectedPR.lat, selectedPR.lon]} icon={PR_ICON}>
                <Popup>{selectedPR.name}</Popup>
              </Marker>
            )}
          </>
        )}

        {fromCoords && (
          <Marker position={[fromCoords.lat, fromCoords.lon]} icon={ORIGIN_ICON}>
            <Popup><strong>Origin</strong></Popup>
          </Marker>
        )}
        {toCoords && (
          <Marker position={[toCoords.lat, toCoords.lon]} icon={DEST_ICON}>
            <Popup><strong>Destination</strong></Popup>
          </Marker>
        )}
      </MapContainer>

      {!trip ? (
        /* ── Station picker ── */
        <>
          <div className="px-4 pt-3 pb-1.5 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <ParkingSquare size={13} />
              {hasBothCoords ? 'Park & Rides on your route' : 'Park & Ride locations'}
            </p>
            {selectedPR && (
              <span className="text-xs text-indigo-600 font-medium">Selected — click Plan Route ↑</span>
            )}
          </div>
          <div>
            {stations.map((pr, i) => {
              const pct = Math.round((pr.freeSpaces / pr.spaces) * 100)
              const availColor = pct > 30 ? 'text-emerald-600' : pct > 10 ? 'text-yellow-600' : 'text-red-600'
              const routes = ROUTES.filter(r => pr.routeIds.includes(r.id))
              const isSel = selectedPR?.id === pr.id
              return (
                <div
                  key={pr.id}
                  className={`flex items-center gap-3 px-4 py-3 text-xs transition-colors ${i > 0 ? 'border-t border-gray-100' : ''} ${isSel ? 'bg-indigo-50' : ''}`}
                >
                  {/* Station info */}
                  <div className="flex-1 min-w-0">
                    <div className={`font-semibold mb-1 ${isSel ? 'text-indigo-700' : 'text-gray-800'}`}>{pr.name}</div>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {routes.map(r => (
                          <span key={r.id} className="px-1.5 py-0.5 rounded-full text-white font-bold" style={{ backgroundColor: r.color, fontSize: '10px' }}>
                            {r.shortName}
                          </span>
                        ))}
                      </div>
                      <span className={`font-medium ${availColor}`}>{pr.freeSpaces} spaces free</span>
                      {pr.driveDist != null && (
                        <span className="text-gray-400">{pr.driveDist.toFixed(1)} km</span>
                      )}
                    </div>
                  </div>

                  {/* Select button */}
                  <button
                    type="button"
                    onClick={() => onSelectPR(isSel ? null : pr)}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      isSel
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {isSel ? '✓ Selected' : 'Select'}
                  </button>
                </div>
              )
            })}
          </div>
        </>
      ) : (
        /* ── Trip summary bar ── */
        <div className="px-4 py-2.5 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-500 flex-wrap">
          <span className="font-bold text-gray-800 text-sm">{trip.duration}</span>
          <span className="text-gray-300">·</span>
          <span>{trip.departure} → {trip.arrival}</span>
          {transitLegs.length > 0 && (
            <>
              <span className="text-gray-300">·</span>
              <div className="flex gap-1">
                {transitLegs.map((l, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full text-white font-bold"
                    style={{ backgroundColor: l.routeColor ?? '#3B82F6', fontSize: 10 }}>
                    {l.routeId}
                  </span>
                ))}
              </div>
            </>
          )}
          <span className="text-gray-300">·</span>
          <span className="text-indigo-600 font-medium">via {selectedPR?.name}</span>
          <button
            type="button"
            onClick={() => onSelectPR(null)}
            className="ml-auto text-xs text-gray-400 hover:text-gray-600"
          >
            Change station
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function TripPlanner() {
  const [from, setFrom] = useState('')
  const [fromCoords, setFromCoords] = useState(null)
  const [to, setTo] = useState('')
  const [toCoords, setToCoords] = useState(null)
  const [mode, setMode] = useState('transit')
  const [timeMode, setTimeMode] = useState('now')
  const [datetime, setDatetime] = useState(() => {
    const d = new Date()
    d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0)
    return d.toISOString().slice(0, 16)
  })
  const [trips, setTrips] = useState(null)
  const [selectedTripIndex, setSelectedTripIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedPR, setSelectedPR] = useState(null)

  async function handleSearch(e) {
    e.preventDefault()
    if (!from || !to) return
    setLoading(true)
    setError(null)
    setTrips(null)

    try {
      let fCoords = fromCoords
      let tCoords = toCoords
      if (!fCoords) {
        const results = await geocode(from)
        if (!results.length) throw new Error(`Could not find location: "${from}"`)
        fCoords = results[0]
        setFromCoords(fCoords)
      }
      if (!tCoords) {
        const results = await geocode(to)
        if (!results.length) throw new Error(`Could not find location: "${to}"`)
        tCoords = results[0]
        setToCoords(tCoords)
      }

      if (mode === 'drive-transit') {
        if (!selectedPR) return  // coords resolved; user now picks a station
        const result = await planCombinedDriveTransit({
          fromLat: fCoords.lat, fromLon: fCoords.lon,
          prLat: selectedPR.lat, prLon: selectedPR.lon,
          toLat: tCoords.lat, toLon: tCoords.lon,
          dateTime: timeMode === 'now' ? null : datetime,
          arriveBy: timeMode === 'arrive-by',
        })
        setTrips(result)
      } else {
        const itineraries = await planTrip({
          fromLat: fCoords.lat, fromLon: fCoords.lon,
          toLat: tCoords.lat, toLon: tCoords.lon,
          numItineraries: 3,
          dateTime: timeMode === 'now' ? null : datetime,
          arriveBy: timeMode === 'arrive-by',
        })
        setTrips(itineraries.map((it, i) => formatItinerary(it, i)))
        setSelectedTripIndex(0)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handlePRSelect(pr) {
    setSelectedPR(pr)
    setTrips(null)  // reset route when station changes
  }

  function handleSwap() {
    setFrom(to); setFromCoords(toCoords)
    setTo(from); setToCoords(fromCoords)
    setTrips(null)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div className="px-1">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Navigation className="text-blue-600" size={22} />
          Trip Planner
        </h1>
        <p className="text-gray-500 mt-0.5 text-sm">Find the best route between two points in Denver</p>
      </div>

      <form onSubmit={handleSearch} className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
        {/* Mode */}
        <div className="flex gap-2">
          {MODES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => { setMode(id); setTrips(null); setSelectedPR(null) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                mode === id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Icon size={14} />{label}
            </button>
          ))}
        </div>

        {/* Origin / destination */}
        <div className="flex gap-2">
          <div className="flex-1 space-y-2">
            <AddressInput
              value={from}
              onChange={v => { setFrom(v); setFromCoords(null); setTrips(null) }}
              onSelect={s => setFromCoords(s)}
              onClear={() => { setFrom(''); setFromCoords(null); setTrips(null) }}
              placeholder="From: address or stop name"
              pinColor="text-emerald-500"
            />
            <AddressInput
              value={to}
              onChange={v => { setTo(v); setToCoords(null); setTrips(null) }}
              onSelect={s => setToCoords(s)}
              onClear={() => { setTo(''); setToCoords(null); setTrips(null) }}
              placeholder="To: address or stop name"
              pinColor="text-red-500"
            />
          </div>
          <button
            type="button"
            onClick={handleSwap}
            className="self-center p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
            title="Swap"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        {/* Time selector + search */}
        <div className="flex gap-2 items-center flex-wrap">
          <div className="flex rounded-xl bg-gray-100 p-0.5 shrink-0">
            {TIME_MODES.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setTimeMode(m.id)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  timeMode === m.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          {timeMode !== 'now' && (
            <input
              type="datetime-local"
              value={datetime}
              onChange={e => setDatetime(e.target.value)}
              className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
            />
          )}
          <button
            type="submit"
            disabled={!from || !to || loading || (mode === 'drive-transit' && fromCoords && toCoords && !selectedPR)}
            className="ml-auto px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {loading ? 'Searching…'
              : mode === 'drive-transit' && selectedPR ? 'Plan Route'
              : 'Search'}
          </button>
        </div>

        {/* Popular destinations */}
        <div>
          <p className="text-xs text-gray-400 mb-1.5">Popular destinations</p>
          <div className="flex flex-wrap gap-1.5">
            {POPULAR_LOCATIONS.slice(0, 4).map(loc => (
              <button
                key={loc.name}
                type="button"
                onClick={() => { setTo(loc.address); setToCoords(null); setTrips(null) }}
                className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 font-medium transition-colors"
              >
                {loc.name}
              </button>
            ))}
          </div>
        </div>
      </form>

      {/* Drive+Transit: unified station picker + map */}
      {mode === 'drive-transit' && (
        <DriveTransitPanel
          fromCoords={fromCoords}
          toCoords={toCoords}
          selectedPR={selectedPR}
          onSelectPR={handlePRSelect}
          trip={trips?.[0] ?? null}
        />
      )}

      {/* Error */}
      {error && (
        <div className="border-l-4 border-red-500 bg-red-50 px-4 py-3 rounded-r-xl flex items-start gap-2 text-sm text-red-800">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Transit-only results */}
      {mode !== 'drive-transit' && trips && (
        <div className="space-y-3">
          <p className="text-xs text-gray-400 px-1">{trips.length} option{trips.length !== 1 ? 's' : ''} found — tap to expand</p>
          <TripResultMap
            fromCoords={fromCoords}
            toCoords={toCoords}
            trips={trips}
            selectedIndex={selectedTripIndex}
            onSelectIndex={setSelectedTripIndex}
          />
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {trips.map((trip, i) => <TripCard key={trip.id} trip={trip} showDivider={i > 0} />)}
          </div>
        </div>
      )}

      {/* Drive+Transit trip cards (below the unified panel) */}
      {mode === 'drive-transit' && trips && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {trips.map((trip, i) => <TripCard key={trip.id} trip={trip} showDivider={i > 0} />)}
        </div>
      )}
    </div>
  )
}
