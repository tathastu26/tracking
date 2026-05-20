import React from 'react'
import { motion } from 'framer-motion'
import Typewriter from './ui/typewriter'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  compact?: boolean
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col items-center justify-center text-center ${
        compact ? 'py-8 px-4' : 'py-16 px-6'
      }`}
    >
      {icon && (
        <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 2, repeat: Infinity }} className={`mb-4 text-muted-foreground opacity-40 ${
          compact ? 'w-8 h-8' : 'w-12 h-12'
        }`}>
          {icon}
        </motion.div>
      )}
      <h3 className={`font-semibold text-foreground ${
        compact ? 'text-sm' : 'text-lg'
      }`}>
        {title}
      </h3>
      {description && (
        <p className={`text-muted-foreground mt-2 max-w-sm ${
          compact ? 'text-xs' : 'text-sm'
        }`}>
          <Typewriter text={description} />
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className={`mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors ${
            compact ? 'text-xs' : 'text-sm'
          }`}
        >
          {action.label}
        </button>
      )}
    </motion.div>
  )
}
