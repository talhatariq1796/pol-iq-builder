/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client'

import React, { useEffect, useState, useCallback, useMemo, memo } from 'react';
import dynamic from 'next/dynamic';
import '@/components/widget-styles.css';
import '@/components/popup-styles.css';
import esriConfig from "@arcgis/core/config";
import * as intl from "@arcgis/core/intl";
import MapClient from '@/components/map/MapClient';
import MapContainer from '@/components/MapContainer';
import CustomPopupManager from './popup/CustomPopupManager';
import PropertyPopupManager from './popup/PropertyPopupManager';
import CustomZoom from './CustomZoom';
import { LegendItem } from '@/components/MapLegend';
import { LegendType } from '@/types/legend';
import { SampleHotspot } from '@/components/map/SampleHotspots';
import { LoadingModal } from '@/components/LoadingModal';
import { PropertyDataService } from '@/components/cma/services/PropertyDataService';
import type { Property, AreaSelection, PropertyParams } from '@/components/cma/types';
import { CMABufferSelectionDialog } from '@/components/cma/CMABufferSelectionDialog';

console.log('[MAP_APP] MapApp component function body executing');

// Configure ArcGIS assets path and locale
esriConfig.assetsPath = "/assets";
// Set locale to ensure t9n files load properly
intl.setLocale("en");

// Dynamic imports
const ResizableSidebar = dynamic(() => import('@/components/ResizableSidebar'), { 
  ssr: false 
});

const DynamicGeospatialChat = dynamic(() => import('@/components/geospatial-chat-interface').then(mod => ({ default: mod.EnhancedGeospatialChat })), { 
  ssr: false 
});

const DynamicMapWidgets = dynamic(() => import('@/components/MapWidgets'), {
  ssr: false
});

const DynamicUnifiedAnalysis = dynamic(() => import('@/components/unified-analysis/UnifiedAnalysisWorkflow'), {
  ssr: false
});

const DynamicCMAInterface = dynamic(() => import('@/components/cma/CMAInterface'), {
  ssr: false
});

const DynamicUnifiedAreaSelector = dynamic(() => import('@/components/unified-analysis/UnifiedAreaSelector'), {
  ssr: false
});

const DynamicNavigationButtons = dynamic(() => import('@/components/navigation').then(mod => ({ default: mod.NavigationButtons })), {
  ssr: false
});

// Define widget buttons and visible widgets

const VISIBLE_WIDGETS = ['bookmarks', 'layerList', 'print', 'basemapGallery']; // search hidden

interface MapLegendState {
  title: string;
  type: LegendType;
  items?: LegendItem[];
  visible: boolean;
  ternaryData?: Array<{
    values: [number, number, number];
    label?: string;
    color?: string;
  }>;
  labels?: [string, string, string];
  components?: Array<{
    title: string;
    type: 'size' | 'color';
    items: LegendItem[];
  }>;
}


