import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Navigation, Clock, ArrowRight, RotateCcw, MapPin,
  Bus, Train, Zap, Car, ParkingSquare, Footprints, Search, X,
} from 'lucide-react'
import { POPULAR_LOCATIONS, ROUTES, PARK_AND_RIDE } from '../data/mockData'

// ── Constants ─────────────────────────────────────────────────────────────────

const TRANSIT_ONLY_TRIPS = [
  {
    id: 1, duration: '32 min', departure: '10:15 AM', arrival: '10:47 AM',
    legs: [
      { type: 'walk', desc: 'Walk to Union Station', time: '5 min' },
      { type: 'transit', routeId: 'A', desc: 'A Line toward DIA', stops: 4, time: '22 min' },
      { type: 'walk', desc: 'Walk to destination', time: '5 min' },
    ],
  },
  {
    id: 2, duration: '48 min', departure: '10:18 AM', arrival: '11:06 AM',
    legs: [
      { type: 'walk', desc: 'Walk to 16th & California', time: '3 min' },
      { type: 'transit', routeId: '16', desc: '16th St Mall Shuttle (free)', stops: 6, time: '12 min' },
      { type: 'transit', routeId: '15', desc: 'Route 15 toward East Colfax', stops: 8, time: '28 min' },
      { type: 'walk', desc: 'Walk to destination', time: '5 min' },
    ],
  },
]

const DRIVE_TRANSIT_TRIPS = [
  {
    id: 1, duration: '41 min', departure: '10:05 AM', arrival: '10:46 AM', parkAndRideId: 'PR1',
    legs: [
      { type: 'drive', desc: 'Drive to Lakewood/Wadsworth P&R', time: '12 min', distance: '5.2 mi' },
      { type: 'park', parkAndRideId: 'PR1', desc: 'Park at Lakewood/Wadsworth P&R', time: '3 min' },
      { type: 'transit', routeId: 'W', desc: 'W Line toward Union Station', stops: 7, time: '21 min' },
      { type: 'walk', desc: 'Walk to destination', time: '5 min' },
    ],
  },
  {
    id: 2, duration: '55 min', departure: '10:00 AM', arrival: '10:55 AM', parkAndRideId: 'PR2',
    legs: [
      { type: 'drive', desc: 'Drive to Nine Mile Station P&R', time: '18 min', distance: '8.7 mi' },
      { type: 'park', parkAndRideId: 'PR2', desc: 'Park at Nine Mile Station P&R', time: '3 min' },
      { type: 'transit', routeId: 'E', desc: 'E Line toward Downtown Denver', stops: 9, time: '29 min' },
      { type: 'walk', desc: 'Walk to destination', time: '5 min' },
    ],
  },
  {
    id: 3, duration: '38 min', departure: '10:08 AM', arrival: '10:46 AM', parkAndRideId: 'PR4',
    legs: [
      { type: 'drive', desc: 'Drive to Peña Station P&R', time: '9 min', distance: '3.8 mi' },
      { type: 'park', parkAndRideId: 'PR4', desc: 'Park at Peña Station P&R', time: '3 min' },
      { type: 'transit', routeId: 'A', desc: 'A Line toward Union Station / DIA', stops: 5, time: '21 min' },
      { type: 'walk', desc: 'Walk to destination', time: '5 min' },
    ],
  },
]

const ROUTE_TYPE_ICON = { bus: Bus, 'light-rail': Train, 'commuter-rail': Train, 'bus-rapid-transit': Zap }
const MODES = [
  { id: 'transit', label: 'Transit only', icon: Bus },
  { id: 'drive-transit', label: 'Drive + Transit', icon: Car },
]

// ── Geocoding ─────────────────────────────────────────────────────────────────

