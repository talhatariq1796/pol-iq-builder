import React, { useEffect, useRef, useState, useCallback } from 'react';

import Map from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import Basemap from '@arcgis/core/Basemap';
import Extent from '@arcgis/core/geometry/Extent';
import * as geometryEngine from '@arcgis/core/geometry/geometryEngine';

import RealEstatePointLayerManager, { RealEstateProperty } from './RealEstatePointLayerManager';
import FSABoundaryLayerManager, { FSAMetrics } from './FSABoundaryLayerManager';
import EnhancedLayerListWidget from './EnhancedLayerListWidget';
import PropertyFilterDialog from './dialogs/PropertyFilterDialog';
import PropertyStatsDialog from './dialogs/PropertyStatsDialog';
// ClusterManager removed - not used in political app
import type { RealEstateFilterConfig } from '../filtering/types';
import { DEFAULT_REAL_ESTATE_FILTER_CONFIG } from '../filtering/types';

interface RealEstateMapContainerProps {
  properties: RealEstateProperty[];
  height?: number;
  basemap?: string;
  center?: [number, number];
  zoom?: number;
  onPropertySelect?: (property: RealEstateProperty) => void;
  onAreaAnalysis?: (fsaCode: string, properties: RealEstateProperty[], metrics: FSAMetrics) => void;
  onMultiTargetAnalysis?: (data: any) => void;
  enableClustering?: boolean;
  showFSABoundaries?: boolean;
}

interface MapState {
  view: __esri.MapView | null;
  isLoading: boolean;
  error: string | null;
  selectedFSAs: string[];
  spatialAnalysisData: Record<string, any>;
  filterDialogOpen: boolean;
  statsDialogOpen: boolean;
  selectedLayerTitle: string;
  selectedLayerFilters: RealEstateFilterConfig;
  activeLayerFilters: Record<string, RealEstateFilterConfig>; // Track filters for each layer
}

