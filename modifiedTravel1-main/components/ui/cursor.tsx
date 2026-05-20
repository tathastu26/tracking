'use client'

import React, { useEffect, useRef } from 'react'

export default function Cursor() {
  const dot = useRef<HTMLDivElement | null>(null)
  const ring = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const d = dot.current
    const r = ring.current
    if (!d || !r) return

    let mouseX = 0
    let mouseY = 0
    let ringX = 0
    let ringY = 0

    const update = () => {
      ringX += (mouseX - ringX) * 0.16
      ringY += (mouseY - ringY) * 0.16
      if (d) d.style.transform = `translate3d(${mouseX - 4}px, ${mouseY - 4}px, 0)`
      if (r) r.style.transform = `translate3d(${ringX - 16}px, ${ringY - 16}px, 0)`
      requestAnimationFrame(update)
    }

    const move = (e: MouseEvent) => {
      mouseX = e.clientX
      mouseY = e.clientY
      d.style.opacity = '1'
      r.style.opacity = '1'
    }

    const hide = () => {
      d.style.opacity = '0'
      r.style.opacity = '0'
    }

    window.addEventListener('mousemove', move)
    window.addEventListener('mouseout', hide)
    requestAnimationFrame(update)

    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseout', hide)
    }
  }, [])

  return (
    <>
      <div
        ref={ring}
        className="pointer-events-none fixed z-50 w-8 h-8 rounded-full border border-white/10 mix-blend-screen opacity-0 transition-opacity"
        style={{ transform: 'translate3d(-50%, -50%, 0)' }}
      />
      <div
        ref={dot}
        className="pointer-events-none fixed z-50 w-2 h-2 rounded-full bg-white opacity-0 transition-opacity"
        style={{ transform: 'translate3d(-50%, -50%, 0)' }}
      />
    </>
  )
}
