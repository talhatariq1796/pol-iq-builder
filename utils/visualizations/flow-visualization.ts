import { DEFAULT_FILL_ALPHA } from "./constants";
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import SizeVariable from '@arcgis/core/renderers/visualVariables/SizeVariable';
import RotationVariable from '@arcgis/core/renderers/visualVariables/RotationVariable';
import { VisualizationOptions, BaseVisualization } from './base-visualization';
import SpatialReference from '@arcgis/core/geometry/SpatialReference';
import Polyline from '@arcgis/core/geometry/Polyline';
import Graphic from '@arcgis/core/Graphic';
import { StandardizedLegendData } from '@/types/legend';

interface FlowData {
  lines: __esri.Graphic[];
  magnitudeField: string;
  directionField?: string;
  minMagnitude?: number;
  maxMagnitude?: number;
  features: __esri.Graphic[];
  layerName: string;
}

export class FlowVisualization extends BaseVisualization<FlowData> {
  protected title: string;

  constructor() {
    super();
    this.title = 'Flow Analysis';
  }

  async create(
    data: FlowData,
    options: VisualizationOptions = {}
  ): Promise<{ layer: FeatureLayer; extent: __esri.Extent }> {
    console.log('=== Creating Flow Visualization ===');
    console.log('Input data:', {
      lineCount: data.lines?.length,
      magnitudeField: data.magnitudeField,
      directionField: data.directionField,
      minMagnitude: data.minMagnitude,
      maxMagnitude: data.maxMagnitude
    });

    // Validate input data
    if (!data.lines?.length) {
      throw new Error('No lines provided for flow visualization');
    }

    if (!data.magnitudeField) {
      throw new Error('Magnitude field must be provided for flow visualization');
    }

    // Validate lines and collect field values
    const validLines = data.lines.filter((line, index) => {
      if (!line?.geometry || line.geometry.type !== 'polyline') {
        console.warn(`Invalid line geometry at index ${index}:`, {
          hasGeometry: !!line?.geometry,
          type: line?.geometry?.type
        });
        return false;
      }

      const magnitude = line.attributes?.[data.magnitudeField];
      if (magnitude == null || typeof magnitude !== 'number') {
        console.warn(`Invalid magnitude value at index ${index}:`, magnitude);
        return false;
      }

      if (data.directionField) {
        const direction = line.attributes?.[data.directionField];
        if (direction == null || typeof direction !== 'number' || direction < 0 || direction > 360) {
          console.warn(`Invalid direction value at index ${index}:`, direction);
          return false;
        }
      }

      // Validate line has exactly two points
      const paths = (line.geometry as __esri.Polyline).paths;
      if (!paths?.length || !paths[0]?.length || paths[0].length !== 2) {
        console.warn(`Invalid line path at index ${index}:`, paths);
        return false;
      }

      return true;
    });

    console.log('Line validation:', {
      total: data.lines.length,
      valid: validLines.length,
      invalid: data.lines.length - validLines.length
    });

    if (validLines.length === 0) {
      throw new Error('No valid lines for flow visualization');
    }

    // Calculate magnitude statistics
    const magnitudes = validLines.map(line => line.attributes[data.magnitudeField]);
    const magnitudeStats = {
      min: Math.min(...magnitudes),
      max: Math.max(...magnitudes),
      avg: magnitudes.reduce((sum, m) => sum + m, 0) / magnitudes.length
    };

    console.log('Magnitude statistics:', magnitudeStats);

    // Calculate direction statistics if available
    if (data.directionField) {
      const directions = validLines
        .map(line => {
          const direction = line.attributes?.[data.directionField!];
          return typeof direction === 'number' ? direction : null;
        })
        .filter((d): d is number => d !== null);

      if (directions.length > 0) {
        const directionStats = {
          min: Math.min(...directions),
          max: Math.max(...directions),
          avg: directions.reduce((sum, d) => sum + d, 0) / directions.length
        };
        console.log('Direction statistics:', directionStats);
      }
    }

    // Create visualization
    console.log('Creating flow visualization');
    const startTime = performance.now();

    try {
      // Create visual variables
      const { minMag, maxMag } = this.calculateMagnitudeRange(data);
      const visualVariables: (__esri.SizeVariable | __esri.RotationVariable)[] = [
        new SizeVariable({
          field: data.magnitudeField,
          minDataValue: data.minMagnitude ?? minMag,
          maxDataValue: data.maxMagnitude ?? maxMag,
          minSize: 1,
          maxSize: 8,
          legendOptions: {
            title: "Flow Magnitude",
            showLegend: true
          }
        })
      ];

      if (data.directionField) {
        visualVariables.push(
          new RotationVariable({
            field: data.directionField,
            rotationType: "geographic"
          })
        );
      }

      const renderer = new SimpleRenderer({
        symbol: new SimpleLineSymbol({
          color: [0, 116, 217, DEFAULT_FILL_ALPHA],
          width: 2,
          style: "solid",
          cap: "round"
        }),
        visualVariables
      });

      const layer = new FeatureLayer({
        title: options.title || this.title,
        source: validLines,
        renderer,
        opacity: options.opacity || 0.7,
        visible: options.visible ?? true,
        popupTemplate: {
          title: "{DESCRIPTION}",
          content: [
            {
              type: "fields",
              fieldInfos: [
                {
                  fieldName: data.magnitudeField,
                  label: "Magnitude",
                  format: { digitSeparator: true, places: 2 }
                },
                ...(data.directionField ? [{
                  fieldName: data.directionField,
                  label: "Direction (degrees)",
                  format: { digitSeparator: true, places: 1 }
                }] : [])
              ]
            }
          ]
        }
      });

      // Calculate extent from valid lines
      let extent: __esri.Extent | null = null;
      try {
        if (validLines[0]?.geometry?.extent) {
          extent = validLines[0].geometry.extent.clone();
          validLines.forEach(line => {
            if (line.geometry?.extent) {
              extent?.union(line.geometry.extent);
            }
          });
          // Add padding to extent for better visualization
          extent.expand(1.1);
        } else {
          throw new Error('First line has no valid extent');
        }
      } catch (error) {
        console.error('Error calculating extent:', error);
        throw new Error('Failed to calculate extent from lines');
      }

      if (!extent) {
        throw new Error('Failed to calculate valid extent');
      }

      // Wait for layer to load and validate
      await layer.load();
      console.log('Layer loaded successfully:', {
        id: layer.id,
        title: layer.title,
        loaded: layer.loaded,
        geometryType: layer.geometryType,
        features: validLines.length
      });

      const endTime = performance.now();
      console.log(`Layer creation completed in ${(endTime - startTime).toFixed(2)}ms`);

      return { layer, extent };
    } catch (error) {
      console.error('Error creating flow layer:', error);
      throw new Error('Failed to create flow visualization layer');
    }
  }

