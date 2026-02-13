import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Renderer from '@arcgis/core/renderers/Renderer';
import UniqueValueRenderer from '@arcgis/core/renderers/UniqueValueRenderer';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import Extent from '@arcgis/core/geometry/Extent';
import { BaseVisualization, BaseVisualizationData, VisualizationOptions, VisualizationResult } from './base-visualization';
import Color from '@arcgis/core/Color';
import Graphic from '@arcgis/core/Graphic';
import { StandardizedLegendData } from '@/types/legend';
import { FieldMappingHelper } from './field-mapping-helper';

export interface BivariateData extends BaseVisualizationData {
  features: __esri.Graphic[];
  field1: string;
  field2: string;
  field1Label: string;
  field2Label: string;
  field1Breaks?: number[];
  field2Breaks?: number[];
}

interface ColorMatrix {
  [key: string]: number[];
}

export class BivariateVisualization extends BaseVisualization<BivariateData> {
  protected renderer: Renderer;
  protected title: string = 'Bivariate Analysis';
  private colorMatrix: { [key: string]: [number, number, number, number] };

  constructor() {
    super();
    this.renderer = new UniqueValueRenderer();
    this.colorMatrix = this.createColorMatrix();
  }

  private calculateBreaks(values: number[], numBreaks: number = 3): number[] {
    console.log('Calculating breaks:', {
      totalValues: values.length,
      numBreaks,
      sampleValues: values.slice(0, 5)
    });

    const sortedValues = values.sort((a, b) => a - b);
    const breaks: number[] = [];
    
    for (let i = 1; i < numBreaks; i++) {
      const index = Math.floor((i / numBreaks) * sortedValues.length);
      breaks.push(sortedValues[index]);
    }

    console.log('Calculated breaks:', {
      breaks,
      min: sortedValues[0],
      max: sortedValues[sortedValues.length - 1]
    });
    
    return breaks;
  }

  private getBivariateClass(value1: number, value2: number, breaks1: number[], breaks2: number[]): string {
    const getLevel = (value: number, breaks: number[]): string => {
      if (value <= breaks[0]) return 'low';
      if (value <= breaks[1]) return 'med';
      return 'high';
    };

    const level1 = getLevel(value1, breaks1);
    const level2 = getLevel(value2, breaks2);
    
    return `${level1}-${level2}`;
  }

  private createColorMatrix(): { [key: string]: [number, number, number, number] } {
    return {
      'low-low': [247, 247, 247, 255],     // Light gray
      'low-med': [201, 148, 199, 255],     // Light purple
      'low-high': [122, 1, 119, 255],      // Dark purple
      'med-low': [166, 219, 160, 255],     // Light green
      'med-med': [140, 136, 140, 255],     // Medium gray
      'med-high': [90, 0, 101, 255],       // Dark purple-green
      'high-low': [0, 136, 55, 255],       // Dark green
      'high-med': [27, 120, 55, 255],      // Medium green
      'high-high': [0, 68, 27, 255]        // Darkest green
    };
  }

  async create(data: BivariateData, options?: VisualizationOptions): Promise<VisualizationResult> {
    const startTime = performance.now();
    console.log('=== Bivariate Visualization Create ===');

    // Validate input data
    this.validateData(data);

    // Calculate breaks for both fields
    const breaks1 = this.calculateBreaks(data.features.map(f => f.attributes[data.field1]), data.field1Breaks?.length || 3);
    const breaks2 = this.calculateBreaks(data.features.map(f => f.attributes[data.field2]), data.field2Breaks?.length || 3);

    // Filter out features with invalid values
    const validFeatures = data.features.filter(feature => {
      const value1 = feature.attributes[data.field1];
      const value2 = feature.attributes[data.field2];
      return typeof value1 === 'number' && !isNaN(value1) &&
             typeof value2 === 'number' && !isNaN(value2);
    });

    if (validFeatures.length === 0) {
      throw new Error('No valid features found for bivariate analysis');
    }

    // Process features with field mapping
    const processedFeatures = validFeatures.map(feature => {
      const mappedFeature = this.mapFeature(feature);
      const value1 = feature.attributes[data.field1];
      const value2 = feature.attributes[data.field2];
      const bivariateClass = this.getBivariateClass(value1, value2, breaks1, breaks2);
      
      mappedFeature.attributes.bivariateBin = bivariateClass;
      mappedFeature.attributes.field1_class = this.getLevel(value1, breaks1);
      mappedFeature.attributes.field2_class = this.getLevel(value2, breaks2);
      
      return mappedFeature;
    });

    // Create unique value renderer
    const uniqueValueInfos = Object.entries(this.colorMatrix).map(([key, color]) => ({
      value: key,
      symbol: new SimpleFillSymbol({
        color: new Color(color),
        outline: {
          color: [128, 128, 128, 0.5],
          width: 0.5
        }
      })
    }));

    // Update renderer
    this.renderer = new UniqueValueRenderer({
      field: "bivariateBin",
      defaultSymbol: new SimpleFillSymbol({
        color: [200, 200, 200, 0.5],
        outline: {
          color: [128, 128, 128, 0.5],
          width: 0.5
        }
      }),
      uniqueValueInfos
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

  private getLevel(value: number, breaks: number[]): string {
    if (value <= breaks[0]) return 'low';
    if (value <= breaks[1]) return 'med';
    return 'high';
  }

  getRenderer(): Renderer {
    return this.renderer;
  }

  getLegendInfo(): StandardizedLegendData {
    // Use standardized field mapping for legend description
    const field1Name = this.data?.field1 ? FieldMappingHelper.getFriendlyFieldName(this.data.field1) : 'Variable 1';
    const field2Name = this.data?.field2 ? FieldMappingHelper.getFriendlyFieldName(this.data.field2) : 'Variable 2';
    
    return {
      title: this.title,
      type: 'class-breaks',
      description: `Bivariate analysis showing relationship between ${field1Name} and ${field2Name}`,
      items: Object.entries(this.colorMatrix).map(([key, color]) => ({
        label: key.replace('-', ' / ').toUpperCase(),
        color: `rgba(${color.join(',')})`,
        shape: 'square',
        size: 16
      }))
    };
  }
} 