'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { X } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface FlightModalProps {
  isOpen: boolean
  tripId: string | null
  onClose: () => void
  onSuccess?: (newId?: string) => void
  initialData?: any
  editingId?: string | null
}

export function FlightModal({
  isOpen,
  tripId,
  onClose,
  onSuccess,
  initialData,
  editingId = null,
}: FlightModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    flight_number: '',
    departure_airport: '',
    arrival_airport: '',
    departure_date: '',
    departure_time: '',
    arrival_date: '',
    arrival_time: '',
    airline_name: '',
    seat_number: '',
    booking_reference: '',
  })

  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // resolve tripId: prefer prop, fallback to localStorage (set when opening graph)
    let resolvedTripId = tripId ?? (typeof window !== 'undefined' ? localStorage.getItem('selectedTripId') : null)
    if (resolvedTripId === 'undefined') resolvedTripId = null
    // fallback: try to parse tripId from URL if present (/flights/graph/:tripId)
    if (!resolvedTripId && typeof window !== 'undefined') {
      const m = window.location.pathname.match(/\/flights\/graph\/([^\/\?]+)/)
      if (m) resolvedTripId = m[1]
    }

    // validate uuid
    const isUuid = (v: any) => typeof v === 'string' && /^[0-9a-fA-F-]{36}$/.test(v)
    if (!isUuid(resolvedTripId)) {
      toast({ title: 'Please select a trip first', description: 'Select a trip before adding flights', variant: 'destructive' })
      return
    }

    setLoading(true)

    try {
      console.log('Adding flight with data:', {
        trip_id: tripId,
        flight_number: formData.flight_number,
        departure_airport: formData.departure_airport,
        arrival_airport: formData.arrival_airport,
        departure_date: formData.departure_date,
        departure_time: formData.departure_time,
        arrival_date: formData.arrival_date,
        arrival_time: formData.arrival_time,
      })

      if (editingId) {
        const { data, error } = await supabase.from('trip_flights').update({
          flight_number: formData.flight_number,
          departure_airport: formData.departure_airport,
          arrival_airport: formData.arrival_airport,
          departure_date: formData.departure_date,
          departure_time: formData.departure_time,
          arrival_date: formData.arrival_date,
          arrival_time: formData.arrival_time,
          airline_name: formData.airline_name || null,
          seat_number: formData.seat_number || null,
          booking_reference: formData.booking_reference || null,
        }).eq('id', editingId).select()

        if (error) {
          console.error('Supabase error:', error)
          throw new Error(`${error.code}: ${error.message}`)
        }

        const newId = editingId
        toast({ title: 'Flight updated', description: 'Flight updated successfully' })
        onSuccess?.(newId)
        onClose()
        return
      }

      const { data, error } = await supabase.from('trip_flights').insert({
        trip_id: resolvedTripId,
        flight_number: formData.flight_number,
        departure_airport: formData.departure_airport,
        arrival_airport: formData.arrival_airport,
        departure_date: formData.departure_date,
        departure_time: formData.departure_time,
        arrival_date: formData.arrival_date,
        arrival_time: formData.arrival_time,
        airline_name: formData.airline_name || null,
        seat_number: formData.seat_number || null,
        booking_reference: formData.booking_reference || null,
      }).select('id').single()

      if (error) {
        console.error('Supabase error:', error)
        throw new Error(`${error.code}: ${error.message}`)
      }

      const newId = data?.id

      console.log('Flight added successfully:', data)

      setFormData({
        flight_number: '',
        departure_airport: '',
        arrival_airport: '',
        departure_date: '',
        departure_time: '',
        arrival_date: '',
        arrival_time: '',
        airline_name: '',
        seat_number: '',
        booking_reference: '',
      })

      toast({ title: 'Flight added', description: 'Flight added successfully' })
      onSuccess?.(newId)
      onClose()
    } catch (error: any) {
      console.error('Error creating flight:', error)
      toast({ title: 'Failed to add flight', description: error.message || 'Unknown error', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-lg max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4 sticky top-0 bg-card">
          <h2 className="text-xl font-semibold">Add Flight</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">
              Flight Number *
            </label>
            <input
              type="text"
              required
              value={formData.flight_number}
              onChange={(e) =>
                setFormData({ ...formData, flight_number: e.target.value })
              }
              placeholder="e.g., UA301"
              className="w-full px-3 py-2 bg-muted border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">
                Departure Airport *
              </label>
              <input
                type="text"
                required
                value={formData.departure_airport}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    departure_airport: e.target.value.toUpperCase(),
                  })
                }
                placeholder="e.g., LAX"
                maxLength={3}
                className="w-full px-3 py-2 bg-muted border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">
                Arrival Airport *
              </label>
              <input
                type="text"
                required
                value={formData.arrival_airport}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    arrival_airport: e.target.value.toUpperCase(),
                  })
                }
                placeholder="e.g., JFK"
                maxLength={3}
                className="w-full px-3 py-2 bg-muted border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">
                Departure Date *
              </label>
              <input
                type="date"
                required
                value={formData.departure_date}
                onChange={(e) =>
                  setFormData({ ...formData, departure_date: e.target.value })
                }
                className="w-full px-3 py-2 bg-muted border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">
                Departure Time *
              </label>
              <input
                type="time"
                required
                value={formData.departure_time}
                onChange={(e) =>
                  setFormData({ ...formData, departure_time: e.target.value })
                }
                className="w-full px-3 py-2 bg-muted border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">
                Arrival Date *
              </label>
              <input
                type="date"
                required
                value={formData.arrival_date}
                onChange={(e) =>
                  setFormData({ ...formData, arrival_date: e.target.value })
                }
                className="w-full px-3 py-2 bg-muted border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">
                Arrival Time *
              </label>
              <input
                type="time"
                required
                value={formData.arrival_time}
                onChange={(e) =>
                  setFormData({ ...formData, arrival_time: e.target.value })
                }
                className="w-full px-3 py-2 bg-muted border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">
              Airline Name
            </label>
            <input
              type="text"
              value={formData.airline_name}
              onChange={(e) =>
                setFormData({ ...formData, airline_name: e.target.value })
              }
              placeholder="e.g., United Airlines"
              className="w-full px-3 py-2 bg-muted border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">
              Seat Number
            </label>
            <input
              type="text"
              value={formData.seat_number}
              onChange={(e) =>
                setFormData({ ...formData, seat_number: e.target.value })
              }
              placeholder="e.g., 12A"
              className="w-full px-3 py-2 bg-muted border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">
              Booking Reference
            </label>
            <input
              type="text"
              value={formData.booking_reference}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  booking_reference: e.target.value,
                })
              }
              placeholder="e.g., ABC123"
              className="w-full px-3 py-2 bg-muted border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-border bg-muted text-foreground rounded hover:bg-muted/80 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Flight'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
