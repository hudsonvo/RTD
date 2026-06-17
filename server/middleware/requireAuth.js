import crypto from 'crypto'
import { pool } from '../db.js'

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const token = header.slice(7)
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.email
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
