'use client'

import 'leaflet/dist/leaflet.css'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-client'

type FlightRow = {
  id: string
  flight_number: string
  departure_airport: string
  arrival_airport: string
  departure_date: string
  departure_time: string
  arrival_date: string
  arrival_time: string
  serial_number?: number | null
  is_connecting_to_next?: boolean | null
}

type HotelRow = {
  id: string
  hotel_name: string
  address: string
  city?: string | null
  country?: string | null
  check_in_date: string
  check_in_time: string
  check_out_date: string
  check_out_time: string
  serial_number?: number | null
}

type BookingRow = {
  booking_type: 'flight' | 'hotel'
  booking_status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  flight_id?: string | null
  hotel_id?: string | null
  notes?: string | null
}

type GeoResult = {
  lat: number
  lon: number
  query: string
}

type MapPoint = {
  id: string
  type: 'airport' | 'hotel'
  lat: number
  lng: number
  label: string
  subtitle?: string
  details?: string
  bookingStatus?: string
}

type MapArc = {
  id: string
  startLat: number
  startLng: number
  endLat: number
  endLng: number
  label: string
  color: string
}

type LivePosition = {
  lat: number
  lon: number
  heading?: number | null
  speed?: number | null
  altitude?: number | null
  callsign?: string | null
}

type LiveMeta = {
  source?: string | null
  delayProbability?: number | null
  estimatedArrivalUtc?: string | null
}

const CACHE_PREFIX = 'geo_cache_v1_'

