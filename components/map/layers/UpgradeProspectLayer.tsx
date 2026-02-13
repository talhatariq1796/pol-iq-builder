/**
 * UpgradeProspectLayer Component
 *
 * Visualizes upgrade prospects by ZIP code showing donors with
 * untapped giving potential. Color-coded by upgrade gap and score.
 *
 * Features:
 * - Choropleth by ZIP code showing upgrade potential
 * - Color scale: purple (high gap) to light (low gap)
 * - Interactive popups with ZIP stats and top prospects
 * - Filter slider for minimum upgrade score
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Graphic from '@arcgis/core/Graphic';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import ClassBreaksRenderer from '@arcgis/core/renderers/ClassBreaksRenderer';
import PopupTemplate from '@arcgis/core/PopupTemplate';
import Polygon from '@arcgis/core/geometry/Polygon';

// ============================================================================
// Types
// ============================================================================

interface UpgradeProspectLayerProps {
  view: __esri.MapView;
  visible?: boolean;
  colorBy?: 'upgradeScore' | 'upgradeGap' | 'utilization';
  minScore?: number;
  onZipClick?: (zip: string, prospects: UpgradeProspect[]) => void;
}

interface UpgradeProspect {
  donorId: string;
  zipCode: string;
  city: string;
  currentTotalGiven: number;
  currentAvgGift: number;
  lastGiftAmount: number;
  giftCount: number;
  estimatedCapacity: number;
  capacityConfidence: string;
  zipMedianIncome: number;
  currentUtilization: number;
  upgradeGap: number;
  upgradeScore: number;
  recencyScore: number;
  frequencyScore: number;
  loyaltyIndicator: boolean;
  recommendedAsk: number;
  recommendedChannel: string;
  askRationale: string;
}

interface UpgradeProspectData {
  metadata: {
    processedAt: string;
    totalDonors: number;
    totalProspects: number;
    totalCurrentGiving: number;
    totalUpgradeGap: number;
    avgUpgradeScore: number;
  };
  prospects: UpgradeProspect[];
}

interface ZIPCodeGeometry {
  zipCode: string;
  geometry: number[][][]; // Polygon coordinates
}

// ============================================================================
// Color Scales
// ============================================================================

function getColorByUpgradeScore(score: number): [number, number, number, number] {
  if (score >= 80) return [107, 33, 168, 0.8]; // Deep purple
  if (score >= 70) return [126, 34, 206, 0.75]; // Purple
  if (score >= 60) return [147, 51, 234, 0.7]; // Medium purple
  if (score >= 50) return [168, 85, 247, 0.65]; // Light purple
  if (score >= 40) return [192, 132, 252, 0.6]; // Very light purple
  return [216, 180, 254, 0.5]; // Pale purple
}

function getColorByUpgradeGap(gap: number): [number, number, number, number] {
  // Purple gradient based on money amount
  if (gap >= 10000) return [107, 33, 168, 0.9]; // Deep purple for high gap
  if (gap >= 5000) return [126, 34, 206, 0.8];
  if (gap >= 2000) return [147, 51, 234, 0.7];
  if (gap >= 1000) return [168, 85, 247, 0.6];
  if (gap >= 500) return [192, 132, 252, 0.5];
  return [216, 180, 254, 0.4];
}

function getColorByUtilization(utilization: number): [number, number, number, number] {
  // Inverse: low utilization = more opportunity (deeper purple)
  const opportunity = 1 - utilization;
  if (opportunity >= 0.6) return [107, 33, 168, 0.9]; // 40% or less utilized
  if (opportunity >= 0.5) return [126, 34, 206, 0.8];
  if (opportunity >= 0.4) return [147, 51, 234, 0.7];
  if (opportunity >= 0.3) return [168, 85, 247, 0.6];
  if (opportunity >= 0.2) return [192, 132, 252, 0.5];
  return [216, 180, 254, 0.4];
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
// Michigan ZIP Code Geometries (subset for Ingham County)
// ============================================================================

const INGHAM_COUNTY_ZIPS: Record<string, ZIPCodeGeometry> = {
  '48823': {
    zipCode: '48823',
    geometry: [[[-84.5, 42.73], [-84.45, 42.73], [-84.45, 42.76], [-84.5, 42.76], [-84.5, 42.73]]],
  },
  '48840': {
    zipCode: '48840',
    geometry: [[[-84.4, 42.72], [-84.35, 42.72], [-84.35, 42.75], [-84.4, 42.75], [-84.4, 42.72]]],
  },
  '48864': {
    zipCode: '48864',
    geometry: [[[-84.45, 42.69], [-84.38, 42.69], [-84.38, 42.72], [-84.45, 42.72], [-84.45, 42.69]]],
  },
  '48906': {
    zipCode: '48906',
    geometry: [[[-84.57, 42.72], [-84.53, 42.72], [-84.53, 42.75], [-84.57, 42.75], [-84.57, 42.72]]],
  },
  '48910': {
    zipCode: '48910',
    geometry: [[[-84.58, 42.70], [-84.54, 42.70], [-84.54, 42.73], [-84.58, 42.73], [-84.58, 42.70]]],
  },
  '48911': {
    zipCode: '48911',
    geometry: [[[-84.57, 42.74], [-84.53, 42.74], [-84.53, 42.77], [-84.57, 42.77], [-84.57, 42.74]]],
  },
  '48912': {
    zipCode: '48912',
    geometry: [[[-84.56, 42.76], [-84.52, 42.76], [-84.52, 42.79], [-84.56, 42.79], [-84.56, 42.76]]],
  },
  '48917': {
    zipCode: '48917',
    geometry: [[[-84.59, 42.67], [-84.55, 42.67], [-84.55, 42.70], [-84.59, 42.70], [-84.59, 42.67]]],
  },
  '48854': {
    zipCode: '48854',
    geometry: [[[-84.48, 42.57], [-84.42, 42.57], [-84.42, 42.61], [-84.48, 42.61], [-84.48, 42.57]]],
  },
  '48842': {
    zipCode: '48842',
    geometry: [[[-84.52, 42.64], [-84.47, 42.64], [-84.47, 42.67], [-84.52, 42.67], [-84.52, 42.64]]],
  },
  '48895': {
    zipCode: '48895',
    geometry: [[[-84.35, 42.68], [-84.29, 42.68], [-84.29, 42.71], [-84.35, 42.71], [-84.35, 42.68]]],
  },
  '48821': {
    zipCode: '48821',
    geometry: [[[-84.65, 42.60], [-84.60, 42.60], [-84.60, 42.63], [-84.65, 42.63], [-84.65, 42.60]]],
  },
  '48837': {
    zipCode: '48837',
    geometry: [[[-84.78, 42.74], [-84.72, 42.74], [-84.72, 42.78], [-84.78, 42.78], [-84.78, 42.74]]],
  },
  '48933': {
    zipCode: '48933',
    geometry: [[[-84.56, 42.67], [-84.52, 42.67], [-84.52, 42.70], [-84.56, 42.70], [-84.56, 42.67]]],
  },
  '48915': {
    zipCode: '48915',
    geometry: [[[-84.58, 42.74], [-84.54, 42.74], [-84.54, 42.77], [-84.58, 42.77], [-84.58, 42.74]]],
  },
};

// ============================================================================
// Main Component
// ============================================================================

export function UpgradeProspectLayer({
  view,
  visible = true,
  colorBy = 'upgradeScore',
  minScore = 0,
  onZipClick,
}: UpgradeProspectLayerProps) {
  const layerRef = useRef<GraphicsLayer | null>(null);
  const clickHandlerRef = useRef<IHandle | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<UpgradeProspectData | null>(null);

  // ============================================================================
  // Load Data
  // ============================================================================

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/data/donors/upgrade-prospects.json');
        if (!response.ok) {
          throw new Error('Failed to load upgrade prospect data');
        }
        const jsonData: UpgradeProspectData = await response.json();
        setData(jsonData);
        console.log('[UpgradeProspectLayer] Loaded', jsonData.prospects.length, 'upgrade prospects');
      } catch (err) {
        console.error('[UpgradeProspectLayer] Error loading data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // ============================================================================
  // Aggregate Prospects by ZIP
  // ============================================================================

  const zipAggregates = useCallback(() => {
    if (!data) return new Map();

    const aggregates = new Map<string, {
      zipCode: string;
      city: string;
      prospectCount: number;
      totalCurrentGiving: number;
      totalUpgradeGap: number;
      avgUpgradeScore: number;
      avgUtilization: number;
      topProspects: UpgradeProspect[];
    }>();

    data.prospects
      .filter(p => p.upgradeScore >= minScore)
      .forEach((prospect) => {
        if (!aggregates.has(prospect.zipCode)) {
          aggregates.set(prospect.zipCode, {
            zipCode: prospect.zipCode,
            city: prospect.city,
            prospectCount: 0,
            totalCurrentGiving: 0,
            totalUpgradeGap: 0,
            avgUpgradeScore: 0,
            avgUtilization: 0,
            topProspects: [],
          });
        }

        const agg = aggregates.get(prospect.zipCode)!;
        agg.prospectCount++;
        agg.totalCurrentGiving += prospect.currentTotalGiven;
        agg.totalUpgradeGap += prospect.upgradeGap;
        agg.topProspects.push(prospect);
      });

    // Calculate averages and sort top prospects
    aggregates.forEach((agg) => {
      agg.avgUpgradeScore = agg.topProspects.reduce((sum, p) => sum + p.upgradeScore, 0) / agg.prospectCount;
      agg.avgUtilization = agg.topProspects.reduce((sum, p) => sum + p.currentUtilization, 0) / agg.prospectCount;
      agg.topProspects.sort((a, b) => b.upgradeScore - a.upgradeScore);
      agg.topProspects = agg.topProspects.slice(0, 5); // Top 5
    });

    return aggregates;
  }, [data, minScore]);

  // ============================================================================
  // Create ZIP Code Layer
  // ============================================================================

  const createZipLayer = useCallback(() => {
    const aggregates = zipAggregates();
    if (aggregates.size === 0) return null;

    const layer = new GraphicsLayer({
      id: 'upgrade-prospect-zips',
      title: 'Upgrade Prospect ZIPs',
      listMode: 'hide',
    });

    aggregates.forEach((agg, zipCode) => {
      const zipGeom = INGHAM_COUNTY_ZIPS[zipCode];
      if (!zipGeom) return;

      const polygon = new Polygon({
        rings: zipGeom.geometry,
        spatialReference: { wkid: 4326 },
      });

      let fillColor: [number, number, number, number];
      if (colorBy === 'upgradeScore') {
        fillColor = getColorByUpgradeScore(agg.avgUpgradeScore);
      } else if (colorBy === 'upgradeGap') {
        fillColor = getColorByUpgradeGap(agg.totalUpgradeGap);
      } else {
        fillColor = getColorByUtilization(agg.avgUtilization);
      }

      const symbol = new SimpleFillSymbol({
        color: fillColor,
        outline: new SimpleLineSymbol({
          color: [147, 51, 234, 0.9],
          width: 2,
        }),
      });

      const graphic = new Graphic({
        geometry: polygon,
        symbol: symbol,
        attributes: {
          ...agg,
          prospectList: agg.topProspects,
        },
        popupTemplate: new PopupTemplate({
          title: 'ZIP {zipCode} - {city}',
          content: `
            <div style="font-family: Inter, system-ui, sans-serif; font-size: 13px; line-height: 1.5;">
              <!-- Summary -->
              <div style="margin-bottom: 12px; padding: 8px 12px; background: #faf5ff; border-radius: 6px; border-left: 3px solid #9333ea;">
                <div style="font-size: 10px; color: #6b21a8; text-transform: uppercase; letter-spacing: 0.5px;">Upgrade Opportunity</div>
                <div style="font-size: 14px; font-weight: 600; color: #1f2937;">{prospectCount} High-Potential Donors</div>
              </div>

              <!-- Financial Grid -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
                <div style="padding: 8px; background: #f3f4f6; border-radius: 6px; text-align: center;">
                  <div style="font-size: 10px; color: #6b7280;">Current Giving</div>
                  <div style="font-size: 16px; font-weight: 700; color: #1f2937;">${formatCurrency(agg.totalCurrentGiving)}</div>
                </div>
                <div style="padding: 8px; background: #dcfce7; border-radius: 6px; text-align: center;">
                  <div style="font-size: 10px; color: #166534;">Upgrade Gap</div>
                  <div style="font-size: 16px; font-weight: 700; color: #15803d;">${formatCurrency(agg.totalUpgradeGap)}</div>
                </div>
              </div>

              <!-- Scores -->
              <div style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: #6b7280; margin-bottom: 2px;">
                  <span>Avg Upgrade Score</span>
                  <span style="font-weight: 600; color: #1f2937;">${agg.avgUpgradeScore.toFixed(0)}/100</span>
                </div>
                <div style="height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden;">
                  <div style="height: 100%; background: linear-gradient(to right, #9333ea, #c084fc); width: ${agg.avgUpgradeScore}%;"></div>
                </div>
              </div>

              <div style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: #6b7280; margin-bottom: 2px;">
                  <span>Avg Capacity Utilization</span>
                  <span style="font-weight: 600; color: #1f2937;">${(agg.avgUtilization * 100).toFixed(0)}%</span>
                </div>
                <div style="height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden;">
                  <div style="height: 100%; background: #6b7280; width: ${agg.avgUtilization * 100}%;"></div>
                </div>
              </div>

              <!-- Top Prospects -->
              <div style="padding: 8px; background: #f0fdf4; border-radius: 6px; border: 1px solid #bbf7d0;">
                <div style="font-size: 10px; color: #166534; font-weight: 500; margin-bottom: 4px;">Top Upgrade Prospects</div>
                <div style="font-size: 11px; color: #15803d;">
                  ${agg.topProspects.slice(0, 3).map((p: UpgradeProspect) =>
                    `<div style="margin: 2px 0;">• Score ${p.upgradeScore}: ${formatCurrency(p.upgradeGap)} gap, ask ${formatCurrency(p.recommendedAsk)}</div>`
                  ).join('')}
                </div>
              </div>
            </div>
          `,
        }),
      });

      layer.add(graphic);
    });

    return layer;
  }, [zipAggregates, colorBy]);

  // ============================================================================
  // Add Layer to Map
  // ============================================================================

  useEffect(() => {
    if (!view || !data) return;

    // Remove existing layer
    if (layerRef.current) {
      view.map.remove(layerRef.current);
      layerRef.current = null;
    }

    if (!visible) return;

    // Create and add layer
    const layer = createZipLayer();
    if (layer) {
      view.map.add(layer);
      layerRef.current = layer;
      console.log('[UpgradeProspectLayer] Layer added to map');
    }

    return () => {
      if (layerRef.current) {
        view.map.remove(layerRef.current);
      }
    };
  }, [view, data, visible, createZipLayer]);

  // ============================================================================
  // Update Visibility
  // ============================================================================

  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.visible = visible;
    }
  }, [visible]);

  // ============================================================================
  // Click Handler
  // ============================================================================

  useEffect(() => {
    if (!view || !layerRef.current || !onZipClick) return;

    const layer = layerRef.current;

    clickHandlerRef.current?.remove();
    clickHandlerRef.current = view.on('click', async (event) => {
      try {
        const response = await view.hitTest(event, {
          include: [layer],
        });

        const hit = response.results.find(
          (result) => result.type === 'graphic' && 'graphic' in result
        ) as { graphic: __esri.Graphic } | undefined;

        if (hit && hit.graphic.attributes?.zipCode) {
          const zipCode = hit.graphic.attributes.zipCode;
          const prospects = hit.graphic.attributes.prospectList || [];
          console.log('[UpgradeProspectLayer] ZIP clicked:', zipCode);
          onZipClick(zipCode, prospects);
        }
      } catch (err) {
        console.error('[UpgradeProspectLayer] Click handler error:', err);
      }
    });

    return () => {
      clickHandlerRef.current?.remove();
    };
  }, [view, onZipClick]);

  return null; // Non-visual component
}

export default UpgradeProspectLayer;
