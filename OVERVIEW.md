# RTD Denver Transit Tracker — Project Overview

A full-stack web application for tracking and planning trips on the Regional Transportation District (RTD) Denver transit network. Users can plan trips, watch live vehicle positions, check stop arrivals, browse routes, read service alerts, and save favorites — with optional account-based sync.

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Architecture](#2-architecture)
3. [Frontend Pages](#3-frontend-pages)
4. [Backend API Server](#4-backend-api-server)
5. [Database](#5-database)
6. [External APIs & Data Sources](#6-external-apis--data-sources)
7. [Authentication System](#7-authentication-system)
8. [Key Workflows](#8-key-workflows)
9. [State Management & Hooks](#9-state-management--hooks)
10. [Development Setup](#10-development-setup)
11. [npm Scripts](#11-npm-scripts)

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 19 + Vite 8 |
| Styling | Tailwind CSS v4 (via `@tailwindcss/vite` plugin) |
| Routing (client) | React Router v7 |
| Maps | Leaflet 1.9 + React-Leaflet 5 |
| Icons | Lucide React |
| Backend | Node.js + Express 4 |
| Database | PostgreSQL 16 |
| DB client | `pg` (node-postgres) |
| Password hashing | `bcryptjs` (12 rounds) |
| GTFS-RT decoding | `gtfs-realtime-bindings` |
| Transit routing | OpenTripPlanner (OTP) 2.6 — self-hosted Java server |
| Geocoding | Nominatim (OpenStreetMap) |
| Map tiles | OpenStreetMap via tile.openstreetmap.org |

---

## 2. Architecture

```
Browser (React SPA)
│
├── Vite dev server (port 5173) — acts as a proxy
│   ├── /api/gtfs-rt/*  → https://open-data.rtd-denver.com/files/gtfs-rt/*
│   ├── /api/otp/*      → http://localhost:8080  (OTP server)
│   ├── /api/geocode/*  → https://nominatim.openstreetmap.org/*
│   └── /api/auth + /api/favorites → http://localhost:3001  (Express server)
│
├── Express API server (port 3001)
│   ├── /api/auth/*       — register, login, logout, me, change password, delete account
│   └── /api/favorites/*  — CRUD favorites for logged-in users
│       → PostgreSQL database (rtd_tracker)
│
└── OpenTripPlanner server (port 8080) — self-hosted, reads local GTFS data
```

All external calls from the browser go through Vite's proxy so that CORS restrictions never affect the frontend, and the RTD open-data URL is never exposed directly in client code.

---

## 3. Frontend Pages

### `/` — Dashboard (`src/pages/Dashboard.jsx`)
The home screen. Shows:
- **Live vehicles**: a small sample of current bus/rail positions (route badge, speed, delay, next stop)
- **Service alerts**: recent alerts with severity icon
- **Popular routes**: quick-link pills for common RTD routes
- **Quick actions**: nav buttons to Planner, Tracker, Stops, Alerts

Data is fetched from the GTFS-RT feeds on page load.

---

### `/planner` — Trip Planner (`src/pages/TripPlanner.jsx`)
Two modes selectable at the top:

**Transit Only mode**
1. User types origin and destination (geocoded via Nominatim as they type, with debounce)
2. Selects departure time (Now / Leave at / Arrive by)
3. Clicks **Search** → OTP returns up to 3 itineraries
4. Results show on a Leaflet map with all route polylines simultaneously:
   - Selected route: full color, thicker line
   - Alternatives: gray, semi-transparent, each with a duration pill label
   - Clicking an alternative polyline or its label switches to that route
5. Trip cards below expand to show each leg (walk, bus, rail) with timing and stop details

**Drive + Transit mode**
1. User types origin and destination
2. A unified panel shows a Leaflet map with purple **P** markers for nearby Park & Ride stations
3. User clicks a station row (highlights it) or clicks **Select** to immediately plan the route
4. **Select** triggers two parallel OTP calls:
   - Drive-only: origin → P&R station
   - Transit: P&R station → destination
5. The legs are merged into one combined itinerary and shown on the same map
6. The map transitions from station picker to the full route with **Start**, **P**, and **End** markers

**Address autocomplete**: every keystroke after 3 characters fires a Nominatim search (320 ms debounce), filtered to the Denver metro bounding box.

---

### `/tracker` — Live Tracker (`src/pages/LiveTracker.jsx`)
- Leaflet map showing live vehicle positions for all RTD vehicles, refreshed every 15 seconds
- Vehicles rendered as colored arrow markers (rotated to heading direction)
- **Line filter**: type a route number → filter vehicles to that line; Enter selects first suggestion; Backspace removes active filter
- Clicking a vehicle opens a popup with route, headsign, speed (mph), delay, and next stop name
- Route shapes (from GTFS static data) are drawn on the map as background polylines when a line is filtered
- Status bar shows last-updated timestamp and refresh button

---

### `/stops` — Stops (`src/pages/Stops.jsx`)
- Search stops by name or browse nearby stops using browser geolocation
- Each stop row shows stop name, distance (if using geolocation), and route badges
- Expanding a stop fetches live arrivals from the GTFS-RT TripUpdate feed:
  - Shows next arrivals with route, headsign, ETA, and delay indicator (green/yellow/red)
  - Arrivals auto-refresh every 30 seconds while a stop is expanded
- Favorite button (star icon) saves/removes the stop; syncs to DB if logged in, localStorage if not

---

### `/routes` — Routes (`src/pages/Routes.jsx`)
- Lists all RTD routes from mock data
- Filter bar: **All**, **Bus**, **Light Rail**
- Free-text search filters by route name or number
- Expanding a route row shows: full name, type, color swatch, and which stops serve that route
- Deep-linkable via `?id=<routeId>` URL param (auto-expands that route on load)

---

### `/alerts` — Service Alerts (`src/pages/Alerts.jsx`)
- Fetches live alerts from the GTFS-RT Alerts feed (refreshed every 60 seconds)
- Summary counts by severity (Warning, Info, Good News)
- Alert rows show: severity icon, title, effect label badge, description, affected routes (colored pills), timestamp
- Filterable by severity (All / Warning / Info / Good News)
- No colored left-accent bar — severity is conveyed through the icon only

---

### `/login` and `/register` — Auth Pages
- Centered card layout with RTD Bus icon
- **Login**: email + password, show/hide toggle, redirects to the page the user was trying to reach (stored in `location.state.from`)
- **Register**: email + password + confirm password; live match indicator on confirm field; client-side validation (min 8 chars, passwords match)
- Both call the Express backend; on success the JWT-style token is stored in `localStorage`

---

### `/account` — Account Settings (`src/pages/Account.jsx`)
Protected route — redirects to `/login` if not authenticated.
- **Profile card**: shows email and active status
- **Change password**: current + new + confirm; invalidates all other sessions on success
- **Delete account**: inline confirmation with password input; deletes user and all data via CASCADE

---

## 4. Backend API Server

`server/index.js` — Express app on port 3001.

### Auth routes (`server/routes/auth.js`)

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account, return user + session token |
| POST | `/api/auth/login` | Verify credentials, return user + session token |
| POST | `/api/auth/logout` | Delete session (requires auth) |
| GET | `/api/auth/me` | Return current user from token (requires auth) |
| PUT | `/api/auth/password` | Change password, invalidate other sessions (requires auth) |
| DELETE | `/api/auth/account` | Delete account + all data (requires auth) |

### Favorites routes (`server/routes/favorites.js`)
All routes require auth via `requireAuth` middleware.

| Method | Path | Description |
|---|---|---|
| GET | `/api/favorites` | Return all favorites for user |
| POST | `/api/favorites` | Add a favorite (ON CONFLICT DO NOTHING) |
| DELETE | `/api/favorites/:type/:itemId` | Remove a specific favorite |

### Middleware (`server/middleware/requireAuth.js`)
1. Reads `Authorization: Bearer <token>` header
2. SHA-256 hashes the token
3. Queries `sessions JOIN users` where `token_hash = $1 AND expires_at > NOW() AND is_active = TRUE`
4. Sets `req.user` (id, email, is_admin) and `req.tokenHash`
5. Updates `last_seen_at` on the session

---

## 5. Database

PostgreSQL database named `rtd_tracker`. Schema defined in `db/schema.sql`.

### Tables

**`users`**
```
id             UUID PRIMARY KEY (gen_random_uuid)
email          VARCHAR(255) UNIQUE NOT NULL
password_hash  VARCHAR(255) NOT NULL
email_verified BOOLEAN DEFAULT FALSE
is_active      BOOLEAN DEFAULT TRUE
is_admin       BOOLEAN DEFAULT FALSE
created_at     TIMESTAMPTZ
updated_at     TIMESTAMPTZ  (auto-updated by trigger)
```

**`sessions`**
```
id           UUID PRIMARY KEY
user_id      UUID → users(id) ON DELETE CASCADE
token_hash   CHAR(64) UNIQUE  (SHA-256 of the bearer token)
expires_at   TIMESTAMPTZ      (30 days from creation)
created_at   TIMESTAMPTZ
last_seen_at TIMESTAMPTZ
```

**`favorites`**
```
id         UUID PRIMARY KEY
user_id    UUID → users(id) ON DELETE CASCADE
type       VARCHAR(10)  CHECK IN ('stop', 'route')
item_id    VARCHAR(64)
item_name  VARCHAR(255)
created_at TIMESTAMPTZ
UNIQUE (user_id, type, item_id)
```

**`password_reset_tokens`** *(reserved for future use)*
```
id         UUID PRIMARY KEY
user_id    UUID → users(id) ON DELETE CASCADE
token_hash CHAR(64) UNIQUE
expires_at TIMESTAMPTZ
used_at    TIMESTAMPTZ
created_at TIMESTAMPTZ
```

### Security details
- Passwords are hashed with `bcryptjs` at 12 rounds (computationally expensive by design)
- Session tokens are 32 random bytes (`crypto.randomBytes(32).toString('hex')`) — only the SHA-256 hash is stored in the DB; the plaintext token is never persisted
- Login uses a dummy bcrypt compare when no user is found (constant-time response to prevent timing attacks that reveal whether an email exists)
- Token is stored in browser `localStorage` under the key `rtd_token`

---

## 6. External APIs & Data Sources

### GTFS-Realtime feeds (RTD Open Data)
Base URL (proxied): `https://open-data.rtd-denver.com/files/gtfs-rt/`

Three Protocol Buffer feeds, fetched and decoded with `gtfs-realtime-bindings`:

| Feed file | What it contains | Poll interval |
|---|---|---|
| `VehiclePosition.pb` | Live lat/lon, heading, speed, trip/route ID for every active vehicle | 15 s |
| `TripUpdate.pb` | Stop-time updates: arrival/departure times + delays for every active trip | 15 s (vehicles) / 30 s (stop arrivals) |
| `Alerts.pb` | Service alerts: affected routes, effect type, header text, description | 60 s |

Decoding flow:
1. `fetch()` → `arrayBuffer()` → `Uint8Array`
2. `transit_realtime.FeedMessage.decode(bytes)` → JS object tree
3. Custom mapping functions in `src/api/rtdFeeds.js` extract relevant fields

---

### GTFS Static data
RTD publishes a static GTFS ZIP with stops, trips, shapes, routes, etc.

The script `scripts/fetch-gtfs-static.js` (run via `npm run update-gtfs`) downloads the ZIP, parses it, and writes three JSON files to `public/`:

| File | Contents |
|---|---|
| `public/gtfs-stops.json` | `{ stopId: { name, lat, lon } }` — all stops |
| `public/gtfs-directions.json` | `{ "routeId:directionId": "headsign" }` — direction labels |
| `public/gtfs-shapes.json` | `{ shapeId: [[lat,lon], ...] }` — polyline shapes |

These files are served as static assets by Vite and cached in-memory by `src/api/gtfsStatic.js` for the page lifetime.

---

### OpenTripPlanner (OTP) 2.6
Self-hosted Java server running on `http://localhost:8080`. Reads the same RTD GTFS static data to build a routing graph.

**Protocol**: GraphQL over HTTP POST to `/otp/gtfs/v1`

**Setup scripts**:
- `npm run otp:setup` — downloads the OTP JAR
- `npm run otp:build` — builds the routing graph from GTFS data (slow, ~2 min)
- `npm run otp:serve` — starts the OTP server (must be running for trip planning)

**Queries** (defined in `src/api/otp.js`):

*Transit-only trip*: sends origin/destination coordinates + optional datetime + transport modes `[WALK, BUS, TRAM, RAIL, SUBWAY, FERRY]`. Returns up to 3 itineraries.

*Drive+Transit (combined)*: two parallel queries:
1. Drive-only (`[CAR]`): origin → selected P&R station
2. Transit (`[WALK, BUS, TRAM, RAIL, SUBWAY]`): P&R station → destination
Results are merged into a single combined itinerary.

**Response processing** (`formatItinerary`): converts OTP's raw itinerary into app-friendly format:
- Each leg gets: `type` (walk/drive/transit), `geometry` (decoded polyline), `fromCoords`/`toCoords`, `routeId`, `routeColor`, timing
- `legGeometry.points` is a Google Polyline Algorithm encoded string — decoded by `decodePolyline()` into `[[lat,lon],...]`

---

### Nominatim (OpenStreetMap geocoding)
URL (proxied): `https://nominatim.openstreetmap.org/search`

Used in the Trip Planner for address autocomplete. Parameters:
- `q`: search text
- `format: json`
- `countrycodes: us`
- `viewbox: -105.5,39.4,-104.4,40.2` (Denver metro bounding box, non-strict)
- `limit: 6`

Results are trimmed to the first 3 address components for display. The Vite proxy injects a `User-Agent` header required by Nominatim's usage policy.

---

## 7. Authentication System

### Flow

**Register**
1. Browser POSTs `{ email, password }` to `/api/auth/register`
2. Server normalizes email (lowercase, trim), checks for existing account
3. Hashes password with bcrypt (12 rounds)
4. Inserts user row; creates session row with a random 32-byte token (stores SHA-256 hash)
5. Returns `{ user: { id, email, isAdmin }, token }` (plaintext token, one-time)
6. Browser stores token in `localStorage` as `rtd_token`

**Login**
1. Browser POSTs `{ email, password }` to `/api/auth/login`
2. Server fetches user by email; runs bcrypt compare against stored hash
3. If user not found, runs compare against a dummy hash (timing-attack prevention)
4. On match: creates new session, returns `{ user, token }`

**Authenticated requests**
- `AuthContext.apiFetch()` adds `Authorization: Bearer <token>` to every API call
- Middleware hashes the received token and looks it up in the sessions table

**Session expiry**: 30 days. The `expires_at` column is checked on every authenticated request.

**Password change**: invalidates all sessions *except* the current one (other devices are signed out).

**Account deletion**: `DELETE FROM users WHERE id = $1` — PostgreSQL CASCADE removes sessions, favorites, and reset tokens automatically.

### Admin accounts
Created via `npm run admin:create` with env vars:
```
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=yourpassword npm run admin:create
```
The script upserts the user with `is_admin = TRUE`. The `isAdmin` flag is returned on login/register/me and available via `useAuth()` in the frontend.

---

## 8. Key Workflows

### Trip planning (Transit Only)
```
User types origin/destination
       ↓
AddressInput debounces 320ms → Nominatim geocoding → suggestions dropdown
       ↓
User selects suggestion → coords stored in state
       ↓
User clicks Search → planTrip() → OTP GraphQL query
       ↓
OTP returns itineraries → formatItinerary() normalizes each one
       ↓
TripResultMap renders all routes on one Leaflet map
  - Unselected routes: gray polylines (opacity 0.5)
  - Selected route: colored polylines (full opacity) + TransferMarkers
  - AltRouteLabel: duration pill at midpoint of each alternative
  - Clicking alternative polyline → setSelectedTripIndex()
       ↓
TripCard list below map (expandable)
```

### Trip planning (Drive + Transit)
```
User selects Drive+Transit mode → DriveTransitPanel renders
       ↓
MapContainer shows: all P&R station markers + origin/destination (if set)
       ↓
getSuggestedParkAndRides() filters stations by:
  - detourRatio = (driveDist + transitDist) / directDist ≤ 1.4
  - driveDist < directDist (station is in the right direction)
       ↓
User clicks station row → PRSelectMarker updates (key remount forces icon change)
User clicks Select → handlePlanVia(station)
       ↓
Two parallel OTP calls:
  Promise.all([
    planTrip(origin → P&R, modes: [CAR]),
    planTrip(P&R → destination, modes: [WALK, BUS, TRAM, ...])
  ])
       ↓
Legs merged → combined itinerary → FitBounds key changes → map re-fits to route
Start/P/End markers replace station picker on map
```

### Live vehicle tracking
```
useVehiclePositions() on mount:
  Promise.all([
    fetchVehiclePositions() → VehiclePosition.pb → GTFS-RT decode
    fetchTripDelays()       → TripUpdate.pb → tripId → delay map
    getStops()              → /gtfs-stops.json (cached)
    getDirections()         → /gtfs-directions.json (cached)
  ])
  → enrich each vehicle with: delay, nextStopName, headsign
  → setInterval 15,000ms to repeat

Leaflet map renders vehicles as divIcon arrow markers (rotated by heading)
Line filter → only vehicles where routeId matches → route shapes drawn on map
```

### Stop arrivals
```
User searches/selects a stop
       ↓
useArrivalsAtStop(stopId) → setInterval 30,000ms
       ↓
fetchArrivalsAtStop(stopId):
  TripUpdate.pb → iterate all stopTimeUpdate entries
  → find entries where stopId matches
  → filter out past arrivals (etaSec < now)
  → sort by etaSec
  → top 12 results
       ↓
Each arrival row shows: route badge, headsign, ETA countdown, delay status
```

### Favorites
```
useFavorites() hook:
  if logged in:
    on mount → GET /api/favorites → populate from DB
    toggle(stop/route) → optimistic UI update → POST or DELETE /api/favorites
  if logged out:
    read/write localStorage key 'rtd_favorites'
    
Favorites are { type: 'stop'|'route', item_id, item_name }
```

---

## 9. State Management & Hooks

The app uses React's built-in state — no Redux or Zustand.

**`AuthContext` (`src/contexts/AuthContext.jsx`)**
- Wraps the whole app
- On mount: reads `rtd_token` from localStorage → `GET /api/auth/me` to validate
- Provides: `user`, `loading`, `login()`, `register()`, `logout()`, `apiFetch()`
- `apiFetch()`: wrapper around `fetch()` that injects the Bearer token and throws on non-2xx

**`useRTDFeeds` (`src/hooks/useRTDFeeds.js`)**
- `useVehiclePositions()`: polls vehicles + delays + static lookups every 15 s
- `useAlerts()`: polls alerts every 60 s
- `useArrivalsAtStop(stopId)`: polls arrivals every 30 s, resets when stopId changes
- `useNearbyStops()`: one-shot geolocation → findNearbyStops() against static stop data

**`useFavorites` (`src/hooks/useFavorites.js`)**
- Dual-mode: DB when logged in, localStorage when not
- Switches automatically when `user` changes

---

## 10. Development Setup

### Prerequisites
- Node.js 20+
- PostgreSQL 16 (via Homebrew: `brew install postgresql@16 && brew services start postgresql@16`)
- Java 17+ (for OTP server)

### First-time setup
```bash
# 1. Install dependencies
npm install

# 2. Create .env file
cp .env.example .env
# Edit: DATABASE_URL, PORT, CORS_ORIGIN

# 3. Create the database and apply schema
psql -U $(whoami) -d postgres -c 'CREATE DATABASE rtd_tracker;'
psql -U $(whoami) -d rtd_tracker -f db/schema.sql

# 4. Create admin account
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=yourpassword npm run admin:create

# 5. Fetch GTFS static data
npm run update-gtfs

# 6. Set up and build OTP routing graph (takes ~2 minutes)
npm run otp:setup
npm run otp:build
```

### Running the app (three terminals)
```bash
# Terminal 1 — Vite frontend
npm run dev

# Terminal 2 — Express backend
npm run server:dev

# Terminal 3 — OTP server (only needed for trip planning)
npm run otp:serve
```

The app is available at `http://localhost:5173`.

---

## 11. npm Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start Vite dev server with HMR on port 5173 |
| `npm run build` | Production build to `dist/` |
| `npm run server` | Start Express API server (production) |
| `npm run server:dev` | Start Express with `--watch` (auto-restart on file change) |
| `npm run admin:create` | Create/promote an admin user (needs `ADMIN_EMAIL` + `ADMIN_PASSWORD` env vars) |
| `npm run update-gtfs` | Download RTD GTFS ZIP and regenerate static JSON files |
| `npm run otp:setup` | Download the OTP JAR file |
| `npm run otp:build` | Build the OTP routing graph from GTFS data |
| `npm run otp:serve` | Start the OTP server on port 8080 |

---

## Environment variables (`.env`)

```
DATABASE_URL=postgresql://username@localhost:5432/rtd_tracker
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

---

## Data flow summary

```
RTD open-data servers          OTP (local)        Nominatim (OSM)
       │                           │                     │
       │ GTFS-RT .pb feeds         │ GraphQL             │ REST search
       │                           │                     │
       └───────────────────────────┴─────────────────────┘
                                   │
                          Vite proxy (port 5173)
                                   │
                          React SPA (browser)
                          ├── AuthContext (token management)
                          ├── useRTDFeeds (polling hooks)
                          ├── useFavorites (DB or localStorage)
                          └── Pages / Leaflet maps
                                   │
                          Express server (port 3001)
                                   │
                          PostgreSQL (rtd_tracker)
```
