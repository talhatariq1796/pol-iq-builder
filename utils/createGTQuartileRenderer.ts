import Color from "@arcgis/core/Color";
import ClassBreaksRenderer from "@arcgis/core/renderers/ClassBreaksRenderer";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import { 
  RendererConfig, 
  RendererResult, 
  ColorStop 
} from './types';
import { LayerWithMetadata } from '@/types/geospatial-chat-component';
import { LayerMetadata } from '@/types/layers';
import { ACTIVE_COLOR_SCHEME, STANDARD_OPACITY } from './renderer-standardization';

// Use active color scheme from renderer standardization
export const DEFAULT_COLOR_STOPS: ColorStop[] = ACTIVE_COLOR_SCHEME.slice(0, 4).map(color => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
  if (!result) return [173, 216, 230];
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ];
});

// Update type definition
interface CalculateQuantilesOptions {
  excludeZeros?: boolean;
  numberOfBreaks?: number;
  customBreaks?: number[];
  numBreaks?: number;
  isNormalized?: boolean;
}

const calculateQuantiles = async (
  layer: __esri.FeatureLayer, 
  field: string,
  options: CalculateQuantilesOptions = {}
): Promise<number[]> => {
  const { excludeZeros = false, numBreaks = 4, isNormalized = false } = options;

  try {
    if (!layer || !field) {
      console.warn('Invalid layer or field for calculating quantiles');
      return [25, 50, 75, 100]; // Default values
    }

    if (!layer.loaded) {
      await layer.load();
    }

    // First query to get all values and find 75th percentile
    const allQuery = layer.createQuery();
    allQuery.where = excludeZeros ? `${field} > 0` : "1=1";
    allQuery.outFields = [field];
    allQuery.returnGeometry = false;
    
    const allFeatures = await layer.queryFeatures(allQuery);
    
    if (!allFeatures || !allFeatures.features || allFeatures.features.length === 0) {
      console.warn(`No valid features found for field ${field} when calculating quantiles`);
      return [25, 50, 75, 100]; // Default breaks
    }

    // Extract all values, filter out null and undefined
    const allValues = allFeatures.features
      .map(f => f.attributes[field])
      .filter((val): val is number => val !== null && val !== undefined && !isNaN(val));
    
    // Sort values to find 75th percentile
    allValues.sort((a, b) => a - b);
    const percentile75Index = Math.floor(allValues.length * 0.75);
    const percentile75Value = allValues[percentile75Index];

    console.log(`[calculateQuantiles] 75th percentile value: ${percentile75Value} (index ${percentile75Index} of ${allValues.length} values)`);

    // Now query for only features above 75th percentile
    const topQuery = layer.createQuery();
    topQuery.where = `${field} >= ${percentile75Value}`;
    topQuery.outFields = [field];
    topQuery.returnGeometry = false;
    
    const topFeatures = await layer.queryFeatures(topQuery);
    
    if (!topFeatures || !topFeatures.features || topFeatures.features.length === 0) {
      console.warn(`No features found above 75th percentile for field ${field}`);
      return [25, 50, 75, 100]; // Default breaks
    }

    // Extract values for top features
    let values = topFeatures.features
      .map(f => f.attributes[field])
      .filter((val): val is number => val !== null && val !== undefined && !isNaN(val));
    
    // Log raw values before normalization
    console.log(`[calculateQuantiles] Raw values for top 25% features (Count: ${values.length}):`, values.slice(0, 50)); // Log first 50 values
    
    if (values.length === 0) {
        console.warn(`[calculateQuantiles] No numeric values found for field ${field}. Returning default breaks.`);
        return [25, 50, 75, 100];
    }

    // Log raw stats for top features
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const rawMedian = values.length > 0 ? values[Math.floor(values.length / 2)] : NaN;
    console.log(`[calculateQuantiles] Raw stats for top features: Min=${rawMin}, Max=${rawMax}, Median=${rawMedian}`);

    // Handle normalization if requested
    if (isNormalized) {
      // Find min and max for normalization from ALL values
      const min = Math.min(...allValues);
      const max = Math.max(...allValues);
      
      // Normalize to 0-100 scale using full range
      if (max > min) {
        values = values.map(v => Math.round(((v - min) / (max - min)) * 100));
      } else {
        // If all values are the same, normalize based on absolute value
        values = values.map(v => v > 0 ? 100 : 0);
      }
    }
    
    // Log values after normalization
    console.log(`[calculateQuantiles] Values after normalization for top features (Count: ${values.length}):`, values.slice(0, 50));

    // Log normalized stats
    const normMin = Math.min(...values);
    const normMax = Math.max(...values);
    const normMedian = values.length > 0 ? values[Math.floor(values.length / 2)] : NaN;
    console.log(`[calculateQuantiles] Normalized stats for top features: Min=${normMin}, Max=${normMax}, Median=${normMedian}`);

    // Sort values and calculate breaks for equal count within top features
    values.sort((a, b) => a - b);
    const breaks: number[] = [];
    const featuresPerClass = Math.ceil(values.length / 4);
    
    for (let i = 1; i <= 4; i++) {
      const index = i * featuresPerClass - 1;
      const validIndex = Math.max(0, Math.min(index, values.length - 1));
      breaks.push(values[validIndex]);
    }
    
    // Make sure the last break is the max value
    if (values.length > 0 && breaks[breaks.length - 1] !== values[values.length - 1]) {
      breaks[breaks.length - 1] = values[values.length - 1];
    }
    
    console.log(`[GTrendsRenderer] Calculated breaks for top features (equal count):`, {
      breaks,
      featuresPerClass,
      totalFeatures: values.length
    });

    return breaks;
  } catch (error) {
    console.error('Error calculating quantiles:', error);
    return [25, 50, 75, 100]; // Default breaks on error
  }
};

