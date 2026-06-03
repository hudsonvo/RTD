import { transit_realtime } from 'gtfs-realtime-bindings'
import { getDirections, resolveHeadsign } from './gtfsStatic'

const BASE = '/api/gtfs-rt/rtd'

async function decodeFeed(filename) {
  const res = await fetch(`${BASE}/${filename}`)
  if (!res.ok) throw new Error(`RTD feed ${filename} returned ${res.status}`)
  const buffer = await res.arrayBuffer()
  return transit_realtime.FeedMessage.decode(new Uint8Array(buffer))
}

// Vehicle positions → array of vehicle objects
export async function fetchVehiclePositions() {
  const feed = await decodeFeed('VehiclePosition.pb')
  return feed.entity
    .filter(e => e.vehicle?.position)
    .map(e => {
      const v = e.vehicle
      return {
        id: e.id,
        routeId: v.trip?.routeId ?? '',
        tripId: v.trip?.tripId ?? '',
        lat: v.position.latitude,
        lon: v.position.longitude,
        heading: v.position.bearing ?? 0,
        speed: Math.round((v.position.speed ?? 0) * 2.237), // m/s → mph
        vehicleLabel: v.vehicle?.label ?? e.id,
        nextStop: v.stopId ?? null,
        directionId: v.trip?.directionId ?? 0,
        delay: 0, // merged from TripUpdates below
      }
    })
}

// Trip updates → map of tripId → { delay (minutes), etaSec (unix seconds) }
export async function fetchTripDelays() {
  const feed = await decodeFeed('TripUpdate.pb')
  const updates = {}
  for (const e of feed.entity) {
    if (!e.tripUpdate) continue
    const tripId = e.tripUpdate.trip?.tripId
    if (!tripId) continue
    const first = e.tripUpdate.stopTimeUpdate?.[0]
    const delaySec = first?.arrival?.delay ?? first?.departure?.delay ?? 0
    const etaRaw = first?.arrival?.time ?? first?.departure?.time ?? null
    updates[tripId] = {
      delay: Math.round(delaySec / 60),
      etaSec: etaRaw !== null ? Number(etaRaw) : null,
    }
  }
  return updates
}

// Upcoming arrivals at a specific stop, sorted by ETA
export async function fetchArrivalsAtStop(stopId) {
  const [feed, directions] = await Promise.all([
    decodeFeed('TripUpdate.pb'),
    getDirections().catch(() => null),
  ])
  const nowSec = Date.now() / 1000
  const arrivals = []

  for (const e of feed.entity) {
    if (!e.tripUpdate) continue
    const tu = e.tripUpdate
    const routeId = tu.trip?.routeId ?? ''
    const directionId = tu.trip?.directionId ?? 0

    for (const stu of (tu.stopTimeUpdate ?? [])) {
      if (String(stu.stopId) !== String(stopId)) continue
      const etaSec = Number(stu.arrival?.time ?? stu.departure?.time ?? 0)
      if (etaSec > 0 && etaSec < nowSec) continue // already passed
      const delaySec = stu.arrival?.delay ?? stu.departure?.delay ?? 0
      arrivals.push({
        tripId: tu.trip?.tripId ?? '',
        routeId,
        directionId,
        headsign: resolveHeadsign(directions, routeId, directionId),
        etaSec: etaSec || null,
        delay: Math.round(delaySec / 60),
      })
    }
  }

  return arrivals
    .sort((a, b) => (a.etaSec ?? Infinity) - (b.etaSec ?? Infinity))
    .slice(0, 12)
}

const EFFECT_LABEL = {
  1: 'No Service',
  2: 'Reduced Service',
  3: 'Significant Delays',
  4: 'Detour',
  5: 'Additional Service',
  6: 'Modified Service',
  7: 'Other Effect',
  9: 'Stop Moved',
}

function effectToSeverity(effect) {
  if (effect === 1 || effect === 3) return 'warning'
  if (effect === 5 || effect === 6) return 'success'
  return 'info'
}

function translatedText(ts) {
  return ts?.translation?.find(t => t.language === 'en')?.text
    ?? ts?.translation?.[0]?.text
    ?? ''
}

// Alerts → array of alert objects
export async function fetchAlerts() {
  const feed = await decodeFeed('Alerts.pb')
  return feed.entity
    .filter(e => e.alert)
    .map(e => {
      const a = e.alert
      const routeIds = (a.informedEntity ?? [])
        .map(ie => ie.routeId)
        .filter(Boolean)
      const startSec = a.activePeriod?.[0]?.start
      return {
        id: e.id,
        severity: effectToSeverity(a.effect),
        title: translatedText(a.headerText) || 'Service Alert',
        description: translatedText(a.descriptionText),
        route: routeIds[0] ?? null,
        allRoutes: routeIds,
        effectLabel: EFFECT_LABEL[a.effect] ?? 'Alert',
        time: new Date(
          startSec ? Number(startSec) * 1000 : Date.now()
        ).toISOString(),
      }
    })
}
