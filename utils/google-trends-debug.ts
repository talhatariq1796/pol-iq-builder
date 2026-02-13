/**
 * Debugging utilities specifically for Google Trends layers
 */
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import Query from '@arcgis/core/rest/support/Query';
import Extent from '@arcgis/core/geometry/Extent';
import Point from '@arcgis/core/geometry/Point';
import Polygon from '@arcgis/core/geometry/Polygon';
import Graphic from '@arcgis/core/Graphic';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Color from '@arcgis/core/Color';

/**
 * Diagnose all layers in the map
 * Outputs detailed information about each layer to help debug visibility issues
 */
export async function diagnoseAllLayers(mapView: __esri.MapView | __esri.SceneView): Promise<void> {
  if (!mapView || !mapView.map) {
    console.warn('[TRENDS_DEBUG] No map view available for diagnosis');
    return;
  }

  console.log('====== DETAILED LAYER DIAGNOSIS ======');
  console.log(`Total layers in map: ${mapView.map.allLayers.length}`);
  
  // Log info about all layers in the map
  for (let i = 0; i < mapView.map.allLayers.length; i++) {
    const layer = mapView.map.allLayers.getItemAt(i);
    if (!layer) continue;

    console.log(`\n--- LAYER #${i + 1}: ${layer.id || '(no id)'} ---`);
    console.log(`Title: ${layer.title || '(no title)'}`);
    console.log(`Type: ${layer.type || '(unknown type)'}`);
    console.log(`Visible: ${layer.visible}`);
    console.log(`Opacity: ${layer.opacity}`);
    console.log(`Drawing order: ${i} (higher = on top)`);
    
    // Check if it's likely a trends layer
    const isTrendsLayer = layer.id?.includes('googleTrends') || 
                         layer.id?.includes('trends') ||
                         (layer as any)?.metadata?.tags?.includes('trends');
    
    console.log(`Is Google Trends Layer: ${isTrendsLayer}`);

    // For feature layers, get additional details
    if ((layer as any).type === 'feature') {
      const featureLayer = layer as __esri.FeatureLayer;
      
      // Check feature layer properties
      console.log(`Definition Expression: "${featureLayer.definitionExpression || 'none'}"`);
      console.log(`Layer URL: ${featureLayer.url || 'none'}`);
      console.log(`Layer Loaded: ${featureLayer.loaded}`);
      
      // Check for renderer
      if (featureLayer.renderer) {
        console.log(`Renderer Type: ${featureLayer.renderer.type}`);
        try {
          if ((featureLayer.renderer as any).visualVariables) {
            const visualVars = (featureLayer.renderer as any).visualVariables;
            console.log(`Visual Variables: ${visualVars?.length || 0} variables defined`);
          }
        } catch (e) {
          console.log(`Error getting renderer details: ${e}`);
        }
      } else {
        console.log(`No renderer defined`);
      }
      
      // Check for actual feature count in the layer
      try {
        const query = featureLayer.createQuery();
        query.where = "1=1";
        query.returnGeometry = false;
        query.outFields = ["OBJECTID"];
        
        const featureCount = await featureLayer.queryFeatureCount(query);
        console.log(`Feature Count: ${featureCount}`);
        
        if (featureCount === 0 && isTrendsLayer) {
          console.log(`WARNING: Google Trends layer has ZERO features!`);
        }
      } catch (e) {
        console.log(`Error querying feature count: ${e}`);
      }
    }
    
    // For virtual layers, check references
    if (layer.id?.includes('googleTrends-')) {
      const sourceField = layer.id.split('googleTrends-')[1];
      if (sourceField) {
        console.log(`Virtual Layer Source Field: ${sourceField}`);
      }
      
      // Try to find the base layer this virtual layer references
      const baseLayerId = 'googleTrends';
      const baseLayer = mapView.map.findLayerById(baseLayerId);
      console.log(`Base Layer Found: ${!!baseLayer}`);
      
      if (baseLayer) {
        console.log(`Base Layer Visible: ${baseLayer.visible}`);
        console.log(`Base Layer Loaded: ${(baseLayer as any).loaded}`);
      }
    }
    
    // Check layer view status
    try {
      const layerView = await mapView.whenLayerView(layer);
      if (layerView) {
        console.log(`Layer View Status: created successfully`);
        console.log(`Layer View Updating: ${layerView.updating}`);
        console.log(`Layer View Suspended: ${layerView.suspended}`);
      }
    } catch (e) {
      console.log(`Layer View Status: ERROR - could not create layer view`);
    }
  }
  
  console.log('======= END LAYER DIAGNOSIS =======');
}

