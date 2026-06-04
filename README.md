# RTD Tracker

A real-time transit tracker for the Denver RTD network, built with React + Vite.

## Features

- **Live vehicle positions** on an interactive map, polled every 15 seconds
- **Trip delays and arrivals** by stop from RTD's GTFS-RT feed
- **Service alerts** from RTD's live feed
- **Route and stop browsing** with links to full schedules on RTD's website
- **Trip planner** powered by OpenTripPlanner with real routing across the RTD network

## Setup

```bash
npm install
npm run dev
```

## Update static GTFS data

Downloads the latest stops and route/direction lookup data from RTD's public GTFS feed:

```bash
npm run update-gtfs
```

## Trip Planner — OpenTripPlanner Setup

The trip planner requires a local OpenTripPlanner server. One-time setup:

### Prerequisites
- Java 17 or later (`java -version` to check; install via `brew install openjdk@21`)

### 1. Download data (~500 MB total)
```bash
npm run otp:setup
```
Downloads the OTP jar, RTD GTFS feed, and Colorado OSM street data.

### 2. Build the routing graph (~10–15 min, needs ~4 GB RAM)
```bash
npm run otp:build
```
Runs a two-phase build: street network first, then GTFS transit data on top.

### 3. Start the OTP server
```bash
npm run otp:serve
```
OTP runs on `http://localhost:8080`. Keep this running alongside the dev server.

### 4. Start the dev server
```bash
npm run dev
```

> **Note:** The `otp-data/` directory is gitignored — each developer needs to run `otp:setup` and `otp:build` locally.
