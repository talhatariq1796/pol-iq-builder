/* eslint-disable @typescript-eslint/no-unused-vars */
// UnifiedAreaSelector.tsx
// Combines all area selection methods into a single unified interface
// Uses existing components: DrawingTools, useDrawing hook, and LocationSearch

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  MapPin, 
  Pencil, 
  Search,
  Car,
  FootprintsIcon as Walk,
  CircleIcon,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';

// Import existing components
import DrawingTools from '@/components/tabs/DrawingTools';
import { LocationSearch, LocationResult } from '@/components/location-search';
import { useDrawing } from '@/hooks/useDrawing';

// Import ArcGIS modules for service area generation
import Circle from "@arcgis/core/geometry/Circle";
import Graphic from "@arcgis/core/Graphic";
import * as serviceArea from "@arcgis/core/rest/serviceArea";
import ServiceAreaParameters from "@arcgis/core/rest/support/ServiceAreaParameters";
import FeatureSet from "@arcgis/core/rest/support/FeatureSet";
import Point from "@arcgis/core/geometry/Point";

export interface AreaSelection {
  geometry: __esri.Geometry;
  method: 'draw' | 'search' | 'service-area' | 'project-area';
  displayName: string;
  metadata: {
    area?: number;
    centroid?: __esri.Point;
    source: string;
    bufferType?: 'radius' | 'drivetime' | 'walktime';
    bufferValue?: number;
    bufferUnit?: string;
  };
}

interface UnifiedAreaSelectorProps {
  view: __esri.MapView;
  onAreaSelected: (area: AreaSelection) => void;
  onSelectionStarted?: () => void;
  onSelectionCanceled?: () => void;
  defaultMethod?: 'draw' | 'search' | 'buffer' | 'project';
  allowMultipleSelection?: boolean;
}

