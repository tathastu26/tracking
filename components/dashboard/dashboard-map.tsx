'use client'

import 'leaflet/dist/leaflet.css'

import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { createClient } from '@/lib/supabase-client'

type AircraftData = {
  flight?: string
  lat: number
  lon: number
  alt_baro?: number
  gs?: number
  track?: number
  t?: string
}

type WeatherImpact = {
  score: number | null
  label: string
}

type Congestion = {
  count: number | null
  level: string
}

type AirportMeta = {
  name: string
  city: string
  lat: number
  lon: number
}

type BookedFlight = {
  bookingId: string
  tripId: string
  tripName: string | null
  flightId: string
  flightNumber: string
  departureAirport: string
  arrivalAirport: string
  departureDate: string
  departureTime: string
  arrivalDate: string
  arrivalTime: string
  airlineName: string | null
  seatNumber: string | null
  bookingReference: string | null
  bookingStatus: string | null
  cost: number | null
  currency: string | null
  notes: string | null
  serialNumber: number | null
  isConnectingToNext: boolean | null
}

type LiveFlightSnapshot = {
  tripId: string
  tripName: string | null
  flightId: string
  flightNumber: string
  departureAirport: string
  arrivalAirport: string
  airlineName: string | null
  seatNumber: string | null
  bookingReference: string | null
  source: string
  position: {
    lat: number
    lon: number
    heading?: number | null
    speed?: number | null
    altitude?: number | null
    callsign?: string | null
    hex?: string | null
  }
  weather: Record<string, unknown> | null
  weatherScore: number
  congestionScore: number
  airTrafficScore: number
  delayProbability: number
  estimatedArrivalUtc: string | null
}

type FlightTrackerSnapshot = {
  tripId: string
  tripName: string | null
  flightId: string
  flightNumber: string
  departureAirport: string
  arrivalAirport: string
  airlineName: string | null
  seatNumber: string | null
  bookingReference: string | null
  source: string
  position: {
    lat: number
    lon: number
    heading?: number | null
    speed?: number | null
    altitude?: number | null
    callsign?: string | null
    hex?: string | null
  }
  weather: Record<string, unknown> | null
  weatherScore: number
  congestionScore: number
  airTrafficScore: number
  delayProbability: number
  estimatedArrivalUtc: string | null
}

const AIRPORT_COORDS: Record<string, AirportMeta> = {
  DXB: { name: 'Dubai International', city: 'Dubai', lat: 25.2532, lon: 55.3657 },
  LAX: { name: 'Los Angeles International', city: 'Los Angeles', lat: 33.9416, lon: -118.4085 },
  JFK: { name: 'John F. Kennedy International', city: 'New York', lat: 40.6413, lon: -73.7781 },
  ORD: { name: "Chicago O'Hare International", city: 'Chicago', lat: 41.9742, lon: -87.9073 },
  LHR: { name: 'London Heathrow', city: 'London', lat: 51.47, lon: -0.4543 },
  CDG: { name: 'Charles de Gaulle', city: 'Paris', lat: 49.0097, lon: 2.5479 },
  AMS: { name: 'Amsterdam Schiphol', city: 'Amsterdam', lat: 52.3105, lon: 4.7683 },
  FRA: { name: 'Frankfurt Airport', city: 'Frankfurt', lat: 50.0379, lon: 8.5622 },
  HND: { name: 'Haneda Airport', city: 'Tokyo', lat: 35.5494, lon: 139.7798 },
  NRT: { name: 'Narita International', city: 'Tokyo', lat: 35.7767, lon: 140.3188 },
  SIN: { name: 'Changi Airport', city: 'Singapore', lat: 1.3644, lon: 103.9915 },
  SFO: { name: 'San Francisco International', city: 'San Francisco', lat: 37.6213, lon: -122.379 },
  SEA: { name: 'Seattle-Tacoma International', city: 'Seattle', lat: 47.4502, lon: -122.3088 },
  BOS: { name: 'Logan International', city: 'Boston', lat: 42.3656, lon: -71.0096 },
  ATL: { name: 'Hartsfield-Jackson Atlanta', city: 'Atlanta', lat: 33.6407, lon: -84.4277 },
  DOH: { name: 'Hamad International', city: 'Doha', lat: 25.2736, lon: 51.6081 },
  DEL: { name: 'Indira Gandhi International', city: 'Delhi', lat: 28.5562, lon: 77.1 },
  BOM: { name: 'Chhatrapati Shivaji International', city: 'Mumbai', lat: 19.0896, lon: 72.8656 },
  BLR: { name: 'Kempegowda International', city: 'Bengaluru', lat: 13.1986, lon: 77.7066 },
  MAA: { name: 'Chennai International', city: 'Chennai', lat: 12.9941, lon: 80.1709 },
  HYD: { name: 'Rajiv Gandhi International', city: 'Hyderabad', lat: 17.2403, lon: 78.4294 },
  CCU: { name: 'Netaji Subhas Chandra Bose International', city: 'Kolkata', lat: 22.6547, lon: 88.4467 },
  AMD: { name: 'Sardar Vallabhbhai Patel International', city: 'Ahmedabad', lat: 23.0772, lon: 72.6347 },
  PNQ: { name: 'Pune International', city: 'Pune', lat: 18.5822, lon: 73.9197 },
  COK: { name: 'Cochin International', city: 'Kochi', lat: 10.152, lon: 76.4019 },
}

