import * as geometryEngine from "@arcgis/core/geometry/geometryEngine";
import Color from "@arcgis/core/Color";
import SimpleRenderer from "@arcgis/core/renderers/SimpleRenderer";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import { 
  RendererConfig, 
  RendererResult, 
  ColorStop 
} from './types';

/**
 * Dual Variable Renderer for Competitive Analysis
 * 
 * Maps two variables simultaneously:
 * - Size: Based on one field (e.g., Nike market share)
 * - Color: Based on another field (e.g., competitive advantage score)
 * 
 * Uses quintile-based classification to ensure equal distribution
 */

interface DualVariableConfig extends RendererConfig {
  sizeField: string;           // Field for circle size (e.g., nike_market_share)
  colorField: string;          // Field for circle color (e.g., competitive_advantage)
  sizeTitle?: string;          // Legend title for size variable
  colorTitle?: string;         // Legend title for color variable
  minSize?: number;            // Minimum circle size in pixels
  maxSize?: number;            // Maximum circle size in pixels
}

interface DualVariableResult {
  sizeQuintiles?: number[];    // Quintile breaks for size field
  colorQuintiles?: number[];   // Quintile breaks for color field
  legend?: {
    sizeComponent: any;
    colorComponent: any;
  };
  renderer?: any;
}

const calculateQuintiles = async (
  layer: __esri.FeatureLayer, 
  field: string
): Promise<number[]> => {
  try {
    if (!layer || !field) {
      console.warn(`Invalid layer or field for calculating quintiles: ${field}`);
      return [0, 25, 50, 75, 100];
    }

    if (!layer.loaded) {
      await layer.load();
    }

    const query = layer.createQuery();
    query.where = "1=1";
    query.outFields = [field];
    query.returnGeometry = false;
    
    const featureSet = await layer.queryFeatures(query);
    
    if (!featureSet || !featureSet.features || featureSet.features.length === 0) {
      console.warn(`No valid features found for field ${field}`);
      return [0, 25, 50, 75, 100];
    }

    // Extract values, filter out null and undefined
    const values = featureSet.features
      .map(f => f.attributes[field])
      .filter((val): val is number => val !== null && val !== undefined && !isNaN(val));
    
    if (values.length === 0) {
      console.warn(`No valid numeric values found for field ${field}`);
      return [0, 25, 50, 75, 100];
    }
    
    // Sort values for quintile calculation
    values.sort((a, b) => a - b);
    
    // Calculate quintile breaks (equal number of features in each class)
    const quintiles = [];
    for (let i = 1; i <= 5; i++) {
      const index = Math.ceil((i / 5) * values.length) - 1;
      const clampedIndex = Math.min(index, values.length - 1);
      quintiles.push(values[clampedIndex]);
    }
    
    console.log(`[DualVariableRenderer] Calculated quintiles for ${field}:`, quintiles);
    return quintiles;
    
  } catch (error) {
    console.error(`Error calculating quintiles for field ${field}:`, error);
    return [0, 25, 50, 75, 100];
  }
};

