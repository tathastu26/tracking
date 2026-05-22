import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import type { SidebarNavItem } from '@/lib/navigation'

interface SidebarNavItemProps {
  item: SidebarNavItem
  isActive: boolean
  isDesktopCollapsed: boolean
}

export function SidebarNavItem({
  item,
  isActive,
  isDesktopCollapsed,
}: SidebarNavItemProps) {
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      className="group relative"
    >
      <motion.div
        initial={false}
        animate={{
          backgroundColor: isActive
            ? 'hsl(var(--sidebar-accent))'
            : 'transparent',
        }}
        className={`flex items-center px-4 py-3 rounded relative ${
          isDesktopCollapsed ? 'justify-center' : 'gap-3'
        }`}
      >
        <Icon className="w-5 h-5 text-sidebar-foreground group-hover:opacity-100 opacity-70" />
        {!isDesktopCollapsed && (
          <span className="text-sm font-medium text-sidebar-foreground">
            {item.label}
          </span>
        )}
        {isDesktopCollapsed && (
          <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 rounded bg-card border border-border px-3 py-1 text-xs opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity whitespace-nowrap">
            {item.label}
          </span>
        )}
        {isActive && (
          <motion.div
            layoutId="activeIndicator"
            className="absolute left-0 top-0 bottom-0 w-1 bg-sidebar-primary"
            initial={false}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          />
        )}
      </motion.div>
    </Link>
  )
}
