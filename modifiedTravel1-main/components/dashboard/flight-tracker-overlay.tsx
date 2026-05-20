'use client'

import { useCallback, useEffect, useState } from 'react'

type AirportInfo = {
  lat: number
  lon: number
  name: string
  city: string
}

type DemoFlight = {
  id: string
  flight_number: string
  departure_airport: string
  arrival_airport: string
  departure_date: string
  departure_time: string
  arrival_date: string
  arrival_time: string
  airline_name?: string
  seat_number?: string
  booking_reference?: string
  trip_name?: string
  booking_status?: string
}

type WeatherData = {
  temperature_2m?: number
  relative_humidity_2m?: number
  wind_speed_10m?: number
  wind_gusts_10m?: number
  wind_direction_10m?: number
  visibility?: number
  cloud_cover?: number
  precipitation?: number
  weather_code?: number
  surface_pressure?: number
}

type LiveAircraft = {
  alt?: number | null
  speed?: number | null
  hdg?: number | null
  lat?: number | null
  lon?: number | null
  callsign?: string | null
  hex?: string | null
}

type CacheEntry = {
  arrWx: WeatherData | null
  depWx: WeatherData | null
  wxScore: number
  cong: number
  nearbyCount: number
  delay: number
  delayMin: number
  eta: Date
  live: LiveAircraft
}

const AIRPORTS: Record<string, AirportInfo> = {
  LAX: { lat: 33.9416, lon: -118.4085, name: 'Los Angeles Intl', city: 'Los Angeles' },
  DXB: { lat: 25.2532, lon: 55.3657, name: 'Dubai International', city: 'Dubai' },
  JFK: { lat: 40.6413, lon: -73.7781, name: 'John F. Kennedy Intl', city: 'New York' },
  LHR: { lat: 51.47, lon: -0.4543, name: 'London Heathrow', city: 'London' },
  DOH: { lat: 25.2731, lon: 51.6081, name: 'Hamad International', city: 'Doha' },
  SIN: { lat: 1.3644, lon: 103.9915, name: 'Singapore Changi', city: 'Singapore' },
  ORD: { lat: 41.9742, lon: -87.9073, name: "Chicago O'Hare", city: 'Chicago' },
  CDG: { lat: 49.0097, lon: 2.5479, name: 'Paris Charles de Gaulle', city: 'Paris' },
  SYD: { lat: -33.9399, lon: 151.1753, name: 'Sydney Kingsford Smith', city: 'Sydney' },
  BOM: { lat: 19.0896, lon: 72.8656, name: 'Chhatrapati Shivaji Intl', city: 'Mumbai' },
  DEL: { lat: 28.5665, lon: 77.103, name: 'Indira Gandhi Intl', city: 'Delhi' },
  HKG: { lat: 22.308, lon: 113.9185, name: 'Hong Kong International', city: 'Hong Kong' },
  NRT: { lat: 35.7647, lon: 140.3864, name: 'Tokyo Narita', city: 'Tokyo' },
  FRA: { lat: 50.0379, lon: 8.5622, name: 'Frankfurt International', city: 'Frankfurt' },
  AMS: { lat: 52.3105, lon: 4.7683, name: 'Amsterdam Schiphol', city: 'Amsterdam' },
  IST: { lat: 41.2608, lon: 28.7418, name: 'Istanbul Airport', city: 'Istanbul' },
  ATL: { lat: 33.6407, lon: -84.4277, name: 'Hartsfield-Jackson Atlanta', city: 'Atlanta' },
  SFO: { lat: 37.6213, lon: -122.379, name: 'San Francisco Intl', city: 'San Francisco' },
}

