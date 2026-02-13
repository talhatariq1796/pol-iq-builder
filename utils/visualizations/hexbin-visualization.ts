import { DEFAULT_FILL_ALPHA } from "./constants";
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Renderer from '@arcgis/core/renderers/Renderer';
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import Extent from '@arcgis/core/geometry/Extent';
import Polygon from '@arcgis/core/geometry/Polygon';
import Point from '@arcgis/core/geometry/Point';
import { BaseVisualization, BaseVisualizationData, VisualizationOptions, VisualizationResult } from './base-visualization';
import Color from '@arcgis/core/Color';
import ColorVariable from '@arcgis/core/renderers/visualVariables/ColorVariable';
import { quantile } from 'd3-array';
import SpatialReference from '@arcgis/core/geometry/SpatialReference';
import Graphic from '@arcgis/core/Graphic';
import { StandardizedLegendData } from '@/types/legend';

export interface HexbinData extends BaseVisualizationData {
  field: string;
  cellSize?: number;
  aggregationType?: 'count' | 'sum' | 'mean';
  layerName: string;
}

export class HexbinVisualization extends BaseVisualization<HexbinData> {
  protected renderer: Renderer;
  protected title: string = 'Hexbin Analysis';
  private colorRamp = [
    [237, 248, 251],
    [179, 205, 227],
    [140, 150, 198],
    [136, 86, 167],
    [129, 15, 124]
  ];

  constructor() {
    super();
    this.renderer = new SimpleRenderer();
  }

  private calculateBreaks(values: number[], numBreaks: number = 5): number[] {
    console.log('Calculating breaks:', {
      totalValues: values.length,
      numBreaks,
      sampleValues: values.slice(0, 5)
    });

    const sortedValues = values.filter(v => v != null).sort((a, b) => a - b);
    const breaks = Array.from({length: numBreaks - 1}, (_, i) => {
      const p = (i + 1) / numBreaks;
      return quantile(sortedValues, p) || 0;
    });

    console.log('Calculated breaks:', {
      breaks,
      min: sortedValues[0],
      max: sortedValues[sortedValues.length - 1]
    });

    return breaks;
  }

  private getColorFromValue(value: number, breaks: number[]): Color {
    const index = breaks.findIndex(b => value <= b);
    const colorValues = index === -1 ? 
      this.colorRamp[this.colorRamp.length - 1] : 
      this.colorRamp[index];
    return new Color(colorValues);
  }

  private createHexagon(center: [number, number], size: number): number[][] {
    const angles = Array.from({ length: 6 }, (_, i) => (i * Math.PI) / 3);
    return angles.map(angle => [
      center[0] + size * Math.cos(angle),
      center[1] + size * Math.sin(angle)
    ]);
  }

