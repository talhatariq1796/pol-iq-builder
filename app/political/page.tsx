'use client';

/**
 * Political Analysis Page
 *
 * Main entry point for the political landscape analysis platform.
 * Provides interactive map with precinct/H3 visualization and targeting analysis.
 */

import dynamic from 'next/dynamic';

// Dynamic import to avoid SSR issues with ArcGIS
const PoliticalMapContainer = dynamic(
  () => import('@/components/map/PoliticalMapContainer'),
  {
    ssr: false,
    loading: () => (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading map...</p>
        </div>
      </div>
    ),
  }
);

export default function PoliticalPage() {
  return (
    <main className="h-screen w-full">
      <PoliticalMapContainer
        height={typeof window !== 'undefined' ? window.innerHeight : 800}
      />
    </main>
  );
}