/**
 * Force Google Trends layers to be visible
 * Takes aggressive measures to make layers visible for debugging
 */
export async function forceGoogleTrendsVisibility(mapView: __esri.MapView | __esri.SceneView): Promise<void> {
  if (!mapView || !mapView.map) {
    console.warn('[TRENDS_DEBUG] No map view available');
    return;
  }

  console.log('[TRENDS_DEBUG] Starting aggressive visibility fix for Google Trends layers');
  
  // Find all Google Trends layers in the map (both base and virtual)
  const trendsLayers = mapView.map.allLayers.filter(layer => {
    return layer.id?.includes('googleTrends') || 
           layer.title?.toLowerCase().includes('trend') ||
           (layer as any)?.metadata?.tags?.includes('trends');
  });

  console.log(`[TRENDS_DEBUG] Found ${trendsLayers.length} Google Trends related layers`);
  
  let baseLayer: __esri.FeatureLayer | null = null;
  
  // Process each layer
  for (const layer of trendsLayers) {
    try {
      console.log(`[TRENDS_DEBUG] Fixing layer: ${layer.id}`);
      
      // Specifically record the base layer for later reference
      if (layer.id === 'googleTrends') {
        baseLayer = layer as __esri.FeatureLayer;
      }
      
      // 1. Remove ANY definition expression
      if ((layer as any).definitionExpression !== undefined) {
        const currentExpression = (layer as any).definitionExpression;
        console.log(`[TRENDS_DEBUG] Found definition expression on layer ${layer.id}: "${currentExpression}"`);
        console.log(`[TRENDS_DEBUG] Removing definition expression from layer: ${layer.id}`);
        (layer as any).definitionExpression = "";
      }
      
      // 2. Ensure visibility and opacity are set correctly
      const originalVisible = layer.visible;
      const originalOpacity = layer.opacity;
      
      layer.visible = true;
      layer.opacity = 1.0;
      
      console.log(`[TRENDS_DEBUG] Layer ${layer.id} visibility changed from ${originalVisible} to ${layer.visible}`);
      console.log(`[TRENDS_DEBUG] Layer ${layer.id} opacity changed from ${originalOpacity} to ${layer.opacity}`);
      
      // 3. Move layer to top of drawing order to ensure visibility
      try {
        mapView.map.remove(layer);
        mapView.map.add(layer);
        console.log(`[TRENDS_DEBUG] Layer ${layer.id} moved to top of drawing order`);
      } catch (e) {
        console.log(`[TRENDS_DEBUG] Error moving layer to top: ${e}`);
      }
      
      // 4. For feature layers, try to apply an emergency renderer
      if ((layer as any).type === 'feature') {
        const featureLayer = layer as __esri.FeatureLayer;
        
        // Apply an emergency renderer - bright red for maximum visibility
        console.log(`[TRENDS_DEBUG] Applying emergency renderer to layer ${layer.id}`);
        const emergencyRenderer = new SimpleRenderer({
          symbol: new SimpleFillSymbol({
            color: [255, 0, 0, 0.5],
            outline: {
              color: [255, 255, 0, 1],
              width: 2
            }
          })
        });
        
        featureLayer.renderer = emergencyRenderer;
        
        // 5. Force a refresh of the layer
        if (typeof featureLayer.refresh === 'function') {
          console.log(`[TRENDS_DEBUG] Refreshing layer: ${layer.id}`);
          featureLayer.refresh();
        }
        
        // 6. Query features to check if they exist
        try {
          const query = featureLayer.createQuery();
          query.where = "1=1";
          query.returnGeometry = true;
          query.outFields = ["*"];
          
          const results = await featureLayer.queryFeatures(query);
          console.log(`[TRENDS_DEBUG] Layer ${layer.id} has ${results.features.length} features`);
          
          // If we have features with geometry, try to zoom to them
          if (results.features.length > 0 && results.features[0].geometry) {
            console.log(`[TRENDS_DEBUG] Found features with geometry, attempting to zoom`);
            try {
              await mapView.goTo(results.features);
              console.log(`[TRENDS_DEBUG] Successfully zoomed to features`);
            } catch (zoomError) {
              console.log(`[TRENDS_DEBUG] Error zooming to features: ${zoomError}`);
            }
          } else if (results.features.length > 0) {
            console.log(`[TRENDS_DEBUG] Features found but they have no geometry`);
            
            // Log attributes of first feature to help debug
            console.log(`[TRENDS_DEBUG] First feature attributes:`, results.features[0].attributes);
          } else {
            console.log(`[TRENDS_DEBUG] WARNING: No features found in layer ${layer.id}`);
          }
        } catch (queryError) {
          console.log(`[TRENDS_DEBUG] Error querying features: ${queryError}`);
        }
      }
      
      // For virtual layers using a base source layer, make sure the base is visible
      if (layer.id?.includes('googleTrends-') && baseLayer && !baseLayer.visible) {
        console.log(`[TRENDS_DEBUG] Base layer ${baseLayer.id} is not visible, making it visible to support virtual layer ${layer.id}`);
        baseLayer.visible = true;
        baseLayer.opacity = 0.01; // Almost transparent but still rendered
      }
      
    } catch (error) {
      console.error(`[TRENDS_DEBUG] Error fixing layer ${layer.id}:`, error);
    }
  }
  
  // After fixing individual layers, check if we found a base GoogleTrends layer
  if (baseLayer) {
    console.log(`[TRENDS_DEBUG] Checking base Google Trends layer fields and data`);
    
    try {
      // Ensure it's loaded
      if (!baseLayer.loaded) {
        await baseLayer.load();
      }
      
      // Log field information
      console.log(`[TRENDS_DEBUG] Fields available on base layer:`, baseLayer.fields?.map(f => f.name));
      
      // Find virtual field matches
      const virtualLayers = trendsLayers.filter(l => l.id?.includes('googleTrends-'));
      
      for (const virtualLayer of virtualLayers) {
        const fieldName = virtualLayer.id?.split('googleTrends-')[1];
        if (fieldName) {
          // Check if the field exists in the base layer
          const fieldExists = baseLayer.fields?.some(f => f.name === fieldName);
          console.log(`[TRENDS_DEBUG] Virtual layer ${virtualLayer.id} references field "${fieldName}" which ${fieldExists ? 'EXISTS' : 'DOES NOT EXIST'} in base layer`);
        }
      }
      
      // Try to diagnose rendering issues by checking max values
      try {
        const query = baseLayer.createQuery();
        query.where = "1=1";
        query.returnGeometry = false;
        query.outFields = ["*"];
        
        const results = await baseLayer.queryFeatures(query);
        
        if (results.features.length > 0) {
          // Check values for virtual layer fields
          const attributes = results.features[0].attributes;
          
          for (const virtualLayer of virtualLayers) {
            const fieldName = virtualLayer.id?.split('googleTrends-')[1];
            if (fieldName) {
              let hasValues = false;
              let maxValue = 0;
              
              // Check if any feature has a non-zero value for this field
              for (const feature of results.features) {
                const value = feature.attributes[fieldName];
                if (value && typeof value === 'number' && value > 0) {
                  hasValues = true;
                  maxValue = Math.max(maxValue, value);
                }
              }
              
              console.log(`[TRENDS_DEBUG] Virtual layer ${virtualLayer.id} field "${fieldName}" ${hasValues ? 'HAS' : 'DOES NOT HAVE'} values > 0. Max value: ${maxValue}`);
            }
          }
        }
      } catch (e) {
        console.log(`[TRENDS_DEBUG] Error querying for field values: ${e}`);
      }
    } catch (e) {
      console.log(`[TRENDS_DEBUG] Error analyzing base layer: ${e}`);
    }
  }
  
  console.log('[TRENDS_DEBUG] Finished aggressive visibility fix');
}

