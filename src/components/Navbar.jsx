import { NavLink } from 'react-router-dom'
import { MapPin, Navigation, Map, AlertTriangle, Bus, Clock } from 'lucide-react'

const links = [
  { to: '/', label: 'Dashboard', icon: Bus },
  { to: '/planner', label: 'Trip Planner', icon: Navigation },
  { to: '/tracker', label: 'Live Tracker', icon: MapPin },
  { to: '/stops', label: 'Stops', icon: Clock },
  { to: '/routes', label: 'Routes', icon: Map },
  { to: '/alerts', label: 'Alerts', icon: AlertTriangle },
]

export default function Navbar() {
  return (
    <nav className="bg-[#003DA5] text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-2 py-3 border-b border-blue-700">
          <div className="bg-white rounded p-1">
            <Bus className="text-[#003DA5]" size={22} />
          </div>
          <span className="font-bold text-xl tracking-tight">Denver RTD</span>
          <span className="ml-2 text-blue-300 text-sm hidden sm:block">Regional Transportation District</span>
        </div>
        <div className="flex gap-1 py-1 overflow-x-auto">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-2 rounded text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-white text-[#003DA5]'
                    : 'text-blue-100 hover:bg-blue-700'
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
