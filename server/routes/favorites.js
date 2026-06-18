import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()

// All favorites routes require authentication
router.use(requireAuth)

// GET /api/favorites
router.get('/', async (req, res) => {
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
router.post('/', async (req, res) => {
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
router.delete('/:type/:itemId', async (req, res) => {
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