const airportMeta = (code?: string | null) => {
  if (!code) return null
  return AIRPORT_COORDS[code.trim().toUpperCase()] ?? null
}

export function DashboardMap() {
  const supabase = useMemo(() => createClient(), [])
  const [liveFlightQuery, setLiveFlightQuery] = useState('AIC302')
  const [liveFlightInput, setLiveFlightInput] = useState('AIC302')
  const [liveAircraft, setLiveAircraft] = useState<AircraftData | null>(null)
  const [liveWeatherImpact, setLiveWeatherImpact] = useState<WeatherImpact | null>(null)
  const [liveCongestion, setLiveCongestion] = useState<Congestion | null>(null)
  const [liveDelayMinutes, setLiveDelayMinutes] = useState<number | null>(null)
  const [liveLoading, setLiveLoading] = useState(false)
  const [liveError, setLiveError] = useState('')
  const [liveDelayBreakdown, setLiveDelayBreakdown] = useState<{
    baseMinutes: number
    weatherMinutes: number
    congestionMinutes: number
    totalMinutes: number
  } | null>(null)

  const [bookingSearchQuery, setBookingSearchQuery] = useState('')
  const [bookedFlights, setBookedFlights] = useState<BookedFlight[]>([])
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
  const [bookingsLoading, setBookingsLoading] = useState(true)
  const [bookingsError, setBookingsError] = useState('')
  const [snapshot, setSnapshot] = useState<FlightTrackerSnapshot | null>(null)
  const [snapshotLoading, setSnapshotLoading] = useState(false)
  const [snapshotError, setSnapshotError] = useState('')
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapInstance = useRef<L.Map | null>(null)
  const planeMarker = useRef<L.Marker | null>(null)
  const routeLayer = useRef<L.LayerGroup | null>(null)
  const mode = 'both'

  const filteredFlights = useMemo(() => {
    const query = bookingSearchQuery.trim().toLowerCase()
    if (!query) return bookedFlights

    return bookedFlights.filter((flight) => {
      const haystack = [
        flight.flightNumber,
        flight.tripName,
        flight.departureAirport,
        flight.arrivalAirport,
        flight.airlineName,
        flight.seatNumber,
        flight.bookingReference,
        flight.notes,
        flight.bookingStatus,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [bookedFlights, bookingSearchQuery])

  const selectedBooking = useMemo(
    () => bookedFlights.find((flight) => flight.bookingId === selectedBookingId) || null,
    [bookedFlights, selectedBookingId]
  )

  const selectedFlight = selectedBooking || filteredFlights[0] || null

  useEffect(() => {
    let active = true

    const loadBookedFlights = async () => {
      try {
        setBookingsLoading(true)
        setBookingsError('')

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser()

        if (authError) {
          throw authError
        }

        if (!user) {
          if (!active) return
          setBookedFlights([])
          setSelectedBookingId(null)
          setBookingsError('Sign in to view booked flights.')
          return
        }

        const { data: bookingRows, error: bookingError } = await supabase
          .from('bookings')
          .select('id, trip_id, flight_id, booking_status, cost, currency, notes, created_at')
          .eq('profile_id', user.id)
          .eq('booking_type', 'flight')
          .order('created_at', { ascending: false })

        if (bookingError) {
          throw bookingError
        }

        const flightIds = Array.from(
          new Set((bookingRows || []).map((booking) => booking.flight_id).filter(Boolean))
        ) as string[]
        const tripIds = Array.from(
          new Set((bookingRows || []).map((booking) => booking.trip_id).filter(Boolean))
        ) as string[]

        const [{ data: flightRows, error: flightsError }, { data: tripRows, error: tripsError }] =
          await Promise.all([
            flightIds.length
              ? supabase
                  .from('trip_flights')
                  .select(
                    'id, trip_id, flight_number, departure_airport, arrival_airport, departure_date, departure_time, arrival_date, arrival_time, airline_name, seat_number, booking_reference, serial_number, is_connecting_to_next'
                  )
                  .in('id', flightIds)
              : Promise.resolve({ data: [], error: null }),
            tripIds.length
              ? supabase.from('trips').select('id, trip_name').in('id', tripIds)
              : Promise.resolve({ data: [], error: null }),
          ])

        if (flightsError) {
          throw flightsError
        }

        if (tripsError) {
          throw tripsError
        }

        const flightById = new Map<string, (typeof flightRows)[number]>()
        ;(flightRows || []).forEach((flight) => {
          flightById.set(flight.id, flight)
        })

        const tripById = new Map<string, (typeof tripRows)[number]>()
        ;(tripRows || []).forEach((trip) => {
          tripById.set(trip.id, trip)
        })

        const nextFlights: BookedFlight[] = (bookingRows || [])
          .map((booking) => {
            if (!booking.flight_id) return null
            const flight = flightById.get(booking.flight_id)
            if (!flight) return null
            const trip = tripById.get(booking.trip_id)

            return {
              bookingId: booking.id,
              tripId: booking.trip_id,
              tripName: trip?.trip_name ?? null,
              flightId: booking.flight_id,
              flightNumber: flight.flight_number,
              departureAirport: flight.departure_airport,
              arrivalAirport: flight.arrival_airport,
              departureDate: flight.departure_date,
              departureTime: flight.departure_time,
              arrivalDate: flight.arrival_date,
              arrivalTime: flight.arrival_time,
              airlineName: flight.airline_name ?? null,
              seatNumber: flight.seat_number ?? null,
              bookingReference: flight.booking_reference ?? null,
              bookingStatus: booking.booking_status ?? null,
              cost: typeof booking.cost === 'number' ? booking.cost : booking.cost ? Number(booking.cost) : null,
              currency: booking.currency ?? null,
              notes: booking.notes ?? null,
              serialNumber: flight.serial_number ?? null,
              isConnectingToNext: flight.is_connecting_to_next ?? null,
            }
          })
          .filter(Boolean) as BookedFlight[]

        if (!active) return

        setBookedFlights(nextFlights)

        setSelectedBookingId((current) => {
          if (current && nextFlights.some((flight) => flight.bookingId === current)) {
            return current
          }
          return nextFlights[0]?.bookingId ?? null
        })

        if (nextFlights.length === 0) {
          setBookingsError('No booked flights found for this account.')
        }
      } catch (error) {
        if (!active) return
        console.error('Error fetching booked flights:', error)
        setBookingsError('Failed to fetch booked flights from Supabase.')
        setBookedFlights([])
        setSelectedBookingId(null)
      } finally {
        if (active) {
          setBookingsLoading(false)
        }
      }
    }

    loadBookedFlights()
    const interval = window.setInterval(loadBookedFlights, 60_000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [supabase])

  async function fetchLiveFlight(nextFlight = liveFlightQuery) {
    try {
      setLiveLoading(true)
      setLiveError('')

      const response = await fetch(`/api/adsb?flight=${encodeURIComponent(nextFlight)}`, {
        cache: 'no-store',
      })

      const data = await response.json()

      if (!data?.ac?.length) {
        setLiveError('Flight not found')
        setLiveAircraft(null)
        setLiveWeatherImpact(null)
        setLiveCongestion(null)
        setLiveDelayMinutes(null)
        setLiveDelayBreakdown(null)
        return
      }

      setLiveAircraft(data.ac[0])
      setLiveWeatherImpact(data.weatherImpact || null)
      setLiveCongestion(data.congestion || null)
      setLiveDelayBreakdown(data.delayBreakdown || null)
      setLiveDelayMinutes(typeof data.delayMinutes === 'number' ? data.delayMinutes : null)
    } catch (error) {
      console.error(error)
      setLiveError('Failed to fetch flight')
      setLiveWeatherImpact(null)
      setLiveCongestion(null)
      setLiveDelayBreakdown(null)
      setLiveDelayMinutes(null)
      setLiveAircraft(null)
    } finally {
      setLiveLoading(false)
    }
  }

  useEffect(() => {
    fetchLiveFlight(liveFlightQuery)
    const interval = window.setInterval(() => fetchLiveFlight(liveFlightQuery), 10000)
    return () => window.clearInterval(interval)
  }, [liveFlightQuery])

  useEffect(() => {
    const booking = selectedBooking
    if (!booking || !booking.tripId || !booking.flightId) {
      setSnapshot(null)
      setSnapshotError('')
      return
    }

    let active = true

    setSnapshot(null)

    const loadSnapshot = async () => {
      try {
        setSnapshotLoading(true)
        setSnapshotError('')

        const response = await fetch(`/api/flight-tracker/${encodeURIComponent(booking.tripId)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ flightId: booking.flightId }),
        })

        const data = (await response.json()) as FlightTrackerSnapshot | { error?: string }

        if (!response.ok) {
          throw new Error((data as { error?: string }).error || 'Failed to load flight snapshot')
        }

        if (!active) return
        setSnapshot(data as FlightTrackerSnapshot)
      } catch (error) {
        if (!active) return
        console.error('Error loading flight snapshot:', error)
        setSnapshot(null)
        setSnapshotError(error instanceof Error ? error.message : 'Failed to load flight snapshot')
      } finally {
        if (active) {
          setSnapshotLoading(false)
        }
      }
    }

    loadSnapshot()
    const interval = window.setInterval(loadSnapshot, 15_000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [selectedBooking])

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return

    const map = L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: true,
      worldCopyJump: true,
    }).setView([20, 0], 2)

    routeLayer.current = L.layerGroup().addTo(map)

    const osmUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    const cartoUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'

    const layer = L.tileLayer(osmUrl, {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    layer.on('tileerror', () => {
      try {
        if (map.hasLayer(layer)) map.removeLayer(layer)
        L.tileLayer(cartoUrl, {
          attribution: '© OpenStreetMap contributors / Carto',
          maxZoom: 19,
        }).addTo(map)
      } catch {
        // ignore
      }
    })

    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    })

    mapInstance.current = map
    let mapActive = true

    const invalidateMap = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!mapActive || mapInstance.current !== map) return
          map.invalidateSize()
        })
      })
    }

    invalidateMap()

    const resizeObserver = new ResizeObserver(() => {
      invalidateMap()
    })

    resizeObserver.observe(mapRef.current)
    window.addEventListener('resize', invalidateMap)

    return () => {
      mapActive = false
      resizeObserver.disconnect()
      window.removeEventListener('resize', invalidateMap)
      map.remove()
      mapInstance.current = null
      planeMarker.current = null
      routeLayer.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapInstance.current
    if (!map) return

    const layer = routeLayer.current
    if (layer) {
      layer.clearLayers()
    }

    const routeFrom = airportMeta(snapshot?.departureAirport || selectedFlight?.departureAirport)
    const routeTo = airportMeta(snapshot?.arrivalAirport || selectedFlight?.arrivalAirport)

    const routePoints: L.LatLngExpression[] = []

    if (routeFrom && routeTo && layer) {
      routePoints.push([routeFrom.lat, routeFrom.lon], [routeTo.lat, routeTo.lon])

      const routeLine = L.polyline(
        [
          [routeFrom.lat, routeFrom.lon],
          [routeTo.lat, routeTo.lon],
        ],
        {
          color: '#38bdf8',
          weight: 3,
          opacity: 0.9,
          dashArray: '8 8',
        }
      )

      const takeoffIcon = L.divIcon({
        className: '',
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        html: `
          <div style="width:34px;height:34px;display:flex;align-items:center;justify-content:center;border-radius:999px;background:rgba(15,23,42,0.96);border:1px solid rgba(56,189,248,0.85);box-shadow:0 0 14px rgba(56,189,248,0.35);">
            <span style="font-size:16px;line-height:1;color:#38bdf8;transform:rotate(-45deg);display:inline-block;">🛫</span>
          </div>
        `,
      })

      const landingIcon = L.divIcon({
        className: '',
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        html: `
          <div style="width:34px;height:34px;display:flex;align-items:center;justify-content:center;border-radius:999px;background:rgba(15,23,42,0.96);border:1px solid rgba(251,146,60,0.85);box-shadow:0 0 14px rgba(251,146,60,0.35);">
            <span style="font-size:16px;line-height:1;color:#fb923c;display:inline-block;">🛬</span>
          </div>
        `,
      })

      const takeoffMarker = L.marker([routeFrom.lat, routeFrom.lon], { icon: takeoffIcon })
      const landingMarker = L.marker([routeTo.lat, routeTo.lon], { icon: landingIcon })

      takeoffMarker.bindTooltip(
        `<div style="font-size:12px;"><div style="font-weight:600;">Takeoff</div><div>${routeFrom.city} · ${routeFrom.name}</div><div style="opacity:0.8; margin-top:2px;">${selectedFlight?.departureAirport || snapshot?.departureAirport}</div></div>`,
        { direction: 'top', sticky: true }
      )

      landingMarker.bindTooltip(
        `<div style="font-size:12px;"><div style="font-weight:600;">Landing</div><div>${routeTo.city} · ${routeTo.name}</div><div style="opacity:0.8; margin-top:2px;">${selectedFlight?.arrivalAirport || snapshot?.arrivalAirport}</div></div>`,
        { direction: 'top', sticky: true }
      )

      routeLine.bindTooltip(
        `${selectedFlight?.flightNumber || snapshot?.flightNumber || 'Flight'}: ${selectedFlight?.departureAirport || snapshot?.departureAirport} → ${selectedFlight?.arrivalAirport || snapshot?.arrivalAirport}`,
        { sticky: true }
      )

      routeLine.addTo(layer)
      takeoffMarker.addTo(layer)
      landingMarker.addTo(layer)
    }

    const livePosition = liveAircraft
      ? {
          lat: liveAircraft.lat,
          lon: liveAircraft.lon,
          heading: liveAircraft.track ?? null,
        }
      : null

    const bookingPosition = snapshot?.position

    const activePosition = bookingPosition || livePosition

    if (!activePosition) {
      if (planeMarker.current) {
        planeMarker.current.remove()
        planeMarker.current = null
      }
      if (routePoints.length > 0 && routeLayer.current) {
        const bounds = L.latLngBounds(routePoints)
        map.fitBounds(bounds, { padding: [60, 60] })
      }
      return
    }

    const heading = activePosition.heading ?? 0
    const position = L.latLng(activePosition.lat, activePosition.lon)
    const icon = L.divIcon({
      className: '',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      html: `
        <div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:999px;background:rgba(15,23,42,0.94);border:1px solid rgba(96,165,250,0.75);box-shadow:0 0 18px rgba(59,130,246,0.35);transform:rotate(${heading}deg);">
          <span style="font-size:18px;line-height:1;color:#60a5fa;">✈</span>
        </div>
      `,
    })

    if (!planeMarker.current) {
      planeMarker.current = L.marker(position, { icon }).addTo(map)
    } else {
      planeMarker.current.setLatLng(position)
      planeMarker.current.setIcon(icon)
    }

    if (routePoints.length > 0 && routeLayer.current) {
      const bounds = L.latLngBounds(routePoints)
      map.fitBounds(bounds, { padding: [60, 60] })
    } else {
      map.setView(position, 5, { animate: true })
    }
  }, [snapshot, liveAircraft, selectedFlight])

  const handleSearch = () => {
    const query = bookingSearchQuery.trim().toLowerCase()
    if (!query) {
      setSelectedBookingId(filteredFlights[0]?.bookingId ?? null)
      return
    }

    const exactMatch = filteredFlights.find((flight) => flight.flightNumber.toLowerCase() === query)
    setSelectedBookingId((exactMatch || filteredFlights[0] || null)?.bookingId ?? null)
  }

  const handleLiveTrack = () => {
    const next = liveFlightInput.trim()
    if (!next) return
    setLiveFlightQuery(next)
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-4xl font-bold">Live Flight Dashboard</h1>
          <p className="text-zinc-400 mt-2">
            Keep live flight search and booked Supabase flights side by side.
          </p>
        </div>

        <div className="text-sm text-zinc-500">
          {bookedFlights.length} booked flight{bookedFlights.length === 1 ? '' : 's'} loaded
        </div>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Live Flight Search</h2>
            <span className="text-xs text-zinc-500">Previous ADS-B search</span>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <input
                value={liveFlightInput}
                onChange={(e) => setLiveFlightInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleLiveTrack()
                  }
                }}
                placeholder="Enter flight number"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 pr-32 text-sm text-white placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none"
              />

              <button
                type="button"
                onClick={handleLiveTrack}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-500"
              >
                Track Flight
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500">
            <span>Showing live ADS-B tracking for {liveFlightQuery}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Booked Flights</h2>
            <span className="text-xs text-zinc-500">Supabase side option</span>
          </div>

          <div className="relative">
            <input
              value={bookingSearchQuery}
              onChange={(e) => setBookingSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch()
                }
              }}
              placeholder="Search booked flights"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 pr-32 text-sm text-white placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none"
            />

            <button
              type="button"
              onClick={handleSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-zinc-700 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-600"
            >
              Find
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500">
            <span>{filteredFlights.length} matching flight{filteredFlights.length === 1 ? '' : 's'}</span>
            <span>Select a booking to place it on the map.</span>
          </div>
        </div>
      </div>

      {bookingsError && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {bookingsError}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1.65fr_1fr] gap-6 items-start">
        <div className="space-y-6">
          <div className="relative h-170 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900">
            <div ref={mapRef} className="h-full w-full" />

            {!snapshot && !snapshotLoading && !liveAircraft && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35 px-6 text-center text-sm text-zinc-300">
                {bookingsLoading || liveLoading
                  ? 'Loading flight data...'
                  : 'Track a live flight or select a booked flight to place it on the map.'}
              </div>
            )}

            {snapshotLoading && selectedBooking && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30 px-6 text-center text-sm text-zinc-300">
                Tracking live flight position...
              </div>
            )}

            {liveLoading && !selectedBooking && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30 px-6 text-center text-sm text-zinc-300">
                Loading live ADS-B flight...
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6">
              <h2 className="text-2xl font-bold mb-4">Live Flight Details</h2>

              {liveAircraft ? (
                <div className="space-y-4 text-zinc-300">
                  <div>
                    <span className="text-zinc-500">Flight:</span>
                    <div className="text-xl font-semibold">
                      {liveAircraft.flight || liveFlightQuery}
                    </div>
                  </div>

                  <div>
                    <span className="text-zinc-500">Latitude:</span>
                    <div>{liveAircraft.lat}</div>
                  </div>

                  <div>
                    <span className="text-zinc-500">Longitude:</span>
                    <div>{liveAircraft.lon}</div>
                  </div>

                  <div>
                    <span className="text-zinc-500">Altitude:</span>
                    <div>{liveAircraft.alt_baro || 'Unknown'} ft</div>
                  </div>

                  <div>
                    <span className="text-zinc-500">Speed:</span>
                    <div>{liveAircraft.gs || 'Unknown'} knots</div>
                  </div>

                  <div>
                    <span className="text-zinc-500">Aircraft:</span>
                    <div>{liveAircraft.t || 'Unknown'}</div>
                  </div>

                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-400">
                    <div className="font-medium text-zinc-200 mb-1">Search mode</div>
                    Original live ADS-B flight search remains active here.
                  </div>
                </div>
              ) : liveError ? (
                <div className="space-y-3 text-sm text-zinc-500">
                  <p>{liveError}</p>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">
                  Track a live flight to see the current aircraft details here.
                </p>
              )}
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6">
              <h2 className="text-2xl font-bold mb-4">Booked Flight Detail</h2>

              {selectedFlight ? (
                <div className="space-y-4 text-zinc-300">
                  <div>
                    <span className="text-zinc-500">Flight:</span>
                    <div className="text-xl font-semibold">{selectedFlight.flightNumber}</div>
                  </div>

                  <div>
                    <span className="text-zinc-500">Trip:</span>
                    <div>{selectedFlight.tripName || 'Untitled trip'}</div>
                  </div>

                  <div>
                    <span className="text-zinc-500">Route:</span>
                    <div>
                      {selectedFlight.departureAirport} → {selectedFlight.arrivalAirport}
                    </div>
                  </div>

                  <div>
                    <span className="text-zinc-500">Schedule:</span>
                    <div>
                      {selectedFlight.departureDate} {selectedFlight.departureTime} →{' '}
                      {selectedFlight.arrivalDate} {selectedFlight.arrivalTime}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                      <div className="text-zinc-500">Airline</div>
                      <div className="font-medium text-zinc-100">
                        {selectedFlight.airlineName || 'Unknown'}
                      </div>
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                      <div className="text-zinc-500">Seat</div>
                      <div className="font-medium text-zinc-100">
                        {selectedFlight.seatNumber || 'Unknown'}
                      </div>
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                      <div className="text-zinc-500">Booking Status</div>
                      <div className="font-medium text-zinc-100">
                        {selectedFlight.bookingStatus || 'Unknown'}
                      </div>
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                      <div className="text-zinc-500">Booking Ref</div>
                      <div className="font-medium text-zinc-100">
                        {selectedFlight.bookingReference || 'Unknown'}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-400">
                    <div className="font-medium text-zinc-200 mb-1">Notes</div>
                    {selectedFlight.notes || 'No booking notes available.'}
                  </div>

                  {selectedFlight.cost != null && (
                    <div className="text-sm text-zinc-400">
                      Cost: {selectedFlight.currency || 'USD'} {selectedFlight.cost}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">
                  Search for a booked flight and select it to see the booking details here.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-2xl font-bold">Booked Flights</h2>
              {bookingsLoading && <span className="text-xs text-zinc-500">Refreshing...</span>}
            </div>

            <div className="space-y-3 max-h-130 overflow-y-auto pr-1">
              {filteredFlights.length > 0 ? (
                filteredFlights.map((flight) => {
                  const isSelected = flight.bookingId === selectedBookingId

                  return (
                    <button
                      key={flight.bookingId}
                      type="button"
                      onClick={() => setSelectedBookingId(flight.bookingId)}
                      className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
                        isSelected
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-600 hover:bg-zinc-900'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-zinc-100">{flight.flightNumber}</span>
                            {flight.isConnectingToNext && (
                              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-300">
                                Connecting
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-sm text-zinc-400">
                            {flight.tripName || 'Untitled trip'}
                          </div>
                        </div>
                        <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-300">
                          {flight.bookingStatus || 'confirmed'}
                        </span>
                      </div>

                      <div className="mt-3 space-y-1 text-sm text-zinc-400">
                        <div>
                          {flight.departureAirport} → {flight.arrivalAirport}
                        </div>
                        <div>
                          {flight.departureDate} {flight.departureTime} → {flight.arrivalDate} {flight.arrivalTime}
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
                          <span>Seat {flight.seatNumber || 'Unknown'}</span>
                          <span>{flight.airlineName || 'Unknown airline'}</span>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-zinc-500">
                        <span>Booking ref: {flight.bookingReference || 'Unknown'}</span>
                        <span className="text-blue-300">Click to track</span>
                      </div>
                    </button>
                  )
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 p-6 text-sm text-zinc-500">
                  {bookingsLoading
                    ? 'Loading booked flights from Supabase...'
                    : 'No booked flights match your search.'}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6">
            <h3 className="text-lg font-semibold text-zinc-100">Quick Tips</h3>
            <ul className="mt-3 space-y-2 text-sm text-zinc-400">
              <li>Use the top left search box for the original live ADS-B flight lookup.</li>
              <li>Use the booked flights search on the right to filter Supabase bookings.</li>
              <li>Select any booked flight to show its live tracker snapshot on the map.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}