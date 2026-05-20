'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase-client'

const Globe = dynamic(async () => (await import('react-globe.gl')).default, {
  ssr: false,
})

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

type EventLinkRow = {
  id: string
  from_type: 'flight' | 'hotel'
  from_id: string
  to_type: 'flight' | 'hotel'
  to_id: string
}

type GeoResult = {
  lat: number
  lon: number
  query: string
}

type GlobePoint = {
  id: string
  type: 'airport' | 'hotel'
  lat: number
  lng: number
  label: string
  subtitle?: string
  details?: string
  bookingStatus?: string
}

type GlobeArc = {
  id: string
  startLat: number
  startLng: number
  endLat: number
  endLng: number
  label: string
  color: string
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

export default function TripGlobe({ tripId }: { tripId: string | null }) {
  const supabase = createClient()
  const globeRef = useRef<any>(null)
  const [resolvedTripId, setResolvedTripId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [points, setPoints] = useState<GlobePoint[]>([])
  const [arcs, setArcs] = useState<GlobeArc[]>([])
  const [selected, setSelected] = useState<GlobePoint | null>(null)

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

    const load = async () => {
      setLoading(true)
      setError(null)
      setSelected(null)
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

        const { data: eventLinks } = await supabase
          .from('trip_event_links')
          .select('*')
          .eq('trip_id', currentTripId)

        const flightRows = (flights || []) as FlightRow[]
        const hotelRows = (hotels || []) as HotelRow[]
        const bookingRows = (bookings || []) as BookingRow[]
        const linkRows = (eventLinks || []) as EventLinkRow[]

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

        const nextPoints: GlobePoint[] = []
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

        const nextArcs: GlobeArc[] = []
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

        const flightById = new Map(flightRows.map((flight) => [flight.id, flight]))
        const hotelById = new Map(hotelRows.map((hotel) => [hotel.id, hotel]))

        const resolveLinkPoint = (
          linkType: 'flight' | 'hotel',
          id: string,
          role: 'from' | 'to'
        ): { lat: number; lng: number; label: string } | null => {
          if (linkType === 'hotel') {
            const hotel = hotelById.get(id)
            const loc = hotel ? hotelLocations.get(hotel.id) : null
            if (!hotel || !loc) return null
            return {
              lat: loc.lat,
              lng: loc.lon,
              label: hotel.hotel_name,
            }
          }

          const flight = flightById.get(id)
          if (!flight) return null
          const airportCode = role === 'from' ? flight.arrival_airport : flight.departure_airport
          const loc = airportLocations.get(airportCode)
          if (!loc) return null
          return {
            lat: loc.lat,
            lng: loc.lon,
            label: airportCode,
          }
        }

        linkRows.forEach((link) => {
          const from = resolveLinkPoint(link.from_type, link.from_id, 'from')
          const to = resolveLinkPoint(link.to_type, link.to_id, 'to')
          if (!from || !to) return
          nextArcs.push({
            id: `link_${link.id}`,
            startLat: from.lat,
            startLng: from.lng,
            endLat: to.lat,
            endLng: to.lng,
            label: `Link: ${from.label} to ${to.label}`,
            color: '#fbbf24',
          })
        })

        setPoints(nextPoints)
        setArcs(nextArcs)

        if (globeRef.current && nextPoints.length > 0) {
          const first = nextPoints[0]
          globeRef.current.pointOfView({ lat: first.lat, lng: first.lng, altitude: 2.2 }, 1200)
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load globe data')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [resolvedTripId])

  const pointLabel = useMemo(() => {
    return (point: GlobePoint) => {
      const status = point.bookingStatus ? `Status: ${point.bookingStatus}` : null
      const details = [point.subtitle, point.details, status].filter(Boolean).join('<br />')
      return `
        <div style="padding:6px 8px; font-size:12px; max-width:220px;">
          <div style="font-weight:600; margin-bottom:4px;">${point.label}</div>
          <div style="opacity:0.85;">${details}</div>
        </div>
      `
    }
  }, [])

  const arcLabel = useMemo(() => {
    return (arc: GlobeArc) => {
      return `
        <div style="padding:6px 8px; font-size:12px; max-width:240px;">
          <div style="font-weight:600;">${arc.label}</div>
        </div>
      `
    }
  }, [])

  if (!resolvedTripId && !tripId) {
    return (
      <div className="rounded border border-border bg-card p-6 text-sm text-muted-foreground">
        Select a trip to load the globe view.
      </div>
    )
  }

  return (
    <div className="rounded border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Trip Globe</h3>
          <p className="text-xs text-muted-foreground">
            Airports, hotels, and flight paths plotted on a live globe
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          {loading ? 'Loading locations...' : `${points.length} points, ${arcs.length} routes`}
        </div>
      </div>

      {error && (
        <div className="border-b border-border bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="relative h-[70vh] min-h-[520px] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <Globe
          ref={globeRef}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl="https://unpkg.com/three-globe/example/img/earth-night.jpg"
          bumpImageUrl="https://unpkg.com/three-globe/example/img/earth-topology.png"
          pointsData={points}
          pointLat="lat"
          pointLng="lng"
          pointColor={(p: GlobePoint) => (p.type === 'hotel' ? '#f97316' : '#38bdf8')}
          pointAltitude={0.015}
          pointRadius={0.18}
          pointLabel={pointLabel}
          onPointClick={(p: GlobePoint) => setSelected(p)}
          arcsData={arcs}
          arcStartLat="startLat"
          arcStartLng="startLng"
          arcEndLat="endLat"
          arcEndLng="endLng"
          arcColor={(a: GlobeArc) => a.color}
          arcAltitude={0.28}
          arcStroke={1.2}
          arcDashLength={0.42}
          arcDashGap={0.14}
          arcDashAnimateTime={2200}
          arcLabel={arcLabel}
        />

        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

        {selected && (
          <div className="absolute right-4 top-4 z-10 w-72 rounded-lg border border-white/10 bg-black/70 p-3 text-xs text-white/90 shadow">
            <div className="text-sm font-semibold text-white">{selected.label}</div>
            {selected.subtitle && <div className="mt-1 text-white/70">{selected.subtitle}</div>}
            {selected.details && <div className="mt-1 text-white/70">{selected.details}</div>}
            {selected.bookingStatus && (
              <div className="mt-2 inline-flex rounded-full bg-white/10 px-2 py-0.5 text-[11px]">
                {selected.bookingStatus}
              </div>
            )}
            <button
              onClick={() => setSelected(null)}
              className="mt-3 rounded bg-white/10 px-2 py-1 text-[11px] text-white/80 hover:bg-white/20"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
