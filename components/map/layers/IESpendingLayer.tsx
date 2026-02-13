/**
 * IESpendingLayer Component
 *
 * Visualizes Independent Expenditure (IE) spending targeting districts.
 * Shows which candidates and districts are receiving outside spending,
 * with party advantage indicators.
 *
 * Features:
 * - District outlines colored by IE spending totals
 * - Color by party advantage (blue=DEM, red=REP, purple=contested)
 * - Interactive popups with spending breakdown by candidate
 * - Filter by party (DEM, REP, or all)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Graphic from '@arcgis/core/Graphic';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import PopupTemplate from '@arcgis/core/PopupTemplate';
import Polygon from '@arcgis/core/geometry/Polygon';

// ============================================================================
// Types
// ============================================================================

interface IESpendingLayerProps {
  view: __esri.MapView;
  visible?: boolean;
  showFor?: 'all' | 'DEM' | 'REP';
  colorBy?: 'totalSpending' | 'netAdvantage';
  selectedRace?: string;
  onRaceClick?: (race: string) => void;
}

interface CandidateSpending {
  candidateId: string;
  candidateName: string;
  party: string;
  office: string;
  state: string;
  district: string;
  supportSpending: number;
  opposeSpending: number;
  netSpending: number;
  spenderCount: number;
  topSpenders: {
    committeeId: string;
    committeeName: string;
    amount: number;
    supportOppose: string;
  }[];
}

interface IEData {
  metadata: {
    processedAt: string;
    source: string;
    cycles: string[];
    totalRecords: number;
    michiganRecords: number;
    totalSpending: number;
  };
  byCandidateId: Record<string, CandidateSpending>;
  byDistrict: Record<string, {
    district: string;
    office: string;
    totalSpending: number;
    candidateCount: number;
    demAdvantage: number;
    repAdvantage: number;
    netAdvantage: number;
    candidates: CandidateSpending[];
  }>;
}

// ============================================================================
// District Geometries (Michigan Congressional Districts)
// ============================================================================

const MI_DISTRICTS: Record<string, { district: string; geometry: number[][][] }> = {
  'MI-07': {
    district: 'MI-07',
    // Ingham County area (simplified)
    geometry: [[[-84.9, 42.4], [-84.2, 42.4], [-84.2, 42.9], [-84.9, 42.9], [-84.9, 42.4]]],
  },
  // Other districts can be added as needed
};

// ============================================================================
// Color Functions
// ============================================================================

/**
 * Get color based on net IE advantage
 * Positive = DEM advantage (blue)
 * Negative = REP advantage (red)
 * Near zero = contested (purple)
 */
function getAdvantageColor(netAdvantage: number): [number, number, number, number] {
  const abs = Math.abs(netAdvantage);
  const intensity = Math.min(1, abs / 10000000); // $10M max intensity

  if (Math.abs(netAdvantage) < 500000) {
    // Contested: purple
    return [147, 51, 234, 0.5 + intensity * 0.3] as [number, number, number, number];
  } else if (netAdvantage > 0) {
    // DEM advantage: blue
    return [37, 99, 235, 0.5 + intensity * 0.4] as [number, number, number, number];
  } else {
    // REP advantage: red
    return [220, 38, 38, 0.5 + intensity * 0.4] as [number, number, number, number];
  }
}

/**
 * Get color based on total spending (both parties)
 */
function getTotalSpendingColor(totalSpending: number): [number, number, number, number] {
  const intensity = Math.min(1, totalSpending / 50000000); // $50M max

  // Orange gradient
  if (totalSpending >= 30000000) return [234, 88, 12, 0.9];
  if (totalSpending >= 20000000) return [249, 115, 22, 0.8];
  if (totalSpending >= 10000000) return [251, 146, 60, 0.7];
  if (totalSpending >= 5000000) return [253, 186, 116, 0.6];
  if (totalSpending >= 1000000) return [254, 215, 170, 0.5];
  return [255, 237, 213, 0.4];
}

/**
 * Format currency
 */
function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

/**
 * Get party color
 */
