import { DEFAULT_FILL_ALPHA } from "./constants";
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Renderer from '@arcgis/core/renderers/Renderer';
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import Extent from '@arcgis/core/geometry/Extent';
import { BaseVisualization, BaseVisualizationData, VisualizationOptions, VisualizationResult } from './base-visualization';
import { buffer, union } from '@arcgis/core/geometry/geometryEngine';
import Graphic from '@arcgis/core/Graphic';
import OpacityVariable from '@arcgis/core/renderers/visualVariables/OpacityVariable';
import { StandardizedLegendData } from '@/types/legend';

export interface ProximityData extends BaseVisualizationData {
  features: __esri.Graphic[];
  distanceField: string;
  maxDistance?: number;
  units?: string;
}

export class ProximityVisualization extends BaseVisualization<ProximityData> {
  protected renderer: Renderer;
  protected title: string = 'Proximity Analysis';

  constructor() {
    super();
    this.renderer = new SimpleRenderer({
      symbol: new SimpleFillSymbol({
        color: [0, 0, 0, 0],
        outline: { color: [0, 0, 0, 0], width: 0 }
      }),
      visualVariables: [
        new OpacityVariable({
          field: "distance",
          stops: [
            { value: 0, opacity: 0.7 },
            { value: 1, opacity: 0.3 }
          ]
        })
      ]
    });
  }

  async create(data: ProximityData, options?: VisualizationOptions): Promise<VisualizationResult> {
    // Validate input data
    this.validateData(data);

    // Process features with field mapping
    const processedFeatures = data.features.map(feature => this.mapFeature(feature));

    // Calculate distances and create opacity variable
    const maxDistance = data.maxDistance || Math.max(...processedFeatures.map(f => f.attributes[data.distanceField] || 0));
    const opacityVariable = new OpacityVariable({
      field: data.distanceField,
      stops: [
        { value: 0, opacity: 0.7 },
        { value: maxDistance, opacity: 0.3 }
      ]
    });

    // Update renderer
    this.renderer = new SimpleRenderer({
      symbol: new SimpleFillSymbol({
        color: options?.symbolConfig?.color || [0, 122, 194, 0.8],
        outline: {
          color: options?.symbolConfig?.outline?.color || [255, 255, 255, 0.8],
          width: 0
        }
      }),
      visualVariables: [opacityVariable]
    });

    // Initialize layer with processed features
    await this.initializeLayer({
      ...data,
      features: processedFeatures
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

  getLegendInfo(): StandardizedLegendData {
    return {
      title: this.title,
      type: "class-breaks",
      description: "Proximity analysis showing distance relationships",
      items: [{
        label: 'Proximity',
        color: 'rgba(0, 116, 217, DEFAULT_FILL_ALPHA)',
        shape: 'square',
        size: 16
      }]
    };
  }
} 