const DEMO_FLIGHTS: DemoFlight[] = [
  {
    id: 'f1',
    flight_number: 'EK215',
    departure_airport: 'DXB',
    arrival_airport: 'LAX',
    departure_date: '2026-05-20',
    departure_time: '02:30',
    arrival_date: '2026-05-20',
    arrival_time: '08:45',
    airline_name: 'Emirates',
    seat_number: '14A',
    booking_reference: 'EK7X9M',
    trip_name: 'West Coast Trip',
    booking_status: 'confirmed',
  },
  {
    id: 'f2',
    flight_number: 'BA117',
    departure_airport: 'LHR',
    arrival_airport: 'JFK',
    departure_date: '2026-05-22',
    departure_time: '10:00',
    arrival_date: '2026-05-22',
    arrival_time: '12:55',
    airline_name: 'British Airways',
    seat_number: '32C',
    booking_reference: 'BA4T2P',
    trip_name: 'New York Business',
    booking_status: 'confirmed',
  },
  {
    id: 'f3',
    flight_number: 'SQ321',
    departure_airport: 'SIN',
    arrival_airport: 'LHR',
    departure_date: '2026-05-25',
    departure_time: '23:10',
    arrival_date: '2026-05-26',
    arrival_time: '05:00',
    airline_name: 'Singapore Airlines',
    seat_number: '8F',
    booking_reference: 'SQ9R3K',
    trip_name: 'London Holiday',
    booking_status: 'confirmed',
  },
  {
    id: 'f4',
    flight_number: 'AI101',
    departure_airport: 'DEL',
    arrival_airport: 'BOM',
    departure_date: '2026-05-19',
    departure_time: '07:15',
    arrival_date: '2026-05-19',
    arrival_time: '09:20',
    airline_name: 'Air India',
    seat_number: '22B',
    booking_reference: 'AI5N8X',
    trip_name: 'Mumbai Meeting',
    booking_status: 'confirmed',
  },
  {
    id: 'f5',
    flight_number: 'QR007',
    departure_airport: 'DOH',
    arrival_airport: 'LHR',
    departure_date: '2026-05-21',
    departure_time: '08:15',
    arrival_date: '2026-05-21',
    arrival_time: '13:30',
    airline_name: 'Qatar Airways',
    seat_number: '5A',
    booking_reference: 'QR2X8Z',
    trip_name: 'Europe Tour',
    booking_status: 'confirmed',
  },
]

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
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

function scoreWeather(w: WeatherData | null) {
  if (!w) return 0
  let s = 0
  const vis = w.visibility ?? 10000
  const wind = w.wind_speed_10m ?? 0
  const gust = w.wind_gusts_10m ?? wind
  const cloud = w.cloud_cover ?? 0
  const rain = w.precipitation ?? 0

  if (vis < 1000) s += 30
  else if (vis < 3000) s += 20
  else if (vis < 7000) s += 8

  if (gust > 60) s += 22
  else if (gust > 40) s += 14
  else if (gust > 25) s += 7

  if (cloud > 90) s += 8
  if (rain > 10) s += 20
  else if (rain > 3) s += 10
  else if (rain > 0.5) s += 4

  return Math.min(s, 95)
}

function calcDelay(alt: number | null, speed: number | null, wxScore: number, nearby: number) {
  let s = 0
  if (alt != null) {
    if (alt < 3000) s += 25
    else if (alt < 8000) s += 12
    else if (alt < 15000) s += 6
  }
  if (speed != null) {
    if (speed < 150) s += 22
    else if (speed < 280) s += 12
    else if (speed < 380) s += 5
  }
  s += wxScore * 0.6
  if (nearby > 200) s += 28
  else if (nearby > 100) s += 16
  else if (nearby > 40) s += 8
  else s += 3
  return Math.min(Math.round(s), 95)
}

function congScore(n: number) {
  return n > 200 ? 35 : n > 100 ? 22 : n > 40 ? 12 : 4
}

async function fetchWeather(lat: number, lon: number): Promise<WeatherData | null> {
  try {
    const r = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m,visibility,cloud_cover,precipitation,weather_code,surface_pressure&timezone=auto`
    )
    const d = (await r.json()) as { current?: WeatherData }
    return d.current || null
  } catch {
    return null
  }
}

type AdsbResponse = { ac?: Array<Record<string, unknown>> }

async function fetchAdsbCallsign(cs: string) {
  try {
    const r = await fetch(`https://api.adsb.lol/v2/callsign/${cs.trim().toUpperCase()}`, {
      headers: { 'User-Agent': 'FlightDashboard/1.0' },
    })
    const d = (await r.json()) as AdsbResponse
    return (d.ac || [])[0] || null
  } catch {
    return null
  }
}

