/**
 * Turf Boundary Layer
 *
 * Displays canvassing turf boundaries on the map with
 * status-based coloring and interactive popups.
 * Uses ArcGIS Maps SDK for integration with PoliticalMapContainer.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import GeoJSONLayer from '@arcgis/core/layers/GeoJSONLayer';
import Graphic from '@arcgis/core/Graphic';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import UniqueValueRenderer from '@arcgis/core/renderers/UniqueValueRenderer';
import ClassBreaksRenderer from '@arcgis/core/renderers/ClassBreaksRenderer';
import PopupTemplate from '@arcgis/core/PopupTemplate';
import LabelClass from '@arcgis/core/layers/support/LabelClass';
import TextSymbol from '@arcgis/core/symbols/TextSymbol';

import type { CanvassingTurf } from '@/lib/canvassing/types';
import type { TurfProgress } from '@/lib/canvassing/types-progress';
import { politicalDataService } from '@/lib/services/PoliticalDataService';

// ============================================================================
// Color Schemes
// ============================================================================

// Status-based colors
const STATUS_COLORS = {
  not_started: {
    fill: [107, 114, 128, 0.5],       // gray-500
    outline: [75, 85, 99, 1],         // gray-600
    label: 'Not Started',
  },
  in_progress: {
    fill: [59, 130, 246, 0.6],        // blue-500
    outline: [37, 99, 235, 1],        // blue-600
    label: 'In Progress',
  },
  stalled: {
    fill: [239, 68, 68, 0.6],         // red-500
    outline: [220, 38, 38, 1],        // red-600
    label: 'Stalled',
  },
  complete: {
    fill: [34, 197, 94, 0.6],         // green-500
    outline: [22, 163, 74, 1],        // green-600
    label: 'Complete',
  },
} as const;

// Completion percentage colors (interpolated)
const COMPLETION_COLORS: Array<[number, [number, number, number, number]]> = [
  [0, [254, 226, 226, 0.6]],      // red-100  | 0%
  [25, [254, 202, 202, 0.6]],     // red-200  | 25%
  [50, [252, 211, 77, 0.6]],      // yellow-300  | 50%
  [75, [163, 230, 53, 0.7]],      // lime-400  | 75%
  [100, [34, 197, 94, 0.7]],      // green-500  | 100%
];

// Priority colors (high to low)
const PRIORITY_COLORS: Array<[number, [number, number, number, number]]> = [
  [0, [229, 231, 235, 0.5]],      // gray-200  | Low priority
  [3, [253, 224, 71, 0.6]],       // yellow-300  | Medium
  [7, [251, 146, 60, 0.7]],       // orange-400  | High
  [10, [239, 68, 68, 0.8]],       // red-500  | Critical
];

// Default symbol for turfs without data
const DEFAULT_SYMBOL = new SimpleFillSymbol({
  color: [200, 200, 200, 0.4],
  outline: new SimpleLineSymbol({
    color: [150, 150, 150],
    width: 1,
  }),
});

// MPIQ Green highlight symbol for selected turfs
const HIGHLIGHT_SYMBOL = new SimpleFillSymbol({
  color: [51, 168, 82, 0.4],
  outline: new SimpleLineSymbol({
    color: [51, 168, 82, 1],
    width: 3,
  }),
});

// ============================================================================
// Component Props
// ============================================================================

export interface TurfBoundaryLayerProps {
  view: __esri.MapView;
  turfs: CanvassingTurf[];
  progress: Map<string, TurfProgress>; // turfId -> progress
  selectedTurfId?: string | null;
  onTurfClick?: (turfId: string, attributes: any) => void;
  onTurfHover?: (turfId: string | null, attributes?: any) => void;
  colorBy?: 'status' | 'completion' | 'priority' | 'density';
  visible?: boolean;
  opacity?: number;
  showLabels?: boolean;
  enablePopup?: boolean;
}

// ============================================================================
// Main Component
// ============================================================================

export function TurfBoundaryLayer({
  view,
  turfs,
  progress,
  selectedTurfId = null,
  onTurfClick,
  onTurfHover,
  colorBy = 'status',
  visible = true,
  opacity = 0.7,
  showLabels = false,
  enablePopup = true,
}: TurfBoundaryLayerProps) {
  const layerRef = useRef<GeoJSONLayer | null>(null);
  const clickHandlerRef = useRef<IHandle | null>(null);
  const hoverHandlerRef = useRef<IHandle | null>(null);
  const highlightRef = useRef<__esri.Handle | null>(null);
  const highlightGraphicRef = useRef<__esri.Graphic | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // Create Renderer Based on colorBy Prop
  // ============================================================================

  const createRenderer = useCallback((colorMode: typeof colorBy) => {
    if (colorMode === 'status') {
      // Use UniqueValueRenderer for discrete status categories
      return new UniqueValueRenderer({
        field: 'status',
        defaultSymbol: DEFAULT_SYMBOL,
        uniqueValueInfos: Object.entries(STATUS_COLORS).map(([status, colors]) => ({
          value: status,
          symbol: new SimpleFillSymbol({
            color: colors.fill as [number, number, number, number],
            outline: new SimpleLineSymbol({
              color: colors.outline as [number, number, number, number],
              width: 1.5,
            }),
          }),
          label: colors.label,
        })),
      });
    } else if (colorMode === 'completion') {
      // Use ClassBreaksRenderer for completion percentage
      return new ClassBreaksRenderer({
        field: 'percentComplete',
        defaultSymbol: DEFAULT_SYMBOL,
        classBreakInfos: [
          {
            minValue: 0,
            maxValue: 25,
            symbol: new SimpleFillSymbol({
              color: COMPLETION_COLORS[0][1],
              outline: new SimpleLineSymbol({ color: [150, 150, 150], width: 1 }),
            }),
            label: '0-25%',
          },
          {
            minValue: 25,
            maxValue: 50,
            symbol: new SimpleFillSymbol({
              color: COMPLETION_COLORS[1][1],
              outline: new SimpleLineSymbol({ color: [150, 150, 150], width: 1 }),
            }),
            label: '25-50%',
          },
          {
            minValue: 50,
            maxValue: 75,
            symbol: new SimpleFillSymbol({
              color: COMPLETION_COLORS[2][1],
              outline: new SimpleLineSymbol({ color: [150, 150, 150], width: 1 }),
            }),
            label: '50-75%',
          },
          {
            minValue: 75,
            maxValue: 100,
            symbol: new SimpleFillSymbol({
              color: COMPLETION_COLORS[3][1],
              outline: new SimpleLineSymbol({ color: [150, 150, 150], width: 1 }),
            }),
            label: '75-100%',
          },
        ],
      });
    } else if (colorMode === 'priority') {
      // Use ClassBreaksRenderer for priority (0-10 scale)
      return new ClassBreaksRenderer({
        field: 'priority',
        defaultSymbol: DEFAULT_SYMBOL,
        classBreakInfos: [
          {
            minValue: 0,
            maxValue: 3,
            symbol: new SimpleFillSymbol({
              color: PRIORITY_COLORS[0][1],
              outline: new SimpleLineSymbol({ color: [150, 150, 150], width: 1 }),
            }),
            label: 'Low (0-3)',
          },
          {
            minValue: 3,
            maxValue: 7,
            symbol: new SimpleFillSymbol({
              color: PRIORITY_COLORS[1][1],
              outline: new SimpleLineSymbol({ color: [150, 150, 150], width: 1 }),
            }),
            label: 'Medium (3-7)',
          },
          {
            minValue: 7,
            maxValue: 10,
            symbol: new SimpleFillSymbol({
              color: PRIORITY_COLORS[2][1],
              outline: new SimpleLineSymbol({ color: [150, 150, 150], width: 1 }),
            }),
            label: 'High (7-10)',
          },
        ],
      });
    } else {
      // Density mode - simple categorical
      return new UniqueValueRenderer({
        field: 'density',
        defaultSymbol: DEFAULT_SYMBOL,
        uniqueValueInfos: [
          {
            value: 'urban',
            symbol: new SimpleFillSymbol({
              color: [239, 68, 68, 0.6],
              outline: new SimpleLineSymbol({ color: [220, 38, 38], width: 1.5 }),
            }),
            label: 'Urban',
          },
          {
            value: 'suburban',
            symbol: new SimpleFillSymbol({
              color: [251, 146, 60, 0.6],
              outline: new SimpleLineSymbol({ color: [234, 88, 12], width: 1.5 }),
            }),
            label: 'Suburban',
          },
          {
            value: 'rural',
            symbol: new SimpleFillSymbol({
              color: [253, 224, 71, 0.6],
              outline: new SimpleLineSymbol({ color: [234, 179, 8], width: 1.5 }),
            }),
            label: 'Rural',
          },
        ],
      });
    }
  }, []);

  // ============================================================================
  // Create Popup Template
  // ============================================================================

  const createPopupTemplate = useCallback(() => {
    return new PopupTemplate({
      title: '<div style="font-size: 14px; font-weight: 600; color: #1f2937; font-family: Inter, system-ui, sans-serif;">{turfName}</div>',
      content: `
        <div style="font-family: Inter, system-ui, sans-serif; font-size: 13px; line-height: 1.5;">
          <!-- Status Badge -->
          <div style="margin-bottom: 12px; padding: 8px 12px; background: #f3f4f6; border-radius: 6px; border-left: 3px solid #33a852;">
            <div style="font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Status</div>
            <div style="font-size: 14px; font-weight: 600; color: #1f2937; text-transform: capitalize;">{status}</div>
          </div>

          <!-- Progress Bar (if in progress or complete) -->
          <div style="margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-size: 11px; color: #6b7280;">Progress</span>
              <span style="font-size: 11px; font-weight: 600; color: #1f2937;">{percentComplete}%</span>
            </div>
            <div style="height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden;">
              <div style="height: 100%; background: linear-gradient(to right, #33a852, #10b981); width: {percentComplete}%;"></div>
            </div>
          </div>

          <!-- Metrics Grid -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
            <div style="padding: 8px; background: #fef3c7; border-radius: 6px; text-align: center;">
              <div style="font-size: 10px; color: #92400e;">Estimated Doors</div>
              <div style="font-size: 18px; font-weight: 700; color: #b45309;">{estimatedDoors}</div>
            </div>
            <div style="padding: 8px; background: #e0e7ff; border-radius: 6px; text-align: center;">
              <div style="font-size: 10px; color: #3730a3;">Est. Hours</div>
              <div style="font-size: 18px; font-weight: 700; color: #4338ca;">{estimatedHours}</div>
            </div>
          </div>

          <!-- Density & Priority -->
          <div style="display: flex; gap: 6px; margin-bottom: 12px;">
            <span style="padding: 4px 8px; background: #f3f4f6; color: #374151; border-radius: 12px; font-size: 11px; text-transform: capitalize;">{density}</span>
            <span style="padding: 4px 8px; background: #fef3c7; color: #92400e; border-radius: 12px; font-size: 11px;">Priority: {priority}/10</span>
          </div>

          <!-- Scores -->
          <div style="padding: 8px; background: #f0fdf4; border-radius: 6px; border: 1px solid #bbf7d0;">
            <div style="font-size: 10px; color: #166534; font-weight: 500; margin-bottom: 4px;">Targeting Scores</div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; color: #15803d;">
              <span>GOTV: {avgGotvPriority}</span>
              <span>Persuasion: {avgPersuasionOpportunity}</span>
            </div>
          </div>

          <!-- Precincts count -->
          <div style="margin-top: 8px; font-size: 11px; color: #6b7280; text-align: center;">
            {precinctCount} precinct{precinctCount_plural}
          </div>
        </div>
      `,
    });
  }, []);

  // ============================================================================
  // Create Label Class
  // ============================================================================

  const createLabelClass = useCallback(() => {
    return new LabelClass({
      labelExpressionInfo: {
        expression: '$feature.turfName',
      },
      symbol: new TextSymbol({
        color: [0, 0, 0, 0.9],
        haloColor: [255, 255, 255, 0.9],
        haloSize: 2,
        font: {
          size: 11,
          weight: 'bold',
        },
      }),
      minScale: 150000,
    });
  }, []);

  // ============================================================================
  // Build Turf Geometries from Precincts
  // ============================================================================

  const buildTurfGeometries = useCallback(async (turfsData: CanvassingTurf[]) => {
    // Load precinct boundaries
    const precinctBoundaries = await politicalDataService.loadPrecinctBoundaries();

    // Build GeoJSON features for each turf
    const features: GeoJSON.Feature[] = turfsData.map((turf) => {
      const turfProgress = progress.get(turf.turfId);
      const percentComplete = turfProgress?.percentComplete ?? 0;
      const status = turfProgress?.status ?? 'not_started';

      // Find precinct geometries for this turf
      const precinctGeometries = turf.precinctIds
        .map((precinctId) => {
          const feature = precinctBoundaries.features.find((f) => {
            const props = f.properties || {};
            return (
              props.precinct_id === precinctId ||
              props.id === precinctId ||
              props.name === precinctId ||
              props.precinct_name === precinctId ||
              props.PRECINCT_NAME === precinctId ||
              props.Precinct_Long_Name === precinctId ||
              props.NAME === precinctId
            );
          });
          return feature?.geometry;
        })
        .filter((geom): geom is GeoJSON.Polygon | GeoJSON.MultiPolygon => geom != null);

      // Merge geometries into a single MultiPolygon
      // For simplicity, we'll create a MultiPolygon with all polygons
      let mergedGeometry: GeoJSON.MultiPolygon;

      if (precinctGeometries.length === 0) {
        // Fallback: Create a small placeholder polygon at origin
        console.warn(`[TurfBoundaryLayer] No geometries found for turf ${turf.turfId}`);
        mergedGeometry = {
          type: 'MultiPolygon',
          coordinates: [[[[0, 0], [0, 0.001], [0.001, 0.001], [0.001, 0], [0, 0]]]],
        };
      } else {
        // Collect all polygon rings
        const allRings: number[][][][] = [];
        precinctGeometries.forEach((geom) => {
          if (geom.type === 'Polygon') {
            allRings.push(geom.coordinates);
          } else if (geom.type === 'MultiPolygon') {
            allRings.push(...geom.coordinates);
          }
        });

        mergedGeometry = {
          type: 'MultiPolygon',
          coordinates: allRings,
        };
      }

      return {
        type: 'Feature',
        id: turf.turfId,
        properties: {
          turfId: turf.turfId,
          turfName: turf.turfName,
          estimatedDoors: turf.estimatedDoors,
          estimatedHours: Math.round(turf.estimatedHours * 10) / 10,
          doorsPerHour: Math.round(turf.doorsPerHour),
          density: turf.density,
          priority: turf.priority,
          avgGotvPriority: Math.round(turf.avgGotvPriority),
          avgPersuasionOpportunity: Math.round(turf.avgPersuasionOpportunity),
          precinctCount: turf.precinctIds.length,
          precinctCount_plural: turf.precinctIds.length === 1 ? '' : 's',
          percentComplete: Math.round(percentComplete),
          status: status,
        },
        geometry: mergedGeometry,
      } as GeoJSON.Feature;
    });

    return {
      type: 'FeatureCollection',
      features,
    } as GeoJSON.FeatureCollection;
  }, [progress]);

  // ============================================================================
  // Load Layer
  // ============================================================================

  useEffect(() => {
    if (!view || turfs.length === 0) {
      // No turfs to display
      if (layerRef.current) {
        view?.map.remove(layerRef.current);
        layerRef.current = null;
      }
      return;
    }

    let isMounted = true;

    const loadLayer = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Initialize service
        await politicalDataService.initialize();

        // Build GeoJSON for turfs
        const geoJSON = await buildTurfGeometries(turfs);

        if (!isMounted) return;

        console.log(`[TurfBoundaryLayer] Built ${geoJSON.features.length} turf geometries`);

        // Convert to Blob URL
        const blob = new Blob([JSON.stringify(geoJSON)], {
          type: 'application/json',
        });
        const blobUrl = URL.createObjectURL(blob);

        if (!isMounted) {
          URL.revokeObjectURL(blobUrl);
          return;
        }

        // Remove existing layer
        if (layerRef.current) {
          view.map.remove(layerRef.current);
          layerRef.current = null;
        }

        // Create GeoJSON layer
        const layer = new GeoJSONLayer({
          url: blobUrl,
          title: 'Canvassing Turfs',
          visible,
          opacity,
          outFields: ['*'],
          renderer: createRenderer(colorBy),
          popupTemplate: enablePopup ? createPopupTemplate() : undefined,
          popupEnabled: enablePopup,
          labelingInfo: showLabels ? [createLabelClass()] : undefined,
        });

        // Add to map
        view.map.add(layer);
        layerRef.current = layer;

        // Wait for layer to load
        await layer.load();

        // Wait for layer view
        await view.whenLayerView(layer);

        // Set up click handler
        if (onTurfClick) {
          clickHandlerRef.current?.remove();
          clickHandlerRef.current = view.on('click', async (event) => {
            try {
              const response = await view.hitTest(event, {
                include: [layer],
              });

              const hit = response.results.find(
                (result) => result.type === 'graphic' && 'graphic' in result
              ) as { graphic: __esri.Graphic } | undefined;

              if (hit) {
                const turfId = hit.graphic.getAttribute('turfId');
                const attributes = hit.graphic.attributes;
                console.log('[TurfBoundaryLayer] Turf clicked:', turfId);
                if (turfId && onTurfClick) {
                  onTurfClick(turfId, attributes);
                }
              }
            } catch (err) {
              console.error('[TurfBoundaryLayer] Click handler error:', err);
            }
          });
        }

        // Set up hover handler
        if (onTurfHover) {
          hoverHandlerRef.current?.remove();
          hoverHandlerRef.current = view.on('pointer-move', async (event) => {
            try {
              const response = await view.hitTest(event, {
                include: [layer],
              });

              const hit = response.results.find(
                (result) => result.type === 'graphic' && 'graphic' in result
              ) as { graphic: __esri.Graphic } | undefined;

              if (hit) {
                const turfId = hit.graphic.getAttribute('turfId');
                const attributes = hit.graphic.attributes;
                if (view.container) {
                  view.container.style.cursor = 'pointer';
                }
                if (onTurfHover) {
                  onTurfHover(turfId, attributes);
                }
              } else {
                if (view.container) {
                  view.container.style.cursor = 'default';
                }
                if (onTurfHover) {
                  onTurfHover(null);
                }
              }
            } catch (err) {
              // Silently ignore hover errors
            }
          });
        }

        setIsLoading(false);

        // Cleanup blob URL
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      } catch (err) {
        console.error('[TurfBoundaryLayer] Error loading layer:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load turf boundaries');
          setIsLoading(false);
        }
      }
    };

    loadLayer();

    // Cleanup
    return () => {
      isMounted = false;
      clickHandlerRef.current?.remove();
      hoverHandlerRef.current?.remove();
      highlightRef.current?.remove();

      if (highlightGraphicRef.current) {
        view?.graphics.remove(highlightGraphicRef.current);
        highlightGraphicRef.current = null;
      }

      if (layerRef.current) {
        view.map?.remove(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [
    view,
    turfs,
    progress,
    colorBy,
    visible,
    opacity,
    showLabels,
    enablePopup,
    buildTurfGeometries,
    createRenderer,
    createPopupTemplate,
    createLabelClass,
    onTurfClick,
    onTurfHover,
  ]);

  // ============================================================================
  // Update Visibility
  // ============================================================================

  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.visible = visible;
    }
  }, [visible]);

  // ============================================================================
  // Update Opacity
  // ============================================================================

  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.opacity = opacity;
    }
  }, [opacity]);

  // ============================================================================
  // Update Labels Dynamically
  // ============================================================================

  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.labelingInfo = showLabels ? [createLabelClass()] : [];
    }
  }, [showLabels, createLabelClass]);

  // ============================================================================
  // Handle Selection Highlighting
  // ============================================================================

  useEffect(() => {
    if (!view || !layerRef.current || !selectedTurfId) {
      // Clear highlight graphic
      if (highlightGraphicRef.current) {
        view?.graphics.remove(highlightGraphicRef.current);
        highlightGraphicRef.current = null;
      }
      highlightRef.current?.remove();
      highlightRef.current = null;
      return;
    }

    const highlightTurf = async () => {
      try {
        const layer = layerRef.current;
        if (!layer || !selectedTurfId) return;

        // Wait for layer view
        await view.whenLayerView(layer);

        // Query the selected feature
        const query = layer.createQuery();
        query.where = `turfId = '${selectedTurfId.replace(/'/g, "''")}'`;
        query.returnGeometry = true;

        const result = await layer.queryFeatures(query);

        if (result.features.length > 0) {
          // Remove old highlight graphic
          if (highlightGraphicRef.current) {
            view.graphics.remove(highlightGraphicRef.current);
          }

          // Create custom highlight graphic with MPIQ green
          const highlightGraphic = new Graphic({
            geometry: result.features[0].geometry,
            symbol: HIGHLIGHT_SYMBOL,
          });

          // Add highlight graphic to view
          view.graphics.add(highlightGraphic);
          highlightGraphicRef.current = highlightGraphic;

          // Zoom to feature
          await view.goTo(result.features[0].geometry, { duration: 500 });
        }
      } catch (err) {
        console.warn('[TurfBoundaryLayer] Error highlighting turf:', err);
      }
    };

    highlightTurf();
  }, [view, selectedTurfId]);

  // ============================================================================
  // Error Display
  // ============================================================================

  useEffect(() => {
    if (error) {
      console.error('[TurfBoundaryLayer] Error:', error);
    }
  }, [error]);

  // Non-visual component (layer is added to the map)
  return null;
}

// ============================================================================
// Legend Component
// ============================================================================

interface TurfBoundaryLegendProps {
  colorBy: 'status' | 'completion' | 'priority' | 'density';
  className?: string;
}

export function TurfBoundaryLegend({ colorBy, className = '' }: TurfBoundaryLegendProps) {
  if (colorBy === 'status') {
    return (
      <div className={className}>
        <div className="space-y-1.5">
          {Object.entries(STATUS_COLORS).map(([status, colors]) => {
            const [r, g, b, a] = colors.fill;
            const bgColor = `rgba(${r}, ${g}, ${b}, ${a})`;
            const [or, og, ob] = colors.outline;
            const borderColor = `rgb(${or}, ${og}, ${ob})`;

            return (
              <div key={status} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded border"
                  style={{
                    backgroundColor: bgColor,
                    borderColor: borderColor,
                    borderWidth: '1.5px',
                  }}
                />
                <span className="text-xs text-gray-700">{colors.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  } else if (colorBy === 'completion') {
    return (
      <div className={className}>
        <div className="flex items-center gap-1 text-xs">
          <span className="text-gray-600">0%</span>
          <div
            className="h-3 w-24"
            style={{
              background: 'linear-gradient(to right, #fecaca, #fcd34d, #a3e635, #22c55e)',
            }}
          />
          <span className="text-gray-600">100%</span>
        </div>
      </div>
    );
  } else if (colorBy === 'priority') {
    return (
      <div className={className}>
        <div className="flex items-center gap-1 text-xs">
          <span className="text-gray-600">Low</span>
          <div
            className="h-3 w-24"
            style={{
              background: 'linear-gradient(to right, #e5e7eb, #fde047, #fb923c, #ef4444)',
            }}
          />
          <span className="text-gray-600">High</span>
        </div>
      </div>
    );
  } else {
    // Density
    return (
      <div className={className}>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(239, 68, 68, 0.6)' }} />
            <span className="text-xs text-gray-700">Urban</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(251, 146, 60, 0.6)' }} />
            <span className="text-xs text-gray-700">Suburban</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(253, 224, 71, 0.6)' }} />
            <span className="text-xs text-gray-700">Rural</span>
          </div>
        </div>
      </div>
    );
  }
}

export default TurfBoundaryLayer;
