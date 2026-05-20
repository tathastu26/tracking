'use client'

import React, { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { Alert } from '@/components/ui/alert'

interface Flight {
  id: string
  flight_number: string
  departure_airport: string
  arrival_airport: string
  departure_date: string
  departure_time: string
  arrival_date: string
  arrival_time: string
  serial_number?: number
  connection_group?: string
}

interface FlightGroupingModalProps {
  isOpen: boolean
  onClose: () => void
  tripId: string
  flights: Flight[]
  onSuccess: () => void
}

export function FlightGroupingModal({
  isOpen,
  onClose,
  tripId,
  flights,
  onSuccess,
}: FlightGroupingModalProps) {
  const [groupAssignments, setGroupAssignments] = useState<
    Record<string, string>
  >(
    flights.reduce(
      (acc, flight) => ({
        ...acc,
        [flight.id]: flight.connection_group || 'standalone',
      }),
      {}
    )
  )
  const [customGroups, setCustomGroups] = useState<string[]>([])
  const [newGroupName, setNewGroupName] = useState('')
  const [showNewGroupInput, setShowNewGroupInput] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  // Extract existing groups from flights
  React.useEffect(() => {
    const groups = new Set(
      flights
        .map((f) => f.connection_group)
        .filter((g) => g && g !== 'standalone')
    )
    setCustomGroups(Array.from(groups))
  }, [flights])

  const handleAddGroup = () => {
    if (newGroupName.trim() && !customGroups.includes(newGroupName)) {
      setCustomGroups([...customGroups, newGroupName])
      setNewGroupName('')
      setShowNewGroupInput(false)
    }
  }

  const handleAssignGroup = (flightId: string, group: string) => {
    setGroupAssignments((prev) => ({
      ...prev,
      [flightId]: group,
    }))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)

      // Update each flight with its assigned group
      for (const [flightId, group] of Object.entries(groupAssignments)) {
        const { error: updateError } = await supabase
          .from('trip_flights')
          .update({ connection_group: group })
          .eq('id', flightId)

        if (updateError) throw updateError
      }

      // Re-calculate serial numbers and connections
      const { error: funcError } = await supabase.rpc('update_trip_serial_numbers', {
        p_trip_id: tripId,
      })

      if (funcError) throw funcError

      onSuccess()
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save groupings'
      setError(message)
      console.error('Error saving flight groupings:', err)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const availableGroups = ['standalone', ...customGroups]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-foreground">
            Group Connected Flights
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Assign flights to connection groups. Flights in the same group will be marked as
          connected. Use "standalone" for individual flights.
        </p>

        {error && (
          <Alert variant="destructive" className="mb-4">
            {error}
          </Alert>
        )}

        {/* Flights List with Group Assignment */}
        <div className="space-y-3 mb-6">
          {flights.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No flights in this trip
            </p>
          ) : (
            flights.map((flight) => (
              <div
                key={flight.id}
                className="p-3 bg-muted/30 rounded border border-border/50 space-y-2"
              >
                <div className="font-semibold text-sm">
                  {flight.serial_number}. {flight.flight_number} ({flight.departure_airport} →{' '}
                  {flight.arrival_airport})
                </div>
                <div className="text-xs text-muted-foreground">
                  {flight.departure_date} {flight.departure_time} →{' '}
                  {flight.arrival_date} {flight.arrival_time}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {availableGroups.map((group) => (
                    <button
                      key={group}
                      onClick={() => handleAssignGroup(flight.id, group)}
                      className={`text-xs px-3 py-1 rounded transition-colors ${
                        groupAssignments[flight.id] === group
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80 text-foreground'
                      }`}
                    >
                      {group}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Manage Groups */}
        <div className="border-t border-border pt-4 mb-6">
          <h3 className="font-semibold text-sm mb-3">Connection Groups</h3>
          <div className="space-y-2">
            {customGroups.map((group) => (
              <div key={group} className="flex items-center justify-between p-2 bg-muted/20 rounded">
                <span className="text-sm">{group}</span>
                <button
                  onClick={() =>
                    setCustomGroups(customGroups.filter((g) => g !== group))
                  }
                  className="text-xs text-destructive hover:text-destructive/80"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          {showNewGroupInput ? (
            <div className="flex gap-2 mt-3">
              <input
                type="text"
                placeholder="e.g., Europe to Asia"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddGroup()}
                className="flex-1 px-3 py-1 bg-muted border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
              <button
                onClick={handleAddGroup}
                className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90 transition-colors"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setShowNewGroupInput(false)
                  setNewGroupName('')
                }}
                className="px-3 py-1 bg-muted text-foreground rounded text-sm hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowNewGroupInput(true)}
              className="flex items-center gap-2 mt-3 text-sm text-primary hover:text-primary/80 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create New Group
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-muted text-foreground rounded hover:bg-muted/80 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Groups'}
          </button>
        </div>
      </div>
    </div>
  )
}
