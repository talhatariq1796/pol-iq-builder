'use client';
import React from 'react';
import dynamic from 'next/dynamic';

// Load MapApp with no SSR
const MapApp = dynamic(() => import('./MapApp'), { 
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-50 focus:outline-none">
      <div className="text-lg text-gray-600">Loading map application...</div>
    </div>
  )
});

export default function MapPage() {
  return <MapApp />;
}