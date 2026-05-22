'use client'

import React, { useRef } from 'react'
import { motion, useSpring, useMotionValue } from 'framer-motion'

export default function TiltCard({ children, className = '' }: React.PropsWithChildren<{ className?: string }>) {
  const ref = useRef<HTMLDivElement | null>(null)
  const rotateX = useMotionValue(0)
  const rotateY = useMotionValue(0)
  const shineX = useMotionValue(50)
  const shineY = useMotionValue(50)

  const springRX = useSpring(rotateX, { stiffness: 100, damping: 15 })
  const springRY = useSpring(rotateY, { stiffness: 100, damping: 15 })
  const springSX = useSpring(shineX, { stiffness: 120, damping: 16 })
  const springSY = useSpring(shineY, { stiffness: 120, damping: 16 })

  const handleMove = (e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width // 0..1
    const py = (e.clientY - rect.top) / rect.height // 0..1
    const nx = px * 2 - 1 // -1..1
    const ny = py * 2 - 1 // -1..1
    rotateY.set(nx * 8)
    rotateX.set(-ny * 8)
    shineX.set(px * 100)
    shineY.set(py * 100)
  }

  const handleLeave = () => {
    rotateX.set(0)
    rotateY.set(0)
    shineX.set(50)
    shineY.set(50)
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ rotateX: springRX, rotateY: springRY, perspective: 1000 }}
      className={`relative transform-gpu will-change-transform ${className}`}
    >
      <div
        className="absolute inset-0 pointer-events-none rounded-lg"
        style={{
          background: `radial-gradient(circle at ${springSX.get()}% ${springSY.get()}%, rgba(255,255,255,0.08), transparent 60%)`,
          mixBlendMode: 'overlay',
        }}
      />
      {children}
    </motion.div>
  )
}
