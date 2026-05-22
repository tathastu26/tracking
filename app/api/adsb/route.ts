import { NextResponse } from 'next/server'

const AIRLABS_BASE = 'https://airlabs.co/api/v9'
const OPEN_WEATHER_BASE = 'https://api.openweathermap.org/data/2.5/weather'

const AIRPORT_COORDS: Record<string, { lat: number; lon: number }> = {
  DXB: { lat: 25.2532, lon: 55.3657 },
  LAX: { lat: 33.9416, lon: -118.4085 },
  JFK: { lat: 40.6413, lon: -73.7781 },
  ORD: { lat: 41.9742, lon: -87.9073 },
  LHR: { lat: 51.47, lon: -0.4543 },
  CDG: { lat: 49.0097, lon: 2.5479 },
  AMS: { lat: 52.3105, lon: 4.7683 },
  FRA: { lat: 50.0379, lon: 8.5622 },
  HND: { lat: 35.5494, lon: 139.7798 },
  NRT: { lat: 35.7767, lon: 140.3188 },
  SIN: { lat: 1.3644, lon: 103.9915 },
  SFO: { lat: 37.6213, lon: -122.379 },
  SEA: { lat: 47.4502, lon: -122.3088 },
  BOS: { lat: 42.3656, lon: -71.0096 },
  ATL: { lat: 33.6407, lon: -84.4277 },
  DOH: { lat: 25.2736, lon: 51.6081 },
  DEL: { lat: 28.5562, lon: 77.1 },
  BOM: { lat: 19.0896, lon: 72.8656 },
  BLR: { lat: 13.1986, lon: 77.7066 },
  MAA: { lat: 12.9941, lon: 80.1709 },
  HYD: { lat: 17.2403, lon: 78.4294 },
  CCU: { lat: 22.6547, lon: 88.4467 },
  AMD: { lat: 23.0772, lon: 72.6347 },
  PNQ: { lat: 18.5822, lon: 73.9197 },
  COK: { lat: 10.152, lon: 76.4019 },
}

const fetchJson = async (url: string) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6000)
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

const pickAirlabsFlight = (payload: any) => {
  if (!payload) return null
  const response = payload.response
  if (Array.isArray(response)) return response[0] ?? null
  return response ?? null
}

const normalizeDelayMinutes = (value: unknown) => {
  const delay = toNumber(value)
  if (delay == null) return null
  if (delay > 1000) return Math.round(delay / 60)
  return Math.round(delay)
}

const toNumber = (value: unknown) => {
  const num = typeof value === 'string' ? Number(value) : value
  return typeof num === 'number' && Number.isFinite(num) ? num : null
}

