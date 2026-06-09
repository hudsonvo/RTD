import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Bus, Train, Zap, RefreshCw, AlertCircle,
  Loader, MapPin, ArrowRight, Search, X, List, ChevronDown, Clock,
} from 'lucide-react'
import { useVehiclePositions, useArrivalsAtStop } from '../hooks/useRTDFeeds'
import { getShapes, getStops } from '../api/gtfsStatic'
import { VEHICLES as MOCK_VEHICLES, ROUTES } from '../data/mockData'

const TYPE_ICON = { bus: Bus, 'light-rail': Train, 'commuter-rail': Train, 'bus-rapid-transit': Zap }
const DENVER_CENTER = [39.7392, -104.9903]

function findRoute(routeId) {
  if (!routeId) return null
  return ROUTES.find(r => r.id === routeId) ?? ROUTES.find(r => r.shortName === routeId) ?? null
}

function makeIcon(color, label) {
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${color};width:28px;height:28px;border-radius:50%;
      border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);
      display:flex;align-items:center;justify-content:center;
      color:white;font-size:9px;font-weight:700;font-family:system-ui,sans-serif;
    ">${label.slice(0, 3)}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  })
}

function MapFocus({ vehicles, selectedId }) {
  const map = useMap()
  useEffect(() => {
    if (!selectedId) return
    const v = vehicles.find(v => v.id === selectedId)
    if (v) map.flyTo([v.lat, v.lon], 14, { duration: 0.8 })
  }, [selectedId, vehicles, map])
  return null
}

function VehicleMarker({ v, onClick }) {
  const route = findRoute(v.routeId)
  const color = route?.color ?? '#6B7280'
  const label = route?.shortName ?? v.routeId?.slice(0, 3) ?? '?'
  return (
    <Marker position={[v.lat, v.lon]} icon={makeIcon(color, label)} eventHandlers={{ click: onClick }}>
      <Popup>
        <div className="text-sm min-w-44">
          <div className="font-bold text-gray-900">{route?.name ?? `Route ${v.routeId}`}</div>
          {v.headsign && (
            <div className="flex items-center gap-1 text-gray-500 text-xs mt-0.5 mb-1">
              <ArrowRight size={10} />{v.headsign}
            </div>
          )}
          {v.nextStopName && (
            <div className="text-gray-600 text-xs">Next stop: <strong>{v.nextStopName}</strong></div>
          )}
          <div className="flex gap-3 text-xs text-gray-500 mt-1">
            <span>{v.speed} mph</span>
            <span className={v.delay === 0 ? 'text-green-600' : v.delay < 0 ? 'text-blue-600' : 'text-yellow-600'}>
              {v.delay === 0 ? 'On time' : v.delay < 0 ? `${Math.abs(v.delay)}m early` : `+${v.delay} min`}
            </span>
          </div>
        </div>
      </Popup>
    </Marker>
  )
}

