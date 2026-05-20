'use client'

import React from 'react'
import { Sidebar } from './sidebar'
import { CommandBar } from './command-bar'
import { Toaster } from '@/components/ui/toaster'
import { ChatDock } from './chat-dock'
import PageTransition from '@/components/page-transition'
import Cursor from '@/components/ui/cursor'
import CommandPalette from '@/components/command-palette'

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col md:ml-0">
        <CommandBar />
        <main className="flex-1 overflow-auto">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <ChatDock />
      <Cursor />
      <Toaster />
      <CommandPalette />
    </div>
  )
}
