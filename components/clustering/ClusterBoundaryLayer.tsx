/**
 * Cluster Boundary Layer Component
 * 
 * Renders cluster boundaries and territory visualization on the ArcGIS map.
 * Integrates with existing map infrastructure to display campaign territories.
 */

import React, { useEffect, useRef, useState } from 'react';
import { ClusterResult } from '@/lib/clustering/types';

interface ClusterBoundaryLayerProps {
  clusters: ClusterResult[];
  selectedClusterId?: number | null;
  onClusterClick?: (clusterId: number) => void;
  onClusterHover?: (clusterId: number | null) => void;
  visible?: boolean;
  opacity?: number;
  mapView?: any; // ArcGIS MapView instance
}

// Color scheme for cluster boundaries
const CLUSTER_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#96C93F', // Green
  '#FFA07A', // Orange
  '#DDA0DD', // Plum
  '#F0E68C', // Khaki
  '#FFB347', // Peach
  '#87CEEB', // Sky Blue
  '#98FB98', // Pale Green
  '#F4A460', // Sandy Brown
  '#DA70D6', // Orchid
];

export function ClusterBoundaryLayer({
  clusters,
  selectedClusterId = null,
  onClusterClick,
  onClusterHover,
  visible = true,
  opacity = 0.6,
  mapView
}: ClusterBoundaryLayerProps) {
  const layerRef = useRef<any>(null);
  const graphicsRef = useRef<any[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize the graphics layer
  useEffect(() => {
    if (!mapView || isInitialized) return;

    const initializeLayer = async () => {
      try {
        // Dynamically import ArcGIS modules
        const [GraphicsLayer, Graphic, SimpleFillSymbol, SimpleLineSymbol] = await Promise.all([
          import('@arcgis/core/layers/GraphicsLayer').then(m => m.default),
          import('@arcgis/core/Graphic').then(m => m.default),
          import('@arcgis/core/symbols/SimpleFillSymbol').then(m => m.default),
          import('@arcgis/core/symbols/SimpleLineSymbol').then(m => m.default)
        ]);

        // Create graphics layer for cluster boundaries
        const graphicsLayer = new GraphicsLayer({
          id: 'cluster-boundaries',
          title: 'Territory Boundaries',
          listMode: 'hide' // Hide from layer list
        });

        // Add layer to map
        mapView.map.add(graphicsLayer);
        layerRef.current = graphicsLayer;
        
        console.log('[ClusterBoundaryLayer] Graphics layer initialized');
        setIsInitialized(true);

      } catch (error) {
        console.error('[ClusterBoundaryLayer] Failed to initialize:', error);
      }
    };

    initializeLayer();

    // Cleanup function
    return () => {
      if (layerRef.current && mapView?.map) {
        mapView.map.remove(layerRef.current);
        layerRef.current = null;
        graphicsRef.current = [];
        setIsInitialized(false);
      }
    };
  }, [mapView, isInitialized]);

  // Update cluster graphics when clusters change
  useEffect(() => {
    if (!isInitialized || !layerRef.current || !clusters.length) {
      return;
    }

    const updateClusterGraphics = async () => {
      try {
        // Clear existing graphics
        layerRef.current.removeAll();
        graphicsRef.current = [];

        // Import required ArcGIS modules
        const [Graphic, SimpleFillSymbol, SimpleLineSymbol, TextSymbol] = await Promise.all([
          import('@arcgis/core/Graphic').then(m => m.default),
          import('@arcgis/core/symbols/SimpleFillSymbol').then(m => m.default),
          import('@arcgis/core/symbols/SimpleLineSymbol').then(m => m.default),
          import('@arcgis/core/symbols/TextSymbol').then(m => m.default)
        ]);

        // Create graphics for each cluster
        const graphics = clusters.map((cluster, index) => {
          const color = CLUSTER_COLORS[index % CLUSTER_COLORS.length];
          const isSelected = selectedClusterId === cluster.clusterId;
          const isValid = cluster.isValid;

          // Create boundary polygon graphic
          const boundarySymbol = new SimpleFillSymbol({
            color: isValid ? 
              [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16), opacity * 0.3] : 
              [128, 128, 128, opacity * 0.2], // Gray for invalid clusters
            outline: new SimpleLineSymbol({
              color: isSelected ? [255, 255, 0, 1] : // Yellow for selected
                     isValid ? [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16), 0.8] :
                               [128, 128, 128, 0.6], // Gray for invalid
              width: isSelected ? 3 : isValid ? 2 : 1,
              style: isValid ? 'solid' : 'dash'
            })
          });

          const boundaryGraphic = new Graphic({
            geometry: {
              type: 'polygon',
              rings: cluster.boundary.coordinates
            },
            symbol: boundarySymbol,
            attributes: {
              clusterId: cluster.clusterId,
              clusterName: cluster.name,
              zipCodeCount: cluster.zipCodes.length,
              totalPopulation: cluster.totalPopulation,
              averageScore: cluster.averageScore,
              radiusMiles: cluster.radiusMiles,
              isValid: cluster.isValid,
              insights: cluster.keyInsights
            },
            popupTemplate: {
              title: '{clusterName}',
              content: [
                {
                  type: 'fields',
                  fieldInfos: [
                    { fieldName: 'zipCodeCount', label: 'Zip Codes' },
                    { fieldName: 'totalPopulation', label: 'Population', format: { digitSeparator: true } },
                    { fieldName: 'averageScore', label: 'Average Score', format: { places: 1 } },
                    { fieldName: 'radiusMiles', label: 'Radius (miles)', format: { places: 1 } },
                    { fieldName: 'insights', label: 'Key Insights' }
                  ]
                }
              ]
            }
          });

          // Create label graphic for cluster center
          const labelSymbol = new TextSymbol({
            color: isValid ? 'white' : 'gray',
            text: cluster.name,
            font: {
              size: 12,
              family: 'Arial',
              weight: 'bold'
            },
            haloColor: isValid ? color : 'lightgray',
            haloSize: 2
          });

          const labelGraphic = new Graphic({
            geometry: {
              type: 'point',
              longitude: cluster.centroid[0],
              latitude: cluster.centroid[1]
            },
            symbol: labelSymbol,
            attributes: {
              clusterId: cluster.clusterId,
              type: 'label'
            }
          });

          return [boundaryGraphic, labelGraphic];
        }).flat();

        // Add all graphics to layer
        layerRef.current.addMany(graphics);
        graphicsRef.current = graphics;

        console.log('[ClusterBoundaryLayer] Updated cluster graphics:', graphics.length);

      } catch (error) {
        console.error('[ClusterBoundaryLayer] Failed to update graphics:', error);
      }
    };

    updateClusterGraphics();
  }, [clusters, selectedClusterId, opacity, isInitialized]);

  // Handle click events
  useEffect(() => {
    if (!mapView || !onClusterClick) return;

    const handleClick = (event: any) => {
      mapView.hitTest(event).then((response: any) => {
        const graphic = response.results.find((result: any) => 
          result.graphic?.attributes?.clusterId !== undefined &&
          result.graphic?.attributes?.type !== 'label'
        );

        if (graphic) {
          onClusterClick(graphic.graphic.attributes.clusterId);
          event.stopPropagation();
        }
      });
    };

    mapView.on('click', handleClick);

    return () => {
      if (mapView?.on) {
        mapView.off('click', handleClick);
      }
    };
  }, [mapView, onClusterClick]);

  // Handle hover events
  useEffect(() => {
    if (!mapView || !onClusterHover) return;

    let currentHoveredId: number | null = null;

    const handlePointerMove = (event: any) => {
      mapView.hitTest(event).then((response: any) => {
        const graphic = response.results.find((result: any) => 
          result.graphic?.attributes?.clusterId !== undefined &&
          result.graphic?.attributes?.type !== 'label'
        );

        const hoveredId = graphic ? graphic.graphic.attributes.clusterId : null;

        if (hoveredId !== currentHoveredId) {
          currentHoveredId = hoveredId;
          onClusterHover(hoveredId);
          
          // Update cursor
          if (hoveredId !== null) {
            mapView.container.style.cursor = 'pointer';
          } else {
            mapView.container.style.cursor = 'default';
          }
        }
      });
    };

    mapView.on('pointer-move', handlePointerMove);

    return () => {
      if (mapView?.on) {
        mapView.off('pointer-move', handlePointerMove);
      }
      if (mapView?.container) {
        mapView.container.style.cursor = 'default';
      }
    };
  }, [mapView, onClusterHover]);

  // Handle visibility changes
  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.visible = visible;
    }
  }, [visible]);

  // Component doesn't render anything directly - it adds to the map
  return null;
}

