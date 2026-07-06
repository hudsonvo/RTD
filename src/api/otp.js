const ENDPOINT = '/api/otp/otp/gtfs/v1'

const LEG_FIELDS = `
  legs {
    mode duration distance startTime endTime
    from { name lat lon }
    to   { name lat lon }
    route { shortName longName color }
    intermediateStops { name }
    legGeometry { points }
  }
`

// Build query dynamically — OTP 2.6 uses Long (epoch ms) for dateTime
function buildPlanQuery(includeDateTime, includeModes) {
  const dtVar    = includeDateTime ? ', $dateTime: Long' : ''
  const dtArg    = includeDateTime ? ', dateTime: $dateTime' : ''
  const modesVar = includeModes ? ', $transportModes: [TransportMode]' : ''
  const modesArg = includeModes ? ', transportModes: $transportModes' : ''
  return `
    query Plan($from: InputCoordinates!, $to: InputCoordinates!, $numItineraries: Int${dtVar}${modesVar}, $arriveBy: Boolean) {
      plan(from: $from, to: $to, numItineraries: $numItineraries${dtArg}${modesArg}, arriveBy: $arriveBy) {
        messageEnums
        messageStrings
        itineraries {
          duration startTime endTime
          ${LEG_FIELDS}
        }
      }
    }`
}

const TRANSIT_MODES = [
  { mode: 'WALK' }, { mode: 'BUS' }, { mode: 'TRAM' },
  { mode: 'RAIL' }, { mode: 'SUBWAY' }, { mode: 'FERRY' },
]

const DRIVE_TRANSIT_MODES = [
  { mode: 'CAR' }, { mode: 'WALK' }, { mode: 'BUS' },
  { mode: 'TRAM' }, { mode: 'RAIL' }, { mode: 'SUBWAY' },
]

const DRIVE_ONLY_MODES = [{ mode: 'CAR' }]

// Decode Google Polyline Algorithm encoded string → [[lat, lon], ...]
export function decodePolyline(encoded) {
  if (!encoded) return []
  const coords = []
  let index = 0, lat = 0, lng = 0
  while (index < encoded.length) {
    let b, shift = 0, result = 0
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lat += (result & 1) ? ~(result >> 1) : result >> 1
    shift = 0; result = 0
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lng += (result & 1) ? ~(result >> 1) : result >> 1
    coords.push([lat / 1e5, lng / 1e5])
  }
  return coords
}

export async function planTrip({ fromLat, fromLon, toLat, toLon, numItineraries = 3, dateTime = null, arriveBy = false, driveTransit = false, transportModes = null }) {
  const epochMs = dateTime ? new Date(dateTime).getTime() : null
  const modes = transportModes ?? (driveTransit ? DRIVE_TRANSIT_MODES : null)
  const variables = {
    from: { lat: fromLat, lon: fromLon },
    to:   { lat: toLat,   lon: toLon   },
    numItineraries,
    arriveBy,
    ...(modes   ? { transportModes: modes } : {}),
    ...(epochMs ? { dateTime: epochMs }     : {}),
  }

  let res
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: buildPlanQuery(!!epochMs, !!modes), variables }),
    })
  } catch {
    throw new Error('OpenTripPlanner server is not running — start it with: npm run otp:serve')
  }

  if (res.status === 502 || res.status === 503)
    throw new Error('OpenTripPlanner server is not running — start it with: npm run otp:serve')
  if (!res.ok) throw new Error(`OTP returned ${res.status}`)

  const json = await res.json()
  if (json.errors?.length) throw new Error(json.errors[0].message)
  if (!json.data?.plan?.itineraries?.length) {
    const msgs = json.data?.plan?.messageStrings
    throw new Error(msgs?.length ? msgs.join('; ') : 'No routes found between these locations')
  }

  return json.data.plan.itineraries
}

// Plans drive (origin→P&R) + transit (P&R→destination) as two OTP calls and
// merges the legs into one combined itinerary.
// prLat/prLon        = parking lot visual coordinates (map marker)
// driveToLat/Lon     = road-accessible drive destination; falls back to prLat/prLon
// transitLat/Lon     = transit stop coordinates (transit origin); falls back to driveToLat/Lon
export async function planCombinedDriveTransit({ fromLat, fromLon, prLat, prLon, driveToLat, driveToLon, transitLat, transitLon, toLat, toLon, dateTime, arriveBy }) {
  const dLat = driveToLat ?? prLat
  const dLon = driveToLon ?? prLon
  const tLat = transitLat ?? dLat
  const tLon = transitLon ?? dLon
  const [driveItins, transitItins] = await Promise.all([
    planTrip({ fromLat, fromLon, toLat: dLat, toLon: dLon, numItineraries: 1, transportModes: DRIVE_ONLY_MODES }),
    planTrip({ fromLat: tLat, fromLon: tLon, toLat, toLon, numItineraries: 1, dateTime, arriveBy }),
  ])

  const driveF   = formatItinerary(driveItins[0],   'drive-leg')
  const transitF = formatItinerary(transitItins[0], 'transit-leg')

  const totalMin = Math.round((driveItins[0].duration + transitItins[0].duration) / 60)
  const departureMs = driveItins[0].startTime
  const arrivalMs   = departureMs + (driveItins[0].duration + transitItins[0].duration) * 1000

  return [{
    id: 'combined',
    duration:  `${totalMin} min`,
    departure: new Date(departureMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    arrival:   new Date(arrivalMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    legs: [...driveF.legs, ...transitF.legs],
  }]
}

export function formatItinerary(itin, id) {
  const start = new Date(itin.startTime)
  const end   = new Date(itin.endTime)
  const durationMin = Math.round(itin.duration / 60)

  return {
    id,
    duration: `${durationMin} min`,
    departure: start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    arrival:   end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    legs: itin.legs.map(leg => {
      const dMin      = Math.max(1, Math.round(leg.duration / 60))
      const toName    = leg.to?.name && leg.to.name !== 'Destination' ? leg.to.name : null
      const fromName  = leg.from?.name && leg.from.name !== 'Origin' ? leg.from.name : null
      const geometry  = decodePolyline(leg.legGeometry?.points)
      const fromCoords = leg.from ? [leg.from.lat, leg.from.lon] : null
      const toCoords   = leg.to   ? [leg.to.lat,   leg.to.lon]   : null

      if (leg.mode === 'WALK') {
        return {
          type: 'walk',
          desc: toName ? `Walk to ${toName}` : 'Walk',
          time: `${dMin} min`,
          geometry, fromCoords, toCoords,
        }
      }

      if (leg.mode === 'CAR') {
        const miles = (leg.distance * 0.000621371).toFixed(1)
        return {
          type: 'drive',
          desc: toName ? `Drive to ${toName}` : 'Drive',
          time: `${dMin} min`,
          distance: `${miles} mi`,
          geometry, fromCoords, toCoords,
        }
      }

      // Transit leg
      const shortName = leg.route?.shortName ?? ''
      const color     = leg.route?.color ? `#${leg.route.color}` : null
      const modeToType = { BUS: 'bus', TRAM: 'light-rail', RAIL: 'commuter-rail', SUBWAY: 'light-rail' }
      const departureMs = leg.startTime ?? null
      return {
        type: 'transit',
        routeId:      shortName,
        routeColor:   color,
        routeType:    modeToType[leg.mode] ?? 'bus',
        desc:         `${shortName || leg.mode} toward ${toName ?? 'destination'}`,
        stops:        leg.intermediateStops?.length ?? 0,
        time:         `${dMin} min`,
        departureMs,
        fromName, toName,
        geometry, fromCoords, toCoords,
      }
    }),
  }
}