const createDualVariableRenderer = async (
  config: DualVariableConfig
): Promise<DualVariableResult> => {
  const {
    layer,
    sizeField,
    colorField,
    sizeTitle = 'Size Variable',
    colorTitle = 'Color Variable',
    minSize = 12,
    maxSize = 32,
    opacity = 0.8
  } = config;

  if (!layer || !sizeField || !colorField) {
    console.warn('Invalid inputs for dual-variable renderer creation');
    return {} as DualVariableResult;
  }

  try {
    if (!layer.loaded) {
      await layer.load();
    }

    console.log(`[DualVariableRenderer] Creating dual-variable renderer for ${layer.title}`);
    console.log(`[DualVariableRenderer] Size field: ${sizeField}, Color field: ${colorField}`);

    // Validate fields exist
    const sizeFieldInfo = layer.fields?.find(f => f.name === sizeField);
    const colorFieldInfo = layer.fields?.find(f => f.name === colorField);
    
    if (!sizeFieldInfo) {
      console.error(`Size field '${sizeField}' not found in layer fields`);
      return {} as DualVariableResult;
    }
    
    if (!colorFieldInfo) {
      console.error(`Color field '${colorField}' not found in layer fields`);
      return {} as DualVariableResult;
    }

    // Calculate quintiles for both variables
    const sizeQuintiles = await calculateQuintiles(layer, sizeField);
    const colorQuintiles = await calculateQuintiles(layer, colorField);

    // Define color palette (red to green for competitive advantage)
    const colorPalette = [
      [255, 107, 107],   // Red - Q1 (lowest competitive advantage)
      [255, 179, 71],    // Orange - Q2
      [255, 215, 0],     // Yellow/Gold - Q3  
      [144, 238, 144],   // Light Green - Q4
      [0, 255, 127]      // Spring Green - Q5 (highest competitive advantage)
    ];

    // Define size range (small to large for market share)
    const sizeRange = [minSize, minSize + 4, minSize + 8, minSize + 14, maxSize];

    // Create the renderer with visual variables
    const renderer = new SimpleRenderer({
      symbol: new SimpleMarkerSymbol({
        style: "circle",
        color: new Color([65, 105, 225, opacity]), // Default blue
        size: 16,
        outline: {
          color: new Color([0, 0, 0, 0]), // No border
          width: 0
        }
      }),
      visualVariables: [
        // Size variable for market share
        {
          field: sizeField,
          stops: sizeQuintiles.map((value, index) => ({
            value: value,
            size: sizeRange[index] || minSize
          })),
          legendOptions: {
            title: sizeTitle
          }
        } as any,
        // Color variable for competitive advantage  
        {
          field: colorField,
          stops: colorQuintiles.map((value, index) => ({
            value: value,
            color: new Color([...colorPalette[index], opacity])
          })),
          legendOptions: {
            title: colorTitle
          }
        } as any
      ]
    });

    // Enhanced renderer metadata for effects integration
    (renderer as any)._isDualVariable = true;
    (renderer as any)._sizeField = sizeField;
    (renderer as any)._colorField = colorField;
    (renderer as any)._sizeQuintiles = sizeQuintiles;
    (renderer as any)._colorQuintiles = colorQuintiles;
    (renderer as any)._fireflyMode = true; // Enable firefly effects for competitive analysis
    (renderer as any)._quintileBased = true;

    console.log(`[DualVariableRenderer] Created dual-variable renderer successfully`);
    console.log(`[DualVariableRenderer] Size quintiles (${sizeField}):`, sizeQuintiles);
    console.log(`[DualVariableRenderer] Color quintiles (${colorField}):`, colorQuintiles);

    // Create legend components
    const legend = {
      sizeComponent: {
        title: sizeTitle,
        type: 'size',
        items: sizeQuintiles.map((value, index) => ({
          label: index === 0 
            ? `≤ ${value.toFixed(1)}` 
            : index === sizeQuintiles.length - 1
              ? `> ${sizeQuintiles[index - 1].toFixed(1)}`
              : `${sizeQuintiles[index - 1].toFixed(1)} - ${value.toFixed(1)}`,
          size: sizeRange[index],
          value: value,
          quintile: index + 1
        }))
      },
      colorComponent: {
        title: colorTitle,
        type: 'color',
        items: colorQuintiles.map((value, index) => ({
          label: index === 0 
            ? `≤ ${value.toFixed(1)}` 
            : index === colorQuintiles.length - 1
              ? `> ${colorQuintiles[index - 1].toFixed(1)}`
              : `${colorQuintiles[index - 1].toFixed(1)} - ${value.toFixed(1)}`,
          color: colorPalette[index],
          value: value,
          quintile: index + 1
        }))
      }
    };

    // Calculate statistics
    const statistics = {
      min: Math.min(sizeQuintiles[0], colorQuintiles[0]),
      max: Math.max(sizeQuintiles[4], colorQuintiles[4]),
      mean: (sizeQuintiles.reduce((a, b) => a + b, 0) + colorQuintiles.reduce((a, b) => a + b, 0)) / 10,
      median: (sizeQuintiles[2] + colorQuintiles[2]) / 2
    };

    return {
      renderer,
      sizeQuintiles,
      colorQuintiles,
      legend
    };

  } catch (error) {
    console.error(`Error creating dual-variable renderer for layer ${layer.title}:`, error);
    return {} as DualVariableResult;
  }
};

export { createDualVariableRenderer, calculateQuintiles };
export type { DualVariableConfig, DualVariableResult };