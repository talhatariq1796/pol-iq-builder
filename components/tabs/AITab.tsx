/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState } from 'react';
// import { motion, AnimatePresence } from 'framer-motion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from "@/components/ui/progress";
import { Loader2, AlertCircle } from 'lucide-react';
import { EnhancedGeospatialChat } from '../geospatial-chat-interface';
import type { LayerState } from '@/components/ResizableSidebar';
import type { LegendItem } from '../geospatial-chat-interface';
import type { ChatVisualizationResult } from '@/lib/analytics/types';
import { SchemaProvider } from '../../lib/analytics/schema';

interface ErrorState {
  type: 'system' | 'user';
  message: string;
  timestamp: number;
  recoverable: boolean;
  details?: unknown;
}

interface LoadingState {
  status: 'idle' | 'loading' | 'error';
  message?: string;
  progress?: number;
}

interface AITabProps {
  view: __esri.MapView;
  layerStates: { [key: string]: LayerState };
  onLayerStateChange: (layerId: string, state: LayerState) => void;
  setFormattedLegendData: React.Dispatch<React.SetStateAction<LegendItem[] | null>>;
  setVisualizationResult: React.Dispatch<React.SetStateAction<ChatVisualizationResult | null>>;
  mapViewRefValue?: __esri.MapView | null;
  onVisualizationCreated?: () => void; // Add callback for visualization creation
}

