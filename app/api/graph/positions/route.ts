import { NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase-server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { tripId, positions } = body
    if (!tripId) return NextResponse.json({ error: 'Missing tripId' }, { status: 400 })

    const supabase = await createServerClient()
    const payload = { trip_id: tripId, positions: JSON.stringify(positions), updated_at: new Date().toISOString() }

    const { error } = await supabase.from('trip_graph_positions').upsert(payload, { onConflict: 'trip_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const tripId = url.searchParams.get('tripId')
    if (!tripId) return NextResponse.json({ error: 'Missing tripId' }, { status: 400 })

    const supabase = await createServerClient()
    const { data, error } = await supabase.from('trip_graph_positions').select('positions').eq('trip_id', tripId).limit(1).single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const positions = data?.positions ? JSON.parse(data.positions) : null
    return NextResponse.json({ positions })
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