const toTimestamp = (value: unknown) => {
  if (value == null) return null
  if (typeof value === 'number') {
    if (value > 10_000_000_000) return value
    if (value > 1_000_000_000) return value * 1000
    return null
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

const pickTimestamp = (values: unknown[]) => {
  for (const value of values) {
    const ts = toTimestamp(value)
    if (ts != null) return ts
  }
  return null
}

const weatherImpactScore = (weather: Record<string, unknown> | null) => {
  if (!weather) return { score: null, label: 'Unknown' }

  const visibility = toNumber(weather.visibility) ?? 10000
  const wind = toNumber(weather.wind_speed_10m) ?? 0
  const cloud = toNumber(weather.cloud_cover) ?? 0
  const rain = toNumber(weather.precipitation) ?? 0

  let score = 0
  if (visibility < 3000) score += 25
  else if (visibility < 7000) score += 12

  if (wind > 45) score += 20
  else if (wind > 25) score += 10

  if (cloud > 85) score += 8
  if (rain > 5) score += 18
  else if (rain > 1) score += 8

  const clamped = Math.min(score, 95)
  const label = clamped >= 60 ? 'High' : clamped >= 30 ? 'Moderate' : 'Low'
  return { score: clamped, label }
}

const weatherDelayMinutes = (condition: string | null) => {
  switch (condition) {
    case 'Thunderstorm':
      return 45
    case 'Rain':
      return 15
    case 'Fog':
    case 'Mist':
    case 'Haze':
    case 'Smoke':
      return 25
    default:
      return 0
  }
}

const congestionDelayMinutes = (nearbyAircraft: number | null) => {
  if (nearbyAircraft == null) return 0
  if (nearbyAircraft > 70) return 25
  if (nearbyAircraft > 40) return 10
  return 0
}

const airportCoords = (code?: string | null) => {
  if (!code) return null
  return AIRPORT_COORDS[code.trim().toUpperCase()] ?? null
}

const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
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

const calculateFallbackDelay = (params: {
  currentLat: number
  currentLon: number
  destinationLat: number
  destinationLon: number
  speedKts: number | null
  weatherDelay: number
  congestionDelay: number
}) => {
  const speedKmh = Math.max((params.speedKts ?? 700) * 1.852, 300)
  const remainingKm = haversineKm(
    params.currentLat,
    params.currentLon,
    params.destinationLat,
    params.destinationLon
  )
  const remainingMinutes = (remainingKm / speedKmh) * 60
  const baseDelay = Math.max(0, Math.round(remainingMinutes * 0.08))
  const totalDelay = Math.max(0, Math.round(baseDelay + params.weatherDelay + params.congestionDelay))

  return {
    totalDelay,
    reasons: [
      `Estimated ${Math.round(remainingKm)} km remaining`,
      params.weatherDelay > 0 ? 'Weather affecting route' : null,
      params.congestionDelay > 0 ? 'Airport congestion detected' : null,
    ].filter(Boolean) as string[],
  }
}

export async function GET(req: Request) {
  try {
    console.log('api/adsb GET start', { url: req.url })
    const { searchParams } = new URL(req.url)

    const flight = searchParams.get('flight')

    if (!flight) {
      return NextResponse.json({ error: 'Flight missing' }, { status: 400 })
    }

    // Test/demo mode: return a simulated aircraft for quick local UI checks
    if (flight.trim().toUpperCase() === 'TEST' || flight.trim().toUpperCase() === 'DEMO') {
      const sample = {
        ac: [
          {
            flight: 'TEST123',
            lat: 37.62131,
            lon: -122.37896,
            alt_baro: 12000,
            gs: 420,
            track: 85,
            t: 'B738',
          },
        ],
        msg: 'Simulated test flight',
        now: Date.now(),
        total: 1,
      }

      const sampleWeatherImpact = { score: 12, label: 'Low' }
      const sampleDelayBreakdown = { baseMinutes: 5, weatherMinutes: 0, congestionMinutes: 2, totalMinutes: 7 }

      return NextResponse.json({
        ...sample,
        weatherImpact: sampleWeatherImpact,
        delaySource: 'demo',
        delayStatus: 'Likely On Time',
        delayReasons: ['Simulated test flight'],
        congestion: { count: 12, level: 'Low' },
        delayBreakdown: sampleDelayBreakdown,
        delayMinutes: sampleDelayBreakdown.totalMinutes,
      })
    }

    const adsbUrl = `https://api.adsb.lol/v2/callsign/${flight}`
    console.log('fetching adsb', adsbUrl)
    const adsbData = await fetchJson(adsbUrl)
    console.log('fetched adsb', Boolean(adsbData))
    const aircraft = Array.isArray(adsbData?.ac) ? adsbData.ac[0] : null

    const lat = toNumber(aircraft?.lat)
    const lon = toNumber(aircraft?.lon)

    const openWeatherKey = process.env.OPENWEATHER_API_KEY
    const weatherUrl =
      lat != null && lon != null && openWeatherKey
        ? `${OPEN_WEATHER_BASE}?lat=${lat}&lon=${lon}&appid=${openWeatherKey}&units=metric`
        : null

    const airlabsKey = process.env.AIRLABS_API_KEY
    const airlabsFlightUrl = airlabsKey
      ? `${AIRLABS_BASE}/flight?flight_iata=${flight.trim().toUpperCase()}&api_key=${airlabsKey}`
      : null

    console.log('weatherUrl, airlabsFlightUrl', { weatherUrl, airlabsFlightUrl: Boolean(airlabsFlightUrl) })
    const [weatherResponse, airlabsFlight] = await Promise.all([
      weatherUrl ? fetchJson(weatherUrl) : Promise.resolve(null),
      airlabsFlightUrl ? fetchJson(airlabsFlightUrl) : Promise.resolve(null),
    ])
    console.log('fetched weather and airlabs', { weather: Boolean(weatherResponse), airlabs: Boolean(airlabsFlight) })

    const weather = weatherResponse
    const weatherMain = Array.isArray(weather?.weather) ? weather.weather[0]?.main ?? null : null
    const weatherImpact = weatherImpactScore(
      weather?.main ? { ...weather.main, visibility: weather.visibility, cloud_cover: weather.clouds?.all, precipitation: weather.rain?.['1h'] } : null
    )
    const weatherDelay = weatherDelayMinutes(weatherMain)

    const airlabsData = pickAirlabsFlight(airlabsFlight)
    const apiDelayMinutes =
      normalizeDelayMinutes(airlabsData?.arrival_delay) ??
      normalizeDelayMinutes(airlabsData?.arr_delay) ??
      normalizeDelayMinutes(airlabsData?.departure_delay) ??
      normalizeDelayMinutes(airlabsData?.dep_delay) ??
      normalizeDelayMinutes(airlabsData?.delayed) ??
      null

    const scheduledArrival = pickTimestamp([
      airlabsData?.arr_time_utc,
      airlabsData?.arr_time,
      airlabsData?.arr_time_ts,
      airlabsData?.arr_scheduled,
      airlabsData?.arr_scheduled_utc,
      airlabsData?.arr_scheduled_ts,
      airlabsData?.arrival_scheduled,
    ])

    const estimatedArrival = pickTimestamp([
      airlabsData?.arr_estimated,
      airlabsData?.arr_estimated_utc,
      airlabsData?.arr_estimated_ts,
      airlabsData?.arrival_estimated,
      airlabsData?.arr_time_estimated,
    ])

    const baseDelay =
      scheduledArrival != null && estimatedArrival != null
        ? Math.max(0, (estimatedArrival - scheduledArrival) / 60000)
        : 0

    const arrivalIata =
      typeof airlabsData?.arr_iata === 'string'
        ? airlabsData.arr_iata
        : typeof airlabsData?.dep_iata === 'string'
          ? airlabsData.dep_iata
          : null
    const arrivalIcao =
      typeof airlabsData?.arr_icao === 'string'
        ? airlabsData.arr_icao
        : typeof airlabsData?.dep_icao === 'string'
          ? airlabsData.dep_icao
          : null

    let congestionCount: number | null = null
    if (lat != null && lon != null) {
      console.log('fetching congestion by latlon', { lat, lon })
      const congestionUrl = `https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/100`
      const congestionResp = await fetchJson(congestionUrl)
      console.log('congestion response', Boolean(congestionResp))
      const flights = Array.isArray(congestionResp?.ac) ? congestionResp.ac : []
      congestionCount = flights.length
    } else if (airlabsKey && (arrivalIata || arrivalIcao)) {
      console.log('fetching congestion by airlabs', { arrivalIata, arrivalIcao })
      const params = arrivalIata
        ? `arr_iata=${arrivalIata}`
        : `arr_icao=${arrivalIcao}`
      const congestionUrl = `${AIRLABS_BASE}/flights?${params}&api_key=${airlabsKey}`
      const congestionResp = await fetchJson(congestionUrl)
      console.log('airlabs congestion response', Boolean(congestionResp))
      const flights = Array.isArray(congestionResp?.response)
        ? congestionResp.response
        : []
      congestionCount = flights.length
    }

    const congestionDelay = congestionDelayMinutes(congestionCount)
    const departureAirport = airportCoords(
      typeof airlabsData?.dep_iata === 'string'
        ? airlabsData.dep_iata
        : typeof airlabsData?.dep_icao === 'string'
          ? airlabsData.dep_icao
          : null
    )
    const arrivalAirport = airportCoords(
      typeof airlabsData?.arr_iata === 'string'
        ? airlabsData.arr_iata
        : typeof airlabsData?.arr_icao === 'string'
          ? airlabsData.arr_icao
          : null
    )

    const calculatedFallback =
      lat != null && lon != null && arrivalAirport
        ? calculateFallbackDelay({
            currentLat: lat,
            currentLon: lon,
            destinationLat: arrivalAirport.lat,
            destinationLon: arrivalAirport.lon,
            speedKts: toNumber(aircraft?.gs),
            weatherDelay,
            congestionDelay,
          })
        : {
            totalDelay: Math.round(baseDelay + weatherDelay + congestionDelay),
            reasons: [
              baseDelay > 0 ? `Estimated ${Math.round(baseDelay)} mins from schedule drift` : null,
              weatherDelay > 0 ? 'Weather affecting route' : null,
              congestionDelay > 0 ? 'Airport congestion detected' : null,
            ].filter(Boolean) as string[],
          }

    const usingRealDelay = apiDelayMinutes != null
    const totalDelay = usingRealDelay ? apiDelayMinutes : calculatedFallback.totalDelay
    const reasons = usingRealDelay
      ? [
          `AirLabs reported ${apiDelayMinutes} mins delay`,
          weatherDelay > 0 ? 'Weather affecting route' : null,
          congestionDelay > 0 ? 'Airport congestion detected' : null,
        ].filter(Boolean) as string[]
      : calculatedFallback.reasons

    const congestionLevel =
      congestionCount == null
        ? 'Unknown'
        : congestionCount > 150
          ? 'High'
          : congestionCount > 60
            ? 'Moderate'
            : 'Low'

    console.log('responding with delay', { totalDelay, congestionCount })
    return NextResponse.json({
      ...(adsbData || {}),
      weatherImpact,
      delaySource: usingRealDelay ? 'airlabs' : 'calculated-fallback',
      delayStatus: totalDelay > 15 ? 'Delayed' : 'Likely On Time',
      delayReasons: reasons,
      congestion: {
        count: congestionCount,
        level: congestionLevel,
      },
      delayBreakdown: {
        baseMinutes: usingRealDelay ? 0 : Math.round(baseDelay),
        weatherMinutes: weatherDelay,
        congestionMinutes: congestionDelay,
        totalMinutes: totalDelay,
      },
      delayMinutes: totalDelay,
    })
  } catch (error) {
    console.error(error)

    return NextResponse.json({ error: 'Failed to fetch ADSB data' }, { status: 500 })
  }
}
