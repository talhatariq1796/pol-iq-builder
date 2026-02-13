import SimpleRenderer from "@arcgis/core/renderers/SimpleRenderer";
import type Renderer from "@arcgis/core/renderers/Renderer";
import UniqueValueRenderer from "@arcgis/core/renderers/UniqueValueRenderer";
import ClassBreaksRenderer from "@arcgis/core/renderers/ClassBreaksRenderer";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";

// Define distinct colors for different point layer types
const POINT_LAYER_COLORS: Record<string, number[]> = {
  // Red Bull and Energy Drinks
  'red_bull': [220, 38, 127, 0.9],       // Red Bull brand red
  'monster': [0, 255, 0, 0.9],           // Monster green
  '5_hour': [255, 165, 0, 0.9],          // 5-Hour orange
  'energy_drink': [255, 215, 0, 0.9],    // Generic energy drink yellow
  
  // Grocery Stores
  'trader_joe': [215, 48, 31, 0.9],      // Trader Joe's red
  'whole_foods': [0, 150, 57, 0.9],      // Whole Foods green
  'target': [204, 0, 0, 0.9],            // Target red
  'costco': [0, 93, 171, 0.9],           // Costco blue
  
  // Fitness & Health
  'gym': [138, 43, 226, 0.9],            // Purple for gyms
  'fitness': [75, 0, 130, 0.9],          // Indigo for fitness centers
  'spa': [255, 20, 147, 0.9],            // Deep pink for spas
  
  // Default colors for other types
  'restaurant': [255, 140, 0, 0.9],      // Dark orange
  'business': [0, 122, 194, 0.8],        // Default blue
  'default': [128, 128, 128, 0.8]        // Gray
};

/**
 * Get point layer color based on layer name
 */
export const getPointLayerColor = (layerName: string): number[] => {
  const lowerName = layerName.toLowerCase();
  
  // Check for specific keywords in layer names
  if (lowerName.includes('red bull')) return POINT_LAYER_COLORS.red_bull;
  if (lowerName.includes('monster')) return POINT_LAYER_COLORS.monster;
  if (lowerName.includes('5-hour') || lowerName.includes('5 hour')) return POINT_LAYER_COLORS['5_hour'];
  if (lowerName.includes('energy drink')) return POINT_LAYER_COLORS.energy_drink;
  
  if (lowerName.includes('trader joe')) return POINT_LAYER_COLORS.trader_joe;
  if (lowerName.includes('whole foods')) return POINT_LAYER_COLORS.whole_foods;
  if (lowerName.includes('target')) return POINT_LAYER_COLORS.target;
  if (lowerName.includes('costco')) return POINT_LAYER_COLORS.costco;
  
  if (lowerName.includes('gym')) return POINT_LAYER_COLORS.gym;
  if (lowerName.includes('fitness')) return POINT_LAYER_COLORS.fitness;
  if (lowerName.includes('spa')) return POINT_LAYER_COLORS.spa;
  
  if (lowerName.includes('restaurant')) return POINT_LAYER_COLORS.restaurant;
  if (lowerName.includes('business')) return POINT_LAYER_COLORS.business;
  
  return POINT_LAYER_COLORS.default;
};

// Type for renderer properties that can be used to create ArcGIS renderers
export type RendererProperties = {
  type: string;
  symbol?: {
    type: string;
    color?: number[];
    outline?: {
      color: number[];
      width: number;
    };
    [key: string]: any;
  };
  field?: string;
  valueExpression?: string;
  uniqueValueInfos?: Array<{
    value: string;
    label: string;
    symbol: {
      type: string;
      color: number[];
      outline?: {
        color: number[];
        width: number;
      };
    };
  }>;
  [key: string]: any;
};

/**
 * Get the default renderer for a specific layer
 * @param layerType The type of the layer
 * @param rendererField Optional field name to render by
 * @param layerName Optional layer name for point color selection
 * @returns Renderer properties object
 */
export const getDefaultLayerRenderer = (
  layerType: 'point' | 'index' | 'demographic' | 'percentage' | 'feature-service',
  rendererField?: string,
  layerName?: string
): __esri.Renderer => {
  switch (layerType) {
    case 'point':
      // Create point renderer with color based on layer name
      const pointColor = layerName ? getPointLayerColor(layerName) : POINT_LAYER_COLORS.default;
      return new SimpleRenderer({
        symbol: new SimpleMarkerSymbol({
          color: pointColor,
          size: 10,
          outline: {
            color: [255, 255, 255, 0.8],
            width: 1.5
          },
          style: 'circle'
        })
      });
      
    case 'percentage':
    case 'index':
    case 'demographic':
    case 'feature-service':
      // Create a quartile renderer for data-driven layers
      return new ClassBreaksRenderer({
        field: rendererField || 'thematic_value',
        classBreakInfos: [
          {
            minValue: 0,
            maxValue: 25,
            symbol: new SimpleFillSymbol({
              color: [255, 0, 64, 0.6], // #d73027 - Strong red (lowest values)
              outline: { color: [0, 0, 0, 0], width: 0 }
            }),
            label: '0% - 25% (Lowest)'
          },
          {
            minValue: 25,
            maxValue: 50,
            symbol: new SimpleFillSymbol({
              color: [255, 191, 0, 0.6], // #fdae61 - Orange
              outline: { color: [0, 0, 0, 0], width: 0 }
            }),
            label: '25% - 50% (Low)'
          },
          {
            minValue: 50,
            maxValue: 75,
            symbol: new SimpleFillSymbol({
              color: [0, 255, 64, 0.6], // #a6d96a - Light green
              outline: { color: [0, 0, 0, 0], width: 0 }
            }),
            label: '50% - 75% (High)'
          },
          {
            minValue: 75,
            maxValue: 100,
            symbol: new SimpleFillSymbol({
              color: [0, 255, 128, 0.6], // #1a9850 - Dark green (highest values)
              outline: { color: [0, 0, 0, 0], width: 0 }
            }),
            label: '75% - 100% (Highest)'
          }
        ]
      });
      
    default:
      return new SimpleRenderer({
        symbol: new SimpleFillSymbol({
          color: [0, 120, 255, 0.5],
          outline: { color: [0, 0, 0, 0], width: 0 }
        })
      });
  }
};

/**
 * Creates an ArcGIS Renderer instance from renderer properties
 * @param properties Renderer properties
 * @returns ArcGIS Renderer instance
 */
export const createRenderer = (properties: RendererProperties): Renderer => {
  if (properties.type === 'simple') {
    if (properties.symbol && !(properties.symbol instanceof SimpleMarkerSymbol) && !(properties.symbol instanceof SimpleFillSymbol)) {
      const symbol = new SimpleMarkerSymbol(properties.symbol as any);
      return new SimpleRenderer({ ...properties, symbol } as any);
    }
    return new SimpleRenderer(properties as any);
  } else if (properties.type === 'unique-value') {
    if (properties.uniqueValueInfos) {
      const uniqueValueInfos = properties.uniqueValueInfos.map(info => ({
        ...info,
        symbol: (info.symbol instanceof SimpleMarkerSymbol || info.symbol instanceof SimpleFillSymbol)
          ? info.symbol
          : new SimpleMarkerSymbol(info.symbol as any)
      }));
      return new UniqueValueRenderer({ ...properties, uniqueValueInfos } as any);
    }
    return new UniqueValueRenderer(properties as any);
  }
  
  // Add support for other renderer types as needed
  
  // Default to SimpleRenderer
  return new SimpleRenderer(properties as any);
}; 