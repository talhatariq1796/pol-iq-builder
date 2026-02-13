import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Graphic from '@arcgis/core/Graphic';
import { BaseVisualization, VisualizationOptions, VisualizationResult, BaseVisualizationData } from './base-visualization';
import { ClassBreaksRenderer } from '@arcgis/core/renderers';

export interface FeatureInteractionData extends BaseVisualizationData {
  interactions: Array<{
    feature_1: string;
    feature_2: string;
    interaction_strength: number;
    interaction_type: 'synergistic' | 'antagonistic' | 'conditional';
    correlation_between_features: number;
    individual_importance_1: number;
    individual_importance_2: number;
    example_areas: Array<{
      area: string;
      feature_1_value: number;
      feature_2_value: number;
      interaction_strength: number;
    }>;
  }>;
  target_variable: string;
  model_performance: number;
  features_analyzed: string[];
  strong_interactions_count: number;
}

export interface FeatureInteractionOptions extends VisualizationOptions {
  primaryField?: string;
  shapData?: FeatureInteractionData;
  showTopInteractions?: number;
}

export class FeatureInteractionVisualization extends BaseVisualization<FeatureInteractionData> {
  protected title: string = 'Feature Interactions Analysis';

  constructor() {
    super();
  }

  // Required abstract method implementation
  async create(
    data: FeatureInteractionData,
    options: FeatureInteractionOptions = {}
  ): Promise<VisualizationResult> {
    try {
      console.log('[FeatureInteractionVisualization] Creating feature interaction visualization');
      
      if (!data || !data.features || data.features.length === 0) {
        throw new Error('No features provided for feature interaction visualization');
      }

      // Check for SHAP interaction data
      if (!data.interactions || data.interactions.length === 0) {
        console.warn('[FeatureInteractionVisualization] No SHAP interaction data available, creating basic visualization');
        return this.createBasicInteractionVisualization(data, options);
      }

      // Get the strongest interaction for primary visualization
      const primaryInteraction = data.interactions[0];
      const primaryField = options.primaryField || primaryInteraction.feature_1;

      console.log(`[FeatureInteractionVisualization] Primary interaction: ${primaryInteraction.feature_1} × ${primaryInteraction.feature_2}`);

      // Process features to include interaction scores
      const processedFeatures = this.processFeatures(data, primaryInteraction);

      // Create the feature layer
      const layer = new FeatureLayer({
        source: processedFeatures,
        fields: this.createInteractionFields(data),
        renderer: this.createInteractionRenderer(primaryInteraction),
        title: options.title || `Feature Interactions: ${primaryInteraction.feature_1} × ${primaryInteraction.feature_2}`,
        popupTemplate: this.createInteractionPopupTemplate(data, primaryInteraction)
      });

      // Calculate extent
      const extent = await this.calculateExtent(processedFeatures);
      if (!extent) {
        throw new Error('Could not calculate extent for feature interaction visualization');
      }

      console.log('[FeatureInteractionVisualization] Visualization created successfully');

      return { layer, extent };

    } catch (error) {
      console.error('[FeatureInteractionVisualization] Error creating visualization:', error);
      return { layer: null, extent: null };
    }
  }

  // Legacy method for compatibility with visualization factory
  async createVisualization(
    features: any[],
    options: FeatureInteractionOptions
  ): Promise<VisualizationResult> {
    // Convert legacy format to new format
    const data: FeatureInteractionData = {
      features: features,
      layerName: options.title || 'Feature Interactions',
      interactions: options.shapData?.interactions || [],
      target_variable: options.shapData?.target_variable || 'unknown',
      model_performance: options.shapData?.model_performance || 0,
      features_analyzed: options.shapData?.features_analyzed || [],
      strong_interactions_count: options.shapData?.strong_interactions_count || 0
    };

    return this.create(data, options);
  }

  private processFeatures(
    data: FeatureInteractionData,
    primaryInteraction: any
  ): Graphic[] {
    const processedFeatures: Graphic[] = [];

    data.features.forEach((feature, index) => {
      if (!feature || !feature.geometry) {
        console.warn(`Feature ${index} missing geometry, skipping`);
        return;
      }

      const attributes = feature.attributes || {};
      
      // Get values for the primary interaction features
      const feature1Value = this.getFeatureValue(attributes, primaryInteraction.feature_1);
      const feature2Value = this.getFeatureValue(attributes, primaryInteraction.feature_2);
      
      // Calculate interaction score based on feature values and interaction type
      const interactionScore = this.calculateInteractionScore(
        feature1Value, 
        feature2Value, 
        primaryInteraction
      );

      // Determine interaction category for visualization
      const interactionCategory = this.categorizeInteraction(interactionScore, primaryInteraction);

      const processedFeature = new Graphic({
        geometry: feature.geometry,
        attributes: {
          OBJECTID: index + 1,
          ...attributes,
          // Primary interaction features
          feature_1_name: primaryInteraction.feature_1,
          feature_2_name: primaryInteraction.feature_2,
          feature_1_value: feature1Value,
          feature_2_value: feature2Value,
          // Interaction metrics
          interaction_score: interactionScore,
          interaction_type: primaryInteraction.interaction_type,
          interaction_category: interactionCategory,
          interaction_strength: primaryInteraction.interaction_strength,
          // Additional context
          target_variable: data.target_variable,
          model_performance: data.model_performance
        }
      });

      processedFeatures.push(processedFeature);
    });

    console.log(`[FeatureInteractionVisualization] Processed ${processedFeatures.length} features`);
    return processedFeatures;
  }

