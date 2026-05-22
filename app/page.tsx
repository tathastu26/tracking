'use client'

import dynamic from 'next/dynamic'
import { MainLayout } from '@/components/main-layout'

const DashboardMap = dynamic(
  () => import('@/components/dashboard/dashboard-map').then((m) => m.DashboardMap),
  { ssr: false }
)

export default function Dashboard() {
  return (
    <MainLayout>
      <DashboardMap />
    </MainLayout>
  )
}
