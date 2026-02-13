import { DEFAULT_FILL_ALPHA } from "./constants";
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import ClassBreaksRenderer from '@arcgis/core/renderers/ClassBreaksRenderer';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import { VisualizationOptions, BaseVisualization, BaseVisualizationData, VisualizationResult } from './base-visualization';
import Color from '@arcgis/core/Color';
import { isFinite } from 'lodash';
import SpatialReference from '@arcgis/core/geometry/SpatialReference';
import { quantile } from 'd3-array';
import { StandardizedLegendData } from '@/types/legend';
import { FieldMappingHelper } from './field-mapping-helper';

interface ChoroplethData extends BaseVisualizationData {
  field: string;
  breaks: number[];
  colorScheme: 'sequential' | 'diverging' | 'qualitative';
}

interface ColorScheme {
  colors: number[][];
  labels: string[];
}

interface ColorSchemes {
  sequential: ColorScheme;
  diverging: ColorScheme;
  qualitative: ColorScheme;
}

export class ChoroplethVisualization extends BaseVisualization<ChoroplethData> {
  protected renderer: ClassBreaksRenderer | null = null;
  private colorSchemes: ColorSchemes = {
    sequential: {
      colors: [
        [237, 248, 251],
        [179, 205, 227],
        [140, 150, 198],
        [136, 86, 167],
        [129, 15, 124]
      ],
      labels: ['Very Low', 'Low', 'Medium', 'High', 'Very High']
    },
    diverging: {
      colors: [
        [215, 48, 39],
        [252, 141, 89],
        [254, 224, 144],
        [145, 207, 96],
        [26, 152, 80]
      ],
      labels: ['Strongly Negative', 'Negative', 'Neutral', 'Positive', 'Strongly Positive']
    },
    qualitative: {
      colors: [
        [166, 206, 227],
        [31, 120, 180],
        [178, 223, 138],
        [51, 160, 44],
        [251, 154, 153]
      ],
      labels: ['Category 1', 'Category 2', 'Category 3', 'Category 4', 'Category 5']
    }
  };

  private validateInputData(data: ChoroplethData): void {
    const validation = {
      hasField: !!data.field,
      field: data.field,
      hasBreaks: !!data.breaks?.length,
      breakCount: data.breaks?.length || 0,
      hasValidColorScheme: ['sequential', 'diverging', 'qualitative'].includes(data.colorScheme),
      colorScheme: data.colorScheme
    };

    if (!validation.hasField) {
      throw new Error('No field specified for choropleth visualization');
    }

    if (!validation.hasBreaks) {
      throw new Error('No breaks specified for choropleth visualization');
    }

    if (!validation.hasValidColorScheme) {
      throw new Error(`Invalid color scheme: ${data.colorScheme}. Must be one of: sequential, diverging, qualitative`);
    }
  }

  private calculateBreaks(features: __esri.Graphic[], field: string, numBreaks: number): number[] {
    const values = features
      .map(f => f.attributes[field])
      .filter(v => typeof v === 'number' && isFinite(v))
      .sort((a, b) => a - b);

    if (values.length === 0) {
      throw new Error(`No valid values found for field: ${field}`);
    }

    const breaks = [];
    for (let i = 0; i <= numBreaks; i++) {
      breaks.push(quantile(values, i / numBreaks) || 0);
    }

    return breaks;
  }

  protected async initializeLayer(data: ChoroplethData, options: VisualizationOptions = {}): Promise<void> {
    // Calculate breaks if not provided
    const breaks = data.breaks.length > 0 ? data.breaks : this.calculateBreaks(data.features, data.field, 5);
    
    // Create renderer
    const scheme = this.colorSchemes[data.colorScheme];
    this.renderer = new ClassBreaksRenderer({
      field: data.field,
      defaultSymbol: new SimpleFillSymbol({
        color: [200, 200, 200, 0.5],
        outline: {
          color: [128, 128, 128, 0.5],
          width: "0.5px"
        }
      }),
      classBreakInfos: breaks.map((break_, index) => ({
        minValue: break_,
        maxValue: data.breaks[index + 1] || Infinity,
        symbol: new SimpleFillSymbol({
          color: new Color(scheme.colors[index]),
          outline: {
            color: [128, 128, 128, 0.5],
            width: "0.5px"
          }
        }),
        label: `${scheme.labels[index]} (${break_.toFixed(1)} - ${
          data.breaks[index + 1]?.toFixed(1) || '∞'
        })`
      }))
    });

    // Create feature layer
    this.layer = new FeatureLayer({
      title: options.title || "Choropleth Analysis",
      source: data.features.map(feature => this.mapFeature(feature)),
      renderer: this.renderer,
      opacity: options.opacity ?? 0.7,
      visible: options.visible ?? true,
      popupTemplate: {
        title: "{" + data.field + "}",
        content: [
          {
            type: "fields",
            fieldInfos: [
              {
                fieldName: data.field,
                label: data.field,
                format: {
                  places: 2,
                  digitSeparator: true
                }
              }
            ]
          }
        ]
      }
    });

    // Calculate extent using base class's method
    await this.calculateExtent(data.features);
  }

  async create(data: ChoroplethData, options: VisualizationOptions = {}): Promise<VisualizationResult> {
    // Validate input data
    this.validateData(data);
    this.validateInputData(data);

    // Initialize layer using overridden initializeLayer method
    await this.initializeLayer(data, options);

    return {
      layer: this.layer!,
      extent: this.extent!,
      renderer: this.renderer || undefined,
      legendInfo: this.getLegendInfo()
    };
  }

  getLegendInfo(): StandardizedLegendData {
    const renderer = this.renderer;
    
    // Use standardized field mapping for legend description
    const fieldName = this.data?.field ? FieldMappingHelper.getFriendlyFieldName(this.data.field) : 'values';
    
    return {
      title: this.layer?.title || "Choropleth Analysis",
      type: "class-breaks",
      description: `Choropleth visualization showing distribution of ${fieldName}`,
      items: renderer?.classBreakInfos.map(info => ({
        label: info.label ?? '',
        color: `rgba(${(info.symbol as SimpleFillSymbol).color.toRgba().join(',')})`,
        outlineColor: 'rgba(128, 128, 128, 0.5)',
        shape: 'square' as const,
        size: 16
      })) || []
    };
  }
} 