  private getFeatureValue(attributes: any, fieldName: string): number {
    // Try direct match first
    if (attributes[fieldName] !== undefined) {
      return Number(attributes[fieldName]) || 0;
    }

    // Try normalized field names
    const normalizedFieldName = fieldName.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    for (const [key, value] of Object.entries(attributes)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalizedKey === normalizedFieldName) {
        return Number(value) || 0;
      }
    }

    console.warn(`[FeatureInteractionVisualization] Field '${fieldName}' not found in attributes`);
    return 0;
  }

  private calculateInteractionScore(
    value1: number, 
    value2: number, 
    interaction: any
  ): number {
    // Normalize values to 0-1 range for consistent scoring
    const normalizedValue1 = Math.min(Math.max(value1 / 100, 0), 1);
    const normalizedValue2 = Math.min(Math.max(value2 / 100, 0), 1);

    switch (interaction.interaction_type) {
      case 'synergistic':
        // Both features amplify each other - multiply normalized values
        return normalizedValue1 * normalizedValue2 * interaction.interaction_strength;
      
      case 'antagonistic':
        // Features partially cancel each other - difference weighted by strength
        return Math.abs(normalizedValue1 - normalizedValue2) * interaction.interaction_strength;
      
      case 'conditional':
        // Effect depends on context - average weighted by strength
        return ((normalizedValue1 + normalizedValue2) / 2) * interaction.interaction_strength;
      
      default:
        return (normalizedValue1 + normalizedValue2) / 2;
    }
  }

  private categorizeInteraction(score: number, interaction: any): string {
    const type = interaction.interaction_type;
    
    if (score >= 0.8) return `Very Strong ${type}`;
    if (score >= 0.6) return `Strong ${type}`;
    if (score >= 0.4) return `Moderate ${type}`;
    if (score >= 0.2) return `Weak ${type}`;
    return `Minimal ${type}`;
  }

  private createBasicInteractionVisualization(
    data: FeatureInteractionData,
    options: FeatureInteractionOptions
  ): VisualizationResult {
    console.log('[FeatureInteractionVisualization] Creating basic visualization without SHAP data');
    
    const processedFeatures = data.features.map((feature, index) => {
      return new Graphic({
        geometry: feature.geometry,
        attributes: {
          OBJECTID: index + 1,
          ...(feature.attributes || {}),
          interaction_note: 'SHAP interaction data not available'
        }
      });
    });

    const layer = new FeatureLayer({
      source: processedFeatures,
      fields: [
        { name: 'OBJECTID', type: 'oid', alias: 'Object ID' },
        { name: 'interaction_note', type: 'string', alias: 'Note' }
      ],
      renderer: {
        type: 'simple',
        symbol: {
          type: 'simple-fill',
          color: [200, 200, 200, 0.6],
          outline: { color: [0, 0, 0, 0], width: 0 }
        }
      } as any,
      title: options.title || 'Feature Interactions (Basic)',
      popupTemplate: {
        title: 'Feature Interaction Analysis',
        content: 'SHAP interaction data not available for detailed analysis.'
      }
    });

    return { layer, extent: null };
  }

  private createInteractionFields(data: FeatureInteractionData) {
    return [
      { name: 'OBJECTID', type: 'oid' as const, alias: 'Object ID' },
      { name: 'feature_1_name', type: 'string' as const, alias: 'Feature 1' },
      { name: 'feature_2_name', type: 'string' as const, alias: 'Feature 2' },
      { name: 'feature_1_value', type: 'double' as const, alias: 'Feature 1 Value' },
      { name: 'feature_2_value', type: 'double' as const, alias: 'Feature 2 Value' },
      { name: 'interaction_score', type: 'double' as const, alias: 'Interaction Score' },
      { name: 'interaction_type', type: 'string' as const, alias: 'Interaction Type' },
      { name: 'interaction_category', type: 'string' as const, alias: 'Interaction Category' },
      { name: 'interaction_strength', type: 'double' as const, alias: 'Interaction Strength' },
      { name: 'target_variable', type: 'string' as const, alias: 'Target Variable' },
      { name: 'model_performance', type: 'double' as const, alias: 'Model Performance' }
    ];
  }

  private createInteractionRenderer(primaryInteraction: any) {
    // Create color scheme based on interaction type
    const colors = this.getInteractionColors(primaryInteraction.interaction_type);

    return new ClassBreaksRenderer({
      field: 'interaction_score',
      classBreakInfos: [
        {
          minValue: 0,
          maxValue: 0.2,
          symbol: {
            type: 'simple-fill',
            color: colors.minimal,
            outline: { color: [0, 0, 0, 0], width: 0 }
          },
          label: `Minimal ${primaryInteraction.interaction_type}`
        },
        {
          minValue: 0.2,
          maxValue: 0.4,
          symbol: {
            type: 'simple-fill',
            color: colors.weak,
            outline: { color: [0, 0, 0, 0], width: 0 }
          },
          label: `Weak ${primaryInteraction.interaction_type}`
        },
        {
          minValue: 0.4,
          maxValue: 0.6,
          symbol: {
            type: 'simple-fill',
            color: colors.moderate,
            outline: { color: [0, 0, 0, 0], width: 0 }
          },
          label: `Moderate ${primaryInteraction.interaction_type}`
        },
        {
          minValue: 0.6,
          maxValue: 0.8,
          symbol: {
            type: 'simple-fill',
            color: colors.strong,
            outline: { color: [0, 0, 0, 0], width: 0 }
          },
          label: `Strong ${primaryInteraction.interaction_type}`
        },
        {
          minValue: 0.8,
          maxValue: 1,
          symbol: {
            type: 'simple-fill',
            color: colors.veryStrong,
            outline: { color: [0, 0, 0, 0], width: 0 }
          },
          label: `Very Strong ${primaryInteraction.interaction_type}`
        }
      ]
    });
  }

  private getInteractionColors(interactionType: string) {
    switch (interactionType) {
      case 'synergistic':
        return {
          minimal: [255, 245, 240, 0.7],
          weak: [254, 224, 210, 0.7],
          moderate: [252, 187, 161, 0.7],
          strong: [252, 146, 114, 0.7],
          veryStrong: [222, 45, 38, 0.8]
        };
      case 'antagonistic':
        return {
          minimal: [247, 252, 245, 0.7],
          weak: [229, 245, 224, 0.7],
          moderate: [199, 233, 192, 0.7],
          strong: [161, 217, 155, 0.7],
          veryStrong: [49, 163, 84, 0.8]
        };
      case 'conditional':
        return {
          minimal: [255, 247, 243, 0.7],
          weak: [253, 224, 221, 0.7],
          moderate: [252, 197, 192, 0.7],
          strong: [250, 159, 181, 0.7],
          veryStrong: [197, 27, 125, 0.8]
        };
      default:
        return {
          minimal: [240, 240, 240, 0.7],
          weak: [189, 189, 189, 0.7],
          moderate: [150, 150, 150, 0.7],
          strong: [99, 99, 99, 0.7],
          veryStrong: [37, 37, 37, 0.8]
        };
    }
  }

  private createInteractionPopupTemplate(data: FeatureInteractionData, primaryInteraction: any) {
    const topInteractions = data.interactions.slice(0, 3);
    
    const interactionsList = topInteractions.map((interaction, index) => 
      `<strong>#${index + 1}: ${interaction.feature_1} × ${interaction.feature_2}</strong><br/>
       Type: ${interaction.interaction_type}<br/>
       Strength: ${(interaction.interaction_strength * 100).toFixed(1)}%<br/>
       Correlation: ${interaction.correlation_between_features.toFixed(3)}<br/><br/>`
    ).join('');

    return {
      title: `Feature Interaction: {feature_1_name} × {feature_2_name}`,
      content: `
        <div style="max-width: 350px;">
          <h4>Primary Interaction Analysis</h4>
          <strong>Feature 1:</strong> {feature_1_name} = {feature_1_value}<br/>
          <strong>Feature 2:</strong> {feature_2_name} = {feature_2_value}<br/>
          <strong>Interaction Type:</strong> {interaction_type}<br/>
          <strong>Interaction Score:</strong> {interaction_score}<br/>
          <strong>Category:</strong> {interaction_category}<br/>
          <hr/>
          <h4>Top Feature Interactions (${data.target_variable})</h4>
          ${interactionsList}
          <hr/>
          <strong>Model Performance:</strong> ${(data.model_performance * 100).toFixed(1)}%<br/>
          <strong>Features Analyzed:</strong> ${data.features_analyzed.length}<br/>
          <strong>Strong Interactions Found:</strong> ${data.strong_interactions_count}
        </div>
      `
    };
  }

  getLegendInfo() {
    return {
      title: 'Feature Interaction Strength',
      type: 'class-breaks' as const,
      items: [
        { label: 'Very Strong', color: '#de2d26', value: '0.8 - 1.0' },
        { label: 'Strong', color: '#fc9272', value: '0.6 - 0.8' },
        { label: 'Moderate', color: '#fcbba1', value: '0.4 - 0.6' },
        { label: 'Weak', color: '#fee0d2', value: '0.2 - 0.4' },
        { label: 'Minimal', color: '#fff5f0', value: '0.0 - 0.2' }
      ]
    };
  }
} 