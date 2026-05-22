'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { X } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface TripModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function TripModal({ isOpen, onClose, onSuccess }: TripModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    trip_name: '',
    start_date: '',
    end_date: '',
    description: '',
    status: 'planning',
  })

  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('User not authenticated')
      }

      console.log('Creating trip for user:', user.id)

      const { data, error } = await supabase.from('trips').insert({
        profile_id: user.id,
        trip_name: formData.trip_name,
        start_date: formData.start_date,
        end_date: formData.end_date,
        description: formData.description,
        status: formData.status,
      })

      if (error) {
        console.error('Supabase error:', error)
        throw new Error(`${error.code}: ${error.message}`)
      }

      console.log('Trip created successfully:', data)

      setFormData({
        trip_name: '',
        start_date: '',
        end_date: '',
        description: '',
        status: 'planning',
      })

      toast({ title: 'Trip created', description: 'Trip created successfully' })
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Error creating trip:', error)
      toast({ title: 'Failed to create trip', description: error.message || 'Unknown error', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-lg max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Create New Trip</h2>
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
              Trip Name *
            </label>
            <input
              type="text"
              required
              value={formData.trip_name}
              onChange={(e) =>
                setFormData({ ...formData, trip_name: e.target.value })
              }
              placeholder="e.g., European Summer Adventure"
              className="w-full px-3 py-2 bg-muted border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">
                Start Date *
              </label>
              <input
                type="date"
                required
                value={formData.start_date}
                onChange={(e) =>
                  setFormData({ ...formData, start_date: e.target.value })
                }
                className="w-full px-3 py-2 bg-muted border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">
                End Date *
              </label>
              <input
                type="date"
                required
                value={formData.end_date}
                onChange={(e) =>
                  setFormData({ ...formData, end_date: e.target.value })
                }
                className="w-full px-3 py-2 bg-muted border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Add trip details..."
              rows={3}
              className="w-full px-3 py-2 bg-muted border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value })
              }
              className="w-full px-3 py-2 bg-muted border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="planning">Planning</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
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
              {loading ? 'Creating...' : 'Create Trip'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
