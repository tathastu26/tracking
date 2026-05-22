'use client'

import React, { useEffect, useState } from 'react'
import { MainLayout } from '@/components/main-layout'
import { OperationalCard } from '@/components/operational-card'
import { EmptyState } from '@/components/empty-state'
import { TripModal } from '@/components/modals/trip-modal'
import { FlightModal } from '@/components/modals/flight-modal'
import { HotelModal } from '@/components/modals/hotel-modal'
// grouping UI removed per user request
import { createClient } from '@/lib/supabase-client'
import type { Trip, Flight, Hotel, Link } from '@/lib/types'
import {
  Search,
  Plus,
  Plane,
  Hotel as HotelIcon,
  Trash2,
  Edit,
  ChevronDown,
  X,
  
} from 'lucide-react'
import MagneticButton from '@/components/ui/magnetic-button'
import TiltCard from '@/components/ui/tilt-card'
import { motion, AnimatePresence } from 'framer-motion'
import { Skeleton } from '@/components/ui/skeleton'
import AnimatedCounter from '@/components/ui/animated-counter'
import StatusBadge from '@/components/ui/status-badge'
import { toast } from '@/hooks/use-toast'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'

export default function FlightsPage() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedTrip, setExpandedTrip] = useState<string | null>(null)
  const [showNewTripModal, setShowNewTripModal] = useState(false)
  const [showFlightModal, setShowFlightModal] = useState(false)
  const [showHotelModal, setShowHotelModal] = useState(false)
  
  const [tripLinks, setTripLinks] = useState<Record<string, Link[]>>({})
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null)
  const [linkingFrom, setLinkingFrom] = useState<{ type: 'flight' | 'hotel'; id: string } | null>(null)

  const supabase = createClient()

  const listVariants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.06 } },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.2, 0.8, 0.2, 1] } },
  }

  // Fetch trips with flights and hotels
  const fetchTrips = async () => {
    try {
      setLoading(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { data: tripsData, error: tripsError } = await supabase
        .from('trips')
        .select('*')
        .eq('profile_id', user.id)
        .order('start_date', { ascending: false })

      if (tripsError) throw tripsError

      // Fetch flights and hotels for each trip
      const tripsWithDetails = await Promise.all(
        (tripsData || []).map(async (trip) => {
          const { data: flights } = await supabase
            .from('trip_flights')
            .select('*')
            .eq('trip_id', trip.id)
            .order('departure_date', { ascending: true })

          const { data: hotels } = await supabase
            .from('trip_hotels')
            .select('*')
            .eq('trip_id', trip.id)
            .order('check_in_date', { ascending: true })

          return {
            ...trip,
            flights: flights || [],
            hotels: hotels || [],
          }
        })
      )

      setTrips(tripsWithDetails)
    } catch (error) {
      console.error('Error fetching trips:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTrips()
  }, [])

  // restore selected trip if coming from graph or previous selection
  useEffect(() => {
    try {
      const stored = localStorage.getItem('selectedTripId')
      if (stored) setSelectedTripId(stored)
    } catch (e) {
      // ignore
    }
  }, [])

  // fetch event links for a trip and store locally - completely error-safe
  const fetchLinksForTrip = (tripId: string) => {
    // Fire-and-forget, return immediately
    fetch('/api/event-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list', tripId }),
    })
      .then((resp) => {
        if (!resp.ok) {
          console.warn('Event links API returned:', resp.status)
          return null
        }
        return resp.json()
      })
      .then((result) => {
        if (result && result.data && Array.isArray(result.data)) {
          setTripLinks((p) => ({ ...p, [tripId]: result.data }))
        }
      })
      .catch((err) => {
        console.warn('Suppressed network error in fetchLinksForTrip:', err)
        // Completely swallow error - never reject
      })
  }

  const filteredTrips = trips.filter(
    (trip) =>
      trip.trip_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trip.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleDeleteTrip = async (tripId: string) => {
    if (!confirm('Are you sure you want to delete this trip?')) return

    try {
      const { error } = await supabase
        .from('trips')
        .delete()
        .eq('id', tripId)

      if (error) throw error
      setTrips(trips.filter((t) => t.id !== tripId))
    } catch (error) {
      console.error('Error deleting trip:', error)
    }
  }

  const handleDeleteFlight = async (flightId: string, tripId: string) => {
    if (!confirm('Are you sure you want to delete this flight?')) return

    try {
      const { error } = await supabase
        .from('trip_flights')
        .delete()
        .eq('id', flightId)

      if (error) throw error
      fetchTrips()
    } catch (error) {
      console.error('Error deleting flight:', error)
    }
  }

  const handleDeleteHotel = async (hotelId: string, tripId: string) => {
    if (!confirm('Are you sure you want to delete this hotel?')) return

    try {
      const { error } = await supabase
        .from('trip_hotels')
        .delete()
        .eq('id', hotelId)

      if (error) throw error
      fetchTrips()
    } catch (error) {
      console.error('Error deleting hotel:', error)
    }
  }

  const getTotalStats = () => {
    const totalFlights = trips.reduce((sum, t) => sum + (t.flights?.length || 0), 0)
    const totalHotels = trips.reduce((sum, t) => sum + (t.hotels?.length || 0), 0)
    const connectingFlights = trips.reduce(
      (sum, t) => sum + (t.flights?.filter((f) => f.is_connecting_to_next).length || 0),
      0
    )

    return { totalFlights, totalHotels, connectingFlights }
  }

  const stats = getTotalStats()

  return (
    <MainLayout>
      <div className="p-8 space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Trips & Travel</h1>
            <p className="text-muted-foreground mt-1">
              Manage your trips, flights, and hotel bookings
            </p>
          </div>
          <MagneticButton
            onClick={() => setShowNewTripModal(true)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors w-fit"
            ariaLabel="New Trip"
          >
            <div className="flex items-center gap-2"><Plus className="w-4 h-4" /> New Trip</div>
          </MagneticButton>
        </div>

        {/* Search */}
        <div className="flex gap-3">
          <div className="flex w-full gap-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search trips..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full min-w-0 pl-10 pr-4 py-2 bg-muted border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded border border-border bg-card p-4">
                <Skeleton className="h-6 w-3/4 mb-3" />
                <Skeleton className="h-8 w-1/2" />
              </div>
            ))
          ) : (
            <>
              <OperationalCard
                title="Total Flights"
                value={<AnimatedCounter value={stats.totalFlights || 0} />}
                compact
              />
              <OperationalCard title="Total Hotels" value={<AnimatedCounter value={stats.totalHotels || 0} />} compact />
              <OperationalCard
                title="Connecting"
                value={<AnimatedCounter value={stats.connectingFlights || 0} />}
                compact
              />
            </>
          )}
        </div>

        {/* Trips List */}
        <motion.ul variants={listVariants} initial="hidden" animate="show" className="space-y-4">
          {loading ? (
            [1,2,3].map((i) => (
              <div key={i} className="p-4 border border-border rounded bg-card">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-3" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                </div>
              </div>
            ))
          ) : filteredTrips.length === 0 ? (
            <EmptyState
              icon={<Plane className="w-8 h-8" />}
              title="No trips found"
              description="Create a new trip to get started"
            />
          ) : (
            filteredTrips.map((trip) => (
              <motion.li key={trip.id} variants={itemVariants} className="list-none">
                <TiltCard className="rounded-lg">
                  <div className="border border-border overflow-hidden bg-card rounded-lg">
                {/* Trip Header */}
                <div
                  onClick={() => setExpandedTrip(expandedTrip === trip.id ? null : trip.id)}
                  className="p-4 bg-muted/50 hover:bg-muted cursor-pointer flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <ChevronDown
                      className={`w-5 h-5 transition-transform ${
                        expandedTrip === trip.id ? 'rotate-180' : ''
                      }`}
                    />
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {trip.trip_name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {trip.start_date} to {trip.end_date}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={trip.status} />
                    <a href={`/flights/graph/${trip.id}`} onClick={(e) => { e.stopPropagation(); }} className="text-xs text-primary/80 hover:underline px-2">Open Graph</a>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteTrip(trip.id)
                      }}
                      className="p-2 hover:bg-destructive/10 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                  </div>
                  <AnimatePresence>
                  {expandedTrip === trip.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.28, ease: [0.2,0.8,0.2,1] }}
                    className="border-t border-border p-4 space-y-4 overflow-hidden"
                  >
                    {/* Description */}
                    {trip.description && (
                      <p className="text-sm text-muted-foreground">
                        {trip.description}
                      </p>
                    )}

                      {/* Connections (wire links) */}
                      {tripLinks[trip.id] && tripLinks[trip.id].length > 0 && (
                        <div className="pt-2">
                          <h5 className="text-sm font-medium">Connections</h5>
                          <ul className="text-sm text-muted-foreground list-disc list-inside">
                            {tripLinks[trip.id].map((l: Link) => (
                              <li key={l.id}>{l.from_type} {l.from_id} → {l.to_type} {l.to_id}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                    {/* Flights Section */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold flex items-center gap-2">
                          <Plane className="w-4 h-4" />
                          Flights ({trip.flights?.length || 0})
                        </h4>
                        <div className="flex gap-2">
                          {/* AI analyze and manual grouping removed — use graph wire interface instead */}
                          <MagneticButton
                            onClick={() => {
                              setSelectedTripId(trip.id)
                              setShowFlightModal(true)
                            }}
                            className="text-xs bg-primary/10 text-primary hover:bg-primary/20 px-2 py-1 rounded transition-colors"
                            ariaLabel="Add Flight"
                          >
                            Add Flight
                          </MagneticButton>
                        </div>
                      </div>

                      {trip.flights && trip.flights.length > 0 ? (
                        <div className="space-y-2">
                          {trip.flights.map((flight) => (
                            <ContextMenu key={flight.id}>
                              <ContextMenuTrigger asChild>
                                <div className="p-3 bg-muted/30 rounded border border-border/50 flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-semibold">
                                        {flight.serial_number}. {flight.flight_number}
                                      </span>
                                      {flight.is_connecting_to_next && (
                                        <span className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
                                          Connecting ✈
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                      {flight.departure_airport} → {flight.arrival_airport}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {flight.departure_date} {flight.departure_time} →{' '}
                                      {flight.arrival_date} {flight.arrival_time}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => handleDeleteFlight(flight.id, trip.id)}
                                      className="p-2 hover:bg-destructive/10 rounded"
                                    >
                                      <Trash2 className="w-4 h-4 text-destructive" />
                                    </button>
                                    <button
                                      onClick={async () => {
                                        if (!linkingFrom) {
                                          setLinkingFrom({ type: 'flight', id: flight.id })
                                          return
                                        }
                                        try {
                                          const body = {
                                            action: 'create',
                                            tripId: trip.id,
                                            from_type: linkingFrom.type,
                                            from_id: linkingFrom.id,
                                            to_type: 'flight',
                                            to_id: flight.id,
                                          }
                                          const resp = await fetch('/api/event-links', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify(body),
                                          })
                                          const result = await resp.json()
                                          if (result.error) {
                                            toast({ title: 'Link failed', description: result.error?.message || 'Could not create link', variant: 'destructive' })
                                            return
                                          }
                                          setLinkingFrom(null)
                                          fetchLinksForTrip(trip.id)
                                          fetchTrips()
                                          toast({ title: 'Link created', description: 'Flight linked successfully' })
                                        } catch (err) {
                                          console.error('link create failed', err)
                                          // silently fail without showing toast
                                        }
                                      }}
                                      className={`p-2 rounded ${
                                        linkingFrom?.id === flight.id ? 'bg-primary/20' : 'hover:bg-muted/10'
                                      }`}
                                    >
                                      Link
                                    </button>
                                  </div>
                                </div>
                              </ContextMenuTrigger>

                              <ContextMenuContent>
                                <ContextMenuLabel>Flight actions</ContextMenuLabel>
                                <ContextMenuItem onSelect={() => { setSelectedTripId(trip.id); setShowFlightModal(true) }}>Edit</ContextMenuItem>
                                <ContextMenuItem onSelect={() => handleDeleteFlight(flight.id, trip.id)} variant="destructive">Delete</ContextMenuItem>
                                <ContextMenuItem onSelect={() => { setLinkingFrom({ type: 'flight', id: flight.id }); toast({ title: 'Link mode', description: 'Select target event to link.' }) }}>Start Link</ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuItem onSelect={() => { navigator.clipboard?.writeText(flight.id); toast({ title: 'Copied', description: 'Flight ID copied to clipboard.' }) }}>Copy ID</ContextMenuItem>
                                <ContextMenuItem onSelect={() => window.open(`/flights/graph/${trip.id}`, '_blank')}>Open Graph</ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          No flights added
                        </p>
                      )}
                    </div>

                    {/* Hotels Section */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold flex items-center gap-2">
                          <HotelIcon className="w-4 h-4" />
                          Hotels ({trip.hotels?.length || 0})
                        </h4>
                        <MagneticButton
                          onClick={() => {
                            setSelectedTripId(trip.id)
                            setShowHotelModal(true)
                          }}
                          className="text-xs bg-primary/10 text-primary hover:bg-primary/20 px-2 py-1 rounded transition-colors"
                          ariaLabel="Add Hotel"
                        >
                          Add Hotel
                        </MagneticButton>
                      </div>

                      {trip.hotels && trip.hotels.length > 0 ? (
                        <div className="space-y-2">
                          {trip.hotels.map((hotel) => (
                            <ContextMenu key={hotel.id}>
                              <ContextMenuTrigger asChild>
                                <div className="p-3 bg-muted/30 rounded border border-border/50 flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold">
                                        {hotel.serial_number}. {hotel.hotel_name}
                                      </span>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                      {hotel.address}, {hotel.city}, {hotel.country}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {hotel.check_in_date} → {hotel.check_out_date}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => handleDeleteHotel(hotel.id, trip.id)}
                                      className="p-2 hover:bg-destructive/10 rounded"
                                    >
                                      <Trash2 className="w-4 h-4 text-destructive" />
                                    </button>
                                    <button
                                      onClick={async () => {
                                        if (!linkingFrom) {
                                          setLinkingFrom({ type: 'hotel', id: hotel.id })
                                          return
                                        }
                                        try {
                                          const body = {
                                            action: 'create',
                                            tripId: trip.id,
                                            from_type: linkingFrom.type,
                                            from_id: linkingFrom.id,
                                            to_type: 'hotel',
                                            to_id: hotel.id,
                                          }
                                          const resp = await fetch('/api/event-links', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify(body),
                                          })
                                          const result = await resp.json()
                                          if (result.error) {
                                            toast({ title: 'Link failed', description: result.error?.message || 'Could not create link', variant: 'destructive' })
                                            return
                                          }
                                          setLinkingFrom(null)
                                          fetchLinksForTrip(trip.id)
                                          fetchTrips()
                                          toast({ title: 'Link created', description: 'Hotel linked successfully' })
                                        } catch (err) {
                                          console.error('link create failed', err)
                                          // silently fail without showing toast
                                        }
                                      }}
                                      className={`p-2 rounded ${
                                        linkingFrom?.id === hotel.id ? 'bg-primary/20' : 'hover:bg-muted/10'
                                      }`}
                                    >
                                      Link
                                    </button>
                                  </div>
                                </div>
                              </ContextMenuTrigger>

                              <ContextMenuContent>
                                <ContextMenuLabel>Hotel actions</ContextMenuLabel>
                                <ContextMenuItem onSelect={() => { setSelectedTripId(trip.id); setShowHotelModal(true) }}>Edit</ContextMenuItem>
                                <ContextMenuItem onSelect={() => handleDeleteHotel(hotel.id, trip.id)} variant="destructive">Delete</ContextMenuItem>
                                <ContextMenuItem onSelect={() => { setLinkingFrom({ type: 'hotel', id: hotel.id }); toast({ title: 'Link mode', description: 'Select target event to link.' }) }}>Start Link</ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuItem onSelect={() => { navigator.clipboard?.writeText(hotel.id); toast({ title: 'Copied', description: 'Hotel ID copied to clipboard.' }) }}>Copy ID</ContextMenuItem>
                                <ContextMenuItem onSelect={() => window.open(`/flights/graph/${trip.id}`, '_blank')}>Open Graph</ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          No hotels added
                        </p>
                      )}
                    </div>
                  </motion.div>
                  )}
                  </AnimatePresence>
                </div>
              </TiltCard>
              </motion.li>
            ))
          )}
        </motion.ul>
      </div>

      {/* Modals */}
      <TripModal
        isOpen={showNewTripModal}
        onClose={() => setShowNewTripModal(false)}
        onSuccess={fetchTrips}
      />
      <FlightModal
        isOpen={showFlightModal}
        tripId={selectedTripId}
        onClose={() => setShowFlightModal(false)}
        onSuccess={fetchTrips}
      />
      <HotelModal
        isOpen={showHotelModal}
        tripId={selectedTripId}
        onClose={() => setShowHotelModal(false)}
        onSuccess={fetchTrips}
      />
      {/* Grouping UI removed; use Graph interface instead */}
    </MainLayout>
  )
}