async function geocode(query) {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '6',
    countrycodes: 'us',
    viewbox: '-105.5,39.4,-104.4,40.2',
    bounded: '0',
  })
  const res = await fetch(`/api/geocode/search?${params}`, {
    headers: { 'Accept-Language': 'en' },
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.map(r => ({
    label: r.display_name.split(',').slice(0, 3).join(', ').trim(),
    full: r.display_name,
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
    type: r.type,
  }))
}

// ── AddressInput ──────────────────────────────────────────────────────────────

function AddressInput({ value, onChange, placeholder, pinColor, onClear }) {
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const debounceRef = useRef(null)
  const containerRef = useRef(null)

  // Close on outside click
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
        className="w-full pl-9 pr-8 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={() => pick(s)}
              className="w-full flex items-start gap-2.5 px-3 py-2.5 text-sm hover:bg-gray-50 text-left"
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

// ── TimeSelector ──────────────────────────────────────────────────────────────

const TIME_MODES = [
  { id: 'now', label: 'Now' },
  { id: 'leave-at', label: 'Leave at' },
  { id: 'arrive-by', label: 'Arrive by' },
]

function TimeSelector() {
  const [mode, setMode] = useState('now')
  const [datetime, setDatetime] = useState(() => {
    // Default to current time rounded to nearest 5 min
    const d = new Date()
    d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0)
    return d.toISOString().slice(0, 16)
  })

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Mode pill group */}
      <div className="flex rounded-lg border border-gray-300 overflow-hidden shrink-0">
        {TIME_MODES.map(m => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              mode === m.id
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode !== 'now' && (
        <input
          type="datetime-local"
          value={datetime}
          onChange={e => setDatetime(e.target.value)}
          className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}
    </div>
  )
}

// ── Trip result components ────────────────────────────────────────────────────

function ParkAndRideBadge({ parkAndRideId }) {
  const pr = PARK_AND_RIDE.find(p => p.id === parkAndRideId)
  if (!pr) return null
  const pct = Math.round((pr.freeSpaces / pr.spaces) * 100)
  const availColor = pct > 30 ? 'text-green-600' : pct > 10 ? 'text-yellow-600' : 'text-red-600'
  const barColor = pct > 30 ? 'bg-green-500' : pct > 10 ? 'bg-yellow-500' : 'bg-red-500'
  const routes = ROUTES.filter(r => pr.routeIds.includes(r.id))
  return (
    <div className="mt-2 ml-10 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-700">{pr.name}</span>
        <span className="text-slate-400">{pr.cost} parking</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
        <span className={`font-medium ${availColor}`}>{pr.freeSpaces} of {pr.spaces} spaces free</span>
      </div>
      <div className="flex gap-1 flex-wrap">
        {routes.map(r => (
          <span key={r.id} className="px-1.5 py-0.5 rounded text-white font-bold" style={{ backgroundColor: r.color, fontSize: '10px' }}>
            {r.shortName}
          </span>
        ))}
        <span className="text-slate-400 ml-0.5">lines available here</span>
      </div>
    </div>
  )
}

function TripLeg({ leg, isLast }) {
  const route = leg.routeId ? ROUTES.find(r => r.id === leg.routeId) : null
  const TransitIcon = route ? (ROUTE_TYPE_ICON[route.type] || Bus) : null
  let iconBg = '#9CA3AF', Icon = Footprints
  if (leg.type === 'drive') { iconBg = '#374151'; Icon = Car }
  else if (leg.type === 'park') { iconBg = '#6366F1'; Icon = ParkingSquare }
  else if (leg.type === 'transit') { iconBg = route?.color || '#3B82F6'; Icon = TransitIcon || Bus }

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
            {leg.type === 'transit' && leg.stops && <span className="ml-1.5 text-xs text-gray-400">{leg.stops} stops</span>}
            {leg.type === 'drive' && leg.distance && <span className="ml-1.5 text-xs text-gray-400">{leg.distance}</span>}
          </div>
          <span className="text-xs text-gray-400 shrink-0">{leg.time}</span>
        </div>
        {leg.type === 'park' && <ParkAndRideBadge parkAndRideId={leg.parkAndRideId} />}
      </div>
    </div>
  )
}

