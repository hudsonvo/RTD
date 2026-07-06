import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Bus, Train, MapPin, ChevronDown, ChevronUp, Star } from 'lucide-react'
import { ROUTES, STOPS } from '../data/mockData'
import { useFavorites } from '../hooks/useFavorites'

const TYPE_ICON = { bus: Bus, train: Train }
const TYPE_LABEL = { bus: 'Bus', train: 'Train' }
const FILTERS = ['all', 'bus', 'train']

function normalizeType(type) {
  if (type === 'light-rail' || type === 'commuter-rail') return 'train'
  if (type === 'bus-rapid-transit') return 'bus'
  return type
}

export default function Routes() {
  const [searchParams] = useSearchParams()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(searchParams.get('id') || null)
  const { isFavorite, toggle } = useFavorites()

  const filtered = ROUTES.filter(r => {
    const matchType = filter === 'all' || normalizeType(r.type) === filter
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.description.toLowerCase().includes(search.toLowerCase()) ||
      r.shortName.toLowerCase().includes(search.toLowerCase())
    return matchType && matchSearch
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <div className="px-1">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Bus className="text-blue-600" size={22} />
          Routes
        </h1>
        <p className="text-gray-500 mt-0.5 text-sm">Browse all RTD routes, schedules, and stops</p>
      </div>

      {/* Search & filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          placeholder="Search routes…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
        />
        <div className="flex gap-1.5 overflow-x-auto bg-white rounded-xl shadow-sm p-1">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                filter === f ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {f === 'all' ? 'All' : TYPE_LABEL[f]}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No routes match your search.</div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {filtered.map((route, idx) => {
            const Icon = TYPE_ICON[normalizeType(route.type)] || Bus
            const isExpanded = expanded === route.id
            const routeStops = STOPS.filter(s => s.routes.includes(route.id))

            const fav = isFavorite('route', route.id)
            return (
              <div key={route.id} className={idx > 0 ? 'border-t border-gray-100' : ''}>
                <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors">
                  {/* Route color circle */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 cursor-pointer"
                    style={{ backgroundColor: route.color }}
                    onClick={() => setExpanded(isExpanded ? null : route.id)}
                  >
                    <Icon size={17} />
                  </div>
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => setExpanded(isExpanded ? null : route.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{route.name}</span>
                      {route.isFree && (
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">Free</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-400 truncate">{route.description}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-400 hidden sm:block">{TYPE_LABEL[normalizeType(route.type)]}</span>
                    <button
                      onClick={() => toggle({ type: 'route', id: route.id, name: route.name })}
                      className={`p-1.5 rounded-lg transition-colors ${fav ? 'text-yellow-500 hover:text-yellow-600' : 'text-gray-300 hover:text-gray-400'}`}
                      title={fav ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <Star size={15} fill={fav ? 'currentColor' : 'none'} />
                    </button>
                    <div
                      className="cursor-pointer"
                      onClick={() => setExpanded(isExpanded ? null : route.id)}
                    >
                      {isExpanded
                        ? <ChevronUp size={15} className="text-gray-400" />
                        : <ChevronDown size={15} className="text-gray-400" />
                      }
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-4 bg-gray-50">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Key Stops</h3>
                        {routeStops.length > 0 ? (
                          <div className="space-y-1.5">
                            {routeStops.map(stop => (
                              <div key={stop.id} className="flex items-center gap-2 text-sm text-gray-600">
                                <MapPin size={12} className="text-blue-400 shrink-0" />
                                {stop.name}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400">Stop data not available</p>
                        )}
                      </div>
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Schedule</h3>
                        <div className="space-y-1.5 text-sm text-gray-600">
                          <div className="flex justify-between">
                            <span>Weekday service</span>
                            <span className="font-medium text-gray-800">5:00 AM – 12:00 AM</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Weekend service</span>
                            <span className="font-medium text-gray-800">6:00 AM – 11:00 PM</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Frequency (peak)</span>
                            <span className="font-medium text-gray-800">Every 15 min</span>
                          </div>
                        </div>
                        <a
                          href={`https://app.rtd-denver.com/route/${route.id}/schedule`}
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
      )}
    </div>
  )
}
