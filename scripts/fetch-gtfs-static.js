// Downloads RTD's static GTFS zip and extracts lookup files:
//   public/gtfs-stops.json      { stopId: { name, lat, lon } }
//   public/gtfs-directions.json { "routeId:directionId": "Headsign" }
//   public/gtfs-shapes.json     { "routeId:directionId": [[lat, lon], ...] }
//
// Run with: npm run update-gtfs

import AdmZip from 'adm-zip'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const GTFS_URL = 'https://www.rtd-denver.com/files/gtfs/google_transit.zip'
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

// Simple but correct CSV parser — handles quoted fields with commas inside
function parseLine(line) {
  const values = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (c === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += c
    }
  }
  values.push(current.trim())
  return values
}

function parseCSV(text) {
  const lines = text.replace(/\r/g, '').trim().split('\n')
  const headers = parseLine(lines[0])
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const vals = parseLine(line)
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']))
  })
}

async function main() {
  console.log(`Downloading ${GTFS_URL} …`)
  const res = await fetch(GTFS_URL)
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching GTFS zip`)

  const buffer = Buffer.from(await res.arrayBuffer())
  const zip = new AdmZip(buffer)
  console.log('Unzipping …')

  // ── stops.txt → { stopId: { name, lat, lon } } ────────────────────────
  const stopsEntry = zip.getEntry('stops.txt')
  if (!stopsEntry) throw new Error('stops.txt not found in GTFS zip')
  const stops = parseCSV(stopsEntry.getData().toString('utf8'))
  const stopsMap = {}
  for (const row of stops) {
    if (row.stop_id) {
      stopsMap[row.stop_id] = {
        name: row.stop_name ?? row.stop_id,
        lat: parseFloat(row.stop_lat) || 0,
        lon: parseFloat(row.stop_lon) || 0,
      }
    }
  }

  // ── trips.txt → { "routeId:directionId": headsign } ───────────────────
  // Only keeps the first headsign seen for each (routeId, directionId) pair,
  // which is good enough for "A Line → Denver Airport" labels.
  const tripsEntry = zip.getEntry('trips.txt')
  if (!tripsEntry) throw new Error('trips.txt not found in GTFS zip')
  const trips = parseCSV(tripsEntry.getData().toString('utf8'))
  const directionsMap = {}
  for (const row of trips) {
    const key = `${row.route_id}:${row.direction_id ?? '0'}`
    if (!directionsMap[key] && row.trip_headsign) {
      directionsMap[key] = row.trip_headsign
    }
  }

  // ── shapes.txt → { "routeId:directionId": [[lat, lon], ...] } ───────────
  // For each route+direction, picks the most-used shape_id from trips.txt,
  // then simplifies it (min 50 m between kept points) to keep the file small.
  const shapesEntry = zip.getEntry('shapes.txt')
  const shapesMap = {}

  if (shapesEntry) {
    // Tally shape_id usage per route+direction
    const routeDirCounts = {}
    for (const row of trips) {
      if (!row.shape_id) continue
      const key = `${row.route_id}:${row.direction_id ?? '0'}`
      if (!routeDirCounts[key]) routeDirCounts[key] = {}
      routeDirCounts[key][row.shape_id] = (routeDirCounts[key][row.shape_id] ?? 0) + 1
    }

    // Pick the most common shape_id per route+direction
    const neededIds = new Set()
    const routeDirToShape = {}
    for (const [key, counts] of Object.entries(routeDirCounts)) {
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
      if (top) { routeDirToShape[key] = top[0]; neededIds.add(top[0]) }
    }

    // Read raw shape points (index-based for speed on large files)
    const rawLines = shapesEntry.getData().toString('utf8').replace(/\r/g, '').trim().split('\n')
    const hdr = parseLine(rawLines[0])
    const iId  = hdr.indexOf('shape_id')
    const iLat = hdr.indexOf('shape_pt_lat')
    const iLon = hdr.indexOf('shape_pt_lon')
    const iSeq = hdr.indexOf('shape_pt_sequence')
    const rawPts = {}
    for (let i = 1; i < rawLines.length; i++) {
      const v = parseLine(rawLines[i])
      const id = v[iId]
      if (!neededIds.has(id)) continue
      if (!rawPts[id]) rawPts[id] = []
      rawPts[id].push({ seq: +v[iSeq], lat: +v[iLat], lon: +v[iLon] })
    }

    // Sort and simplify each shape (keep points ≥ 50 m apart)
    function distM(lat1, lon1, lat2, lon2) {
      const R = 6371000, dl = (lat2 - lat1) * Math.PI / 180, dg = (lon2 - lon1) * Math.PI / 180
      const a = Math.sin(dl/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dg/2)**2
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    }

    for (const [key, shapeId] of Object.entries(routeDirToShape)) {
      const pts = (rawPts[shapeId] ?? []).sort((a, b) => a.seq - b.seq)
      if (!pts.length) continue
      const out = [[Math.round(pts[0].lat*1e5)/1e5, Math.round(pts[0].lon*1e5)/1e5]]
      for (let i = 1; i < pts.length; i++) {
        const prev = out[out.length - 1]
        if (distM(prev[0], prev[1], pts[i].lat, pts[i].lon) >= 50) {
          out.push([Math.round(pts[i].lat*1e5)/1e5, Math.round(pts[i].lon*1e5)/1e5])
        }
      }
      shapesMap[key] = out
    }
  }

  // ── routes.txt → { routeId: shortName } ──────────────────────────────────
  const routesEntry = zip.getEntry('routes.txt')
  const routeShortNames = {}
  if (routesEntry) {
    const routeRows = parseCSV(routesEntry.getData().toString('utf8'))
    for (const row of routeRows) {
      if (row.route_id && row.route_short_name) {
        routeShortNames[row.route_id] = row.route_short_name
      }
    }
  }

  // ── stop_times.txt → { stopId: [{ route, headsign }, ...] } ─────────────
  // stop_times.txt can be millions of rows; use index-based parsing for speed.
  const stopTimesEntry = zip.getEntry('stop_times.txt')
  const stopRoutesMap = {}
  if (stopTimesEntry) {
    // Build trip_id → { shortName, headsign } from trips + directions already built
    const tripToInfo = {}
    for (const row of trips) {
      if (row.trip_id && row.route_id) {
        const shortName = routeShortNames[row.route_id] ?? null
        const headsign = directionsMap[`${row.route_id}:${row.direction_id ?? '0'}`] ?? null
        tripToInfo[row.trip_id] = { shortName, headsign }
      }
    }

    const stLines = stopTimesEntry.getData().toString('utf8').replace(/\r/g, '').trim().split('\n')
    const stHdr = parseLine(stLines[0])
    const iTripId = stHdr.indexOf('trip_id')
    const iStopId = stHdr.indexOf('stop_id')
    for (let i = 1; i < stLines.length; i++) {
      const v = parseLine(stLines[i])
      const tripId = v[iTripId]
      const stopId = v[iStopId]
      const info = tripToInfo[tripId]
      if (!stopId || !info?.shortName) continue
      if (!stopRoutesMap[stopId]) stopRoutesMap[stopId] = new Map()
      // First headsign seen for each route at this stop wins
      if (!stopRoutesMap[stopId].has(info.shortName)) {
        stopRoutesMap[stopId].set(info.shortName, info.headsign)
      }
    }
  }
  // Convert Maps → sorted arrays of { route, headsign }
  const stopRoutesFinal = {}
  for (const [stopId, map] of Object.entries(stopRoutesMap)) {
    stopRoutesFinal[stopId] = [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([route, headsign]) => ({ route, headsign }))
  }

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, 'gtfs-stops.json'), JSON.stringify(stopsMap))
  writeFileSync(join(OUT_DIR, 'gtfs-directions.json'), JSON.stringify(directionsMap))
  writeFileSync(join(OUT_DIR, 'gtfs-shapes.json'), JSON.stringify(shapesMap))
  writeFileSync(join(OUT_DIR, 'gtfs-stop-routes.json'), JSON.stringify(stopRoutesFinal))

  console.log(`✓ ${Object.keys(stopsMap).length} stops`)
  console.log(`✓ ${Object.keys(directionsMap).length} route-direction pairs`)
  console.log(`✓ ${Object.keys(shapesMap).length} route shapes`)
  console.log(`✓ ${Object.keys(stopRoutesFinal).length} stops with route mappings`)
  console.log('Wrote public/gtfs-stops.json, gtfs-directions.json, gtfs-shapes.json, gtfs-stop-routes.json')
}

main().catch(err => { console.error(err.message); process.exit(1) })