const RealEstateMapContainer: React.FC<RealEstateMapContainerProps> = ({
  properties = [],
  height = 600,
  basemap = 'streets-navigation-vector',
  center = [-73.567256, 45.501689], // Montreal coordinates
  zoom = 10,
  onPropertySelect,
  onAreaAnalysis,
  onMultiTargetAnalysis,
  enableClustering = true,
  showFSABoundaries = true
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapState, setMapState] = useState<MapState>({
    view: null,
    isLoading: true,
    error: null,
    selectedFSAs: [],
    spatialAnalysisData: {},
    filterDialogOpen: false,
    statsDialogOpen: false,
    selectedLayerTitle: '',
    selectedLayerFilters: DEFAULT_REAL_ESTATE_FILTER_CONFIG,
    activeLayerFilters: {} // Initialize empty filter tracking
  });
  
  // RealEstatePointLayerManager will be used as a hook below
  const [propertiesWithCoords, setPropertiesWithCoords] = useState<RealEstateProperty[]>([]);

  // Process properties to add coordinates if missing
  const processProperties = useCallback(async (props: RealEstateProperty[]): Promise<RealEstateProperty[]> => {
    // Filter properties that already have coordinates
    const withCoords = props.filter(p => p.latitude && p.longitude);
    const withoutCoords = props.filter(p => !p.latitude || !p.longitude);

    console.log(`Properties: ${withCoords.length} with coordinates, ${withoutCoords.length} without`);

    // For properties without coordinates, you could:
    // 1. Use a geocoding service to get coordinates from address
    // 2. Use postal code to get approximate coordinates
    // 3. Skip them for now
    
    // For now, we'll just use properties with coordinates
    return withCoords;
  }, []);

  // Initialize map
  const initializeMap = useCallback(async () => {
    if (!mapRef.current) return;

    try {
      setMapState((prev: any) => ({ ...prev, isLoading: true, error: null }));

      // Create map
      const map = new Map({
        basemap: basemap as any
      });

      // Create map view
      const view = new MapView({
        container: mapRef.current,
        map: map,
        center: center,
        zoom: zoom,
        constraints: {
          minZoom: 6,
          maxZoom: 20
        },
        popup: {
          dockEnabled: true,
          dockOptions: {
            buttonEnabled: false,
            breakpoint: false,
            position: 'bottom-right'
          }
        }
      });

      // Wait for view to be ready
      await view.when();

      // If we have properties, zoom to their extent
      if (propertiesWithCoords.length > 0) {
        const coordinates = propertiesWithCoords
          .filter(p => p.latitude && p.longitude)
          .map(p => [p.longitude!, p.latitude!]);
        
        if (coordinates.length > 0) {
          const xCoords = coordinates.map(c => c[0]);
          const yCoords = coordinates.map(c => c[1]);
          
          const extent = new Extent({
            xmin: Math.min(...xCoords) - 0.01,
            ymin: Math.min(...yCoords) - 0.01,
            xmax: Math.max(...xCoords) + 0.01,
            ymax: Math.max(...yCoords) + 0.01,
            spatialReference: { wkid: 4326 }
          });
          
          try {
            await view.goTo(extent, { duration: 1000 });
          } catch (error) {
            console.warn('Could not zoom to properties extent:', error);
          }
        }
      }

      setMapState((prev: any) => ({
        ...prev,
        view,
        isLoading: false
      }));

    } catch (error) {
      console.error('Error initializing map:', error);
      setMapState((prev: any) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to initialize map',
        isLoading: false
      }));
    }
  }, [basemap, center, zoom, propertiesWithCoords]);

  // Handle property selection
  const handlePropertySelect = useCallback((property: RealEstateProperty) => {
    console.log('Property selected:', property);
    if (onPropertySelect) {
      onPropertySelect(property);
    }
  }, [onPropertySelect]);

  // Handle cluster selection
  const handleClusterSelect = useCallback((clusterId: string, clusterProperties: RealEstateProperty[]) => {
    console.log('Cluster selected:', clusterId, clusterProperties.length, 'properties');
    
    // You could open a dialog showing all properties in the cluster
    // or zoom to the cluster extent
    if (mapState.view && clusterProperties.length > 0) {
      const coordinates = clusterProperties
        .filter(p => p.latitude && p.longitude)
        .map(p => [p.longitude!, p.latitude!]);
      
      if (coordinates.length > 0) {
        const xCoords = coordinates.map(c => c[0]);
        const yCoords = coordinates.map(c => c[1]);
        
        const extent = new Extent({
          xmin: Math.min(...xCoords) - 0.001,
          ymin: Math.min(...yCoords) - 0.001,
          xmax: Math.max(...xCoords) + 0.001,
          ymax: Math.max(...yCoords) + 0.001,
          spatialReference: { wkid: 4326 }
        });
        
        mapState.view.goTo(extent, { duration: 500 });
      }
    }
  }, [mapState.view]);

  // Handle FSA area selection
  const handleAreaSelect = useCallback((fsaCode: string, boundaryGeometry: __esri.Polygon, properties: RealEstateProperty[]) => {
    console.log('FSA area selected:', fsaCode, properties.length, 'properties');
    
    setMapState((prev: any) => ({
      ...prev,
      selectedFSAs: [...prev.selectedFSAs, fsaCode],
      spatialAnalysisData: {
        ...prev.spatialAnalysisData,
        [fsaCode]: {
          properties,
          geometry: boundaryGeometry
        }
      }
    }));
  }, []);

  // Handle spatial analysis
  const handleSpatialAnalysis = useCallback((selectedProperties: RealEstateProperty[], aggregatedMetrics: FSAMetrics) => {
    console.log('Spatial analysis data:', {
      propertiesCount: selectedProperties.length,
      metrics: aggregatedMetrics
    });
    
    // You could display this data in a sidebar or modal
    if (onMultiTargetAnalysis) {
      onMultiTargetAnalysis({
        properties: selectedProperties,
        metrics: aggregatedMetrics,
        type: 'spatial-aggregation'
      });
    }
  }, [onMultiTargetAnalysis]);

  // Handle layer visibility changes
  const handleLayerVisibilityChange = useCallback((layerId: string, visible: boolean) => {
    console.log(`Layer ${layerId} visibility changed to:`, visible);
  }, []);

  // Handle property filter dialog close
  const handleFilterDialogClose = useCallback(() => {
    setMapState((prev: any) => ({ ...prev, filterDialogOpen: false }));
  }, []);

  // Handle property stats dialog close
  const handleStatsDialogClose = useCallback(() => {
    setMapState((prev: any) => ({ ...prev, statsDialogOpen: false }));
  }, []);

  // Helper function to check if filters are active
  const hasActiveFilters = useCallback((filters: RealEstateFilterConfig): boolean => {
    return Object.values(filters).some(filter => filter.enabled);
  }, []);

  // Handle filter application
  const handleApplyFilters = useCallback((filters: RealEstateFilterConfig) => {
    console.log('Applying filters to layer:', mapState.selectedLayerTitle, filters);
    
    // Store the filters in state for both current and layer-specific tracking
    setMapState((prev: any) => ({ 
      ...prev, 
      selectedLayerFilters: filters,
      filterDialogOpen: false,
      activeLayerFilters: {
        ...prev.activeLayerFilters,
        [mapState.selectedLayerTitle]: filters
      }
    }));
    
    // TODO: Implement filter application to layer manager
    // For now, filters are stored in state and can be used by other components
    console.log('Filters applied:', filters);
  }, [mapState.selectedLayerTitle]);

  // Create active filters mapping for layer list widget
  const getActiveFiltersForLayerList = useCallback((): Record<string, boolean> => {
    const activeFilters: Record<string, boolean> = {};
    
    // Check each layer's filters
    Object.entries(mapState.activeLayerFilters).forEach(([layerTitle, filters]) => {
      activeFilters[layerTitle] = hasActiveFilters(filters);
    });
    
    return activeFilters;
  }, [mapState.activeLayerFilters, hasActiveFilters]);

  // Get properties for the selected layer
  const getLayerProperties = useCallback((): RealEstateProperty[] => {
    if (!mapState.selectedLayerTitle) return [];
    
    if (mapState.selectedLayerTitle.includes('Active')) {
      return propertiesWithCoords.filter(p => p.st === 'AC');
    } else if (mapState.selectedLayerTitle.includes('Sold')) {
      return propertiesWithCoords.filter(p => p.st === 'SO');
    }
    
    return propertiesWithCoords;
  }, [mapState.selectedLayerTitle, propertiesWithCoords]);

  // ✅ ENABLED: FSABoundaryLayerManager hook for FSA boundary layer features
  // Note: This component was previously imported but never called, disabling all FSA features
  const fsaManagerRef = useRef<{
    fsaLayer: __esri.FeatureLayer | null;
    selectedFSAs: Set<string>;
    isLoading: boolean;
    spatialMetrics: Record<string, FSAMetrics>;
    clearSelection: () => void;
    getPropertiesInSelectedFSAs: () => Promise<RealEstateProperty[]>;
    generateAggregatedReport: () => Promise<any>;
  } | null>(null);

  // Wrapper component to use FSABoundaryLayerManager hook
  const FSABoundaryLayerManagerWrapper: React.FC<{
    mapView: __esri.MapView;
    onAreaSelect?: (fsaCode: string, boundaryGeometry: __esri.Polygon, properties: any[]) => void;
    onSpatialAnalysis?: (selectedProperties: RealEstateProperty[], aggregatedMetrics: any) => void;
    realEstateProperties?: RealEstateProperty[];
    visible?: boolean;
    onManagerReady?: (manager: any) => void;
  }> = ({ mapView, onAreaSelect, onSpatialAnalysis, realEstateProperties, visible, onManagerReady }) => {
    const manager = FSABoundaryLayerManager({
      mapView,
      onAreaSelect,
      onSpatialAnalysis,
      realEstateProperties,
      visible
    });

    useEffect(() => {
      if (onManagerReady) {
        onManagerReady(manager);
      }
    }, [manager, onManagerReady]);

    return null; // This component doesn't render anything, it just manages the layer
  };

  // Process properties on mount
  useEffect(() => {
    if (properties.length > 0) {
      processProperties(properties).then(setPropertiesWithCoords);
    } else {
      setPropertiesWithCoords([]);
    }
  }, [properties, processProperties]);

  // Initialize map when container is ready
  useEffect(() => {
    initializeMap();
    
    return () => {
      if (mapState.view) {
        mapState.view.destroy();
      }
    };
  }, [initializeMap]);

  // Setup custom event listeners for layer list actions
  useEffect(() => {
    const handleCustomEvent = (event: CustomEvent) => {
      const { type, detail } = event;

      switch (type) {
        case 'toggle-clustering':
          // Note: RealEstatePointLayerManager handles clustering internally based on enableClustering prop
          // To fully enable this feature, RealEstatePointLayerManager would need to expose a toggleClustering method via ref
          console.log('[RealEstateMapContainer] Toggle clustering requested');
          console.log('[RealEstateMapContainer] Current clustering state:', enableClustering);
          // For now, this would require parent component to toggle enableClustering prop
          break;

        case 'open-price-filter':
          // Open PropertyFilterDialog for the selected layer
          setMapState((prev: any) => ({
            ...prev,
            filterDialogOpen: true,
            selectedLayerTitle: detail.layerTitle || 'Property Layer',
            selectedLayerFilters: prev.activeLayerFilters[detail.layerTitle] || DEFAULT_REAL_ESTATE_FILTER_CONFIG
          }));
          break;

        case 'show-layer-stats':
          // Open PropertyStatsDialog for the selected layer
          setMapState((prev: any) => ({
            ...prev,
            statsDialogOpen: true,
            selectedLayerTitle: detail.layerTitle || 'Property Layer'
          }));
          break;

        case 'clear-fsa-selection':
          // ✅ ENABLED: Clear FSA selection using FSABoundaryLayerManager
          console.log('[RealEstateMapContainer] Clear FSA selection requested');
          if (fsaManagerRef.current) {
            fsaManagerRef.current.clearSelection();
            setMapState((prev: any) => ({ ...prev, selectedFSAs: [], spatialAnalysisData: {} }));
          } else {
            console.warn('[RealEstateMapContainer] FSA manager not ready yet');
          }
          break;

        case 'generate-area-report':
          // ✅ ENABLED: Generate area report using FSABoundaryLayerManager
          console.log('[RealEstateMapContainer] Generate area report requested');
          if (fsaManagerRef.current) {
            fsaManagerRef.current.generateAggregatedReport().then((report) => {
              console.log('[RealEstateMapContainer] Generated aggregated report:', report);
              // You could display this in a dialog or trigger onMultiTargetAnalysis
              if (onMultiTargetAnalysis && report) {
                onMultiTargetAnalysis({
                  type: 'fsa-aggregated-report',
                  report
                });
              }
            });
          } else {
            console.warn('[RealEstateMapContainer] FSA manager not ready yet');
          }
          break;

        default:
          console.log('Unhandled custom event:', type, detail);
      }
    };

    // Add event listeners
    const eventTypes = [
      'toggle-clustering',
      'open-price-filter',
      'show-layer-stats',
      'clear-fsa-selection',
      'generate-area-report'
    ];
    eventTypes.forEach(eventType => {
      window.addEventListener(eventType as any, handleCustomEvent);
    });

    return () => {
      eventTypes.forEach(eventType => {
        window.removeEventListener(eventType as any, handleCustomEvent);
      });
    };
  }, [onMultiTargetAnalysis]);

  // Render loading state
  if (mapState.isLoading) {
    return (
      <div 
        style={{ width: '100%', height: `${height}px` }}
        className="flex items-center justify-center bg-gray-50 border border-gray-200 rounded"
      >
        <div className="text-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (mapState.error) {
    return (
      <div 
        style={{ width: '100%', height: `${height}px` }}
        className="flex items-center justify-center bg-red-50 border border-red-200 rounded"
      >
        <div className="text-center p-4">
          <p className="text-red-600 font-medium">Failed to load map</p>
          <p className="text-red-500 text-sm mt-1">Error: {mapState.error}</p>
          <button 
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            onClick={() => initializeMap()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ height: `${height}px` }}>
      {/* Map container */}
      <div 
        ref={mapRef}
        className="absolute inset-0 w-full h-full border rounded"
        style={{ 
          width: '100%', 
          height: '100%',
          minHeight: `${height}px`,
          maxHeight: `${height}px`
        }}
      />
      
      {/* Map status overlay */}
      <div className="absolute top-2 left-2 bg-white bg-opacity-90 px-3 py-1 rounded text-sm z-10">
        {propertiesWithCoords.length > 0 ? (
          <span className="text-green-600">
            {propertiesWithCoords.length.toLocaleString()} properties loaded
          </span>
        ) : (
          <span className="text-amber-600">No properties to display</span>
        )}
      </div>

      {/* Selected FSAs indicator */}
      {mapState.selectedFSAs.length > 0 && (
        <div className="absolute top-2 right-80 bg-blue-600 text-white px-3 py-1 rounded text-sm z-10">
          {mapState.selectedFSAs.length} FSA{mapState.selectedFSAs.length !== 1 ? 's' : ''} selected
        </div>
      )}
      
      {/* Render child components when map view is ready */}
      {mapState.view && (
        <>
          {/* ✅ FIX Issue #1: Render RealEstatePointLayerManager as component (not as hook) */}
          {/* This component renders PropertyPopupManager for active & sold layers */}
          <RealEstatePointLayerManager
            mapView={mapState.view}
            properties={propertiesWithCoords}
            onPropertySelect={handlePropertySelect}
            onClusterSelect={handleClusterSelect}
            enableClustering={enableClustering}
          />

          {/* ✅ ENABLED: FSABoundaryLayerManager - renders FSA boundary layer on map */}
          <FSABoundaryLayerManagerWrapper
            mapView={mapState.view}
            onAreaSelect={handleAreaSelect}
            onSpatialAnalysis={handleSpatialAnalysis}
            realEstateProperties={propertiesWithCoords}
            visible={showFSABoundaries}
            onManagerReady={(manager) => {
              fsaManagerRef.current = manager;
            }}
          />

          {/* Enhanced Layer List Widget */}
          <EnhancedLayerListWidget
            mapView={mapState.view}
            position="top-right"
            onLayerVisibilityChange={handleLayerVisibilityChange}
            activeFilters={getActiveFiltersForLayerList()}
          />
        </>
      )}

      {/* Property Filter Dialog */}
      <PropertyFilterDialog
        isOpen={mapState.filterDialogOpen}
        onClose={handleFilterDialogClose}
        onApplyFilters={handleApplyFilters}
        layerTitle={mapState.selectedLayerTitle}
        initialFilters={mapState.selectedLayerFilters}
        propertyCount={getLayerProperties().length}
        totalProperties={getLayerProperties().length}
      />

      {/* Property Statistics Dialog */}
      <PropertyStatsDialog
        isOpen={mapState.statsDialogOpen}
        onClose={handleStatsDialogClose}
        layerTitle={mapState.selectedLayerTitle}
        properties={getLayerProperties()}
      />
    </div>
  );
};

export default RealEstateMapContainer;
export type { RealEstateMapContainerProps, RealEstateProperty };
