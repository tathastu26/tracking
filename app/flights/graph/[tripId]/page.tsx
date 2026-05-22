// app/flights/graph/[tripId]/page.tsx
import { MainLayout } from '@/components/main-layout'
import TripGraph from '@/components/graph/trip-graph'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import createServerClient from '@/lib/supabase-server'
import type { Link as TripLink } from '@/lib/types'

type GraphFlight = Record<string, any>
type GraphHotel = Record<string, any>

export default async function GraphPage({ params }: { params: Promise<{ tripId: string }> }) {
  const resolvedParams = await params
  const tripId = Array.isArray(resolvedParams.tripId) ? resolvedParams.tripId[0] : resolvedParams.tripId

  const supabase = await createServerClient()
  const [{ data: flights }, { data: hotels }, { data: links }] = await Promise.all([
    supabase.from('trip_flights').select('*').eq('trip_id', tripId).order('departure_date', { ascending: true }),
    supabase.from('trip_hotels').select('*').eq('trip_id', tripId).order('check_in_date', { ascending: true }),
    supabase.from('trip_event_links').select('*').eq('trip_id', tripId),
  ])

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <Link href="/flights" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Trips
          </Link>
        </div>
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold text-foreground">Trip Graph</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Drag nodes to arrange · Click the <strong>link icon</strong> on a node then click another node to draw a wire · Click <strong>×</strong> on a wire to remove it · Flight→Flight wires = connecting flights
          </p>
        </div>
        <TripGraph
          tripId={tripId || null}
          initialFlights={(flights || []) as GraphFlight[]}
          initialHotels={(hotels || []) as GraphHotel[]}
          initialLinks={(links || []) as TripLink[]}
        />
      </div>
    </MainLayout>
  )
}
