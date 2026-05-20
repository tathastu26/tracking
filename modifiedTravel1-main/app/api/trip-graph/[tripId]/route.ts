import { NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase-server'

export async function GET(
  _req: Request,
  { params }: { params: { tripId: string } }
) {
  try {
    const { tripId } = params
    if (!tripId) {
      return NextResponse.json({ error: 'tripId required' }, { status: 400 })
    }

    const supabase = await createServerClient()

    const [{ data: flights, error: flightsError }, { data: hotels, error: hotelsError }, { data: links, error: linksError }] =
      await Promise.all([
        supabase
          .from('trip_flights')
          .select('*')
          .eq('trip_id', tripId)
          .order('departure_date', { ascending: true }),
        supabase
          .from('trip_hotels')
          .select('*')
          .eq('trip_id', tripId)
          .order('check_in_date', { ascending: true }),
        supabase
          .from('trip_event_links')
          .select('*')
          .eq('trip_id', tripId),
      ])

    const error = flightsError || hotelsError || linksError
    if (error) {
      return NextResponse.json(
        { error: error.message, details: error.details, hint: error.hint },
        { status: 500 }
      )
    }

    return NextResponse.json({
      tripId,
      flights: flights || [],
      hotels: hotels || [],
      links: links || [],
    })
  } catch (err) {
    console.error('trip-graph load error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
