import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Lock, Trash2, Eye, EyeOff, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const TOKEN_KEY = 'rtd_token'

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY)
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`)
  return data
}

// ── Change Password ────────────────────────────────────────────────────────────

function ChangePasswordForm() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (next !== confirm) { setError('New passwords do not match'); return }
    if (next.length < 8) { setError('New password must be at least 8 characters'); return }
    setError(null)
    setLoading(true)
    try {
      await apiFetch('/api/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      setSuccess(true)
      setCurrent(''); setNext(''); setConfirm('')
      setTimeout(() => setSuccess(false), 4000)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors'

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="border-l-4 border-red-500 bg-red-50 px-4 py-3 rounded-r-xl flex items-start gap-2 text-sm text-red-700">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />{error}
        </div>
      )}
      {success && (
        <div className="border-l-4 border-emerald-500 bg-emerald-50 px-4 py-3 rounded-r-xl flex items-start gap-2 text-sm text-emerald-700">
          <CheckCircle size={14} className="shrink-0 mt-0.5" />Password updated. Other devices have been signed out.
        </div>
      )}

      {[
        { label: 'Current Password', value: current, set: setCurrent, autoComplete: 'current-password' },
        { label: 'New Password',     value: next,    set: setNext,    autoComplete: 'new-password' },
        { label: 'Confirm New Password', value: confirm, set: setConfirm, autoComplete: 'new-password' },
      ].map(({ label, value, set, autoComplete }) => (
        <div key={label}>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{label}</label>
          <div className="relative">
            <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type={showPasswords ? 'text' : 'password'}
              value={value}
              onChange={e => set(e.target.value)}
              required
              autoComplete={autoComplete}
              className={inputClass}
            />
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between pt-1">
        <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showPasswords}
            onChange={e => setShowPasswords(e.target.checked)}
            className="rounded"
          />
          Show passwords
        </label>
        <button
          type="submit"
          disabled={loading || !current || !next || !confirm}
          className="px-4 py-2 bg-[#CC0000] text-white rounded-xl text-sm font-semibold hover:bg-[#AA0000] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </div>
    </form>
  )
}

// ── Delete Account ─────────────────────────────────────────────────────────────

function DeleteAccountSection() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleDelete(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await apiFetch('/api/auth/account', {
        method: 'DELETE',
        body: JSON.stringify({ password }),
      })
      await logout()
      navigate('/')
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div>
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors"
        >
          <Trash2 size={15} />
          Delete account
          <ChevronRight size={14} className="ml-auto" />
        </button>
      ) : (
        <form onSubmit={handleDelete} className="space-y-3">
          <p className="text-sm text-gray-500">
            This will permanently delete your account, sessions, and all saved favorites.
            Enter your password to confirm.
          </p>
          {error && (
            <div className="border-l-4 border-red-500 bg-red-50 px-4 py-3 rounded-r-xl flex items-start gap-2 text-sm text-red-700">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />{error}
            </div>
          )}
          <div className="relative">
            <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
              className="w-full pl-9 pr-3 py-2.5 border border-red-200 rounded-xl text-sm bg-red-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setExpanded(false); setPassword(''); setError(null) }}
              className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !password}
              className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Deleting…' : 'Delete permanently'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function Account() {
  const { user } = useAuth()

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
      <div className="px-1">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <User className="text-blue-600" size={22} />
          Account
        </h1>
      </div>

      {/* Profile */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Profile</span>
        </div>
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Email</span>
          <span className="text-sm text-gray-800 font-medium">{user?.email}</span>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Status</span>
          <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">Active</span>
        </div>
      </div>

      {/* Change password */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Change Password</span>
        </div>
        <div className="px-4 py-4">
          <ChangePasswordForm />
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <span className="text-xs font-semibold uppercase tracking-wider text-red-400">Danger Zone</span>
        </div>
        <div className="px-4 py-4">
          <DeleteAccountSection />
        </div>
      </div>
    </div>
  )
}