/**
 * Hook to manage cluster boundary layer
 */
export function useClusterBoundaryLayer(
  mapView: any,
  clusters: ClusterResult[],
  options: {
    selectedClusterId?: number | null;
    onClusterClick?: (clusterId: number) => void;
    onClusterHover?: (clusterId: number | null) => void;
    visible?: boolean;
    opacity?: number;
  } = {}
) {
  const [layerComponent, setLayerComponent] = useState<React.ReactElement | null>(null);

  useEffect(() => {
    if (!mapView) {
      setLayerComponent(null);
      return;
    }

    const component = (
      <ClusterBoundaryLayer
        clusters={clusters}
        mapView={mapView}
        {...options}
      />
    );

    setLayerComponent(component);

    return () => {
      setLayerComponent(null);
    };
  }, [mapView, clusters, options.selectedClusterId, options.visible, options.opacity]);

  return layerComponent;
}

/**
 * Utility function to fit map view to clusters
 */
export async function fitMapToClusters(
  mapView: any,
  clusters: ClusterResult[],
  padding?: { top?: number; bottom?: number; left?: number; right?: number }
) {
  if (!mapView || !clusters.length) return;

  try {
    // Calculate extent that includes all cluster boundaries
    let minLon = Infinity;
    let maxLon = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    clusters.forEach(cluster => {
      cluster.boundary.coordinates[0].forEach(([lon, lat]) => {
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      });
    });

    // Create extent geometry
    const extent = {
      xmin: minLon,
      ymin: minLat,
      xmax: maxLon,
      ymax: maxLat,
      spatialReference: mapView.spatialReference
    };

    // Zoom to extent with animation
    await mapView.goTo(extent, {
      animate: true,
      duration: 1000,
      padding: padding || { top: 50, bottom: 50, left: 50, right: 50 }
    });

    console.log('[ClusterBoundaryLayer] Fitted map to clusters');

  } catch (error) {
    console.error('[ClusterBoundaryLayer] Failed to fit map to clusters:', error);
  }
}