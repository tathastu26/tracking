'use client'

import React, { useRef } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

export default function MagneticButton({
  children,
  className = '',
  style = {},
  onClick,
  ariaLabel,
}: React.PropsWithChildren<{ className?: string; style?: React.CSSProperties; onClick?: (e: any) => void; ariaLabel?: string }>) {
  const ref = useRef<HTMLButtonElement | null>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const springX = useSpring(x, { stiffness: 150, damping: 15 })
  const springY = useSpring(y, { stiffness: 150, damping: 15 })

  const handleMove = (e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = e.clientX - cx
    const dy = e.clientY - cy
    x.set(dx * 0.35)
    y.set(dy * 0.35)
  }

  const handleLeave = () => {
    x.set(0)
    y.set(0)
  }

  const handlePointerDown = () => {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        // short subtle vibration when available
        ;(navigator as any).vibrate?.(8)
      }
    } catch (e) {
      // ignore
    }
  }

  return (
    <motion.button
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      onPointerDown={handlePointerDown}
      onClick={onClick}
      aria-label={ariaLabel}
      className={`relative overflow-hidden inline-flex items-center justify-center ${className}`}
      style={style}
      whileTap={{ scale: 0.975 }}
    >
      <motion.span
        style={{ x: springX, y: springY }}
        className="relative z-10"
      >
        {children}
      </motion.span>
      <motion.span
        aria-hidden
        className="absolute inset-0 z-0"
        style={{ x: useSpring(x, { stiffness: 60, damping: 12 }).get ? undefined : undefined }}
      />
    </motion.button>
  )
}