async function fetchAdsbArea(lat: number, lon: number, km = 250) {
  try {
    const r = await fetch(`https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/${km}`, {
      headers: { 'User-Agent': 'FlightDashboard/1.0' },
    })
    const d = (await r.json()) as AdsbResponse
    return d.ac || []
  } catch {
    return []
  }
}

function wxMeta(code?: number) {
  if (code == null) return { icon: '🌤', label: 'Unknown' }
  if (code === 0) return { icon: '☀️', label: 'Clear sky' }
  if (code <= 3) return { icon: '⛅', label: 'Partly cloudy' }
  if (code <= 49) return { icon: '🌫️', label: 'Fog / Mist' }
  if (code <= 67) return { icon: '🌧️', label: 'Rain' }
  if (code <= 77) return { icon: '🌨️', label: 'Snow' }
  if (code <= 82) return { icon: '🌦️', label: 'Showers' }
  if (code <= 99) return { icon: '⛈️', label: 'Thunderstorm' }
  return { icon: '🌤', label: 'Fair' }
}

const rC = (s: number) => (s >= 60 ? '#ef4444' : s >= 30 ? '#f59e0b' : '#10b981')
const rL = (s: number) => (s >= 60 ? 'HIGH' : s >= 30 ? 'MODERATE' : 'LOW')
const rBg = (s: number) =>
  s >= 60
    ? 'rgba(239,68,68,0.1)'
    : s >= 30
      ? 'rgba(245,158,11,0.1)'
      : 'rgba(16,185,129,0.1)'

function windDir(deg: number) {
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8]
}

function Spinner({ size = 16, color = '#60a5fa' }: { size?: number; color?: string }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        border: '2px solid rgba(255,255,255,0.08)',
        borderTopColor: color,
        borderRadius: '50%',
        animation: 'spin 0.85s linear infinite',
        flexShrink: 0,
      }}
    />
  )
}

function RouteArc({ dep, arr }: { dep: AirportInfo | null; arr: AirportInfo | null }) {
  if (!dep || !arr) return null
  const W = 600
  const H = 170
  const P = 50
  const lats = [dep.lat, arr.lat]
  const lons = [dep.lon, arr.lon]
  const minLat = Math.min(...lats) - 8
  const maxLat = Math.max(...lats) + 8
  const minLon = Math.min(...lons) - 14
  const maxLon = Math.max(...lons) + 14
  const toX = (l: number) => P + ((l - minLon) / (maxLon - minLon)) * (W - P * 2)
  const toY = (l: number) => H - P - ((l - minLat) / (maxLat - minLat)) * (H - P * 2)
  const x1 = toX(dep.lon)
  const y1 = toY(dep.lat)
  const x2 = toX(arr.lon)
  const y2 = toY(arr.lat)
  const mx = (x1 + x2) / 2
  const my = Math.min(y1, y2) - 34
  const dist = Math.round(haversine(dep.lat, dep.lon, arr.lat, arr.lon))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }}>
      <defs>
        <linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#f97316" />
        </linearGradient>
        <marker id="arr" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
          <polygon points="0 0,7 3.5,0 7" fill="#f97316" opacity="0.8" />
        </marker>
      </defs>
      <path
        d={`M${x1},${y1} Q${mx},${my} ${x2},${y2}`}
        fill="none"
        stroke="url(#lg)"
        strokeWidth="2"
        strokeDasharray="5 3"
        opacity="0.75"
        markerEnd="url(#arr)"
      />
      <circle cx={x1} cy={y1} r="6" fill="#3b82f6" opacity="0.9" />
      <circle cx={x2} cy={y2} r="6" fill="#f97316" opacity="0.9" />
      <text x={x1} y={y1 - 11} textAnchor="middle" fontSize="11" fill="#93c5fd" fontWeight="600">
        {dep.city}
      </text>
      <text x={x2} y={y2 - 11} textAnchor="middle" fontSize="11" fill="#fdba74" fontWeight="600">
        {arr.city}
      </text>
      <text x={mx} y={my - 7} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.3)">
        {dist.toLocaleString()} km
      </text>
    </svg>
  )
}

