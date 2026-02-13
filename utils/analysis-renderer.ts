import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import UniqueValueRenderer from '@arcgis/core/renderers/UniqueValueRenderer';
import ClassBreaksRenderer from '@arcgis/core/renderers/ClassBreaksRenderer';
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import Color from '@arcgis/core/Color';
import { getLayerIdField } from './layer-geometry-manager';
import { layers } from '@/config/layers';

// Define renderer types
type RendererType = 'unique-value' | 'class-breaks' | 'simple';

// Color schemes for visualizations
const COLOR_SCHEMES = {
  default: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'],
  sequential: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'],
  diverging: ['#d73027', '#f46d43', '#fdae61', '#fee090', '#ffffbf', '#e0f3f8', '#abd9e9', '#74add1', '#4575b4'],
  categorical: ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#ffff33', '#a65628', '#f781bf', '#999999'],
  political: {
    'Liberal': '#D71920',
    'Conservative': '#1A4782',
    'NDP': '#F37021',
    'Bloc': '#33B2CC',
    'Green': '#3D9B35',
    'PPC': '#4900FF',
    'Independent': '#777777'
  }
};

/**
 * Applies analysis results to a layer by creating a visualization renderer
 * @param layer Feature layer to visualize
 * @param analysisResults Analysis results with attributes by ID
 * @param valueField Field in analysis results to visualize
 * @param rendererType Type of renderer to create
 * @param options Additional renderer options
 * @returns The layer with applied visualization
 */
