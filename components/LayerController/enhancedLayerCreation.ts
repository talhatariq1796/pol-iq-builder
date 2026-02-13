// src/components/LayerController/enhancedLayerCreation.ts

import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import SimpleRenderer from "@arcgis/core/renderers/SimpleRenderer";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import Color from "@arcgis/core/Color";
import Font from "@arcgis/core/symbols/Font";
import TextSymbol from "@arcgis/core/symbols/TextSymbol";
import PopupTemplate from "@arcgis/core/PopupTemplate";
import { createQuartileRenderer } from '@/utils/createQuartileRenderer';
import { createPopupTemplate } from './createPopupTemplate';
import { createEnhancedPopupTemplate } from '../map/enhancedPopupTemplate';
import { 
  LayerConfig, 
  LayerGroup,
  PointLayerConfig, 
  IndexLayerConfig, 
  ExtendedLayerConfig 
} from '../../types/layers';
import LabelClass from "@arcgis/core/layers/support/LabelClass";
import UniqueValueRenderer from "@arcgis/core/renderers/UniqueValueRenderer";
import { getDefaultLayerRenderer, createRenderer } from './layerRenderers';
import ClassBreaksRenderer from "@arcgis/core/renderers/ClassBreaksRenderer";

// Enhanced styling removed for performance - using simple quartile renderer instead

// Add type declaration for custom properties
interface CustomFeatureLayer extends __esri.FeatureLayer {
  geographicType: string;
  geographicLevel: string;
}

// Enhanced styling removed for performance

// Type guard functions
function isPointLayer(layer: LayerConfig): layer is PointLayerConfig & ExtendedLayerConfig {
  return layer.type === 'point';
}

function isIndexLayer(layer: LayerConfig): layer is IndexLayerConfig & ExtendedLayerConfig {
  return layer.type === 'index';
}

// Enhanced styling functions removed for performance

/**
 * Creates a feature layer with enhanced popups from layer configuration
 * @param layerConfig The layer configuration
 * @param layerGroups All layer groups for related data in popups
 * @param view The map view
 * @param layerStates The layer states
 * @returns Promise resolving to the created layer and its features
 */