function Gauge({ value = 0 }: { value?: number }) {
  const v = Math.max(0, Math.min(value, 95))
  const color = rC(v)
  const R = 38
  const cx = 55
  const cy = 58
  const pt = (pct: number) => {
    const d = -135 + pct * 270
    const r = ((d - 90) * Math.PI) / 180
    return { x: cx + R * Math.cos(r), y: cy + R * Math.sin(r) }
  }
  const arc = (f: number, t: number, col: string, op = 1) => {
    const s = pt(f)
    const e = pt(t)
    return (
      <path
        d={`M${s.x},${s.y} A${R},${R} 0 ${((t - f) * 270 > 180 ? 1 : 0)},1 ${e.x},${e.y}`}
        fill="none"
        stroke={col}
        strokeWidth="6"
        strokeLinecap="round"
        opacity={op}
      />
    )
  }
  const pct = v / 95
  const n = pt(pct)
  return (
    <svg viewBox="0 0 110 80" style={{ width: 110, height: 80 }}>
      {arc(0, 1 / 3, '#10b981', 0.18)}
      {arc(1 / 3, 2 / 3, '#f59e0b', 0.18)}
      {arc(2 / 3, 1, '#ef4444', 0.18)}
      {pct > 0 && arc(0, pct, color)}
      <line
        x1={cx}
        y1={cy}
        x2={n.x}
        y2={n.y}
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r="4" fill={color} />
      <text x={cx} y={cy + 17} textAnchor="middle" fontSize="13" fontWeight="700" fill={color}>
        {v}%
      </text>
      <text x={cx} y={cy + 29} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.3)">
        {rL(v)}
      </text>
    </svg>
  )
}

