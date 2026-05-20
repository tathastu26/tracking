'use client'

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Plus, Trash2, Link2, Link2Off, Plane, Hotel, Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw, Edit3, ChevronLeft, ChevronRight } from 'lucide-react'
import { FlightModal } from '@/components/modals/flight-modal'
import { HotelModal } from '@/components/modals/hotel-modal'
import { createClient } from '@/lib/supabase-client'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from '@/hooks/use-toast'
import type { Link } from '@/lib/types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface GraphNode {
  id: string
  type: 'flight' | 'hotel'
  title: string   // flight_number or hotel_name
  subtitle: string  // "DEP → ARR" or "City, Country"
  x: number
  y: number
  details: Record<string, any>
}

interface PositionMap {
  [nodeId: string]: { x: number; y: number }
}

const CANVAS_WORLD_SIZE = 8000
const MIN_ZOOM = 0.45
const MAX_ZOOM = 2.2

// ─── Position persistence (localStorage) ─────────────────────────────────────

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
  // fire-and-forget server sync
  try {
    void savePositionsServer(tripId, positions)
  } catch {}
}

async function loadPositionsServer(tripId: string): Promise<PositionMap> {
  try {
    const resp = await fetch(`/api/graph/positions?tripId=${encodeURIComponent(tripId)}`)
    if (!resp.ok) return {}
    const data = await resp.json()
    return data?.positions || {}
  } catch {
    return {}
  }
}