/**
 * Creates a test Google Trends layer to verify rendering works
 */
export function createTestTrendsLayer(mapView: __esri.MapView | __esri.SceneView): __esri.FeatureLayer | null {
  if (!mapView || !mapView.map) {
    console.warn('[TRENDS_DEBUG] No map view available for test layer creation');
    return null;
  }

  console.log('[TRENDS_DEBUG] Creating test Google Trends layer');
  
  try {
    // Create a test extent around the center of the map
    const center = mapView.center as __esri.Point;
    if (!center || typeof center.longitude !== 'number' || typeof center.latitude !== 'number') {
      console.warn('[TRENDS_DEBUG] Invalid map center coordinates');
      return null;
    }

    const testExtent = new Extent({
      xmin: center.longitude - 0.01,
      ymin: center.latitude - 0.01,
      xmax: center.longitude + 0.01,
      ymax: center.latitude + 0.01,
      spatialReference: mapView.spatialReference
    });
    
    // Create a polygon around the center point
    const polygon = new Polygon({
      rings: [
        [
          [center.longitude - 0.01, center.latitude - 0.01],
          [center.longitude + 0.01, center.latitude - 0.01],
          [center.longitude + 0.01, center.latitude + 0.01],
          [center.longitude - 0.01, center.latitude + 0.01],
          [center.longitude - 0.01, center.latitude - 0.01]
        ]
      ],
      spatialReference: mapView.spatialReference
    });
    
    // Create attributes that simulate Google Trends data
    const attributes = {
      OBJECTID: 1,
      Nike: 75,
      Hoka: 82,
      Jordan: 63,
      adidas: 88,
      samba: 40,
      alo: 30,
      lululemon: 55,
      onshoes: 45,
      DESCRIPTION: "TEST_ZIP"
    };
    
    // Create a single graphic
    const graphic = new Graphic({
      geometry: polygon,
      attributes: attributes
    });
    
    // Create a feature layer from the graphic
    const layer = new FeatureLayer({
      id: "googleTrends_test",
      title: "Google Trends Test Layer",
      source: [graphic],
      geometryType: "polygon",
      objectIdField: "OBJECTID",
      fields: [
        { name: "OBJECTID", type: "oid" },
        { name: "Nike", type: "integer" },
        { name: "Hoka", type: "integer" },
        { name: "Jordan", type: "integer" },
        { name: "adidas", type: "integer" },
        { name: "samba", type: "integer" },
        { name: "alo", type: "integer" },
        { name: "lululemon", type: "integer" },
        { name: "onshoes", type: "integer" },
        { name: "DESCRIPTION", type: "string" }
      ],
      renderer: new SimpleRenderer({
        symbol: new SimpleFillSymbol({
          color: [255, 0, 0, 0.7],
          outline: {
            color: [255, 255, 0, 1],
            width: 2
          }
        })
      }),
      opacity: 1,
      visible: true
    });
    
    // Add metadata to identify it as a Google Trends layer
    (layer as any).metadata = {
      isGoogleTrendsLayer: true,
      tags: ["trends", "test"],
      provider: "Google Trends"
    };
    
    // Add the layer to the map
    mapView.map.add(layer);
    console.log('[TRENDS_DEBUG] Test layer created and added to map');
    
    // Now create a test virtual layer
    const virtualLayer = new FeatureLayer({
      id: "googleTrends-test-Nike",
      title: "Nike (Test Virtual Layer)",
      source: [graphic],
      geometryType: "polygon",
      objectIdField: "OBJECTID",
      fields: [
        { name: "OBJECTID", type: "oid" },
        { name: "Nike", type: "integer" }
      ],
      renderer: new SimpleRenderer({
        symbol: new SimpleFillSymbol({
          color: [0, 0, 255, 0.7],
          outline: {
            color: [0, 255, 255, 1],
            width: 2
          }
        })
      }),
      opacity: 1,
      visible: true
    });
    
    // Add metadata to identify it as a Google Trends virtual layer
    (virtualLayer as any).metadata = {
      isGoogleTrendsLayer: true,
      isVirtualLayer: true,
      sourceLayerId: "googleTrends_test",
      sourceField: "Nike",
      tags: ["trends", "test", "virtual"]
    };
    
    // Add the virtual layer to the map
    mapView.map.add(virtualLayer);
    console.log('[TRENDS_DEBUG] Test virtual layer created and added to map');
    
    return layer;
  } catch (error) {
    console.error('[TRENDS_DEBUG] Error creating test layer:', error);
    return null;
  }
}

