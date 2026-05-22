'use client'

import React from 'react'
import { motion } from 'framer-motion'

export default function StatusBadge({ status }: { status: string }) {
  const colorClass = status === 'ongoing' ? 'bg-amber-500/10 text-amber-300' : status === 'completed' ? 'bg-emerald-600/10 text-emerald-300' : status === 'cancelled' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'

  const animate = status === 'ongoing' ? { scale: [1, 1.04, 1] } : undefined

  return (
    <motion.span animate={animate} transition={animate ? { duration: 1.4, repeat: Infinity } : undefined} className={`text-xs px-2 py-1 rounded ${colorClass}`}>
      {status}
    </motion.span>
  )
}
