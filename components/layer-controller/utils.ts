import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import GeoJSONLayer from '@arcgis/core/layers/GeoJSONLayer';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
import type { LayerConfig, ProjectLayerConfig } from '@/types/layers';
import type { LayerState, LayerStatesMap } from './types';
import { STANDARD_OPACITY } from '@/utils/renderer-standardization';

// Use the local types from LayerController
export interface LocalLayerState {
  layer: __esri.FeatureLayer | __esri.GeoJSONLayer | null;
  visible: boolean;
  loading: boolean;
  group: string;
  error?: string;
  filters: any[];
  name?: string;
  subGroup?: string;
  queryResults?: {
    features: any[];
    fields: any[];
  };
  active: boolean;
  isVirtual?: boolean;
  sourceLayerId?: string;
  rendererField?: string;
}

type LocalLayerStatesMap = { [key: string]: LocalLayerState };

interface PopupField {
  name: string;
  label: string;
}

const createLayer = async (
  layerConfig: LayerConfig,
  config: ProjectLayerConfig,
  view: __esri.MapView,
  layerStatesRef: React.MutableRefObject<LayerStatesMap>
): Promise<[FeatureLayer | GeoJSONLayer | null, any[]]> => {
  try {
    console.log('[LC createLayer] Starting layer creation for:', layerConfig.id);
    
    // Handle composite index layers specially
    if (layerConfig.type === 'client-side-composite') {
      console.log('[LC createLayer] Creating composite index layer:', layerConfig.id);
      
      try {
        // Import the CompositeIndexLayerService
        const { CompositeIndexLayerService } = await import('@/lib/services/CompositeIndexLayerService');
        
        // Get a reference housing layer for geometry (first available housing layer)
        const housingLayer = view.map.layers.find((l: any) => 
          l.title?.includes('Tenure') || l.title?.includes('Housing')
        ) as __esri.FeatureLayer;
        
        if (!housingLayer) {
          console.error('[LC createLayer] No base housing layer found for composite index');
          return [null, ['No base housing layer available for composite index']];
        }
        
        // Create the service and generate the layer
        const service = new CompositeIndexLayerService(housingLayer);
        let compositeLayer: __esri.FeatureLayer | null = null;
        
        // Create specific composite index based on URL
        if (layerConfig.url.includes('HOT_GROWTH_INDEX')) {
          compositeLayer = await service.createCompositeIndexLayer('HOT_GROWTH_INDEX', 'Hot Growth Index');
        } else if (layerConfig.url.includes('NEW_HOMEOWNER_INDEX')) {
          compositeLayer = await service.createCompositeIndexLayer('NEW_HOMEOWNER_INDEX', 'New Homeowner Index');
        } else if (layerConfig.url.includes('HOUSING_AFFORDABILITY_INDEX')) {
          compositeLayer = await service.createCompositeIndexLayer('HOUSING_AFFORDABILITY_INDEX', 'Affordability Index');
        }
        
        if (compositeLayer) {
          // Configure layer properties
          compositeLayer.title = layerConfig.name;
          compositeLayer.id = layerConfig.id;
          compositeLayer.visible = false;
          compositeLayer.popupEnabled = false;
          
          // Apply skipLayerList property for composite layers
          if (layerConfig.skipLayerList) {
            (compositeLayer as any).listMode = "hide";
            console.log(`Composite layer ${layerConfig.name} will be hidden from layer list`);
          }
          
          console.log(`✅ Composite index layer created: ${layerConfig.id}`);
          return [compositeLayer, []];
        } else {
          return [null, ['Failed to create composite index layer']];
        }
      } catch (error) {
        console.error('[LC createLayer] Error creating composite index layer:', error);
        return [null, [error instanceof Error ? error.message : 'Composite index creation failed']];
      }
    }
    
    // Handle GeoJSON layers
    if (layerConfig.type === 'geojson') {
      console.log(`[LC createLayer] Creating GeoJSON layer: ${layerConfig.id}`);
      
      try {
        // Add timeout promise (2 minutes for large GeoJSON files)
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('GeoJSON layer load timeout (120s)')), 120000);
        });

        const layer = new GeoJSONLayer({
          url: layerConfig.url,
          title: layerConfig.name,
          id: layerConfig.id,
          visible: false,
          popupEnabled: false,
          outFields: ['*'],
          // Add copyright to avoid issues
          copyright: 'Real Estate Data'
        });

        // Apply definition expression if provided
        if (layerConfig.definitionExpression) {
          layer.definitionExpression = layerConfig.definitionExpression;
          console.log(`[LC createLayer] Applied definition expression: ${layerConfig.definitionExpression}`);
        }

        // Apply custom renderer for Properties layers
        if (layerConfig.group === 'properties') {
          layer.renderer = createPropertiesRenderer(layerConfig.id);
          const isActive = layerConfig.id.includes('active');
          console.log(`[LC createLayer] Applied ${isActive ? 'green (Active)' : 'red (Sold)'} renderer to Properties layer: ${layerConfig.id}`);
        }

        // Race between layer load and timeout
        await Promise.race([layer.load(), timeoutPromise]);
        console.log(`[LC createLayer] GeoJSON layer loaded: ${layerConfig.id}`);

        // Apply skipLayerList property
        if (layerConfig.skipLayerList) {
          (layer as any).listMode = "hide";
          console.log(`GeoJSON layer ${layerConfig.name} will be hidden from layer list`);
        }

        console.log(`✅ GeoJSON layer created: ${layerConfig.id}`);
        return [layer, []];
      } catch (loadError) {
        console.error(`[LC createLayer] GeoJSON layer ${layerConfig.id} failed to load:`, loadError);
        return [null, [loadError instanceof Error ? loadError.message : 'GeoJSON load error']];
      }
    }
    
    // Regular feature service layer creation
    // Add timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Layer load timeout')), 30000); // 30 second timeout
    });

    const layer = new FeatureLayer({
      url: layerConfig.url,
      outFields: ['*'],
      title: layerConfig.name,
      id: layerConfig.id,
      visible: false,
      popupEnabled: false // Disable ArcGIS popups so CustomPopupManager can handle them
    });

    // Race between layer load and timeout
    try {
      await Promise.race([layer.load(), timeoutPromise]);
      console.log(`[LC createLayer] Layer loaded: ${layerConfig.id}`);
    } catch (loadError) {
      console.error(`[LC createLayer] Layer ${layerConfig.id} failed to load:`, loadError);
      return [null, [loadError instanceof Error ? loadError.message : 'Unknown load error']];
    }

    // Apply skipLayerList property to hide layers from the layer list widget if specified
    if (layerConfig.skipLayerList) {
      (layer as any).listMode = "hide";
      console.log(`Layer ${layerConfig.name} will be hidden from layer list`);
    }
    
    // Note: Popups will be handled by CustomPopupManager component (green popup style)
    console.log(`✅ Layer created for CustomPopupManager handling: ${layerConfig.id}`);
    
    if (layer.fields) {
      console.log(`[LC createLayer] Available fields for ${layerConfig.id}:`, layer.fields.map(f => f.name));
    }

    // Check for renderer field existence
    if (layerConfig.rendererField && !layer.fields?.find(f => f.name === layerConfig.rendererField)) {
      console.error(`[LC createLayer] Renderer field '${layerConfig.rendererField}' not found in layer '${layerConfig.id}'. Available fields:`, layer.fields?.map(f => f.name));
      return [null, [`Renderer field '${layerConfig.rendererField}' not found`]];
    }

    // **NEW: Apply quartile renderer for layers with rendererField**
    if (layerConfig.rendererField) {
      console.log(`[LC createLayer] ✨ Applying quartile renderer to layer: ${layerConfig.id}, field: ${layerConfig.rendererField}`);
      console.log(`[LC createLayer] 🔍 Layer config details:`, {
        id: layerConfig.id,
        name: layerConfig.name,
        rendererField: layerConfig.rendererField,
        type: layerConfig.type,
        group: layerConfig.group
      });
      
      try {
        const { createQuartileRenderer } = await import('@/utils/createQuartileRenderer');
        const rendererResult = await createQuartileRenderer({
          layer: layer,
          field: layerConfig.rendererField,
          isCurrency: layerConfig.type === 'amount',
          isCompositeIndex: layerConfig.type === 'index',
          opacity: STANDARD_OPACITY,
          outlineWidth: 0.5,
          outlineColor: [128, 128, 128]
        });
        
        if (rendererResult?.renderer) {
          layer.renderer = rendererResult.renderer;
          console.log(`✅ Successfully applied quartile renderer to layer: ${layerConfig.id}`);
          console.log(`🎨 Renderer details:`, {
            type: rendererResult.renderer.type,
            field: rendererResult.renderer.field,
            classBreakInfos: rendererResult.renderer.classBreakInfos?.length || 0,
            // More detailed logging
            hasDefaultSymbol: !!rendererResult.renderer.defaultSymbol,
            classBreakDetails: rendererResult.renderer.classBreakInfos?.map(cb => ({
              minValue: cb.minValue,
              maxValue: cb.maxValue,
              label: cb.label,
              hasSymbol: !!cb.symbol,
              // Log symbol details for debugging
              symbolType: cb.symbol?.type,
              symbolColor: cb.symbol?.color,
              symbolOutline: cb.symbol && 'outline' in cb.symbol ? cb.symbol.outline : undefined
            })) || []
          });
          
          // Log the full class breaks for debugging (specifically for problematic layers)
          if (layerConfig.name?.includes('Google Pay')) {
            console.log(`🔍 [GOOGLE PAY DEBUG] Full class break details:`, 
              rendererResult.renderer.classBreakInfos?.map((cb, index) => ({
                quartile: index + 1,
                minValue: cb.minValue,
                maxValue: cb.maxValue,
                label: cb.label,
                color: cb.symbol?.color,
                outline: cb.symbol && 'outline' in cb.symbol ? cb.symbol.outline : undefined
              }))
            );
          }
          
          // Also log that the renderer has been set on the layer
          console.log(`🗺️ Layer renderer set:`, {
            layerId: layerConfig.id,
            layerName: layerConfig.name,
            rendererType: layer.renderer?.type,
            rendererField: (layer.renderer as any)?.field,
            // Special check for Google Pay layer
            isGooglePayLayer: layerConfig.name?.includes('Google Pay'),
            layerVisible: layer.visible,
            layerOpacity: layer.opacity
          });
          
          // Extra debugging for Google Pay layer specifically
          if (layerConfig.name?.includes('Google Pay')) {
            console.log(`🔍 [GOOGLE PAY DEBUG] Detailed renderer info:`, {
              hasRenderer: !!layer.renderer,
              rendererConstructor: layer.renderer?.constructor.name,
              classBreakCount: (layer.renderer as any)?.classBreakInfos?.length,
              firstBreak: (layer.renderer as any)?.classBreakInfos?.[0],
              defaultSymbol: (layer.renderer as any)?.defaultSymbol,
              field: (layer.renderer as any)?.field,
              layerLoaded: layer.loaded,
              layerMinScale: layer.minScale,
              layerMaxScale: layer.maxScale
            });
            
            // Check if the quartile breaks are actually meaningful
            const classBreaks = (layer.renderer as any)?.classBreakInfos;
            if (classBreaks && classBreaks.length > 0) {
              console.log(`🔍 [GOOGLE PAY DEBUG] Full quartile analysis:`, {
                quartileCount: classBreaks.length,
                quartiles: classBreaks.map((cb: any, i: number) => ({
                  quartile: i + 1,
                  range: `${cb.minValue} - ${cb.maxValue}`,
                  width: cb.maxValue - cb.minValue,
                  symbolColor: cb.symbol?.color,
                  label: cb.label
                })),
                minRange: Math.min(...classBreaks.map((cb: any) => cb.maxValue - cb.minValue)),
                maxRange: Math.max(...classBreaks.map((cb: any) => cb.maxValue - cb.minValue))
              });
              
              // Check if ranges are too narrow to be meaningful
              const minWidth = Math.min(...classBreaks.map((cb: any) => cb.maxValue - cb.minValue));
              if (minWidth < 0.01) {
                console.warn(`🔍 [GOOGLE PAY DEBUG] WARNING: Quartile ranges are extremely narrow (min: ${minWidth}), this may cause rendering issues`);
              }
            }
          }
        } else {
          console.warn(`⚠️ No renderer returned for layer: ${layerConfig.id}, using default styling`);
          console.warn(`🔍 Renderer result:`, rendererResult);
        }
      } catch (rendererError) {
        console.error(`❌ Error creating quartile renderer for layer ${layerConfig.id}:`, rendererError);
        // Layer will use default renderer
      }
    } else {
      console.log(`[LC createLayer] No rendererField specified for layer: ${layerConfig.id}, using default styling`);
      
      // Special handling for point location layers to ensure they're visible
      if (layerConfig.name?.toLowerCase().includes('locations') || 
          layerConfig.name?.toLowerCase().includes('points')) {
        console.log(`[LC createLayer] 📍 Setting up simple renderer for location layer: ${layerConfig.id}`);
        
        try {
          if (layer.geometryType === 'point') {
            // Import renderer classes
            const SimpleMarkerSymbol = await import('@arcgis/core/symbols/SimpleMarkerSymbol');
            const SimpleRenderer = await import('@arcgis/core/renderers/SimpleRenderer');
            
            const symbol = new SimpleMarkerSymbol.default({
              style: 'square', // Changed to square
              color: [0, 172, 78, 1], // Green color #00AC4E
              size: 10, // Good visibility size
              outline: {
                color: [255, 255, 255, 1], // White border
                width: 1
              }
            });
            
            layer.renderer = new SimpleRenderer.default({
              symbol: symbol
            });
            
            // Set full opacity and remove any scale dependencies
            layer.opacity = 1.0;
            layer.minScale = 0; // Visible at all zoom levels
            layer.maxScale = 0; // Visible at all zoom levels
            
            console.log(`✅ Applied green square renderer to location layer: ${layerConfig.id}`, {
              geometryType: layer.geometryType,
              renderer: layer.renderer,
              opacity: layer.opacity,
              minScale: layer.minScale,
              maxScale: layer.maxScale,
              featureCount: await layer.queryFeatureCount()
            });
          } else {
            console.warn(`⚠️ Location layer ${layerConfig.id} is not a point layer, geometry type: ${layer.geometryType}`);
          }
        } catch (rendererError) {
          console.error(`❌ Error setting up location renderer for ${layerConfig.id}:`, rendererError);
        }
      }
    }

    return [layer, []];
  } catch (error) {
    console.error('[LC createLayer] Error creating/loading layer:', layerConfig.id, error);
    // Clean up any partially loaded layer
    if (error instanceof Error && error.message === 'Layer load timeout') {
      console.error(`[LC createLayer] Layer ${layerConfig.id} failed to load within timeout period`);
    }
    return [null, [error instanceof Error ? error.message : 'Unknown error']];
  }
};

/**
 * Creates a renderer for Properties layers with appropriate colors
 */
function createPropertiesRenderer(layerId: string): SimpleRenderer {
  // Determine if this is Active or Sold based on layer ID
  const isActiveLayer = layerId.includes('active');
  
  const symbol = new SimpleMarkerSymbol({
    style: 'circle',
    color: isActiveLayer ? [34, 197, 94, 0.8] : [239, 68, 68, 0.8], // Green for Active, Red for Sold
    size: 8,
    outline: {
      color: [255, 255, 255, 0.9],
      width: 2
    }
  });

  return new SimpleRenderer({
    symbol: symbol
  });
}

export { createLayer };
// Do not export LocalLayerState or LocalLayerStatesMap from this file 