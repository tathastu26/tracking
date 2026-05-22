'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Zap, Globe } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function FAB() {
  const [open, setOpen] = React.useState(false)
  const router = useRouter()

  return (
    <div className="fixed right-6 bottom-6 z-50">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="mb-3 flex flex-col items-end"
          >
            <motion.button
              onClick={() => router.push('/flights')}
              className="mb-2 flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg shadow"
            >
              <Globe className="w-4 h-4" /> Open Flights
            </motion.button>
            <motion.button
              onClick={() => router.push('/flights')}
              className="mb-2 flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg shadow"
            >
              <Zap className="w-4 h-4" /> Analyze
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen((s) => !s)}
        className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg border border-primary/30"
        aria-label="Open actions"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  )
}
