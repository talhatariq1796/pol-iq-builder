/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
// UnifiedAnalysisWorkflow.tsx
// Main orchestrator component that unifies the entire analysis workflow
// Combines area selection, analysis type selection, and results viewing

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { fetchReports } from '@/services/ReportsService';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { TooltipProvider } from '@/components/ui/tooltip';
import CMAInterface from '@/components/cma/CMAInterface';
import {
  ChevronRight,
  MapPin,
  FileText,
  BarChart3,
  BarChart,
  Download,
  MessageSquare,
  MessageCircle,
  Table,
  Loader2,
  CheckCircle,
  AlertCircle,
  Target,
  Calculator,
  Car,
  FootprintsIcon as Walk,
  RotateCcw,
  Sparkles,
  UserCog,
  Zap,
  Sliders,
  Home,
  TrendingUp
} from 'lucide-react';
import { PiStrategy, PiLightning, PiLightbulb, PiWrench, PiHeart } from 'react-icons/pi';

// Import unified components
import UnifiedAreaSelector from './UnifiedAreaSelector';
import { AreaSelection as UnifiedAreaSelection } from './UnifiedAreaSelector';
import { UnifiedAnalysisWrapper, UnifiedAnalysisRequest, UnifiedAnalysisResponse } from './UnifiedAnalysisWrapper';
// import UnifiedAnalysisChat from './UnifiedAnalysisChat'; // Replaced with ChatInterface
import UnifiedDataTable from './UnifiedDataTable';
import UnifiedInsightsChart from './UnifiedInsightsChart';

// Import existing components for analysis
import { QueryInterface } from '@/components/QueryInterface';
import { ChatInterface } from '@/components/ChatInterface'; // New chat component following QueryInterface pattern
import EndpointScoreInfographic from '@/components/EndpointScoreInfographic';

// Import infographics components
import ReportSelectionDialog from '@/components/ReportSelectionDialog';
import Infographics from '@/components/Infographics';
import { CMACard } from '@/components/cma/CMACard';
import { AreaSelection as CMAAreaSelection, PropertyParams } from '@/components/cma/types';

// Import dialog and predefined queries
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import QueryDialog from '@/components/chat/QueryDialog';
import { ANALYSIS_CATEGORIES } from '@/components/chat/chat-constants';
import { personaMetadata } from '@/app/api/claude/prompts';

// Clustering Components  
import { ClusterConfig, DEFAULT_CLUSTER_CONFIG } from '@/lib/clustering/types';

// Advanced Filtering System
import AdvancedFilterDialog from '@/components/filtering/AdvancedFilterDialog';
import { 
  AdvancedFilterConfig, 
  DEFAULT_REAL_ESTATE_FILTER_CONFIG,
  DEFAULT_FIELD_FILTER_CONFIG,
  DEFAULT_VISUALIZATION_CONFIG,
  DEFAULT_PERFORMANCE_CONFIG
} from '@/components/filtering/types';

// Import chat interface for contextual analysis
import { useChatContext } from '@/components/chat-context-provider';

// Import Phase 4 Integration - COMMENTED OUT FOR DEVELOPMENT PAUSE
// import Phase4IntegrationWrapper from '@/components/phase4/Phase4IntegrationWrapper';
// import { isPhase4FeatureEnabled } from '@/config/phase4-features';

// Import ArcGIS geometry engine for buffering
import * as geometryEngine from "@arcgis/core/geometry/geometryEngine";
import Circle from "@arcgis/core/geometry/Circle";
import Graphic from "@arcgis/core/Graphic";
import { SimpleFillSymbol, SimpleLineSymbol, SimpleMarkerSymbol } from '@arcgis/core/symbols';
import Polygon from '@arcgis/core/geometry/Polygon';
import * as serviceArea from "@arcgis/core/rest/serviceArea";
import ServiceAreaParameters from "@arcgis/core/rest/support/ServiceAreaParameters";
import FeatureSet from "@arcgis/core/rest/support/FeatureSet";
import esriConfig from "@arcgis/core/config";
import { SpatialFilterService } from '@/lib/spatial/SpatialFilterService';
import { PropertyQueryService } from '@/lib/spatial/PropertyQueryService';

// Persona icons map
const PERSONA_ICON_MAP: Record<string, React.ComponentType<any>> = {
  'strategist': PiStrategy,
  'tactician': PiLightning,
  'creative': PiLightbulb,
  'product-specialist': PiWrench,
  'customer-advocate': PiHeart
};

export interface UnifiedAnalysisWorkflowProps {
  view: __esri.MapView;
  onAnalysisComplete?: (result: UnifiedAnalysisResponse) => void;
  onExport?: (format: string, data: unknown) => void;
  enableChat?: boolean;
  defaultAnalysisType?: 'query' | 'infographic' | 'comprehensive' | 'cma';
  setFormattedLegendData?: React.Dispatch<React.SetStateAction<any>>;
  selectedHotspot?: import('@/components/map/SampleHotspots').SampleHotspot | null;
  onHotspotProcessed?: () => void;
  onAnalysisStart?: () => void;
  onVisualizationLayerCreated?: (layer: __esri.FeatureLayer | null, shouldReplace?: boolean) => void;
  // CMA popup integration props
  selectedArea?: any | null;
  propertyParams?: PropertyParams | null;
  triggerCMAAnalysis?: boolean;
}

type WorkflowStep = 'area' | 'buffer' | 'analysis' | 'results';

interface WorkflowState {
  currentStep: WorkflowStep;
  areaSelection?: UnifiedAreaSelection;
  analysisType?: 'query' | 'infographic' | 'comprehensive' | 'cma';
  analysisResult?: UnifiedAnalysisResponse;
  isProcessing: boolean;
  error?: string;
}