export async function createEnhancedLayer(
  layerConfig: LayerConfig,
  layerGroups: LayerGroup[],
  view: __esri.MapView,
  layerStates: { [key: string]: { layer: __esri.FeatureLayer | null } }
): Promise<[__esri.FeatureLayer | null, __esri.Graphic[]]> {
  try {
    // Enhanced styling removed for performance

    // Create the base feature layer
    const layer = new FeatureLayer({
      url: layerConfig.url,
      title: layerConfig.name,
      id: layerConfig.id,
      outFields: ["*"],
      popupEnabled: true,
      visible: false,
      opacity: isPointLayer(layerConfig) && layerConfig.symbolConfig?.opacity 
        ? layerConfig.symbolConfig.opacity 
        : 0.7,
      definitionExpression: layerConfig.definitionExpression || "1=1"
    }) as CustomFeatureLayer;

    // Add custom properties
    layer.geographicType = layerConfig.geographicType || 'census';
    layer.geographicLevel = layerConfig.geographicLevel || 'census';
    
    // Transfer additional properties
    if (layerConfig.isPrimary) {
      (layer as any).isPrimary = true;
      console.log(`Set layer ${layerConfig.name} as primary layer`);
    }
    
    // Apply skipLayerList property if specified - IMPORTANT for fixing the layer list visibility issue
    if (layerConfig.skipLayerList) {
      (layer as any).listMode = "hide"; // This is the proper ArcGIS JS API property to hide from layer list
      console.log(`Layer ${layerConfig.name} will be excluded from the layer list widget using listMode=hide`);
    }

    try {
      // Load the layer to access its properties
      await layer.load();
    } catch (loadError) {
      console.warn(`Error loading layer ${layerConfig.name}, creating mock layer instead:`, loadError);
      return createMockLayer(layerConfig, layerGroups, view, layerStates);
    }

    // Log layer fields and configuration
    console.log('Layer configuration:', {
      layerName: layerConfig.name,
      layerId: layerConfig.id,
      rendererField: layerConfig.rendererField,
      fields: layer.fields?.map(f => ({
        name: f.name,
        type: f.type,
        alias: f.alias
      })),
      geographicType: layerConfig.geographicType,
      geographicLevel: layerConfig.geographicLevel,
      layerProperties: {
        visible: layer.visible,
        opacity: layer.opacity,
        listMode: layer.listMode,
        type: layer.type,
        geometryType: layer.geometryType
      }
    });

    // Apply simple default renderer without loading features for performance
    if (isPointLayer(layerConfig)) {
      // Point layer styling
      const pointConfig = layerConfig as PointLayerConfig;
      layer.renderer = new SimpleRenderer({
        symbol: new SimpleMarkerSymbol({
          size: pointConfig.symbolConfig?.size || 8,
          color: pointConfig.symbolConfig?.color,
          outline: pointConfig.symbolConfig?.outline ? {
            color: pointConfig.symbolConfig.outline.color,
            width: pointConfig.symbolConfig.outline.width
          } : undefined
        })
      });
    } else {
      // Use simple default renderer from layerRenderers.ts
      layer.renderer = getDefaultLayerRenderer(
        ["point", "index", "demographic", "percentage", "feature-service"].includes(layerConfig.type)
          ? (layerConfig.type as "point" | "index" | "demographic" | "percentage" | "feature-service")
          : "index",
        layerConfig.rendererField || 'thematic_value',
        layerConfig.name // Pass layer name for point color selection
      );
    }
    console.log(`✅ Simple renderer applied to ${layerConfig.name}`);

    // Enhanced styling removed for performance - using simple quartile renderer instead

    // Skip feature loading for performance - load on demand only when layer is made visible
    console.log(`✅ Layer created without loading features: ${layerConfig.name}`);

    // Apply popup template using exact same approach as AI layers
    try {
      // Get available fields from the layer
      const availableFields = layer.fields?.map(f => f.name) || [];
      console.log(`[Popup Debug] Available fields for ${layerConfig.name}:`, availableFields);
      
      // Use same default fields as AI layers, but check if they exist
      let popupFields: string[] = [];
      if (layerConfig.rendererField && availableFields.includes(layerConfig.rendererField)) {
        popupFields.push(layerConfig.rendererField);
      }
      
      // Add common fields if they exist
      const commonFields = ['area_name', 'NAME', 'name', 'Name', 'value', 'thematic_value'];
      commonFields.forEach(field => {
        if (availableFields.includes(field) && !popupFields.includes(field)) {
          popupFields.push(field);
        }
      });
      
      // If no fields found, use first few available fields
      if (popupFields.length === 0) {
        popupFields = availableFields.slice(0, 3);
      }
      
      console.log(`[Popup Debug] Selected popup fields for ${layerConfig.name}:`, popupFields);
      
      // Create field infos using same formatting as AI layers
      const fieldInfos = popupFields.map(field => ({
        fieldName: field,
        label: field
          .replace(/_/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase()),
        format: field.includes('value') || field.includes('score') ? 
          { places: 2, digitSeparator: true } : 
          (field.includes('percent') || field.includes('rate') ? 
            { places: 1, digitSeparator: true } : null)
      }));

      // Find a good title field
      const titleField = popupFields.find(f => ['area_name', 'NAME', 'name', 'Name'].includes(f)) || popupFields[0] || 'OBJECTID';

      // Create popup template with exact same structure as AI layers
      layer.popupTemplate = new PopupTemplate({
        title: `{${titleField}}`,
        content: [
          {
            type: 'fields',
            fieldInfos
          }
        ]
      });
      
      console.log(`✅ AI-style popup template created for ${layerConfig.name} with title field: ${titleField}`);
    } catch (popupError) {
      console.warn(`❌ Popup template creation failed for ${layerConfig.name}:`, popupError);
      // Fallback to basic popup template
      layer.popupTemplate = new PopupTemplate({
        title: layerConfig.name,
        content: [
          {
            type: "fields",
            fieldInfos: layer.fields?.slice(0, 5).map(field => ({
              fieldName: field.name,
              label: field.alias || field.name,
              format: field.type === 'double' || field.type === 'single' ? {
                places: 2,
                digitSeparator: true
              } : undefined
            })) || []
          }
        ]
      });
    }
    // Enable popups for CustomPopupManager to handle them
    layer.popupEnabled = true; // Enable for CustomPopupManager

    return [layer, []]; // No features loaded - load on demand only

  } catch (error) {
    console.error(`Failed to load layer ${layerConfig.name}:`, error);
    // Try to create a mock layer as fallback
    return createMockLayer(layerConfig, layerGroups, view, layerStates);
  }
}

/**
 * Creates a mock feature layer with sample data
 * @param layerConfig The layer configuration
 * @param layerGroups All layer groups for related data in popups
 * @param view The map view
 * @param layerStates The layer states
 * @returns Promise resolving to the created layer and its features
 */
