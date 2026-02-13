/**
 * MultiEndpointVisualizationRenderer - Advanced visualization for composite analysis
 * 
 * Creates sophisticated visualizations that combine insights from multiple endpoints:
 * 1. Multi-layer overlay maps
 * 2. Comparison dashboards
 * 3. Sequential analysis flows
 * 4. Correlation heat maps
 * 5. Strategic opportunity maps
 */

import { VisualizationResult, VisualizationConfig, LegendConfig } from './types';
import { CompositeAnalysisResult, CompositeInsight } from './CompositeDataProcessor';
import { MergedDataset } from './DatasetMerger';

export interface MultiEndpointVisualizationConfig extends VisualizationConfig {
  strategy: 'overlay' | 'comparison' | 'sequential' | 'correlation';
  primaryLayer: LayerConfig;
  secondaryLayers: LayerConfig[];
  interactionMode: 'synchronized' | 'independent' | 'linked';
  dashboardLayout: 'map_focused' | 'split_view' | 'tabbed' | 'carousel';
  showLegend: boolean;
  enableInteractivity: boolean;
}

export interface LayerConfig {
  endpoint: string;
  visualizationType: 'choropleth' | 'proportional_symbol' | 'cluster' | 'heatmap' | 'categorical';
  field: string;
  colorScheme: string;
  opacity: number;
  showInLegend: boolean;
  popupTemplate?: any;
  classificationMethod?: 'natural_breaks' | 'quantile' | 'equal_interval' | 'manual';
  breakpoints?: number[];
}

export interface CompositeVisualizationResult extends VisualizationResult {
  primaryVisualization: SingleLayerVisualization;
  secondaryVisualizations: SingleLayerVisualization[];
  compositeElements: CompositeElement[];
  interactionControls: InteractionControl[];
  dashboardComponents: DashboardComponent[];
  strategicInsights: VisualInsight[];
}

export interface SingleLayerVisualization {
  endpoint: string;
  layer: any; // ArcGIS layer object
  renderer: any; // ArcGIS renderer
  popupTemplate: any;
  legend: LegendConfig;
  statistics: LayerStatistics;
}

export interface CompositeElement {
  type: 'overlay_effect' | 'comparison_panel' | 'correlation_chart' | 'insight_callout';
  position: 'map_overlay' | 'side_panel' | 'bottom_panel' | 'popup';
  component: any;
  data: any;
  interactivity: boolean;
}

export interface InteractionControl {
  type: 'layer_toggle' | 'opacity_slider' | 'field_selector' | 'time_slider' | 'filter';
  label: string;
  position: 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right';
  component: any;
  defaultValue: any;
}

export interface DashboardComponent {
  type: 'chart' | 'metric_card' | 'ranking_list' | 'insight_panel' | 'recommendation_list';
  title: string;
  data: any;
  position: 'left_panel' | 'right_panel' | 'bottom_panel' | 'modal';
  size: 'small' | 'medium' | 'large';
  component: any;
}

export interface VisualInsight {
  type: 'opportunity_highlight' | 'risk_warning' | 'competitive_gap' | 'growth_potential';
  location?: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  visualization: 'callout' | 'highlight' | 'annotation' | 'popup';
}

export interface LayerStatistics {
  min: number;
  max: number;
  mean: number;
  median: number;
  standardDeviation: number;
  nullCount: number;
  uniqueValues?: number;
}

export class MultiEndpointVisualizationRenderer {
  
  /**
   * Create comprehensive multi-endpoint visualization
   */
  async createCompositeVisualization(
    compositeData: CompositeAnalysisResult,
    mergedDataset: MergedDataset,
    config: MultiEndpointVisualizationConfig
  ): Promise<CompositeVisualizationResult> {
    
    console.log(`[MultiEndpointVisualizationRenderer] Creating composite visualization with strategy: ${config.strategy}`);
    
    try {
      // Create individual layer visualizations
      const primaryVisualization = await this.createPrimaryVisualization(
        compositeData, 
        config.primaryLayer
      );

      const secondaryVisualizations = await Promise.all(
        config.secondaryLayers.map(layerConfig =>
          this.createSecondaryVisualization(compositeData, layerConfig)
        )
      );

      // Create composite elements based on strategy
      const compositeElements = await this.createCompositeElements(
        compositeData,
        config.strategy,
        config.dashboardLayout
      );

      // Create interaction controls
      const interactionControls = this.createInteractionControls(
        config,
        primaryVisualization,
        secondaryVisualizations
      );

      // Create dashboard components
      const dashboardComponents = this.createDashboardComponents(
        compositeData,
        config.dashboardLayout
      );

      // Generate strategic insights
      const strategicInsights = this.generateVisualInsights(compositeData);

      const result: CompositeVisualizationResult = {
        type: `multi_endpoint_${config.strategy}`,
        config: config,
        renderer: primaryVisualization.renderer,
        popupTemplate: primaryVisualization.popupTemplate,
        legend: primaryVisualization.legend,
        
        // Multi-endpoint specific
        primaryVisualization,
        secondaryVisualizations,
        compositeElements,
        interactionControls,
        dashboardComponents,
        strategicInsights
      };

      console.log(`[MultiEndpointVisualizationRenderer] Composite visualization complete:`, {
        primaryLayer: primaryVisualization.endpoint,
        secondaryLayers: secondaryVisualizations.length,
        compositeElements: compositeElements.length,
        insights: strategicInsights.length
      });

      return result;

    } catch (error) {
      console.error(`[MultiEndpointVisualizationRenderer] Visualization creation failed:`, error);
      throw new Error(`Multi-endpoint visualization failed: ${error}`);
    }
  }

