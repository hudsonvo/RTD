import express from 'express'
import cors from 'cors'
import authRouter from './routes/auth.js'
import favoritesRouter from './routes/favorites.js'

const app = express()

app.use(cors({
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json())

app.use('/api/auth', authRouter)
app.use('/api/favorites', favoritesRouter)

app.get('/api/health', (_, res) => res.json({ ok: true }))

const PORT = process.env.PORT ?? 3001
app.listen(PORT, () => {
  console.log(`RTD API server running on http://localhost:${PORT}`)
})
