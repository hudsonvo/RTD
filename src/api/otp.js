const ENDPOINT = '/api/otp/otp/gtfs/v1'

const LEG_FIELDS = `
  legs {
    mode duration distance
    from { name lat lon }
    to   { name lat lon }
    route { shortName longName color }
    intermediateStops { name }
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

export async function planTrip({ fromLat, fromLon, toLat, toLon, numItineraries = 3, dateTime = null, arriveBy = false, driveTransit = false }) {
  const epochMs = dateTime ? new Date(dateTime).getTime() : null
  const variables = {
    from: { lat: fromLat, lon: fromLon },
    to:   { lat: toLat,   lon: toLon   },
    numItineraries,
    arriveBy,
    ...(driveTransit ? { transportModes: DRIVE_TRANSIT_MODES } : {}),
    ...(epochMs      ? { dateTime: epochMs } : {}),
  }

  let res
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: buildPlanQuery(!!epochMs, driveTransit), variables }),
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
      const dMin   = Math.max(1, Math.round(leg.duration / 60))
      const toName = leg.to?.name && leg.to.name !== 'Destination' ? leg.to.name : null

      if (leg.mode === 'WALK') {
        return { type: 'walk', desc: toName ? `Walk to ${toName}` : 'Walk', time: `${dMin} min` }
      }

      if (leg.mode === 'CAR') {
        const miles = (leg.distance * 0.000621371).toFixed(1)
        return { type: 'drive', desc: toName ? `Drive to ${toName}` : 'Drive', time: `${dMin} min`, distance: `${miles} mi` }
      }

      // Transit leg — route data comes from GraphQL response directly
      const shortName = leg.route?.shortName ?? ''
      const color     = leg.route?.color ? `#${leg.route.color}` : null
      const modeToType = { BUS: 'bus', TRAM: 'light-rail', RAIL: 'commuter-rail', SUBWAY: 'light-rail' }
      return {
        type: 'transit',
        routeId:   shortName,
        routeColor: color,
        routeType: modeToType[leg.mode] ?? 'bus',
        desc:  `${shortName || leg.mode} toward ${toName ?? 'destination'}`,
        stops: leg.intermediateStops?.length ?? 0,
        time:  `${dMin} min`,
      }
    }),
  }
}
