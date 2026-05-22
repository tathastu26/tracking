'use client'

import React from 'react'
import { useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { LogOut, Menu } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import { SIDEBAR_ITEMS } from '@/lib/navigation'
import { SidebarNavItem } from '@/components/sidebar/sidebar-nav-item'

export function Sidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = React.useState(false)
  const [isMobile, setIsMobile] = React.useState(false)
  const [isDesktopCollapsed, setIsDesktopCollapsed] = React.useState(() => {
    try {
      if (typeof window === 'undefined') return false
      return localStorage.getItem('sidebarCollapsed') === '1'
    } catch (e) {
      return false
    }
  })

  useEffect(() => {
    const updateViewport = () => {
      const nextIsMobile = window.innerWidth < 768
      setIsMobile(nextIsMobile)
      setIsOpen(!nextIsMobile)
    }

    updateViewport()
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('sidebarCollapsed', isDesktopCollapsed ? '1' : '0')
    } catch (e) {
      // ignore
    }
  }, [isDesktopCollapsed])

  const handleGlobalToggle = useCallback((e: KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().includes('MAC')
    const meta = isMac ? e.metaKey : e.ctrlKey
    if (meta && e.key.toLowerCase() === 'b') {
      e.preventDefault()
      setIsDesktopCollapsed((v) => !v)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleGlobalToggle)
    return () => window.removeEventListener('keydown', handleGlobalToggle)
  }, [handleGlobalToggle])

  return (
    <>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`fixed top-4 left-4 z-50 md:hidden p-2 rounded transition-colors ${
          isOpen ? 'bg-muted text-foreground' : 'hover:bg-muted text-muted-foreground'
        }`}
        aria-label="Toggle sidebar"
        aria-expanded={isOpen}
      >
        <Menu className="w-5 h-5" />
      </button>

      {isMobile && isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <motion.aside
        id="sidebar"
        initial={false}
        animate={{
          x: isMobile ? (isOpen ? 0 : -320) : 0,
          opacity: isMobile ? (isOpen ? 1 : 0) : 1,
          width: isMobile ? 'min(80vw, 300px)' : isDesktopCollapsed ? 80 : 320,
        }}
        transition={{ duration: 0.2 }}
        aria-hidden={isMobile && !isOpen}
        className={`fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border flex flex-col z-50 md:static md:h-auto md:translate-x-0 md:opacity-100 backdrop-blur-md bg-black/20 ${
          isMobile && !isOpen ? 'pointer-events-none' : ''
        }`}
      >
        <div className={`absolute left-0 top-0 h-full ${isDesktopCollapsed ? 'w-1' : 'w-2'} pointer-events-none` }>
          <div className={`h-full ${isDesktopCollapsed ? 'w-1' : 'w-2'} bg-linear-to-b from-primary to-transparent opacity-85 rounded-tr-md rounded-br-md animate-pulse`} />
        </div>
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 bg-linear-to-br from-sidebar-primary to-sidebar-primary/70 text-sidebar-primary-foreground flex items-center justify-center font-bold shrink-0 rounded-md shadow-sm">
                FT
              </div>
              {!isDesktopCollapsed && (
                <div>
                  <h1 className="font-bold text-lg text-sidebar-foreground">
                    Flight Tracker
                  </h1>
                  <p className="text-xs text-sidebar-primary opacity-70">
                    Operations Center
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={() => setIsDesktopCollapsed((prev) => !prev)}
              className={`hidden md:flex p-2 rounded text-sidebar-foreground transition-colors ${
                isDesktopCollapsed ? 'bg-sidebar-accent/60' : 'hover:bg-sidebar-accent'
              }`}
              aria-label={
                isDesktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'
              }
              aria-expanded={!isDesktopCollapsed}
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {SIDEBAR_ITEMS.map((item) => (
            <SidebarNavItem
              key={item.href}
              item={item}
              isActive={pathname === item.href}
              isDesktopCollapsed={isDesktopCollapsed}
            />
          ))}
        </nav>

        <div className="p-4 border-t border-sidebar-border space-y-2">
          <SignOutButton isDesktopCollapsed={isDesktopCollapsed} />
        </div>
      </motion.aside>
    </>
  )
}

function SignOutButton({ isDesktopCollapsed }: { isDesktopCollapsed: boolean }) {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/login')
    } catch (err) {
      console.error('Sign out failed', err)
    }
  }

  return (
    <button
      onClick={handleSignOut}
      className={`w-full flex items-center px-4 py-3 hover:bg-destructive/10 rounded text-sm font-medium text-destructive transition-colors ${
        isDesktopCollapsed ? 'justify-center' : 'gap-3'
      }`}
    >
      <LogOut className="w-5 h-5" />
      {!isDesktopCollapsed && 'Sign Out'}
    </button>
  )
}
