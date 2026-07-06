import { Link } from 'react-router-dom'
import { Star, MapPin, Map, Trash2, LogIn } from 'lucide-react'
import { useFavorites } from '../hooks/useFavorites'
import { useAuth } from '../contexts/AuthContext'
import { ROUTES } from '../data/mockData'

function routeColor(routeId) {
  return ROUTES.find(r => r.id === routeId)?.color ?? '#6B7280'
}

function FavoriteItem({ item, onRemove }) {
  const isStop = item.type === 'stop'
  const linkTo = isStop ? `/stops?id=${item.id}` : `/routes?id=${item.id}`

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {isStop ? (
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
          <MapPin size={14} className="text-blue-600" />
        </div>
      ) : (
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: routeColor(item.id) }}
        >
          <Map size={14} className="text-white" />
        </div>
      )}
      <Link
        to={linkTo}
        className="flex-1 min-w-0 hover:text-blue-600 transition-colors"
      >
        <span className="text-sm font-medium text-gray-900 truncate block">{item.name}</span>
      </Link>
      <button
        onClick={() => onRemove(item)}
        className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 transition-colors shrink-0"
        title="Remove from favorites"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

export default function Favorites() {
  const { favorites, toggle } = useFavorites()
  const { user } = useAuth()

  const stops  = favorites.filter(f => f.type === 'stop')
  const routes = favorites.filter(f => f.type === 'route')

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <div className="px-1">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Star className="text-yellow-500" size={22} />
          Favorites
        </h1>
        <p className="text-gray-500 mt-0.5 text-sm">Your saved stops and routes</p>
      </div>

      {!user && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 text-sm text-blue-700">
          <LogIn size={15} className="shrink-0" />
          <span>
            <Link to="/login" className="font-semibold underline">Sign in</Link> to sync favorites across devices.
            Currently saved locally on this browser.
          </span>
        </div>
      )}

      {favorites.length === 0 ? (
        <div className="text-center py-16 text-gray-400 space-y-2">
          <Star size={32} className="mx-auto text-gray-300" />
          <p>No favorites yet.</p>
          <p className="text-sm">
            Star stops on the <Link to="/stops" className="text-blue-500 hover:underline">Stops</Link> page
            or routes on the <Link to="/routes" className="text-blue-500 hover:underline">Routes</Link> page.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {stops.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 pt-3 pb-1">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Stops</h2>
              </div>
              {stops.map((item, i) => (
                <div key={item.id} className={i > 0 ? 'border-t border-gray-100' : ''}>
                  <FavoriteItem item={item} onRemove={toggle} />
                </div>
              ))}
            </div>
          )}

          {routes.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 pt-3 pb-1">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Routes</h2>
              </div>
              {routes.map((item, i) => (
                <div key={item.id} className={i > 0 ? 'border-t border-gray-100' : ''}>
                  <FavoriteItem item={item} onRemove={toggle} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
