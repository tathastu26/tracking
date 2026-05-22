import { NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase-server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { flightId, group } = body
    if (!flightId) return NextResponse.json({ error: 'flightId required' }, { status: 400 })

    const supabase = await createServerClient()
    const { error } = await supabase.from('trip_flights').update({ connection_group: group || 'standalone' }).eq('id', flightId)
    if (error) return NextResponse.json({ error }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('update-flight-group error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
