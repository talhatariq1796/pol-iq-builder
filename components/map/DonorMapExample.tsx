/**
 * DonorMapExample Component
 *
 * Example integration showing how to use the donor analysis map layers.
 * This demonstrates the complete workflow:
 * 1. Initialize ArcGIS MapView
 * 2. Toggle between donor visualization layers
 * 3. Handle layer-specific controls
 * 4. Respond to map interactions (clicks, hovers)
 *
 * Usage:
 * ```tsx
 * import { DonorMapExample } from '@/components/map/DonorMapExample';
 *
 * function MyPage() {
 *   return <DonorMapExample />;
 * }
 * ```
 */

import { useEffect, useRef, useState } from 'react';
import Map from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import Extent from '@arcgis/core/geometry/Extent';

import {
  LapsedDonorLayer,
  UpgradeProspectLayer,
  IESpendingLayer,
  DonorLayerSwitcher,
  type DonorLayerType,
} from './layers';

// ============================================================================
// Ingham County Extent
// ============================================================================

const INGHAM_EXTENT = {
  xmin: -85.05,
  xmax: -84.05,
  ymin: 42.38,
  ymax: 42.82,
  spatialReference: { wkid: 4326 },
};

// ============================================================================
// Main Component
// ============================================================================

export function DonorMapExample() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<__esri.MapView | null>(null);
  const [activeLayer, setActiveLayer] = useState<DonorLayerType>('lapsed');
  const [layerOptions, setLayerOptions] = useState({
    individual: {
      colorBy: 'amount' as 'amount' | 'frequency' | 'recency',
      minAmount: 0,
    },
    lapsed: {
      colorBy: 'recoveryScore' as 'recoveryScore' | 'historicalValue' | 'count',
      minRecoveryScore: 0,
    },
    upgrade: {
      colorBy: 'upgradeScore' as 'upgradeScore' | 'upgradeGap' | 'utilization',
      minScore: 0,
    },
    ie: {
      showFor: 'all' as 'all' | 'DEM' | 'REP',
      colorBy: 'netAdvantage' as 'totalSpending' | 'netAdvantage',
    },
  });

  // ============================================================================
  // Initialize Map
  // ============================================================================

  useEffect(() => {
    if (!mapRef.current) return;

    const initMap = async () => {
      const map = new Map({
        basemap: 'gray-vector',
      });

      const extent = new Extent(INGHAM_EXTENT);

      const mapView = new MapView({
        container: mapRef.current!,
        map: map,
        extent: extent,
        constraints: {
          minZoom: 8,
          maxZoom: 18,
        },
      });

      await mapView.when();
      setView(mapView);
      console.log('[DonorMapExample] Map initialized');
    };

    initMap();

    return () => {
      if (view) {
        view.destroy();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleLayerChange = (layer: DonorLayerType) => {
    console.log('[DonorMapExample] Layer changed to:', layer);
    setActiveLayer(layer);
  };

  const handleOptionsChange = (layer: keyof typeof layerOptions, options: any) => {
    console.log('[DonorMapExample] Options changed for', layer, options);
    setLayerOptions((prev: typeof layerOptions) => ({
      ...prev,
      [layer]: options,
    }));
  };

  const handleClusterClick = (cluster: any) => {
    console.log('[DonorMapExample] Cluster clicked:', cluster);
    // Could open a detail panel, show donor list, etc.
  };

  const handleZipClick = (zip: string, prospects: any[]) => {
    console.log('[DonorMapExample] ZIP clicked:', zip, 'with', prospects.length, 'prospects');
    // Could open prospect list, filter table, etc.
  };

  const handleRaceClick = (race: string) => {
    console.log('[DonorMapExample] Race clicked:', race);
    // Could show IE spending details, candidate list, etc.
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="relative w-full h-screen">
      {/* Map Container */}
      <div ref={mapRef} className="absolute inset-0" />

      {/* Layer Switcher - Top Right */}
      <div className="absolute top-4 right-4 w-80 z-20">
        <DonorLayerSwitcher
          activeLayer={activeLayer}
          onLayerChange={handleLayerChange}
          layerOptions={layerOptions}
          onOptionsChange={handleOptionsChange}
        />
      </div>

      {/* Map Layers */}
      {view && (
        <>
          <LapsedDonorLayer
            view={view}
            visible={activeLayer === 'lapsed'}
            colorBy={layerOptions.lapsed.colorBy}
            onClusterClick={handleClusterClick}
          />

          <UpgradeProspectLayer
            view={view}
            visible={activeLayer === 'upgrade'}
            colorBy={layerOptions.upgrade.colorBy}
            minScore={layerOptions.upgrade.minScore}
            onZipClick={handleZipClick}
          />

          <IESpendingLayer
            view={view}
            visible={activeLayer === 'ie'}
            showFor={layerOptions.ie.showFor}
            colorBy={layerOptions.ie.colorBy}
            onRaceClick={handleRaceClick}
          />
        </>
      )}

      {/* Info Panel - Bottom Left */}
      <div className="absolute bottom-4 left-4 bg-white rounded-xl shadow-lg p-4 max-w-sm z-20">
        <h3 className="text-sm font-semibold text-gray-800 mb-2">Donor Intelligence Map</h3>
        <p className="text-xs text-gray-600 mb-3">
          Visualize donor patterns, recovery opportunities, and outside spending across Ingham County.
        </p>
        <div className="space-y-2">
          <InfoRow label="Active Layer" value={activeLayer} />
          {activeLayer === 'lapsed' && (
            <InfoRow label="Min Recovery Score" value={layerOptions.lapsed.minRecoveryScore.toString()} />
          )}
          {activeLayer === 'upgrade' && (
            <InfoRow label="Min Upgrade Score" value={layerOptions.upgrade.minScore.toString()} />
          )}
          {activeLayer === 'ie' && (
            <InfoRow label="Party Filter" value={layerOptions.ie.showFor} />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-gray-600">{label}:</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}

export default DonorMapExample;
