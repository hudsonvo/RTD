import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Bus, Train, Zap, MapPin, ChevronDown, ChevronUp } from 'lucide-react'
import { ROUTES, STOPS } from '../data/mockData'

const TYPE_ICON = { bus: Bus, 'light-rail': Train, 'commuter-rail': Train, 'bus-rapid-transit': Zap }
const TYPE_LABEL = {
  bus: 'Bus',
  'light-rail': 'Light Rail',
  'commuter-rail': 'Commuter Rail',
  'bus-rapid-transit': 'Bus Rapid Transit',
}

const FILTERS = ['all', 'bus', 'light-rail', 'commuter-rail', 'bus-rapid-transit']

export default function Routes() {
  const [searchParams] = useSearchParams()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(searchParams.get('id') || null)

  const filtered = ROUTES.filter(r => {
    const matchType = filter === 'all' || r.type === filter
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.description.toLowerCase().includes(search.toLowerCase()) ||
      r.shortName.toLowerCase().includes(search.toLowerCase())
    return matchType && matchSearch
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Bus className="text-blue-600" size={24} />
          Routes
        </h1>
        <p className="text-gray-500 mt-1 text-sm">Browse all RTD routes, schedules, and stops</p>
      </div>

      {/* Search & filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          placeholder="Search routes…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-1.5 overflow-x-auto">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? 'All' : TYPE_LABEL[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">No routes match your search.</div>
        )}
        {filtered.map((route) => {
          const Icon = TYPE_ICON[route.type] || Bus
          const isExpanded = expanded === route.id
          const routeStops = STOPS.filter(s => s.routes.includes(route.id))

          return (
            <div key={route.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left"
                onClick={() => setExpanded(isExpanded ? null : route.id)}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 font-bold"
                  style={{ backgroundColor: route.color }}
                >
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{route.name}</span>
                    {route.isFree && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Free</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 truncate">{route.description}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-gray-400 hidden sm:block">{TYPE_LABEL[route.type]}</span>
                  {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-gray-100 p-4 bg-gray-50">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Key Stops</h3>
                      {routeStops.length > 0 ? (
                        <div className="space-y-1.5">
                          {routeStops.map(stop => (
                            <div key={stop.id} className="flex items-center gap-2 text-sm text-gray-600">
                              <MapPin size={13} className="text-blue-400 shrink-0" />
                              {stop.name}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400">Stop data not available</p>
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Schedule</h3>
                      <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex justify-between">
                          <span>Weekday service</span>
                          <span className="font-medium">5:00 AM – 12:00 AM</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Weekend service</span>
                          <span className="font-medium">6:00 AM – 11:00 PM</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Frequency (peak)</span>
                          <span className="font-medium">Every 15 min</span>
                        </div>
                      </div>
                      <a
                        href={`https://www.rtd-denver.com/routes-and-schedules/route/${route.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-block text-xs text-blue-600 hover:underline"
                      >
                        View full schedule on RTD website →
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
