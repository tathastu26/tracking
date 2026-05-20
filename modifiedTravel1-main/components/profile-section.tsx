import React from 'react'
import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'

interface ProfileSectionProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  action?: {
    label: string
    onClick: () => void
  }
}

export function ProfileSection({
  title,
  subtitle,
  children,
  action,
}: ProfileSectionProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const inView = useInView(ref, { once: true, amount: 0.15 })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 10 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
      transition={{ duration: 0.45, ease: [0.2,0.8,0.2,1] }}
      className="border border-border rounded p-6 bg-card"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        {action && (
          <button
            onClick={action.onClick}
            className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            {action.label}
          </button>
        )}
      </div>
      <div>{children}</div>
    </motion.div>
  )
}
