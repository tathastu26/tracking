'use client'

import React from 'react'
import { motion } from 'framer-motion'
import {
  Search,
  Bell,
  Clock,
  AlertCircle,
  Plane,
} from 'lucide-react'

export function CommandBar() {
  const [isSearching, setIsSearching] = React.useState(false)
  const searchInputRef = React.useRef<HTMLInputElement>(null)

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-3 sm:px-6 py-3 sm:py-4 gap-3 sm:gap-4 min-w-0">
        <div className="flex-1 w-full max-w-full sm:max-w-md min-w-0">
          <motion.div
            initial={false}
            animate={isSearching ? { scale: 1.02 } : { scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className="relative w-full min-w-0"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search flights, airports, passengers..."
              className="w-full min-w-0 pl-10 pr-4 py-2 bg-muted border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              onFocus={() => setIsSearching(true)}
              onBlur={() => setIsSearching(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={isSearching ? { opacity: 1, y: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="absolute left-0 right-0 mt-2 z-20 w-full max-w-[calc(100vw-1.5rem)] sm:max-w-md"
            >
              <div className="bg-card border border-border rounded shadow-lg overflow-hidden max-w-full">
                <div className="p-2 text-xs text-muted-foreground">Recent</div>
                <ul className="divide-y divide-border">
                  <li className="p-2 hover:bg-muted/50 cursor-pointer text-sm">JFK → LHR</li>
                  <li className="p-2 hover:bg-muted/50 cursor-pointer text-sm">LAX → SFO</li>
                  <li className="p-2 hover:bg-muted/50 cursor-pointer text-sm">Hotel: Hilton, NYC</li>
                </ul>
              </div>
            </motion.div>
          </motion.div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0 self-end sm:self-auto">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="relative p-2 hover:bg-muted rounded transition-colors"
            title="Active alerts"
          >
            <Bell className="w-5 h-5 text-foreground" />
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full"
            />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 hover:bg-muted rounded transition-colors"
            title="Recent activity"
          >
            <Clock className="w-5 h-5 text-foreground" />
          </motion.button>

          <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center rounded font-semibold text-sm">
            JD
          </div>
        </div>
      </div>


    </motion.header>
  )
}
