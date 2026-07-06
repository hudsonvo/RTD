import { NavLink, Link, useNavigate } from 'react-router-dom'
import { MapPin, Navigation, Map, AlertTriangle, Clock, LogOut, UserCircle, Star } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const links = [
  { to: '/planner', label: 'Trip Planner', icon: Navigation },
  { to: '/tracker', label: 'Live Tracker', icon: MapPin },
  { to: '/stops', label: 'Stops', icon: Clock },
  { to: '/routes', label: 'Routes', icon: Map },
  { to: '/alerts', label: 'Alerts', icon: AlertTriangle },
  { to: '/favorites', label: 'Favorites', icon: Star },
]

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 relative">
      {/* Logo — anchored to top-left, does not affect layout flow */}
      <Link to="/planner" className="absolute top-0 left-4 z-10 flex items-center gap-3 h-24">
        <img src="/rtd_logo.png" alt="RTD" className="h-24" />
        <div className="hidden sm:block">
          <div className="text-sm font-semibold text-gray-800 leading-tight">Regional Transportation District</div>
          <div className="text-xs text-gray-400 leading-tight">Denver Metro Area</div>
        </div>
      </Link>

      <div className="max-w-7xl mx-auto px-4">
        {/* Top bar — left padding reserves space so content clears the logo */}
        <div className="flex items-center py-3 border-b border-gray-100 pl-72">
          {/* Auth controls */}
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <>
                <Link
                  to="/account"
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 text-sm transition-colors"
                >
                  <UserCircle size={15} className="text-gray-400" />
                  <span className="max-w-[140px] truncate">{user.name ?? user.email.split('@')[0]}</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 text-sm font-medium transition-colors"
                  title="Sign out"
                >
                  <LogOut size={14} />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#CC0000] text-white text-sm font-semibold hover:bg-[#AA0000] transition-colors"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>

        {/* Nav links */}
        <div className="flex gap-0.5 py-1 overflow-x-auto pl-72">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                  isActive
                    ? 'text-[#CC0000] border-[#CC0000]'
                    : 'text-gray-600 hover:text-gray-900 border-transparent'
                }`
              }
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  )
}
