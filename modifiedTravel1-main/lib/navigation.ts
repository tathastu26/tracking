import type { LucideIcon } from 'lucide-react'
import { BarChart3, Plane, User } from 'lucide-react'

export interface SidebarNavItem {
  icon: LucideIcon
  label: string
  href: string
}

export const SIDEBAR_ITEMS: SidebarNavItem[] = [
  {
    icon: BarChart3,
    label: 'Dashboard',
    href: '/',
  },
  {
    icon: Plane,
    label: 'Flights & Travel',
    href: '/flights',
  },
  {
    icon: User,
    label: 'Profile',
    href: '/profile',
  },
]
