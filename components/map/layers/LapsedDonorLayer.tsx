/**
 * LapsedDonorLayer Component
 *
 * Visualizes lapsed donors on the map with cluster markers and heatmap.
 * Shows geographic concentration of donors who have stopped giving,
 * with recovery scores and recommended reactivation strategies.
 *
 * Features:
 * - Heatmap showing lapsed donor concentration
 * - Cluster markers for high-density areas
 * - Color scale: green (high recovery potential) to red (low recovery)
 * - Interactive popups with cluster stats and recommended actions
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Graphic from '@arcgis/core/Graphic';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import TextSymbol from '@arcgis/core/symbols/TextSymbol';
import PopupTemplate from '@arcgis/core/PopupTemplate';
import Point from '@arcgis/core/geometry/Point';
import HeatmapRenderer from '@arcgis/core/renderers/HeatmapRenderer';

// ============================================================================
// Types
// ============================================================================

interface LapsedDonorLayerProps {
  view: __esri.MapView;
  visible?: boolean;
  colorBy?: 'recoveryScore' | 'historicalValue' | 'count';
  onClusterClick?: (cluster: DonorCluster) => void;
  onDonorClick?: (donor: LapsedDonor) => void;
}

interface LapsedDonor {
  donorId: string;
  zipCode: string;
  city: string;
  lastGiftDate: string;
  lastGiftAmount: number;
  totalHistoricalAmount: number;
  giftCount: number;
  avgGift: number;
  likelyParty: string;
  daysSinceLastGift: number;
  monthsSinceLastGift: number;
  recoveryScore: number;
  estimatedRecoveryAmount: number;
  recommendedChannel: string;
  priority: string;
}

interface DonorCluster {
  clusterId: string;
  centroid: { lat: number; lng: number };
  zipCodes: string[];
  donorCount: number;
  totalHistoricalAmount: number;
  avgHistoricalGift: number;
  totalEstimatedRecovery: number;
  avgRecoveryScore: number;
  highPriorityCount: number;
  mediumPriorityCount: number;
  lowPriorityCount: number;
  priorityScore: number;
  recommendedApproach: string;
  estimatedHoursNeeded: number;
}

interface LapsedDonorData {
  metadata: {
    processedAt: string;
    totalLapsed: number;
    totalHistoricalValue: number;
    estimatedRecoveryValue: number;
    avgRecoveryScore: number;
    avgMonthsSinceLapse: number;
  };
  donors: LapsedDonor[];
  clusters: DonorCluster[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get color based on recovery score
 * High score (80-100): Green - high chance of recovery
 * Medium score (50-79): Yellow/Orange - moderate chance
 * Low score (0-49): Red - low chance
 */
function getRecoveryColor(score: number): [number, number, number, number] {
  if (score >= 80) return [34, 197, 94, 0.9]; // Green
  if (score >= 70) return [132, 204, 22, 0.8]; // Lime
  if (score >= 60) return [234, 179, 8, 0.8]; // Yellow
  if (score >= 50) return [251, 146, 60, 0.8]; // Orange
  return [239, 68, 68, 0.8]; // Red
}

/**
 * Get cluster symbol based on priority score
 */
function getClusterSymbol(cluster: DonorCluster, colorBy: string): SimpleMarkerSymbol {
  let color: [number, number, number, number];
  let size: number;

  if (colorBy === 'recoveryScore') {
    color = getRecoveryColor(cluster.avgRecoveryScore);
    size = Math.min(40, 20 + cluster.donorCount / 2);
  } else if (colorBy === 'historicalValue') {
    // Purple gradient for money
    const intensity = Math.min(1, cluster.totalHistoricalAmount / 100000);
    color = [147, 51, 234, 0.7 + intensity * 0.2] as [number, number, number, number];
    size = Math.min(40, 20 + (cluster.totalHistoricalAmount / 5000));
  } else {
    // Blue gradient for count
    const intensity = Math.min(1, cluster.donorCount / 30);
    color = [59, 130, 246, 0.7 + intensity * 0.2] as [number, number, number, number];
    size = Math.min(40, 15 + cluster.donorCount);
  }

  return new SimpleMarkerSymbol({
    style: 'circle',
    color: color,
    size: size,
    outline: {
      color: [255, 255, 255, 0.9],
      width: 2,
    },
  });
}

