import React from 'react'
import { motion } from 'framer-motion'
import TiltCard from '@/components/ui/tilt-card'
import { ArrowRight } from 'lucide-react'

interface OperationalCardProps {
  title: string
  subtitle?: string
  value?: React.ReactNode | string | number
  metric?: string
  icon?: React.ReactNode
  status?: 'normal' | 'alert' | 'critical'
  children?: React.ReactNode
  onClick?: () => void
  compact?: boolean
}

export function OperationalCard({
  title,
  subtitle,
  value,
  metric,
  icon,
  status = 'normal',
  children,
  onClick,
  compact = false,
}: OperationalCardProps) {
  const statusColors = {
    normal: 'border-border bg-card',
    alert: 'border-destructive/50 bg-destructive/5',
    critical: 'border-destructive bg-destructive/10',
  }

  return (
    <TiltCard className={`${onClick ? 'cursor-pointer' : ''} rounded`}>
      <motion.div
        whileHover={{ scale: onClick ? 1.02 : 1 }}
        whileTap={onClick ? { scale: 0.98 } : undefined}
        onClick={onClick}
        className={`border p-6 ${statusColors[status]} transition-all`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {icon && <div className="text-foreground/60">{icon}</div>}
              <h3 className="text-sm font-semibold text-foreground truncate">
                {title}
              </h3>
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground mb-3">{subtitle}</p>
            )}

            {value !== undefined && (
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-bold ${
                  status === 'critical' ? 'text-destructive' : 'text-foreground'
                }`}>
                  {value}
                </span>
                {metric && (
                  <span className="text-xs text-muted-foreground">{metric}</span>
                )}
              </div>
            )}
          </div>

          {onClick && (
            <motion.div
              initial={{ x: 0 }}
              whileHover={{ x: 4 }}
              className="text-muted-foreground"
            >
              <ArrowRight className="w-4 h-4" />
            </motion.div>
          )}
        </div>

        {children && <div className="mt-4">{children}</div>}
      </motion.div>
    </TiltCard>
  )
}