async function createMockLayer(
  layerConfig: LayerConfig,
  layerGroups: LayerGroup[],
  view: __esri.MapView,
  layerStates: { [key: string]: { layer: __esri.FeatureLayer | null } }
): Promise<[__esri.FeatureLayer | null, __esri.Graphic[]]> {
  try {
    console.log(`Creating mock layer for ${layerConfig.name} (${layerConfig.id})`);

    // Create feature layer with local source
    const layer = new FeatureLayer({
      title: layerConfig.name + " (Mock)",
      id: layerConfig.id,
      source: [], // Empty source initially
      objectIdField: "OBJECTID",
      fields: [
        {
          name: "OBJECTID",
          type: "oid"
        },
        {
          name: "thematic_value",
          type: "double"
        },
        {
          name: "NAME",
          type: "string"
        }
      ],
      renderer: getDefaultLayerRenderer(
        // Only allow supported types, fallback to "index"
        ["point", "index", "demographic", "percentage", "feature-service"].includes(layerConfig.type)
          ? (layerConfig.type as "point" | "index" | "demographic" | "percentage" | "feature-service")
          : "index",
        'thematic_value',
        layerConfig.name // Pass layer name for point color selection
      ),
      popupEnabled: true,
      visible: false,
      opacity: 0.7
    }) as CustomFeatureLayer;

    // Add custom properties
    layer.geographicType = layerConfig.geographicType || 'census';
    layer.geographicLevel = layerConfig.geographicLevel || 'census';
    
    // Apply skipLayerList property to mock layers as well
    if (layerConfig.skipLayerList) {
      (layer as any).listMode = "hide";
    }

    // Apply enhanced popup template
    layer.popupTemplate = new PopupTemplate({
      title: "{NAME}",
      content: [
        {
          type: "fields",
          fieldInfos: [
            {
              fieldName: "thematic_value",
              label: "Value",
              format: {
                places: 2,
                digitSeparator: true
              }
            }
          ]
        }
      ]
    });

    return [layer, []];
  } catch (error) {
    console.error(`Failed to create mock layer for ${layerConfig.name}:`, error);
    return [null, []];
  }
}

/**
 * Updates an existing layer with enhanced popup template
 * @param layer The feature layer to update
 * @param layerConfig The layer configuration
 * @param layerGroups All layer groups for related data in popups
 * @param view The map view
 * @param layerStates The layer states
 */
export function enhanceExistingLayer(
  layer: __esri.FeatureLayer,
  layerConfig: LayerConfig,
  layerGroups: LayerGroup[],
  view: __esri.MapView,
  layerStates: { [key: string]: { layer: __esri.FeatureLayer | null } }
): void {
  try {
    // Apply enhanced popup template
    layer.popupTemplate = createPopupTemplate(layerConfig, layerGroups);
    
    // Ensure popup is enabled
    if (!layer.popupEnabled) {
      layer.popupEnabled = true;
    }
  } catch (error) {
    console.error(`Failed to enhance existing layer ${layerConfig.name}:`, error);
  }
}

// Helper function to verify layer is correctly added to the map
export function verifyLayerInMap(layer: __esri.FeatureLayer | null, view: __esri.MapView | null, layerId: string) {
  if (!layer || !view || !view.map) {
    console.error(`LAYER VERIFY - ${layerId} not properly initialized:`, {
      hasLayer: !!layer,
      hasView: !!view,
      hasMap: !!(view && view.map)
    });
    return false;
  }
  
  // Check if layer is in the map
  const isInMap = view.map.layers.includes(layer);
  console.log(`LAYER VERIFY - ${layerId} in map:`, {
    isInMap,
    layerId: layer.id,
    title: layer.title,
    url: layer.url,
    visible: layer.visible,
    source: 'verifyLayerInMap'
  });
  
  if (!isInMap) {
    console.log(`LAYER VERIFY - ${layerId} not in map, adding now`);
    view.map.add(layer);
    return true;
  }
  
  return isInMap;
}

/**
 * Emergency function to fix the electoral results layer if it's not showing properly
 * This can be called from the browser console with window.fixElectoralLayer()
 */