/**
 * Format currency
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ============================================================================
// Main Component
// ============================================================================

export function LapsedDonorLayer({
  view,
  visible = true,
  colorBy = 'recoveryScore',
  onClusterClick,
  onDonorClick,
}: LapsedDonorLayerProps) {
  const clusterLayerRef = useRef<GraphicsLayer | null>(null);
  const heatmapLayerRef = useRef<FeatureLayer | null>(null);
  const clickHandlerRef = useRef<IHandle | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LapsedDonorData | null>(null);

  // ============================================================================
  // Load Data
  // ============================================================================

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/data/donors/lapsed-donors.json');
        if (!response.ok) {
          throw new Error('Failed to load lapsed donor data');
        }
        const jsonData: LapsedDonorData = await response.json();
        setData(jsonData);
        console.log('[LapsedDonorLayer] Loaded', jsonData.donors.length, 'lapsed donors');
      } catch (err) {
        console.error('[LapsedDonorLayer] Error loading data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // ============================================================================
  // Create Cluster Markers
  // ============================================================================

  const createClusterLayer = useCallback(() => {
    if (!data) return null;

    const layer = new GraphicsLayer({
      id: 'lapsed-donor-clusters',
      title: 'Lapsed Donor Clusters',
      listMode: 'hide',
    });

    data.clusters.forEach((cluster) => {
      const point = new Point({
        longitude: cluster.centroid.lng,
        latitude: cluster.centroid.lat,
        spatialReference: { wkid: 4326 },
      });

      const symbol = getClusterSymbol(cluster, colorBy);

      // Create count label
      const textSymbol = new TextSymbol({
        text: cluster.donorCount.toString(),
        color: [255, 255, 255],
        haloColor: [0, 0, 0],
        haloSize: 1,
        font: {
          size: 10,
          weight: 'bold',
        },
        yoffset: 0,
      });

      const graphic = new Graphic({
        geometry: point,
        symbol: symbol,
        attributes: cluster,
        popupTemplate: new PopupTemplate({
          title: 'Lapsed Donor Cluster',
          content: `
            <div style="font-family: Inter, system-ui, sans-serif; font-size: 13px; line-height: 1.5;">
              <!-- Cluster Summary -->
              <div style="margin-bottom: 12px; padding: 8px 12px; background: #fef3c7; border-radius: 6px; border-left: 3px solid #f59e0b;">
                <div style="font-size: 10px; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px;">Cluster Stats</div>
                <div style="font-size: 14px; font-weight: 600; color: #1f2937;">${cluster.donorCount} Lapsed Donors</div>
                <div style="font-size: 11px; color: #6b7280;">ZIP Codes: ${cluster.zipCodes.join(', ')}</div>
              </div>

              <!-- Financial Summary -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
                <div style="padding: 8px; background: #f3f4f6; border-radius: 6px; text-align: center;">
                  <div style="font-size: 10px; color: #6b7280;">Historical Value</div>
                  <div style="font-size: 16px; font-weight: 700; color: #1f2937;">${formatCurrency(cluster.totalHistoricalAmount)}</div>
                </div>
                <div style="padding: 8px; background: #dcfce7; border-radius: 6px; text-align: center;">
                  <div style="font-size: 10px; color: #166534;">Est. Recovery</div>
                  <div style="font-size: 16px; font-weight: 700; color: #15803d;">${formatCurrency(cluster.totalEstimatedRecovery)}</div>
                </div>
              </div>

              <!-- Recovery Score -->
              <div style="margin-bottom: 12px;">
                <div style="font-size: 10px; color: #6b7280; margin-bottom: 4px;">Avg Recovery Score: ${cluster.avgRecoveryScore.toFixed(0)}/100</div>
                <div style="height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden;">
                  <div style="height: 100%; background: linear-gradient(to right, #22c55e, #84cc16); width: ${cluster.avgRecoveryScore}%;"></div>
                </div>
              </div>

              <!-- Priority Breakdown -->
              <div style="display: flex; gap: 6px; margin-bottom: 12px;">
                ${cluster.highPriorityCount > 0 ? `<span style="padding: 2px 8px; background: #fecaca; color: #991b1b; border-radius: 12px; font-size: 11px;">High: ${cluster.highPriorityCount}</span>` : ''}
                ${cluster.mediumPriorityCount > 0 ? `<span style="padding: 2px 8px; background: #fed7aa; color: #9a3412; border-radius: 12px; font-size: 11px;">Med: ${cluster.mediumPriorityCount}</span>` : ''}
                ${cluster.lowPriorityCount > 0 ? `<span style="padding: 2px 8px; background: #e5e7eb; color: #374151; border-radius: 12px; font-size: 11px;">Low: ${cluster.lowPriorityCount}</span>` : ''}
              </div>

              <!-- Recommendation -->
              <div style="padding: 8px; background: #f0fdf4; border-radius: 6px; border: 1px solid #bbf7d0;">
                <div style="font-size: 10px; color: #166534; font-weight: 500; margin-bottom: 2px;">Recommended Approach</div>
                <div style="font-size: 12px; color: #15803d;">${cluster.recommendedApproach}</div>
                <div style="font-size: 10px; color: #6b7280; margin-top: 4px;">Est. ${cluster.estimatedHoursNeeded} hours needed</div>
              </div>
            </div>
          `,
        }),
      });

      layer.add(graphic);

      // Add count label as separate graphic
      const labelGraphic = new Graphic({
        geometry: point,
        symbol: textSymbol,
      });
      layer.add(labelGraphic);
    });

    return layer;
  }, [data, colorBy]);

  // ============================================================================
  // Create Heatmap Layer (for individual donors)
  // ============================================================================

  const createHeatmapLayer = useCallback(() => {
    if (!data) return null;

    // Group donors by ZIP code to get centroids
    const zipGroups: Record<string, { donors: LapsedDonor[]; count: number; totalRecovery: number }> = {};

    data.donors.forEach((donor) => {
      if (!zipGroups[donor.zipCode]) {
        zipGroups[donor.zipCode] = { donors: [], count: 0, totalRecovery: 0 };
      }
      zipGroups[donor.zipCode].donors.push(donor);
      zipGroups[donor.zipCode].count++;
      zipGroups[donor.zipCode].totalRecovery += donor.estimatedRecoveryAmount;
    });

    // Create graphics for each ZIP with weight based on recovery potential
    const graphics: Graphic[] = [];
    Object.entries(zipGroups).forEach(([zipCode, group]) => {
      // Find centroid from cluster data
      const cluster = data.clusters.find(c => c.zipCodes.includes(zipCode));
      if (!cluster) return;

      const point = new Point({
        longitude: cluster.centroid.lng,
        latitude: cluster.centroid.lat,
        spatialReference: { wkid: 4326 },
      });

      const graphic = new Graphic({
        geometry: point,
        attributes: {
          ObjectID: graphics.length + 1,
          zipCode,
          donorCount: group.count,
          totalRecovery: group.totalRecovery,
          weight: group.totalRecovery / 1000, // Weight by recovery potential
        },
      });

      graphics.push(graphic);
    });

    // Create FeatureLayer with client-side source for heatmap rendering
    const layer = new FeatureLayer({
      id: 'lapsed-donor-heatmap',
      title: 'Lapsed Donor Heatmap',
      listMode: 'hide',
      source: graphics,
      objectIdField: 'ObjectID',
      fields: [
        { name: 'ObjectID', type: 'oid' },
        { name: 'zipCode', type: 'string' },
        { name: 'donorCount', type: 'integer' },
        { name: 'totalRecovery', type: 'double' },
        { name: 'weight', type: 'double' },
      ],
      geometryType: 'point',
      spatialReference: { wkid: 4326 },
      renderer: new HeatmapRenderer({
        field: 'weight',
        colorStops: [
          { ratio: 0, color: [255, 255, 255, 0] },
          { ratio: 0.2, color: [254, 240, 138, 0.4] },
          { ratio: 0.5, color: [251, 191, 36, 0.6] },
          { ratio: 0.8, color: [234, 88, 12, 0.8] },
          { ratio: 1, color: [220, 38, 38, 0.9] },
        ],
        radius: 30,
        maxDensity: 0.05,
        minDensity: 0,
      }),
    });

    return layer;
  }, [data]);

  // ============================================================================
  // Add Layers to Map
  // ============================================================================

  useEffect(() => {
    if (!view || !data) return;

    // Remove existing layers
    if (clusterLayerRef.current) {
      view.map.remove(clusterLayerRef.current);
      clusterLayerRef.current = null;
    }
    if (heatmapLayerRef.current) {
      view.map.remove(heatmapLayerRef.current);
      heatmapLayerRef.current = null;
    }

    if (!visible) return;

    // Create and add heatmap layer (below clusters)
    const heatmapLayer = createHeatmapLayer();
    if (heatmapLayer) {
      view.map.add(heatmapLayer);
      heatmapLayerRef.current = heatmapLayer;
    }

    // Create and add cluster layer (on top)
    const clusterLayer = createClusterLayer();
    if (clusterLayer) {
      view.map.add(clusterLayer);
      clusterLayerRef.current = clusterLayer;
    }

    console.log('[LapsedDonorLayer] Layers added to map');

    return () => {
      if (clusterLayerRef.current) {
        view.map.remove(clusterLayerRef.current);
      }
      if (heatmapLayerRef.current) {
        view.map.remove(heatmapLayerRef.current);
      }
    };
  }, [view, data, visible, createClusterLayer, createHeatmapLayer]);

  // ============================================================================
  // Update Visibility
  // ============================================================================

  useEffect(() => {
    if (clusterLayerRef.current) {
      clusterLayerRef.current.visible = visible;
    }
    if (heatmapLayerRef.current) {
      heatmapLayerRef.current.visible = visible;
    }
  }, [visible]);

  // ============================================================================
  // Click Handler
  // ============================================================================

  useEffect(() => {
    if (!view || !clusterLayerRef.current || !onClusterClick) return;

    const layer = clusterLayerRef.current;

    clickHandlerRef.current?.remove();
    clickHandlerRef.current = view.on('click', async (event) => {
      try {
        const response = await view.hitTest(event, {
          include: [layer],
        });

        const hit = response.results.find(
          (result) => result.type === 'graphic' && 'graphic' in result
        ) as { graphic: __esri.Graphic } | undefined;

        if (hit && hit.graphic.attributes?.clusterId) {
          const cluster = hit.graphic.attributes as DonorCluster;
          console.log('[LapsedDonorLayer] Cluster clicked:', cluster.clusterId);
          onClusterClick(cluster);
        }
      } catch (err) {
        console.error('[LapsedDonorLayer] Click handler error:', err);
      }
    });

    return () => {
      clickHandlerRef.current?.remove();
    };
  }, [view, onClusterClick]);

  return null; // Non-visual component
}

export default LapsedDonorLayer;