function Bar({ label, val, max, color }: { label: string; val: number; max: number; color: string }) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          color: '#64748b',
          marginBottom: 4,
        }}
      >
        <span>{label}</span>
        <span style={{ color: '#94a3b8' }}>
          {val}
          <span style={{ color: '#475569' }}>/{max}</span>
        </span>
      </div>
      <div style={{ height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${Math.min((val / max) * 100, 100)}%`,
            background: color,
            borderRadius: 4,
            transition: 'width 0.8s ease',
          }}
        />
      </div>
    </div>
  )
}

function Tile({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: string
  label: string
  value: string
  sub?: string
  accent?: string
}) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 12,
        padding: '13px 15px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span
          style={{
            fontSize: 10,
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: 0.9,
            fontWeight: 600,
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: accent || '#f1f5f9',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function FlightCard({
  flight,
  active,
  onClick,
}: {
  flight: DemoFlight
  active: boolean
  onClick: () => void
}) {
  const diff =
    (new Date(`${flight.departure_date}T${flight.departure_time}`) as unknown as number) -
    (new Date() as unknown as number)
  const hours = diff / 3600000
  const tag = hours < -1 ? { l: 'In air', c: '#6b7280' } : hours < 2 ? { l: 'Soon', c: '#f59e0b' } : { l: 'Upcoming', c: '#10b981' }
  return (
    <button
      onClick={onClick}
      style={{
        cursor: 'pointer',
        padding: '12px 14px',
        borderRadius: 12,
        textAlign: 'left',
        border: active ? '1.5px solid #3b82f6' : '1px solid rgba(255,255,255,0.07)',
        background: active ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.02)',
        transition: 'all 0.15s',
        minWidth: 215,
        flexShrink: 0,
        outline: 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>{flight.flight_number}</span>
        <span
          style={{
            fontSize: 10,
            padding: '2px 7px',
            borderRadius: 20,
            background: `${tag.c}18`,
            color: tag.c,
            fontWeight: 600,
            textTransform: 'uppercase',
          }}
        >
          {tag.l}
        </span>
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', letterSpacing: 1, marginBottom: 4 }}>
        {flight.departure_airport}
        <span style={{ color: '#334155', fontSize: 12, margin: '0 4px' }}>→</span>
        {flight.arrival_airport}
      </div>
      <div style={{ fontSize: 11, color: '#64748b' }}>
        {flight.departure_date} · {flight.departure_time}
      </div>
      {flight.airline_name && <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>{flight.airline_name}</div>}
      {flight.seat_number && (
        <div style={{ fontSize: 10, color: '#334155', marginTop: 2 }}>
          Seat {flight.seat_number} · {flight.booking_reference}
        </div>
      )}
    </button>
  )
}

export default function FlightTrackerDashboard() {
  const [flights] = useState<DemoFlight[]>(DEMO_FLIGHTS)
  const [selId, setSelId] = useState<string>(DEMO_FLIGHTS[0].id)
  const [cache, setCache] = useState<Record<string, CacheEntry>>({})
  const [loading, setLoading] = useState(false)
  const [adsbState, setAdsbState] = useState<'idle' | 'fetching' | 'live' | 'offline'>('idle')
  const [lastAt, setLastAt] = useState<Date | null>(null)
  const [tick, setTick] = useState(0)

  const active = flights.find((f) => f.id === selId) || flights[0]
  const dep = active ? AIRPORTS[active.departure_airport] : null
  const arr = active ? AIRPORTS[active.arrival_airport] : null
  const data = cache[selId] || null

  const load = useCallback(async (flight: DemoFlight) => {
    if (!flight) return
    const d = AIRPORTS[flight.departure_airport]
    const a = AIRPORTS[flight.arrival_airport]
    if (!d || !a) return
    setLoading(true)

    // 1. Parallel weather fetch
    const [arrWx, depWx] = await Promise.all([fetchWeather(a.lat, a.lon), fetchWeather(d.lat, d.lon)])
    const wxScore = scoreWeather(arrWx)

    // 2. Live ADS-B — callsign first, then area scan fallback
    setAdsbState('fetching')
    let liveAc = await fetchAdsbCallsign(flight.flight_number)
    let nearbyCount = 0

    if (!liveAc) {
      // Area scan around midpoint
      const mid = { lat: (d.lat + a.lat) / 2, lon: (d.lon + a.lon) / 2 }
      const area = await fetchAdsbArea(mid.lat, mid.lon, 300)
      nearbyCount = area.length
      const prefix = flight.flight_number.replace(/\d+$/, '')
      liveAc = area.find((ac) => ((ac.flight as string) || '').trim().toUpperCase().startsWith(prefix)) || null
    } else {
      // Congestion scan near arrival
      const nearby = await fetchAdsbArea(a.lat, a.lon, 150)
      nearbyCount = nearby.length
    }

    setAdsbState(liveAc ? 'live' : 'offline')

    const alt = (liveAc?.alt_baro as number | undefined) ?? null
    const speed = (liveAc?.gs as number | undefined) ?? null
    const hdg = (liveAc?.track as number | undefined) ?? null
    const lat = (liveAc?.lat as number | undefined) ?? null
    const lon = (liveAc?.lon as number | undefined) ?? null

    const delay = calcDelay(alt, speed, wxScore, nearbyCount)
    const cong = congScore(nearbyCount)
    const delayMin = Math.round(delay * 0.7)
    const arrBase = new Date(`${flight.arrival_date}T${flight.arrival_time}:00`)
    const eta = new Date(arrBase.getTime() + delayMin * 60000)

    setCache((p) => ({
      ...p,
      [flight.id]: {
        arrWx,
        depWx,
        wxScore,
        cong,
        nearbyCount,
        delay,
        delayMin,
        eta,
        live: {
          alt,
          speed,
          hdg,
          lat,
          lon,
          callsign: ((liveAc?.flight as string | undefined) || '').trim() || null,
          hex: (liveAc?.hex as string | undefined) || null,
        },
      },
    }))
    setLastAt(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    if (active) load(active)
  }, [active, load, selId, tick])

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000)
    return () => clearInterval(t)
  }, [])

  const wx = data?.arrWx
  const dWx = data?.depWx
  const live = data?.live
  const { icon: wIcon, label: wLabel } = wxMeta(wx?.weather_code)
  const dist = dep && arr ? Math.round(haversine(dep.lat, dep.lon, arr.lat, arr.lon)) : null

  return (
    <div style={{ background: '#080e1c', minHeight: '100vh', color: '#e2e8f0', fontFamily: "'DM Mono','Fira Code',monospace", padding: '0 0 60px' }}>
      <style>{`
        *{box-sizing:border-box;margin:0;}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .pulse{animation:pulse 2s infinite}
        .fadeUp{animation:fadeUp 0.3s ease}
        button{background:none;border:none;font:inherit;cursor:pointer;color:inherit;}
        ::-webkit-scrollbar{height:3px;width:3px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px}
        a{color:#60a5fa;text-decoration:none;}a:hover{text-decoration:underline;}
      `}</style>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 20px' }}>

        {/* Header */}
        <div style={{ padding: '24px 0 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981' }} className="pulse" />
            <span style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: 1.6, fontWeight: 600 }}>Live Tracking</span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  color: adsbState === 'live' ? '#10b981' : adsbState === 'offline' ? '#f59e0b' : '#64748b',
                  background: adsbState === 'live' ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${adsbState === 'live' ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: 20,
                  padding: '3px 10px',
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: adsbState === 'live' ? '#10b981' : adsbState === 'fetching' ? '#f59e0b' : '#6b7280',
                    animation: adsbState === 'fetching' ? 'pulse 1s infinite' : undefined,
                  }}
                />
                {adsbState === 'live' ? 'ADS-B Live' : adsbState === 'fetching' ? 'Scanning…' : 'No ADS-B signal'}
              </span>
              {loading && <Spinner size={13} />}
              {lastAt && <span style={{ fontSize: 10, color: '#334155' }}>{lastAt.toLocaleTimeString()}</span>}
              <button
                onClick={() => setTick((n) => n + 1)}
                style={{
                  fontSize: 11,
                  color: '#475569',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 8,
                  padding: '3px 10px',
                  background: 'rgba(255,255,255,0.02)',
                }}
              >
                ↻ Refresh
              </button>
            </div>
          </div>
          <h1 style={{ fontSize: 23, fontWeight: 700, color: '#f8fafc', letterSpacing: -0.5 }}>Flight Tracker</h1>
          <p style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>
            Real-time ADS-B position · Open-Meteo weather · Live delay scoring — no external API keys needed
          </p>
        </div>

        {/* Flight cards */}
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8, marginBottom: 20 }}>
          {flights.map((f) => (
            <FlightCard key={f.id} flight={f} active={f.id === selId} onClick={() => setSelId(f.id)} />
          ))}
        </div>

        {active && (
          <div className="fadeUp" key={selId}>

            {/* Route */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20, marginBottom: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 13 }}>
                <div>
                  <div style={{ fontSize: 19, fontWeight: 700, color: '#f1f5f9' }}>
                    {active.flight_number}
                    <span style={{ fontSize: 12, color: '#64748b', fontWeight: 400, marginLeft: 10 }}>{active.airline_name}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                    {dep?.name || active.departure_airport} → {arr?.name || active.arrival_airport}
                    {dist && <span style={{ color: '#334155', marginLeft: 8 }}>· {dist.toLocaleString()} km</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  {live?.callsign && (
                    <span style={{ fontSize: 11, color: '#60a5fa', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.18)', borderRadius: 8, padding: '2px 8px' }}>
                      {live.callsign}
                    </span>
                  )}
                  {live?.hex && <span style={{ fontSize: 10, color: '#475569' }}>ICAO {live.hex.toUpperCase()}</span>}
                </div>
              </div>
              <RouteArc dep={dep} arr={arr} />
            </div>

            {/* Live position strip */}
            {live?.lat != null && live?.lon != null && (
              <div
                style={{
                  background: 'rgba(16,185,129,0.05)',
                  border: '1px solid rgba(16,185,129,0.14)',
                  borderRadius: 12,
                  padding: '11px 16px',
                  marginBottom: 13,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 18,
                  fontSize: 12,
                }}
              >
                <span style={{ color: '#10b981', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 }}>✈ Live ADS-B</span>
                <span style={{ color: '#94a3b8' }}>
                  <span style={{ color: '#64748b' }}>Position </span>
                  {live.lat.toFixed(4)}, {live.lon.toFixed(4)}
                </span>
                {live.alt != null && (
                  <span style={{ color: '#94a3b8' }}>
                    <span style={{ color: '#64748b' }}>Alt </span>
                    {live.alt.toLocaleString()} ft
                  </span>
                )}
                {live.speed != null && (
                  <span style={{ color: '#94a3b8' }}>
                    <span style={{ color: '#64748b' }}>GS </span>
                    {Math.round(live.speed)} kts
                  </span>
                )}
                {live.hdg != null && (
                  <span style={{ color: '#94a3b8' }}>
                    <span style={{ color: '#64748b' }}>HDG </span>
                    {Math.round(live.hdg)}°
                  </span>
                )}
              </div>
            )}

            {/* Tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(125px,1fr))', gap: 10, marginBottom: 13 }}>
              <Tile icon="⚡" label="Delay Risk" value={data ? `${data.delay}%` : '—'} sub={data ? rL(data.delay) : '…'} accent={data ? rC(data.delay) : '#64748b'} />
              <Tile icon="⏱" label="Est. Delay" value={data ? `+${data.delayMin}m` : '—'} sub={data ? `ETA ${data.eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '…'} />
              <Tile icon="🌦" label="Weather" value={data ? `${data.wxScore}/95` : '—'} sub={data ? `${wIcon} ${wLabel}` : '…'} />
              <Tile icon="🚦" label="Congestion" value={data ? `${data.cong}/35` : '—'} sub={data ? `${data.nearbyCount} aircraft nearby` : '…'} />
              <Tile icon="✈" label="Altitude" value={live?.alt != null ? `${(live.alt / 1000).toFixed(0)}k ft` : '—'} sub={live?.alt != null ? 'ADS-B live' : 'No signal'} />
              <Tile icon="💨" label="Speed" value={live?.speed != null ? `${Math.round(live.speed)} kts` : '—'} sub={live?.speed != null ? 'Ground speed' : 'No signal'} />
            </div>

            {/* Delay + Weather */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13, marginBottom: 13 }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20 }}>
                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.9, fontWeight: 600, marginBottom: 13 }}>Delay Probability</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                  <Gauge value={data?.delay ?? 0} />
                  <div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: data ? rC(data.delay) : '#64748b', fontVariantNumeric: 'tabular-nums' }}>{data?.delay ?? 0}%</div>
                    <div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>{data ? `${rL(data.delay)} risk` : 'Loading…'}</div>
                    {data && (
                      <div
                        style={{
                          marginTop: 8,
                          padding: '4px 10px',
                          borderRadius: 8,
                          background: rBg(data.delay),
                          border: `1px solid ${rC(data.delay)}28`,
                          fontSize: 11,
                          color: rC(data.delay),
                          display: 'inline-block',
                        }}
                      >
                        +{data.delayMin} min estimated
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Bar label="Weather impact" val={data?.wxScore ?? 0} max={95} color="#60a5fa" />
                  <Bar label="Airspace congestion" val={data?.cong ?? 0} max={35} color="#a78bfa" />
                  <Bar label="Overall delay score" val={data?.delay ?? 0} max={95} color={data ? rC(data.delay) : '#64748b'} />
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20 }}>
                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.9, fontWeight: 600, marginBottom: 13 }}>Weather · {arr?.city || active.arrival_airport}</div>
                {wx ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                      <span style={{ fontSize: 36 }}>{wIcon}</span>
                      <div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9' }}>{Math.round(wx.temperature_2m ?? 0)}°C</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{wLabel}</div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                      {[
                        { l: 'Wind', v: `${Math.round(wx.wind_speed_10m ?? 0)} km/h ${windDir(wx.wind_direction_10m ?? 0)}` },
                        { l: 'Gusts', v: `${Math.round(wx.wind_gusts_10m ?? 0)} km/h` },
                        { l: 'Precipitation', v: `${(wx.precipitation ?? 0).toFixed(1)} mm` },
                        { l: 'Cloud cover', v: `${Math.round(wx.cloud_cover ?? 0)}%` },
                        { l: 'Humidity', v: `${Math.round(wx.relative_humidity_2m ?? 0)}%` },
                        { l: 'Pressure', v: `${Math.round(wx.surface_pressure ?? 0)} hPa` },
                      ].map(({ l, v }) => (
                        <div key={l} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 9, padding: '9px 11px' }}>
                          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>{l}</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#475569', fontSize: 13 }}>
                    <Spinner />
                    Loading weather…
                  </div>
                )}
              </div>
            </div>

            {/* Departure weather */}
            {dWx && (
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20, marginBottom: 13 }}>
                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.9, fontWeight: 600, marginBottom: 12 }}>Weather · {dep?.city || active.departure_airport} (Departure)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {[
                    { l: 'Temp', v: `${Math.round(dWx.temperature_2m ?? 0)}°C` },
                    { l: 'Wind', v: `${Math.round(dWx.wind_speed_10m ?? 0)} km/h` },
                    { l: 'Gusts', v: `${Math.round(dWx.wind_gusts_10m ?? 0)} km/h` },
                    { l: 'Rain', v: `${(dWx.precipitation ?? 0).toFixed(1)} mm` },
                    { l: 'Cloud', v: `${Math.round(dWx.cloud_cover ?? 0)}%` },
                    { l: 'Conditions', v: `${wxMeta(dWx.weather_code).icon} ${wxMeta(dWx.weather_code).label}` },
                  ].map(({ l, v }) => (
                    <div key={l} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 9, padding: '9px 14px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>{l}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Booking details */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20, marginBottom: 13 }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.9, fontWeight: 600, marginBottom: 14 }}>Booking Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(155px,1fr))', gap: 14, fontSize: 13 }}>
                {[
                  { l: 'Flight', v: active.flight_number },
                  { l: 'Airline', v: active.airline_name || '—' },
                  { l: 'From', v: `${active.departure_airport} · ${active.departure_time}` },
                  { l: 'To', v: `${active.arrival_airport} · ${active.arrival_time}` },
                  { l: 'Date', v: active.departure_date },
                  { l: 'Seat', v: active.seat_number || '—' },
                  { l: 'PNR', v: active.booking_reference || '—' },
                  { l: 'Status', v: active.booking_status || '—' },
                  { l: 'Trip', v: active.trip_name || '—' },
                  {
                    l: 'ETA (w/ delay)',
                    v: data
                      ? data.eta.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : '—',
                  },
                ].map(({ l, v }) => (
                  <div key={l}>
                    <div style={{ color: '#475569', fontSize: 10, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{l}</div>
                    <div style={{ color: '#e2e8f0', fontWeight: 500 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '9px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)', fontSize: 10, color: '#334155', display: 'flex', flexWrap: 'wrap', gap: 14 }}>
              <span>📡 Position: <a href="https://adsb.lol" target="_blank" rel="noopener">adsb.lol</a> (no key required)</span>
              <span>🌤 Weather: <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a> (no key required)</span>
              <span>⏱ Auto-refreshes every 30s · {data?.nearbyCount ?? 0} aircraft in scan region</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

