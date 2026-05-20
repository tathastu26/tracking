import React from 'react'
import { motion } from 'framer-motion'

interface SettingItem {
  label: string
  description?: string
  value?: string | boolean
  onChange?: (value: any) => void
  type?: 'toggle' | 'select' | 'text'
  options?: Array<{ label: string; value: string }>
}

interface SettingsPanelProps {
  title: string
  items: SettingItem[]
}

export function SettingsPanel({ title, items }: SettingsPanelProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
        {title}
      </h3>
      <div className="space-y-3">
        {items.map((item, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="flex items-center justify-between p-3 bg-muted/50 rounded border border-border/50"
          >
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {item.label}
              </p>
              {item.description && (
                <p className="text-xs text-muted-foreground mt-1">
                  {item.description}
                </p>
              )}
            </div>

            {item.type === 'toggle' && (
              <button
                onClick={() => item.onChange?.(!item.value)}
                className={`ml-4 relative w-10 h-5 rounded transition-colors ${
                  item.value
                    ? 'bg-primary'
                    : 'bg-muted-foreground/30'
                }`}
              >
                <motion.div
                  initial={false}
                  animate={{
                    x: item.value ? 20 : 2,
                  }}
                  className="absolute top-1 left-1 w-3 h-3 bg-background rounded"
                />
              </button>
            )}

            {item.type === 'select' && item.options && (
              <select
                value={item.value as string}
                onChange={(e) => item.onChange?.(e.target.value)}
                className="ml-4 px-3 py-1 bg-card border border-border rounded text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {item.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}

            {item.type === 'text' && (
              <input
                type="text"
                value={item.value as string}
                onChange={(e) => item.onChange?.(e.target.value)}
                className="ml-4 px-3 py-1 bg-card border border-border rounded text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring w-32"
              />
            )}
          </motion.div>
        ))}
      </div>
    </div>
  )
}
