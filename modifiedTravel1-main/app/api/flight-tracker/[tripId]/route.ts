import { NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase-server'

// ─── Types ────────────────────────────────────────────────────────────────────

type FlightRow = {
  id: string
  trip_id: string
  flight_number: string
  departure_airport: string
  arrival_airport: string
  departure_date: string
  departure_time: string
  arrival_date: string
  arrival_time: string
  airline_name?: string | null
  seat_number?: string | null
  booking_reference?: string | null
  serial_number?: number | null
  is_connecting_to_next?: boolean | null
  connection_group?: string | null
}

type BootstrapFlight = {
  lat?: number
  lng?: number
  speed?: number
  dir?: number
  airline_icao?: string
  dep_iata?: string
  arr_iata?: string
  dep_name?: string
  arr_name?: string
  flight_iata?: string
  flight_icao?: string
  flight?: string
  hex?: string
}

type AircraftRow = {
  hex?: string
  flight?: string
  lat?: number
  lon?: number
  gs?: number
  track?: number
  alt_baro?: number
  airline?: string
  reg?: string
  r?: string
  iata?: string
  icao?: string
}

type Position = {
  lat: number
  lon: number
  heading: number | null
  speed: number | null
  altitude: number | null
  callsign: string | null
  hex: string | null
}

type TrackerSnapshot = {
  source: 'airlabs' | 'adsb' | 'fallback'
  position: Position
  weather: Record<string, number | string | null> | null
  weatherScore: number
  congestionScore: number
  airTrafficScore: number
  totalDelayScore: number
  estimatedArrivalUtc: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 5_000
const AVG_CRUISE_SPEED_KMH = 900 // used for ETA estimate

/** Known airport coordinates [lat, lon] */
const AIRPORT_COORDS: Record<string, [number, number]> = {
  DXB: [25.2532, 55.3657],
  LAX: [33.9416, -118.4085],
  JFK: [40.6413, -73.7781],
  ORD: [41.9742, -87.9073],
  LHR: [51.47, -0.4543],
  CDG: [49.0097, 2.5479],
  AMS: [52.3105, 4.7683],
  FRA: [50.0379, 8.5622],
  HND: [35.5494, 139.7798],
  NRT: [35.7767, 140.3188],
  SIN: [1.3644, 103.9915],
  SFO: [37.6213, -122.379],
  SEA: [47.4502, -122.3088],
  BOS: [42.3656, -71.0096],
  ATL: [33.6407, -84.4277],
  DOH: [25.2736, 51.6081],
  DEL: [28.5562, 77.1],
  BOM: [19.0896, 72.8656],
  BLR: [13.1986, 77.7066],
  MAA: [12.9941, 80.1709],
  HYD: [17.2403, 78.4294],
  CCU: [22.6547, 88.4467],
  AMD: [23.0772, 72.6347],
  PNQ: [18.5822, 73.9197],
  COK: [10.152, 76.4019],
}

const FALLBACK_COORDS: [number, number] = [20.5937, 78.9629] // centre of India
const FALLBACK_SPEED = 850
const FALLBACK_HEADING = 90

const HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  Accept: 'application/json',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toNum = (value: unknown, fallback: number): number => {
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback
}

const airportCoords = (code?: string | null): [number, number] => {
  if (!code) return FALLBACK_COORDS
  return AIRPORT_COORDS[code.trim().toUpperCase()] ?? FALLBACK_COORDS
}

/** Haversine distance in km */
const distanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Wrap-around-safe heading difference (0–180) */
const headingDiff = (a: number, b: number): number => {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

/** Midpoint between two lat/lon pairs */
const midpoint = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): [number, number] => [(lat1 + lat2) / 2, (lon1 + lon2) / 2]

// ─── Fetch utilities ──────────────────────────────────────────────────────────

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { headers: HEADERS, signal: controller.signal })
    if (!res.ok) return null
    const text = await res.text()
    if (!text.trim()) return null
    return JSON.parse(text)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// ─── AirLabs bootstrap ────────────────────────────────────────────────────────

async function airlabsBootstrap(flightNumber: string): Promise<BootstrapFlight | null> {
  const apiKey = process.env.AIRLABS_API_KEY
  if (!apiKey) return null

  const url = new URL('https://airlabs.co/api/v9/flight')
  url.searchParams.set('flight_iata', flightNumber.trim().toUpperCase())
  url.searchParams.set('api_key', apiKey)

  const data = fetchJson(url.toString()) as Promise<{ response?: BootstrapFlight | BootstrapFlight[] } | null>
  const resolved = await data
  if (!resolved) return null

  const resp = resolved.response
  if (!resp) return null
  return Array.isArray(resp) ? (resp[0] ?? null) : resp
}

// ─── Weather ──────────────────────────────────────────────────────────────────

async function getWeather(lat: number, lon: number): Promise<Record<string, unknown> | null> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lon))
  url.searchParams.set('current', 'temperature_2m,wind_speed_10m,visibility,cloud_cover,precipitation')

  const data = await fetchJson(url.toString()) as { current?: Record<string, unknown> } | null
  return data?.current ?? null
}