  private calculateMagnitudeRange(data: FlowData): { minMag: number; maxMag: number } {
    const magnitudes = data.lines
      .map(line => {
        const magnitude = line.attributes?.[data.magnitudeField];
        return typeof magnitude === 'number' ? magnitude : null;
      })
      .filter((mag): mag is number => mag !== null);

    if (magnitudes.length === 0) {
      throw new Error('No valid magnitude values found');
    }

    const range = {
      minMag: Math.min(...magnitudes),
      maxMag: Math.max(...magnitudes)
    };

    console.log('Magnitude range:', range);
    return range;
  }

  getRenderer(): __esri.Renderer {
    return new SimpleRenderer({
      symbol: new SimpleLineSymbol({
        color: [0, 116, 217, DEFAULT_FILL_ALPHA],
        width: 2,
        style: "solid",
        cap: "round"
      })
    });
  }

  getLegendInfo(): StandardizedLegendData {
    return {
      title: this.title,
      type: "class-breaks",
      description: "Line width indicates magnitude, arrow indicates direction",
      items: [{
        label: 'Flow',
        color: 'rgba(0, 116, 217, DEFAULT_FILL_ALPHA)',
        shape: 'square',
        size: 2
      }]
    };
  }

  static createFlowLine(
    startPoint: [number, number],
    endPoint: [number, number],
    magnitude: number,
    direction?: number
  ): __esri.Graphic {
    // Validate input coordinates
    if (!startPoint?.length || startPoint.length !== 2 || 
        !endPoint?.length || endPoint.length !== 2) {
      throw new Error('Invalid start or end point coordinates');
    }

    // Validate magnitude
    if (typeof magnitude !== 'number' || magnitude < 0) {
      throw new Error('Invalid magnitude value');
    }

    // Validate direction if provided
    if (direction !== undefined && (typeof direction !== 'number' || 
        direction < 0 || direction > 360)) {
      throw new Error('Invalid direction value (must be between 0 and 360 degrees)');
    }

    return new Graphic({
      geometry: new Polyline({
        paths: [[startPoint, endPoint]],
        spatialReference: new SpatialReference({ wkid: 4326 })
      }),
      attributes: {
        magnitude,
        ...(direction !== undefined && { direction })
      }
    });
  }
}