'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Search } from 'lucide-react'

export default function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [selectedIndex, setSelectedIndex] = React.useState(0)

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((s) => !s)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const items = [
    { id: 'flights', title: 'Flights', action: () => router.push('/flights') },
    { id: 'dashboard', title: 'Dashboard', action: () => router.push('/') },
    { id: 'profile', title: 'Profile', action: () => router.push('/profile') },
    { id: 'graph', title: 'Open Graph (pick a trip)', action: () => router.push('/flights') },
  ]

  const filtered = items.filter((it) => it.title.toLowerCase().includes(query.toLowerCase()))

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-28">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="relative w-full max-w-xl p-4"
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSelectedIndex((i) => Math.max(i - 1, 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            const it = filtered[selectedIndex]
            if (it) {
              it.action()
              setOpen(false)
            }
          }
        }}
      >
        <div className="bg-card border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="p-3 border-b border-border flex items-center gap-3">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent outline-none text-foreground"
              placeholder="Type a command or search..."
            />
          </div>

          <ul className="max-h-64 overflow-auto" role="listbox" aria-activedescendant={filtered[selectedIndex]?.id}>
            {filtered.map((it, idx) => (
              <li key={it.id}>
                <button
                  id={it.id}
                  role="option"
                  aria-selected={selectedIndex === idx}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => {
                    it.action()
                    setOpen(false)
                  }}
                  className={`w-full text-left p-3 transition-colors ${selectedIndex === idx ? 'bg-muted/60' : 'hover:bg-muted/50'}`}
                >
                  {it.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </motion.div>
    </div>
  )
}
