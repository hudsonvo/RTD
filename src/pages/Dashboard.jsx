import { Link } from 'react-router-dom'
import { Navigation, MapPin, Map, AlertTriangle, Clock, Bus, Train, Zap, Star, ArrowRight } from 'lucide-react'
import { ROUTES } from '../data/mockData'
import { useFavorites } from '../hooks/useFavorites'
import { useVehiclePositions, useAlerts } from '../hooks/useRTDFeeds'

const ROUTE_TYPE_ICON = {
  'bus': Bus,
  'light-rail': Train,
  'commuter-rail': Train,
  'bus-rapid-transit': Zap,
}

const SEVERITY_ACCENT = {
  warning: '#EAB308',
  info: '#3B82F6',
  success: '#22C55E',
}

export default function Dashboard() {
  const { vehicles, loading: vehiclesLoading } = useVehiclePositions()
  const { alerts, loading: alertsLoading } = useAlerts()
  const recentAlerts = (alerts ?? []).slice(0, 3)
  const liveVehicles = (vehicles ?? []).slice(0, 5)
  const { favorites } = useFavorites()

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
      <div className="px-1">
        <h1 className="text-2xl font-bold text-gray-900">Denver RTD</h1>
        <p className="text-gray-500 mt-0.5 text-sm">Real-time transit for the Denver metro area</p>
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-2xl shadow-sm p-2 grid grid-cols-3 sm:grid-cols-5 gap-1">
        {[
          { to: '/planner', icon: Navigation, label: 'Plan Trip', color: 'bg-blue-600' },
          { to: '/tracker', icon: MapPin, label: 'Live Map', color: 'bg-emerald-600' },
          { to: '/stops', icon: Clock, label: 'Stops', color: 'bg-teal-600' },
          { to: '/routes', icon: Map, label: 'Routes', color: 'bg-violet-600' },
          { to: '/alerts', icon: AlertTriangle, label: 'Alerts', color: 'bg-orange-500' },
        ].map(({ to, icon: Icon, label, color }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center gap-2 py-4 px-2 rounded-xl hover:bg-gray-50 transition-colors text-center"
          >
            <div className={`${color} text-white p-2.5 rounded-xl`}>
              <Icon size={20} />
            </div>
            <span className="text-xs font-medium text-gray-700">{label}</span>
          </Link>
        ))}
      </div>

      {/* Favorites */}
      {favorites.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
            <Star size={14} className="text-yellow-500" fill="currentColor" />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Favorites</span>
          </div>
          {favorites.map(fav => (
            <Link
              key={`${fav.type}-${fav.id}`}
              to={fav.type === 'stop' ? `/stops?id=${fav.id}` : `/routes?id=${fav.id}`}
              className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${fav.type === 'stop' ? 'bg-blue-100' : 'bg-violet-100'}`}>
                {fav.type === 'stop'
                  ? <MapPin size={13} className="text-blue-600" />
                  : <Bus size={13} className="text-violet-600" />
                }
              </div>
              <span className="flex-1 text-sm text-gray-800">{fav.name}</span>
              <ArrowRight size={13} className="text-gray-300" />
            </Link>
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Live vehicles */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Vehicles
            </h2>
            <Link to="/tracker" className="text-blue-600 text-xs hover:underline">View map →</Link>
          </div>
          {vehiclesLoading && !vehicles ? (
            <div className="text-sm text-gray-400 py-8 text-center">Loading vehicles…</div>
          ) : liveVehicles.map((v) => {
            const route = ROUTES.find(r => r.id === v.routeId)
            return (
              <div key={v.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ backgroundColor: route?.color || '#6B7280' }}
                >
                  {route?.shortName ?? v.routeId}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{route?.name ?? `Route ${v.routeId}`}</div>
                  <div className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock size={10} />
                    {v.nextStopName ?? v.nextStop ?? '—'}
                  </div>
                </div>
                <div className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  v.delay === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {v.delay === 0 ? 'On time' : `+${v.delay}m`}
                </div>
              </div>
            )
          })}
        </div>

        {/* Recent alerts */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Recent Alerts</h2>
            <Link to="/alerts" className="text-blue-600 text-xs hover:underline">All alerts →</Link>
          </div>
          {alertsLoading && !alerts ? (
            <div className="text-sm text-gray-400 py-8 text-center">Loading alerts…</div>
          ) : recentAlerts.length === 0 ? (
            <div className="text-sm text-gray-400 py-8 text-center">No active alerts</div>
          ) : recentAlerts.map((alert) => (
            <div key={alert.id} className="flex items-start gap-3 px-4 py-3 border-b border-gray-100 last:border-0">
              <div
                className="w-0.5 self-stretch rounded-full shrink-0 mt-0.5"
                style={{ backgroundColor: SEVERITY_ACCENT[alert.severity] ?? '#9CA3AF' }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900 truncate">{alert.title}</div>
                <div className="text-xs text-gray-400 mt-0.5 line-clamp-1">{alert.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Popular routes */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Popular Routes</h2>
        <div className="flex flex-wrap gap-2">
          {ROUTES.map((route) => {
            const Icon = ROUTE_TYPE_ICON[route.type] || Bus
            return (
              <Link
                key={route.id}
                to={`/routes?id=${route.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-xs font-semibold hover:opacity-85 transition-opacity"
                style={{ backgroundColor: route.color }}
              >
                <Icon size={11} />
                {route.shortName}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
