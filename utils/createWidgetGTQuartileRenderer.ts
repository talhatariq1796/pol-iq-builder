import Color from "@arcgis/core/Color";
import ClassBreaksRenderer from "@arcgis/core/renderers/ClassBreaksRenderer";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import { 
  RendererConfig, 
  RendererResult, 
  ColorStop 
} from './types';
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

// Simplified config specific to Google Trends
interface GTrendsRendererConfig {
  layer: __esri.FeatureLayer;
  field: string;
  colorStops?: ColorStop[];
  opacity?: number;
  outlineWidth?: number;
  outlineColor?: number[];
  numBreaks?: number;
}

// Main function for widget-specific rendering
const createWidgetGTQuartileRenderer = async (
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
    console.warn('[WidgetGTrendsRenderer] Invalid layer or field for renderer creation');
    return null;
  }

  try {
    // Log layer state
    console.log(`[WidgetGTrendsRenderer] Creating renderer for layer:`, {
      id: layer.id,
      title: layer.title,
      loaded: layer.loaded,
      fields: layer.fields?.map(f => f.name) || []
    });

    if (!layer.loaded) {
      console.log('[WidgetGTrendsRenderer] Layer not loaded, waiting for load...');
      await layer.load();
      console.log('[WidgetGTrendsRenderer] Layer loaded successfully');
    }

    // Verify field exists
    const fieldExists = layer.fields?.some(f => f.name === field);
    if (!fieldExists) {
      console.warn(`[WidgetGTrendsRenderer] Field '${field}' not found in layer. Available fields:`, 
        layer.fields?.map(f => f.name) || []
      );
      return null;
    }

    // Query for all features
    const query = layer.createQuery();
    query.where = "1=1";
    query.outFields = [field];
    query.returnGeometry = false;
    
    console.log('[WidgetGTrendsRenderer] Executing query for all features...');
    const features = await layer.queryFeatures(query);
    
    if (!features || !features.features || !features.features.length) {
      console.warn('[WidgetGTrendsRenderer] No features found in query result');
      return null;
    }

    // Get all values
    const values = features.features
      .map(f => f.attributes[field])
      .filter((val): val is number => val !== null && val !== undefined && !isNaN(val));

    if (values.length === 0) {
      console.warn(`[WidgetGTrendsRenderer] No numeric values found for field '${field}'. Sample values:`, 
        features.features.slice(0, 5).map(f => f.attributes[field])
      );
      return null;
    }

    // Log raw stats
    const min = Math.min(...values);
    const max = Math.max(...values);
    const median = values.length > 0 ? values[Math.floor(values.length / 2)] : NaN;

    console.log(`[WidgetGTrendsRenderer] Raw values stats:`, {
      count: values.length,
      min: min,
      max: max,
      median: median,
      sample: values.slice(0, 5)
    });

    // Calculate breaks for equal count
    values.sort((a, b) => a - b);
    const breaks: number[] = [];
    const featuresPerClass = Math.ceil(values.length / numBreaks);
    
    for (let i = 1; i <= numBreaks; i++) {
      const index = i * featuresPerClass - 1;
      const validIndex = Math.max(0, Math.min(index, values.length - 1));
      breaks.push(values[validIndex]);
    }
    
    // Make sure the last break is the max value
    if (values.length > 0 && breaks[breaks.length - 1] !== values[values.length - 1]) {
      breaks[breaks.length - 1] = values[values.length - 1];
    }
    
    console.log(`[WidgetGTrendsRenderer] Calculated breaks (equal count):`, {
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
      
      const prevValue = i === 0 ? min : breaks[i - 1];
      
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

    console.log(`[WidgetGTrendsRenderer] Class break infos:`, 
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
      defaultLabel: "No Data",
      classBreakInfos
    });

    return {
      renderer,
      breaks,
      statistics: {
        min,
        max,
        mean: values.reduce((a, b) => a + b, 0) / values.length,
        median
      }
    };

  } catch (error) {
    console.error(`[WidgetGTrendsRenderer] Error creating renderer for layer ${layer.title}, field ${field}:`, {
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

export { createWidgetGTQuartileRenderer }; 