const readCache = (key: string) => {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`)
    if (!raw) return null
    return JSON.parse(raw) as GeoResult
  } catch (e) {
    return null
  }
}

const writeCache = (key: string, value: GeoResult) => {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(value))
  } catch (e) {
    // ignore cache writes
  }
}

const normalizeKey = (value: string) => value.trim().toLowerCase()

const buildAirportQueries = (code: string) => {
  const cleaned = code.trim().toUpperCase()
  if (!cleaned) return []
  return [
    `${cleaned} airport`,
    `${cleaned} international airport`,
    `airport ${cleaned}`,
    cleaned,
  ]
}

const buildHotelQuery = (hotel: HotelRow) => {
  const parts = [hotel.address, hotel.city, hotel.country]
    .map((p) => (p || '').trim())
    .filter(Boolean)
  return parts.join(', ')
}

async function geocodeWithCandidates(queries: string[]): Promise<GeoResult | null> {
  const normalized = queries.map(normalizeKey)
  for (let i = 0; i < queries.length; i += 1) {
    const cacheHit = readCache(normalized[i])
    if (cacheHit) return cacheHit
  }

  const resp = await fetch('/api/geocode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ queries }),
  })

  if (!resp.ok) return null
  const data = (await resp.json()) as GeoResult | { error?: string }
  if (!data || typeof (data as any).lat !== 'number') return null

  const result = data as GeoResult
  const normalizedKey = normalizeKey(result.query)
  writeCache(normalizedKey, result)
  return result
}

export default function TripMap({ tripId }: { tripId: string | null }) {
  const supabase = createClient()
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapInstance = useRef<any>(null)
  const layerGroupRef = useRef<any>(null)
  const leafletRef = useRef<any>(null)
  const [resolvedTripId, setResolvedTripId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [points, setPoints] = useState<MapPoint[]>([])
  const [arcs, setArcs] = useState<MapArc[]>([])
  const [liveFlightNumber, setLiveFlightNumber] = useState<string | null>(null)
  const [livePosition, setLivePosition] = useState<LivePosition | null>(null)
  const [liveError, setLiveError] = useState<string | null>(null)
  const [liveMeta, setLiveMeta] = useState<LiveMeta | null>(null)
  const [showAirports, setShowAirports] = useState(true)
  const [showHotels, setShowHotels] = useState(true)
  const [showArcs, setShowArcs] = useState(true)
  const [showLive, setShowLive] = useState(true)

  const resolveTripId = () => {
    const fromProp = typeof tripId === 'string' && tripId !== 'undefined' ? tripId : null
    if (fromProp) return fromProp
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('selectedTripId')
      if (stored && stored !== 'undefined') return stored
      const match = window.location.pathname.match(/\/flights\/graph\/([^\/\?]+)/)
      if (match?.[1] && match[1] !== 'undefined') return match[1]
    }
    return null
  }

  useEffect(() => {
    const sync = () => setResolvedTripId(resolveTripId())
    sync()
    window.addEventListener('storage', sync)
    window.addEventListener('focus', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('focus', sync)
    }
  }, [tripId])

  useEffect(() => {
    const currentTripId = resolvedTripId || resolveTripId()
    if (!currentTripId) return

    let active = true
    let timer: ReturnType<typeof setInterval> | null = null

    const poll = async () => {
      try {
        setLiveError(null)
        const resp = await fetch(`/api/flight-tracker/${encodeURIComponent(currentTripId)}`, {
          method: 'POST',
        })
        const data = await resp.json()
        if (!resp.ok) throw new Error(data?.error || 'Failed to load tracker data')
        if (!active) return
        setLiveFlightNumber(data?.flightNumber || null)
        setLivePosition(data?.position || null)
        setLiveMeta({
          source: data?.source || null,
          delayProbability: data?.delayProbability ?? null,
          estimatedArrivalUtc: data?.estimatedArrivalUtc || null,
        })
      } catch (err: any) {
        if (!active) return
        setLiveError(err?.message || 'Live tracker unavailable')
        setLivePosition(null)
        setLiveMeta(null)
      }
    }

    poll()
    timer = setInterval(poll, 15000)

    return () => {
      active = false
      if (timer) clearInterval(timer)
    }
  }, [resolvedTripId])

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return

    let active = true

    const init = async () => {
      const L = (await import('leaflet')).default

      if (!active) return

      const map = L.map(mapRef.current, {
        zoomControl: true,
        attributionControl: true,
        worldCopyJump: true,
      }).setView([20, 0], 2)

      // Esri satellite base
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          attribution: 'Esri World Imagery',
        }
      ).addTo(map)

      // Labels overlay
      L.tileLayer(
        'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 20,
          attribution: 'Place labels © Esri',
        }
      ).addTo(map)

      // Fix default marker icons
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const group = L.layerGroup().addTo(map)
      mapInstance.current = map
      layerGroupRef.current = group
      leafletRef.current = L
    }

    init()

    return () => {
      active = false
      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
      }
    }
  }, [])

  useEffect(() => {
    const currentTripId = resolvedTripId || resolveTripId()
    if (!currentTripId) return

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data: flights } = await supabase
          .from('trip_flights')
          .select('*')
          .eq('trip_id', currentTripId)
          .order('departure_date', { ascending: true })

        const { data: hotels } = await supabase
          .from('trip_hotels')
          .select('*')
          .eq('trip_id', currentTripId)
          .order('check_in_date', { ascending: true })

        const { data: bookings } = await supabase
          .from('bookings')
          .select('booking_type, booking_status, flight_id, hotel_id, notes')
          .eq('trip_id', currentTripId)

        const flightRows = (flights || []) as FlightRow[]
        const hotelRows = (hotels || []) as HotelRow[]
        const bookingRows = (bookings || []) as BookingRow[]

        const bookingByFlight = new Map<string, BookingRow>()
        const bookingByHotel = new Map<string, BookingRow>()
        bookingRows.forEach((b) => {
          if (b.flight_id) bookingByFlight.set(b.flight_id, b)
          if (b.hotel_id) bookingByHotel.set(b.hotel_id, b)
        })

        const airportCodes = new Set<string>()
        flightRows.forEach((f) => {
          if (f.departure_airport) airportCodes.add(f.departure_airport)
          if (f.arrival_airport) airportCodes.add(f.arrival_airport)
        })

        const airportLocations = new Map<string, GeoResult>()
        for (const code of airportCodes) {
          const candidates = buildAirportQueries(code)
          if (!candidates.length) continue
          const result = await geocodeWithCandidates(candidates)
          if (result) airportLocations.set(code, result)
        }

        const hotelLocations = new Map<string, GeoResult>()
        for (const hotel of hotelRows) {
          const query = buildHotelQuery(hotel)
          if (!query) continue
          const result = await geocodeWithCandidates([query])
          if (result) hotelLocations.set(hotel.id, result)
        }

        const nextPoints: MapPoint[] = []
        airportLocations.forEach((value, code) => {
          nextPoints.push({
            id: `airport_${code}`,
            type: 'airport',
            lat: value.lat,
            lng: value.lon,
            label: code.toUpperCase(),
            subtitle: 'Airport',
          })
        })

        hotelRows.forEach((hotel) => {
          const loc = hotelLocations.get(hotel.id)
          if (!loc) return
          const booking = bookingByHotel.get(hotel.id)
          nextPoints.push({
            id: hotel.id,
            type: 'hotel',
            lat: loc.lat,
            lng: loc.lon,
            label: hotel.hotel_name,
            subtitle: [hotel.city, hotel.country].filter(Boolean).join(', '),
            details: `${hotel.check_in_date} ${hotel.check_in_time} - ${hotel.check_out_date} ${hotel.check_out_time}`,
            bookingStatus: booking?.booking_status,
          })
        })

        const nextArcs: MapArc[] = []
        flightRows.forEach((flight) => {
          const from = airportLocations.get(flight.departure_airport)
          const to = airportLocations.get(flight.arrival_airport)
          if (!from || !to) return
          const booking = bookingByFlight.get(flight.id)
          const status = booking?.booking_status ? ` (${booking.booking_status})` : ''
          nextArcs.push({
            id: flight.id,
            startLat: from.lat,
            startLng: from.lon,
            endLat: to.lat,
            endLng: to.lon,
            label: `${flight.flight_number}: ${flight.departure_airport} to ${flight.arrival_airport}${status}`,
            color: flight.is_connecting_to_next ? '#34d399' : '#60a5fa',
          })
        })

        setPoints(nextPoints)
        setArcs(nextArcs)
      } catch (err: any) {
        setError(err?.message || 'Failed to load map data')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [resolvedTripId])

  const bounds = useMemo(() => {
    if (!points.length) return null
    const latLngs = points.map((p) => [p.lat, p.lng] as [number, number])
    return latLngs
  }, [points])

  useEffect(() => {
    const map = mapInstance.current
    const layerGroup = layerGroupRef.current
    const L = leafletRef.current
    if (!map || !layerGroup || !L) return

    layerGroup.clearLayers()

    if (showArcs) {
      arcs.forEach((arc) => {
      const line = L.polyline(
        [
          [arc.startLat, arc.startLng],
          [arc.endLat, arc.endLng],
        ],
        {
          color: arc.color,
          weight: 2.2,
          opacity: 0.85,
        }
      )
      line.bindTooltip(arc.label, { direction: 'top', sticky: true })
        line.addTo(layerGroup)
      })
    }

    points.forEach((point) => {
      if ((point.type === 'airport' && !showAirports) || (point.type === 'hotel' && !showHotels)) return
      const color = point.type === 'hotel' ? '#f97316' : '#38bdf8'
      const marker = L.circleMarker([point.lat, point.lng], {
        radius: point.type === 'hotel' ? 6 : 5,
        color,
        weight: 2,
        fillOpacity: 0.9,
      })

      const detailBits = [point.subtitle, point.details]
        .filter(Boolean)
        .join('<br />')
      const booking = point.bookingStatus ? `<br />Status: ${point.bookingStatus}` : ''
      const tooltipHtml = `
        <div style="font-size:12px;">
          <div style="font-weight:600;">${point.label}</div>
          ${detailBits ? `<div style="opacity:0.85; margin-top:3px;">${detailBits}</div>` : ''}
          ${booking}
        </div>
      `

      marker.bindTooltip(tooltipHtml, { direction: 'top', sticky: true })
      marker.addTo(layerGroup)
    })

    if (livePosition && showLive) {
      const heading = livePosition.heading ?? 0
      const iconHtml = `
        <div style="
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(8, 47, 73, 0.7);
          border: 1px solid rgba(34, 211, 238, 0.6);
          border-radius: 50%;
          box-shadow: 0 0 12px rgba(34, 211, 238, 0.35);
          transform: rotate(${heading}deg);
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 12L22 5L18 12L22 19L2 12Z" fill="#22d3ee" />
            <path d="M9 12L14 14" stroke="#0f172a" stroke-width="1.2" stroke-linecap="round" />
          </svg>
        </div>
      `
      const planeIcon = L.divIcon({
        html: iconHtml,
        className: '',
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      })
      const liveMarker = L.marker([livePosition.lat, livePosition.lon], { icon: planeIcon })
      const liveDetails = [
        liveFlightNumber ? `Flight: ${liveFlightNumber}` : null,
        livePosition.heading != null ? `Heading: ${Math.round(livePosition.heading)}°` : null,
        livePosition.speed != null ? `Speed: ${Math.round(livePosition.speed)} kt` : null,
        livePosition.altitude != null ? `Alt: ${Math.round(livePosition.altitude)} ft` : null,
      ]
        .filter(Boolean)
        .join('<br />')
      liveMarker.bindTooltip(
        `<div style="font-size:12px;"><div style="font-weight:600;">Live Track</div>${liveDetails ? `<div style="opacity:0.85; margin-top:3px;">${liveDetails}</div>` : ''}</div>`,
        { direction: 'top', sticky: true }
      )
      liveMarker.addTo(layerGroup)
    }

    if (bounds && bounds.length > 0) {
      const latLngBounds = L.latLngBounds(bounds)
      map.fitBounds(latLngBounds, { padding: [40, 40] })
    }
  }, [points, arcs, bounds, livePosition, liveFlightNumber])

  if (!resolvedTripId && !tripId) {
    return (
      <div className="rounded border border-border bg-card p-6 text-sm text-muted-foreground">
        Select a trip to load the map view.
      </div>
    )
  }

  return (
    <div className="rounded border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Flight Routes</h3>
          <p className="text-xs text-muted-foreground">
            Satellite map with labels, airports, hotels, and flight routes
          </p>
        </div>
        <div className="text-xs text-muted-foreground text-right">
          <div>{loading ? 'Loading locations...' : `${points.length} points, ${arcs.length} routes`}</div>
          <div>
            {liveError
              ? `Live tracking: ${liveError}`
              : liveFlightNumber
                ? `Live tracking: ${liveFlightNumber}${liveMeta?.source ? ` (${liveMeta.source})` : ''}`
                : 'Live tracking: idle'}
          </div>
          {liveMeta?.delayProbability != null && liveMeta?.estimatedArrivalUtc && (
            <div>
              Delay risk: {Math.round(liveMeta.delayProbability)}% • ETA (UTC):{' '}
              {new Date(liveMeta.estimatedArrivalUtc).toISOString().slice(0, 16).replace('T', ' ')}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="border-b border-border bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="relative h-[70vh] min-h-130 bg-black">
        <div className="absolute right-4 top-4 z-40 flex flex-col gap-2 rounded bg-card/80 border border-border p-2 backdrop-blur">
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={showAirports} onChange={(e) => setShowAirports(e.target.checked)} />
            Airports
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={showHotels} onChange={(e) => setShowHotels(e.target.checked)} />
            Hotels
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={showArcs} onChange={(e) => setShowArcs(e.target.checked)} />
            Routes
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={showLive} onChange={(e) => setShowLive(e.target.checked)} />
            Live
          </label>
        </div>
        <div ref={mapRef} className="absolute inset-0" />
      </div>
    </div>
  )
}