export default function UnifiedAreaSelector({
  view,
  onAreaSelected,
  onSelectionStarted,
  onSelectionCanceled,
  defaultMethod = 'draw',
  allowMultipleSelection = false
}: UnifiedAreaSelectorProps) {
  // State management
  const [selectionMethod, setSelectionMethod] = useState<'draw' | 'search' | 'buffer' | 'project'>('draw');
  const [drawMode, setDrawMode] = useState<'point' | 'polygon' | 'click' | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isSelectingProjectArea, setIsSelectingProjectArea] = useState(false);
  const [selectedAreas, setSelectedAreas] = useState<AreaSelection[]>([]);
  
  // Buffer-specific state
  const [bufferType, setBufferType] = useState<'radius' | 'drivetime' | 'walktime'>('radius');
  const [bufferValue, setBufferValue] = useState('1');
  const [bufferUnit, setBufferUnit] = useState<'kilometers' | 'minutes'>('kilometers');
  const [bufferCenter, setBufferCenter] = useState<__esri.Point | null>(null);
  
  // Error state
  const [error, setError] = useState<string | null>(null);

  // Use existing drawing hook
  const {
    startDrawing,
    cancelDrawing,
    completeSelection,
    hasSelectedFeatures,
    selectedFeatureCount
  } = useDrawing({
    view,
    onGeometryCreated: (geometry) => {
      console.log('[UnifiedAreaSelector] Geometry created:', geometry?.type);
      handleGeometryCreated(geometry, 'draw');
      setDrawMode(null); // Reset draw mode after successful creation
    },
    onDrawingStarted: () => {
      setIsSelecting(true);
      onSelectionStarted?.();
    },
    onDrawingCanceled: () => {
      console.log('[UnifiedAreaSelector] Drawing canceled');
      setIsSelecting(false);
      setDrawMode(null);
      onSelectionCanceled?.();
    }
  });

  // Handle geometry creation from any source
  const handleGeometryCreated = useCallback((geometry: __esri.Geometry, source: 'draw' | 'search' | 'service-area' | 'project-area', searchAddress?: string) => {
    // If it's a point from drawing, also set it as buffer center
    if (source === 'draw' && geometry.type === 'point') {
      setBufferCenter(geometry as __esri.Point);
    }

    const area: AreaSelection = {
      geometry,
      method: source,
      displayName: getDisplayName(geometry, source, searchAddress),
      metadata: {
        area: calculateArea(geometry),
        // For service-areas (buffers), use the exact buffer center point for geocoding
        // For other geometries, calculate centroid from the geometry itself
        centroid: source === 'service-area' && bufferCenter ? bufferCenter : getCentroid(geometry),
        source,
        bufferType: source === 'service-area' ? bufferType : undefined,
        bufferValue: source === 'service-area' ? parseFloat(bufferValue) : undefined,
        bufferUnit: source === 'service-area' ? bufferUnit : undefined
      }
    };

    if (allowMultipleSelection) {
      setSelectedAreas((prev: any) => [...prev, area]);
    } else {
      setSelectedAreas([area]);
    }

    onAreaSelected(area);
    setIsSelecting(false);
  }, [bufferType, bufferValue, bufferUnit, allowMultipleSelection, onAreaSelected]);

  // Handle drawing button click
  const handleDrawButtonClick = useCallback((mode: 'point' | 'polygon' | 'click') => {
    console.log('[UnifiedAreaSelector] Starting drawing mode:', mode);
    setError(null); // Clear any previous errors
    setDrawMode(mode);
    setIsSelecting(true);
    startDrawing(mode);
  }, [startDrawing]);

  // Handle map click for buffer center
  const handleMapClickForBuffer = useCallback((event: any) => {
    if (selectionMethod === 'buffer' && !bufferCenter && event.mapPoint) {
      setBufferCenter(event.mapPoint);
    }
  }, [selectionMethod, bufferCenter]);

  // Set up map click handler for buffer center selection
  useEffect(() => {
    if (view && selectionMethod === 'buffer' && !bufferCenter) {
      const handle = view.on('click', handleMapClickForBuffer);
      return () => handle.remove();
    }
  }, [view, selectionMethod, bufferCenter, handleMapClickForBuffer]);

  // Handle location search selection
  const handleLocationSelected = useCallback(async (location: LocationResult) => {
    try {
      setIsSelecting(true);
      
      // Always create a point, never a polygon (per requirements)
      let geometry = new Point({
        longitude: location.longitude,
        latitude: location.latitude,
        spatialReference: { wkid: 4326 }
      });
      
      // Project the point to the map's spatial reference for proper display and buffering
      if (view && geometry.spatialReference.wkid !== view.spatialReference.wkid) {
        const projection = await import('@arcgis/core/geometry/projection');
        await projection.load();
        geometry = projection.project(geometry, view.spatialReference) as Point;
      }
      
      // Set buffer center for point locations
      setBufferCenter(geometry as __esri.Point);
      
      // Add a graphic to show the point on the map (matching existing implementation)
      if (view) {
        const pointGraphic = new Graphic({
          geometry,
          symbol: {
            type: "simple-marker",
            color: [255, 0, 0],
            outline: {
              color: [255, 255, 255],
              width: 2
            },
            size: 12
          } as any,
          attributes: { isPoint: true } // Add isPoint attribute for consistency
        });
        view.graphics.add(pointGraphic);
      }

      // Zoom to location
      if (view) {
        await view.goTo({
          target: geometry,
          zoom: location.type === 'address' ? 16 : 
                location.type === 'city' ? 12 : 
                location.type === 'region' ? 8 : 6
        });
      }

      handleGeometryCreated(geometry, 'search', location.address);
    } catch (err) {
      console.error('Error handling location selection:', err);
      setError('Failed to process location');
    } finally {
      setIsSelecting(false);
    }
  }, [view, handleGeometryCreated]);

  // Generate service area (drive time or walk time)
  const generateServiceArea = useCallback(async () => {
    if (!bufferCenter || !view) return;

    try {
      setIsSelecting(true);
      setError(null);

      if (bufferType === 'radius') {
        // Create simple radius buffer
        const radiusInMeters = bufferUnit === 'kilometers' 
          ? parseFloat(bufferValue) * 1000
          : parseFloat(bufferValue) * 1000; // Default to kilometers

        const circle = new Circle({
          center: bufferCenter,
          radius: radiusInMeters,
          radiusUnit: "meters",
          spatialReference: view.spatialReference
        });

        handleGeometryCreated(circle, 'service-area');
      } else {
        // Generate drive time or walk time service area
        const serviceAreaUrl = "https://route-api.arcgis.com/arcgis/rest/services/World/ServiceAreas/NAServer/ServiceArea_World/solveServiceArea";
        
        const featureSet = new FeatureSet({
          features: [new Graphic({ geometry: bufferCenter })]
        });

        const timeInMinutes = parseFloat(bufferValue);

        const params = new ServiceAreaParameters({
          facilities: featureSet,
          defaultBreaks: [timeInMinutes],
          travelDirection: "from-facility",
          outSpatialReference: view.spatialReference,
          trimOuterPolygon: true
        });

        const response = await serviceArea.solve(serviceAreaUrl, params);
        
        if (response.serviceAreaPolygons?.features && response.serviceAreaPolygons.features.length > 0) {
          const serviceAreaGeometry = response.serviceAreaPolygons.features[0].geometry;
          if (serviceAreaGeometry) {
            handleGeometryCreated(serviceAreaGeometry, 'service-area');
          } else {
            throw new Error('Service area geometry is null');
          }
        } else {
          throw new Error('No service area generated');
        }
      }
    } catch (err) {
      console.error('Error generating service area:', err);
      setError('Failed to generate service area. Please try a radius buffer instead.');
    } finally {
      setIsSelecting(false);
    }
  }, [bufferCenter, bufferType, bufferValue, bufferUnit, view, handleGeometryCreated]);

  // Handle project area selection
  const handleProjectAreaSelection = useCallback(async () => {
    try {
      setIsSelectingProjectArea(true);
      setError(null);
      
      // Create a geometry that represents the entire project area
      // For now, we'll create a large extent around the current view
      if (!view) {
        throw new Error('Map view is not available');
      }
      
      // Get the full extent of the view or use a default large area
      let projectExtent = view.extent;
      
      // If no extent is available, create a default large area (US extent as example)
      if (!projectExtent) {
        projectExtent = {
          xmin: -125,
          ymin: 24,
          xmax: -66,
          ymax: 49,
          spatialReference: { wkid: 4326 }
        } as __esri.Extent;
      }
      
      // Convert extent to polygon geometry
      const projectGeometry = {
        type: "polygon",
        rings: [[
          [projectExtent.xmin, projectExtent.ymin],
          [projectExtent.xmax, projectExtent.ymin], 
          [projectExtent.xmax, projectExtent.ymax],
          [projectExtent.xmin, projectExtent.ymax],
          [projectExtent.xmin, projectExtent.ymin]
        ]],
        spatialReference: projectExtent.spatialReference
      } as __esri.Polygon;
      
      handleGeometryCreated(projectGeometry, 'project-area');
      
    } catch (err) {
      console.error('Error selecting project area:', err);
      setError('Failed to select project area');
    } finally {
      setIsSelectingProjectArea(false);
    }
  }, [view, handleGeometryCreated]);

  // Helper functions
  const getDisplayName = (geometry: __esri.Geometry, source: string, searchAddress?: string): string => {
    if (source === 'search') return searchAddress || 'Search Area';
    if (source === 'project-area') return 'Entire Project Area';
    if (source === 'service-area') {
      if (bufferType === 'radius') return `${bufferValue} ${bufferUnit} radius`;
      if (bufferType === 'drivetime') return `${bufferValue} minute drive`;
      return `${bufferValue} minute walk`;
    }
    return geometry.type === 'point' ? 'Selected Point' : 'Drawn Area';
  };

  const calculateArea = (_geometry: __esri.Geometry): number | undefined => {
    // This would use geometryEngine to calculate actual area
    // Placeholder for now
    return undefined;
  };

  const getCentroid = (geometry: __esri.Geometry): __esri.Point | undefined => {
    try {
      // For point geometry, return the point itself
      if (geometry.type === 'point') {
        return geometry as __esri.Point;
      }

      // For polygon geometries, use the centroid property
      if (geometry.type === 'polygon') {
        const polygon = geometry as __esri.Polygon;
        // Polygon.centroid returns the centroid point directly
        return polygon.centroid || undefined;
      }

      // For polyline, use extent center as approximation
      if (geometry.type === 'polyline') {
        const polyline = geometry as __esri.Polyline;
        const extent = polyline.extent;
        if (extent) {
          return new Point({
            x: (extent.xmin + extent.xmax) / 2,
            y: (extent.ymin + extent.ymax) / 2,
            spatialReference: extent.spatialReference
          });
        }
      }

      // For extent, create point from center
      if (geometry.type === 'extent') {
        const extent = geometry as __esri.Extent;
        return new Point({
          x: (extent.xmin + extent.xmax) / 2,
          y: (extent.ymin + extent.ymax) / 2,
          spatialReference: extent.spatialReference
        });
      }

      return undefined;
    } catch (error) {
      console.warn('[UnifiedAreaSelector] Error calculating centroid:', error);
      return undefined;
    }
  };

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedAreas([]);
    cancelDrawing();
    setBufferCenter(null);
    setError(null);
    
    // Clear graphics from map view
    if (view?.graphics) {
      view.graphics.removeAll();
    }
  }, [cancelDrawing, view]);

  // Clear current drawing/selection only
  const clearCurrentDrawing = useCallback(() => {
    cancelDrawing();
    setDrawMode(null);
    setError(null);
    
    // Clear graphics from map view
    if (view?.graphics) {
      view.graphics.removeAll();
    }
  }, [cancelDrawing, view]);

  return (
    <Card className="w-full h-full flex flex-col">
      <CardHeader className="flex-shrink-0 py-2">
        <CardTitle className="flex items-center justify-between text-xs">
          <span>Select Area for Analysis</span>
          {selectedAreas.length > 0 && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={clearSelection}
              className="text-xs h-7"
            >
              Clear Selection
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col py-3 space-y-4">
        {/* Drawing Tools Section */}
        <div className="space-y-3">
          <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300">Draw on Map</h3>
          <DrawingTools
            drawMode={drawMode}
            handleDrawButtonClick={handleDrawButtonClick}
            isDrawing={isSelecting && drawMode !== null}
            isSelectionMode={drawMode === 'click'}
            onSelectionComplete={completeSelection}
            hasSelectedFeature={hasSelectedFeatures}
            selectedCount={selectedFeatureCount}
            shouldShowNext={drawMode === 'click' && hasSelectedFeatures && selectedFeatureCount > 0}
          />
          {(isSelecting && drawMode) && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearCurrentDrawing}
              className="w-full text-xs h-7"
            >
              Clear Drawing
            </Button>
          )}
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t dark:border-gray-700" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">or</span>
          </div>
        </div>

        {/* Search Section */}
        <div className="space-y-3">
          <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300">Search Location</h3>
          <LocationSearch
            onLocationSelected={handleLocationSelected}
            placeholder="Enter address, city, or place..."
            className="w-full"
          />
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t dark:border-gray-700" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">or</span>
          </div>
        </div>

        {/* Select Entire Area Section */}
        <div className="space-y-3">
          <div className="theme-bg-secondary p-4 rounded-lg border theme-border">
            <h3 className="text-xs font-medium theme-text-primary mb-3">Analyze Entire Project Area</h3>
            <Button
              onClick={handleProjectAreaSelection}
              className="w-full text-xs h-9 hover:shadow-sm hover:shadow-green-400/30 transition-all duration-200"
              disabled={isSelectingProjectArea}
            >
              {isSelectingProjectArea && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Select Entire Project Area
              <ChevronRight className="ml-2 h-3 w-3" />
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-3 w-3" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {selectedAreas.length > 0 && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-xs font-medium">
              {allowMultipleSelection 
                ? `${selectedAreas.length} areas selected`
                : `Area selected: ${selectedAreas[0].displayName}`}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}