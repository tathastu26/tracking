// app/api/recalc-serials/route.ts
import { NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase-server'

export async function POST(req: Request) {
  try {
    const { tripId } = await req.json()
    if (!tripId) return NextResponse.json({ error: 'tripId required' }, { status: 400 })

    const supabase = await createServerClient()

    // Fetch wires and flights for this trip
    const [{ data: links }, { data: flights }] = await Promise.all([
      supabase.from('trip_event_links').select('*').eq('trip_id', tripId),
      supabase.from('trip_flights').select('id').eq('trip_id', tripId),
    ])

    if (!flights) return NextResponse.json({ error: 'No flights found' }, { status: 404 })

    const flightIds = new Set(flights.map((f: any) => f.id))

    // Determine which flights are connecting via wire (direct flight→flight wire)
    const connectingSet = new Set<string>()
    for (const link of links || []) {
      if (flightIds.has(link.from_id) && flightIds.has(link.to_id)) {
        // Both ends are flights → connecting
        connectingSet.add(link.from_id)
        // Don't add to_id as "connecting_to_next" — it's the NEXT flight, not the connecting one
        // Actually mark both as "part of a connection chain" — the UI shows badge on both
        connectingSet.add(link.to_id)
      }
    }

    // Update all flights
    for (const flight of flights) {
      await supabase
        .from('trip_flights')
        .update({ is_connecting_to_next: connectingSet.has(flight.id) })
        .eq('id', flight.id)
    }

    // Also run the serial number recalc
    await supabase.rpc('update_trip_serial_numbers', { p_trip_id: tripId })

    return NextResponse.json({ ok: true, connecting: [...connectingSet] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