async function savePositionsServer(tripId: string, positions: PositionMap) {
  try {
    await fetch('/api/graph/positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId, positions }),
    })
  } catch (e) {
    // ignore server save failures
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TripGraph({
  tripId,
  initialFlights = [],
  initialHotels = [],
  initialLinks = [],
  onSaved,
}: {
  tripId: string | null
  initialFlights?: any[]
  initialHotels?: any[]
  initialLinks?: Link[]
  onSaved?: () => void
}) {
  const initialLoadedTripIdRef = useRef<string | null>(null)

  // If SSR provided a tripId, prefer it. This avoids Vercel/client hydration timing issues.
  const ssrTripId = tripId

  useEffect(() => {
    if (ssrTripId) initialLoadedTripIdRef.current = ssrTripId
  }, [ssrTripId])
  const supabase = useMemo(() => createClient(), [])
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)

  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [links, setLinks] = useState<Link[]>([])
  const [loading, setLoading] = useState(false)

  // Drag state
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const dragOffset = useRef({ x: 0, y: 0 })

  // Link-drawing state
  const [linkingFrom, setLinkingFrom] = useState<GraphNode | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [showTripEditor, setShowTripEditor] = useState(false)
  const [isInspectorOpen, setIsInspectorOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [tripDetails, setTripDetails] = useState<Record<string, any> | null>(null)
  const [tripForm, setTripForm] = useState<Record<string, string>>({})
  const [nodeForm, setNodeForm] = useState<Record<string, string>>({})
  const [savingNode, setSavingNode] = useState(false)
  const [savingTrip, setSavingTrip] = useState(false)
  const [saveBadge, setSaveBadge] = useState<string | null>(null)
  const [saveBadgeVisible, setSaveBadgeVisible] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null)

  // Modals
  const [showFlightModal, setShowFlightModal] = useState(false)
  const [showHotelModal, setShowHotelModal] = useState(false)

  // Resolve current trip ID — stable via useMemo so it doesn't fluctuate between renders
  const currentTripId = useMemo(() => {
    if (typeof tripId === 'string' && tripId && tripId !== 'undefined') return tripId
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('selectedTripId')
      if (stored && stored !== 'undefined') return stored
      const m = window.location.pathname.match(/\/flights\/graph\/([^\/\?]+)/)
      if (m?.[1] && m[1] !== 'undefined') return m[1]
    }
    return null
  }, [tripId])

  const getEditableEntries = useCallback((obj: Record<string, any> | null | undefined) => {
    if (!obj) return [] as Array<[string, any]>
    const blocked = new Set(['id', 'trip_id', 'profile_id', 'created_at', 'updated_at'])
    return Object.entries(obj).filter(([key, value]) => {
      if (blocked.has(key)) return false
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) return false
      return true
    })
  }, [])

  const toInputString = (value: any): string => {
    if (value === null || value === undefined) return ''
    return String(value)
  }

  const coerceValue = (raw: string, original: any) => {
    if (raw === '') {
      if (typeof original === 'number') return null
      if (typeof original === 'boolean') return false
      return null
    }

    if (typeof original === 'number') {
      const n = Number(raw)
      return Number.isFinite(n) ? n : original
    }

    if (typeof original === 'boolean') {
      return raw === 'true'
    }

    return raw
  }

  const labelize = (key: string) => key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  const showSavedBadge = (message: string) => {
    setSaveBadge(message)
    setSaveBadgeVisible(true)
    window.setTimeout(() => {
      setSaveBadgeVisible(false)
    }, 1600)
    window.setTimeout(() => {
      setSaveBadge((current: string | null) => (current === message ? null : current))
    }, 2000)
  }

  // ── Load trip data ──────────────────────────────────────────────────────────

  const loadTrip = useCallback(async () => {
    if (!currentTripId) return
    setLoading(true)
    try {
      const [
        { data: flights, error: flightsError },
        { data: hotels, error: hotelsError },
        { data: linkRows, error: linksError },
        { data: tripRow, error: tripError },
      ] = await Promise.all([
        supabase
          .from('trip_flights')
          .select('*')
          .eq('trip_id', currentTripId)
          .order('departure_date', { ascending: true }),
        supabase
          .from('trip_hotels')
          .select('*')
          .eq('trip_id', currentTripId)
          .order('check_in_date', { ascending: true }),
        supabase
          .from('trip_event_links')
          .select('*')
          .eq('trip_id', currentTripId),
        supabase
          .from('trips')
          .select('*')
          .eq('id', currentTripId)
          .single(),
      ])

      if (flightsError || hotelsError || linksError || tripError) {
        throw flightsError || hotelsError || linksError || tripError
      }

      const flightRows = (flights?.length ? flights : initialFlights) || []
      const hotelRows = (hotels?.length ? hotels : initialHotels) || []
      const linkRowsToUse = (linkRows?.length ? linkRows : initialLinks) || []

      let savedPositions = loadPositions(currentTripId)
      if (!savedPositions || Object.keys(savedPositions).length === 0) {
        const serverPositions = await loadPositionsServer(currentTripId)
        if (serverPositions && Object.keys(serverPositions).length > 0) {
          savedPositions = serverPositions
          try { localStorage.setItem(POSITIONS_KEY(currentTripId), JSON.stringify(serverPositions)) } catch {}
        }
      }

      const newNodes: GraphNode[] = []

      ;(flightRows || []).forEach((f: any, idx: number) => {
        const saved = savedPositions[f.id]
        newNodes.push({
          id: f.id,
          type: 'flight',
          title: f.flight_number || 'Flight',
          subtitle: `${f.departure_airport} → ${f.arrival_airport}`,
          x: saved?.x ?? 80 + idx * 220,
          y: saved?.y ?? 80,
          details: f,
        })
      })

      ;(hotelRows || []).forEach((h: any, idx: number) => {
        const saved = savedPositions[h.id]
        newNodes.push({
          id: h.id,
          type: 'hotel',
          title: h.hotel_name || 'Hotel',
          subtitle: [h.city, h.country].filter(Boolean).join(', '),
          x: saved?.x ?? 80 + idx * 220,
          y: saved?.y ?? 320,
          details: h,
        })
      })

      setNodes(newNodes)
      setLinks((linkRowsToUse || []) as Link[])
      setTripDetails((tripRow || null) as Record<string, any> | null)
    } finally {
      setLoading(false)
    }
  }, [currentTripId, supabase, initialFlights, initialHotels, initialLinks])

  useEffect(() => {
    loadTrip()
  }, [loadTrip])

  // ── Save positions on node move ──────────────────────────────────────────────

  const persistPositions = useCallback((updatedNodes: GraphNode[]) => {
    if (!currentTripId) return
    const map: PositionMap = {}
    updatedNodes.forEach(n => { map[n.id] = { x: n.x, y: n.y } })
    savePositions(currentTripId, map)
  }, [currentTripId])

  // ── Mouse / drag handling ────────────────────────────────────────────────────

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const viewport = viewportRef.current
      if (!viewport) return
      const rect = viewport.getBoundingClientRect()
      const mx = (e.clientX - rect.left + viewport.scrollLeft) / zoom
      const my = (e.clientY - rect.top + viewport.scrollTop) / zoom

      setMousePos({ x: mx, y: my })

      if (draggingId) {
        setNodes(prev => {
          const updated = prev.map(n =>
            n.id === draggingId
              ? { ...n, x: mx - dragOffset.current.x, y: my - dragOffset.current.y }
              : n
          )
          return updated
        })
      }
    }

    const onMouseUp = () => {
      if (draggingId) {
        // persist after drop
        setNodes(prev => {
          persistPositions(prev)
          return prev
        })
        setDraggingId(null)
      }
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [draggingId, persistPositions, zoom])

  const startDrag = (e: React.MouseEvent, node: GraphNode) => {
    // Don't start drag if we're in link mode
    if (linkingFrom) return
    e.stopPropagation()
    setSelectedNode(node)
    setShowTripEditor(false)
    setIsInspectorOpen(true)
    if (linkingFrom) setLinkingFrom(null)
    const viewport = viewportRef.current
    if (!viewport) return
    const rect = viewport.getBoundingClientRect()
    const worldX = (e.clientX - rect.left + viewport.scrollLeft) / zoom
    const worldY = (e.clientY - rect.top + viewport.scrollTop) / zoom
    dragOffset.current = {
      x: worldX - node.x,
      y: worldY - node.y,
    }
    setDraggingId(node.id)
  }

  // ── Link handling ────────────────────────────────────────────────────────────

  const handleLinkCreation = async (fromNode: GraphNode, toNode: GraphNode) => {
    const exists = links.some(
      l =>
        (l.from_id === fromNode.id && l.to_id === toNode.id) ||
        (l.from_id === toNode.id && l.to_id === fromNode.id)
    )

    if (exists) {
      return
    }

    try {
      const resp = await fetch('/api/event-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          tripId: currentTripId,
          from_type: fromNode.type,
          from_id: fromNode.id,
          to_type: toNode.type,
          to_id: toNode.id,
        }),
      })

      const data = await resp.json().catch(() => ({} as any))
      if (!resp.ok || data?.error) {
        throw new Error(
          typeof data?.error === 'string'
            ? data.error
            : data?.error?.message || 'Failed to create link'
        )
      }

      await recalcConnectingFlights()
      await loadTrip()
    } catch (err: any) {
      console.error('Failed to create link', err)
      toast({ title: 'Failed to create link', description: err?.message || String(err), variant: 'destructive' })
    }
  }

  // Pointer-based pan handlers: listen globally and pan viewport when dragging empty space
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const viewport = viewportRef.current
      if (!viewport) return
      // only start pan when pointer down on empty viewport (not on interactive nodes)
      if ((e.target as HTMLElement).closest('[data-node]')) return
      setIsPanning(true)
      panStart.current = { x: e.clientX, y: e.clientY, scrollLeft: viewport.scrollLeft, scrollTop: viewport.scrollTop }
      ;(e.target as HTMLElement).setPointerCapture?.((e as any).pointerId)
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!isPanning) return
      const viewport = viewportRef.current
      if (!viewport || !panStart.current) return
      const dx = e.clientX - panStart.current.x
      const dy = e.clientY - panStart.current.y
      viewport.scrollLeft = panStart.current.scrollLeft - dx
      viewport.scrollTop = panStart.current.scrollTop - dy
    }

    const onPointerUpGlobal = () => {
      if (isPanning) {
        setIsPanning(false)
        panStart.current = null
      }
    }

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUpGlobal)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUpGlobal)
    }
  }, [isPanning])

  const handleLinkButtonClick = async (node: GraphNode) => {
    if (draggingId) return

    if (!linkingFrom) {
      setLinkingFrom(node)
      return
    }

    if (linkingFrom.id === node.id) {
      setLinkingFrom(null)
      return
    }

    await handleLinkCreation(linkingFrom, node)
    setLinkingFrom(null)
  }

  const deleteLink = async (link: Link) => {
    try {
      await fetch('/api/event-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: link.id }),
      })
      await recalcConnectingFlights()
      await loadTrip()
    } catch (err) {
      console.error('Failed to delete link', err)
    }
  }

  const deleteNode = async (nodeId: string, nodeType: 'flight' | 'hotel') => {
    if (!confirm('Delete this node and its connections?')) return
    try {
      // Delete all event links referencing this node
      const toDelete = links.filter(l => l.from_id === nodeId || l.to_id === nodeId)
      await Promise.all(
        toDelete.map(l =>
          fetch('/api/event-links', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', id: l.id }),
          })
        )
      )

      // Delete from Supabase
      if (nodeType === 'flight') {
        await supabase.from('trip_flights').delete().eq('id', nodeId)
      } else {
        await supabase.from('trip_hotels').delete().eq('id', nodeId)
      }

      // Remove from saved positions
      if (currentTripId) {
        const positions = loadPositions(currentTripId)
        delete positions[nodeId]
        savePositions(currentTripId, positions)
      }

      await loadTrip()
      onSaved?.()
    } catch (err) {
      console.error('Failed to delete node', err)
    }
  }

  // ── Connecting flights logic ──────────────────────────────────────────────────
  /**
   * A flight is "connecting to next" if:
   * - It has a wire to another flight
   * - AND there is no hotel node on any path between them in the wire graph
   *
   * Algorithm:
   * 1. Build adjacency from wire links
   * 2. For each flight node F, find all directly wired neighbors
   * 3. If a neighbor is a flight (no hotel in between via direct wire), mark as connecting
   * 4. Update trip_flights.is_connecting_to_next via Supabase
   */
  const recalcConnectingFlights = async () => {
    if (!currentTripId) return

    // Fetch fresh links
    const { data: freshLinks } = await supabase
      .from('trip_event_links')
      .select('*')
      .eq('trip_id', currentTripId)

    const { data: flights } = await supabase
      .from('trip_flights')
      .select('id')
      .eq('trip_id', currentTripId)

    if (!flights || !freshLinks) return

    const flightIds = new Set(flights.map((f: any) => f.id))

    // For each flight, check if any direct wire neighbor is also a flight (no hotel in between)
    // "Direct wire" means from_id -> to_id or to_id -> from_id with no hotel node on the edge
    const connectingFlightIds = new Set<string>()

    for (const link of freshLinks) {
      const fromIsFlight = flightIds.has(link.from_id)
      const toIsFlight = flightIds.has(link.to_id)
      const fromIsHotel = !fromIsFlight
      const toIsHotel = !toIsFlight

      // Both ends are flights → connecting
      if (fromIsFlight && toIsFlight) {
        connectingFlightIds.add(link.from_id)
        // Note: we only mark "from" as connecting_to_next; "to" is the next flight
        // But we need to be careful about directionality.
        // For simplicity: mark both as involved, but is_connecting_to_next should only
        // be set on the "earlier" flight. We'll handle ordering below.
      }
    }

    // Now update: for flights that have a direct flight-to-flight wire, mark is_connecting_to_next = true
    // For all others, mark false
    const updates = flights.map((f: any) => ({
      id: f.id,
      is_connecting_to_next: connectingFlightIds.has(f.id),
    }))

    for (const upd of updates) {
      await supabase
        .from('trip_flights')
        .update({ is_connecting_to_next: upd.is_connecting_to_next })
        .eq('id', upd.id)
    }
  }

  // ── Node colors ───────────────────────────────────────────────────────────────

  const isConnecting = (nodeId: string): boolean => {
    // A flight node is "connecting" if it has a direct wire to another flight
    const nodeLinks = links.filter(l => l.from_id === nodeId || l.to_id === nodeId)
    for (const link of nodeLinks) {
      const otherId = link.from_id === nodeId ? link.to_id : link.from_id
      const otherNode = nodes.find(n => n.id === otherId)
      if (otherNode?.type === 'flight') return true
    }
    return false
  }

  const nodeCenter = (node: GraphNode) => ({
    x: node.x + 130, // half of node width (~260px)
    y: node.y + 40,  // vertical center
  })

  const selectedDetails = selectedNode ? getEditableEntries(selectedNode.details || {}) : []

  useEffect(() => {
    if (!selectedNode) {
      setNodeForm({})
      return
    }

    const form: Record<string, string> = {}
    getEditableEntries(selectedNode.details).forEach(([key, value]) => {
      form[key] = toInputString(value)
    })
    setNodeForm(form)
  }, [selectedNode, getEditableEntries])

  useEffect(() => {
    if (!tripDetails) {
      setTripForm({})
      return
    }

    const form: Record<string, string> = {}
    getEditableEntries(tripDetails).forEach(([key, value]) => {
      form[key] = toInputString(value)
    })
    setTripForm(form)
  }, [tripDetails, getEditableEntries])

  useEffect(() => {
    const onFullScreenChange = () => {
      const active = document.fullscreenElement === containerRef.current
      setIsFullscreen(active)
    }

    document.addEventListener('fullscreenchange', onFullScreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullScreenChange)
  }, [])

  const toggleFullscreen = async () => {
    if (!containerRef.current) return
    try {
      if (document.fullscreenElement === containerRef.current) {
        await document.exitFullscreen()
      } else {
        await containerRef.current.requestFullscreen()
      }
    } catch (error) {
      console.error('Failed to toggle fullscreen:', error)
    }
  }

  const updateZoom = useCallback((targetZoom: number) => {
    const viewport = viewportRef.current
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, targetZoom))
    if (!viewport) {
      setZoom(nextZoom)
      return
    }

    const prevZoom = zoom
    const centerWorldX = (viewport.scrollLeft + viewport.clientWidth / 2) / prevZoom
    const centerWorldY = (viewport.scrollTop + viewport.clientHeight / 2) / prevZoom

    setZoom(nextZoom)

    requestAnimationFrame(() => {
      if (!viewportRef.current) return
      viewportRef.current.scrollLeft = centerWorldX * nextZoom - viewportRef.current.clientWidth / 2
      viewportRef.current.scrollTop = centerWorldY * nextZoom - viewportRef.current.clientHeight / 2
    })
  }, [zoom])

  const onViewportWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.08 : 0.92
    updateZoom(zoom * factor)
  }

  const saveNodeEdits = async () => {
    if (!selectedNode) return
    setSavingNode(true)
    try {
      const payload: Record<string, any> = {}
      selectedDetails.forEach(([key, original]) => {
        payload[key] = coerceValue(nodeForm[key] ?? '', original)
      })

      const table = selectedNode.type === 'flight' ? 'trip_flights' : 'trip_hotels'
      const { error } = await supabase.from(table).update(payload).eq('id', selectedNode.id)
      if (error) throw error

      await loadTrip()
      onSaved?.()
      toast({ title: 'Node updated', description: 'Node updated successfully' })
      showSavedBadge('Saved ✓')
    } catch (err: any) {
      console.error('Failed to update node', err)
      toast({ title: 'Failed to update node', description: err?.message || String(err), variant: 'destructive' })
    } finally {
      setSavingNode(false)
    }
  }

  const saveTripEdits = async () => {
    if (!currentTripId || !tripDetails) return
    setSavingTrip(true)
    try {
      const payload: Record<string, any> = {}
      getEditableEntries(tripDetails).forEach(([key, original]) => {
        payload[key] = coerceValue(tripForm[key] ?? '', original)
      })

      if (payload.status && !['planning', 'ongoing', 'completed', 'cancelled'].includes(payload.status)) {
        toast({ title: 'Invalid status', description: 'Trip status must be planning, ongoing, completed, or cancelled', variant: 'destructive' })
        setSavingTrip(false)
        return
      }

      const { error } = await supabase.from('trips').update(payload).eq('id', currentTripId)
      if (error) throw error

      await loadTrip()
      onSaved?.()
      toast({ title: 'Trip updated', description: 'Trip updated successfully' })
      showSavedBadge('Saved ✓')
    } catch (err: any) {
      console.error('Failed to update trip', err)
      toast({ title: 'Failed to update trip', description: err?.message || String(err), variant: 'destructive' })
    } finally {
      setSavingTrip(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const isInspectorVisible = isInspectorOpen || Boolean(selectedNode) || showTripEditor

  if (!currentTripId) {
    return (
      <div className="rounded border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No trip selected. Open a trip from the Flights page.
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden border border-border graph-canvas-bg select-none ${
        isFullscreen ? 'h-full rounded-none' : 'h-[calc(100vh-180px)] min-h-175 rounded'
      }`}
      style={{
        backgroundColor: '#05070b',
      }}
    >
      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-50 flex items-center gap-2 flex-wrap max-w-[92vw] sm:max-w-[80vw]">
        <button
          onClick={(e) => { e.stopPropagation(); setShowFlightModal(true) }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm rounded-lg node-glass text-cyan-300 hover:bg-white/5"
        >
          <Plus className="w-4 h-4" /> Add Flight
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setShowHotelModal(true) }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm rounded-lg node-glass text-violet-300 hover:bg-white/5"
        >
          <Plus className="w-4 h-4" /> Add Hotel
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); toggleFullscreen() }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm rounded-lg node-glass text-slate-200 hover:bg-white/5"
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />} {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); updateZoom(zoom * 1.12) }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm rounded-lg node-glass text-slate-200 hover:bg-white/5"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" /> Zoom In
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); updateZoom(zoom * 0.9) }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm rounded-lg node-glass text-slate-200 hover:bg-white/5"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" /> Zoom Out
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); updateZoom(1) }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm rounded-lg node-glass text-slate-200 hover:bg-white/5"
          title="Reset zoom"
        >
          <RotateCcw className="w-4 h-4" /> Reset View
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setShowTripEditor(true); setSelectedNode(null); setIsInspectorOpen(true) }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm rounded-lg node-glass text-slate-200 hover:bg-white/5"
          title="Edit trip details"
        >
          <Edit3 className="w-4 h-4" /> Trip Details
        </button>
        {linkingFrom && (
          <div className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300">
            <Link2 className="w-4 h-4" />
            Click another node to connect · <button onClick={() => setLinkingFrom(null)} className="underline">Cancel</button>
          </div>
        )}
      </div>

      {/* Stats badge */}
      <div className="absolute top-4 right-4 z-50 text-xs text-muted-foreground glass-panel px-2 py-1.5 rounded-md max-[479px]:hidden">
        {nodes.filter(n => n.type === 'flight').length} flights · {nodes.filter(n => n.type === 'hotel').length} hotels · {links.length} wires · {Math.round(zoom * 100)}%
      </div>

      <div
        ref={viewportRef}
        className="relative h-full w-full overflow-auto"
        style={{ cursor: linkingFrom ? 'crosshair' : 'default' }}
        onWheel={onViewportWheel}
        onClick={() => linkingFrom && setLinkingFrom(null)}
      >
        <div
          className="relative"
          style={{
            width: `${CANVAS_WORLD_SIZE * zoom}px`,
            height: `${CANVAS_WORLD_SIZE * zoom}px`,
          }}
        >
          <div
            className="absolute left-0 top-0"
            style={{
              width: `${CANVAS_WORLD_SIZE}px`,
              height: `${CANVAS_WORLD_SIZE}px`,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
            }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                zIndex: 1,
                backgroundImage: 'radial-gradient(circle, rgba(219,229,239,0.42) 0.95px, transparent 1.05px)',
                backgroundSize: '16px 16px',
                opacity: 0.5,
                mixBlendMode: 'screen',
              }}
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                zIndex: 2,
                backgroundImage:
                  'linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)',
                backgroundSize: '72px 72px',
                opacity: 0.35,
              }}
            />
            <div className="absolute inset-0 graph-grid pointer-events-none" style={{ zIndex: 3 }} />
            <div className="absolute inset-0 graph-noise pointer-events-none" style={{ zIndex: 4 }} />

            {/* Drag indicator and snap preview */}
            {draggingId && (() => {
              const draggingNode = nodes.find(n => n.id === draggingId)
              let snapTarget: GraphNode | null = null
              if (draggingNode) {
                let best = Infinity
                for (const n of nodes) {
                  if (n.id === draggingId) continue
                  const dx = n.x - draggingNode.x
                  const dy = n.y - draggingNode.y
                  const d = Math.sqrt(dx*dx + dy*dy)
                  if (d < best) { best = d; snapTarget = n }
                }
                if (best! > 120) snapTarget = null
              }

              const indicatorX = snapTarget ? snapTarget.x : mousePos.x
              const indicatorY = snapTarget ? snapTarget.y : mousePos.y

              return (
                <div style={{ position: 'absolute', left: indicatorX, top: indicatorY, zIndex: 60 }}>
                  <div className="w-6 h-6 rounded-full bg-amber-400/30 ring-2 ring-amber-300/30 animate-pulse pointer-events-none" />
                </div>
              )
            })()}

      {/* SVG layer for wires */}
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 20 }}
      >
        <defs>
          <linearGradient id="wireGrad" x1="0%" x2="100%">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#9f7aea" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="connectingGrad" x1="0%" x2="100%">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.9" />
          </linearGradient>
          <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="rgba(96,165,250,0.8)" />
          </marker>
        </defs>

        {/* Existing wires */}
        {links.map(link => {
          const fromNode = nodes.find(n => n.id === link.from_id)
          const toNode = nodes.find(n => n.id === link.to_id)
          if (!fromNode || !toNode) return null

          const from = nodeCenter(fromNode)
          const to = nodeCenter(toNode)
          const cx = (from.x + to.x) / 2
          const cy = (from.y + to.y) / 2 - 40

          // Is this a flight-to-flight wire? Use green
          const bothFlights = fromNode.type === 'flight' && toNode.type === 'flight'

          return (
            <g key={link.id} style={{ pointerEvents: 'all' }}>
              <path
                d={`M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`}
                stroke={bothFlights ? 'url(#connectingGrad)' : 'url(#wireGrad)'}
                strokeWidth={2.5}
                fill="none"
                strokeLinecap="round"
                markerEnd="url(#arrowhead)"
              />
              {/* Delete button on midpoint */}
              <circle
                cx={cx}
                cy={cy}
                r={8}
                fill="#0B0B0F"
                stroke="rgba(239,68,68,0.5)"
                className="cursor-pointer"
                onClick={(e) => { e.stopPropagation(); deleteLink(link) }}
              />
              <text
                x={cx}
                y={cy + 4}
                textAnchor="middle"
                fill="rgba(239,68,68,0.8)"
                fontSize="10"
                className="cursor-pointer"
                onClick={(e) => { e.stopPropagation(); deleteLink(link) }}
              >
                ×
              </text>
            </g>
          )
        })}

        {/* Preview wire while linking */}
        {linkingFrom && (() => {
          const from = nodeCenter(linkingFrom)
          const cx = (from.x + mousePos.x) / 2
          const cy = (from.y + mousePos.y) / 2 - 30
          return (
            <path
              d={`M ${from.x} ${from.y} Q ${cx} ${cy} ${mousePos.x} ${mousePos.y}`}
              stroke="rgba(251,191,36,0.6)"
              strokeWidth={2}
              strokeDasharray="6 4"
              fill="none"
              strokeLinecap="round"
            />
          )
        })()}
      </svg>

      {/* Nodes */}
      {nodes.map(node => {
        const connecting = node.type === 'flight' && isConnecting(node.id)
        const isLinkSource = linkingFrom?.id === node.id
        const nodeClass = node.type === 'flight'
          ? 'rounded-2xl border border-cyan-200/55 bg-gradient-to-b from-slate-700/55 via-slate-900/95 to-slate-950/98 outline outline-1 outline-cyan-100/15 shadow-[0_16px_36px_rgba(1,8,18,0.92),8px_8px_0_rgba(34,211,238,0.28),inset_0_1px_0_rgba(255,255,255,0.15),inset_0_0_0_1px_rgba(125,211,252,0.22)]'
          : 'rounded-2xl border border-violet-200/55 bg-gradient-to-b from-violet-950/45 via-[#120a1f]/95 to-[#090610]/98 outline outline-1 outline-violet-100/15 shadow-[0_16px_36px_rgba(8,4,16,0.94),8px_8px_0_rgba(139,92,246,0.3),inset_0_1px_0_rgba(255,255,255,0.14),inset_0_0_0_1px_rgba(196,181,253,0.22)]'

        const nodeAnimate = draggingId === node.id
          ? { scale: 1.04, rotate: -1 }
          : isLinkSource
          ? { scale: 1.02, rotate: 0, boxShadow: '0 0 18px rgba(251,191,36,0.18)' }
          : { scale: 1, rotate: 0 }

        const nodeTransition = isLinkSource
          ? { duration: 0.9, repeat: Infinity, repeatType: 'reverse' as const }
          : { type: 'spring', stiffness: 400, damping: 30 }

        return (
          <motion.div
            key={node.id}
            data-node="true"
            style={{
              left: node.x,
              top: node.y,
              width: 260,
              position: 'absolute',
              zIndex: draggingId === node.id ? 60 : 30,
              cursor: linkingFrom ? 'pointer' : draggingId === node.id ? 'grabbing' : 'grab',
            }}
            animate={nodeAnimate}
            transition={isLinkSource ? { duration: 0.9, repeat: Infinity, repeatType: 'reverse' as const } : ({ type: 'spring', stiffness: 400, damping: 30 } as any)}
            onMouseDown={(e) => startDrag(e, node)}
            onClick={(e) => {
              e.stopPropagation()
              setSelectedNode(node)
              setShowTripEditor(false)
              setIsInspectorOpen(true)
              if (linkingFrom) setLinkingFrom(null)
            }}
            className={`${nodeClass} p-4 ${isLinkSource ? 'ring-2 ring-amber-400/80' : ''} ${connecting ? 'ring-1 ring-emerald-400/45' : ''}`}
          >
            <div className={`absolute left-0 top-0 h-full w-1 rounded-l-2xl ${node.type === 'flight' ? 'bg-cyan-300/70' : 'bg-violet-300/70'}`} />
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                    node.type === 'flight'
                      ? 'bg-cyan-500/10 text-cyan-200 border-cyan-400/20'
                      : 'bg-violet-500/10 text-violet-200 border-violet-400/20'
                  }`}
                >
                  {node.type === 'flight' ? <Plane className="w-5 h-5" /> : <Hotel className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-slate-50 truncate">{node.title}</div>
                  <div className="text-xs text-slate-300 truncate mt-0.5">{node.subtitle}</div>
                  {connecting && (
                    <span className="inline-block mt-1 text-xs px-1.5 py-0.5 rounded bg-emerald-500/12 text-emerald-300 border border-emerald-400/20">
                      Connecting
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1 shrink-0">
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); handleLinkButtonClick(node) }}
                  className={`p-1.5 rounded text-xs border ${isLinkSource ? 'bg-amber-500/15 text-amber-200 border-amber-400/25' : 'hover:bg-white/5 text-slate-300 border-transparent'}`}
                  title={isLinkSource ? 'Cancel link' : 'Draw wire to another node'}
                >
                  {isLinkSource ? <Link2Off className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                </button>
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); deleteNode(node.id, node.type) }}
                  className="p-1.5 rounded hover:bg-red-500/10 text-slate-300 hover:text-red-300 border border-transparent"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )
      })}

          </div>
        </div>
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-50">
          <div className="text-sm text-white/70">Loading graph…</div>
        </div>
      )}

      <button
        onClick={() => {
          if (isInspectorVisible) {
            setSelectedNode(null)
            setShowTripEditor(false)
            setIsInspectorOpen(false)
          } else {
            setSelectedNode(null)
            setShowTripEditor(true)
            setIsInspectorOpen(true)
          }
        }}
        className="absolute right-0 top-1/2 z-50 -translate-y-1/2 translate-x-1/2 rounded-full border border-white/10 bg-black/75 p-2 text-slate-100 shadow-lg hover:bg-black/90"
        aria-label={isInspectorVisible ? 'Collapse inspector' : 'Open inspector'}
      >
        {isInspectorVisible ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      <AnimatePresence>
        {isInspectorVisible && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="absolute inset-0 z-30 bg-black/55 sm:hidden"
              onClick={() => {
                setSelectedNode(null)
                setShowTripEditor(false)
                setIsInspectorOpen(false)
              }}
            />

            <motion.aside
              key="inspector"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="absolute top-0 right-0 z-40 h-full w-full max-w-full sm:w-80 md:w-90 border-l border-white/8 bg-[#090b0f]/94 backdrop-blur-md shadow-[0_0_0_1px_rgba(255,255,255,0.03),-18px_0_40px_rgba(0,0,0,0.45)]"
            >
              <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-50">{showTripEditor ? 'Trip Details' : 'Entity Details'}</p>
                  <p className="text-xs text-slate-400">{showTripEditor ? 'Edit trip planning and metadata' : 'Edit any node field and save to database'}</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedNode(null)
                    setShowTripEditor(false)
                    setIsInspectorOpen(false)
                  }}
                  className="rounded px-2 py-1 text-sm text-slate-300 hover:bg-white/5 hover:text-slate-50"
                >
                  Close
                </button>
              </div>
              <div className="h-[calc(100%-57px)] overflow-y-auto p-4 space-y-4">
                {showTripEditor ? (
                  <>
                    {!tripDetails ? (
                      <div className="rounded-lg border border-dashed border-white/10 p-6 text-sm text-slate-400 bg-white/2">
                        Trip details are not available yet.
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          {getEditableEntries(tripDetails).map(([key]) => (
                            <label key={key} className="block rounded-lg border border-white/8 bg-white/3 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                              <div className="text-[11px] uppercase tracking-wide text-slate-400">{labelize(key)}</div>
                              {key === 'status' ? (
                                <select
                                  value={tripForm[key] ?? ''}
                                  onChange={(e) => setTripForm(prev => ({ ...prev, [key]: e.target.value }))}
                                  className="mt-1 w-full rounded border border-white/12 bg-black/25 px-2 py-1.5 text-sm text-slate-100"
                                >
                                  <option value="planning">planning</option>
                                  <option value="ongoing">ongoing</option>
                                  <option value="completed">completed</option>
                                  <option value="cancelled">cancelled</option>
                                </select>
                              ) : key === 'description' ? (
                                <textarea
                                  value={tripForm[key] ?? ''}
                                  onChange={(e) => setTripForm(prev => ({ ...prev, [key]: e.target.value }))}
                                  className="mt-1 w-full rounded border border-white/12 bg-black/25 px-2 py-1.5 text-sm text-slate-100 min-h-21"
                                />
                              ) : (
                                <input
                                  value={tripForm[key] ?? ''}
                                  onChange={(e) => setTripForm(prev => ({ ...prev, [key]: e.target.value }))}
                                  className="mt-1 w-full rounded border border-white/12 bg-black/25 px-2 py-1.5 text-sm text-slate-100"
                                />
                              )}
                            </label>
                          ))}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={saveTripEdits}
                            disabled={savingTrip}
                            className="flex-1 rounded-lg bg-violet-500/25 border border-violet-300/30 px-3 py-2 text-sm text-violet-100 hover:bg-violet-500/30 disabled:opacity-60"
                          >
                            {savingTrip ? 'Saving Trip...' : 'Save Trip Details'}
                          </button>
                          {saveBadge && (
                            <span className={`rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-200 transition-opacity duration-300 ${saveBadgeVisible ? 'opacity-100' : 'opacity-0'}`}>
                              {saveBadge}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </>
                ) : selectedNode ? (
                  <>
                    <div>
                      <div className="text-lg font-semibold text-slate-50">{selectedNode.title}</div>
                      <div className="text-sm text-slate-300 mt-1">{selectedNode.subtitle}</div>
                      <div className="mt-3 inline-flex rounded-full border border-white/10 px-2 py-1 text-xs uppercase tracking-wide text-slate-300 bg-white/3">
                        {selectedNode.type}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {selectedDetails.map(([key]) => (
                        <label key={key} className="block rounded-lg border border-white/8 bg-white/3 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                          <div className="text-[11px] uppercase tracking-wide text-slate-400">{labelize(key)}</div>
                          {typeof selectedNode.details[key] === 'boolean' ? (
                            <select
                              value={nodeForm[key] ?? 'false'}
                              onChange={(e) => setNodeForm(prev => ({ ...prev, [key]: e.target.value }))}
                              className="mt-1 w-full rounded border border-white/12 bg-black/25 px-2 py-1.5 text-sm text-slate-100"
                            >
                              <option value="true">True</option>
                              <option value="false">False</option>
                            </select>
                          ) : (
                            <input
                              value={nodeForm[key] ?? ''}
                              onChange={(e) => setNodeForm(prev => ({ ...prev, [key]: e.target.value }))}
                              className="mt-1 w-full rounded border border-white/12 bg-black/25 px-2 py-1.5 text-sm text-slate-100"
                            />
                          )}
                        </label>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={saveNodeEdits}
                        disabled={savingNode}
                        className="flex-1 rounded-lg bg-cyan-500/25 border border-cyan-300/30 px-3 py-2 text-sm text-cyan-100 hover:bg-cyan-500/30 disabled:opacity-60"
                      >
                        {savingNode ? 'Saving Node...' : 'Save Node Changes'}
                      </button>
                      {saveBadge && (
                        <span className={`rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-200 transition-opacity duration-300 ${saveBadgeVisible ? 'opacity-100' : 'opacity-0'}`}>
                          {saveBadge}
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed border-white/10 p-6 text-sm text-slate-400 bg-white/2">
                    Select a flight/hotel node to edit it, or click Trip Details from the toolbar.
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Modals */}
      <FlightModal
        isOpen={showFlightModal}
        tripId={currentTripId}
        onClose={() => setShowFlightModal(false)}
        onSuccess={async (newId?: string) => {
          setShowFlightModal(false)
          if (newId && currentTripId) {
            // Fetch the actual flight to get real title
            const { data } = await supabase
              .from('trip_flights')
              .select('id, flight_number, departure_airport, arrival_airport')
              .eq('id', newId)
              .single()
            if (data) {
              const positions = loadPositions(currentTripId)
              // Place new node at a sensible default if no saved position
              if (!positions[newId]) {
                const existingFlights = nodes.filter(n => n.type === 'flight').length
                positions[newId] = { x: 80 + existingFlights * 220, y: 80 }
                savePositions(currentTripId, positions)
              }
            }
          }
          await loadTrip()
          onSaved?.()
        }}
      />
      <HotelModal
        isOpen={showHotelModal}
        tripId={currentTripId}
        onClose={() => setShowHotelModal(false)}
        onSuccess={async (newId?: string) => {
          setShowHotelModal(false)
          if (newId && currentTripId) {
            const positions = loadPositions(currentTripId)
            if (!positions[newId]) {
              const existingHotels = nodes.filter(n => n.type === 'hotel').length
              positions[newId] = { x: 80 + existingHotels * 220, y: 320 }
              savePositions(currentTripId, positions)
            }
          }
          await loadTrip()
          onSaved?.()
        }}
      />
    </div>
  )
}