const AITab: React.FC<AITabProps> = ({ 
  view,
  layerStates,
  setFormattedLegendData,
  setVisualizationResult,
  mapViewRefValue,
  onVisualizationCreated
}) => {
  console.log('[AITab] Render, view prop:', view, 'view?.map:', view?.map, 'mapViewRefValue:', mapViewRefValue, 'mapViewRefValue?.map:', mapViewRefValue?.map);

  // State management
  const [error, setError] = useState<ErrorState | null>(null);
  const [loadingStates, setLoadingStates] = useState<Record<string, LoadingState>>({});

  // Get the first available layer from layerStates (optional for chat)
  const firstLayer = Object.values(layerStates).find(state => state.layer);
  
  // Helper function to extract layer number from layerId
  const extractLayerNumber = (layerId: string): string | null => {
    // Extract number from patterns like 'Synapse54_Vetements_layers_layer_10'
    const match = layerId.match(/_layer_(\d+)$/);
    return match ? match[1] : null;
  };
  
  // Helper function to construct complete service URL
  const constructServiceUrl = (baseUrl: string, layerId: string): string => {
    const layerNumber = extractLayerNumber(layerId);
    if (!layerNumber) {
      console.warn('[AITab] Could not extract layer number from layerId:', layerId);
      return baseUrl;
    }
    
    // Ensure the base URL ends with /FeatureServer
    const cleanBaseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    if (cleanBaseUrl.endsWith('/FeatureServer')) {
      return `${cleanBaseUrl}/${layerNumber}`;
    } else {
      return `${cleanBaseUrl}/FeatureServer/${layerNumber}`;
    }
  };
  
  // Use a default geographic base layer if no layer is available
  // This should be a layer that contains the base geographic shapes (FSAs, ZIP codes, etc.)
  const defaultGeographicLayer = {
    serviceUrl: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Vetements_layers/FeatureServer/39', // Nike layer as default
    layerId: 'Synapse54_Vetements_layers_layer_39'
  };
  
  const dataSource = firstLayer?.layer && firstLayer.layer.url && firstLayer.layer.id ? {
    serviceUrl: constructServiceUrl(firstLayer.layer.url, firstLayer.layer.id),
    layerId: firstLayer.layer.id
  } : defaultGeographicLayer;
  
  console.log('[AITab] DataSource configuration:', {
    hasFirstLayer: !!firstLayer,
    firstLayerUrl: firstLayer?.layer?.url,
    firstLayerId: firstLayer?.layer?.id,
    extractedLayerNumber: firstLayer?.layer?.id ? extractLayerNumber(firstLayer.layer.id) : null,
    constructedServiceUrl: (firstLayer?.layer?.url && firstLayer?.layer?.id) ? constructServiceUrl(firstLayer.layer.url, firstLayer.layer.id) : null,
    usingDefault: !(firstLayer?.layer && firstLayer.layer.url && firstLayer.layer.id),
    finalDataSource: dataSource
  });

  return (
    <div className="h-full flex flex-col">
      {/* Error Alert */}
      {/* <AnimatePresence> */}
        {error && (
          // <motion.div
          //   initial={{ opacity: 0, y: -20 }}
          //   animate={{ opacity: 1, y: 0 }}
          //   exit={{ opacity: 0, y: -20 }}
          //   className="p-4"
          // >
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          // </motion.div>
        )}
      {/* </AnimatePresence> */}

      {/* Loading States */}
      {Object.entries(loadingStates).map(([id, state]) => (
        state.status === 'loading' && (
          <div key={id} className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm theme-text-secondary">{state.message || 'Loading...'}</span>
            </div>
            {state.progress !== undefined && (
              <Progress value={state.progress} className="h-1" />
            )}
          </div>
        )
      ))}

      {/* Chat Interface */}
      <div className="flex-1 overflow-hidden">
        <SchemaProvider>
        <EnhancedGeospatialChat
          agentType="geospatial"
          dataSource={dataSource}
          onFeaturesFound={(features: any[]) => {
            // Handle features found
            console.log('Features found:', features.length);
          }}
          onError={(error: Error) => {
            setError({
              type: 'system',
              message: error.message,
              timestamp: Date.now(),
              recoverable: true
            });
          }}
          onVisualizationLayerCreated={(layer: __esri.FeatureLayer | null, shouldReplace?: boolean) => {
            // Handle visualization layer created
            console.log('Visualization layer created:', layer?.id);
            
            // CRITICAL FIX: Actually add the layer to the map
            if (layer && view?.map) {
              console.log('[AITab] Adding visualization layer to map:', {
                layerId: layer.id,
                title: layer.title,
                visible: layer.visible,
                opacity: layer.opacity,
                featureCount: (layer.source as any)?.length || 'unknown'
              });
              
              // Remove any existing visualization layers first if shouldReplace is true - but not during theme switches
              if (shouldReplace) {
                const isThemeSwitch = document.documentElement.hasAttribute('data-theme-switching') || 
                                     window.__themeTransitioning === true;
                
                if (!isThemeSwitch) {
                  const existingLayers = view.map.layers.filter((l: any) => 
                    l.type === 'feature' && l.title?.includes('Correlation')
                  ).toArray();
                  
                  existingLayers.forEach((existingLayer: any) => {
                    console.log('[AITab] Removing existing visualization layer:', existingLayer.id);
                    view.map.remove(existingLayer);
                  });
                } else {
                  console.log('[AITab] 🎨 Theme switching - preserving existing correlation layers');
                }
              }
              
              // Add the new layer to the map
              view.map.add(layer);
              
              // Ensure layer is visible and opaque
              layer.visible = true;
              layer.opacity = 0.8;
              
              // Verify layer was added and notify after a short delay to ensure it's fully integrated
              setTimeout(async () => {
                const addedLayer = view.map.findLayerById(layer.id) as __esri.FeatureLayer;
                console.log('[AITab] Layer verification after add:', {
                  layerFound: !!addedLayer,
                  layerId: addedLayer?.id,
                  visible: addedLayer?.visible,
                  opacity: addedLayer?.opacity,
                  loaded: addedLayer?.loaded,
                  popupEnabled: addedLayer?.popupEnabled,
                  inMapLayerCount: view.map.layers.length
                });
                
                if (addedLayer) {
                  // Ensure layer is loaded
                  if (!addedLayer.loaded) {
                    console.log('[AITab] Waiting for layer to load...');
                    await addedLayer.load();
                    console.log('[AITab] Layer loaded successfully');
                  }
                  
                  if (!addedLayer.visible) {
                    console.log('[AITab] Force-setting layer visibility');
                    addedLayer.visible = true;
                    addedLayer.opacity = 0.8;
                  }
                }
                
                // Notify that visualization is created AFTER layer is confirmed loaded
                // This ensures CustomPopupManager will see the fully ready layer
                console.log('[AITab] Notifying visualization created for CustomPopupManager integration');
                onVisualizationCreated?.();
              }, 100);
            } else {
              console.warn('[AITab] Cannot add layer - missing layer or view.map:', {
                hasLayer: !!layer,
                hasView: !!view,
                hasMap: !!view?.map
              });
            }
          }}
          mapView={view}
          mapViewRefValue={mapViewRefValue}
          setFormattedLegendData={setFormattedLegendData as React.Dispatch<React.SetStateAction<LegendItem[] | null>>}
          setVisualizationResult={setVisualizationResult as React.Dispatch<React.SetStateAction<ChatVisualizationResult | null>>}
        />
        </SchemaProvider>
      </div>
    </div>
  );
};

export default AITab;