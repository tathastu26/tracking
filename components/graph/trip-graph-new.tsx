'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Plus, Trash2, Link2, Link2Off, Plane, Hotel } from 'lucide-react'
import { FlightModal } from '@/components/modals/flight-modal'
import { HotelModal } from '@/components/modals/hotel-modal'
import { createClient } from '@/lib/supabase-client'
import { motion } from 'framer-motion'
import { toast } from '@/hooks/use-toast'
import type { Link } from '@/lib/types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface GraphNode {
  id: string
  type: 'flight' | 'hotel'
  title: string
  subtitle: string
  x: number
  y: number
}

interface PositionMap {
  [nodeId: string]: { x: number; y: number }
}

// ─── Position persistence ────────────────────────────────────────────────────

const POSITIONS_KEY = (tripId: string) => `graph_positions_${tripId}`

function loadPositions(tripId: string): PositionMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(POSITIONS_KEY(tripId))
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function savePositions(tripId: string, positions: PositionMap) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(POSITIONS_KEY(tripId), JSON.stringify(positions))
  } catch {}
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function TripGraph({
  tripId,
  onSaved,
}: {
  tripId: string | null
  onSaved?: () => void
}) {
  const supabase = createClient()
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [links, setLinks] = useState<Link[]>([])
  const [loading, setLoading] = useState(false)

  // Drag state
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const dragOffset = useRef({ x: 0, y: 0 })

  // Link-drawing state
  const [linkingFrom, setLinkingFrom] = useState<GraphNode | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  // Modals
  const [showFlightModal, setShowFlightModal] = useState(false)
  const [showHotelModal, setShowHotelModal] = useState(false)

  // Resolve current trip ID
  const currentTripId = (() => {
    if (typeof tripId === 'string' && tripId && tripId !== 'undefined') return tripId
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('selectedTripId')
      if (stored && stored !== 'undefined') return stored
      const m = window.location.pathname.match(/\/flights\/graph\/([^\/\?]+)/)
      if (m?.[1] && m[1] !== 'undefined') return m[1]
    }
    return null
  })()

  // Load trip data with saved positions
  const loadTrip = useCallback(async () => {
    if (!currentTripId) return
    setLoading(true)
    try {
      const [{ data: flights }, { data: hotels }, { data: linkRows }] = await Promise.all([
        supabase.from('trip_flights').select('*').eq('trip_id', currentTripId).order('departure_date'),
        supabase.from('trip_hotels').select('*').eq('trip_id', currentTripId).order('check_in_date'),
        supabase.from('trip_event_links').select('*').eq('trip_id', currentTripId),
      ])

      const savedPositions = loadPositions(currentTripId)
      const newNodes: GraphNode[] = []

      ;(flights || []).forEach((f: any, idx: number) => {
        const saved = savedPositions[f.id]
        newNodes.push({
          id: f.id,
          type: 'flight',
          title: f.flight_number || 'Flight',
          subtitle: `${f.departure_airport} → ${f.arrival_airport}`,
          x: saved?.x ?? 80 + idx * 220,
          y: saved?.y ?? 80,
        })
      })

      ;(hotels || []).forEach((h: any, idx: number) => {
        const saved = savedPositions[h.id]
        newNodes.push({
          id: h.id,
          type: 'hotel',
          title: h.hotel_name || 'Hotel',
          subtitle: [h.city, h.country].filter(Boolean).join(', '),
          x: saved?.x ?? 80 + idx * 220,
          y: saved?.y ?? 320,
        })
      })

      setNodes(newNodes)
      setLinks((linkRows || []) as Link[])
    } finally {
      setLoading(false)
    }
  }, [currentTripId, supabase])

  useEffect(() => {
    loadTrip()
  }, [loadTrip])

  // Mouse move for linking preview and dragging
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY })
      
      if (draggingId) {
        setNodes((prev) =>
          prev.map((n) =>
            n.id === draggingId
              ? { ...n, x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y }
              : n
          )
        )
      }
    }

    const onUp = () => {
      if (draggingId) {
        // Save positions to localStorage
        const newPositions = nodes.reduce(
          (acc, n) => ({ ...acc, [n.id]: { x: n.x, y: n.y } }),
          {} as PositionMap
        )
        savePositions(currentTripId!, newPositions)
        setDraggingId(null)
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [draggingId, nodes, currentTripId])

  // Handlers
  const startDrag = (e: React.MouseEvent, node: GraphNode) => {
    dragOffset.current = { x: e.clientX - node.x, y: e.clientY - node.y }
    setDraggingId(node.id)
  }

  const handleNodeClick = async (node: GraphNode) => {
    if (!linkingFrom) {
      setLinkingFrom(node)
      return
    }

    if (linkingFrom.id === node.id) {
      setLinkingFrom(null)
      return
    }

    if (!currentTripId) {
      toast({ title: 'Trip ID not resolved', description: 'Trip ID not resolved', variant: 'destructive' })
      return
    }

    // Create link via API
    try {
      const res = await fetch('/api/event-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          tripId: currentTripId,
          from_type: linkingFrom.type,
          from_id: linkingFrom.id,
          to_type: node.type,
          to_id: node.id,
        }),
      })

      if (!res.ok) throw new Error('Failed to create link')

      // Refresh links and recalculate
      await loadTrip()
      
      // Call recalc-serials to update is_connecting_to_next
      await fetch('/api/recalc-serials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId: currentTripId }),
      })

      setLinkingFrom(null)
    } catch (err) {
      console.error('Failed to create link:', err)
      toast({ title: 'Failed to create link', description: String(err), variant: 'destructive' })
      setLinkingFrom(null)
    }
  }

  const deleteLink = async (link: Link) => {
    if (!currentTripId) return

    try {
      const res = await fetch('/api/event-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: link.id }),
      })

      if (!res.ok) throw new Error('Failed to delete link')

      // Refresh and recalculate
      await loadTrip()

      await fetch('/api/recalc-serials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId: currentTripId }),
      })
    } catch (err) {
      console.error('Failed to delete link:', err)
      toast({ title: 'Failed to delete link', description: String(err), variant: 'destructive' })
    }
  }

  const deleteNode = async (nodeId: string) => {
    if (!currentTripId || !confirm('Delete node and all connected wires?')) return

    try {
      const nodeType = nodes.find((n) => n.id === nodeId)?.type

      // Delete node entity
      if (nodeType === 'flight') {
        await supabase.from('trip_flights').delete().eq('id', nodeId)
      } else {
        await supabase.from('trip_hotels').delete().eq('id', nodeId)
      }

      // Clear saved position
      const positions = loadPositions(currentTripId)
      delete positions[nodeId]
      savePositions(currentTripId, positions)

      // Refresh
      await loadTrip()
    } catch (err) {
      console.error('Failed to delete node:', err)
      toast({ title: 'Failed to delete node', description: String(err), variant: 'destructive' })
    }
  }

  const nodeCenter = (node: GraphNode) => ({ x: node.x + 130, y: node.y + 40 })

  const isConnecting = (nodeId: string) => {
    return links.some(
      (l) =>
        (l.from_id === nodeId || l.to_id === nodeId) &&
        nodes.find((n) => n.id === l.from_id)?.type === 'flight' &&
        nodes.find((n) => n.id === l.to_id)?.type === 'flight'
    )
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-screen relative rounded overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(15,23,42,0.4) 0%, rgba(30,27,55,0.2) 100%)',
      }}
    >
      {/* Grid background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: `
            linear-gradient(0deg, transparent 24%, rgba(255,255,255,.05) 25%, rgba(255,255,255,.05) 26%, transparent 27%, transparent 74%, rgba(255,255,255,.05) 75%, rgba(255,255,255,.05) 76%, transparent 77%, transparent),
            linear-gradient(90deg, transparent 24%, rgba(255,255,255,.05) 25%, rgba(255,255,255,.05) 26%, transparent 27%, transparent 74%, rgba(255,255,255,.05) 75%, rgba(255,255,255,.05) 76%, transparent 77%, transparent)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* SVG for wires */}
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Flight-to-flight wire gradient */}
          <linearGradient id="wireGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.8" />
          </linearGradient>

          {/* Standard wire gradient */}
          <linearGradient id="linkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.6" />
          </linearGradient>

          {/* Arrowhead marker */}
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill="rgba(148, 163, 184, 0.6)" />
          </marker>
        </defs>

        {/* Draw wires */}
        {links.map((link) => {
          const fromNode = nodes.find((n) => n.id === link.from_id)
          const toNode = nodes.find((n) => n.id === link.to_id)

          if (!fromNode || !toNode) return null

          const from = nodeCenter(fromNode)
          const to = nodeCenter(toNode)

          const bothFlights =
            fromNode.type === 'flight' && toNode.type === 'flight'

          return (
            <g key={`link-${link.id}`} className="pointer-events-auto">
              {/* Wire path */}
              <path
                d={`M ${from.x} ${from.y} Q ${(from.x + to.x) / 2} ${from.y} ${to.x} ${to.y}`}
                stroke={bothFlights ? 'url(#wireGrad)' : 'url(#linkGrad)'}
                strokeWidth={bothFlights ? 4 : 3}
                fill="none"
                strokeLinecap="round"
                markerEnd="url(#arrowhead)"
              />

              {/* Delete button (click zone) */}
              <circle
                cx={(from.x + to.x) / 2}
                cy={(from.y + to.y) / 2}
                r={10}
                fill="transparent"
                stroke="transparent"
                strokeWidth={20}
                style={{ cursor: 'pointer' }}
                onClick={() => deleteLink(link)}
                className="hover:opacity-50"
              />
            </g>
          )
        })}

        {/* Link preview while drawing */}
        {linkingFrom && (
          <path
            d={`M ${nodeCenter(linkingFrom).x} ${nodeCenter(linkingFrom).y} Q ${
              (nodeCenter(linkingFrom).x + mousePos.x) / 2
            } ${nodeCenter(linkingFrom).y} ${mousePos.x} ${mousePos.y}`}
            stroke="#60a5fa"
            strokeWidth={2}
            fill="none"
            strokeDasharray="5,5"
            opacity={0.5}
          />
        )}
      </svg>

      {/* Toolbar */}
      <motion.div
        className="absolute top-4 left-4 z-40 flex items-center gap-2 p-3 rounded-lg"
        style={{
          background: 'rgba(15,23,42,0.6)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <button
          onClick={() => setShowFlightModal(true)}
          className="flex items-center gap-2 px-3 py-2 rounded text-sm hover:bg-cyan-500/10 transition-colors"
        >
          <Plus className="w-4 h-4 text-cyan-400" /> Add Flight
        </button>
        <button
          onClick={() => setShowHotelModal(true)}
          className="flex items-center gap-2 px-3 py-2 rounded text-sm hover:bg-violet-500/10 transition-colors"
        >
          <Plus className="w-4 h-4 text-violet-400" /> Add Hotel
        </button>
      </motion.div>

      {/* Stats badge */}
      <motion.div
        className="absolute top-4 right-4 z-40 p-3 rounded-lg text-sm"
        style={{
          background: 'rgba(15,23,42,0.6)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <div className="text-muted-foreground">
          {nodes.length} nodes · {links.length} wires
        </div>
      </motion.div>

      {/* Nodes */}
      {nodes.map((node) => (
        <motion.div
          key={node.id}
          className={`absolute w-60 p-4 rounded-lg cursor-move pointer-events-auto z-30 transition-all ${
            node.type === 'flight'
              ? 'bg-cyan-500/5 border border-cyan-500/20'
              : 'bg-violet-500/5 border border-violet-500/20'
          }`}
          style={{ left: node.x, top: node.y }}
          onMouseDown={(e) => startDrag(e, node)}
          onClick={() => handleNodeClick(node)}
          whileHover={{ scale: 1.02 }}
          drag={false}
          animate={draggingId === node.id ? { scale: 1.05 } : { scale: 1 }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="font-semibold text-sm">{node.title}</div>
              <div className="text-xs text-muted-foreground mt-1">{node.subtitle}</div>
              <div className="flex gap-2 mt-3">
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    node.type === 'flight'
                      ? 'bg-cyan-500/15 text-cyan-300'
                      : 'bg-violet-500/15 text-violet-300'
                  }`}
                >
                  {node.type === 'flight' ? '✈ Flight' : '🏨 Hotel'}
                </span>
                {isConnecting(node.id) && node.type === 'flight' && (
                  <span className="text-xs px-2 py-1 rounded bg-emerald-500/15 text-emerald-300">
                    Connecting
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1 ml-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleNodeClick(node)
                }}
                className="p-1.5 rounded hover:bg-white/10 transition-colors"
                title="Link to another node"
              >
                <Link2 className="w-4 h-4 text-amber-400" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  deleteNode(node.id)
                }}
                className="p-1.5 rounded hover:bg-red-500/10 transition-colors"
                title="Delete node"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
              </button>
            </div>
          </div>
        </motion.div>
      ))}

      {/* Modals */}
      <FlightModal
        isOpen={showFlightModal}
        tripId={currentTripId}
        onClose={() => setShowFlightModal(false)}
        onSuccess={(newId?: string) => {
          if (newId) {
            // Initialize position for new node
            const positions = loadPositions(currentTripId!)
            if (!positions[newId]) {
              positions[newId] = { x: 80 + nodes.length * 220, y: 80 }
              savePositions(currentTripId!, positions)
            }
            loadTrip()
          }
          setShowFlightModal(false)
          if (onSaved) onSaved()
        }}
      />

      <HotelModal
        isOpen={showHotelModal}
        tripId={currentTripId}
        onClose={() => setShowHotelModal(false)}
        onSuccess={(newId?: string) => {
          if (newId) {
            const positions = loadPositions(currentTripId!)
            if (!positions[newId]) {
              positions[newId] = { x: 80 + nodes.length * 220, y: 320 }
              savePositions(currentTripId!, positions)
            }
            loadTrip()
          }
          setShowHotelModal(false)
          if (onSaved) onSaved()
        }}
      />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm z-50">
          <div className="text-muted-foreground">Loading trip...</div>
        </div>
      )}
    </div>
  )
}
