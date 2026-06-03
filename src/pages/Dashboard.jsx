import { Link } from 'react-router-dom'
import { Navigation, MapPin, Map, AlertTriangle, Clock, Bus, Train, Zap, Star, ArrowRight } from 'lucide-react'
import { ALERTS, ROUTES, VEHICLES } from '../data/mockData'
import { useFavorites } from '../hooks/useFavorites'

const ROUTE_TYPE_ICON = {
  'bus': Bus,
  'light-rail': Train,
  'commuter-rail': Train,
  'bus-rapid-transit': Zap,
}

const SEVERITY_STYLES = {
  warning: 'bg-yellow-50 border-yellow-300 text-yellow-800',
  info: 'bg-blue-50 border-blue-300 text-blue-800',
  success: 'bg-green-50 border-green-300 text-green-800',
}

export default function Dashboard() {
  const recentAlerts = ALERTS.slice(0, 2)
  const liveVehicles = VEHICLES.slice(0, 4)
  const { favorites } = useFavorites()

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome to Denver RTD</h1>
        <p className="text-gray-500 mt-1">Real-time transit information for the Denver metro area</p>
      </div>

      {/* Favorites */}
      {favorites.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <Star size={16} className="text-yellow-500" fill="currentColor" />
            Favorites
          </h2>
          <div className="space-y-1.5">
            {favorites.map(fav => (
              <Link
                key={`${fav.type}-${fav.id}`}
                to={fav.type === 'stop' ? `/stops?id=${fav.id}` : `/routes?id=${fav.id}`}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${fav.type === 'stop' ? 'bg-blue-100' : 'bg-purple-100'}`}>
                  {fav.type === 'stop'
                    ? <MapPin size={13} className="text-blue-600" />
                    : <Bus size={13} className="text-purple-600" />
                  }
                </div>
                <span className="flex-1 text-sm text-gray-800">{fav.name}</span>
                <ArrowRight size={13} className="text-gray-300" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { to: '/planner', icon: Navigation, label: 'Plan a Trip', color: 'bg-blue-600', desc: 'Get directions' },
          { to: '/tracker', icon: MapPin, label: 'Live Tracker', color: 'bg-green-600', desc: 'Track vehicles' },
          { to: '/stops', icon: Clock, label: 'Stop Finder', color: 'bg-teal-600', desc: 'Arrivals board' },
          { to: '/routes', icon: Map, label: 'Browse Routes', color: 'bg-purple-600', desc: 'Schedules & stops' },
          { to: '/alerts', icon: AlertTriangle, label: 'Service Alerts', color: 'bg-orange-500', desc: `${ALERTS.length} active` },
        ].map(({ to, icon: Icon, label, color, desc }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-gray-200 hover:shadow-md transition-shadow text-center"
          >
            <div className={`${color} text-white p-3 rounded-lg`}>
              <Icon size={22} />
            </div>
            <div>
              <div className="font-semibold text-gray-900 text-sm">{label}</div>
              <div className="text-gray-400 text-xs">{desc}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Live vehicles */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Live Vehicles
            </h2>
            <Link to="/tracker" className="text-blue-600 text-sm hover:underline">View map →</Link>
          </div>
          <div className="space-y-2">
            {liveVehicles.map((v) => {
              const route = ROUTES.find(r => r.id === v.routeId)
              const Icon = ROUTE_TYPE_ICON[route?.type] || Bus
              return (
                <div key={v.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: route?.color || '#666' }}
                  >
                    {route?.shortName}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{route?.name}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock size={11} />
                      Next: {v.nextStop}
                    </div>
                  </div>
                  <div className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    v.delay === 0 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {v.delay === 0 ? 'On time' : `+${v.delay} min`}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Recent alerts */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Recent Alerts</h2>
            <Link to="/alerts" className="text-blue-600 text-sm hover:underline">All alerts →</Link>
          </div>
          <div className="space-y-2">
            {recentAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border text-sm ${SEVERITY_STYLES[alert.severity]}`}
              >
                <div className="font-semibold">{alert.title}</div>
                <div className="mt-0.5 opacity-80 text-xs line-clamp-2">{alert.description}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Popular routes */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-semibold text-gray-900 mb-3">Popular Routes</h2>
        <div className="flex flex-wrap gap-2">
          {ROUTES.map((route) => {
            const Icon = ROUTE_TYPE_ICON[route.type] || Bus
            return (
              <Link
                key={route.id}
                to={`/routes?id=${route.id}`}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 hover:shadow-sm transition text-sm"
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: route.color }}
                >
                  <Icon size={10} />
                </div>
                <span className="font-medium text-gray-800">{route.shortName}</span>
                <span className="text-gray-400 hidden sm:inline">{route.description}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* API notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <strong>Developer note:</strong> This app is running on mock data. To connect to live RTD feeds, get your API key at{' '}
        <a
          href="https://www.rtd-denver.com/developer-resources"
          target="_blank"
          rel="noreferrer"
          className="underline font-medium"
        >
          rtd-denver.com/developer-resources
        </a>
        {' '}and add your key to <code className="bg-blue-100 px-1 rounded">.env</code> as{' '}
        <code className="bg-blue-100 px-1 rounded">VITE_RTD_API_KEY</code>.
      </div>
    </div>
  )
}