function TripCard({ trip }) {
  const [expanded, setExpanded] = useState(false)
  const pr = trip.parkAndRideId ? PARK_AND_RIDE.find(p => p.id === trip.parkAndRideId) : null
  const transitLegs = trip.legs.filter(l => l.type === 'transit')

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-1 shrink-0">
          {trip.legs.filter(l => ['drive', 'transit'].includes(l.type)).map((leg, i) => {
            const route = leg.routeId ? ROUTES.find(r => r.id === leg.routeId) : null
            const LegIcon = leg.type === 'drive' ? Car : (route ? ROUTE_TYPE_ICON[route.type] || Bus : Bus)
            return (
              <div key={i} className="flex items-center gap-0.5">
                {i > 0 && <ArrowRight size={10} className="text-gray-300" />}
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: leg.type === 'drive' ? '#374151' : route?.color || '#3B82F6' }}>
                  <LegIcon size={11} />
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-900">{trip.duration}</span>
            {pr && <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">Park at {pr.name.replace(' P&R', '')}</span>}
            {transitLegs.map(l => {
              const r = ROUTES.find(r => r.id === l.routeId)
              return r ? <span key={l.routeId} className="text-xs text-white px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: r.color }}>{r.shortName}</span> : null
            })}
          </div>
        </div>
        <div className="text-sm text-gray-500 shrink-0 flex items-center gap-1">
          {trip.departure}<ArrowRight size={12} />{trip.arrival}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-gray-100 px-4 pt-3 pb-1">
          {trip.legs.map((leg, i) => <TripLeg key={i} leg={leg} isLast={i === trip.legs.length - 1} />)}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TripPlanner() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [mode, setMode] = useState('transit')
  const [trips, setTrips] = useState(null)
  const [loading, setLoading] = useState(false)

  function handleSearch(e) {
    e.preventDefault()
    if (!from || !to) return
    setLoading(true)
    setTimeout(() => {
      setTrips(mode === 'drive-transit' ? DRIVE_TRANSIT_TRIPS : TRANSIT_ONLY_TRIPS)
      setLoading(false)
    }, 800)
  }

  function handleSwap() {
    setFrom(to)
    setTo(from)
    setTrips(null)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Navigation className="text-blue-600" size={24} />
          Trip Planner
        </h1>
        <p className="text-gray-500 mt-1 text-sm">Find the best route between two points in Denver</p>
      </div>

      <form onSubmit={handleSearch} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        {/* Mode */}
        <div className="flex gap-2">
          {MODES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => { setMode(id); setTrips(null) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                mode === id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
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
              onChange={v => { setFrom(v); setTrips(null) }}
              onClear={() => { setFrom(''); setTrips(null) }}
              placeholder="From: address or stop name"
              pinColor="text-green-500"
            />
            <AddressInput
              value={to}
              onChange={v => { setTo(v); setTrips(null) }}
              onClear={() => { setTo(''); setTrips(null) }}
              placeholder="To: address or stop name"
              pinColor="text-red-500"
            />
          </div>
          <button
            type="button"
            onClick={handleSwap}
            className="self-center p-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-500"
            title="Swap"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        {/* Time selector + search */}
        <div className="flex gap-2 items-center flex-wrap">
          <TimeSelector />
          <button
            type="submit"
            disabled={!from || !to || loading}
            className="ml-auto px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {loading ? 'Searching…' : 'Search'}
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
                onClick={() => { setTo(loc.name); setTrips(null) }}
                className="text-xs px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 transition-colors"
              >
                {loc.name}
              </button>
            ))}
          </div>
        </div>
      </form>

      {/* Park & ride panel */}
      {mode === 'drive-transit' && !trips && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-indigo-900 flex items-center gap-2 mb-2">
            <ParkingSquare size={15} />Nearby Park & Ride locations
          </h2>
          <div className="grid sm:grid-cols-2 gap-2">
            {PARK_AND_RIDE.slice(0, 4).map(pr => {
              const pct = Math.round((pr.freeSpaces / pr.spaces) * 100)
              const availColor = pct > 30 ? 'text-green-600' : pct > 10 ? 'text-yellow-600' : 'text-red-600'
              const routes = ROUTES.filter(r => pr.routeIds.includes(r.id))
              return (
                <div key={pr.id} className="bg-white rounded-lg border border-indigo-100 p-2.5 text-xs">
                  <div className="font-semibold text-gray-800">{pr.name}</div>
                  <div className="text-gray-400 mt-0.5 mb-1.5">{pr.address}</div>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1">
                      {routes.map(r => <span key={r.id} className="px-1.5 py-0.5 rounded text-white font-bold" style={{ backgroundColor: r.color, fontSize: '10px' }}>{r.shortName}</span>)}
                    </div>
                    <span className={`font-medium ${availColor}`}>{pr.freeSpaces} spaces free</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Results */}
      {trips && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">{trips.length} options found — click a result to expand the full route</p>
          {trips.map(trip => <TripCard key={trip.id} trip={trip} />)}
          <p className="text-xs text-gray-400 text-center pt-1">
            Results are simulated. Connect to{' '}
            <a href="https://www.rtd-denver.com/developer-resources" target="_blank" rel="noreferrer" className="underline">RTD's real-time API</a>
            {' '}+ a routing engine (e.g. OpenTripPlanner) for live results.
          </p>
        </div>
      )}
    </div>
  )
}