  private createHexGrid(extent: Extent, cellSize: number): Map<string, any[]> {
    console.log('Creating hex grid:', {
      extent: {
        xmin: extent.xmin,
        ymin: extent.ymin,
        xmax: extent.xmax,
        ymax: extent.ymax
      },
      cellSize
    });

    const hexbins = new Map<string, any[]>();
    const sqrt3 = Math.sqrt(3);
    
    // Calculate grid dimensions
    const width = extent.width;
    const height = extent.height;
    const cols = Math.ceil(width / (cellSize * 1.5));
    const rows = Math.ceil(height / (cellSize * sqrt3));
    
    console.log('Grid dimensions:', {
      width,
      height,
      cols,
      rows,
      estimatedCells: cols * rows
    });
    
    // Calculate starting point (top-left of the grid)
    const startX = extent.xmin;
    const startY = extent.ymax;
    
    // Create hexagon centers
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = startX + col * cellSize * 1.5;
        const y = startY - row * cellSize * sqrt3;
        const offset = row % 2 === 0 ? 0 : cellSize * 0.75;
        
        const key = `${Math.floor(x + offset)}_${Math.floor(y)}`;
        hexbins.set(key, []);
      }
    }
    
    console.log('Hex grid created:', {
      totalBins: hexbins.size,
      sampleKeys: Array.from(hexbins.keys()).slice(0, 5)
    });
    
    return hexbins;
  }

  private aggregatePoints(
    points: __esri.Graphic[], 
    hexbins: Map<string, any[]>,
    cellSize: number,
    field: string,
    aggregationType: 'count' | 'sum' | 'mean' = 'count'
  ): Graphic[] {
    console.log('=== Starting Point Aggregation ===');
    console.log('Input data:', {
      totalPoints: points.length,
      totalHexbins: hexbins.size,
      cellSize,
      field,
      aggregationType
    });

    // Validate input points
    const validPoints = points.filter(point => {
      if (!point?.geometry || point.geometry.type !== 'point') {
        console.warn('Invalid point geometry:', {
          hasGeometry: !!point?.geometry,
          type: point?.geometry?.type
        });
        return false;
      }
      return true;
    });

    console.log('Point validation:', {
      total: points.length,
      valid: validPoints.length,
      invalid: points.length - validPoints.length
    });

    const sqrt3 = Math.sqrt(3);
    
    // Assign points to hexbins
    validPoints.forEach(point => {
      const geometry = point.geometry as __esri.Point;
      const x = geometry.x;
      const y = geometry.y;
      
      // Find the nearest hexagon center
      const col = Math.round(x / (cellSize * 1.5));
      const row = Math.round(y / (cellSize * sqrt3));
      const offset = row % 2 === 0 ? 0 : cellSize * 0.75;
      
      const key = `${Math.floor(x + offset)}_${Math.floor(y)}`;
      const bin = hexbins.get(key);
      if (bin) {
        bin.push(point);
      }
    });
    
    // Create hexagon features
    const hexFeatures = Array.from(hexbins.entries())
      .filter(([_, points]) => points.length > 0)
      .map(([key, points]) => {
        const [x, y] = key.split('_').map(Number);
        
        // Calculate value based on aggregation type
        let value: number;
        try {
          switch (aggregationType) {
            case 'sum': {
              value = points.reduce((sum, p) => {
                const fieldValue = p.attributes[field];
                if (typeof fieldValue !== 'number' || isNaN(fieldValue)) {
                  console.warn(`Invalid field value for sum aggregation:`, {
                    field,
                    value: fieldValue
                  });
                  return sum;
                }
                return sum + fieldValue;
              }, 0);
              break;
            }
            case 'mean': {
              const validValues = points.map(p => p.attributes[field])
                .filter(v => typeof v === 'number' && !isNaN(v));
              value = validValues.length > 0 
                ? validValues.reduce((sum, v) => sum + v, 0) / validValues.length
                : 0;
              break;
            }
            case 'count':
            default:
              value = points.length;
          }
        } catch (error) {
          console.error('Error calculating aggregated value:', error);
          value = 0;
        }
        
        // Create hexagon geometry
        const hexagonRings = [this.createHexagon([x, y], cellSize)];
        const polygon = new Polygon({
          rings: hexagonRings,
          spatialReference: points[0].geometry.spatialReference
        });
        
        return new Graphic({
          geometry: polygon,
          attributes: {
            value,
            count: points.length,
            OBJECTID: Math.floor(Math.random() * 1000000),
            ID: Math.floor(Math.random() * 1000000)
          }
        });
    });

    console.log('Aggregation complete:', {
      totalHexagons: hexFeatures.length,
      aggregationType,
      valueStats: {
        min: Math.min(...hexFeatures.map(f => f.attributes.value)),
        max: Math.max(...hexFeatures.map(f => f.attributes.value)),
        avg: hexFeatures.reduce((sum, f) => sum + f.attributes.value, 0) / hexFeatures.length
      }
    });

    return hexFeatures;
  }

  async create(data: HexbinData, options?: VisualizationOptions): Promise<VisualizationResult> {
    // Validate input data
    this.validateData(data);

    // Process features with field mapping
    const processedFeatures = data.features.map(feature => this.mapFeature(feature));

    // Generate hexbins
    const hexbins = this.generateHexbins(processedFeatures, data.cellSize || 1000);

    // Create hexbin features
    const hexFeatures = hexbins.map((bin, index) => {
      return new Graphic({
        geometry: bin.polygon,
        attributes: {
          OBJECTID: index + 1,
          count: bin.count,
          density: bin.density,
          ...bin.attributes,
          ID: Math.floor(Math.random() * 1000000)
        }
      });
    });

    // Create color variable based on density
    const colorVariable = new ColorVariable({
      field: 'density',
      stops: [
        { value: 0, color: new Color(this.colorRamp[0]) },
        { value: Math.max(...hexbins.map(b => b.density)), color: new Color(this.colorRamp[4]) }
      ]
    });

    // Update renderer
    this.renderer = new SimpleRenderer({
      symbol: new SimpleFillSymbol({
        color: [0, 0, 0, 0],
        outline: {
          color: options?.symbolConfig?.outline?.color || [255, 255, 255, 0.5],
          width: 0
        }
      }),
      visualVariables: [colorVariable]
    });

    // Initialize layer with hexbin features
    await this.initializeLayer({
      ...data,
      features: hexFeatures
    }, options);

    if (!this.layer || !this.extent) {
      throw new Error('Layer or extent not initialized');
    }

    return {
      layer: this.layer,
      extent: this.extent,
      renderer: this.renderer,
      legendInfo: this.getLegendInfo()
    };
  }

  private generateHexbins(features: __esri.Graphic[], cellSize: number): Array<{
    polygon: Polygon;
    count: number;
    density: number;
    attributes: { [key: string]: any };
  }> {
    // Implementation of hexbin generation...
    // This is a placeholder - you'll need to implement the actual hexbin generation logic
    return [];
  }

  getLegendInfo(): StandardizedLegendData {
    return {
      title: this.title,
      type: 'class-breaks',
      description: `Hexbin analysis showing density of ${this.data?.field || 'points'} with ${this.data?.cellSize || 1000}m cell size`,
      items: [{
        label: 'Hexbin',
        color: 'rgba(0, 116, 217, DEFAULT_FILL_ALPHA)',
        shape: 'square',
        size: 16
      }]
    };
  }
} 