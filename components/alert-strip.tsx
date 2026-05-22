import React from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, AlertTriangle, CheckCircle, X } from 'lucide-react'

interface AlertStripProps {
  title: string
  message?: string
  type?: 'info' | 'warning' | 'error' | 'success'
  dismissible?: boolean
  onDismiss?: () => void
  action?: {
    label: string
    onClick: () => void
  }
}

export function AlertStrip({
  title,
  message,
  type = 'info',
  dismissible = true,
  onDismiss,
  action,
}: AlertStripProps) {
  const [isVisible, setIsVisible] = React.useState(true)

  if (!isVisible) return null

  const typeConfig = {
    info: {
      bg: 'bg-muted',
      border: 'border-border',
      text: 'text-foreground',
      icon: AlertCircle,
    },
    warning: {
      bg: 'bg-yellow-900/20',
      border: 'border-yellow-900/50',
      text: 'text-yellow-900',
      icon: AlertTriangle,
    },
    error: {
      bg: 'bg-destructive/10',
      border: 'border-destructive/50',
      text: 'text-destructive',
      icon: AlertCircle,
    },
    success: {
      bg: 'bg-green-900/20',
      border: 'border-green-900/50',
      text: 'text-green-900',
      icon: CheckCircle,
    },
  }

  const config = typeConfig[type]
  const Icon = config.icon

  const handleDismiss = () => {
    setIsVisible(false)
    onDismiss?.()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`border ${config.border} ${config.bg} rounded px-4 py-3 flex items-center gap-3`}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <div className="flex-1">
        <p className={`text-sm font-semibold ${config.text}`}>{title}</p>
        {message && (
          <p className={`text-xs ${config.text} opacity-75 mt-1`}>
            {message}
          </p>
        )}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className={`text-xs font-semibold ${config.text} hover:opacity-75 transition-opacity whitespace-nowrap ml-2`}
        >
          {action.label}
        </button>
      )}
      {dismissible && (
        <button
          onClick={handleDismiss}
          className={`p-1 hover:bg-white/10 rounded transition-colors flex-shrink-0 ${config.text}`}
          aria-label="Dismiss alert"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  )
}
