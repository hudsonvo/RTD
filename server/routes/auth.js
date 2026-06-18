import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { pool } from '../db.js'
import { requireAuth } from '../middleware/requireAuth.js'

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

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password } = req.body ?? {}
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }

  const normalizedEmail = email.trim().toLowerCase()

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
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [normalizedEmail, passwordHash]
    )
    const user = rows[0]

    const token = generateToken()
    await pool.query(
      'INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, hashToken(token), sessionExpiry()]
    )

    res.status(201).json({ user: { id: user.id, email: user.email }, token })
  } catch (err) {
    console.error('register error:', err.message)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {}
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, email, password_hash FROM users WHERE email = $1 AND is_active = TRUE',
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

    res.json({ user: { id: user.id, email: user.email }, token })
  } catch (err) {
    console.error('login error:', err.message)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM sessions WHERE token_hash = $1', [req.tokenHash])
  } catch (err) {
    console.error('logout error:', err.message)
  }
  res.status(204).send()
})

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user })
})

// PUT /api/auth/password
router.put('/password', requireAuth, async (req, res) => {
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
router.delete('/account', requireAuth, async (req, res) => {
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

export default router
