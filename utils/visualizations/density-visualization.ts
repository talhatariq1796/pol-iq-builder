import { DEFAULT_FILL_ALPHA } from "./constants";
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import HeatmapRenderer from '@arcgis/core/renderers/HeatmapRenderer';
import { VisualizationOptions, BaseVisualization } from './base-visualization';
import Extent from '@arcgis/core/geometry/Extent';
import { StandardizedLegendData } from '@/types/legend';

interface DensityData {
  points: __esri.Graphic[];
  weightField?: string;
  radius: number;
  minDensity?: number;
  maxDensity?: number;
  features: __esri.Graphic[];
  layerName: string;
}

export class DensityVisualization extends BaseVisualization<DensityData> {
  protected title: string;

  constructor() {
    super();
    this.title = 'Density Analysis';
  }

  async create(
    data: DensityData,
    options: VisualizationOptions = {}
  ): Promise<{ layer: FeatureLayer; extent: __esri.Extent }> {
    const startTime = performance.now();
    console.log('=== Creating Density Visualization ===');
    console.log('Input data:', {
      pointCount: data.points?.length,
      weightField: data.weightField,
      radius: data.radius,
      minDensity: data.minDensity,
      maxDensity: data.maxDensity,
      spatialReference: data.points?.[0]?.geometry?.spatialReference?.wkid
    });

    // Validate input data
    if (!data.points?.length) {
      throw new Error('No points provided for density visualization');
    }

    if (!data.points[0]?.geometry?.spatialReference) {
      throw new Error('Points must have a valid spatial reference');
    }

    if (data.radius <= 0) {
      throw new Error('Radius must be greater than 0');
    }

    if (data.minDensity !== undefined && data.maxDensity !== undefined && data.minDensity >= data.maxDensity) {
      throw new Error('minDensity must be less than maxDensity');
    }

    // Validate point geometries and collect weight values
    let totalWeight = 0;
    let validWeightCount = 0;
    const validPoints = data.points.filter((point, index) => {
      try {
        if (!point?.geometry || point.geometry.type !== 'point') {
          console.warn(`Invalid point geometry at index ${index}:`, {
            hasGeometry: !!point?.geometry,
            type: point?.geometry?.type
          });
          return false;
        }

        if (data.weightField) {
          const weight = point.attributes?.[data.weightField];
          if (weight == null) {
            console.warn(`Missing weight field "${data.weightField}" at index ${index}`);
            return false;
          }
          if (typeof weight !== 'number' || isNaN(weight)) {
            console.warn(`Invalid weight value at index ${index}:`, weight);
            return false;
          }
          totalWeight += weight;
          validWeightCount++;
        }

        return true;
      } catch (error) {
        console.error(`Error processing point at index ${index}:`, error);
        return false;
      }
    });

    const validationTime = performance.now();
    console.log('Point validation:', {
      total: data.points.length,
      valid: validPoints.length,
      invalid: data.points.length - validPoints.length,
      validationTimeMs: (validationTime - startTime).toFixed(2)
    });

    if (validPoints.length === 0) {
      throw new Error('No valid points for density visualization');
    }

    if (data.weightField && validWeightCount === 0) {
      throw new Error(`No valid weights found for field "${data.weightField}"`);
    }

    // Calculate weight statistics if weight field is specified
    let weightStats: { min: number; max: number; avg: number; stdDev: number } | undefined;
    if (data.weightField) {
      const weights = validPoints
        .map(p => {
          const value = p.attributes?.[data.weightField!];
          return typeof value === 'number' ? value : null;
        })
        .filter((v): v is number => v !== null);

      if (weights.length > 0) {
        const avg = totalWeight / validWeightCount;
        const variance = weights.reduce((sum, w) => sum + Math.pow(w - avg, 2), 0) / weights.length;
        weightStats = {
          min: Math.min(...weights),
          max: Math.max(...weights),
          avg,
          stdDev: Math.sqrt(variance)
        };
        console.log('Weight field statistics:', weightStats);
      }
    }

    // Create feature layer with heatmap renderer
    console.log('Creating feature layer with heatmap renderer');
    const layerStartTime = performance.now();

    try {
      const layer = new FeatureLayer({
        title: options.title || this.title,
        source: validPoints,
        renderer: new HeatmapRenderer({
          field: data.weightField || "cluster_count",
          colorStops: [
            { ratio: 0, color: [255, 255, 255, 0] },
            { ratio: 0.2, color: [255, 255, 0, 0.5] },
            { ratio: 0.4, color: [255, 170, 0, DEFAULT_FILL_ALPHA] },
            { ratio: 0.6, color: [255, 85, 0, 0.9] },
            { ratio: 0.8, color: [255, 0, 0, 0.95] },
            { ratio: 1, color: [178, 0, 0, 1] }
          ],
          radius: data.radius,
          minDensity: data.minDensity ?? (weightStats?.min || 0),
          maxDensity: data.maxDensity ?? (weightStats?.max || 100),
          legendOptions: {
            title: data.weightField ? `Heat Intensity (${data.weightField})` : "Heat Intensity",
            minLabel: "Low",
            maxLabel: "High"
          }
        }),
        opacity: options.opacity || 0.7,
        visible: options.visible ?? true,
        popupTemplate: {
          title: "{DESCRIPTION}",
          content: [
            {
              type: "fields",
              fieldInfos: [
                ...(data.weightField ? [{
                  fieldName: data.weightField,
                  label: "Weight",
                  format: {
                    digitSeparator: true,
                    places: 2
                  }
                }] : []),
                {
                  fieldName: "x",
                  label: "Longitude",
                  format: {
                    digitSeparator: false,
                    places: 6
                  }
                },
                {
                  fieldName: "y",
                  label: "Latitude",
                  format: {
                    digitSeparator: false,
                    places: 6
                  }
                }
              ]
            }
          ]
        }
      });

      // Calculate extent from valid points
      let extent: __esri.Extent | null = null;
      try {
        if (validPoints[0]?.geometry?.extent) {
          extent = validPoints[0].geometry.extent.clone();
          validPoints.forEach(point => {
            if (point.geometry?.extent) {
              extent?.union(point.geometry.extent);
            }
          });
          // Add padding to extent for better visualization of heatmap
          extent.expand(1.5);
        } else {
          throw new Error('First point has no valid extent');
        }
      } catch (error) {
        console.error('Error calculating extent:', error);
        throw new Error('Failed to calculate extent from points');
      }

      if (!extent) {
        throw new Error('Failed to calculate valid extent');
      }

      // Wait for layer to load and validate
      await layer.load();
      const layerEndTime = performance.now();
      console.log('Layer loaded successfully:', {
        id: layer.id,
        title: layer.title,
        loaded: layer.loaded,
        geometryType: layer.geometryType,
        features: validPoints.length,
        spatialReference: layer.spatialReference?.wkid,
        loadTimeMs: (layerEndTime - layerStartTime).toFixed(2)
      });

      const endTime = performance.now();
      console.log('=== Density Visualization Complete ===');
      console.log('Performance metrics:', {
        totalTimeMs: (endTime - startTime).toFixed(2),
        validationTimeMs: (validationTime - startTime).toFixed(2),
        layerCreationTimeMs: (layerEndTime - layerStartTime).toFixed(2)
      });

      return { layer, extent };
    } catch (error) {
      console.error('Error creating density layer:', error);
      throw new Error('Failed to create density visualization layer');
    }
  }

  getRenderer(): __esri.Renderer {
    return new HeatmapRenderer({
      colorStops: [
        { ratio: 0, color: [255, 255, 255, 0] },
        { ratio: 0.2, color: [255, 255, 0, 0.5] },
        { ratio: 0.4, color: [255, 170, 0, DEFAULT_FILL_ALPHA] },
        { ratio: 0.6, color: [255, 85, 0, 0.9] },
        { ratio: 0.8, color: [255, 0, 0, 0.95] },
        { ratio: 1, color: [178, 0, 0, 1] }
      ],
      radius: 10
    });
  }

  getLegendInfo(): StandardizedLegendData {
    return {
      title: "Density Heatmap",
      type: "class-breaks",
      description: "Shows density of points across the map",
      items: [
        { ratio: 0, color: [255, 255, 255, 0], label: "Low" },
        { ratio: 0.5, color: [255, 170, 0, DEFAULT_FILL_ALPHA], label: "Medium" },
        { ratio: 1, color: [178, 0, 0, 1], label: "High" }
      ].map(stop => ({
        label: stop.label,
        color: `rgba(${stop.color.join(',')})`,
        shape: 'square',
        size: 16
      }))
    };
  }
}