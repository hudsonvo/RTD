import { AlertTriangle, Info, CheckCircle, Clock, Loader, AlertCircle, RefreshCw } from 'lucide-react'
import { useAlerts } from '../hooks/useRTDFeeds'
import { ALERTS as MOCK_ALERTS, ROUTES } from '../data/mockData'

const SEVERITY_CONFIG = {
  warning: {
    icon: AlertTriangle,
    bg: 'bg-yellow-50',
    border: 'border-yellow-300',
    text: 'text-yellow-800',
    badge: 'bg-yellow-100 text-yellow-800',
    iconColor: 'text-yellow-500',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    text: 'text-blue-800',
    badge: 'bg-blue-100 text-blue-800',
    iconColor: 'text-blue-500',
  },
  success: {
    icon: CheckCircle,
    bg: 'bg-green-50',
    border: 'border-green-300',
    text: 'text-green-800',
    badge: 'bg-green-100 text-green-800',
    iconColor: 'text-green-500',
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

function AlertCard({ alert }) {
  const cfg = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.info
  const Icon = cfg.icon
  const routeIds = alert.allRoutes ?? (alert.route ? [alert.route] : [])
  const routes = routeIds.map(findRoute).filter(Boolean)

  return (
    <div className={`rounded-xl border p-4 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-start gap-3">
        <Icon size={20} className={`shrink-0 mt-0.5 ${cfg.iconColor}`} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`font-semibold ${cfg.text}`}>{alert.title}</span>
            {alert.effectLabel && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>
                {alert.effectLabel}
              </span>
            )}
            {routes.length > 0
              ? routes.map(r => (
                  <span
                    key={r.id}
                    className="text-xs px-2 py-0.5 rounded-full font-medium text-white"
                    style={{ backgroundColor: r.color }}
                  >
                    {r.shortName}
                  </span>
                ))
              : routeIds.map(id => (
                  <span key={id} className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-200 text-gray-700">
                    {id}
                  </span>
                ))
            }
          </div>
          {alert.description && (
            <p className={`text-sm ${cfg.text} opacity-90`}>{alert.description}</p>
          )}
          <div className={`flex items-center gap-1 mt-2 text-xs ${cfg.text} opacity-60`}>
            <Clock size={11} />
            {formatTime(alert.time)}
          </div>
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
  const resolved = alerts.filter(a => a.severity === 'success')

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="text-orange-500" size={24} />
            Service Alerts
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
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
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-yellow-800">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>Could not fetch RTD alerts: <strong>{error}</strong> — showing mock data instead.</span>
        </div>
      )}

      {/* Summary counts */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Warnings', count: warnings.length, color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' },
          { label: 'Notices', count: infos.length, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
          { label: 'Resolved', count: resolved.length, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
        ].map(({ label, count, color, bg }) => (
          <div key={label} className={`rounded-xl border p-3 text-center ${bg}`}>
            <div className={`text-2xl font-bold ${color}`}>{count}</div>
            <div className="text-xs text-gray-500 mt-0.5">{label}</div>
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
          <CheckCircle size={32} className="mx-auto mb-2 text-green-400" />
          No active alerts — all systems running normally.
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(alert => <AlertCard key={alert.id} alert={alert} />)}
        </div>
      )}
    </div>
  )
}
