import { useState, useEffect, useCallback } from 'react'
import { fetchVehiclePositions, fetchTripDelays, fetchAlerts, fetchArrivalsAtStop } from '../api/rtdFeeds'
import { getStops, getDirections, resolveStopName, resolveHeadsign, findNearbyStops } from '../api/gtfsStatic'

function usePoll(fetcher, interval) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const load = useCallback(async () => {
    try {
      const result = await fetcher()
      setData(result)
      setLastUpdated(new Date())
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [fetcher])

  useEffect(() => {
    load()
    const id = setInterval(load, interval)
    return () => clearInterval(id)
  }, [load, interval])

  return { data, loading, error, lastUpdated, refresh: load }
}

// Vehicle positions enriched with stop names, headsigns, and delay — polled every 15 s
export function useVehiclePositions() {
  const [vehicles, setVehicles] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const load = useCallback(async () => {
    try {
      const [positions, delays, stops, directions] = await Promise.all([
        fetchVehiclePositions(),
        fetchTripDelays(),
        getStops().catch(() => null),
        getDirections().catch(() => null),
      ])
      setVehicles(
        positions.map(v => {
          const upd = delays[v.tripId]
          return {
            ...v,
            delay: upd?.delay ?? 0,
            etaSec: upd?.etaSec ?? null,
            nextStopName: resolveStopName(stops, v.nextStop),
            headsign: resolveHeadsign(directions, v.routeId, v.directionId),
            directionId: v.directionId ?? 0,
          }
        })
      )
      setLastUpdated(new Date())
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 15_000)
    return () => clearInterval(id)
  }, [load])

  return { vehicles, loading, error, lastUpdated, refresh: load }
}

// Alerts, polled every 60 s
export function useAlerts() {
  const fetcher = useCallback(fetchAlerts, [])
  const { data: alerts, ...rest } = usePoll(fetcher, 60_000)
  return { alerts, ...rest }
}

// Arrivals at a specific stop, polled every 30 s
export function useArrivalsAtStop(stopId) {
  const [arrivals, setArrivals] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const load = useCallback(async () => {
    if (!stopId) return
    setLoading(true)
    try {
      const data = await fetchArrivalsAtStop(stopId)
      setArrivals(data)
      setLastUpdated(new Date())
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [stopId])

  useEffect(() => {
    setArrivals(null)
    if (!stopId) return
    load()
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [load, stopId])

  return { arrivals, loading, error, lastUpdated, refresh: load }
}

// Nearby stops using browser geolocation
export function useNearbyStops() {
  const [stops, setStops] = useState(null)
  const [userLocation, setUserLocation] = useState(null)
  const [locError, setLocError] = useState(null)
  const [locLoading, setLocLoading] = useState(false)

  const locate = useCallback(async () => {
    if (!navigator.geolocation) {
      setLocError('Geolocation is not supported by your browser.')
      return
    }
    setLocLoading(true)
    setLocError(null)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lon } = pos.coords
        setUserLocation({ lat, lon })
        try {
          const allStops = await getStops()
          setStops(findNearbyStops(allStops, lat, lon))
        } catch (err) {
          setLocError(err.message)
        } finally {
          setLocLoading(false)
        }
      },
      err => {
        setLocError(err.message)
        setLocLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  return { stops, userLocation, locError, locLoading, locate }
}