function calcWeatherScore(weather: Record<string, unknown> | null): number {
  if (!weather) return 10
  let score = 0

  const vis = toNum(weather.visibility, 10_000)
  const wind = toNum(weather.wind_speed_10m, 0)
  const cloud = toNum(weather.cloud_cover, 0)
  const rain = toNum(weather.precipitation, 0)

  if (vis < 3_000) score += 25
  else if (vis < 7_000) score += 10

  if (wind > 40) score += 18
  else if (wind > 25) score += 10

  if (cloud > 90) score += 10
  if (rain > 3) score += 20

  return Math.min(score, 95)
}

// ─── Congestion (ADS-B) ───────────────────────────────────────────────────────

async function getCongestion(lat: number, lon: number): Promise<{ score: number; count: number }> {
  const data = await fetchJson(`https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/100`) as { ac?: unknown[] } | null
  const count = Array.isArray(data?.ac) ? data.ac.length : 0

  let score = 3
  if (count > 200) score = 35
  else if (count > 100) score = 20
  else if (count > 50) score = 10

  return { score, count }
}

// ─── Nearby aircraft fetch ────────────────────────────────────────────────────

async function fetchNearbyAircraft(lat: number, lon: number, radiusNm = 250): Promise<AircraftRow[]> {
  const data = await fetchJson(
    `https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/${radiusNm}`
  ) as { ac?: AircraftRow[] } | null
  return Array.isArray(data?.ac) ? data.ac : []
}

// ─── Best-match ADS-B aircraft ────────────────────────────────────────────────

function bestMatch(
  aircraft: AircraftRow[],
  targetLat: number,
  targetLon: number,
  targetSpeed: number,
  targetHeading: number,
  targetAirlinePrefix: string
): AircraftRow | null {
  let best: AircraftRow | null = null
  let bestScore = Infinity

  for (const ac of aircraft) {
    const lat = ac.lat
    const lon = ac.lon
    if (typeof lat !== 'number' || typeof lon !== 'number') continue

    const heading = typeof ac.track === 'number' ? ac.track : targetHeading
    const speed = typeof ac.gs === 'number' ? ac.gs : targetSpeed
    const callsign = (ac.flight ?? '').trim().toUpperCase()

    // Airline prefix bonus: strong match = negative score offset
    const airlineBonus = targetAirlinePrefix && callsign.startsWith(targetAirlinePrefix) ? -300 : 0

    const score =
      distanceKm(targetLat, targetLon, lat, lon) * 10 +
      headingDiff(heading, targetHeading) * 2 +
      Math.abs(speed - targetSpeed) * 0.2 +
      airlineBonus

    if (score < bestScore) {
      bestScore = score
      best = ac
    }
  }

  return best
}

// ─── Delay scoring ────────────────────────────────────────────────────────────

function calcDelayScore(
  altitude: number | null,
  speed: number | null,
  weatherRisk: number,
  congestionRisk: number
): number {
  let score = 0

  // Low altitude / speed implies approach, holding, or slow climb
  const alt = altitude ?? 35_000
  const spd = speed ?? FALLBACK_SPEED

  if (alt < 12_000) score += 15
  if (alt < 5_000) score += 10
  if (spd < 250) score += 20
  else if (spd < 350) score += 10

  score += weatherRisk + congestionRisk
  return Math.min(Math.round(score), 95)
}

/**
 * Estimate arrival UTC based on remaining distance and current speed.
 * Falls back to delay-score-based offset if geometry is unavailable.
 */
function calcEstimatedArrival(
  posLat: number,
  posLon: number,
  arrLat: number,
  arrLon: number,
  speedKts: number | null,
  delayScore: number
): string {
  const speedKmh = speedKts ? speedKts * 1.852 : AVG_CRUISE_SPEED_KMH
  const remainingKm = distanceKm(posLat, posLon, arrLat, arrLon)
  const flightMinutes = (remainingKm / speedKmh) * 60
  const delayMinutes = Math.round(delayScore * 0.5) // delay score → extra minutes

  const etaMs = Date.now() + (flightMinutes + delayMinutes) * 60_000
  return new Date(etaMs).toISOString()
}

// ─── Core snapshot ────────────────────────────────────────────────────────────

