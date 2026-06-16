import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('rtd_user')
      if (stored) setUser(JSON.parse(stored))
    } catch {
      localStorage.removeItem('rtd_user')
    }
    setLoading(false)
  }, [])

  // ── Swap these stubs for real fetch() calls once the backend exists ──────────

  async function register(email, password) {
    // TODO: POST /api/auth/register  →  { user: { id, email } }
    const user = { id: crypto.randomUUID(), email }
    localStorage.setItem('rtd_user', JSON.stringify(user))
    setUser(user)
  }

  async function login(email, password) {
    // TODO: POST /api/auth/login  →  { user: { id, email } }
    const stored = localStorage.getItem('rtd_user')
    const existing = stored ? JSON.parse(stored) : null
    if (!existing || existing.email !== email) {
      throw new Error('No account found with that email. Please register first.')
    }
    setUser(existing)
  }

  async function logout() {
    // TODO: POST /api/auth/logout  (clear server-side session)
    localStorage.removeItem('rtd_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