function DelayBadge({ delay, etaSec }) {
  const etaLabel = etaSec
    ? new Date(etaSec * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null

  if (delay === 0)
    return (
      <span className="text-xs font-medium text-green-600">
        On time{etaLabel && <span className="font-normal text-gray-400 ml-1">· {etaLabel}</span>}
      </span>
    )
  if (delay < 0)
    return (
      <span className="text-xs font-medium text-blue-600">
        {Math.abs(delay)}m early{etaLabel && <span className="font-normal text-gray-400 ml-1">· {etaLabel}</span>}
      </span>
    )
  return (
    <span className="text-xs font-medium text-yellow-600">
      +{delay}m{etaLabel && <span className="font-normal text-gray-400 ml-1">· {etaLabel}</span>}
    </span>
  )
}

function RouteGroup({ filter, vehicles, selectedId, onSelectVehicle }) {
  const [open, setOpen] = useState(false)
  const route = findRoute(filter.routeId)
  const Icon = route ? (TYPE_ICON[route.type] || Bus) : Bus

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Group header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0"
          style={{ backgroundColor: filter.color }}
        >
          <Icon size={15} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-gray-900 text-sm">{route?.name ?? `Route ${filter.routeId}`}</span>
          {filter.label !== filter.shortName && (
            <span className="text-gray-400 text-xs ml-2 inline-flex items-center gap-0.5">
              <ArrowRight size={9} />{filter.label}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400 shrink-0">{filter.count} vehicles</span>
        <ChevronDown
          size={15}
          className={`text-gray-400 shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Vehicle list */}
      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {vehicles.map(v => (
            <button
              key={v.id}
              onClick={() => onSelectVehicle(v.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-gray-50 ${
                selectedId === v.id ? 'bg-blue-50' : ''
              }`}
            >
              <div
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: filter.color }}
              />
              <span className="flex-1 text-gray-700 truncate">
                {v.nextStopName
                  ? <><span className="text-gray-400 text-xs mr-1">Next:</span>{v.nextStopName}</>
                  : <span className="text-gray-400 italic">Location unknown</span>
                }
              </span>
              <DelayBadge delay={v.delay} etaSec={v.etaSec} />
              <MapPin size={12} className={`shrink-0 transition-colors ${selectedId === v.id ? 'text-blue-500' : 'text-gray-300'}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Route polyline ─────────────────────────────────────────────────────────────

function RoutePolyline({ shapes, activeFilter, filters }) {
  if (!shapes || activeFilter === 'all') return null
  const f = filters.find(f => f.key === activeFilter)
  if (!f) return null
  const shape = shapes[`${f.routeId}:${f.directionId}`]
    ?? shapes[`${f.routeId}:0`]
  if (!shape) return null
  return <Polyline positions={shape} color={f.color} weight={4} opacity={0.6} />
}

// ── Stop markers (visible at zoom ≥ 14) ────────────────────────────────────────

function StopLayer({ stops, onStopClick }) {
  const [zoom, setZoom] = useState(null)
  const [bounds, setBounds] = useState(null)
  const map = useMap()

  useMapEvents({
    zoomend:  () => { setZoom(map.getZoom()); setBounds(map.getBounds()) },
    moveend:  () => setBounds(map.getBounds()),
  })

  useEffect(() => {
    setZoom(map.getZoom())
    setBounds(map.getBounds())
  }, [map])

  if (!stops || !bounds || zoom < 14) return null

  const visible = Object.entries(stops)
    .filter(([, s]) =>
      typeof s === 'object' && s.lat && s.lon &&
      s.lat >= bounds.getSouth() && s.lat <= bounds.getNorth() &&
      s.lon >= bounds.getWest() && s.lon <= bounds.getEast()
    )
    .slice(0, 120)

  return visible.map(([id, s]) => (
    <CircleMarker
      key={id}
      center={[s.lat, s.lon]}
      radius={5}
      pathOptions={{ color: '#fff', fillColor: '#3B82F6', fillOpacity: 1, weight: 1.5 }}
      eventHandlers={{ click: () => onStopClick({ id, name: s.name, lat: s.lat, lon: s.lon }) }}
    />
  ))
}

// ── Stop arrivals panel ─────────────────────────────────────────────────────────

function StopArrivalsPanel({ stop, onClose }) {
  const { arrivals, loading, error } = useArrivalsAtStop(stop?.id)

  if (!stop) return null

  function fmtEta(etaSec) {
    if (!etaSec) return null
    const mins = Math.round((etaSec - Date.now() / 1000) / 60)
    if (mins <= 0) return 'Now'
    if (mins < 60) return `${mins} min`
    return new Date(etaSec * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900 flex items-center gap-1.5">
            <MapPin size={14} className="text-blue-500" />
            {stop.name}
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">Stop #{stop.id} · Live arrivals</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
          <X size={14} />
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
          <Loader size={13} className="animate-spin" />Loading arrivals…
        </div>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
      {!loading && !error && arrivals?.length === 0 && (
        <p className="text-sm text-gray-400">No upcoming arrivals found.</p>
      )}
      {arrivals?.length > 0 && (
        <div className="space-y-1.5">
          {arrivals.slice(0, 8).map((a, i) => {
            const eta = fmtEta(a.etaSec)
            return (
              <div key={i} className="flex items-center gap-2.5 text-sm">
                <span
                  className="px-2 py-0.5 rounded text-white font-bold text-xs shrink-0"
                  style={{ backgroundColor: ROUTES.find(r => r.id === a.routeId || r.shortName === a.routeId)?.color ?? '#6B7280' }}
                >
                  {a.routeId}
                </span>
                <span className="flex-1 text-gray-700 truncate">{a.headsign ?? '—'}</span>
                <span className={`text-xs font-medium shrink-0 flex items-center gap-1 ${
                  a.delay === 0 ? 'text-green-600' : a.delay < 0 ? 'text-blue-600' : 'text-yellow-600'
                }`}>
                  <Clock size={11} />
                  {eta ?? '—'}
                  {a.delay !== 0 && <span className="text-gray-400 font-normal">({a.delay > 0 ? '+' : ''}{a.delay}m)</span>}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────

function buildFilters(vehicles) {
  const map = new Map()
  for (const v of vehicles) {
    const key = `${v.routeId}:${v.directionId ?? 0}`
    if (!map.has(key)) {
      const route = findRoute(v.routeId)
      map.set(key, {
        key,
        routeId: v.routeId,
        directionId: v.directionId ?? 0,
        label: v.headsign ?? route?.shortName ?? v.routeId ?? '?',
        shortName: route?.shortName ?? v.routeId ?? '?',
        color: route?.color ?? '#6B7280',
        count: 0,
      })
    }
    map.get(key).count++
  }
  return [...map.values()].sort((a, b) =>
    a.shortName.localeCompare(b.shortName) || a.directionId - b.directionId
  )
}

function LineFilter({ filters, activeFilter, totalCount, onSelect }) {
  const [query, setQuery] = useState('')
  const [browseOpen, setBrowseOpen] = useState(false)
  const containerRef = useRef(null)

  // Close browse dropdown on outside click
  useEffect(() => {
    function onMouseDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setBrowseOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  const activeFilterObj = activeFilter !== 'all' ? filters.find(f => f.key === activeFilter) : null

  // Suggestions shown while typing
  const suggestions = query.length > 0
    ? filters.filter(f =>
        f.shortName.toLowerCase().includes(query.toLowerCase()) ||
        f.label.toLowerCase().includes(query.toLowerCase())
      )
    : []

  function selectFilter(key) {
    onSelect(key)
    setQuery('')
    setBrowseOpen(false)
  }

  function clear() {
    onSelect('all')
    setQuery('')
    setBrowseOpen(false)
  }

  return (
    <div ref={containerRef} className="relative flex gap-2 items-start">

      {/* Search input + suggestions */}
      <div className="relative flex-1">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search lines — e.g. FF1, A Line, 15, Colfax…"
          value={query}
          onChange={e => { setQuery(e.target.value); setBrowseOpen(false) }}
          onFocus={() => setBrowseOpen(false)}
          className="w-full pl-9 pr-8 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
        {(query || activeFilterObj) && (
          <button
            onClick={clear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <X size={14} />
          </button>
        )}

        {/* Inline active filter badge */}
        {activeFilterObj && !query && (
          <div
            className="absolute left-9 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-xs font-medium pointer-events-none"
            style={{ backgroundColor: activeFilterObj.color }}
          >
            <span className="font-bold">{activeFilterObj.shortName}</span>
            {activeFilterObj.label !== activeFilterObj.shortName && (
              <>
                <ArrowRight size={9} />
                <span>{activeFilterObj.label}</span>
              </>
            )}
          </div>
        )}

        {/* Search suggestions dropdown */}
        {query.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
            {suggestions.length > 0 ? (
              suggestions.map(f => (
                <button
                  key={f.key}
                  onMouseDown={() => selectFilter(f.key)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-gray-50 text-left"
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: f.color }}
                  >
                    {f.shortName.slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-gray-900">{f.shortName}</span>
                    {f.label !== f.shortName && (
                      <span className="text-gray-400 ml-1.5 text-xs flex items-center gap-0.5 inline-flex">
                        <ArrowRight size={9} />{f.label}
                      </span>
                    )}
                  </div>
                  <span className="text-gray-400 text-xs shrink-0">{f.count} vehicles</span>
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-sm text-gray-400">No lines match "{query}"</div>
            )}
          </div>
        )}
      </div>

      {/* Browse all lines button + dropdown */}
      <div className="relative shrink-0">
        <button
          onClick={() => { setBrowseOpen(o => !o); setQuery('') }}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap ${
            browseOpen
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          <List size={14} />
          Browse all lines
          <ChevronDown size={13} className={`transition-transform duration-150 ${browseOpen ? 'rotate-180' : ''}`} />
        </button>

        {browseOpen && (
          <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 w-72 overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Active lines</span>
              <span className="text-xs text-gray-400">{filters.length} directions</span>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {/* All option */}
              <button
                onMouseDown={() => selectFilter('all')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-gray-50 text-left ${
                  activeFilter === 'all' ? 'bg-blue-50' : ''
                }`}
              >
                <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                  <Bus size={13} className="text-gray-500" />
                </div>
                <span className="font-medium text-gray-700 flex-1">All lines</span>
                <span className="text-gray-400 text-xs">{totalCount} vehicles</span>
              </button>

              {filters.map(f => (
                <button
                  key={f.key}
                  onMouseDown={() => selectFilter(f.key)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-gray-50 text-left ${
                    activeFilter === f.key ? 'bg-blue-50' : ''
                  }`}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: f.color }}
                  >
                    {f.shortName.slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900">{f.shortName}</div>
                    {f.label !== f.shortName && (
                      <div className="text-xs text-gray-400 flex items-center gap-0.5 truncate">
                        <ArrowRight size={9} className="shrink-0" />{f.label}
                      </div>
                    )}
                  </div>
                  <span className="text-gray-400 text-xs shrink-0">{f.count}</span>
                  {activeFilter === f.key && (
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function LiveTracker() {
  const { vehicles: liveVehicles, loading, error, lastUpdated, refresh } = useVehiclePositions()
  const [activeFilter, setActiveFilter] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const [shapes, setShapes] = useState(null)
  const [stops, setStops] = useState(null)
  const [selectedStop, setSelectedStop] = useState(null)

  useEffect(() => { getShapes().then(setShapes).catch(() => {}) }, [])
  useEffect(() => { getStops().then(setStops).catch(() => {}) }, [])

  const vehicles = error ? MOCK_VEHICLES : (liveVehicles ?? [])
  const isLive = !error && liveVehicles !== null
  const filters = buildFilters(vehicles)

  const filtered = activeFilter === 'all'
    ? vehicles
    : (() => {
        const [routeId, dirStr] = activeFilter.split(':')
        const dir = parseInt(dirStr ?? '0')
        return vehicles.filter(v => v.routeId === routeId && (v.directionId ?? 0) === dir)
      })()

  // Group filtered vehicles by route+direction for the grouped list
  const groups = buildFilters(filtered).map(f => ({
    filter: f,
    vehicles: filtered.filter(
      v => v.routeId === f.routeId && (v.directionId ?? 0) === f.directionId
    ),
  }))

  function selectVehicle(id) {
    setSelectedId(prev => prev === id ? null : id)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
          Live Tracker
        </h1>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {loading && <Loader size={12} className="animate-spin" />}
          {lastUpdated && `Updated ${lastUpdated.toLocaleTimeString()}`}
          <button onClick={refresh} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-yellow-800">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>Could not fetch RTD feeds: <strong>{error}</strong> — showing mock data.</span>
        </div>
      )}

      {/* Map */}
      <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: 460 }}>
        <MapContainer center={DENVER_CENTER} zoom={11} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <RoutePolyline shapes={shapes} activeFilter={activeFilter} filters={filters} />
          <StopLayer stops={stops} onStopClick={s => { setSelectedStop(s); setSelectedId(null) }} />
          {filtered.map(v => (
            <VehicleMarker key={v.id} v={v} onClick={() => { selectVehicle(v.id); setSelectedStop(null) }} />
          ))}
          <MapFocus vehicles={filtered} selectedId={selectedId} />
        </MapContainer>
      </div>

      {/* Stop arrivals panel */}
      <StopArrivalsPanel stop={selectedStop} onClose={() => setSelectedStop(null)} />

      {/* Search + browse */}
      <LineFilter
        filters={filters}
        activeFilter={activeFilter}
        totalCount={vehicles.length}
        onSelect={key => { setActiveFilter(key); setSelectedId(null) }}
      />

      {/* Route groups */}
      {loading && liveVehicles === null ? (
        <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
          <Loader size={18} className="animate-spin" />
          Loading live feed…
        </div>
      ) : groups.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">No vehicles match the current filter.</p>
      ) : (
        <div className="space-y-2">
          {groups.map(({ filter, vehicles: gVehicles }) => (
            <RouteGroup
              key={filter.key}
              filter={filter}
              vehicles={gVehicles}
              selectedId={selectedId}
              onSelectVehicle={selectVehicle}
            />
          ))}
        </div>
      )}
    </div>
  )
}
