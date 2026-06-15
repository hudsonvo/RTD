import { useState, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Search, MapPin, Navigation, Star, RefreshCw, Loader, AlertCircle, ArrowRight, Clock, ChevronLeft } from 'lucide-react'
import { useArrivalsAtStop, useNearbyStops } from '../hooks/useRTDFeeds'
import { getStops, searchStops } from '../api/gtfsStatic'
import { useFavorites } from '../hooks/useFavorites'
import { ROUTES } from '../data/mockData'

const DENVER_CENTER = [39.7392, -104.9903]

function findRoute(routeId) {
  if (!routeId) return null
  return ROUTES.find(r => r.id === routeId) ?? ROUTES.find(r => r.shortName === routeId) ?? null
}

function stopIcon(color = '#3B82F6') {
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

function userIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="background:#3B82F6;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 3px rgba(59,130,246,0.3)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

function etaLabel(etaSec) {
  if (!etaSec) return null
  const diffMin = Math.round((etaSec - Date.now() / 1000) / 60)
  if (diffMin <= 0) return 'Now'
  if (diffMin < 60) return `${diffMin} min`
  return new Date(etaSec * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function MapRecenter({ center }) {
  const map = useMap()
  useEffect(() => { if (center) map.flyTo(center, 16, { duration: 0.6 }) }, [center, map])
  return null
}

// ── Arrivals board ────────────────────────────────────────────────────────────
function ArrivalsBoard({ stop, onBack }) {
  const { arrivals, loading, error, lastUpdated, refresh } = useArrivalsAtStop(stop.id)
  const { isFavorite, toggle } = useFavorites()
  const fav = isFavorite('stop', stop.id)

  return (
    <div className="space-y-4">
      {/* Stop header */}
      <div className="bg-white rounded-2xl shadow-sm px-4 py-3 flex items-center gap-2">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
          <ChevronLeft size={18} />
        </button>
        <MapPin size={15} className="text-blue-500 shrink-0" />
        <h2 className="font-semibold text-gray-900 flex-1 leading-tight">{stop.name}</h2>
        <button
          onClick={() => toggle({ type: 'stop', id: stop.id, name: stop.name })}
          className={`p-1.5 rounded-lg transition-colors ${fav ? 'text-yellow-500 hover:text-yellow-600' : 'text-gray-300 hover:text-gray-400'}`}
          title={fav ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star size={16} fill={fav ? 'currentColor' : 'none'} />
        </button>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          {loading && <Loader size={11} className="animate-spin" />}
          {lastUpdated && lastUpdated.toLocaleTimeString()}
          <button onClick={refresh} className="p-1 rounded hover:bg-gray-100 text-gray-400 transition-colors">
            <RefreshCw size={11} />
          </button>
        </div>
      </div>

      {/* Stop map */}
      {stop.lat && stop.lon && (
        <div className="rounded-2xl overflow-hidden shadow-sm" style={{ height: 180 }}>
          <MapContainer center={[stop.lat, stop.lon]} zoom={16} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false} zoomControl={false}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={[stop.lat, stop.lon]} icon={stopIcon('#3B82F6')}>
              <Popup>{stop.name}</Popup>
            </Marker>
          </MapContainer>
        </div>
      )}

      {/* Arrivals */}
      {error && (
        <div className="border-l-4 border-yellow-400 bg-yellow-50 px-4 py-3 rounded-r-xl flex items-start gap-2 text-sm text-yellow-800">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          Could not load arrivals: {error}
        </div>
      )}

      {loading && !arrivals ? (
        <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
          <Loader size={18} className="animate-spin" />Loading arrivals…
        </div>
      ) : arrivals?.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No upcoming arrivals found for this stop.</div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {arrivals?.map((a, i) => {
            const route = findRoute(a.routeId)
            const eta = etaLabel(a.etaSec)
            return (
              <div key={i} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                {/* Route color accent */}
                <div
                  className="w-1 self-stretch rounded-full shrink-0"
                  style={{ backgroundColor: route?.color ?? '#6B7280' }}
                />
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ backgroundColor: route?.color ?? '#6B7280' }}
                >
                  {route?.shortName ?? a.routeId?.slice(0, 3) ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 text-sm">{route?.name ?? `Route ${a.routeId}`}</div>
                  {a.headsign && (
                    <div className="text-xs text-gray-400 flex items-center gap-0.5 truncate">
                      <ArrowRight size={9} />{a.headsign}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {eta && <div className="font-bold text-gray-900">{eta}</div>}
                  {a.delay !== 0 && (
                    <div className={`text-xs font-semibold ${a.delay < 0 ? 'text-blue-600' : 'text-yellow-600'}`}>
                      {a.delay < 0 ? `${Math.abs(a.delay)}m early` : `+${a.delay}m`}
                    </div>
                  )}
                  {a.delay === 0 && <div className="text-xs text-emerald-600 font-semibold">On time</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Nearby stops list ─────────────────────────────────────────────────────────
function NearbyStopsList({ stops, userLocation, onSelect }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Stops near you</span>
        <span className="text-xs text-gray-400">{stops.length} within 800m</span>
      </div>

      {userLocation && stops.length > 0 && (
        <div className="rounded-2xl overflow-hidden shadow-sm" style={{ height: 220 }}>
          <MapContainer center={[userLocation.lat, userLocation.lon]} zoom={15} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false} zoomControl={false}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={[userLocation.lat, userLocation.lon]} icon={userIcon()}>
              <Popup>You are here</Popup>
            </Marker>
            {stops.map(s => (
              s.lat && s.lon && (
                <Marker key={s.id} position={[s.lat, s.lon]} icon={stopIcon()} eventHandlers={{ click: () => onSelect(s) }}>
                  <Popup>{s.name}</Popup>
                </Marker>
              )
            ))}
          </MapContainer>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {stops.map((s, i) => (
          <button
            key={s.id}
            onClick={() => onSelect(s)}
            className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left ${i > 0 ? 'border-t border-gray-100' : ''}`}
          >
            <MapPin size={14} className="text-blue-400 shrink-0" />
            <span className="flex-1 text-sm text-gray-900 truncate">{s.name}</span>
            <span className="text-xs text-gray-400 shrink-0">{s.dist}m</span>
            <ArrowRight size={13} className="text-gray-300 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Stops() {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [selectedStop, setSelectedStop] = useState(null)
  const { stops: nearbyStops, userLocation, locError, locLoading, locate } = useNearbyStops()

  useEffect(() => {
    if (query.length < 2) { setSuggestions([]); return }
    getStops()
      .then(stops => setSuggestions(searchStops(stops, query)))
      .catch(() => setSuggestions([]))
  }, [query])

  function selectStop(stop) {
    setSelectedStop(stop)
    setQuery('')
    setSuggestions([])
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="px-1">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <MapPin className="text-blue-600" size={22} />
          Stop Finder
        </h1>
      </div>

      {!selectedStop && (
        <>
          {/* Search + locate */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search stops — e.g. Union Station, Colfax…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
              />
              {suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-xl z-50 overflow-hidden border border-gray-100">
                  {suggestions.map(s => (
                    <button
                      key={s.id}
                      onMouseDown={() => selectStop(s)}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm hover:bg-gray-50 text-left border-b border-gray-100 last:border-0"
                    >
                      <MapPin size={13} className="text-blue-400 shrink-0" />
                      <span className="flex-1 truncate">{s.name}</span>
                      <span className="text-gray-400 text-xs shrink-0">#{s.id}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={locate}
              disabled={locLoading}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors whitespace-nowrap"
            >
              {locLoading ? <Loader size={14} className="animate-spin" /> : <Navigation size={14} />}
              Near me
            </button>
          </div>

          {locError && (
            <div className="border-l-4 border-yellow-400 bg-yellow-50 px-4 py-3 rounded-r-xl flex items-start gap-2 text-sm text-yellow-800">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              {locError}
            </div>
          )}

          {nearbyStops && (
            <NearbyStopsList stops={nearbyStops} userLocation={userLocation} onSelect={selectStop} />
          )}

          {!nearbyStops && !locLoading && (
            <div className="text-center py-16 text-gray-400 space-y-2">
              <MapPin size={32} className="mx-auto text-gray-300" />
              <p className="text-sm">Search for a stop above, or tap <strong>Near me</strong> to find stops around you.</p>
            </div>
          )}
        </>
      )}

      {selectedStop && (
        <ArrivalsBoard stop={selectedStop} onBack={() => setSelectedStop(null)} />
      )}
    </div>
  )
}