function getPartyColor(party: string): string {
  if (party.includes('DEMOCRAT')) return '#2563eb';
  if (party.includes('REPUBLICAN')) return '#dc2626';
  return '#6b7280';
}

// ============================================================================
// Main Component
// ============================================================================

export function IESpendingLayer({
  view,
  visible = true,
  showFor = 'all',
  colorBy = 'netAdvantage',
  selectedRace,
  onRaceClick,
}: IESpendingLayerProps) {
  const layerRef = useRef<GraphicsLayer | null>(null);
  const clickHandlerRef = useRef<IHandle | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<IEData | null>(null);

  // ============================================================================
  // Load Data
  // ============================================================================

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/data/donors/independent-expenditures.json');
        if (!response.ok) {
          throw new Error('Failed to load IE spending data');
        }
        const jsonData: IEData = await response.json();
        setData(jsonData);
        console.log('[IESpendingLayer] Loaded', Object.keys(jsonData.byCandidateId).length, 'candidates');
      } catch (err) {
        console.error('[IESpendingLayer] Error loading data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // ============================================================================
  // Create District Layer
  // ============================================================================

  const createDistrictLayer = useCallback(() => {
    if (!data) return null;

    const layer = new GraphicsLayer({
      id: 'ie-spending-districts',
      title: 'IE Spending by District',
      listMode: 'hide',
    });

    // Group candidates by district
    const districtGroups = new Map<string, CandidateSpending[]>();
    Object.values(data.byCandidateId).forEach((candidate) => {
      const districtKey = `${candidate.state}-${candidate.district.padStart(2, '0')}`;
      if (!districtGroups.has(districtKey)) {
        districtGroups.set(districtKey, []);
      }
      districtGroups.get(districtKey)!.push(candidate);
    });

    // Create graphics for each district
    districtGroups.forEach((candidates, districtKey) => {
      const districtGeom = MI_DISTRICTS[districtKey];
      if (!districtGeom) return;

      // Calculate district totals
      let totalSpending = 0;
      let demAdvantage = 0;
      let repAdvantage = 0;

      candidates.forEach((candidate) => {
        totalSpending += Math.abs(candidate.supportSpending) + Math.abs(candidate.opposeSpending);

        if (candidate.party.includes('DEMOCRAT')) {
          demAdvantage += candidate.netSpending;
        } else if (candidate.party.includes('REPUBLICAN')) {
          repAdvantage += Math.abs(candidate.netSpending);
        }
      });

      const netAdvantage = demAdvantage - repAdvantage;

      // Filter by party if specified
      if (showFor === 'DEM' && netAdvantage <= 0) return;
      if (showFor === 'REP' && netAdvantage >= 0) return;

      const polygon = new Polygon({
        rings: districtGeom.geometry,
        spatialReference: { wkid: 4326 },
      });

      let fillColor: [number, number, number, number];
      if (colorBy === 'netAdvantage') {
        fillColor = getAdvantageColor(netAdvantage);
      } else {
        fillColor = getTotalSpendingColor(totalSpending);
      }

      const symbol = new SimpleFillSymbol({
        color: fillColor,
        outline: new SimpleLineSymbol({
          color: selectedRace === districtKey ? [51, 168, 82, 1] : [255, 255, 255, 0.8],
          width: selectedRace === districtKey ? 3 : 2,
        }),
      });

      // Sort candidates by total spending
      const sortedCandidates = [...candidates].sort((a, b) => {
        const aTotal = Math.abs(a.supportSpending) + Math.abs(a.opposeSpending);
        const bTotal = Math.abs(b.supportSpending) + Math.abs(b.opposeSpending);
        return bTotal - aTotal;
      });

      const graphic = new Graphic({
        geometry: polygon,
        symbol: symbol,
        attributes: {
          district: districtKey,
          office: candidates[0]?.office || 'Unknown',
          totalSpending,
          demAdvantage,
          repAdvantage,
          netAdvantage,
          candidateCount: candidates.length,
          candidates: sortedCandidates,
        },
        popupTemplate: new PopupTemplate({
          title: '{district} - {office}',
          content: `
            <div style="font-family: Inter, system-ui, sans-serif; font-size: 13px; line-height: 1.5;">
              <!-- Summary -->
              <div style="margin-bottom: 12px; padding: 8px 12px; background: #fef3c7; border-radius: 6px; border-left: 3px solid #f59e0b;">
                <div style="font-size: 10px; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px;">Total IE Spending</div>
                <div style="font-size: 18px; font-weight: 700; color: #1f2937;">${formatCurrency(totalSpending)}</div>
              </div>

              <!-- Party Advantage -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
                <div style="padding: 8px; background: #dbeafe; border-radius: 6px; text-align: center;">
                  <div style="font-size: 10px; color: #1e3a8a;">DEM Advantage</div>
                  <div style="font-size: 16px; font-weight: 700; color: #2563eb;">${formatCurrency(demAdvantage)}</div>
                </div>
                <div style="padding: 8px; background: #fee2e2; border-radius: 6px; text-align: center;">
                  <div style="font-size: 10px; color: #7f1d1d;">REP Advantage</div>
                  <div style="font-size: 16px; font-weight: 700; color: #dc2626;">${formatCurrency(repAdvantage)}</div>
                </div>
              </div>

              <!-- Net Advantage Indicator -->
              <div style="margin-bottom: 12px;">
                <div style="font-size: 10px; color: #6b7280; margin-bottom: 4px;">Net Advantage</div>
                <div style="height: 8px; background: linear-gradient(to right, #dc2626, #f3f4f6, #2563eb); border-radius: 4px; position: relative;">
                  <div style="position: absolute; width: 12px; height: 12px; background: white; border: 2px solid #1f2937; border-radius: 50%; top: -2px; left: calc(50% + ${netAdvantage / (Math.abs(netAdvantage) || 1) * Math.min(50, Math.abs(netAdvantage) / 200000)}% - 6px);"></div>
                </div>
              </div>

              <!-- Candidates -->
              <div style="padding: 8px; background: #f9fafb; border-radius: 6px;">
                <div style="font-size: 10px; color: #6b7280; font-weight: 500; margin-bottom: 6px;">Top Candidates by IE Spending</div>
                ${sortedCandidates.slice(0, 3).map(c => {
                  const total = Math.abs(c.supportSpending) + Math.abs(c.opposeSpending);
                  return `
                    <div style="margin: 6px 0; padding: 6px; background: white; border-radius: 4px; border-left: 3px solid ${getPartyColor(c.party)};">
                      <div style="font-size: 11px; font-weight: 600; color: #1f2937;">${c.candidateName}</div>
                      <div style="font-size: 10px; color: #6b7280;">
                        Support: ${formatCurrency(c.supportSpending)} | Oppose: ${formatCurrency(Math.abs(c.opposeSpending))}
                      </div>
                      <div style="font-size: 10px; font-weight: 500; color: ${c.netSpending > 0 ? '#15803d' : '#dc2626'};">
                        Net: ${formatCurrency(c.netSpending)}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `,
        }),
      });

      layer.add(graphic);
    });

    return layer;
  }, [data, colorBy, showFor, selectedRace]);

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
    const layer = createDistrictLayer();
    if (layer) {
      view.map.add(layer);
      layerRef.current = layer;
      console.log('[IESpendingLayer] Layer added to map');
    }

    return () => {
      if (layerRef.current) {
        view.map.remove(layerRef.current);
      }
    };
  }, [view, data, visible, createDistrictLayer]);

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
    if (!view || !layerRef.current || !onRaceClick) return;

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

        if (hit && hit.graphic.attributes?.district) {
          const district = hit.graphic.attributes.district;
          console.log('[IESpendingLayer] District clicked:', district);
          onRaceClick(district);
        }
      } catch (err) {
        console.error('[IESpendingLayer] Click handler error:', err);
      }
    });

    return () => {
      clickHandlerRef.current?.remove();
    };
  }, [view, onRaceClick]);

  return null; // Non-visual component
}

export default IESpendingLayer;
