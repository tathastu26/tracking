import { NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase-server'

type NodeType = 'flight' | 'hotel'

async function nodeExists(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  tripId: string,
  type: NodeType,
  id: string
) {
  const table = type === 'flight' ? 'trip_flights' : 'trip_hotels'
  const { data, error } = await supabase
    .from(table)
    .select('id')
    .eq('trip_id', tripId)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw error
  }

  return Boolean(data)
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch((err) => {
      console.error('Failed to parse JSON:', err)
      return { action: 'unknown' }
    })
    
    const { action } = body
    
    try {
      const supabase = await createServerClient()

      if (action === 'create') {
      const { tripId, from_type, from_id, to_type, to_id } = body
      if (!tripId) return NextResponse.json({ error: 'tripId required' }, { status: 400 })

      if (!['flight', 'hotel'].includes(from_type) || !['flight', 'hotel'].includes(to_type)) {
        return NextResponse.json({ error: 'Invalid node type' }, { status: 400 })
      }

      if (!from_id || !to_id) {
        return NextResponse.json({ error: 'from_id and to_id are required' }, { status: 400 })
      }

      if (from_type === to_type && from_id === to_id) {
        return NextResponse.json({ error: 'Cannot link a node to itself' }, { status: 400 })
      }

      const [fromOk, toOk] = await Promise.all([
        nodeExists(supabase, tripId, from_type, from_id),
        nodeExists(supabase, tripId, to_type, to_id),
      ])

      if (!fromOk || !toOk) {
        return NextResponse.json({ error: 'Link endpoints must belong to the selected trip' }, { status: 400 })
      }

      const { data: existingLink, error: existingError } = await supabase
        .from('trip_event_links')
        .select('id')
        .eq('trip_id', tripId)
        .or(
          `and(from_type.eq.${from_type},from_id.eq.${from_id},to_type.eq.${to_type},to_id.eq.${to_id}),and(from_type.eq.${to_type},from_id.eq.${to_id},to_type.eq.${from_type},to_id.eq.${from_id})`
        )
        .maybeSingle()

      if (existingError) {
        return NextResponse.json({ error: existingError.message }, { status: 500 })
      }

      if (existingLink) {
        return NextResponse.json({ error: 'Link already exists' }, { status: 409 })
      }

      const { error } = await supabase.from('trip_event_links').insert({
        trip_id: tripId,
        from_type,
        from_id,
        to_type,
        to_id,
      })

      if (error) {
        // Return the underlying DB error so the frontend can show/log why linking fails
        return NextResponse.json({
          error: {
            message: error.message,
            details: error.details,
            hint: error.hint,
          },
        }, { status: 500 })
      }

      return NextResponse.json({ ok: true })
    }

    if (action === 'delete') {
      const { id } = body
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
      const { error } = await supabase.from('trip_event_links').delete().eq('id', id)
      if (error) return NextResponse.json({ error }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    if (action === 'list') {
      const { tripId } = body
      if (!tripId) {
        return NextResponse.json({ error: 'tripId required', data: [] }, { status: 400 })
      }
      try {
        const { data, error } = await supabase
          .from('trip_event_links')
          .select('*')
          .eq('trip_id', tripId)
        
        if (error) {
          console.error('Supabase error listing links:', error)
          return NextResponse.json({ data: [], error: null }, { status: 200 })
        }
        
        return NextResponse.json({ data: data || [] })
      } catch (err) {
        console.error('Error listing links:', err)
        return NextResponse.json({ data: [], error: null }, { status: 200 })
      }
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 })
    } catch (supabaseErr) {
      console.error('Supabase operation error:', supabaseErr)
      return NextResponse.json({ data: [], error: null }, { status: 200 })
    }
  } catch (err) {
    console.error('event-links error', err)
    // Return safe default to prevent page reload errors
    return NextResponse.json({ data: [], error: null }, { status: 200 })
  }
}