  /**
   * Create primary layer visualization (main map layer)
   */
  private async createPrimaryVisualization(
    data: CompositeAnalysisResult,
    config: LayerConfig
  ): Promise<SingleLayerVisualization> {
    
    console.log(`[MultiEndpointVisualizationRenderer] Creating primary visualization for ${config.endpoint}`);
    
    // Create renderer based on visualization type
    const renderer = await this.createRenderer(data, config);
    
    // Create popup template
    const popupTemplate = this.createPopupTemplate(data, config);
    
    // Create legend
    const legend = this.createLegendConfig(data, config);
    
    // Calculate statistics
    const statistics = this.calculateLayerStatistics(data, config.field);

    // Create the actual map layer (simplified for example)
    const layer = {
      type: 'feature',
      source: data.records,
      renderer,
      popupTemplate,
      title: `${config.endpoint} - ${config.field}`,
      visible: true,
      opacity: config.opacity
    };

    return {
      endpoint: config.endpoint,
      layer,
      renderer,
      popupTemplate,
      legend,
      statistics
    };
  }

  /**
   * Create secondary layer visualizations
   */
  private async createSecondaryVisualization(
    data: CompositeAnalysisResult,
    config: LayerConfig
  ): Promise<SingleLayerVisualization> {
    
    // Similar to primary but with adjusted opacity and different styling
    const adjustedConfig = {
      ...config,
      opacity: config.opacity * 0.7 // Reduce opacity for secondary layers
    };

    return this.createPrimaryVisualization(data, adjustedConfig);
  }

  /**
   * Create composite elements based on strategy
   */
  private async createCompositeElements(
    data: CompositeAnalysisResult,
    strategy: string,
    layout: string
  ): Promise<CompositeElement[]> {
    
    const elements: CompositeElement[] = [];

    switch (strategy) {
      case 'overlay':
        elements.push(...this.createOverlayElements(data));
        break;
      case 'comparison':
        elements.push(...this.createComparisonElements(data));
        break;
      case 'sequential':
        elements.push(...this.createSequentialElements(data));
        break;
      case 'correlation':
        elements.push(...this.createCorrelationElements(data));
        break;
    }

    return elements;
  }

  /**
   * Create overlay-specific elements
   */
  private createOverlayElements(data: CompositeAnalysisResult): CompositeElement[] {
    return [
      {
        type: 'overlay_effect',
        position: 'map_overlay',
        component: 'OpportunityHeatmapOverlay',
        data: {
          opportunities: data.strategicSummary.topOpportunities,
          scores: data.compositeInsights.map(i => ({
            location: i.location,
            score: i.compositeScores.opportunityScore
          }))
        },
        interactivity: true
      },
      {
        type: 'insight_callout',
        position: 'map_overlay',
        component: 'StrategicCallouts',
        data: {
          insights: data.strategicSummary.keyInsights,
          recommendations: data.strategicSummary.recommendedActions.slice(0, 3)
        },
        interactivity: true
      }
    ];
  }

  /**
   * Create comparison-specific elements
   */
  private createComparisonElements(data: CompositeAnalysisResult): CompositeElement[] {
    return [
      {
        type: 'comparison_panel',
        position: 'side_panel',
        component: 'EndpointComparisonChart',
        data: {
          endpoints: data.records[0] ? Object.keys(data.records[0]).filter(k => k.includes('_')) : [],
          locations: data.compositeInsights.slice(0, 10).map(i => i.location)
        },
        interactivity: true
      },
      {
        type: 'comparison_panel',
        position: 'bottom_panel',
        component: 'SideBySideMetrics',
        data: {
          competitive: data.compositeInsights.map(i => i.insights.competitive),
          demographic: data.compositeInsights.map(i => i.insights.demographic)
        },
        interactivity: false
      }
    ];
  }

