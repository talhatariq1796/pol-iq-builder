import type { LayerConfig, VirtualLayer } from '../../types/layers';
import { LayerProvider } from './base-layer-provider';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Layer from '@arcgis/core/layers/Layer';
import { createQuartileRenderer } from '../createQuartileRenderer';
import { createGTQuartileRenderer, DEFAULT_COLOR_STOPS } from '../createGTQuartileRenderer';
import { createWidgetGTQuartileRenderer } from '../createWidgetGTQuartileRenderer';

/**
 * Provider for standard feature layers from predefined services
 */
export class StandardLayerProvider implements LayerProvider {
  /**
   * Checks if this provider can handle the specified layer ID
   * This provider handles all layers
   */
  canHandle(layerId: string): boolean {
    // Standard provider is the fallback for any layer
    return true;
  }
  
  /**
   * Creates a layer from the provided configuration
   */
  async createLayer(config: LayerConfig, query: string, options?: any): Promise<FeatureLayer> {
    try {
      const layer = new FeatureLayer({
        url: config.url,
        title: config.name,
        outFields: ["*"],
        popupEnabled: true,
        visible: false
      });

      await layer.load();

      // Apply appropriate renderer based on layer type
      const rendererField = config.rendererField || this.findSuitableRendererField(layer);
      
      if (rendererField) {
        if (config.id?.startsWith('widget-')) {
          // Use widget-specific renderer for widget layers
          const rendererResult = await createWidgetGTQuartileRenderer({
            layer,
            field: rendererField
          });
          if (rendererResult?.renderer) {
            layer.renderer = rendererResult.renderer;
          }
        } else if (config.id === 'googleTrends' || config.id?.startsWith('googleTrends-')) {
          // Use Google Trends renderer for trends layers
          const rendererResult = await createGTQuartileRenderer({
            layer,
            field: rendererField
          });
          if (rendererResult?.renderer) {
            layer.renderer = rendererResult.renderer;
          }
        } else {
          // Use standard quartile renderer for other layers
          const rendererResult = await createQuartileRenderer({
            layer,
            field: rendererField,
            isCompositeIndex: config.type === 'index'
          });
          if (rendererResult?.renderer) {
            layer.renderer = rendererResult.renderer;
          }
        }
      }

      return layer;
    } catch (error) {
      console.error('Error creating layer:', error);
      throw error; // Throw error instead of returning null to match interface
    }
  }

  /**
   * Find a suitable field for rendering if none is specified
   */
  private findSuitableRendererField(layer: __esri.FeatureLayer): string | null {
    if (!layer.fields) return null;
    
    // Look for common numeric field names
    const commonFields = ['thematic_value', 'value', 'count', 'amount', 'score', 'rate', 'percent'];
    for (const fieldName of commonFields) {
      const field = layer.fields.find(f => f.name === fieldName);
      if (field && ['double', 'integer', 'single', 'small-integer'].includes(field.type)) {
        return fieldName;
      }
    }
    
    // Look for any numeric field
    const numericField = layer.fields.find(f => 
      ['double', 'integer', 'single', 'small-integer'].includes(f.type)
    );
    
    return numericField ? numericField.name : null;
  }
  
  /**
   * Create an empty feature layer as fallback
   */
  private createEmptyLayer(config: LayerConfig, options?: any): __esri.FeatureLayer {
    const emptyLayer = new FeatureLayer({
      id: config.id,
      title: config.name || 'Virtual Layer',
      source: [], // Empty source
      fields: [
        { name: "OBJECTID", type: "oid", alias: "OBJECTID" },
        { name: "Name", type: "string", alias: "Name" },
        { name: "Value", type: "double", alias: "Value" }
      ],
      objectIdField: "OBJECTID",
      geometryType: "point",
      spatialReference: { wkid: 4326 },
      visible: true,
      opacity: 0.8
    });
    
    //console.log(`[StandardLayerProvider] Created empty layer: ${emptyLayer.id}`);
    
    // Add to map if not already there and if mapView is provided
    if (options?.mapView && !options.mapView.map.findLayerById(emptyLayer.id)) {
      options.mapView.map.add(emptyLayer);
     // console.log(`[StandardLayerProvider] Added empty layer to map: ${emptyLayer.id}`);
    }
    
    return emptyLayer;
  }
} 