async function loadLiveSnapshot(flight: FlightRow): Promise<TrackerSnapshot> {
  const [depLat, depLon] = airportCoords(flight.departure_airport)
  const [arrLat, arrLon] = airportCoords(flight.arrival_airport)

  // Best-guess mid-flight position before we have live data
  const [estLat, estLon] = midpoint(depLat, depLon, arrLat, arrLon)

  // 1. Bootstrap from AirLabs (fast, cheap)
  const bootstrap = await airlabsBootstrap(flight.flight_number)

  const seedLat = bootstrap?.lat ?? estLat
  const seedLon = bootstrap?.lng ?? estLon
  const seedSpeed = bootstrap?.speed ?? FALLBACK_SPEED
  const seedHeading = bootstrap?.dir ?? FALLBACK_HEADING
  const airlinePrefix =
    bootstrap?.airline_icao?.toUpperCase() ||
    (flight.airline_name?.slice(0, 3).toUpperCase() ?? '')

  let source: TrackerSnapshot['source'] = bootstrap ? 'airlabs' : 'fallback'

  let position: Position = {
    lat: seedLat,
    lon: seedLon,
    heading: seedHeading,
    speed: seedSpeed,
    altitude: null,
    callsign: flight.flight_number,
    hex: bootstrap?.hex ?? null,
  }

  // 2. Parallel: ADS-B nearby aircraft + weather + congestion at arrival
  const [aircraftResult, weatherResult, congestionResult] = await Promise.allSettled([
    fetchNearbyAircraft(seedLat, seedLon, 250),
    getWeather(arrLat, arrLon),
    getCongestion(arrLat, arrLon),
  ])

  const aircraft = aircraftResult.status === 'fulfilled' ? aircraftResult.value : []
  const weather = weatherResult.status === 'fulfilled' ? weatherResult.value : null
  const congestion =
    congestionResult.status === 'fulfilled' ? congestionResult.value : { score: 5, count: 0 }

  // 3. Match against ADS-B feed
  const match = bestMatch(aircraft, seedLat, seedLon, seedSpeed, seedHeading, airlinePrefix)
  if (match) {
    source = 'adsb'
    position = {
      lat: match.lat ?? seedLat,
      lon: match.lon ?? seedLon,
      heading: typeof match.track === 'number' ? match.track : seedHeading,
      speed: typeof match.gs === 'number' ? match.gs : seedSpeed,
      altitude: typeof match.alt_baro === 'number' ? match.alt_baro : null,
      callsign: (match.flight?.trim() || flight.flight_number) ?? null,
      hex: match.hex ?? null,
    }
  }

  // 4. Scoring
  const weatherRisk = calcWeatherScore(weather)
  const airTrafficScore = Math.min(Math.round(aircraft.length / 4) || congestion.count, 95)
  const totalDelayScore = calcDelayScore(position.altitude, position.speed, weatherRisk, congestion.score)

  // 5. ETA — geometry-aware
  const estimatedArrivalUtc = calcEstimatedArrival(
    position.lat,
    position.lon,
    arrLat,
    arrLon,
    position.speed,
    totalDelayScore
  )

  return {
    source,
    position,
    weather,
    weatherScore: weatherRisk,
    congestionScore: congestion.score,
    airTrafficScore,
    totalDelayScore,
    estimatedArrivalUtc,
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(
  req: Request,
  { params }: { params: { tripId: string } }
) {
  try {
    const { tripId } = params
    if (!tripId) {
      return NextResponse.json({ error: 'tripId required' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const requestedFlightId = typeof body?.flightId === 'string' ? body.flightId : null

    const supabase = await createServerClient()

    // Fetch trip metadata
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('id, trip_name')
      .eq('id', tripId)
      .maybeSingle()

    if (tripError) {
      return NextResponse.json({ error: tripError.message }, { status: 400 })
    }

    // Fetch relevant flight(s)
    const baseQuery = supabase
      .from('trip_flights')
      .select(
        'id, trip_id, flight_number, departure_airport, arrival_airport, departure_date, departure_time, arrival_date, arrival_time, airline_name, seat_number, booking_reference, serial_number, is_connecting_to_next, connection_group'
      )
      .eq('trip_id', tripId)

    let flight: FlightRow | null = null

    if (requestedFlightId) {
      const { data, error } = await baseQuery.eq('id', requestedFlightId).maybeSingle()
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      flight = data as FlightRow | null
    } else {
      const { data, error } = await baseQuery
        .order('departure_date', { ascending: true })
        .order('departure_time', { ascending: true })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      flight = Array.isArray(data) ? (data[0] as FlightRow) ?? null : null
    }

    if (!flight) {
      return NextResponse.json({ error: 'No matching flight found for tracker' }, { status: 404 })
    }

    const snapshot = await loadLiveSnapshot(flight)

    return NextResponse.json({
      tripId,
      tripName: trip?.trip_name ?? null,
      flightId: flight.id,
      flightNumber: flight.flight_number,
      departureAirport: flight.departure_airport,
      arrivalAirport: flight.arrival_airport,
      airlineName: flight.airline_name ?? null,
      seatNumber: flight.seat_number ?? null,
      bookingReference: flight.booking_reference ?? null,
      source: snapshot.source,
      position: snapshot.position,
      weather: snapshot.weather,
      weatherScore: snapshot.weatherScore,
      congestionScore: snapshot.congestionScore,
      airTrafficScore: snapshot.airTrafficScore,
      delayProbability: snapshot.totalDelayScore,
      estimatedArrivalUtc: snapshot.estimatedArrivalUtc,
    })
  } catch (error) {
    console.error('[flight-tracker]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