export function fixElectoralLayer(view: __esri.MapView | null, makeVisible: boolean = false): void {
  if (!view) {
    console.error('VOTING LAYER FIX - No view provided');
    return;
  }

  try {
    // Remove any existing layer first
  const existingLayer = view.map.findLayerById('winningCandidate');
  if (existingLayer) {
      console.log('VOTING LAYER FIX - Removing existing layer');
    view.map.remove(existingLayer);
  }
  
    // Create a new unique value renderer for parties
    const partyRenderer = new UniqueValueRenderer({
      field: 'PARTY_1',
      defaultSymbol: new SimpleFillSymbol({
        color: [200, 200, 200, 0.6],
        outline: { color: [0, 0, 0, 0], width: 0 }
      }),
    uniqueValueInfos: [
      {
        value: "Liberal",
        label: "Liberal Party",
        symbol: new SimpleFillSymbol({
            color: [230, 0, 0, 0.7],
            outline: { color: [0, 0, 0, 0], width: 0 }
        })
      },
      {
        value: "Conservative",
        label: "Conservative Party",
        symbol: new SimpleFillSymbol({
            color: [0, 0, 230, 0.7],
            outline: { color: [0, 0, 0, 0], width: 0 }
        })
      },
      {
        value: "NDP",
        label: "NDP",
        symbol: new SimpleFillSymbol({
            color: [255, 128, 0, 0.7],
            outline: { color: [0, 0, 0, 0], width: 0 }
        })
      },
      {
        value: "Bloc",
        label: "Bloc Québécois",
        symbol: new SimpleFillSymbol({
            color: [0, 191, 255, 0.7],
            outline: { color: [0, 0, 0, 0], width: 0 }
        })
      },
      {
        value: "Green",
        label: "Green Party",
        symbol: new SimpleFillSymbol({
            color: [0, 200, 0, 0.7],
            outline: { color: [0, 0, 0, 0], width: 0 }
        })
      }
    ],
    legendOptions: {
      title: "Electoral Results by Party"
    }
  });

    // Create a new feature layer with improved configuration
  const winningCandidatesLayer = new FeatureLayer({
      url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/FED_wgs84/FeatureServer/0',
      title: "Electoral Results by Party",
    id: 'winningCandidate',
      renderer: partyRenderer,
      opacity: 1.0,
    outFields: ["*"],
    popupEnabled: true,
    visible: makeVisible,
      listMode: "show"
  });
  
    // Configure a simple popup template
  winningCandidatesLayer.popupTemplate = new PopupTemplate({
    title: "Electoral District: {FEDNAME}",
      content: [{
        type: "fields",
        fieldInfos: [
          { fieldName: "FEDNAME", label: "Electoral District" },
          { fieldName: "FEDUID", label: "District ID" },
          { fieldName: "NAME_1", label: "Winning Candidate" },
          { fieldName: "PARTY_1", label: "Party" },
          { fieldName: "VOTES_1", label: "Votes", format: { digitSeparator: true } },
          { fieldName: "VOTE_PERCENT_1", label: "Vote Percentage" }
        ]
      }]
    });
    
    // Add to the map and make sure it's on top
    view.map.add(winningCandidatesLayer);
    
    // Set visibility based on parameter
    winningCandidatesLayer.visible = makeVisible;
    
    // Move the layer to the top for visibility
    if (view.map.layers && view.map.layers.length > 0) {
      view.map.reorder(winningCandidatesLayer, view.map.layers.length - 1);
    }
    
    // Log the layer addition
    console.log('VOTING LAYER FIX - Fixed electoral layer added:', {
      id: winningCandidatesLayer.id,
      title: winningCandidatesLayer.title,
      visible: winningCandidatesLayer.visible,
      renderer: winningCandidatesLayer.renderer ? winningCandidatesLayer.renderer.type : undefined,
      hasValueExpression: !!(winningCandidatesLayer.renderer && (winningCandidatesLayer.renderer as any).valueExpression)
    });
    
    return;
  } catch (error) {
    console.error('VOTING LAYER FIX - Error fixing electoral layer:', error);
  }
}

// Make the fix function globally accessible with a clearer name and store map view reference
(window as any).fixElectoralLayer = fixElectoralLayer;
// Add a shorthand helper that enables visibility
(window as any).showElectoralLayer = function(providedView = null) {
  // If no view is provided, try to use the stored map view
  const view = providedView || (window as any).mapView;
  if (!view) {
    console.error('ELECTORAL FIX - No map view available. Try passing the view object directly.');
    console.log('Hint: If you have access to the map view, use showElectoralLayer(mapView)');
    return;
  }
  fixElectoralLayer(view, true);
};
// Store map view reference globally so we can access it easily
export function storeMapViewReference(view: __esri.MapView) {
  if (view) {
    (window as any).mapView = view;
  }
}