/**
 * Look directly at how virtual layer toggling is handled
 */
export async function debugVirtualLayerToggle(
  mapView: __esri.MapView | __esri.SceneView,
  sourceLayerId: string = 'googleTrends',
  fieldName: string = 'Nike'
): Promise<void> {
  if (!mapView || !mapView.map) {
    console.warn('[TRENDS_DEBUG] No map view available for virtual layer debugging');
    return;
  }

  console.log(`[TRENDS_DEBUG] Debugging virtual layer toggle for ${sourceLayerId}-${fieldName}`);
  
  try {
    // Find the base layer
    const baseLayer = mapView.map.findLayerById(sourceLayerId);
    if (!baseLayer) {
      console.log(`[TRENDS_DEBUG] Base layer ${sourceLayerId} not found in map`);
      return;
    }
    
    console.log(`[TRENDS_DEBUG] Base layer ${sourceLayerId} found, visible=${baseLayer.visible}, opacity=${baseLayer.opacity}`);
    
    // Find the virtual layer
    const virtualLayerId = `${sourceLayerId}-${fieldName}`;
    const virtualLayer = mapView.map.findLayerById(virtualLayerId);
    
    if (!virtualLayer) {
      console.log(`[TRENDS_DEBUG] Virtual layer ${virtualLayerId} not found in map`);
      
      // Look for any layer that might contain the field name
      const possibleLayers = mapView.map.allLayers.filter(l => l.id?.toLowerCase().includes(fieldName.toLowerCase()));
      if (possibleLayers.length > 0) {
        console.log(`[TRENDS_DEBUG] Found ${possibleLayers.length} layers that might match the field name:`, 
          possibleLayers.map(l => `${l.id} (visible=${l.visible})`));
      }
      return;
    }
    
    console.log(`[TRENDS_DEBUG] Virtual layer ${virtualLayerId} found, visible=${virtualLayer.visible}, opacity=${virtualLayer.opacity}`);
    
    // Check if the base layer has the necessary fields
    if ((baseLayer as any).fields) {
      const hasField = (baseLayer as any).fields.some((f: any) => f.name === fieldName);
      console.log(`[TRENDS_DEBUG] Base layer ${sourceLayerId} ${hasField ? 'has' : 'does not have'} field "${fieldName}"`);
    }
    
    // Try toggling the virtual layer
    console.log(`[TRENDS_DEBUG] Toggling virtual layer ${virtualLayerId} visibility`);
    virtualLayer.visible = !virtualLayer.visible;
    virtualLayer.opacity = 1.0;
    
    // Ensure base layer is visible if virtual layer is visible
    if (virtualLayer.visible && !baseLayer.visible) {
      console.log(`[TRENDS_DEBUG] Making base layer visible to support virtual layer`);
      baseLayer.visible = true;
    }
    
    // Force a refresh
    if ((virtualLayer as any).refresh) {
      console.log(`[TRENDS_DEBUG] Forcing refresh of virtual layer`);
      (virtualLayer as any).refresh();
    }
    
    // Try to apply an emergency renderer
    if ((virtualLayer as any).renderer) {
      console.log(`[TRENDS_DEBUG] Applying emergency renderer to virtual layer`);
      (virtualLayer as any).renderer = new SimpleRenderer({
        symbol: new SimpleFillSymbol({
          color: [0, 255, 0, 0.7],
          outline: {
            color: [255, 255, 0, 1],
            width: 3
          }
        })
      });
    }
    
    console.log(`[TRENDS_DEBUG] Virtual layer toggle debug complete`);
  } catch (error) {
    console.error('[TRENDS_DEBUG] Error debugging virtual layer toggle:', error);
  }
}
