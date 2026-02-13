import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Graphic from '@arcgis/core/Graphic';
import { BaseVisualization, VisualizationOptions } from './base-visualization';
import { ClassBreaksRenderer } from '@arcgis/core/renderers';

export interface FactorImportanceData {
  factors: Array<{
    name: string;
    importance: number;
    correlation: number;
    description: string;
    exampleAreas: string[];
  }>;
  features: any[];
  layerName: string;
  targetVariable: string;
}

export interface FactorImportanceOptions extends VisualizationOptions {
  showTopN?: number;
  colorScheme?: 'importance' | 'correlation';
  includeGeographicView?: boolean;
}

export class FactorImportanceVisualization extends BaseVisualization<FactorImportanceData> {
  protected title: string = 'Factor Importance Analysis';

  constructor() {
    super();
  }

  async create(
    data: FactorImportanceData,
    options: FactorImportanceOptions = {}
  ): Promise<{ layer: FeatureLayer; extent: __esri.Extent }> {
    
    // Sort factors by importance
    const sortedFactors = data.factors
      .sort((a, b) => b.importance - a.importance)
      .slice(0, options.showTopN || 5);

    // Create geographic visualization showing the most important factor
    const primaryFactor = sortedFactors[0];
    
    // Convert features to show the primary factor's influence
    const processedFeatures = data.features.map((feature, index) => {
      const factorValue = feature.properties?.[primaryFactor.name] || 
                         feature.attributes?.[primaryFactor.name] || 0;
      
      return new Graphic({
        geometry: feature.geometry,
        attributes: {
          OBJECTID: index + 1,
          factor_name: primaryFactor.name,
          factor_value: factorValue,
          factor_importance: primaryFactor.importance,
          target_variable: data.targetVariable,
          ...feature.attributes,
          ...feature.properties
        }
      });
    });

    // Create renderer based on factor importance
    const renderer = this.createFactorRenderer(primaryFactor, options.colorScheme);

    // Create the feature layer
    const layer = new FeatureLayer({
      source: processedFeatures,
      fields: this.createFactorFields(data),
      renderer: renderer,
      title: `${data.targetVariable} - Primary Factor: ${primaryFactor.name}`,
      popupTemplate: this.createFactorPopupTemplate(data, sortedFactors)
    });

    // Calculate extent
    const extent = await this.calculateExtent(processedFeatures);
    if (!extent) {
      throw new Error('Could not calculate extent for features');
    }

    return { layer, extent };
  }

  private createFactorRenderer(primaryFactor: any, colorScheme: string = 'importance') {
    return new ClassBreaksRenderer({
      field: 'factor_value',
      classBreakInfos: [
        {
          minValue: 0,
          maxValue: 0.2,
          symbol: {
            type: 'simple-fill',
            color: [255, 245, 240, 0.8],
            outline: { color: [0, 0, 0, 0], width: 0 }
          },
          label: 'Low Impact'
        },
        {
          minValue: 0.2,
          maxValue: 0.4,
          symbol: {
            type: 'simple-fill',
            color: [254, 224, 210, 0.8],
            outline: { color: [0, 0, 0, 0], width: 0 }
          },
          label: 'Medium-Low Impact'
        },
        {
          minValue: 0.4,
          maxValue: 0.6,
          symbol: {
            type: 'simple-fill',
            color: [252, 187, 161, 0.8],
            outline: { color: [0, 0, 0, 0], width: 0 }
          },
          label: 'Medium Impact'
        },
        {
          minValue: 0.6,
          maxValue: 0.8,
          symbol: {
            type: 'simple-fill',
            color: [252, 146, 114, 0.8],
            outline: { color: [0, 0, 0, 0], width: 0 }
          },
          label: 'High Impact'
        },
        {
          minValue: 0.8,
          maxValue: 1,
          symbol: {
            type: 'simple-fill',
            color: [222, 45, 38, 0.8],
            outline: { color: [0, 0, 0, 0], width: 0 }
          },
          label: 'Very High Impact'
        }
      ]
    });
  }

  private createFactorFields(data: FactorImportanceData) {
    return [
      { name: 'OBJECTID', type: 'oid' as const, alias: 'Object ID' },
      { name: 'factor_name', type: 'string' as const, alias: 'Primary Factor' },
      { name: 'factor_value', type: 'double' as const, alias: 'Factor Value' },
      { name: 'factor_importance', type: 'double' as const, alias: 'Importance Score' },
      { name: 'target_variable', type: 'string' as const, alias: 'Target Variable' }
    ];
  }

  private createFactorPopupTemplate(data: FactorImportanceData, factors: any[]) {
    const factorContent = factors.map((factor, index) => 
      `<strong>#${index + 1}: ${factor.name}</strong><br/>
       Importance: ${(factor.importance * 100).toFixed(1)}%<br/>
       Correlation: ${factor.correlation.toFixed(3)}<br/>
       ${factor.description}<br/><br/>`
    ).join('');

    return {
      title: `Factor Analysis: {target_variable}`,
      content: `
        <div style="max-width: 300px;">
          <h4>Top Predictive Factors:</h4>
          ${factorContent}
          <hr/>
          <strong>Primary Factor Value:</strong> {factor_value}<br/>
          <strong>Location Impact:</strong> {factor_importance}
        </div>
      `
    };
  }

  getLegendInfo() {
    return {
      title: 'Factor Importance',
      type: 'class-breaks' as const,
      items: [
        { label: 'Very High Impact', color: '#de2d26', value: '0.8 - 1.0' },
        { label: 'High Impact', color: '#fc9272', value: '0.6 - 0.8' },
        { label: 'Medium Impact', color: '#fcbba1', value: '0.4 - 0.6' },
        { label: 'Medium-Low Impact', color: '#fee0d2', value: '0.2 - 0.4' },
        { label: 'Low Impact', color: '#fff5f0', value: '0.0 - 0.2' }
      ]
    };
  }
} 