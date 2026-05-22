import React from 'react'
import { motion } from 'framer-motion'

interface StatusItem {
  label: string
  value: string | number
  status?: 'ok' | 'warning' | 'error'
}

interface StatusPanelProps {
  title: string
  items: StatusItem[]
  compact?: boolean
}

export function StatusPanel({ title, items, compact = false }: StatusPanelProps) {
  return (
    <div className="border border-border rounded p-4 bg-card">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        {title}
      </h4>
      <div className={`space-y-${compact ? '2' : '3'}`}>
        {items.map((item, idx) => {
          const statusIndicators = {
            ok: 'bg-muted',
            warning: 'bg-yellow-900/30',
            error: 'bg-destructive/20',
          }
          const statusDots = {
            ok: 'bg-muted-foreground',
            warning: 'bg-yellow-600',
            error: 'bg-destructive',
          }

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`flex items-center justify-between p-2 rounded ${
                statusIndicators[item.status || 'ok']
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    statusDots[item.status || 'ok']
                  }`}
                />
                <span className="text-xs text-muted-foreground">
                  {item.label}
                </span>
              </div>
              <span className="text-xs font-semibold text-foreground">
                {item.value}
              </span>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
