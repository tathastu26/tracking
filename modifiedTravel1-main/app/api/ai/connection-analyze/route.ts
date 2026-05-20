import { NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase-server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { tripId } = body
    if (!tripId) return NextResponse.json({ error: 'tripId required' }, { status: 400 })

    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
    const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-oss-120b:free'

    if (!OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'OPENROUTER_API_KEY not set in env' }, { status: 500 })
    }

    const supabase = await createServerClient()

    // Fetch trip events
    const { data: flights, error: flightsErr } = await supabase
      .from('trip_flights')
      .select('*')
      .eq('trip_id', tripId)

    if (flightsErr) {
      return NextResponse.json({ error: 'Failed to load flights', details: flightsErr }, { status: 500 })
    }

    const { data: hotels, error: hotelsErr } = await supabase
      .from('trip_hotels')
      .select('*')
      .eq('trip_id', tripId)

    if (hotelsErr) {
      return NextResponse.json({ error: 'Failed to load hotels', details: hotelsErr }, { status: 500 })
    }

    // Build a detailed timeline text for the model
    const events: any[] = []
    for (const f of flights) {
      events.push({
        type: 'flight',
        id: f.id,
        flight_number: f.flight_number,
        departure_airport: f.departure_airport,
        arrival_airport: f.arrival_airport,
        departure_ts: `${f.departure_date}T${f.departure_time}`,
        arrival_ts: `${f.arrival_date}T${f.arrival_time}`,
        serial_number: f.serial_number,
      })
    }
    for (const h of hotels) {
      events.push({
        type: 'hotel',
        id: h.id,
        hotel_name: h.hotel_name,
        check_in_ts: `${h.check_in_date}T${h.check_in_time}`,
        check_out_ts: `${h.check_out_date}T${h.check_out_time}`,
        serial_number: h.serial_number,
      })
    }

    // Sort events by timestamp
    events.sort((a: any, b: any) => {
      const a_ts = a.type === 'flight' ? a.departure_ts : a.check_in_ts
      const b_ts = b.type === 'flight' ? b.departure_ts : b.check_in_ts
      return new Date(a_ts).getTime() - new Date(b_ts).getTime()
    })

    const systemPrompt = `You are an assistant that analyzes trip itineraries and determines which flights are connecting sequences. Respond in JSON with a mapping of flight_id -> suggested_group (use 'standalone' for singles, or a group name like 'group-1') and a short explanation. Use the following rules:\n- If two flights occur sequentially with no hotel in between and the next flight's departure is within 24 hours of the previous arrival, prefer auto-detecting as connecting.\n- If there is a hotel between two flights, mark as 'standalone' unless the user wants manual grouping.\n- Provide suggested grouping names and explain why each was grouped.`

    const userPrompt = `Here is the timeline for trip ${tripId}. Events (chronological):\n${JSON.stringify(events, null, 2)}\n\nReturn only valid JSON with keys: suggestions (object mapping flight_id to group name), explanation (short). Do not include extra text.`

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]

    const res = await fetch('https://api.openrouter.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({ model: OPENROUTER_MODEL, messages }),
    })

    if (!res.ok) {
      const txt = await res.text()
      return NextResponse.json({ error: 'OpenRouter API failed', details: txt }, { status: 500 })
    }

    const json = await res.json()
    const assistant = json?.choices?.[0]?.message?.content || json?.choices?.[0]?.delta?.content || JSON.stringify(json)

    // Try to parse assistant content as JSON
    let parsed
    try {
      parsed = JSON.parse(assistant)
    } catch (err) {
      // return raw assistant content if parsing fails
      return NextResponse.json({ raw: assistant }, { status: 200 })
    }

    return NextResponse.json({ suggestions: parsed }, { status: 200 })
  } catch (err) {
    console.error('AI analyze error', err)
    return NextResponse.json({ error: 'Internal error', details: String(err) }, { status: 500 })
  }
}
