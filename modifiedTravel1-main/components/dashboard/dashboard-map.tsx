'use client'

import 'leaflet/dist/leaflet.css'

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'

interface AircraftData {
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

export function DashboardMap() {
  const [flight, setFlight] = useState('AIC302')
  const [aircraft, setAircraft] = useState<AircraftData | null>(null)
  const [weatherImpact, setWeatherImpact] = useState<WeatherImpact | null>(null)
  const [congestion, setCongestion] = useState<Congestion | null>(null)
  const [delayMinutes, setDelayMinutes] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapInstance = useRef<L.Map | null>(null)
  const planeMarker = useRef<L.Marker | null>(null)
  const [delayBreakdown, setDelayBreakdown] = useState<{
    baseMinutes: number
    weatherMinutes: number
    congestionMinutes: number
    totalMinutes: number
  } | null>(null)

  async function fetchFlight() {
    try {
      setLoading(true)
      setError('')

      const response = await fetch(`/api/adsb?flight=${flight}`, {
        cache: 'no-store',
      })

      const data = await response.json()

      if (!data?.ac?.length) {
        setError('Flight not found')
        setAircraft(null)
        setWeatherImpact(null)
        setCongestion(null)
        setDelayMinutes(null)
        return
      }

      setAircraft(data.ac[0])
      setWeatherImpact(data.weatherImpact || null)
      setCongestion(data.congestion || null)
      setDelayBreakdown(data.delayBreakdown || null)
      setDelayMinutes(
        typeof data.delayMinutes === 'number' ? data.delayMinutes : null
      )
    } catch (err) {
      console.error(err)
      setError('Failed to fetch flight')
      setWeatherImpact(null)
      setCongestion(null)
      setDelayBreakdown(null)
      setDelayMinutes(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFlight()

    const interval = setInterval(fetchFlight, 10000)

    return () => clearInterval(interval)
  }, [flight])

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return

    const map = L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: true,
      worldCopyJump: true,
    }).setView([20, 0], 2)

    const osmUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    const cartoUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'

    const layer = L.tileLayer(osmUrl, {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    // If OSM tiles fail (network restrictions / rate limits), swap to Carto Voyager
    layer.on('tileerror', () => {
      try {
        if (map.hasLayer(layer)) map.removeLayer(layer)
        L.tileLayer(cartoUrl, { attribution: '© OpenStreetMap contributors / Carto', maxZoom: 19 }).addTo(map)
      } catch (e) {
        // ignore
      }
    })

    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    })

    mapInstance.current = map
    setTimeout(() => map.invalidateSize(), 0)

    return () => {
      map.remove()
      mapInstance.current = null
      planeMarker.current = null
    }
  }, [aircraft])

  useEffect(() => {
    const map = mapInstance.current
    if (!map || !aircraft) return

    const heading = aircraft.track ?? 0
    const position = L.latLng(aircraft.lat, aircraft.lon)
    const icon = L.divIcon({
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      html: `
        <div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:999px;background:rgba(15,23,42,0.9);border:1px solid rgba(96,165,250,0.7);box-shadow:0 0 16px rgba(59,130,246,0.35);transform:rotate(${heading}deg);">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 12L22 5L18 12L22 19L2 12Z" fill="#60a5fa" />
          </svg>
        </div>
      `,
    })

    if (!planeMarker.current) {
      planeMarker.current = L.marker(position, { icon }).addTo(map)
    } else {
      planeMarker.current.setLatLng(position)
      planeMarker.current.setIcon(icon)
    }

    map.setView(position, 5, { animate: true })
  }, [aircraft])

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-4xl font-bold">Live Flight Dashboard</h1>
          <p className="text-zinc-400 mt-2">Powered by ADSB.lol</p>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <input
          value={flight}
          onChange={(e) => setFlight(e.target.value)}
          placeholder="Enter Flight Number"
          className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 w-[300px]"
        />

        <button
          onClick={fetchFlight}
          className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg"
        >
          Track Flight
        </button>
      </div>

      {loading && <div className="mb-4 text-zinc-400">Loading flight data...</div>}

      {error && <div className="mb-4 text-red-400">{error}</div>}

      {aircraft && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-zinc-900 rounded-2xl overflow-hidden h-[650px]">
            <div ref={mapRef} className="h-full w-full" />
          </div>

          <div className="space-y-6">
            <div className="bg-zinc-900 rounded-2xl p-6">
              <h2 className="text-2xl font-bold mb-4">Flight Information</h2>

              <div className="space-y-4 text-zinc-300">
                <div>
                  <span className="text-zinc-500">Flight:</span>
                  <div className="text-xl font-semibold">{aircraft.flight || flight}</div>
                </div>

                <div>
                  <span className="text-zinc-500">Latitude:</span>
                  <div>{aircraft.lat}</div>
                </div>

                <div>
                  <span className="text-zinc-500">Longitude:</span>
                  <div>{aircraft.lon}</div>
                </div>

                <div>
                  <span className="text-zinc-500">Altitude:</span>
                  <div>{aircraft.alt_baro || 'Unknown'} ft</div>
                </div>

                <div>
                  <span className="text-zinc-500">Speed:</span>
                  <div>{aircraft.gs || 'Unknown'} knots</div>
                </div>

                <div>
                  <span className="text-zinc-500">Aircraft:</span>
                  <div>{aircraft.t || 'Unknown'}</div>
                </div>
              </div>
            </div>

            <div className="bg-zinc-900 rounded-2xl p-6">
              <h2 className="text-2xl font-bold mb-4">Delay Prediction</h2>

              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Weather Impact</span>
                  <span className="text-yellow-400">
                    {weatherImpact?.label || 'Unknown'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-zinc-400">Airport Congestion</span>
                  <span className="text-red-400">
                    {congestion?.level || 'Unknown'}
                  </span>
                </div>

                <div className="flex justify-between text-xl font-bold pt-4 border-t border-zinc-800">
                  <span>Estimated Delay</span>
                  <span className="text-orange-400">
                    {delayMinutes != null ? `${delayMinutes} mins` : 'Unknown'}
                  </span>
                </div>
                {delayBreakdown && (
                  <div className="text-xs text-zinc-400 pt-3 space-y-1">
                    <div>Base: {delayBreakdown.baseMinutes} mins</div>
                    <div>Weather: {delayBreakdown.weatherMinutes} mins</div>
                    <div>Congestion: {delayBreakdown.congestionMinutes} mins</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