export const MapApp: React.FC = memo(() => {
  const [mapView, setMapView] = useState<__esri.MapView | null>(null);
  const [mounted, setMounted] = useState(false);
  const [activeWidget, setActiveWidget] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState<__esri.FeatureLayer | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(640);
  const [showLabels, setShowLabels] = useState(false);
  const [featureLayers, setFeatureLayers] = useState<__esri.FeatureLayer[]>([]);
  const [mapLegend, setMapLegend] = useState<MapLegendState>({
    title: '',
    type: 'simple',
    items: [],
    visible: false
  });
  const [layerStates, setLayerStates] = useState<{[key: string]: any}>({});
  const [formattedLegendData, setFormattedLegendData] = useState<any>(null);
  const [visualizationResult, setVisualizationResult] = useState<any>(null);
  const [selectedHotspot, setSelectedHotspot] = useState<SampleHotspot | null>(null);
  const [mapContainerReady, setMapContainerReady] = useState(false);
  const [showSampleAreasPanel, setShowSampleAreasPanel] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertiesLoaded, setPropertiesLoaded] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<__esri.Graphic | null>(null);
  
  // CMA Area Selection State
  const [selectedArea, setSelectedArea] = useState<AreaSelection | null>(null);
  const [areaSelectionMode, setAreaSelectionMode] = useState(false);
  
  // CMA Buffer Selection State
  const [showCMABufferDialog, setShowCMABufferDialog] = useState(false);
  const [pendingCMAProperty, setPendingCMAProperty] = useState<PropertyParams | null>(null);


  // Sync formattedLegendData with mapLegend state
  useEffect(() => {
    if (formattedLegendData) {
      console.log('[MapApp] Setting map legend from formattedLegendData:', {
        title: formattedLegendData.title,
        type: formattedLegendData.type,
        itemCount: formattedLegendData.items?.length || 0,
        componentCount: formattedLegendData.components?.length || 0,
        isDualVariable: formattedLegendData.type === 'dual-variable',
        sampleItems: formattedLegendData.items?.slice(0, 3)?.map((item: any) => ({
          label: item.label,
          color: item.color,
          size: item.size,
          shape: item.shape
        }))
      });
      
      setMapLegend({
        title: formattedLegendData.title || '',
        type: formattedLegendData.type || 'standard',
        items: formattedLegendData.items,
        visible: true,
        ternaryData: formattedLegendData.ternaryData,
        labels: formattedLegendData.labels,
        components: formattedLegendData.components
      });
    } else {
      setMapLegend({
        title: '',
        type: 'simple',
        items: [],
        visible: false
      });
    }
  }, [formattedLegendData]);

  // Load ArcGIS CSS dynamically to avoid webpack issues
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://js.arcgis.com/4.32/esri/themes/light/main.css';
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    
    // Cleanup layer protection on unmount
    return () => {
      if ((window as any).mapView) {
        import('../utils/layer-protection').then(({ deactivateLayerProtection }) => {
          deactivateLayerProtection((window as any).mapView);
        });
      }
    };
  }, []);

  // Load properties for CMA analysis
  useEffect(() => {
    const loadProperties = async () => {
      try {
        const propertyService = PropertyDataService.getInstance();
        const loadedProperties = await propertyService.loadProperties();
        setProperties(loadedProperties);
        setPropertiesLoaded(true);
        console.log(`[MapApp] Loaded ${loadedProperties.length} properties for CMA analysis`);
      } catch (error) {
        console.error('[MapApp] Error loading properties:', error);
        setPropertiesLoaded(true); // Still set to true to prevent infinite loading
      }
    };

    loadProperties();
  }, []);

  // Simple handlers
  const handleMapLoad = useCallback((view: __esri.MapView) => {
    setMapView(view);
    // Store global reference for theme switch debugging
    (window as any).mapView = view;
    
    // Activate layer protection system
    import('../utils/layer-protection').then(({ activateLayerProtection }) => {
      activateLayerProtection(view);
    });
  }, []);

  const handleMapError = useCallback((error: Error) => {
    console.error('[MapApp] Map error:', error);
    // Map error handled silently unless debugging
  }, []);

  const handleToggleWidget = useCallback((widgetName: string) => {
    if (widgetName === 'quickStats') {
      setShowSampleAreasPanel((prev: boolean) => !prev);
      setActiveWidget(null); // Close any other active widgets
    } else {
      setActiveWidget((prev: string | null) => prev === widgetName ? null : widgetName);
      setShowSampleAreasPanel(false); // Close Sample Areas Panel when other widgets open
    }
  }, []);

  const handleCloseWidget = useCallback(() => {
    setActiveWidget(null);
    setShowSampleAreasPanel(false);
  }, []);

  const handleLayerSelect = useCallback((layer: __esri.FeatureLayer) => {
    setSelectedLayer(layer);
  }, []);

  const handleLayerStatesChange = useCallback((states: { [key: string]: any }) => {
    setLayerStates(states);
  }, []);

  // NEW: Handle LayerController layers for CustomPopupManager
  const handleLayersCreated = useCallback((layers: __esri.FeatureLayer[]) => {
    console.log('[MapApp] LayerController layers created for CustomPopupManager:', layers.length);
    setFeatureLayers((prevLayers: __esri.FeatureLayer[]) => {
      // Remove any existing LayerController layers and add new ones
      const nonLayerControllerLayers = prevLayers.filter(layer => 
        !layer.id.includes('layer-controller') && 
        !layers.some(newLayer => newLayer.id === layer.id)
      );
      return [...nonLayerControllerLayers, ...layers];
    });
  }, []);

  // NEW: Handle SampleAreasPanel layers for CustomPopupManager
  const handleSampleAreasLayersCreated = useCallback((layers: __esri.FeatureLayer[]) => {
    console.log('[MapApp] SampleAreasPanel layers created for CustomPopupManager:', layers.length);
    setFeatureLayers((prevLayers: __esri.FeatureLayer[]) => {
      // Remove any existing sample area layers and add new ones
      const nonSampleAreaLayers = prevLayers.filter(layer => 
        !layer.title?.includes('ZIP Codes') && 
        !layers.some(newLayer => newLayer.id === layer.id)
      );
      return [...nonSampleAreaLayers, ...layers];
    });
  }, []);

  // Memoize layer state update handler for AITab
  const handleLayerStateChange = useCallback((layerId: string, state: any) => {
    setLayerStates((prev: Record<string, any>) => ({ ...prev, [layerId]: state }));
  }, []);

  // Memoize visualization handlers
  const handleVisualizationCreated = useCallback(() => {
    if (mapView?.map) {
      const currentFeatureLayers = mapView.map.allLayers
        .filter(layer => layer.type === 'feature')
        .toArray() as __esri.FeatureLayer[];
      
      console.log('[MapApp] Updating featureLayers for CustomPopupManager:', {
        totalLayers: currentFeatureLayers.length,
        layerIds: currentFeatureLayers.map(l => l.id),
        layerTitles: currentFeatureLayers.map(l => l.title)
      });
      
      setFeatureLayers(currentFeatureLayers);
    }
  }, [mapView]);

  // Handle analysis start - close sample panel to show visualization
  const handleAnalysisStart = useCallback(() => {
    console.log('[MapApp] Analysis starting - closing sample areas panel');
    setShowSampleAreasPanel(false);
  }, []);

  // Handle visualization layer creation for CustomPopupManager integration
  const handleVisualizationLayerCreated = useCallback((layer: __esri.FeatureLayer | null, shouldReplace?: boolean) => {
    console.log('[MapApp] ★★★ handleVisualizationLayerCreated CALLED ★★★', {
      hasLayer: !!layer,
      layerId: layer?.id,
      layerTitle: layer?.title,
      shouldReplace
    });
    
    if (layer) {
      setFeatureLayers((prevLayers: __esri.FeatureLayer[]) => {
        // Remove any existing analysis layers if shouldReplace is true
        const filteredLayers = shouldReplace 
          ? prevLayers.filter(l => !l.title?.includes('AnalysisEngine') && !l.title?.includes('Analysis'))
          : prevLayers;
        
        // Add the new layer if it's not already in the list
        const layerExists = filteredLayers.some(l => l.id === layer.id);
        if (!layerExists) {
          console.log('[MapApp] Adding visualization layer to featureLayers for CustomPopupManager:', layer.id);
          return [...filteredLayers, layer];
        }
        
        return filteredLayers;
      });
    } else if (shouldReplace) {
      // Remove all analysis layers
      setFeatureLayers((prevLayers: __esri.FeatureLayer[]) => 
        prevLayers.filter(l => !l.title?.includes('AnalysisEngine') && !l.title?.includes('Analysis'))
      );
    }
  }, []);

  // Handle unified workflow completion
  const handleUnifiedAnalysisComplete = useCallback(async (_result: any) => {
    console.log('[MapApp] ★★★ handleUnifiedAnalysisComplete CALLED ★★★');
    console.log('[MapApp] Analysis complete - UnifiedAnalysisWorkflow handles visualization now');
    
    // No need to handle visualization here anymore since UnifiedAnalysisWorkflow does it
    // This callback is kept for any future needs like additional processing
  }, []);

  const handleCorrelationAnalysis = useCallback((layer: __esri.FeatureLayer, primaryField: string, comparisonField: string) => {
    // Handle correlation analysis
    console.log('Correlation analysis requested:', { layer, primaryField, comparisonField });
  }, []);

  // Handle sample hotspot clicks
  const handleSampleHotspotClick = useCallback((hotspot: SampleHotspot) => {
    console.log('[MapApp] Sample hotspot selected:', hotspot);
    setSelectedHotspot(hotspot);
  }, []);

  // Handle MapContainer ready state
  const handleMapContainerReady = useCallback(() => {
    setMapContainerReady(true);
  }, []);

  // CMA Area Selection Handlers
  const handleAreaSelected = useCallback((area: AreaSelection) => {
    console.log('[MapApp] Area selected for CMA:', area);
    setSelectedArea(area);
    setAreaSelectionMode(false);
  }, []);

  const handleAreaSelectionRequired = useCallback(() => {
    console.log('[MapApp] CMA requires area selection');
    setAreaSelectionMode(true);
    // Optionally close other panels to focus on area selection
    setShowSampleAreasPanel(false);
    setActiveWidget(null);
  }, []);

  // Handle property CMA requests from map popup - now receives PropertyParams
  const handlePropertyCMA = useCallback((propertyParams: PropertyParams) => {
    console.log('[MapApp] CMA requested for property (PropertyParams):', {
      centrisNo: propertyParams.centrisNo,
      address: propertyParams.address,
      price: propertyParams.price,
      coordinates: propertyParams.coordinates
    });
    // Store the pre-extracted PropertyParams - no more re-extraction needed downstream
    setPendingCMAProperty(propertyParams);
    setShowCMABufferDialog(true);
  }, []);

  const handleClearAreaSelection = useCallback(() => {
    console.log('[MapApp] Clearing area selection');
    setSelectedArea(null);
    setAreaSelectionMode(false);
  }, []);

  // Handle CMA buffer selection completion
  const handleCMABufferSelected = useCallback(async (bufferConfig: any) => {
    console.log('[MapApp] handleCMABufferSelected called');
    console.log('[MapApp] Buffer config:', bufferConfig);
    console.log('[MapApp] Pending property (PropertyParams):', {
      centrisNo: pendingCMAProperty?.centrisNo,
      address: pendingCMAProperty?.address,
      price: pendingCMAProperty?.price
    });
    console.log('[MapApp] MapView available:', !!mapView);

    // Early validation with user feedback
    if (!pendingCMAProperty) {
      console.error('[MapApp] No pending CMA property');
      alert('Error: No property selected for CMA analysis');
      return;
    }

    if (!mapView) {
      console.error('[MapApp] MapView not ready');
      alert('Error: Map not ready. Please wait and try again.');
      return;
    }

    if (!bufferConfig) {
      console.error('[MapApp] No buffer config provided');
      alert('Error: No buffer configuration provided');
      return;
    }

    // Get coordinates from PropertyParams or raw feature
    // Use Point type for better type inference with geodesicBuffer
    let propertyGeometry: __esri.Point | __esri.Polygon | null = null;

    if (pendingCMAProperty.coordinates) {
      // Use coordinates from PropertyParams to create point geometry
      const Point = (await import('@arcgis/core/geometry/Point')).default;
      propertyGeometry = new Point({
        latitude: pendingCMAProperty.coordinates.latitude,
        longitude: pendingCMAProperty.coordinates.longitude,
        spatialReference: { wkid: 4326 }
      });
    } else if (pendingCMAProperty._rawFeature?.geometry) {
      // Fallback to raw feature geometry - cast to expected type
      propertyGeometry = pendingCMAProperty._rawFeature.geometry as __esri.Point | __esri.Polygon;
    }

    if (!propertyGeometry) {
      console.error('[MapApp] Property has no geometry or coordinates');
      alert('Error: Property location not available');
      return;
    }

    try {
      // Validate inputs first
      if (!propertyGeometry) {
        throw new Error('No property geometry provided for buffer creation');
      }

      if (!bufferConfig || !bufferConfig.value) {
        throw new Error('Invalid buffer configuration');
      }

      // Import required ArcGIS modules for buffer creation
      const [geometryEngine, Circle, Graphic, serviceArea, ServiceAreaParameters, FeatureSet] = await Promise.all([
        import('@arcgis/core/geometry/geometryEngine'),
        import('@arcgis/core/geometry/Circle'),
        import('@arcgis/core/Graphic'),
        import('@arcgis/core/rest/serviceArea'),
        import('@arcgis/core/rest/support/ServiceAreaParameters'),
        import('@arcgis/core/rest/support/FeatureSet')
      ]);

      // Create buffer geometry using the same logic as UnifiedAnalysisWorkflow
      let bufferedGeometry: __esri.Geometry | null = null;
      const distance = bufferConfig.value || bufferConfig.distance || 0.5;  // Use value from CMABufferSelectionDialog
      const unit = bufferConfig.unit || 'kilometers';

      console.log('[MapApp] Creating buffer with:', { distance, unit, type: bufferConfig.type, geometryType: propertyGeometry.type });

      // Handle drive-time and walk-time buffers using ArcGIS Service Area API
      if ((bufferConfig.type === 'drivetime' || bufferConfig.type === 'walktime') && propertyGeometry.type === 'point') {
        console.log('[MapApp] Creating service area for', bufferConfig.type, 'with', distance, 'minutes');

        const serviceAreaUrl = "https://route-api.arcgis.com/arcgis/rest/services/World/ServiceAreas/NAServer/ServiceArea_World/solveServiceArea";

        const featureSet = new FeatureSet.default({
          features: [new Graphic.default({ geometry: propertyGeometry })]
        });

        const params = new ServiceAreaParameters.default({
          facilities: featureSet,
          defaultBreaks: [distance], // time in minutes
          travelDirection: "from-facility",
          outSpatialReference: mapView.spatialReference,
          trimOuterPolygon: true,
          // For walk time, use walking mode
          travelMode: bufferConfig.type === 'walktime' ? {
            name: "Walking",
            type: "WALK",
            impedanceAttributeName: "WalkTime",
            timeAttributeName: "WalkTime",
            distanceAttributeName: "Miles"
          } as any : undefined
        });

        try {
          const response = await serviceArea.solve(serviceAreaUrl, params);

          if (response.serviceAreaPolygons?.features && response.serviceAreaPolygons.features.length > 0) {
            const serviceAreaGeometry = response.serviceAreaPolygons.features[0].geometry;
            if (serviceAreaGeometry) {
              bufferedGeometry = serviceAreaGeometry;
              console.log('[MapApp] Service area created successfully');
            } else {
              throw new Error('Service area geometry is null');
            }
          } else {
            throw new Error('No service area generated');
          }
        } catch (serviceAreaError) {
          console.warn('[MapApp] Service area API failed, falling back to circular approximation:', serviceAreaError);
          // Fallback to circular approximation
          const speedKmPerHour = bufferConfig.type === 'walktime' ? 5 : 50;
          const distanceInKm = (distance / 60) * speedKmPerHour;
          bufferedGeometry = new Circle.default({
            center: propertyGeometry as __esri.Point,
            radius: distanceInKm,
            radiusUnit: 'kilometers'
          });
        }
      } else if (bufferConfig.type === 'radius' && propertyGeometry.type === 'point') {
        // Create circular buffer for point geometry (radius type only uses km)
        let distanceInKm = distance;
        if (unit === 'miles') {
          distanceInKm = distance * 1.60934;
        }
        // unit is 'km' or 'kilometers' for radius type

        console.log('[MapApp] Creating Circle with radius:', distanceInKm, 'km');

        try {
          bufferedGeometry = new Circle.default({
            center: propertyGeometry as __esri.Point,
            radius: distanceInKm,
            radiusUnit: 'kilometers'
          });
        } catch (circleError) {
          console.error('[MapApp] Error creating Circle:', circleError);
          throw new Error(`Failed to create circular buffer: ${circleError instanceof Error ? circleError.message : String(circleError)}`);
        }
      } else {
        // Use geodesic buffer for polygon geometries or other cases
        let distanceInMeters = distance;
        if (unit === 'miles') {
          distanceInMeters = distance * 1609.34;
        } else if (unit === 'km' || unit === 'kilometers') {
          distanceInMeters = distance * 1000;
        }

        console.log('[MapApp] Creating geodesic buffer with distance:', distanceInMeters, 'meters');

        try {
          bufferedGeometry = geometryEngine.geodesicBuffer(
            propertyGeometry,
            distanceInMeters,
            'meters',
            false
          ) as __esri.Polygon;
        } catch (bufferError) {
          console.error('[MapApp] Error creating geodesic buffer:', bufferError);
          throw new Error(`Failed to create geodesic buffer: ${bufferError instanceof Error ? bufferError.message : String(bufferError)}`);
        }
      }

      if (!bufferedGeometry) {
        throw new Error('Buffer geometry is null after creation');
      }

      console.log('[MapApp] Buffer geometry created successfully:', {
        type: bufferedGeometry.type,
        hasExtent: !!bufferedGeometry.extent
      });

      console.log('[DEBUG CMA ZOOM] Buffer geometry created:', {
        type: bufferedGeometry.type,
        hasExtent: !!bufferedGeometry.extent,
        extent: bufferedGeometry.extent
      });

      // Additional debugging for the extent object
      if (bufferedGeometry.extent) {
        console.log('[DEBUG CMA ZOOM] Extent details:', {
          xmin: bufferedGeometry.extent.xmin,
          ymin: bufferedGeometry.extent.ymin,
          xmax: bufferedGeometry.extent.xmax,
          ymax: bufferedGeometry.extent.ymax,
          spatialReference: bufferedGeometry.extent.spatialReference
        });
      } else {
        console.error('[DEBUG CMA ZOOM] ❌ NO EXTENT FOUND on buffered geometry!');
      }

      // Add buffer visualization to map
      const bufferGraphic = new Graphic.default({
        geometry: bufferedGeometry,
        symbol: {
          type: 'simple-fill',
          color: [34, 197, 94, 0.2], // Green with transparency matching unified workflow
          outline: {
            color: [34, 197, 94],
            width: 2
          }
        } as unknown as __esri.SimpleFillSymbol,
        attributes: { isBuffer: true, source: 'popup-cma' }
      });

      // Clear existing popup CMA graphics and add new buffer
      try {
        console.log('[MapApp] Clearing existing graphics');
        mapView.graphics.removeAll();

        // Add point graphic for the property
        const pointGraphic = new Graphic.default({
          geometry: propertyGeometry,
          symbol: {
            type: 'simple-marker',
            color: [34, 197, 94], // Green to match buffer color
            outline: {
              color: [255, 255, 255],
              width: 2
            },
            size: 8
          } as unknown as __esri.SimpleMarkerSymbol,
          attributes: { isPoint: true, source: 'popup-cma' }
        });

        console.log('[MapApp] Adding point graphic');
        mapView.graphics.add(pointGraphic);

        console.log('[MapApp] Adding buffer graphic');
        mapView.graphics.add(bufferGraphic);

        console.log('[MapApp] Graphics added successfully');
      } catch (graphicsError) {
        console.error('[MapApp] Error managing graphics:', graphicsError);
        // Continue anyway - graphics are not critical
      }

      console.log('[DEBUG CMA ZOOM] Buffer visualization added to map');

      // Zoom and center to buffer area with proper error handling
      console.log('[DEBUG CMA ZOOM] ======= STARTING ZOOM OPERATION =======');
      console.log('[DEBUG CMA ZOOM] Checking if bufferedGeometry.extent exists...');
      
      if (bufferedGeometry.extent) {
        console.log('[DEBUG CMA ZOOM] ✅ Extent exists, proceeding with zoom');
        
        try {
          console.log('[DEBUG CMA ZOOM] MapView current extent before zoom:', {
            xmin: mapView.extent?.xmin,
            ymin: mapView.extent?.ymin,
            xmax: mapView.extent?.xmax,
            ymax: mapView.extent?.ymax
          });
          
          // Calculate proper expansion factor based on buffer size
          const bufferExtent = bufferedGeometry.extent;
          const extentWidth = bufferExtent.xmax - bufferExtent.xmin;
          const extentHeight = bufferExtent.ymax - bufferExtent.ymin;
          
          // Use larger expansion for small buffers, smaller for large buffers
          const expansionFactor = Math.max(1.5, Math.min(3.0, 1000 / Math.max(extentWidth, extentHeight)));
          
          console.log('[DEBUG CMA ZOOM] Buffer dimensions:', {
            width: extentWidth,
            height: extentHeight,
            expansionFactor: expansionFactor
          });
          
          const expandedExtent = bufferExtent.expand(expansionFactor);
          console.log('[DEBUG CMA ZOOM] Expanded extent:', {
            xmin: expandedExtent.xmin,
            ymin: expandedExtent.ymin,
            xmax: expandedExtent.xmax,
            ymax: expandedExtent.ymax,
            spatialReference: expandedExtent.spatialReference
          });
          
          // Use animation for smoother zoom experience
          console.log('[DEBUG CMA ZOOM] Calling mapView.goTo() with animation...');
          const goToOptions = {
            target: expandedExtent,
            duration: 1500, // 1.5 second animation
            easing: 'ease-in-out'
          };
          
          const result = await mapView.goTo(goToOptions);
          console.log('[DEBUG CMA ZOOM] ✅ goTo completed successfully:', result);
          
          // Wait a bit for the view to settle before logging final extent
          setTimeout(() => {
            console.log('[DEBUG CMA ZOOM] MapView extent after zoom (settled):', {
              xmin: mapView.extent?.xmin,
              ymin: mapView.extent?.ymin,
              xmax: mapView.extent?.xmax,
              ymax: mapView.extent?.ymax
            });
          }, 2000);
          
        } catch (zoomError) {
          console.error('[DEBUG CMA ZOOM] ❌ Error during zoom operation:', zoomError);
          console.error('[DEBUG CMA ZOOM] Error details:', {
            name: zoomError instanceof Error ? zoomError.name : 'Unknown',
            message: zoomError instanceof Error ? zoomError.message : String(zoomError),
            stack: zoomError instanceof Error ? zoomError.stack : undefined
          });
          
          // Fallback: try simpler zoom to center point
          try {
            const center = bufferedGeometry.extent.center;
            console.log('[DEBUG CMA ZOOM] Fallback: zooming to center point:', center);
            await mapView.goTo({
              center: center,
              zoom: mapView.zoom + 2,
              duration: 1000
            });
            console.log('[DEBUG CMA ZOOM] ✅ Fallback zoom successful');
          } catch (fallbackError) {
            console.error('[DEBUG CMA ZOOM] ❌ Fallback zoom also failed:', fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
          }
        }
      } else {
        console.error('[DEBUG CMA ZOOM] ❌ No extent available for zoom operation');
        
        // Try using buffered geometry directly if extent is missing
        try {
          console.log('[DEBUG CMA ZOOM] Fallback: using buffered geometry directly');
          await mapView.goTo({
            target: bufferedGeometry,
            duration: 1500
          });
          console.log('[DEBUG CMA ZOOM] ✅ Direct geometry zoom successful');
        } catch (directZoomError) {
          console.error('[DEBUG CMA ZOOM] ❌ Direct geometry zoom failed:', directZoomError instanceof Error ? directZoomError.message : String(directZoomError));
        }
      }
      
      console.log('[DEBUG CMA ZOOM] ======= ZOOM OPERATION COMPLETE =======');

      // Create area selection with buffered geometry (not original point)
      console.log('[MapApp] Creating area selection object');

      const areaSelection: AreaSelection = {
        geometry: bufferedGeometry, // Use buffered geometry, not original point
        method: 'service-area', // Changed to match buffer creation
        displayName: `CMA around ${pendingCMAProperty.address || 'Selected Property'} (${distance} ${unit} buffer)`
      };

      // Store buffer config and source for CMA analysis
      (areaSelection as any).bufferConfig = bufferConfig;
      (areaSelection as any).source = 'popup-cma';

      console.log('[MapApp] Area selection created:', {
        hasGeometry: !!areaSelection.geometry,
        geometryType: areaSelection.geometry?.type,
        method: areaSelection.method,
        displayName: areaSelection.displayName
      });

      try {
        console.log('[MapApp] Setting selected area state');
        setSelectedArea(areaSelection);
        console.log('[MapApp] ✅ Selected area state set successfully');
      } catch (stateError) {
        console.error('[MapApp] ❌ Error setting selected area state:', stateError);
        throw new Error(`Failed to set selected area: ${stateError instanceof Error ? stateError.message : String(stateError)}`);
      }

      // Close buffer dialog
      console.log('[MapApp] Closing buffer dialog');
      setShowCMABufferDialog(false);

      console.log('[MapApp] ✅ Buffer application complete - CMA workflow ready');

    } catch (error) {
      console.error('[MapApp] ❌ Error creating buffer:', error);
      console.error('[MapApp] Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        bufferConfig,
        propertyAddress: pendingCMAProperty.address
      });

      // Show user-friendly error message
      alert(`Failed to create buffer zone: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again with different buffer settings.`);

      // Close dialog and reset state to allow retry
      setShowCMABufferDialog(false);
      setPendingCMAProperty(null);

      // Don't set selectedArea to allow user to retry
      return;
    }
  }, [pendingCMAProperty, mapView, setSelectedArea, setShowCMABufferDialog, setPendingCMAProperty]);
  
  const handleCMABufferDialogClose = useCallback(() => {
    setShowCMABufferDialog(false);
    // Don't clear pendingCMAProperty yet - it's needed for filter initialization
    // It will be cleared when CMA workflow completes or user cancels
  }, []);

  // Memoize static configurations
  const memoizedVisibleWidgets = useMemo(() => VISIBLE_WIDGETS, []);

  console.log('[MapApp] Render state:', { mounted, mapView: !!mapView, activeWidget });

  if (!mounted) {
    return <LoadingModal progress={0} show={true} />;
  }

  return (
    <>
      {/* Show LoadingModal until MapContainer takes over */}
      {(!mapView || !mapContainerReady) && <LoadingModal progress={0} show={true} />}
      
      <div className="fixed inset-0 flex">
        {/* Left Toolbar */}
        <div className="w-16 flex flex-col z-[9999]" style={{
          backgroundColor: 'var(--theme-bg-secondary)',
          borderRight: '1px solid var(--theme-border)'
        }}>
          {/* Navigation Buttons */}
          <div className="py-3 flex flex-col items-center border-b" style={{ borderColor: 'var(--theme-border)' }}>
            <DynamicNavigationButtons />
          </div>

          {/* Widget Icons */}
          {mapView && (
            <DynamicMapWidgets
              view={mapView}
              activeWidget={activeWidget}
              onClose={handleCloseWidget}
              onLayerSelect={handleLayerSelect}
              onToggleWidget={handleToggleWidget}
              onCorrelationAnalysis={handleCorrelationAnalysis}
              visibleWidgets={memoizedVisibleWidgets}
              onLayerStatesChange={handleLayerStatesChange}
              onLayersCreated={handleLayersCreated}
              showQuickStatsPanel={showSampleAreasPanel}
            />
          )}
        </div>

        {/* Main Map Container */}
        <div 
          className="flex-1 relative" 
          style={{
            marginRight: `${Math.max(0, (sidebarWidth - 64) / 2)}px`,
            transition: 'margin-right 0.2s ease'
          }}
        >
          <MapClient
            key="main-map-client"
            onMapLoad={handleMapLoad}
            onError={handleMapError}
            sidebarWidth={sidebarWidth}
            showLabels={showLabels}
            legend={mapLegend}
            onSampleHotspotClick={handleSampleHotspotClick}
            showSampleHotspots={false}
          />
          

          {/* Sample Areas Panel */}
          {/* {mapView && (
            <SampleAreasPanel
              view={mapView}
              onClose={() => setShowSampleAreasPanel(false)}
              visible={showSampleAreasPanel}
            />
          )} */}
          
          {/* Layer Controller and Management - now includes composite index layers */}
          {mapView && (
            <MapContainer
              view={mapView}
              analysisConfig={{ layers: {} }}
              onReady={handleMapContainerReady}
            />
          )}
          
          {/* Custom popup handler for each feature layer */}
          {mapView && mapView.map && featureLayers.map(layer => {
            console.log('[MapApp] Creating popup manager for layer:', {
              layerId: layer.id,
              layerTitle: layer.title,
              layerType: layer.type,
              popupEnabled: layer.popupEnabled
            });
            
            // Use PropertyPopupManager for property layers
            const isPropertyLayer = layer.id === 'active_properties_layer' ||
                                   layer.id === 'sold_properties_layer' ||
                                   layer.id?.includes('_properties') ||  // Matches: active_house_properties, sold_condo_properties, etc.
                                   layer.title?.includes('Properties') ||
                                   layer.title?.includes('Houses') ||
                                   layer.title?.includes('Condos') ||
                                   layer.title?.includes('Revenue');
            
            if (isPropertyLayer) {
              console.log('[MapApp] Using PropertyPopupManager for property layer:', layer.id);
              return (
                <PropertyPopupManager
                  key={layer.id}
                  mapView={mapView}
                  layer={layer}
                  onPropertyCMA={handlePropertyCMA}
                />
              );
            } else {
              return (
                <CustomPopupManager
                  key={layer.id}
                  mapView={mapView}
                  layer={layer}
                  onPropertyCMA={handlePropertyCMA}
                />
              );
            }
          })}
          
          {/* Custom zoom controls */}
          {mapView && (
            <CustomZoom
              view={mapView}
              sidebarWidth={sidebarWidth}
            />
          )}
        </div>

        {/* Right Sidebar */}
        <ResizableSidebar
          key="main-sidebar"
          view={mapView}
          layerStates={layerStates}
          defaultWidth={sidebarWidth}
          minWidth={300}
          maxWidth={800}
          onWidthChange={setSidebarWidth}
          onLayerStatesChange={setLayerStates}
          chatInterface={
            mapView ? (
              <DynamicUnifiedAnalysis
                key="main-unified-analysis"
                view={mapView}
                setFormattedLegendData={setFormattedLegendData}
                enableChat={true}
                defaultAnalysisType="comprehensive"
                selectedHotspot={selectedHotspot}
                onHotspotProcessed={() => setSelectedHotspot(null)}
                onAnalysisStart={handleAnalysisStart}
                onAnalysisComplete={handleUnifiedAnalysisComplete}
                onVisualizationLayerCreated={handleVisualizationLayerCreated}
                // CMA popup integration props
                selectedArea={selectedArea}
                propertyParams={pendingCMAProperty || undefined}
                triggerCMAAnalysis={Boolean((selectedArea as any)?.source === 'popup-cma')}
              />
            ) : null
          }
        />

        {/* CMA Interface - Fixed position overlay - Only show for regular CMA, not popup CMA */}
        {propertiesLoaded && selectedArea && (selectedArea as any)?.source !== 'popup-cma' && (
          <DynamicCMAInterface
            selectedArea={selectedArea || undefined}
            propertyParams={undefined}
            onAreaSelectionRequired={handleAreaSelectionRequired}
            mapView={mapView || undefined}
          />
        )}

        {/* Area Selection Panel - Shows when CMA requires area selection */}
        {areaSelectionMode && mapView && (
          <div className="fixed top-6 right-6 z-[9999] w-80 h-96 shadow-xl">
            <DynamicUnifiedAreaSelector
              view={mapView}
              onAreaSelected={handleAreaSelected}
              onSelectionStarted={() => console.log('[MapApp] Area selection started')}
              onSelectionCanceled={() => setAreaSelectionMode(false)}
              defaultMethod="draw"
              allowMultipleSelection={false}
            />
          </div>
        )}
        
        {/* CMA Buffer Selection Dialog - Shows when property CMA is requested */}
        <CMABufferSelectionDialog
          isOpen={showCMABufferDialog}
          onClose={handleCMABufferDialogClose}
          onSelect={handleCMABufferSelected}
          propertyParams={pendingCMAProperty || undefined}
        />
      </div>
    </>
  );
});

MapApp.displayName = 'MapApp';

export default MapApp;