export default function UnifiedAnalysisWorkflow({
  view,
  onAnalysisComplete,
  onExport,
  enableChat = true,
  defaultAnalysisType = 'query',
  setFormattedLegendData,
  selectedHotspot,
  onHotspotProcessed,
  onAnalysisStart,
  onVisualizationLayerCreated,
  // CMA popup integration props
  selectedArea,
  propertyParams,
  triggerCMAAnalysis
}: UnifiedAnalysisWorkflowProps) {
  // State management
  const [workflowState, setWorkflowState] = useState<WorkflowState>({
    currentStep: 'area',
    isProcessing: false
  });

  const [selectedQuery, setSelectedQuery] = useState<string>('');
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>('');
  const [selectedInfographicType, setSelectedInfographicType] = useState<'strategic' | 'competitive' | 'demographic'>('strategic');

  // Buffer configuration
  const [bufferDistance, setBufferDistance] = useState<string>('1');
  const [bufferUnit, setBufferUnit] = useState<'kilometers' | 'minutes'>('kilometers');
  const [bufferType, setBufferType] = useState<'radius' | 'drivetime' | 'walktime'>('radius');

  // CMA data from card
  const [cmaData, setCMAData] = useState<{ bufferConfig: any; properties: any[]; stats: any; filters: any } | null>(null);

  // Log when cmaData changes
  useEffect(() => {
    if (cmaData) {
      console.log('[UnifiedAnalysisWorkflow] cmaData updated:', {
        hasBufferConfig: !!cmaData.bufferConfig,
        propertiesCount: cmaData.properties?.length || 0,
        hasStats: !!cmaData.stats,
        filters: cmaData.filters
      });
    }
  }, [cmaData]);
  
  // Reset counter to force component remount
  const [resetCounter, setResetCounter] = useState(0);
  
  // Abort controller for cancelling ongoing analysis
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Handle selected hotspot from sample areas
  useEffect(() => {
    if (selectedHotspot) {
      // console.log('[UnifiedAnalysisWorkflow] Processing selected hotspot:', selectedHotspot);
      
      // Convert hotspot coordinates to point geometry
      const hotspotPoint = {
        type: 'point',
        longitude: selectedHotspot.coordinates[0],
        latitude: selectedHotspot.coordinates[1],
        spatialReference: { wkid: 4326 }
      } as __esri.Point;
      
      // Create area selection for the hotspot
      const hotspotAreaSelection: UnifiedAreaSelection = {
        geometry: hotspotPoint,
        displayName: selectedHotspot.name,
        method: 'search',
        metadata: {
          source: `sample-hotspot-${selectedHotspot.type}-${selectedHotspot.id}`
        }
      };
      
      // Update workflow state with the hotspot area and move to buffer step
      setWorkflowState((prev: any) => ({
        ...prev,
        areaSelection: hotspotAreaSelection,
        currentStep: 'buffer',
        error: undefined
      }));
      
      // Pre-populate query based on hotspot type and sample query
      setSelectedQuery(selectedHotspot.sampleQuery);
      
      // Auto-set buffer distance for demonstration
      setBufferDistance('5');
      setBufferUnit('kilometers');
      setBufferType('radius');
      
      // Notify parent that hotspot has been processed
      onHotspotProcessed?.();
    }
  }, [selectedHotspot, onHotspotProcessed]);
  
  // Apply buffer to geometry
  const createBufferedGeometry = useCallback(async (geometry: __esri.Geometry, distance: number, unit: string) => {
    try {
      // console.log('[Buffer Creation] Starting buffer creation for geometry type:', geometry.type);
      
      let bufferedGeometry: __esri.Geometry | null = null;
      
      if (bufferType === 'radius') {
        if ((geometry as any).type === 'point') {
          const originalPoint = geometry as __esri.Point;
          // console.log('[Buffer Creation] Original point coordinates:', 
          //   `X: ${originalPoint.x}, Y: ${originalPoint.y}, WKID: ${originalPoint.spatialReference?.wkid}`);
          
          // For points, create a circle
          const distanceInMeters = unit === 'kilometers' ? distance * 1000 : distance * 1000; // Always kilometers now
          // console.log('[Buffer Creation] Distance conversion:', `${distance} ${unit} = ${distanceInMeters} meters`);
          
          // Project the point to the map's spatial reference if needed for proper circle rendering
          let centerPoint = originalPoint;
          // console.log('[Buffer Creation] View spatial reference WKID:', view.spatialReference.wkid);
          
          if (centerPoint.spatialReference.wkid !== view.spatialReference.wkid) {
            // console.log('[Buffer Creation] Point projection needed from', centerPoint.spatialReference.wkid, 'to', view.spatialReference.wkid);
            const projection = await import('@arcgis/core/geometry/projection');
            await projection.load();
            centerPoint = projection.project(centerPoint, view.spatialReference) as __esri.Point;
            // console.log('[Buffer Creation] Point after projection:', 
            //   `X: ${centerPoint.x}, Y: ${centerPoint.y}, WKID: ${centerPoint.spatialReference?.wkid}`);
          } else {
            // console.log('[Buffer Creation] No projection needed - coordinates match');
          }
          
          // console.log('[Buffer Creation] Creating Circle with center:', 
          //   `X: ${centerPoint.x}, Y: ${centerPoint.y}, radius: ${distanceInMeters}m`);
          
          bufferedGeometry = new Circle({
            center: centerPoint,
            radius: distanceInMeters,
            radiusUnit: "meters",
            spatialReference: view.spatialReference
          });
          
          // console.log('[Buffer Creation] Circle created with extent:', bufferedGeometry.extent ? 
          //   `xmin: ${bufferedGeometry.extent.xmin}, ymin: ${bufferedGeometry.extent.ymin}, xmax: ${bufferedGeometry.extent.xmax}, ymax: ${bufferedGeometry.extent.ymax}` : 'null');
        } else {
          // For polygons and other geometries, use geometryEngine.buffer with proper types
          const bufferResult = geometryEngine.buffer(
            geometry as __esri.Polygon | __esri.Polyline, 
            distance, 
            "kilometers" as "feet" | "meters" | "kilometers" | "miles"
          );
          bufferedGeometry = Array.isArray(bufferResult) ? bufferResult[0] : bufferResult;
        }
      } else if (bufferType === 'drivetime' || bufferType === 'walktime') {
        // Service area buffering - only works with points
        if ((geometry as any).type === 'point') {
          // console.log('[Service Area] Starting service area analysis for', bufferType);
          
          let timeInMinutes = distance;
          if (unit === 'kilometers') {
            const speedInKmh = bufferType === 'drivetime' ? 50 : 5;
            const distanceInKm = distance; // Already in kilometers
            timeInMinutes = (distanceInKm / speedInKmh) * 60;
          }

          const params = new ServiceAreaParameters({
            facilities: new FeatureSet({
              features: [{
                geometry: geometry,
                attributes: {
                  Name: "Location",
                  [bufferType === "drivetime" ? "TravelTime" : "WalkTime"]: timeInMinutes
                }
              }]
            }),
            defaultBreaks: [timeInMinutes],
            travelDirection: "from-facility",
            outputGeometryPrecision: 1,
            trimOuterPolygon: true,
            outSpatialReference: view.spatialReference,
            travelMode: {
              attributeParameterValues: [],
              description: "Results are calculated using the street network",
              impedanceAttributeName: bufferType === "drivetime" ? "TravelTime" : "WalkTime",
              name: bufferType === "drivetime" ? "Driving Time" : "Walking Distance",
              type: bufferType === "drivetime" ? "automobile" : "walk",
              useHierarchy: bufferType === "drivetime",
              restrictionAttributeNames: [],
              simplificationTolerance: 2,
              timeAttributeName: bufferType === "drivetime" ? "TravelTime" : "WalkTime"
            }
          });

          const serviceUrl = "https://route-api.arcgis.com/arcgis/rest/services/World/ServiceAreas/NAServer/ServiceArea_World/solveServiceArea";
          
          try {
            const result = await serviceArea.solve(serviceUrl, params);
            
            if (result?.serviceAreaPolygons?.features && result.serviceAreaPolygons.features.length > 0) {
              const featureGeometry = result.serviceAreaPolygons.features[0].geometry;
              if (featureGeometry) {
                bufferedGeometry = featureGeometry as __esri.Geometry;
                // console.log('[Service Area] Successfully created service area');
              } else {
                throw new Error("Invalid geometry in service area result");
              }
            } else {
              throw new Error("No service area returned");
            }
          } catch (error) {
            console.warn('[Service Area] Service area failed, using approximation:', error);
            
            // Enhanced fallback with realistic approximation
            let radiusInMeters = distance;
            
            if (bufferType === "drivetime") {
              // Realistic driving speed: 50 km/h average = 0.833 km per minute
              radiusInMeters = distance * 0.833 * 1000;
            } else if (bufferType === "walktime") {
              // Walking speed: 5 km/h = 0.083 km per minute  
              radiusInMeters = distance * 0.083 * 1000;
            }
            
            // Create approximation buffer
            bufferedGeometry = geometryEngine.geodesicBuffer(
              geometry as __esri.Point, 
              radiusInMeters, 
              'meters', 
              false
            ) as __esri.Polygon;
            
            // console.log('[Service Area] Using approximation buffer with radius:', radiusInMeters, 'meters');
          }
        } else {
          throw new Error('Travel time buffering only works with point geometries');
        }
      }
      
      if (!bufferedGeometry) {
        throw new Error('Failed to create buffered geometry');
      }
      
      return bufferedGeometry;
    } catch (error) {
      console.error('Buffer error:', error);
      throw error;
    }
  }, [bufferType, view]);
  
  // Handle buffer step completion
  const handleBufferComplete = useCallback(async (applyBuffer: boolean = false) => {
    console.log('[UnifiedWorkflow] handleBufferComplete called:', {
      applyBuffer,
      hasAreaSelection: !!workflowState.areaSelection,
      geometryType: workflowState.areaSelection?.geometry?.type,
      bufferDistance,
      bufferUnit,
      bufferType
    });
    
    if (applyBuffer && workflowState.areaSelection && (workflowState.areaSelection.geometry as any).type === 'point') {
      const point = workflowState.areaSelection.geometry as __esri.Point;
      // console.log('[UnifiedWorkflow] Original point before buffering:', 
      //   `X: ${point.x}, Y: ${point.y}, WKID: ${point.spatialReference?.wkid}`);
    }
    
    if (applyBuffer && workflowState.areaSelection) {
      try {
        const distance = parseFloat(bufferDistance);
        if (isNaN(distance) || distance <= 0) {
          throw new Error('Invalid buffer distance');
        }
        
        const bufferedGeometry = await createBufferedGeometry(
          workflowState.areaSelection.geometry,
          distance,
          bufferUnit
        );
        
        // console.log('[UnifiedWorkflow] Buffer created - Distance:', distance, bufferUnit, 'Type:', bufferType);
        // if (bufferedGeometry.extent) {
        //   console.log('[UnifiedWorkflow] Buffer extent:', 
        //     `xmin: ${bufferedGeometry.extent.xmin}, ymin: ${bufferedGeometry.extent.ymin}, xmax: ${bufferedGeometry.extent.xmax}, ymax: ${bufferedGeometry.extent.ymax}`);
        //   console.log('[UnifiedWorkflow] Buffer center coordinates:', 
        //     `X: ${bufferedGeometry.extent.center.x}, Y: ${bufferedGeometry.extent.center.y}`);
        // }
        // console.log('[UnifiedWorkflow] Buffer spatial reference:', bufferedGeometry.spatialReference?.wkid);
        
        // Add buffered geometry as a graphic to the map (matching button colors)
        if (view && bufferedGeometry) {
          console.log('[UnifiedWorkflow] Adding buffer visualization to map:', {
            bufferType,
            geometryType: bufferedGeometry.type,
            hasExtent: !!bufferedGeometry.extent
          });
          
          // Define buffer color to match button icon colors
          const bufferColor = bufferType === 'radius' 
            ? [34, 197, 94] // Green for radius (matches brand green)
            : bufferType === 'drivetime' 
              ? [34, 197, 94] // Green for drive time (matches text-green-500)
              : [34, 197, 94]; // Green for walk time (matches text-green-500)
          
          // Create buffer graphic using SimpleFillSymbol (matching existing implementation)
          const bufferGraphic = new Graphic({
            geometry: bufferedGeometry,
            symbol: new SimpleFillSymbol({
              color: [...bufferColor, 0.2], // 20% opacity matching existing
              outline: {
                color: bufferColor,
                width: 2
              }
            }),
            attributes: {
              isBuffer: true,
              bufferType: bufferType
            }
          });
          
          // Find and preserve any existing point graphic
          const pointGraphic = view.graphics.find(g => g.attributes?.isPoint);
          
          // Clear graphics and re-add in correct order
          view.graphics.removeAll();
          
          // Re-add point graphic if it exists
          if (pointGraphic) {
            view.graphics.add(pointGraphic);
          } else if ((workflowState.areaSelection.geometry as any).type === 'point') {
            // Create new point graphic if needed
            const newPointGraphic = new Graphic({
              geometry: workflowState.areaSelection.geometry,
              symbol: {
                type: "simple-marker",
                color: [255, 0, 0],
                outline: {
                  color: [255, 255, 255],
                  width: 2
                },
                size: 8
              } as unknown as __esri.SimpleMarkerSymbol,
              attributes: { isPoint: true }
            });
            view.graphics.add(newPointGraphic);
          }
          
          // Add buffer graphic
          view.graphics.add(bufferGraphic);
          
          console.log('[UnifiedWorkflow] Buffer graphic added to map:', {
            graphicsCount: view.graphics.length,
            bufferType,
            bufferGeometry: bufferedGeometry?.type,
            bufferExtent: bufferedGeometry?.extent?.width || 'no extent'
          });
          
          // Query and display properties within the buffer from ONLY active and sold property layers
          const allBufferProperties: __esri.Graphic[] = [];
          try {
            const Query = (await import('@arcgis/core/rest/support/Query')).default;
            
            // Find active and sold property layers on the map
            const propertyLayers = view.map.allLayers
              .filter(layer => layer.type === 'feature' && 
                      (layer.id === 'active_properties_layer' || 
                       layer.id === 'sold_properties_layer' ||
                       (layer.title?.includes('Properties') || false)))
              .toArray() as __esri.FeatureLayer[];
            
            console.log(`[UnifiedWorkflow] Querying ${propertyLayers.length} property layers:`, propertyLayers.map(l => l.id));
            
            // Query each property layer separately within the buffer
            for (const layer of propertyLayers) {
              try {
                const query = new Query({
                  geometry: bufferedGeometry,
                  spatialRelationship: 'intersects',
                  outFields: ['*'],
                  returnGeometry: true,
                  where: '1=1'
                });
                
                const featureSet = await layer.queryFeatures(query);
                console.log(`[UnifiedWorkflow] Found ${featureSet.features.length} properties in ${layer.id}`);
                
                // Add properties with visualization symbols
                const visualizedProperties = featureSet.features.map(feature => {
                  const clonedFeature = feature.clone();
                  clonedFeature.symbol = new SimpleMarkerSymbol({
                    style: 'circle',
                    color: [255, 165, 0, 0.8], // Orange color for selected properties
                    size: 8,
                    outline: { color: [255, 255, 255, 1], width: 2 }
                  });
                  return clonedFeature;
                });
                
                allBufferProperties.push(...visualizedProperties);
              } catch (layerError) {
                console.warn(`[UnifiedWorkflow] Failed to query layer ${layer.id}:`, layerError);
              }
            }

            if (allBufferProperties.length > 0) {
              // Add properties to map using PropertyQueryService method
              const propertyQueryService = PropertyQueryService.getInstance();
              await propertyQueryService.addPropertiesToMap(view, allBufferProperties, true);
              
              // Create summary for display
              const summary = propertyQueryService.createPropertySummary(allBufferProperties);
              console.log(`[UnifiedWorkflow] Found ${summary.totalCount} properties in buffer from active/sold layers only`);
              
              // You could display this summary in the UI if needed
              setWorkflowState((prev: any) => ({
                ...prev,
                propertySummary: summary
              }));
            } else {
              console.log('[UnifiedWorkflow] No properties found in buffer area');
            }
          } catch (propertyError) {
            console.warn('[UnifiedWorkflow] Failed to query properties in buffer:', propertyError);
            // Don't fail the entire buffer operation if property query fails
          }
          
          // Zoom to buffer extent (expand by 20% for comfortable view)
          if (bufferedGeometry?.extent) {
            try {
              console.log('[UnifiedWorkflow] Zooming to buffer extent');
              await view.goTo(bufferedGeometry.extent.expand(1.2), {
                duration: 800,
                easing: 'ease-in-out'
              });
            } catch (zoomError) {
              console.warn('[UnifiedWorkflow] Failed to zoom to buffer:', zoomError);
            }
          }
        }
        
        // Create new area selection with buffered geometry
        const bufferedArea: UnifiedAreaSelection = {
          ...workflowState.areaSelection,
          geometry: bufferedGeometry,
          displayName: `${workflowState.areaSelection.displayName} (${distance} ${bufferUnit} buffer)`,
          method: 'service-area',
          metadata: {
            ...workflowState.areaSelection.metadata,
            bufferType,
            bufferValue: distance,
            bufferUnit
          }
        };
        
        setWorkflowState((prev: any) => ({
          ...prev,
          areaSelection: bufferedArea,
          // For popup-initiated CMA, skip 'analysis' step and go directly to 'results'
          currentStep: (prev.analysisType === 'cma' && propertyParams) ? 'results' : 'analysis'
        }));
      } catch (error) {
        setWorkflowState((prev: any) => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to apply buffer'
        }));
      }
    } else {
      // Skip buffer, proceed with original area
      setWorkflowState((prev: any) => ({
        ...prev,
        // For popup-initiated CMA, skip 'analysis' step and go directly to 'results'
        currentStep: (prev.analysisType === 'cma' && propertyParams) ? 'results' : 'analysis'
      }));
    }
  }, [workflowState.areaSelection, bufferDistance, bufferUnit, bufferType, createBufferedGeometry, view, propertyParams]);

  // Handle buffer step completion with specific area selection (for CMA popup integration)
  const handleBufferCompleteWithArea = useCallback(async (applyBuffer: boolean = false, areaSelection?: any) => {
    const targetAreaSelection = areaSelection || workflowState.areaSelection;
    
    console.log('[UnifiedWorkflow] handleBufferCompleteWithArea called:', {
      applyBuffer,
      hasAreaSelection: !!targetAreaSelection,
      geometryType: targetAreaSelection?.geometry?.type,
      bufferDistance,
      bufferUnit,
      bufferType,
      usingProvidedArea: !!areaSelection
    });
    
    if (applyBuffer && targetAreaSelection && (targetAreaSelection.geometry as any).type === 'point') {
      const point = targetAreaSelection.geometry as __esri.Point;
      console.log('[UnifiedWorkflow] Using provided area selection for buffer creation');
    }
    
    if (applyBuffer && targetAreaSelection) {
      try {
        const distance = parseFloat(bufferDistance);
        if (isNaN(distance) || distance <= 0) {
          throw new Error('Invalid buffer distance');
        }
        
        const bufferedGeometry = await createBufferedGeometry(
          targetAreaSelection.geometry,
          distance,
          bufferUnit
        );
        
        // Add buffered geometry as a graphic to the map
        if (view && bufferedGeometry) {
          console.log('[UnifiedWorkflow] Adding buffer visualization to map with provided area:', {
            bufferType,
            geometryType: bufferedGeometry.type,
            hasExtent: !!bufferedGeometry.extent
          });
          
          const bufferColor = bufferType === 'radius' 
            ? [34, 197, 94] 
            : bufferType === 'drivetime' 
              ? [34, 197, 94] 
              : [34, 197, 94];
          
          const bufferGraphic = new Graphic({
            geometry: bufferedGeometry,
            symbol: new SimpleFillSymbol({
              color: [...bufferColor, 0.2],
              outline: {
                color: bufferColor,
                width: 2
              }
            }),
            attributes: {
              isBuffer: true,
              bufferType: bufferType
            }
          });
          
          // Find and preserve any existing point graphic
          const pointGraphic = view.graphics.find(g => g.attributes?.isPoint);
          
          // Clear graphics and re-add in correct order
          view.graphics.removeAll();
          
          // Re-add point graphic if it exists
          if (pointGraphic) {
            view.graphics.add(pointGraphic);
          } else if ((targetAreaSelection.geometry as any).type === 'point') {
            // Create new point graphic if needed
            const newPointGraphic = new Graphic({
              geometry: targetAreaSelection.geometry,
              symbol: {
                type: "simple-marker",
                color: [255, 0, 0],
                outline: {
                  color: [255, 255, 255],
                  width: 2
                },
                size: 8
              } as unknown as __esri.SimpleMarkerSymbol,
              attributes: { isPoint: true }
            });
            view.graphics.add(newPointGraphic);
          }
          
          // Add buffer graphic
          view.graphics.add(bufferGraphic);
          
          console.log('[UnifiedWorkflow] Buffer graphic added to map with area selection:', {
            graphicsCount: view.graphics.length,
            bufferType,
            bufferGeometry: bufferedGeometry?.type,
            bufferExtent: bufferedGeometry?.extent?.width || 'no extent'
          });
          
          // Skip zoom for popup CMA as MapApp.tsx handles it
          // if (bufferedGeometry.extent) {
          //   view.goTo(bufferedGeometry.extent.expand(1.2), {
          //     duration: 1500,
          //     easing: "ease-in-out"
          //   }).catch(error => {
          //     console.warn('[UnifiedWorkflow] Failed to zoom to buffer:', error);
          //   });
          // }
        }
      } catch (error) {
        console.error('[UnifiedWorkflow] Buffer creation error:', error);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bufferDistance, bufferUnit, bufferType, createBufferedGeometry, view]);
  
  // Ref to prevent infinite loop in buffer application
  const hasAppliedBufferRef = useRef(false);
  const bufferApplicationKeyRef = useRef<string | null>(null);

  // Handle CMA popup integration - auto-trigger CMA analysis when props are provided
  useEffect(() => {
    if (triggerCMAAnalysis && selectedArea) {
      // Create unique key for this buffer application attempt
      const currentBufferKey = `${selectedArea.displayName}-${(selectedArea as any).bufferConfig?.type}-${(selectedArea as any).bufferConfig?.value}`;
      
      // Check if we've already applied buffer for this specific configuration
      if (bufferApplicationKeyRef.current === currentBufferKey) {
        console.log('[UnifiedAnalysisWorkflow] Buffer already applied for this configuration, skipping to prevent infinite loop');
        return;
      }
      
      console.log('[UnifiedAnalysisWorkflow] CMA popup integration triggered for area:', selectedArea.displayName);
      
      // Set area selection and analysis type
      setWorkflowState((prev: any) => ({
        ...prev,
        areaSelection: selectedArea,
        analysisType: 'cma',
        // For popup-initiated CMA, skip directly to 'results' to show CMAInterface
        currentStep: 'results',
        error: undefined
      }));
      
      // If the area has buffer config, apply the buffer visualization immediately
      if ((selectedArea as any).bufferConfig && view && !hasAppliedBufferRef.current) {
        const bufferConfig = (selectedArea as any).bufferConfig;
        console.log('[UnifiedAnalysisWorkflow] Applying buffer visualization for popup CMA:', bufferConfig);
        
        // Mark that we're applying buffer for this configuration
        hasAppliedBufferRef.current = true;
        bufferApplicationKeyRef.current = currentBufferKey;
        
        // Set buffer parameters and apply buffer
        setBufferDistance(bufferConfig.value.toString());
        setBufferUnit(bufferConfig.unit);
        setBufferType(bufferConfig.type);
        
        // Apply buffer visualization immediately with the selected area
        setTimeout(() => {
          handleBufferCompleteWithArea(true, selectedArea);
        }, 100);
      }
      
      // Trigger the analysis immediately
      // This will be handled by the existing analysis trigger logic
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerCMAAnalysis, selectedArea, view]);

  // Reset buffer application flag when key props change
  useEffect(() => {
    hasAppliedBufferRef.current = false;
    bufferApplicationKeyRef.current = null;
  }, [triggerCMAAnalysis, selectedArea?.displayName]);
  
  // Stop analysis function
  const stopAnalysis = useCallback(() => {
    // console.log('[UnifiedWorkflow] Stopping analysis...');
    
    // Abort any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // Reset processing state
    setWorkflowState((prev: any) => ({
      ...prev,
      isProcessing: false,
      error: 'Analysis cancelled by user'
    }));
  }, []);
  
  // QuickstartIQ dialog state
  const [quickstartDialogOpen, setQuickstartDialogOpen] = useState(false);
  
  // Persona state
  const [selectedPersona, setSelectedPersona] = useState<string>('strategist');
  const [isPersonaDialogOpen, setIsPersonaDialogOpen] = useState(false);
  
  // Results tab state
  const [activeResultsTab, setActiveResultsTab] = useState<string>('analysis');
  
  // Chat state to persist across tab switches
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [hasGeneratedNarrative, setHasGeneratedNarrative] = useState(false);
  
  // Advanced filtering configuration state
  const [advancedFilterConfig, setAdvancedFilterConfig] = useState<AdvancedFilterConfig>({
    clustering: {
      ...DEFAULT_CLUSTER_CONFIG,
      minScorePercentile: DEFAULT_CLUSTER_CONFIG.minScorePercentile ?? 70
    },
    realEstateFilters: DEFAULT_REAL_ESTATE_FILTER_CONFIG,
    fieldFilters: DEFAULT_FIELD_FILTER_CONFIG,
    visualization: DEFAULT_VISUALIZATION_CONFIG,
    performance: DEFAULT_PERFORMANCE_CONFIG,
  });
  const [advancedFilterDialogOpen, setAdvancedFilterDialogOpen] = useState(false);
  
  // Legacy clustering config for backward compatibility
  const clusterConfig = advancedFilterConfig.clustering;
  
  // Phase 4 features state - COMMENTED OUT FOR DEVELOPMENT PAUSE
  // const [showPhase4Features, setShowPhase4Features] = useState(false);
  // const hasPhase4Features = isPhase4FeatureEnabled('scholarlyResearch') || 
  //                          isPhase4FeatureEnabled('realTimeDataStreams') || 
  //                          isPhase4FeatureEnabled('advancedVisualization') || 
  //                          isPhase4FeatureEnabled('aiInsights');
  const hasPhase4Features = false; // Temporarily disabled

  // Initialize analysis wrapper
  const [analysisWrapper] = useState<UnifiedAnalysisWrapper>(() => new UnifiedAnalysisWrapper());

  // Chat context for contextual analysis
  const chatContext = useChatContext();

  // Infographics dialog state (independent of workflow)
  const [infographicsDialog, setInfographicsDialog] = useState({
    open: false,
    geometry: null as __esri.Geometry | null,
    selectedReport: null as string | null,
    showInfographics: false
  });

  // State for available reports
  const [infographicsReports, setInfographicsReports] = useState<any[]>([]);

  // Step navigation
  const goToStep = useCallback((step: WorkflowStep) => {
    setWorkflowState((prev: any) => ({ ...prev, currentStep: step }));
  }, []);

  // Add event listener for popup infographics
  useEffect(() => {
    const handleOpenInfographics = (event: CustomEvent) => {
      // console.log('[UnifiedWorkflow] Infographics popup event received', event.detail);

      // Open report selection dialog immediately with popup geometry
      setInfographicsDialog({
        open: true,
        geometry: event.detail?.geometry || null,
        selectedReport: null,
        showInfographics: false
      });
    };

    document.addEventListener('openInfographics', handleOpenInfographics as EventListener);
    return () => {
      document.removeEventListener('openInfographics', handleOpenInfographics as EventListener);
    };
  }, []);

  // Handle drilldown to property detail view
  useEffect(() => {
    const handleDrilldown = (event: CustomEvent) => {
      console.log('[UnifiedWorkflow] 🎯 Drilldown event received:', event.detail);

      const { drilldownKey, viewMode } = event.detail;

      if (drilldownKey && viewMode === 'detail') {
        console.log('[UnifiedWorkflow] 🔍 Triggering property detail view for:', drilldownKey);

        // Update workflowState with drilldown parameters and trigger re-analysis
        if (workflowState.areaSelection) {
          setWorkflowState((prev: any) => ({
            ...prev,
            areaSelection: {
              ...prev.areaSelection,
              analysisOptions: {
                drilldownKey,
                viewMode: 'detail'
              }
            },
            // Clear previous results to trigger fresh analysis
            analysisResult: null,
            currentStep: 'analysis'
          }));

          // Trigger analysis execution after state update
          setTimeout(() => {
            const executeButton = document.querySelector('[data-execute-analysis]') as HTMLButtonElement;
            if (executeButton) {
              executeButton.click();
            }
          }, 100);
        }
      }
    };

    window.addEventListener('analysis-drilldown', handleDrilldown as EventListener);
    return () => {
      window.removeEventListener('analysis-drilldown', handleDrilldown as EventListener);
    };
  }, [workflowState.areaSelection]);

  // Load infographics reports using centralized ReportsService
  useEffect(() => {
    const loadReports = async () => {
      try {
        console.log('[UnifiedWorkflow] Loading reports from ReportsService...');
        const reports = await fetchReports();
        console.log('[UnifiedWorkflow] Loaded', reports.length, 'reports from ReportsService');
        setInfographicsReports(reports);
      } catch (error) {
        console.error('[UnifiedWorkflow] Failed to load reports:', error);
        setInfographicsReports([]);
      }
    };
    
    loadReports();
  }, []);

  // Handle area selection
  const handleAreaSelected = useCallback((area: UnifiedAreaSelection) => {
    if ((area.geometry as any).type === 'point') {
      const point = area.geometry as __esri.Point;
      // console.log('[UnifiedWorkflow] Point selected at coordinates:', 
      //   `X: ${point.x}, Y: ${point.y}, WKID: ${point.spatialReference?.wkid}`);
      // console.log('[UnifiedWorkflow] Point extent:', point.extent ? 
      //   `xmin: ${point.extent.xmin}, ymin: ${point.extent.ymin}, xmax: ${point.extent.xmax}, ymax: ${point.extent.ymax}` : 'null');
    } else {
      // console.log('[UnifiedWorkflow] Non-point geometry selected:', area.geometry.type);
    }
    const isPoint = (area.geometry as any).type === 'point';
    const isProjectArea = area.method === 'project-area';
    
    setWorkflowState((prev: any) => ({
      ...prev,
      areaSelection: area,
      // Reset analysis type to query if project area is selected and user had infographic/comprehensive
      analysisType: isProjectArea && (prev.analysisType === 'infographic' || prev.analysisType === 'comprehensive' || prev.analysisType === 'cma') 
        ? undefined 
        : prev.analysisType,
      // Skip buffer step for polygons and project area, go directly to analysis
      currentStep: isPoint && !isProjectArea ? 'buffer' : 'analysis'
    }));
  }, []);

  // Handle analysis type selection and execution
  const handleAnalysisTypeSelected = useCallback(async (type: 'query' | 'infographic' | 'comprehensive' | 'cma') => {
    if (!workflowState.areaSelection) {
      setWorkflowState((prev: any) => ({
        ...prev,
        error: 'Please select an area first'
      }));
      return;
    }

    // Special handling for CMA - run buffer creation and visualization but skip analysis API call
    const isCMAAnalysis = type === 'cma';

    // Notify parent that analysis is starting
    onAnalysisStart?.();

    setWorkflowState((prev: any) => ({
      ...prev,
      analysisType: type,
      isProcessing: true,
      error: undefined
    }));

    // Create new abort controller for this analysis
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      // Dynamically get the reference layer ID
      const { SpatialFilterConfig } = await import('@/lib/spatial/SpatialFilterConfig');
      const dataSourceLayerId = SpatialFilterConfig.getReferenceLayerId();
      
      // Log the configuration for debugging
      // console.log('[UnifiedWorkflow] Using spatial reference layer:', {
      //   layerId: dataSourceLayerId,
      //   geometryType: workflowState.areaSelection.geometry?.type,
      //   method: workflowState.areaSelection.method
      // });
      
      // Skip spatial filtering for project-wide analysis
      const shouldApplySpatialFilter = workflowState.areaSelection.method !== 'project-area';
      
      // console.log('[UnifiedAnalysisWorkflow] Analysis request preparation:', {
      //   shouldApplySpatialFilter,
      //   areaSelectionMethod: workflowState.areaSelection.method,
      //   hasGeometry: !!workflowState.areaSelection.geometry,
      //   geometryType: workflowState.areaSelection.geometry?.type
      // });
      
      // Get spatial filter IDs if applying spatial filtering
      let spatialFilterIds: string[] | undefined;
      if (shouldApplySpatialFilter && workflowState.areaSelection.geometry) {
        try {
          // console.log('[UnifiedAnalysisWorkflow] Querying area IDs for spatial filtering...');
          spatialFilterIds = await SpatialFilterService.queryAreaIdsByGeometry(
            workflowState.areaSelection.geometry,
            { spatialRelationship: 'intersects' }
          );
          // console.log(`[UnifiedAnalysisWorkflow] Found ${spatialFilterIds.length} area IDs for spatial filter:`, spatialFilterIds.slice(0, 10));
        } catch (error) {
          console.warn('[UnifiedAnalysisWorkflow] Spatial ID lookup failed, proceeding without spatial filter:', error);
          spatialFilterIds = undefined;
        }
      }
      
      // Prepare analysis request with view and layer ID
      console.log('[UnifiedWorkflow] 🔍 GEOMETRY DECISION:', {
        shouldApplySpatialFilter,
        isCMAAnalysis,
        condition: shouldApplySpatialFilter || isCMAAnalysis,
        areaSelectionMethod: workflowState.areaSelection.method,
        hasAreaSelectionGeometry: !!workflowState.areaSelection.geometry,
        analysisType: type
      });
      
      const request: UnifiedAnalysisRequest = {
        geometry: (shouldApplySpatialFilter || isCMAAnalysis) ? workflowState.areaSelection.geometry : undefined,
        geometryMethod: workflowState.areaSelection.method,
        analysisType: type,
        query: type === 'query' ? selectedQuery : undefined,
        endpoint: type === 'query' ? selectedEndpoint : undefined,
        infographicType: type === 'infographic' ? selectedInfographicType : undefined,
        includeChat: enableChat,
        clusterConfig: type === 'query' && clusterConfig.enabled ? clusterConfig : undefined,
        fieldFilters: advancedFilterConfig.fieldFilters, // Phase 2: Pass field filters
        visualizationConfig: advancedFilterConfig.visualization, // Phase 3: Pass visualization config
        performanceConfig: advancedFilterConfig.performance, // Phase 4: Pass performance config
        view: view,                          // NEW: Pass the map view
        dataSourceLayerId: dataSourceLayerId, // NEW: Pass the layer ID
        spatialFilterIds: spatialFilterIds,   // NEW: Pass the spatial filter IDs
        persona: selectedPersona,             // Pass the selected persona
        analysisOptions: (workflowState.areaSelection as any).analysisOptions // Pass drilldown options
      };

      // console.log('[UnifiedWorkflow] Starting analysis with spatial context:', {
      //   hasGeometry: !!request.geometry,
      //   geometryType: request.geometry?.type,
      //   hasView: !!request.view,
      //   layerId: request.dataSourceLayerId
      // });

      // Execute analysis (skip for CMA - handle differently)
      let result: UnifiedAnalysisResponse;
      
      if (isCMAAnalysis) {
        // For CMA, call the actual API with the buffered geometry for proper spatial filtering
        console.log('[UnifiedWorkflow] Running CMA analysis with buffered geometry:', {
          hasGeometry: !!workflowState.areaSelection?.geometry,
          geometryType: workflowState.areaSelection?.geometry?.type,
          bufferApplied: workflowState.areaSelection?.method === 'service-area'
        });
        
        result = await analysisWrapper.processUnifiedRequest(request);
      } else {
        result = await analysisWrapper.processUnifiedRequest(request);
      }

      // console.log('[UnifiedWorkflow] Analysis complete:', result);

      // Apply visualization to map if analysis includes visualization and data
      if (result.analysisResult?.visualization && result.analysisResult?.data && view) {
        try {
          // console.log('[UnifiedWorkflow] Applying visualization to map...');
          
          // First, perform geometry join if records have area_id but no geometry
          const analysisData = result.analysisResult.data;
          if (analysisData?.records && analysisData.records.length > 0) {
            const recordsWithoutGeometry = analysisData.records.filter((record: any) => !record.geometry);
            
            if (recordsWithoutGeometry.length > 0) {
              console.log(`🔍 [GEOMETRY JOIN DEBUG] Starting join:`, {
                totalRecords: analysisData.records.length,
                recordsWithoutGeometry: recordsWithoutGeometry.length,
                recordsWithGeometry: analysisData.records.length - recordsWithoutGeometry.length
              });
              
              try {
                // Load FSA boundaries for Quebec
                const { loadBoundaryData } = await import('@/utils/blob-data-loader');
                const boundaryData = await loadBoundaryData('fsa_boundaries');
                const geographicFeatures = (boundaryData as any)?.features || [];
                
                if (geographicFeatures.length > 0) {
                  // console.log('[UnifiedWorkflow] ✅ Loaded', geographicFeatures.length, 'FSA boundaries');
                  
                  // Join records with geometry
                  const joinedResults = analysisData.records.map((record: any, index: number) => {
                    // Skip if already has geometry
                    if (record.geometry) return record;
                    
                    // Extract ZIP code from record
                    const recordAreaId = record.area_id;
                    const recordPropertiesID = record.properties?.ID;
                    const recordDirectID = record.ID;

                    let primaryId = recordPropertiesID || recordDirectID;
                    if (recordAreaId && !String(recordAreaId).startsWith('area_')) {
                      primaryId = recordAreaId;
                    }

                    const rawZip = String(primaryId || recordAreaId || `area_${index}`);
                    const isFSA = /^[A-Z]\d[A-Z]$/i.test(rawZip);

                    // FIX: Skip geometry lookup for city names (e.g., "Montréal (Outremont)")
                    // These are descriptive names, not ZIP/postal codes
                    const isCityName = /^[A-Za-zÀ-ÿ\s]+\([A-Za-zÀ-ÿ\s-]+\)$/.test(rawZip);

                    const recordZip = isFSA ? rawZip.toUpperCase() : rawZip.padStart(5, '0');

                    // FIX: Skip geometry lookup for city names - return record as-is
                    if (isCityName) {
                      // Silently skip without warning - city names are not meant to be geocoded
                      return record;
                    }

                    // Find matching boundary
                    const zipFeature = geographicFeatures.find((f: any) => {
                      if (!f?.properties) return false;
                      
                      // For FSAs (Canadian postal codes), match without padding
                      if (isFSA) {
                        return (
                          String(f.properties.ID || '').toUpperCase() === recordZip ||
                          String(f.properties.FSA_ID || '').toUpperCase() === recordZip ||
                          String(f.properties.POSTAL_CODE || '').toUpperCase() === recordZip ||
                          f.properties.DESCRIPTION?.match(/^([A-Z]\d[A-Z])/i)?.[1]?.toUpperCase() === recordZip
                        );
                      }
                      
                      // For US ZIP codes, only pad when both are numeric
                      const propID = String(f.properties.ID || '');
                      const propZIP = String(f.properties.ZIP || '');
                      const propZIPCODE = String(f.properties.ZIPCODE || '');
                      
                      const compareWithConditionalPadding = (boundaryValue: string, recordValue: string) => {
                        const isRecordNumeric = /^\d+$/.test(recordValue);
                        const isBoundaryNumeric = /^\d+$/.test(boundaryValue);
                        
                        if (isRecordNumeric && isBoundaryNumeric) {
                          return boundaryValue.padStart(5, '0') === recordValue.padStart(5, '0');
                        }
                        return boundaryValue === recordValue;
                      };
                      
                      return (
                        compareWithConditionalPadding(propID, recordZip) ||
                        compareWithConditionalPadding(propZIP, recordZip) ||
                        compareWithConditionalPadding(propZIPCODE, recordZip) ||
                        f.properties.DESCRIPTION?.match(/^(\d{5})/)?.[1] === recordZip
                      );
                    });
                    
                    if (zipFeature) {
                      const zipDescription = zipFeature.properties?.DESCRIPTION || '';
                      const zipMatch = zipDescription.match(/^(\d{5})\s*\(([^)]+)\)/);
                      const zipCode = zipMatch?.[1] || recordZip;
                      const cityName = zipMatch?.[2] || 'Unknown City';
                      
                      return {
                        ...record,
                        geometry: zipFeature.geometry,
                        area_name: `${zipCode} (${cityName})`,
                        properties: {
                          ...record.properties,
                          ID: zipCode,
                          ZIP: zipCode,
                          city: cityName,
                          DESCRIPTION: zipDescription,
                        }
                      };
                    } else {
                      console.warn(`[UnifiedWorkflow] No geometry found for ZIP: ${recordZip}`);
                      return record; // Return as-is without geometry
                    }
                  });
                  
                  // Update analysis result with geometry
                  result.analysisResult.data = {
                    ...analysisData,
                    records: joinedResults
                  };
                  
                  const recordsWithGeometry = joinedResults.filter((r: any) => r.geometry).length;
                  const areaIds = joinedResults.map((r: any) => r.area_id || r.ID).filter(id => id);
                  const uniqueAreaIds = [...new Set(areaIds)];
                  
                  console.log(`✅ [GEOMETRY JOIN DEBUG] Join complete:`, {
                    totalRecords: joinedResults.length,
                    recordsWithGeometry,
                    areaIdsFound: areaIds.length,
                    uniqueAreaIds: uniqueAreaIds.length,
                    potentialDuplicates: areaIds.length - uniqueAreaIds.length
                  });
                  
                  if (areaIds.length !== uniqueAreaIds.length) {
                    const duplicates = areaIds.filter((id, index) => areaIds.indexOf(id) !== index);
                    console.warn(`🚨 [GEOMETRY JOIN] FOUND DUPLICATE AREA IDS:`, [...new Set(duplicates)]);
                  }
                  //   recordsWithGeometry,
                  //   recordsWithoutGeometry: joinedResults.length - recordsWithGeometry,
                  //   successRate: `${((recordsWithGeometry / joinedResults.length) * 100).toFixed(1)}%`
                  // });
                  
                } else {
                  console.error('[UnifiedWorkflow] No ZIP code boundaries loaded');
                }
                
              } catch (error) {
                console.error('[UnifiedWorkflow] ❌ Geometry join failed:', error);
              }
            } else {
              // console.log('[UnifiedWorkflow] All records already have geometry, skipping join');
            }
          }
          
          // Import the applyAnalysisEngineVisualization function
          const { applyAnalysisEngineVisualization } = await import('@/utils/apply-analysis-visualization');
          
          // Apply visualization with legend data callback and layer creation callback
          const visualizationLayer = await applyAnalysisEngineVisualization(
            result.analysisResult.visualization,
            result.analysisResult.data,
            view,
            setFormattedLegendData,
            onVisualizationLayerCreated,
            { callerId: 'unified-analysis-workflow' }
          );
          
          if (visualizationLayer) {
            // console.log('[UnifiedWorkflow] ✅ Visualization applied successfully');
          } else {
            console.warn('[UnifiedWorkflow] ⚠️ Visualization function returned null');
          }
          
        } catch (error) {
          console.error('[UnifiedWorkflow] ❌ Failed to apply visualization:', error);
        }
      } else {
        console.warn('[UnifiedWorkflow] ⚠️ Missing requirements for visualization:', {
          hasVisualization: !!result.analysisResult?.visualization,
          hasData: !!result.analysisResult?.data,
          hasView: !!view
        });
      }

      // Update state with results
      setWorkflowState((prev: any) => ({
        ...prev,
        analysisResult: result,
        currentStep: 'results',
        isProcessing: false,
        // For CMA, ensure areaSelection includes the current geometry
        ...(isCMAAnalysis && {
          areaSelection: {
            ...prev.areaSelection,
            geometry: prev.areaSelection?.geometry,
            displayName: prev.areaSelection?.displayName || `Buffer around ${selectedQuery || 'location'}`
          }
        })
      }));

      // Notify parent component
      // console.log('[UnifiedWorkflow] 🔥 About to call onAnalysisComplete callback with result:', result);
      // console.log('[UnifiedWorkflow] 🔥 onAnalysisComplete exists?', !!onAnalysisComplete);
      if (onAnalysisComplete) {
        // console.log('[UnifiedWorkflow] 🔥 Calling onAnalysisComplete...');
        onAnalysisComplete(result);
        // console.log('[UnifiedWorkflow] 🔥 onAnalysisComplete called successfully');
      } else {
        console.warn('[UnifiedWorkflow] ⚠️ onAnalysisComplete callback is undefined!');
      }

    } catch (error) {
      console.error('[UnifiedWorkflow] Analysis error:', error);
      
      // Check if the error is due to cancellation
      if (signal.aborted || (error as Error)?.name === 'AbortError') {
        // console.log('[UnifiedWorkflow] Analysis was cancelled');
        setWorkflowState((prev: any) => ({
          ...prev,
          error: 'Analysis cancelled',
          isProcessing: false
        }));
      } else {
        setWorkflowState((prev: any) => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Analysis failed',
          isProcessing: false
        }));
      }
    } finally {
      // Clean up abort controller
      abortControllerRef.current = null;
    }
  }, [workflowState.areaSelection, onAnalysisStart, selectedQuery, selectedEndpoint, selectedInfographicType, enableChat, clusterConfig, advancedFilterConfig.fieldFilters, advancedFilterConfig.visualization, advancedFilterConfig.performance, view, selectedPersona, analysisWrapper, onAnalysisComplete, setFormattedLegendData, onVisualizationLayerCreated]);

  // Handle export
  const handleExport = useCallback(async (format: string) => {
    if (!workflowState.analysisResult) return;

    try {
      const blob = await analysisWrapper.exportResults(format);
      onExport?.(format, blob);
    } catch (error) {
      console.error('[UnifiedWorkflow] Export error:', error);
    }
  }, [workflowState.analysisResult, analysisWrapper, onExport]);

  // Handle chart export
  const handleExportChart = useCallback(async () => {
    if (!workflowState.analysisResult?.analysisResult?.data?.featureImportance) {
      console.warn('[UnifiedWorkflow] No feature importance data to export');
      return;
    }

    try {
      // Export the feature importance chart as PNG or PDF
      await handleExport('chart');
    } catch (error) {
      console.error('[UnifiedWorkflow] Chart export error:', error);
    }
  }, [workflowState.analysisResult, handleExport]);

  // Handle ZIP code and FSA code click to zoom to feature - using the exact same approach as CustomPopupManager
  const handleZipCodeClick = useCallback(async (zipCode: string) => {
    // console.log(`[UnifiedAnalysisWorkflow] Zooming to area code: ${zipCode}`);
    
    try {
      // Find the feature with this ZIP code in the current analysis results
      const analysisData = workflowState.analysisResult?.analysisResult?.data?.records;
      if (!analysisData) {
        console.warn('[UnifiedAnalysisWorkflow] No analysis data available for area code zoom');
        return;
      }

      // Find the feature matching this area code (ZIP or FSA)
      const targetFeature = analysisData.find((record: any) => 
        record.area_id === zipCode || 
        record.area_name?.includes(zipCode) ||
        record.properties?.geoid === zipCode ||
        record.properties?.area_id === zipCode ||
        record.properties?.area_name?.includes(zipCode)
      );

      if (!targetFeature) {
        console.warn(`[UnifiedAnalysisWorkflow] Feature not found for area code: ${zipCode}`);
        return;
      }

      // console.log(`[UnifiedAnalysisWorkflow] Found target feature for ${zipCode}:`, {
      //   hasGeometry: !!targetFeature.geometry,
      //   hasProperties: !!targetFeature.properties,
      //   geometryInProperties: !!targetFeature.properties?.geometry,
      //   featureKeys: Object.keys(targetFeature),
      //   propertiesKeys: targetFeature.properties ? Object.keys(targetFeature.properties) : null
      // });

      // Get the geometry from the feature (GeoJSON-style or ArcGIS-like object)
      const geometryUnknown = targetFeature.geometry as unknown;
      if (!geometryUnknown || typeof geometryUnknown !== 'object') {
        console.warn(`[UnifiedAnalysisWorkflow] No valid geometry found for area code: ${zipCode}`);
        return;
      }

      // Type guards for common GeoJSON shapes
      const isPointLike = (g: unknown): g is { type: 'Point' | 'point'; coordinates: [number, number] | [number, number, number] } => {
        if (!g || typeof g !== 'object') return false;
        const obj = g as Record<string, unknown>;
        const t = obj.type;
        return (t === 'Point' || t === 'point') && Array.isArray(obj.coordinates);
      };
      const isPolygonLike = (g: unknown): g is { type: 'Polygon' | 'polygon'; coordinates: number[][][] } => {
        if (!g || typeof g !== 'object') return false;
        const obj = g as Record<string, unknown>;
        const t = obj.type;
        return (t === 'Polygon' || t === 'polygon') && Array.isArray(obj.coordinates);
      };

      // console.log(`[UnifiedAnalysisWorkflow] Geometry details:`, {
      //   type: geometry.type,
      //   hasExtent: !!geometry.extent,
      //   hasCoordinates: !!(geometry as any).coordinates,
      //   hasRings: !!(geometry as any).rings
      // });

      // The geometry from the analysis data is a GeoJSON-style object with coordinates, not rings
      // Convert it to the proper format for ArcGIS view.goTo()
      if (isPointLike(geometryUnknown)) {
        // Handle GeoJSON Point with coordinates or ArcGIS point-like
        const coords = geometryUnknown.coordinates;
        if (coords && coords.length >= 2) {
          await view.goTo({
            center: [Number(coords[0]), Number(coords[1])],
            zoom: 15
          }, { duration: 1000 });
        }
      } else if (isPolygonLike(geometryUnknown)) {
        // Convert GeoJSON coordinates to ArcGIS rings format for autocast
        const coordinates = geometryUnknown.coordinates;
        if (coordinates && coordinates.length > 0) {
          const autocastGeometry = {
            type: 'polygon',
            rings: coordinates, // GeoJSON coordinates are already in rings format
            spatialReference: (geometryUnknown as { spatialReference?: unknown }).spatialReference || view.spatialReference
          };
          
          // console.log(`[UnifiedAnalysisWorkflow] Autocast geometry:`, {
          //   type: autocastGeometry.type,
          //   ringsCount: autocastGeometry.rings.length,
          //   firstRingLength: autocastGeometry.rings[0]?.length,
          //   spatialReference: autocastGeometry.spatialReference?.wkid,
          //   sampleCoords: autocastGeometry.rings[0]?.slice(0, 2)
          // });
          // 
          // console.log(`[UnifiedAnalysisWorkflow] View state before zoom:`, {
          //   center: view.center ? [view.center.longitude, view.center.latitude] : null,
          //   zoom: view.zoom,
          //   scale: view.scale
          // });
          
          // Try calculating extent manually and using that instead
          let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
          coordinates.forEach((ring: number[][]) => {
            ring.forEach((coord: number[]) => {
              xmin = Math.min(xmin, coord[0]);
              ymin = Math.min(ymin, coord[1]);
              xmax = Math.max(xmax, coord[0]);
              ymax = Math.max(ymax, coord[1]);
            });
          });
          
          const calculatedExtent = {
            xmin, ymin, xmax, ymax,
            spatialReference: { wkid: 4326 }
          };
          
          // console.log(`[UnifiedAnalysisWorkflow] Calculated extent:`, calculatedExtent);
          // console.log(`[UnifiedAnalysisWorkflow] Calling view.goTo() with calculated extent`);
          
          try {
            // Calculate center point of the feature
            const centerX = (xmin + xmax) / 2;
            const centerY = (ymin + ymax) / 2;
            
            // Calculate appropriate zoom level based on extent size
            const extentWidth = Math.abs(xmax - xmin);
            const extentHeight = Math.abs(ymax - ymin);
            const maxExtent = Math.max(extentWidth, extentHeight);
            
            // Determine zoom level based on extent size (rough estimation)
            let targetZoom = 10; // Default
            if (maxExtent < 0.001) targetZoom = 18;     // Very small area (1km buffer)
            else if (maxExtent < 0.01) targetZoom = 16; // Small area
            else if (maxExtent < 0.05) targetZoom = 14; // Medium area  
            else if (maxExtent < 0.1) targetZoom = 12;  // Large area
            else if (maxExtent < 0.2) targetZoom = 11;  // Very large area
            
            // console.log(`[UnifiedAnalysisWorkflow] Center: [${centerX}, ${centerY}], Target zoom: ${targetZoom}`);
            
            // Skip zoom for popup-initiated CMA as MapApp handles it
            if (!triggerCMAAnalysis) {
              const goToResult = await view.goTo({
                center: [centerX, centerY],
                zoom: targetZoom
              }, { 
                duration: 1500,
                easing: 'ease-in-out'
              });
            } else {
              console.log('[UnifiedAnalysisWorkflow] Skipping zoom - MapApp handles zoom for popup CMA');
            }
            // console.log(`[UnifiedAnalysisWorkflow] view.goTo() completed successfully, result:`, goToResult);
            
            // Add flash effect after zoom completes
            setTimeout(() => {
              try {
                // Create a Polygon from the coordinates
                const flashPolygon = new Polygon({
                  rings: coordinates,
                  spatialReference: { wkid: 4326 }
                });
                
                const flashGraphic = new Graphic({
                  geometry: flashPolygon,
                  symbol: new SimpleFillSymbol({
                    color: [255, 255, 255, 0.8], // White with transparency
                    outline: {
                      color: [255, 255, 255, 1], // White outline
                      width: 4
                    }
                  })
                });
                
                view.graphics.add(flashGraphic);
                // console.log(`[UnifiedAnalysisWorkflow] Flash effect added`);
                
                // Create pulsing effect
                let opacity = 0.8;
                let fadeOut = false;
                const pulseInterval = setInterval(() => {
                  if (!fadeOut) {
                    opacity -= 0.15;
                    if (opacity <= 0.2) fadeOut = true;
                  } else {
                    opacity += 0.15;
                    if (opacity >= 0.8) fadeOut = false;
                  }
                  
                  flashGraphic.symbol = new SimpleFillSymbol({
                    color: [255, 255, 255, opacity],
                    outline: {
                      color: [255, 255, 255, 1],
                      width: 4
                    }
                  });
                }, 200);
                
                // Remove flash after animation
                setTimeout(() => {
                  clearInterval(pulseInterval);
                  view.graphics.remove(flashGraphic);
                  // console.log(`[UnifiedAnalysisWorkflow] Flash effect removed`);
                }, 3000);
                
              } catch (flashError) {
                console.error(`[UnifiedAnalysisWorkflow] Flash effect failed:`, flashError);
              }
            }, 1600); // After zoom animation completes
            
            // console.log(`[UnifiedAnalysisWorkflow] View state after zoom:`, {
            //   center: view.center ? [view.center.longitude, view.center.latitude] : null,
            //   zoom: view.zoom,
            //   scale: view.scale
            // });
            
          } catch (goToError) {
            console.error(`[UnifiedAnalysisWorkflow] view.goTo() failed:`, goToError);
          }
        } else {
          console.warn(`[UnifiedAnalysisWorkflow] No coordinates available for polygon geometry`);
        }
      } else {
        const gType = (geometryUnknown as Record<string, unknown>)?.type ?? 'unknown';
        console.warn(`[UnifiedAnalysisWorkflow] Unsupported geometry type: ${gType}`);
      }
      
      // console.log(`[UnifiedAnalysisWorkflow] Successfully zoomed to area code: ${zipCode}`);
    } catch (error) {
      console.error(`[UnifiedAnalysisWorkflow] Error zooming to area code ${zipCode}:`, error);
    }
  }, [view, workflowState.analysisResult, triggerCMAAnalysis]);

  // Handle predefined query selection
  const handlePredefinedQuerySelect = useCallback((query: string) => {
    setSelectedQuery(query);
    setQuickstartDialogOpen(false);
  }, []);

  // Handle infographics report selection
  const handleInfographicsReportSelect = useCallback((reportId: string) => {
    // console.log('[UnifiedWorkflow] Report selected:', reportId);
    
    // Check if this is from the UI workflow (has area selection) or from popup
    const isFromUIWorkflow = workflowState.analysisType === 'infographic' && workflowState.areaSelection;
    
    if (isFromUIWorkflow) {
      // Update dialog state and keep it open for confirmation
      setInfographicsDialog((prev: any) => ({
        ...prev,
        selectedReport: reportId,
        open: false
      }));
    } else {
      // This is from popup - show infographic immediately
      setInfographicsDialog((prev: any) => ({
        ...prev,
        selectedReport: reportId,
        open: false,
        showInfographics: true
      }));
    }
  }, [workflowState.analysisType, workflowState.areaSelection]);

  // Handle infographics dialog close
  const handleInfographicsDialogClose = useCallback(() => {
    setInfographicsDialog((prev: any) => ({
      ...prev,
      open: false
    }));
  }, []);

  // Handle infographics completion
  const handleInfographicsComplete = useCallback(() => {
    setInfographicsDialog({
      open: false,
      geometry: null,
      selectedReport: null,
      showInfographics: false
    });
  }, []);

  // Generate standard report using ArcGIS API
  const generateStandardReport = useCallback(async (geometry: __esri.Geometry, reportType: string) => {
    try {
      // console.log('[UnifiedWorkflow] Generating standard report for', reportType);

      const reportId = reportType; // Use the report ID directly

      // Get the API key from environment config
      const apiKey = process.env.NEXT_PUBLIC_ARCGIS_API_KEY;
      
      if (!apiKey) {
        throw new Error('Missing ArcGIS API key');
      }

      // Make sure the geometry is in the correct spatial reference (4326/WGS84)
      let projectedGeometry = geometry;
      if (geometry.spatialReference.wkid !== 4326) {
        // console.log('[UnifiedWorkflow] Projecting geometry to WGS84 (4326)');
        const projection = await import('@arcgis/core/geometry/projection');
        await projection.load();
        const geometryUnion = geometry as __esri.GeometryUnion;
        projectedGeometry = projection.project(geometryUnion, { wkid: 4326 }) as __esri.Geometry;
      }
      
      // Create the study area from the geometry - handle different geometry types
      let studyArea: any;
      
      if (projectedGeometry.type === 'polygon') {
        studyArea = {
          geometry: {
            rings: (projectedGeometry as __esri.Polygon).rings,
            spatialReference: { wkid: 4326 }
          }
        };
      } else if (projectedGeometry.type === 'point') {
        // For points, we need to create a small buffer or use point coordinates
        const point = projectedGeometry as __esri.Point;
        studyArea = {
          geometry: {
            x: point.x,
            y: point.y,
            spatialReference: { wkid: 4326 }
          }
        };
      } else {
        throw new Error(`Unsupported geometry type: ${projectedGeometry.type}`);
      }

      // Use the exact same base URL as the older code
      const baseUrl = 'https://geoenrich.arcgis.com/arcgis/rest/services/World/geoenrichmentserver/Geoenrichment/createreport';
      // console.log('[UnifiedWorkflow] Sending request to ArcGIS API');
      
      // Create params object
      const params = {
        f: 'json',
        token: apiKey,
        studyAreas: JSON.stringify([studyArea]),
        report: reportId, // Pass the report ID
        format: 'PDF',
        langCode: 'en-us'
      };

      // Send the request using fetch
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/pdf'
        },
        body: new URLSearchParams(params).toString()
      });

      // Check if the response is successful
      if (!response.ok) {
        console.error('[UnifiedWorkflow] ArcGIS API request failed with status:', response.status);
        const errorText = await response.text();
        console.error('[UnifiedWorkflow] Error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Get the blob from the response
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      return url;
    } catch (error) {
      console.error('[UnifiedWorkflow] Error generating standard report:', error);
      throw error;
    }
  }, []);

  // Reset workflow
  const resetWorkflow = useCallback(() => {
    // Check if this is during a theme switch - if so, don't clear analysis layers
    const isThemeSwitch = document.documentElement.hasAttribute('data-theme-switching') || 
                         window.__themeTransitioning === true;
    
    if (isThemeSwitch) {
      // console.log('[UnifiedAnalysisWorkflow] 🎨 Theme switching detected - preserving analysis layers during reset');
      // Just reset state without clearing map layers
      setWorkflowState({
        currentStep: 'area',
        isProcessing: false
      });
      setResetCounter((prev: any) => prev + 1);
      return;
    }
    
    if (view) {
      // console.log('[UnifiedAnalysisWorkflow] 🔄 Full reset - clearing analysis layers');
      
      // Clear all graphics from the map (includes area selection, buffer, and analysis result graphics)
      view.graphics.removeAll();
      
      // Clear all dynamically added layers (analysis visualizations)
      // Find and remove any FeatureLayers that were added for analysis results
      const layersToRemove = view.map.layers.filter(layer => {
        // Remove layers that are likely analysis results based on:
        // 1. Layer ID pattern from applyAnalysisEngineVisualization
        // 2. Layer type being 'feature' (FeatureLayer)
        // 3. Client-side layers with source graphics (analysis results)
        // 4. CMA-specific layers
        const hasAnalysisId = layer.id?.includes('analysis-layer-');
        const isCMALayer = layer.id?.includes('cma-') || layer.title?.includes('CMA');
        const isBufferLayer = layer.id?.includes('buffer-') || layer.title?.includes('Buffer');
        const isAnalysisLayer = layer.type === 'feature' && 
               (hasAnalysisId || 
                isCMALayer ||
                isBufferLayer ||
                layer.title?.includes('Analysis') || 
                layer.title?.includes('Visualization') ||
                (layer as __esri.FeatureLayer).source?.length > 0); // Client-side layers
        
        return isAnalysisLayer;
      });
      
      // console.log('[UnifiedAnalysisWorkflow] Removing analysis layers:', {
      //   layersFound: layersToRemove.length,
      //   layerIds: layersToRemove.map(l => l.id)
      // });
      
      layersToRemove.forEach(layer => {
        view.map.remove(layer);
      });
      
      // Also clear any graphics layers specifically used for CMA/buffer displays
      const graphicsLayers = view.map.allLayers.filter(layer => 
        layer.type === 'graphics' && 
        (layer.id?.includes('buffer') || layer.id?.includes('cma') || layer.id?.includes('analysis'))
      );
      
      graphicsLayers.forEach(layer => {
        (layer as __esri.GraphicsLayer).removeAll();
      });
      
      // Additional cleanup: Clear any remaining map graphics that might be orphaned
      // This includes area selection graphics, temporary buffer graphics, etc.
      if (view.graphics && view.graphics.length > 0) {
        view.graphics.removeAll();
      }
      
      // console.log(`[UnifiedWorkflow] Cleared ${layersToRemove.length} analysis layers and ${graphicsLayers.length} graphics layers from map`);
    }
    
    // Clear legend data
    if (setFormattedLegendData) {
      setFormattedLegendData(null);
      // console.log('[UnifiedWorkflow] Cleared legend data');
    }
    
    // Reset all state
    setWorkflowState({
      currentStep: 'area',
      isProcessing: false,
      areaSelection: undefined,
      analysisType: undefined,
      analysisResult: undefined,
      error: undefined
    });
    // Area selection is cleared via workflowState.areaSelection = undefined above
    setSelectedQuery('');
    setSelectedEndpoint('');
    setSelectedInfographicType('strategic');
    setBufferDistance('1');
    setBufferUnit('kilometers'); // Default to kilometers
    setBufferType('radius');
    
    // Reset clustering config
    // setClusterConfig({
    //   ...DEFAULT_CLUSTER_CONFIG,
    //   minScorePercentile: DEFAULT_CLUSTER_CONFIG.minScorePercentile ?? 70
    // });
    
    // Reset chat state
    setChatMessages([]);
    setHasGeneratedNarrative(false);
    
    // Increment reset counter to force component remount
    setResetCounter((prev: any) => prev + 1);
  }, [view, setFormattedLegendData]);

  // Render workflow steps indicator
  const renderStepIndicator = () => {
    const steps = [
      { id: 'area', label: 'Area', icon: MapPin },
      { id: 'buffer', label: 'Buffer', icon: Target },
      { id: 'analysis', label: 'Analysis', icon: BarChart3 },
      { id: 'results', label: 'Results', icon: FileText }
    ];

    const currentStepIndex = steps.findIndex(s => s.id === workflowState.currentStep);

    return (
      <div className="flex items-center mb-3 overflow-x-auto">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = step.id === workflowState.currentStep;
          const isCompleted = currentStepIndex > index;
          const isClickable = isCompleted || (index === 0);

          return (
            <div key={step.id} className="flex items-center min-w-0">
              <button
                onClick={() => isClickable && goToStep(step.id as WorkflowStep)}
                disabled={!isClickable}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all whitespace-nowrap ${
                  isActive 
                    ? 'theme-bg-accent theme-text-accent-foreground' 
                    : isCompleted 
                      ? 'theme-bg-success theme-text-success cursor-pointer hover:bg-green-200' 
                      : 'theme-bg-secondary theme-text-secondary'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
                <span className="font-medium text-xs">{step.label}</span>
              </button>
              {index < steps.length - 1 && (
                <ChevronRight className="mx-2 theme-text-muted flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Render analysis type selection
  const renderAnalysisTypeSelection = () => {
    const isProjectArea = workflowState.areaSelection?.method === 'project-area';
    
    return (
      <div className="flex-1 flex flex-col space-y-6">
        {/* Performance warning for project area - Removed */}
        
        {/* Analysis Type Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
        {/* quickstartIQ */}
        <Card
          className={`cursor-pointer transition-all h-32 animate-entrance theme-analysis-card ${
            workflowState.analysisType === 'query' ? 'theme-analysis-card-selected' : ''
          }`}
          onClick={() => !workflowState.isProcessing && setWorkflowState((prev: any) => ({ ...prev, analysisType: 'query' }))}
        >
          <CardHeader className="!p-3 !pb-1">
            <CardTitle className="flex items-center gap-2 text-xs">
              <Image 
                src="/mpiq_pin2.png" 
                alt="quickstartIQ" 
                width={20} 
                height={20}
                className="h-5 w-5" 
              />
              <div className="flex text-sm font-bold">
                <span className="firefly-accent-primary">quickstart</span>
                <span className="theme-text-primary -ml-px">IQ</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="!p-3 !pt-0">
            <p className="text-xs theme-text-secondary">
              Natural language queries for custom analysis
            </p>
          </CardContent>
        </Card>

        {/* infographIQ */}
        <Card
          className={`transition-all h-32 animate-entrance theme-analysis-card ${
            isProjectArea
              ? 'theme-analysis-card-disabled'
              : workflowState.analysisType === 'infographic'
                ? 'theme-analysis-card-selected cursor-pointer'
                : 'cursor-pointer'
          }`}
          onClick={() => !workflowState.isProcessing && !isProjectArea && setWorkflowState((prev: any) => ({ ...prev, analysisType: 'infographic' }))}
        >
          <CardHeader className="!p-3 !pb-1">
            <CardTitle className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Image
                  src="/mpiq_pin2.png"
                  alt="infographIQ"
                  width={20}
                  height={20}
                  className="h-5 w-5"
                />
                <div className="flex text-sm font-bold">
                  <span className="firefly-accent-primary">infograph</span>
                  <span className="theme-text-primary -ml-px">IQ</span>
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="!p-3 !pt-0">
            <p className={`text-xs ${isProjectArea ? 'theme-text-muted' : 'theme-text-secondary'}`}>
              {isProjectArea ? 'Not available for all areas at once. Make a selection first' : 'Pre-configured reports and insights'}
            </p>
          </CardContent>
        </Card>

{/* CMA Analysis */}
        <CMACard
          selectedArea={workflowState.areaSelection}
          onAreaSelectionRequired={() => {
            // Redirect to area selection step
            goToStep('area');
          }}
          isSelected={workflowState.analysisType === 'cma'}
          onClick={() => setWorkflowState((prev: any) => ({ ...prev, analysisType: 'cma' }))}
          disabled={workflowState.isProcessing}
          className={workflowState.analysisType === 'cma' ? 'theme-analysis-card-selected' : ''}
          fromPopup={triggerCMAAnalysis || false} // Show buffer dialog only for popup-initiated CMA
          onCMADataChange={setCMAData}
          propertyParams={propertyParams || undefined}
        />

        {/* reportIQ - Hidden for now */}
        {/* <Card 
          className={`transition-all h-28 ${
            isProjectArea 
              ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:!bg-gray-800' 
              : workflowState.analysisType === 'comprehensive' 
                ? 'border-green-500 bg-green-50 dark:!bg-green-900/30 dark:!border-green-400 shadow-lg cursor-pointer' 
                : 'hover:shadow-lg dark:hover:bg-gray-800 cursor-pointer'
          }`}
          onClick={() => !workflowState.isProcessing && !isProjectArea && setWorkflowState((prev: any) => ({ ...prev, analysisType: 'comprehensive' }))}
        >
          <CardHeader className="py-2">
            <CardTitle className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Image 
                  src="/mpiq_pin2.png" 
                  alt="reportIQ" 
                  width={20} 
                  height={20}
                  className="h-5 w-5" 
                />
                <div className="flex text-sm font-bold">
                  <span className="firefly-accent-primary">report</span>
                  <span className="theme-text-primary -ml-px">IQ</span>
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-2">
            <p className={`text-xs ${isProjectArea ? 'theme-text-secondary' : 'text-muted-foreground'}`}>
              {isProjectArea ? 'Not available for all areas at once. Make a selection first' : 'Complete analysis with all available data and visualizations'}
            </p>
          </CardContent>
        </Card> */}
      </div>

      {/* Configuration Section - Only show when analysis type is selected AND not CMA (CMA has its own dialogs) */}
      {workflowState.analysisType && workflowState.analysisType !== 'cma' && (
        <Card className="flex-1 flex flex-col border-t-2 border-t-gray-200 dark:!border-t-gray-700">
          <CardHeader className="flex-shrink-0 !p-3 !pb-1">
            <CardTitle className="text-xs">Configure Analysis</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between space-y-3 !p-3 !pt-2">
            <div className="flex-1">
              {workflowState.analysisType === 'query' && (
                <div className="space-y-3 h-full">
                  <div className="flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-medium">Enter your query</label>
                      <div className="flex items-center gap-2">
                        <Dialog open={quickstartDialogOpen} onOpenChange={setQuickstartDialogOpen}>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-6 flex items-center gap-1"
                            >
                              <Sparkles className="h-3 w-3" />
                              Quick Start
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto theme-dialog">
                            <QueryDialog
                              onQuestionSelect={handlePredefinedQuerySelect}
                              title="quickstartIQ"
                              description="Choose from predefined demographic and analysis queries to get started quickly."
                              categories={ANALYSIS_CATEGORIES}
                              disabledCategories={{}} // All categories now enabled
                            />
                          </DialogContent>
                        </Dialog>
                        
                        {/* Persona Selector */}
                        <Dialog open={isPersonaDialogOpen} onOpenChange={setIsPersonaDialogOpen}>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-6 flex items-center gap-1"
                            >
                              {React.createElement(
                                PERSONA_ICON_MAP[selectedPersona] || UserCog,
                                { className: 'h-3 w-3' }
                              )}
                              <span className="truncate">
                                {personaMetadata.find(p => p.id === selectedPersona)?.name || 'Strategist'}
                              </span>
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-lg theme-dialog" aria-describedby="persona-dialog-description">
                            <DialogHeader>
                              <DialogTitle>Select AI Persona</DialogTitle>
                              <p id="persona-dialog-description" className="text-xs theme-text-secondary mt-2">
                                Choose an analytical perspective that matches your decision-making context.
                              </p>
                            </DialogHeader>
                            <div className="grid grid-cols-1 gap-3 mt-4">
                              {personaMetadata.map((persona) => (
                                <Button
                                  key={persona.id}
                                  variant={selectedPersona === persona.id ? 'default' : 'outline'}
                                  size="sm"
                                  className="flex items-start gap-3 p-4 h-auto text-left justify-start w-full whitespace-normal"
                                  onClick={() => {
                                    setSelectedPersona(persona.id);
                                    setIsPersonaDialogOpen(false);
                                  }}
                                >
                                  {React.createElement(
                                    PERSONA_ICON_MAP[persona.id] || UserCog,
                                    { className: 'h-4 w-4 flex-shrink-0 mt-0.5 text-[#33a852]' }
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className={`font-medium text-xs ${selectedPersona === persona.id ? 'text-white' : ''}`}>
                                      {persona.name}
                                    </div>
                                    <div className={`text-xs mt-1 leading-relaxed ${selectedPersona === persona.id ? 'text-white/80' : 'text-gray-600 dark:text-gray-400'}`}>
                                      {persona.description}
                                    </div>
                                  </div>
                                </Button>
                              ))}
                            </div>
                          </DialogContent>
                        </Dialog>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-6 flex items-center gap-1"
                          onClick={() => setAdvancedFilterDialogOpen(true)}
                        >
                          <Sliders className="h-3 w-3" />
                          {(() => {
                            const activeFilters = (clusterConfig.enabled ? 1 : 0);
                            if (activeFilters > 0) {
                              return `Filters (${activeFilters})`;
                            }
                            return 'Filters & Advanced';
                          })()}
                        </Button>
                        
                        <AdvancedFilterDialog
                          open={advancedFilterDialogOpen}
                          onOpenChange={setAdvancedFilterDialogOpen}
                          config={advancedFilterConfig}
                          onConfigChange={setAdvancedFilterConfig}
                          endpoint={selectedEndpoint}
                        />
                      </div>
                    </div>
                    <textarea
                      placeholder="Enter your natural language query..."
                      className="flex-1 w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg text-xs min-h-[120px] resize-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 focus:border-transparent"
                      value={selectedQuery}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSelectedQuery(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {workflowState.analysisType === 'infographic' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium mb-2">Select Report Template</label>
                    <Button
                      onClick={() => {
                        // Open report selection dialog when infographIQ is chosen
                        setInfographicsDialog((prev: any) => ({
                          ...prev,
                          open: true,
                          geometry: workflowState.areaSelection?.geometry || null,
                          selectedReport: null,
                          showInfographics: false
                        }));
                      }}
                      className="w-full bg-[#33a852] hover:bg-[#2d8f47] text-white"
                    >
                      Choose a Report Template
                    </Button>
                    {infographicsDialog.selectedReport && (
                      <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                        <span className="text-sm">Selected: {infographicsReports.find(r => r.id === infographicsDialog.selectedReport)?.title || 'Unknown'}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {workflowState.analysisType === 'comprehensive' && (
                <div className="space-y-4">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-xs text-green-800 font-medium mb-3">Complete Analysis Includes:</p>
                    <div className="grid grid-cols-2 gap-3 text-xs text-green-700">
                      <div>
                        <p className="font-medium">Demographics</p>
                        <p>Population, age, income distribution</p>
                      </div>
                      <div>
                        <p className="font-medium">Business Intelligence</p>
                        <p>Market analysis, competition data</p>
                      </div>
                      <div>
                        <p className="font-medium">Geographic Insights</p>
                        <p>Location scoring, accessibility</p>
                      </div>
                      <div>
                        <p className="font-medium">Economic Indicators</p>
                        <p>Growth trends, market potential</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action Button */}
            <div className="flex-shrink-0 pt-4">
              <Button
                data-execute-analysis
                onClick={() => {
                  if (workflowState.analysisType === 'infographic' && infographicsDialog.selectedReport) {
                    // Generate the infographic report
                    setInfographicsDialog((prev: any) => ({
                      ...prev,
                      showInfographics: true,
                      geometry: workflowState.areaSelection?.geometry || null
                    }));
                  } else if (workflowState.analysisType !== 'infographic') {
                    handleAnalysisTypeSelected(workflowState.analysisType!);
                  }
                }}
                className={`w-full h-12 ${
                  !workflowState.isProcessing &&
                  ((workflowState.analysisType === 'query' && selectedQuery.trim()) ||
                   (workflowState.analysisType === 'infographic' && infographicsDialog.selectedReport) ||
                   (workflowState.analysisType === 'comprehensive'))
                    ? 'firefly-glow-on-hover'
                    : ''
                }`}
                disabled={workflowState.isProcessing ||
                  (workflowState.analysisType === 'query' && !selectedQuery.trim()) ||
                  (workflowState.analysisType === 'infographic' && !infographicsDialog.selectedReport)}
              >
                {workflowState.isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : workflowState.analysisType === 'infographic' ? (
                  infographicsDialog.selectedReport ? 'Generate Report' : 'Select a Report First'
                ) : (
                  <>
                    Start Analysis
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {workflowState.error && (
        <Alert variant="destructive" className="flex-shrink-0">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{workflowState.error}</AlertDescription>
        </Alert>
      )}
      </div>
    );
  };

  // Render buffer step
  const renderBufferStep = () => {
    if (!workflowState.areaSelection) return null;

    const isPoint = (workflowState.areaSelection.geometry as any).type === 'point';

    return (
      <div className="flex-1 flex flex-col space-y-3">
        <Card className="flex-1 flex flex-col">
          <CardHeader className="flex-shrink-0 !p-3 !pb-1">
            <CardTitle className="text-xs">Add Buffer to Selected Area (Optional)</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Expand your analysis area by adding a buffer around the selected {isPoint ? 'point' : 'area'}.
            </p>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between space-y-3 py-3">
            <div className="space-y-3">
              <div className="space-y-4">
                <h4 className="text-xs font-medium">Buffer Type:</h4>
                <div className="grid grid-cols-3 gap-3">
                  <Card 
                    className={`cursor-pointer transition-all p-3 ${
                      bufferType === 'radius' 
                        ? 'border-green-500 bg-green-50 dark:!bg-green-900/30 dark:!border-green-400 shadow-md' 
                        : 'hover:shadow-md dark:hover:bg-gray-800'
                    }`}
                    onClick={() => {
                      setBufferType('radius');
                      setBufferUnit('kilometers'); // Reset to distance units
                    }}
                  >
                    <div className="text-center">
                      <Target className="h-5 w-5 mx-auto mb-1 text-green-500" />
                      <p className="text-xs font-medium">Radius</p>
                      <p className="text-xs text-muted-foreground">Fixed distance</p>
                    </div>
                  </Card>
                  <Card 
                    className={`cursor-pointer transition-all p-3 ${
                      bufferType === 'drivetime' 
                        ? 'border-green-500 bg-green-50 dark:!bg-green-900/30 dark:!border-green-400 shadow-md' 
                        : 'hover:shadow-md dark:hover:bg-gray-800'
                    }`}
                    onClick={() => {
                      setBufferType('drivetime');
                      setBufferUnit('minutes'); // Switch to time units
                    }}
                  >
                    <div className="text-center">
                      <Car className="h-5 w-5 mx-auto mb-1 text-green-500" />
                      <p className="text-xs font-medium">Drive Time</p>
                      <p className="text-xs text-muted-foreground">Travel by car</p>
                    </div>
                  </Card>
                  <Card 
                    className={`cursor-pointer transition-all p-3 ${
                      bufferType === 'walktime' 
                        ? 'border-green-500 bg-green-50 dark:!bg-green-900/30 dark:!border-green-400 shadow-md' 
                        : 'hover:shadow-md dark:hover:bg-gray-800'
                    }`}
                    onClick={() => {
                      setBufferType('walktime');
                      setBufferUnit('minutes'); // Switch to time units
                    }}
                  >
                    <div className="text-center">
                      <Walk className="h-5 w-5 mx-auto mb-1 text-green-500" />
                      <p className="text-xs font-medium">Walk Time</p>
                      <p className="text-xs text-muted-foreground">Travel on foot</p>
                    </div>
                  </Card>
                </div>

                {/* Buffer Configuration */}
                <div className="space-y-2 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        {bufferType === 'radius' ? 'Distance' : 'Time'}
                      </label>
                      <input
                        type="number"
                        className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        value={bufferDistance}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBufferDistance(e.target.value)}
                        min="0.1"
                        step={bufferType === 'radius' ? '0.1' : '1'}
                        placeholder={bufferType === 'radius' ? '1.0' : '5'}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Unit</label>
                      <select
                        className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        value={bufferUnit}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBufferUnit(e.target.value as 'kilometers' | 'minutes')}
                      >
                        {bufferType === 'radius' ? (
                          <>
                            <option value="kilometers">Kilometers</option>
                          </>
                        ) : (
                          <>
                            <option value="minutes">Minutes</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {bufferType === 'radius' && (
                      `Create a ${bufferDistance} ${bufferUnit} radius buffer around your point.`
                    )}
                    {bufferType === 'drivetime' && (
                      `Create a ${bufferDistance} minute driving area from your point.`
                    )}
                    {bufferType === 'walktime' && (
                      `Create a ${bufferDistance} minute walking area from your point.`
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 flex-shrink-0">
              <Button 
                variant="outline"
                className="flex-1 text-xs"
                onClick={() => handleBufferComplete(false)}
              >
                Skip Buffer
              </Button>
              <Button 
                className="flex-1 text-xs"
                onClick={() => handleBufferComplete(true)}
                disabled={!bufferDistance || parseFloat(bufferDistance) <= 0}
              >
                Apply Buffer
                <ChevronRight className="ml-2 h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Render results view
  const renderResults = () => {
    // Special handling for CMA - show CMA interface directly
    if (workflowState.analysisType === 'cma') {
      // Extract centroid coordinates from area selection for reverse geocoding
      // This enables address resolution on PDF cover page when no specific property/address is selected
      const centroid = workflowState.areaSelection?.metadata?.centroid as __esri.Point | undefined;
      const clickCoordinates = (centroid && typeof centroid.latitude === 'number' && typeof centroid.longitude === 'number') ? {
        lat: centroid.latitude,
        lng: centroid.longitude
      } : undefined;

      return (
        <div className="flex-1 min-h-0">
          <CMAInterface
            selectedArea={workflowState.areaSelection}
            propertyParams={propertyParams || undefined}
            bufferConfig={{
              type: 'radius',
              value: 1,
              unit: 'km'
            }}
            mapView={view}
            clickCoordinates={clickCoordinates}
          />
        </div>
      );
    }

    if (!workflowState.analysisResult) return null;

    const { analysisResult, metadata } = workflowState.analysisResult;

    return (
      <div className="flex flex-col h-full animate-entrance">
        {/* Results content with Analysis/Chat, Data Table, Insights, and Phase 4 Advanced Features */}
        <div className="flex-1 flex flex-col min-h-0">
          <Tabs value={activeResultsTab} onValueChange={setActiveResultsTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className={`grid w-full grid-cols-3 flex-shrink-0 theme-bg-primary border-b dark:border-gray-700 mb-2`}>
            {/* COMMENTED OUT: Advanced tab temporarily disabled for development pause */}
            {/* <TabsList className={`grid w-full ${hasPhase4Features ? 'grid-cols-4' : 'grid-cols-3'} flex-shrink-0 theme-bg-primary border-b dark:border-gray-700 mb-2`}> */}
              <TabsTrigger value="analysis" className="flex items-center gap-2 text-xs">
                <MessageCircle className="h-3 w-3" />
                Analysis
              </TabsTrigger>
              <TabsTrigger value="data" className="flex items-center gap-2 text-xs">
                <Table className="h-3 w-3" />
                Data
              </TabsTrigger>
              <TabsTrigger value="chart" className="flex items-center gap-2 text-xs">
                <BarChart className="h-3 w-3" />
                Chart
              </TabsTrigger>
              {/* COMMENTED OUT: Advanced tab temporarily disabled for development pause
              {hasPhase4Features && (
                <TabsTrigger value="advanced" className="flex items-center gap-2 text-xs">
                  <Zap className="h-3 w-3" />
                  Advanced
                </TabsTrigger>
              )}
              */}
            </TabsList>

            <TabsContent value="analysis" className="flex-1 min-h-0 max-h-[calc(100vh-200px)] overflow-hidden animate-entrance">
              {/* Analysis and Chat Interface */}
              <TooltipProvider delayDuration={300}>
                <ChatInterface 
                  analysisResult={workflowState.analysisResult}
                  persona={selectedPersona}
                  messages={chatMessages}
                  setMessages={setChatMessages}
                  onZipCodeClick={handleZipCodeClick}
                  hasGeneratedNarrative={hasGeneratedNarrative}
                  setHasGeneratedNarrative={setHasGeneratedNarrative}
                />
              </TooltipProvider>
            </TabsContent>

            <TabsContent value="data" className="flex-1 min-h-0 max-h-[calc(100vh-200px)] overflow-y-auto animate-entrance">
              {/* Data Table */}
              <UnifiedDataTable 
                analysisResult={analysisResult}
                onExport={() => handleExport('csv')}
              />
            </TabsContent>

            <TabsContent value="chart" className="flex-1 min-h-0 max-h-[calc(100vh-200px)] overflow-y-auto animate-entrance">
              {/* Feature Importance Chart */}
              <UnifiedInsightsChart 
                analysisResult={analysisResult}
                onExportChart={handleExportChart}
              />
            </TabsContent>

            {/* COMMENTED OUT: Advanced tab content temporarily disabled for development pause
            {hasPhase4Features && (
              <TabsContent value="advanced" className="flex-1 min-h-0 max-h-[calc(100vh-200px)] overflow-y-auto animate-entrance">
                <Phase4IntegrationWrapper
                  analysisResult={workflowState.analysisResult?.analysisResult}
                  analysisContext={{
                    selectedAreaName: workflowState.areaSelection?.displayName || '',
                    zipCodes: (workflowState.analysisResult?.metadata as any)?.spatialFilterIds || [],
                    endpoint: (workflowState.analysisResult?.metadata as any)?.endpoint || '',
                    query: (workflowState.analysisResult?.metadata as any)?.query || selectedQuery || '',
                    persona: selectedPersona,
                    fieldCount: workflowState.analysisResult?.analysisResult?.data?.records?.length || 0,
                    shapFeatures: workflowState.analysisResult?.analysisResult?.data?.featureImportance
                  }}
                  className="h-full"
                  onClose={() => setShowPhase4Features(false)}
                />
              </TabsContent>
            )}
            */}
          </Tabs>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col">
      <Card className="flex-1 flex flex-col min-h-0">
        <CardHeader className="flex-shrink-0 !p-3 !pb-1">
          <CardTitle className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Image 
                src="/mpiq_pin2.png" 
                alt="IQbuilder" 
                width={16} 
                height={16}
                className="h-4 w-4" 
              />
              <div className="flex text-sm font-bold">
                <span className="firefly-accent-primary">IQ</span>
                <span className="theme-text-primary -ml-px">builder</span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={resetWorkflow}
              className="text-xs h-7 flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              Start Over
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col py-3 min-h-0">
          {/* Step indicator */}
          <div className="flex-shrink-0 mb-3">
            {renderStepIndicator()}
          </div>

          {/* Loading indicator */}
          {workflowState.isProcessing && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                <span className="text-sm mb-4 block">Processing analysis...</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={stopAnalysis}
                  className="text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    Stop Analysis
                  </div>
                </Button>
              </div>
            </div>
          )}

          {/* Step content */}
          {!workflowState.isProcessing && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {workflowState.currentStep === 'area' && (
                <div className="flex-1">
                  <UnifiedAreaSelector
                    key={`area-selector-${resetCounter}`}
                    view={view}
                    onAreaSelected={handleAreaSelected}
                    defaultMethod="project"
                  />
                </div>
              )}

              {workflowState.currentStep === 'buffer' && (
                <div className="flex-1 flex flex-col">
                  {renderBufferStep()}
                </div>
              )}

              {workflowState.currentStep === 'analysis' && (
                <div className="flex-1 flex flex-col">
                  {renderAnalysisTypeSelection()}
                </div>
              )}

              {workflowState.currentStep === 'results' && (
                <div className="flex-1 min-h-0">
                  {renderResults()}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Infographics Report Selection Dialog */}
      {infographicsDialog.open && (
        <ReportSelectionDialog
          open={infographicsDialog.open}
          reports={infographicsReports}
          onClose={handleInfographicsDialogClose}
          onSelect={handleInfographicsReportSelect as any}
        />
      )}

      {/* Infographics Display */}
      {infographicsDialog.showInfographics && infographicsDialog.geometry && infographicsDialog.selectedReport && (
        <Dialog
          open={infographicsDialog.showInfographics}
          onOpenChange={(open) => {
            if (!open) {
              handleInfographicsComplete();
            }
          }}
        >
          <DialogContent className="max-w-7xl p-0 theme-dialog overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b theme-bg-primary theme-border">
              <DialogTitle className="text-base font-medium">Area Analysis Report</DialogTitle>
            </div>
            
            <div className="h-[calc(100vh-8rem)] overflow-y-scroll">
              <Infographics
                geometry={infographicsDialog.geometry}
                reportTemplate={infographicsDialog.selectedReport}
                onReportTemplateChange={(template) => {
                  setInfographicsDialog((prev: any) => ({
                    ...prev,
                    selectedReport: template
                  }));
                }}
                view={view}
                layerStates={{}}
                generateStandardReport={generateStandardReport}
                onExportPDF={() => {}}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
