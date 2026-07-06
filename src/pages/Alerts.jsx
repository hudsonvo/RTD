import { AlertTriangle, Info, CheckCircle, Clock, Loader, AlertCircle, RefreshCw } from 'lucide-react'
import { useAlerts } from '../hooks/useRTDFeeds'
import { ALERTS as MOCK_ALERTS, ROUTES } from '../data/mockData'

const SEVERITY_CONFIG = {
  warning: {
    icon: AlertTriangle,
    accent: '#EAB308',
    iconColor: 'text-yellow-500',
    badge: 'bg-yellow-100 text-yellow-700',
  },
  info: {
    icon: Info,
    accent: '#3B82F6',
    iconColor: 'text-blue-500',
    badge: 'bg-blue-100 text-blue-700',
  },
  success: {
    icon: CheckCircle,
    accent: '#22C55E',
    iconColor: 'text-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700',
  },
}

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleString([], {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function findRoute(routeId) {
  if (!routeId) return null
  return ROUTES.find(r => r.id === routeId) ?? ROUTES.find(r => r.shortName === routeId) ?? null
}

function AlertRow({ alert, showDivider }) {
  const cfg = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.info
  const Icon = cfg.icon
  const routeIds = alert.allRoutes ?? (alert.route ? [alert.route] : [])
  const routes = routeIds.map(findRoute).filter(Boolean)

  return (
    <div className={`flex items-start gap-3 px-4 py-4 ${showDivider ? 'border-t border-gray-100' : ''}`}>
      <Icon size={16} className={`shrink-0 mt-0.5 ${cfg.iconColor}`} />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="font-semibold text-gray-900 text-sm">{alert.title}</span>
          {alert.effectLabel && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>
              {alert.effectLabel}
            </span>
          )}
          {routes.length > 0
            ? routes.map(r => (
                <span
                  key={r.id}
                  className="text-xs px-2 py-0.5 rounded-full font-semibold text-white"
                  style={{ backgroundColor: r.color }}
                >
                  {r.shortName}
                </span>
              ))
            : routeIds.map(id => (
                <span key={id} className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-200 text-gray-600">
                  {id}
                </span>
              ))
          }
        </div>
        {alert.description && (
          <p className="text-sm text-gray-500">{alert.description}</p>
        )}
        <div className="flex items-center gap-1 mt-1.5 text-xs text-gray-400">
          <Clock size={10} />
          {formatTime(alert.time)}
        </div>
      </div>
    </div>
  )
}

export default function Alerts() {
  const { alerts: liveAlerts, loading, error, lastUpdated, refresh } = useAlerts()

  const alerts = error ? MOCK_ALERTS : (liveAlerts ?? [])
  const isLive = !error && liveAlerts !== null

  const warnings = alerts.filter(a => a.severity === 'warning')
  const infos = alerts.filter(a => a.severity === 'info')

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 flex-wrap px-1">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="text-orange-500" size={22} />
            Service Alerts
          </h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            {isLive
              ? `${alerts.length} active alerts from RTD live feed`
              : 'Current service disruptions for the RTD network'}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {loading && <Loader size={12} className="animate-spin" />}
          {lastUpdated && `Updated ${lastUpdated.toLocaleTimeString()}`}
          <button
            onClick={refresh}
            className="p-1.5 rounded-lg hover:bg-white text-gray-400 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="border-l-4 border-yellow-400 bg-yellow-50 px-4 py-3 rounded-r-xl flex items-start gap-2 text-sm text-yellow-800">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span>Could not fetch RTD alerts: <strong>{error}</strong> — showing mock data instead.</span>
        </div>
      )}

      {/* Summary counts */}
      <div className="bg-white rounded-2xl shadow-sm px-6 py-4 flex gap-8">
        {[
          { label: 'Notices', count: infos.length, color: 'text-blue-500' },
          { label: 'Warnings', count: warnings.length, color: 'text-yellow-500' },
        ].map(({ label, count, color }) => (
          <div key={label}>
            <div className={`text-3xl font-bold ${color}`}>{count}</div>
            <div className="text-xs text-gray-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Alert list */}
      {loading && liveAlerts === null ? (
        <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
          <Loader size={18} className="animate-spin" />
          Loading alerts…
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CheckCircle size={32} className="mx-auto mb-2 text-emerald-400" />
          No active alerts — all systems running normally.
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {alerts.map((alert, i) => (
            <AlertRow key={alert.id} alert={alert} showDivider={i > 0} />
          ))}
        </div>
      )}
    </div>
  )
}
