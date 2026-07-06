import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { pool } from '../db.js'

const router = Router()

const SALT_ROUNDS = 12
const SESSION_DAYS = 30

function generateToken() {
  return crypto.randomBytes(32).toString('hex')
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function sessionExpiry() {
  return new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const token = header.slice(7)
  const tokenHash = hashToken(token)

  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.name, u.is_admin
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1
         AND s.expires_at > NOW()
         AND u.is_active = TRUE`,
      [tokenHash]
    )

    if (!rows.length) {
      return res.status(401).json({ error: 'Session expired or invalid' })
    }

    await pool.query(
      'UPDATE sessions SET last_seen_at = NOW() WHERE token_hash = $1',
      [tokenHash]
    )

    req.user = rows[0]
    req.tokenHash = tokenHash
    next()
  } catch (err) {
    console.error('requireAuth error:', err.message)
    res.status(500).json({ error: 'Server error' })
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

// POST /api/auth/register
router.post('/auth/register', async (req, res) => {
  const { email, password, name } = req.body ?? {}
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const trimmedName = name?.trim() || null

  try {
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [normalizedEmail]
    )
    if (existing.rows.length) {
      return res.status(409).json({ error: 'An account with that email already exists' })
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)
    const { rows } = await pool.query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, is_admin',
      [normalizedEmail, passwordHash, trimmedName]
    )
    const user = rows[0]

    const token = generateToken()
    await pool.query(
      'INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, hashToken(token), sessionExpiry()]
    )

    res.status(201).json({ user: { id: user.id, email: user.email, name: user.name, isAdmin: user.is_admin }, token })
  } catch (err) {
    console.error('register error:', err.message)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/auth/login
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body ?? {}
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, email, name, password_hash, is_admin FROM users WHERE email = $1 AND is_active = TRUE',
      [email.trim().toLowerCase()]
    )

    // Use constant-time compare even when no user found to prevent timing attacks
    const dummyHash = '$2b$12$invalidhashpaddingtomatchlength000000000000000000000000'
    const hash = rows[0]?.password_hash ?? dummyHash
    const match = await bcrypt.compare(password, hash)

    if (!rows.length || !match) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const user = rows[0]
    const token = generateToken()
    await pool.query(
      'INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, hashToken(token), sessionExpiry()]
    )

    res.json({ user: { id: user.id, email: user.email, name: user.name, isAdmin: user.is_admin }, token })
  } catch (err) {
    console.error('login error:', err.message)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/auth/logout
router.post('/auth/logout', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM sessions WHERE token_hash = $1', [req.tokenHash])
  } catch (err) {
    console.error('logout error:', err.message)
  }
  res.status(204).send()
})

// GET /api/auth/me
router.get('/auth/me', requireAuth, (req, res) => {
  const { id, email, name, is_admin } = req.user
  res.json({ user: { id, email, name, isAdmin: is_admin } })
})

// PUT /api/auth/password
router.put('/auth/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {}
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required' })
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' })
  }

  try {
    const { rows } = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    )
    const match = await bcrypt.compare(currentPassword, rows[0].password_hash)
    if (!match) {
      return res.status(401).json({ error: 'Current password is incorrect' })
    }

    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS)
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id])

    // Invalidate all other sessions so other devices are signed out
    await pool.query(
      'DELETE FROM sessions WHERE user_id = $1 AND token_hash != $2',
      [req.user.id, req.tokenHash]
    )

    res.json({ message: 'Password updated successfully' })
  } catch (err) {
    console.error('password change error:', err.message)
    res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/auth/account
router.delete('/auth/account', requireAuth, async (req, res) => {
  const { password } = req.body ?? {}
  if (!password) {
    return res.status(400).json({ error: 'Password is required to delete your account' })
  }

  try {
    const { rows } = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    )
    const match = await bcrypt.compare(password, rows[0].password_hash)
    if (!match) {
      return res.status(401).json({ error: 'Incorrect password' })
    }

    // ON DELETE CASCADE removes sessions, favorites, and password_reset_tokens
    await pool.query('DELETE FROM users WHERE id = $1', [req.user.id])
    res.status(204).send()
  } catch (err) {
    console.error('account deletion error:', err.message)
    res.status(500).json({ error: 'Server error' })
  }
})

// ─── Favorites ────────────────────────────────────────────────────────────────

router.use('/favorites', requireAuth)

// GET /api/favorites
router.get('/favorites', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT type, item_id, item_name, created_at
       FROM favorites
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [req.user.id]
    )
    res.json({ favorites: rows })
  } catch (err) {
    console.error('get favorites error:', err.message)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/favorites
router.post('/favorites', async (req, res) => {
  const { type, item_id, item_name } = req.body ?? {}
  if (!type || !item_id || !item_name) {
    return res.status(400).json({ error: 'type, item_id, and item_name are required' })
  }
  if (!['stop', 'route'].includes(type)) {
    return res.status(400).json({ error: 'type must be "stop" or "route"' })
  }

  try {
    await pool.query(
      `INSERT INTO favorites (user_id, type, item_id, item_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, type, item_id) DO NOTHING`,
      [req.user.id, type, item_id, item_name]
    )
    res.status(201).json({ ok: true })
  } catch (err) {
    console.error('add favorite error:', err.message)
    res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/favorites/:type/:itemId
router.delete('/favorites/:type/:itemId', async (req, res) => {
  const { type, itemId } = req.params
  try {
    await pool.query(
      'DELETE FROM favorites WHERE user_id = $1 AND type = $2 AND item_id = $3',
      [req.user.id, type, itemId]
    )
    res.status(204).send()
  } catch (err) {
    console.error('remove favorite error:', err.message)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