export async function applyAnalysisResults(
  layer: __esri.FeatureLayer,
  analysisResults: Record<string, any>,
  valueField: string,
  rendererType: RendererType = 'unique-value',
  options: {
    title?: string;
    colorScheme?: string;
    normalizationField?: string;
    classificationMethod?: 'equal-interval' | 'quantile' | 'natural-breaks';
    numClasses?: number;
  } = {}
): Promise<__esri.FeatureLayer> {
  // Make a copy of the layer
  const resultLayer = layer.clone();
  
  // Get the ID field for this layer
  const idField = getLayerIdField(layer.id);
    
  // Get unique values and statistics for the value field
  const uniqueValues = new Set<string | number>();
  const allValues: number[] = [];
  
  Object.values(analysisResults).forEach(result => {
    if (result[valueField] !== undefined && result[valueField] !== null) {
      uniqueValues.add(result[valueField]);
      if (typeof result[valueField] === 'number') {
        allValues.push(result[valueField]);
      }
    }
  });
  
  // Calculate statistics
  const stats = {
    min: Math.min(...allValues),
    max: Math.max(...allValues),
    avg: allValues.reduce((sum, val) => sum + val, 0) / allValues.length,
    count: allValues.length
  };
  
  console.log('Renderer stats:', {
    rendererType,
    uniqueValueCount: uniqueValues.size,
    valueStats: stats,
    sampleValues: Array.from(uniqueValues).slice(0, 5)
  });
  
  // Create appropriate renderer based on type
  let renderer: __esri.Renderer;
  
  if (rendererType === 'unique-value') {
    // Get colors based on options or defaults
    const colors = options.colorScheme && 
      (COLOR_SCHEMES as any)[options.colorScheme] ?
      (COLOR_SCHEMES as any)[options.colorScheme] :
      COLOR_SCHEMES.categorical;
    
    // Special case for political parties
    const isPolitical = valueField.toLowerCase().includes('party') || 
                         uniqueValues.has('Liberal') ||
                         uniqueValues.has('Conservative');
    
    const colorMap = isPolitical ? COLOR_SCHEMES.political : colors;
    
    // Create unique value infos
    const uniqueValueInfos = Array.from(uniqueValues).map((value, index) => {
      // Get color for this value (political party colors or index-based)
      const color = typeof colorMap === 'object' && typeof value === 'string' && value in colorMap ?
        colorMap[value as keyof typeof colorMap] :
        colors[index % colors.length];
        
      return {
        value: value,
        symbol: layer.geometryType === 'polygon' ?
          new SimpleFillSymbol({
            color: new Color(color),
            outline: { color: [0, 0, 0, 0], width: 0 }
          }) :
          new SimpleMarkerSymbol({
            color: new Color(color),
            outline: { color: [0, 0, 0, 0], width: 0 },
            size: 8
          }),
        label: String(value)
      };
    });
    
    // Create expression to extract the value from feature attributes
    const valueExpression = `
      var results = {
        ${Object.entries(analysisResults).map(([id, data]) => 
          `"${id}": ${typeof data[valueField] === 'string' 
            ? `"${data[valueField]}"` 
            : data[valueField]}`
        ).join(',\n        ')}
      };
      
      return results[$feature.${idField}];
    `;
    
    renderer = new UniqueValueRenderer({
      valueExpression,
      uniqueValueInfos,
      defaultSymbol: layer.geometryType === 'polygon' ?
        new SimpleFillSymbol({
          color: new Color([200, 200, 200, 0.5]),
          outline: { color: [0, 0, 0, 0], width: 0 }
        }) :
        new SimpleMarkerSymbol({
          color: new Color([200, 200, 200, 0.5]),
          outline: { color: [0, 0, 0, 0], width: 0 },
          size: 8
        }),
      defaultLabel: 'Other'
    });
    
  } else if (rendererType === 'class-breaks') {
    // Set up class breaks renderer for numeric data
    const numClasses = options.numClasses || 5;
    const colors = options.colorScheme && 
      (COLOR_SCHEMES as any)[options.colorScheme] ?
      (COLOR_SCHEMES as any)[options.colorScheme] :
      COLOR_SCHEMES.sequential;
      
    // Calculate class breaks
    const range = stats.max - stats.min;
    const classSize = range / numClasses;
    
    const classBreakInfos = Array.from({ length: numClasses }, (_, i) => {
      const minValue = stats.min + (i * classSize);
      const maxValue = i === numClasses - 1 ? stats.max : stats.min + ((i + 1) * classSize);
      
      return {
        minValue,
        maxValue,
        symbol: layer.geometryType === 'polygon' ?
          new SimpleFillSymbol({
            color: new Color(colors[i % colors.length]),
            outline: { color: [0, 0, 0, 0], width: 0 }
          }) :
          new SimpleMarkerSymbol({
            color: new Color(colors[i % colors.length]),
            outline: { color: [0, 0, 0, 0], width: 0 },
            size: 8
          }),
        label: `${minValue.toFixed(2)} - ${maxValue.toFixed(2)}`
      };
    });
    
    // Create expression to extract the value from feature attributes
    const valueExpression = `
      var results = {
        ${Object.entries(analysisResults).map(([id, data]) => 
          `"${id}": ${data[valueField] !== null && data[valueField] !== undefined ? data[valueField] : 'null'}`
        ).join(',\n        ')}
      };
      
      return results[$feature.${idField}];
    `;
    
    renderer = new ClassBreaksRenderer({
      valueExpression,
      classBreakInfos,
      defaultSymbol: layer.geometryType === 'polygon' ?
        new SimpleFillSymbol({
          color: new Color([200, 200, 200, 0.5]),
          outline: { color: [0, 0, 0, 0], width: 0 }
        }) :
        new SimpleMarkerSymbol({
          color: new Color([200, 200, 200, 0.5]),
          outline: { color: [0, 0, 0, 0], width: 0 },
          size: 8
        }),
      defaultLabel: 'No Data'
    });
  } else {
    // Simple renderer - for when we just want to highlight features
    renderer = new SimpleRenderer({
      symbol: layer.geometryType === 'polygon' ?
        new SimpleFillSymbol({
          color: new Color([0, 122, 194, 0.5]),
          outline: { color: [0, 0, 0, 0], width: 0 }
        }) :
        new SimpleMarkerSymbol({
          color: new Color([0, 122, 194, 0.5]),
          outline: { color: [0, 0, 0, 0], width: 0 },
          size: 8
        }),
    });
  }
  
  // Apply renderer to layer
  resultLayer.renderer = renderer;
  
  // Set popup title if provided
  if (options.title && resultLayer.popupTemplate) {
    resultLayer.popupTemplate.title = options.title;
  }
  
  return resultLayer;
} 