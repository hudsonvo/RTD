import { useState, useCallback } from 'react'

const KEY = 'rtd-favorites'

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') }
  catch { return [] }
}

function save(items) {
  localStorage.setItem(KEY, JSON.stringify(items))
}

// { type: 'stop'|'route', id: string, name: string }
export function useFavorites() {
  const [favorites, setFavorites] = useState(load)

  const toggle = useCallback((item) => {
    setFavorites(prev => {
      const exists = prev.some(f => f.type === item.type && f.id === item.id)
      const next = exists
        ? prev.filter(f => !(f.type === item.type && f.id === item.id))
        : [...prev, item]
      save(next)
      return next
    })
  }, [])

  const isFavorite = useCallback((type, id) =>
    favorites.some(f => f.type === type && f.id === id),
  [favorites])

  return { favorites, toggle, isFavorite }
}
