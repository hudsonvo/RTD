// Downloads RTD's static GTFS zip and extracts two small lookup files:
//   public/gtfs-stops.json      { stopId: "Stop Name" }
//   public/gtfs-directions.json { "routeId:directionId": "Headsign" }
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

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, 'gtfs-stops.json'), JSON.stringify(stopsMap))
  writeFileSync(join(OUT_DIR, 'gtfs-directions.json'), JSON.stringify(directionsMap))

  console.log(`✓ ${Object.keys(stopsMap).length} stops`)
  console.log(`✓ ${Object.keys(directionsMap).length} route-direction pairs`)
  console.log('Wrote public/gtfs-stops.json and public/gtfs-directions.json')
}

main().catch(err => { console.error(err.message); process.exit(1) })
