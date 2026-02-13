'use client'

import React from 'react'
import { LoadingModal } from '@/components/LoadingModal'

// Dynamic import to avoid potential SSR issues
const MapApp = React.lazy(() => import('@/components/MapApp'));

export default function MapPageClient() {
  return (
    <React.Suspense fallback={<LoadingModal progress={0} show={true} />}>
      <MapApp />
    </React.Suspense>
  )
} 