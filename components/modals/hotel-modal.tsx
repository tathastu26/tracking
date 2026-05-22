'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { X } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface HotelModalProps {
  isOpen: boolean
  tripId: string | null
  onClose: () => void
  onSuccess?: (newId?: string) => void
  initialData?: any
  editingId?: string | null
}

export function HotelModal({
  isOpen,
  tripId,
  onClose,
  onSuccess,
  initialData,
  editingId = null,
}: HotelModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    hotel_name: '',
    address: '',
    city: '',
    country: '',
    check_in_date: '',
    check_in_time: '14:00',
    check_out_date: '',
    check_out_time: '11:00',
    room_number: '',
    booking_reference: '',
  })

  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // resolve tripId: prefer prop, fallback to localStorage (set when opening graph)
    let resolvedTripId = tripId ?? (typeof window !== 'undefined' ? localStorage.getItem('selectedTripId') : null)
    if (resolvedTripId === 'undefined') resolvedTripId = null
    if (!resolvedTripId && typeof window !== 'undefined') {
      const m = window.location.pathname.match(/\/flights\/graph\/([^\/\?]+)/)
      if (m) resolvedTripId = m[1]
    }

    const isUuid = (v: any) => typeof v === 'string' && /^[0-9a-fA-F-]{36}$/.test(v)
    if (!isUuid(resolvedTripId)) {
      toast({ title: 'Please select a trip first', description: 'Select a trip before adding hotels', variant: 'destructive' })
      return
    }

    // Basic validation: ensure hotel check-in is not before any flight arrival in the trip
    if (resolvedTripId && formData.check_in_date) {
      // build ISO timestamp
      const hotelCheckInISO = `${formData.check_in_date}T${formData.check_in_time || '00:00'}`
      try {
        const { data: flights } = await supabase
          .from('trip_flights')
          .select('id, departure_date, departure_time, arrival_date, arrival_time')
          .eq('trip_id', resolvedTripId)

        if (flights && flights.length > 0) {
          const hotelTs = new Date(hotelCheckInISO).getTime()
          const problematic = flights.find((f: any) => {
            const arrivalTs = new Date(
              `${f.arrival_date}T${f.arrival_time}`
            ).getTime()
            return arrivalTs > hotelTs
          })
          if (problematic) {
            const proceed = confirm(
              'This hotel check-in is before one or more flight arrivals in this trip. Are you sure you want to continue?'
            )
            if (!proceed) return
          }
        }
      } catch (err) {
        console.error('Error validating hotel timeframe:', err)
      }
    }

    setLoading(true)

    try {
      console.log('Adding hotel with data:', {
        trip_id: tripId,
        hotel_name: formData.hotel_name,
        address: formData.address,
        city: formData.city,
        country: formData.country,
        check_in_date: formData.check_in_date,
        check_out_date: formData.check_out_date,
      })

      if (editingId) {
        const { data, error } = await supabase.from('trip_hotels').update({
          hotel_name: formData.hotel_name,
          address: formData.address,
          city: formData.city,
          country: formData.country,
          check_in_date: formData.check_in_date,
          check_in_time: formData.check_in_time,
          check_out_date: formData.check_out_date,
          check_out_time: formData.check_out_time,
          room_number: formData.room_number || null,
          booking_reference: formData.booking_reference || null,
        }).eq('id', editingId).select()

        if (error) {
          console.error('Supabase error:', error)
          throw new Error(`${error.code}: ${error.message}`)
        }

        const newId = editingId
        toast({ title: 'Hotel updated', description: 'Hotel updated successfully' })
        onSuccess?.(newId)
        onClose()
        return
      }

      const { data, error } = await supabase.from('trip_hotels').insert({
        trip_id: resolvedTripId,
        hotel_name: formData.hotel_name,
        address: formData.address,
        city: formData.city,
        country: formData.country,
        check_in_date: formData.check_in_date,
        check_in_time: formData.check_in_time,
        check_out_date: formData.check_out_date,
        check_out_time: formData.check_out_time,
        room_number: formData.room_number || null,
        booking_reference: formData.booking_reference || null,
      }).select('id').single()

      if (error) {
        console.error('Supabase error:', error)
        throw new Error(`${error.code}: ${error.message}`)
      }

      console.log('Hotel added successfully:', data)

      setFormData({
        hotel_name: '',
        address: '',
        city: '',
        country: '',
        check_in_date: '',
        check_in_time: '14:00',
        check_out_date: '',
        check_out_time: '11:00',
        room_number: '',
        booking_reference: '',
      })

      const newId = data?.id
      toast({ title: 'Hotel added', description: 'Hotel added successfully' })
      onSuccess?.(newId)
      onClose()
    } catch (error: any) {
      console.error('Error creating hotel:', error)
      toast({ title: 'Failed to add hotel', description: error.message || 'Unknown error', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-lg max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4 sticky top-0 bg-card">
          <h2 className="text-xl font-semibold">Add Hotel</h2>
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
              Hotel Name *
            </label>
            <input
              type="text"
              required
              value={formData.hotel_name}
              onChange={(e) =>
                setFormData({ ...formData, hotel_name: e.target.value })
              }
              placeholder="e.g., The Plaza Hotel"
              className="w-full px-3 py-2 bg-muted border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">
              Address *
            </label>
            <input
              type="text"
              required
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              placeholder="e.g., 123 Main Street"
              className="w-full px-3 py-2 bg-muted border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">
                City *
              </label>
              <input
                type="text"
                required
                value={formData.city}
                onChange={(e) =>
                  setFormData({ ...formData, city: e.target.value })
                }
                placeholder="e.g., New York"
                className="w-full px-3 py-2 bg-muted border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">
                Country *
              </label>
              <input
                type="text"
                required
                value={formData.country}
                onChange={(e) =>
                  setFormData({ ...formData, country: e.target.value })
                }
                placeholder="e.g., USA"
                className="w-full px-3 py-2 bg-muted border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">
                Check-In Date *
              </label>
              <input
                type="date"
                required
                value={formData.check_in_date}
                onChange={(e) =>
                  setFormData({ ...formData, check_in_date: e.target.value })
                }
                className="w-full px-3 py-2 bg-muted border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">
                Check-In Time
              </label>
              <input
                type="time"
                value={formData.check_in_time}
                onChange={(e) =>
                  setFormData({ ...formData, check_in_time: e.target.value })
                }
                className="w-full px-3 py-2 bg-muted border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">
                Check-Out Date *
              </label>
              <input
                type="date"
                required
                value={formData.check_out_date}
                onChange={(e) =>
                  setFormData({ ...formData, check_out_date: e.target.value })
                }
                className="w-full px-3 py-2 bg-muted border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">
                Check-Out Time
              </label>
              <input
                type="time"
                value={formData.check_out_time}
                onChange={(e) =>
                  setFormData({ ...formData, check_out_time: e.target.value })
                }
                className="w-full px-3 py-2 bg-muted border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">
              Room Number
            </label>
            <input
              type="text"
              value={formData.room_number}
              onChange={(e) =>
                setFormData({ ...formData, room_number: e.target.value })
              }
              placeholder="e.g., 1205"
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
              placeholder="e.g., REF123456"
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
              {loading ? 'Adding...' : 'Add Hotel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