// Simplified config specific to Google Trends
interface GTrendsRendererConfig {
  layer: __esri.FeatureLayer;
  field: string;
  colorStops?: ColorStop[];
  opacity?: number;
  outlineWidth?: number;
  outlineColor?: number[];
  numBreaks?: number; // Allow specifying number of breaks if needed
}

// Main function renamed and simplified
const createGTQuartileRenderer = async (
  config: GTrendsRendererConfig
): Promise<RendererResult> => {
  const {
    layer,
    field,
    colorStops = DEFAULT_COLOR_STOPS,
    opacity = STANDARD_OPACITY,
    outlineWidth = 0.5,
    outlineColor = [128, 128, 128],
    numBreaks = 4
  } = config;

  if (!layer || !field) {
    console.warn('[GTrendsRenderer] Invalid layer or field for renderer creation');
    return null;
  }

  try {
    // Log layer state
    console.log(`[GTrendsRenderer] Creating renderer for layer:`, {
      id: layer.id,
      title: layer.title,
      loaded: layer.loaded,
      fields: layer.fields?.map(f => f.name) || []
    });

    if (!layer.loaded) {
      console.log('[GTrendsRenderer] Layer not loaded, waiting for load...');
      await layer.load();
      console.log('[GTrendsRenderer] Layer loaded successfully');
    }

    // Verify field exists
    const fieldExists = layer.fields?.some(f => f.name === field);
    if (!fieldExists) {
      console.warn(`[GTrendsRenderer] Field '${field}' not found in layer. Available fields:`, 
        layer.fields?.map(f => f.name) || []
      );
      return null;
    }

    // First get all values to find the 75th percentile
    const allQuery = layer.createQuery();
    allQuery.where = "1=1";
    allQuery.outFields = [field];
    allQuery.returnGeometry = false;
    
    console.log('[GTrendsRenderer] Executing query for all features...');
    const allFeatures = await layer.queryFeatures(allQuery);
    
    if (!allFeatures || !allFeatures.features || !allFeatures.features.length) {
      console.warn('[GTrendsRenderer] No features found in query result');
      return null;
    }

    // Get all raw values
    const allValues = allFeatures.features
      .map(f => f.attributes[field])
      .filter((val): val is number => val !== null && val !== undefined && !isNaN(val));

    if (allValues.length === 0) {
      console.warn(`[GTrendsRenderer] No numeric values found for field '${field}'. Sample values:`, 
        allFeatures.features.slice(0, 5).map(f => f.attributes[field])
      );
      return null;
    }

    // Sort to find 75th percentile
    allValues.sort((a, b) => a - b);
    const percentile75Index = Math.floor(allValues.length * 0.75);
    const percentile75Value = allValues[percentile75Index];

    console.log(`[GTrendsRenderer] Raw values stats:`, {
      count: allValues.length,
      min: Math.min(...allValues),
      max: Math.max(...allValues),
      percentile75: percentile75Value,
      sample: allValues.slice(0, 5)
    });

    // Query for features above 75th percentile
    const topQuery = layer.createQuery();
    topQuery.where = `${field} >= ${percentile75Value}`;
    topQuery.outFields = [field];
    topQuery.returnGeometry = false;
    
    console.log('[GTrendsRenderer] Executing query for top features...');
    const topFeatures = await layer.queryFeatures(topQuery);
    
    if (!topFeatures || !topFeatures.features || !topFeatures.features.length) {
      console.warn('[GTrendsRenderer] No features found above 75th percentile');
      return null;
    }

    // Get values for top features
    let values = topFeatures.features
      .map(f => f.attributes[field])
      .filter((val): val is number => val !== null && val !== undefined && !isNaN(val));

    if (values.length === 0) {
      console.warn(`[GTrendsRenderer] No numeric values found in top features for field '${field}'. Sample values:`, 
        topFeatures.features.slice(0, 5).map(f => f.attributes[field])
      );
      return null;
    }

    // Get min/max from TOP features only for normalization
    const min = Math.min(...values);
    const max = Math.max(...values);

    console.log(`[GTrendsRenderer] Top features raw values:`, {
      count: values.length,
      min: min,
      max: max,
      sample: values.slice(0, 5)
    });

    // Normalize values to 0-100 scale using top features range
    if (max > min) {
      // First normalize to 0-1 range
      values = values.map(v => (v - min) / (max - min));
      // Then scale to 0-100 and round
      values = values.map(v => Math.round(v * 100));
    } else {
      // If all values are the same, set to 100
      values = values.map(v => v > 0 ? 100 : 0);
    }

    // Ensure no values are below 0 or above 100
    values = values.map(v => Math.max(0, Math.min(100, v)));

    console.log(`[GTrendsRenderer] Normalized values:`, {
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      sample: values.slice(0, 5)
    });

    // Calculate breaks for equal count within normalized top features
    values.sort((a, b) => a - b);
    const breaks: number[] = [];
    const featuresPerClass = Math.ceil(values.length / 4);
    
    for (let i = 1; i <= 4; i++) {
      const index = i * featuresPerClass - 1;
      const validIndex = Math.max(0, Math.min(index, values.length - 1));
      breaks.push(values[validIndex]);
    }
    
    // Make sure the last break is the max value
    if (values.length > 0 && breaks[breaks.length - 1] !== values[values.length - 1]) {
      breaks[breaks.length - 1] = values[values.length - 1];
    }
    
    // Ensure breaks are within 0-100 range
    breaks.forEach((breakValue, i) => {
      breaks[i] = Math.max(0, Math.min(100, breakValue));
    });
    
    console.log(`[GTrendsRenderer] Calculated breaks (equal count):`, {
      breaks,
      featuresPerClass,
      totalFeatures: values.length
    });

    // Determine if this is a point layer
    const isPointLayer = layer.geometryType === 'point';

    const lowestCategoryColor = colorStops[0] || DEFAULT_COLOR_STOPS[0];
    const defaultSymbol = isPointLayer
      ? new SimpleMarkerSymbol({
          style: "circle",
          size: 6,
          color: new Color([...lowestCategoryColor, opacity]),
          outline: { color: new Color([...outlineColor, opacity]), width: outlineWidth }
        })
      : new SimpleFillSymbol({
          color: new Color([...lowestCategoryColor, opacity]),
          outline: { color: new Color([...outlineColor, opacity]), width: outlineWidth }
        });

    // Create class break infos
    const classBreakInfos = breaks.map((breakValue, i) => {
      const colorIndex = i;
      const colorArray = colorStops[colorIndex] || colorStops[0];
      const color = new Color([...colorArray, opacity]);
      
      const prevValue = i === 0 ? 0 : breaks[i - 1];
      
      // Format as 0-100 scale
      const formattedMaxValue = Math.round(breakValue);
      const formattedMinValue = Math.round(prevValue);

      const label = i === breaks.length - 1
        ? `${formattedMinValue}+`  // Show "+" for highest range
        : `${formattedMinValue} - ${formattedMaxValue}`;

      const symbol = isPointLayer
        ? new SimpleMarkerSymbol({
            style: "circle",
            size: 6,
            color,
            outline: { color: new Color([...outlineColor, opacity]), width: outlineWidth }
          })
        : new SimpleFillSymbol({
            color,
            outline: { color: new Color([...outlineColor, opacity]), width: outlineWidth }
          });

      return {
        minValue: prevValue,
        maxValue: breakValue,
        symbol,
        label
      };
    });

    console.log(`[GTrendsRenderer] Class break infos:`, 
      classBreakInfos.map(info => ({
        min: info.minValue,
        max: info.maxValue,
        label: info.label,
        color: info.symbol.color?.toHex()
      }))
    );

    const renderer = new ClassBreaksRenderer({
      field,
      defaultSymbol,
      defaultLabel: "No Data (0)",
      classBreakInfos
    });

    return {
      renderer,
      breaks,
      statistics: {
        min: 0,
        max: 100,
        mean: breaks.reduce((a, b) => a + b, 0) / breaks.length,
        median: breaks[Math.floor(breaks.length / 2)]
      }
    };

  } catch (error) {
    console.error(`[GTrendsRenderer] Error creating renderer for layer ${layer.title}, field ${field}:`, {
      error,
      layerId: layer.id,
      layerTitle: layer.title,
      field,
      layerLoaded: layer.loaded,
      layerFields: layer.fields?.map(f => f.name) || []
    });
    return null;
  }
};

export { createGTQuartileRenderer }; // Export the new function