  /**
   * Create sequential analysis elements
   */
  private createSequentialElements(data: CompositeAnalysisResult): CompositeElement[] {
    return [
      {
        type: 'insight_callout',
        position: 'side_panel',
        component: 'AnalysisFlowDiagram',
        data: {
          steps: [
            'Identify Outliers',
            'Analyze Competition',
            'Assess Demographics',
            'Generate Recommendations'
          ],
          currentStep: 4,
          results: data.strategicSummary
        },
        interactivity: true
      }
    ];
  }

  /**
   * Create correlation analysis elements
   */
  private createCorrelationElements(data: CompositeAnalysisResult): CompositeElement[] {
    return [
      {
        type: 'correlation_chart',
        position: 'bottom_panel',
        component: 'CrossEndpointCorrelationMatrix',
        data: {
          correlations: data.crossEndpointCorrelations,
          significantCorrelations: Object.entries(data.crossEndpointCorrelations)
            .filter(([_, value]) => Math.abs(value) > 0.5)
        },
        interactivity: true
      }
    ];
  }

  /**
   * Create interaction controls
   */
  private createInteractionControls(
    config: MultiEndpointVisualizationConfig,
    primary: SingleLayerVisualization,
    secondary: SingleLayerVisualization[]
  ): InteractionControl[] {
    
    const controls: InteractionControl[] = [];

    // Layer toggle controls
    controls.push({
      type: 'layer_toggle',
      label: 'Primary Layer',
      position: 'top_right',
      component: 'LayerToggle',
      defaultValue: true
    });

    secondary.forEach((layer, index) => {
      controls.push({
        type: 'layer_toggle',
        label: `${layer.endpoint} Layer`,
        position: 'top_right',
        component: 'LayerToggle',
        defaultValue: index < 2 // Show first 2 secondary layers by default
      });
    });

    // Opacity sliders
    controls.push({
      type: 'opacity_slider',
      label: 'Layer Opacity',
      position: 'top_right',
      component: 'OpacitySlider',
      defaultValue: 0.8
    });

    // Field selector for dynamic visualization
    if (config.enableInteractivity) {
      controls.push({
        type: 'field_selector',
        label: 'Visualization Field',
        position: 'top_left',
        component: 'FieldSelector',
        defaultValue: config.primaryLayer.field
      });
    }

    return controls;
  }

  /**
   * Create dashboard components
   */
  private createDashboardComponents(
    data: CompositeAnalysisResult,
    layout: string
  ): DashboardComponent[] {
    
    const components: DashboardComponent[] = [];

    // Key metrics card
    components.push({
      type: 'metric_card',
      title: 'Market Overview',
      data: {
        totalOpportunities: data.strategicSummary.topOpportunities.length,
        averageOpportunity: data.compositeInsights.reduce((sum, i) => 
          sum + i.compositeScores.opportunityScore, 0) / data.compositeInsights.length,
        totalMarketPotential: data.strategicSummary.marketOverview.totalMarketPotential,
        confidenceScore: data.qualityMetrics.analysisConfidence
      },
      position: layout === 'map_focused' ? 'right_panel' : 'left_panel',
      size: 'medium',
      component: 'MetricCard'
    });

    // Top opportunities ranking
    components.push({
      type: 'ranking_list',
      title: 'Top Opportunities',
      data: {
        opportunities: data.strategicSummary.topOpportunities.slice(0, 10),
        scores: data.compositeInsights
          .sort((a, b) => b.compositeScores.opportunityScore - a.compositeScores.opportunityScore)
          .slice(0, 10)
      },
      position: 'right_panel',
      size: 'large',
      component: 'RankingList'
    });

    // Strategic recommendations
    components.push({
      type: 'recommendation_list',
      title: 'Strategic Recommendations',
      data: {
        recommendations: data.strategicSummary.recommendedActions,
        prioritized: true
      },
      position: 'bottom_panel',
      size: 'large',
      component: 'RecommendationList'
    });

    // Competitive analysis chart
    if (data.compositeInsights.some(i => i.insights.competitive)) {
      components.push({
        type: 'chart',
        title: 'Competitive Landscape',
        data: {
          nike: data.compositeInsights.map(i => i.insights.competitive.nikeMarketShare),
          adidas: data.compositeInsights.map(i => i.insights.competitive.adidasMarketShare),
          locations: data.compositeInsights.map(i => i.location)
        },
        position: 'left_panel',
        size: 'medium',
        component: 'CompetitiveChart'
      });
    }

    return components;
  }

