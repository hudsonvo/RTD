import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'

const LS_KEY = 'rtd-favorites'
const TOKEN_KEY = 'rtd_token'

function loadFromStorage() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]') }
  catch { return [] }
}

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
  if (res.status === 204) return null
  return res.json()
}

// { type: 'stop'|'route', id: string, name: string }
export function useFavorites() {
  const { user } = useAuth()
  const [favorites, setFavorites] = useState([])

  // Reload favorites whenever auth state changes
  useEffect(() => {
    if (!user) {
      setFavorites(loadFromStorage())
      return
    }

    apiFetch('/api/favorites')
      .then(data => {
        if (data?.favorites) {
          setFavorites(data.favorites.map(f => ({
            type: f.type,
            id: f.item_id,
            name: f.item_name,
          })))
        }
      })
      .catch(() => setFavorites(loadFromStorage()))
  }, [user?.id])

  const toggle = useCallback(async (item) => {
    const exists = favorites.some(f => f.type === item.type && f.id === item.id)

    if (user) {
      if (exists) {
        setFavorites(prev => prev.filter(f => !(f.type === item.type && f.id === item.id)))
        await apiFetch(`/api/favorites/${item.type}/${item.id}`, { method: 'DELETE' }).catch(() => {})
      } else {
        setFavorites(prev => [...prev, item])
        await apiFetch('/api/favorites', {
          method: 'POST',
          body: JSON.stringify({ type: item.type, item_id: item.id, item_name: item.name }),
        }).catch(() => {})
      }
    } else {
      setFavorites(prev => {
        const next = exists
          ? prev.filter(f => !(f.type === item.type && f.id === item.id))
          : [...prev, item]
        localStorage.setItem(LS_KEY, JSON.stringify(next))
        return next
      })
    }
  }, [favorites, user])

  const isFavorite = useCallback(
    (type, id) => favorites.some(f => f.type === type && f.id === id),
    [favorites]
  )

  return { favorites, toggle, isFavorite }
}