  /**
   * Generate visual insights and annotations
   */
  private generateVisualInsights(data: CompositeAnalysisResult): VisualInsight[] {
    const insights: VisualInsight[] = [];

    // Highlight top opportunities
    const topOpportunities = data.compositeInsights
      .sort((a, b) => b.compositeScores.opportunityScore - a.compositeScores.opportunityScore)
      .slice(0, 3);

    topOpportunities.forEach(insight => {
      insights.push({
        type: 'opportunity_highlight',
        location: insight.location,
        message: `High opportunity area: ${(insight.compositeScores.opportunityScore * 100).toFixed(1)}% score`,
        priority: 'high',
        visualization: 'highlight'
      });
    });

    // Highlight high-risk areas
    const highRiskAreas = data.compositeInsights
      .filter(i => i.compositeScores.riskScore > 0.7)
      .slice(0, 3);

    highRiskAreas.forEach(insight => {
      insights.push({
        type: 'risk_warning',
        location: insight.location,
        message: `High risk area: ${(insight.compositeScores.riskScore * 100).toFixed(1)}% risk score`,
        priority: 'high',
        visualization: 'callout'
      });
    });

    // Competitive gaps
    const competitiveGaps = data.compositeInsights
      .filter(i => i.insights.competitive.competitivePosition === 'opportunity')
      .slice(0, 2);

    competitiveGaps.forEach(insight => {
      insights.push({
        type: 'competitive_gap',
        location: insight.location,
        message: `Market opportunity: Low competition detected`,
        priority: 'medium',
        visualization: 'annotation'
      });
    });

    return insights;
  }

  /**
   * Helper methods for creating renderers, popups, etc.
   */
  private async createRenderer(data: CompositeAnalysisResult, config: LayerConfig): Promise<any> {
    // Simplified renderer creation - in real implementation this would use ArcGIS JS API
    const values = data.compositeInsights.map(insight => {
      switch (config.field) {
        case 'opportunityScore':
          return insight.compositeScores.opportunityScore;
        case 'riskScore':
          return insight.compositeScores.riskScore;
        case 'competitiveAdvantage':
          return insight.compositeScores.competitiveAdvantage;
        default:
          return insight.primaryScore;
      }
    });

    const min = Math.min(...values);
    const max = Math.max(...values);

    return {
      type: 'class-breaks',
      field: config.field,
      classificationMethod: config.classificationMethod || 'natural_breaks',
      breakpoints: config.breakpoints || this.calculateBreakpoints(values, 5),
      colorScheme: config.colorScheme,
      opacity: config.opacity
    };
  }

  private createPopupTemplate(data: CompositeAnalysisResult, config: LayerConfig): any {
    return {
      title: '{location} - Composite Analysis',
      content: [
        {
          type: 'fields',
          fieldInfos: [
            { fieldName: 'opportunityScore', label: 'Opportunity Score', format: { places: 2 } },
            { fieldName: 'riskScore', label: 'Risk Score', format: { places: 2 } },
            { fieldName: 'investmentScore', label: 'Investment Score', format: { places: 2 } },
            { fieldName: 'competitivePosition', label: 'Competitive Position' },
            { fieldName: 'recommendations', label: 'Top Recommendation' }
          ]
        }
      ]
    };
  }

  private createLegendConfig(data: CompositeAnalysisResult, config: LayerConfig): LegendConfig {
    return {
      title: config.field,
      position: 'bottom_right',
      items: [
        { label: 'Low', color: '#fee5d9', value: 0 },
        { label: 'Medium', color: '#fc9272', value: 0.5 },
        { label: 'High', color: '#de2d26', value: 1 }
      ]
    };
  }

  private calculateLayerStatistics(data: CompositeAnalysisResult, field: string): LayerStatistics {
    const values = data.compositeInsights.map(insight => {
      // Extract the relevant value based on field
      return insight.primaryScore; // Simplified
    }).filter(v => v !== null && v !== undefined);

    if (values.length === 0) {
      return { min: 0, max: 0, mean: 0, median: 0, standardDeviation: 0, nullCount: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const standardDeviation = Math.sqrt(variance);

    return {
      min,
      max,
      mean,
      median,
      standardDeviation,
      nullCount: data.compositeInsights.length - values.length
    };
  }

  private calculateBreakpoints(values: number[], numBreaks: number): number[] {
    const sorted = [...values].sort((a, b) => a - b);
    const breakpoints: number[] = [];
    
    for (let i = 1; i < numBreaks; i++) {
      const index = Math.floor((sorted.length * i) / numBreaks);
      breakpoints.push(sorted[index]);
    }
    
    return breakpoints;
  }
} 