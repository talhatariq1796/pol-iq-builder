import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Renderer from '@arcgis/core/renderers/Renderer';
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
import ClassBreaksRenderer from '@arcgis/core/renderers/ClassBreaksRenderer';
import UniqueValueRenderer from '@arcgis/core/renderers/UniqueValueRenderer';
import Color from '@arcgis/core/Color';
import { AnalysisResult, EnhancedAnalysisResult } from '@/types/analysis';
import { 
  VisualizationType, 
  VisualizationStrategy, 
  VisualizationConfig,
  LegendConfig,
  PopupConfig,
  Feature
} from '@/types/visualization';
import { LayerConfig } from '@/types/layers';
import { RendererOptimizer } from './renderer-optimizer';
import { LayerErrorHandler } from './layer-error-handler';
import { ExtendedFeatureLayer } from './renderer-optimizer';

interface FeatureAttributes {
  [key: string]: string | number | boolean;
}

interface UniqueValueInfoProperties {
  value: string | number;
  symbol: {
    type: 'simple-fill';
    color: number[];
    outline: { color: number[]; width: number };
  };
}

interface VisualizationIntegrationOptions {
  analysisResult?: AnalysisResult;
  enhancedAnalysis?: EnhancedAnalysisResult;
  features?: any;
  visualizationType?: VisualizationType;
}

export class VisualizationIntegration {
  private static instance: VisualizationIntegration;
  private optimizer: RendererOptimizer;
  private errorHandler: LayerErrorHandler;
  public analysisResult?: AnalysisResult;
  public enhancedAnalysis?: EnhancedAnalysisResult;
  public features?: any;
  public visualizationType?: VisualizationType;

  public constructor(options: VisualizationIntegrationOptions = {}) {
    this.optimizer = RendererOptimizer.getInstance();
    this.errorHandler = LayerErrorHandler.getInstance();
    this.analysisResult = options.analysisResult;
    this.enhancedAnalysis = options.enhancedAnalysis;
    this.features = options.features;
    this.visualizationType = options.visualizationType;
    
    // === DEBUGGING: Log enhancedAnalysis relevantFields ===
   // console.log('[VisualizationIntegration DEBUG] Enhanced analysis relevant fields:', options.enhancedAnalysis?.relevantFields);
    
    if (options.enhancedAnalysis?.relevantFields) {
    /*  console.log('[VisualizationIntegration DEBUG] Relevant fields from enhanced analysis:', {
        fields: options.enhancedAnalysis.relevantFields,
        count: options.enhancedAnalysis.relevantFields.length
      });*/
    }
  }

  public static getInstance(options?: VisualizationIntegrationOptions): VisualizationIntegration {
    if (!VisualizationIntegration.instance) {
      VisualizationIntegration.instance = new VisualizationIntegration(options);
    }
    return VisualizationIntegration.instance;
  }

  public updateAnalysisResult(analysisResult: AnalysisResult, enhancedAnalysis?: EnhancedAnalysisResult): void {
    console.log('🔥 [VisualizationIntegration] Updating analysis result:', {
      oldType: (this.analysisResult as any)?.type,
      newType: (analysisResult as any)?.type,
      hasRenderer: !!(analysisResult as any)?.renderer,
      hasLegend: !!(analysisResult as any)?.legend
    });
    
    this.analysisResult = analysisResult;
    if (enhancedAnalysis) {
      this.enhancedAnalysis = enhancedAnalysis;
    }
  }

  public createFeatureLayer(): ExtendedFeatureLayer {
    const layer = new FeatureLayer({
      source: this.features,
      title: this.enhancedAnalysis?.visualizationStrategy?.title,
      outFields: ['*'],
      popupEnabled: true,
      renderer: this.createRenderer(),
    }) as ExtendedFeatureLayer;

    layer.customProperties = {
      analysisType: this.enhancedAnalysis?.queryType,
      statisticalInfo: this.getStatisticalInfo(),
      visualizationConfig: this.getVisualizationConfig(),
    };

    return layer;
  }

  private createRenderer(): Renderer {
    switch (this.visualizationType) {
      case 'correlation':
        return this.createCorrelationRenderer();
      case 'ranking':
        return this.createRankingRenderer();
      case 'distribution':
        return this.createDistributionRenderer();
      default:
        return this.createDefaultRenderer();
    }
  }

  private createCorrelationRenderer(): Renderer {
    const strategy = this.enhancedAnalysis?.visualizationStrategy;
    const relevantFields = this.enhancedAnalysis?.relevantFields || [];
    
    if (!relevantFields.length) {
      console.warn('No relevant fields found for correlation');
      return this.createDefaultRenderer();
    }

    // Use the first two relevant fields for correlation
    const primaryField = relevantFields[0];
    const comparisonField = relevantFields[1] || relevantFields[0];

   /* console.log('Creating correlation renderer with fields:', {
      primaryField,
      comparisonField,
      relevantFields
    });*/

    // Calculate correlation scores for each feature
    const correlationScores = this.features.features.map((f: Feature) => {
      const primaryValue = f.attributes[primaryField] as number;
      const comparisonValue = f.attributes[comparisonField] as number;
      
      if (typeof primaryValue !== 'number' || typeof comparisonValue !== 'number') {
        return null;
      }

      // Calculate local correlation score
      const zScore = (primaryValue - this.calculateMean()) / this.calculateStandardDeviation();
      return Math.max(-1, Math.min(1, zScore));
    });

    // Filter out null scores and get min/max
    const validScores = correlationScores.filter((score: number | null): score is number => score !== null);
    const min = Math.min(...validScores);
    const max = Math.max(...validScores);

    return new ClassBreaksRenderer({
      field: 'correlation_score',
      classBreakInfos: [
        {
          minValue: min,
          maxValue: (min + max) / 2,
          symbol: {
            type: 'simple-fill',
            color: [255, 0, 0, 0.7],
            outline: { color: [0, 0, 0, 0], width: 0 } // No border
          }
        },
        {
          minValue: (min + max) / 2,
          maxValue: max,
          symbol: {
            type: 'simple-fill',
            color: [0, 0, 255, 0.7],
            outline: { color: [0, 0, 0, 0], width: 0 } // No border
          }
        }
      ]
    });
  }

  private createRankingRenderer(): Renderer {
    const strategy = this.enhancedAnalysis?.visualizationStrategy;
    if (!strategy?.rankingField) return this.createDefaultRenderer();

    const values = this.features.features.map((f: Feature) => 
      f.attributes[strategy.rankingField!] as number
    );
    const sortedValues = [...values].sort((a: number, b: number) => b - a);
    const breakPoints = this.calculateBreakPoints(sortedValues, 5);

    return new ClassBreaksRenderer({
      field: strategy.rankingField,
      classBreakInfos: breakPoints.map((breakPoint, index) => ({
        minValue: breakPoint.min,
        maxValue: breakPoint.max,
        symbol: {
          type: 'simple-fill',
          color: this.getColorForRank(index, 5),
          outline: { color: [0, 0, 0, 0], width: 0 } // No border
        }
      }))
    });
  }

  private createDistributionRenderer(): Renderer {
    const strategy = this.enhancedAnalysis?.visualizationStrategy;
    if (!strategy?.distributionField) return this.createDefaultRenderer();

    const uniqueValues = [...new Set(
      this.features.features.map((f: Feature) => 
        f.attributes[strategy.distributionField!] as string | number
      )
    )];

    const uniqueValueInfos: UniqueValueInfoProperties[] = uniqueValues.map((value, index) => ({
      value: value as string | number,
      symbol: {
        type: 'simple-fill',
        color: this.getColorForDistribution(index, uniqueValues.length),
        outline: { color: [0, 0, 0, 0], width: 0 } // No border
      }
    }));

    return new UniqueValueRenderer({
      field: strategy.distributionField,
      uniqueValueInfos
    });
  }

  private createDefaultRenderer(): Renderer {
    return new SimpleRenderer({
      symbol: {
        type: 'simple-fill',
        color: [128, 128, 128, 0.7],
        outline: { color: [0, 0, 0, 0], width: 0 } // No border
      }
    });
  }

  private calculateBreakPoints(values: number[], numBreaks: number) {
    const min = values[0];
    const max = values[values.length - 1];
    const range = max - min;
    const breakSize = range / numBreaks;

    return Array.from({ length: numBreaks }, (_, i) => ({
      min: min + (i * breakSize),
      max: min + ((i + 1) * breakSize)
    }));
  }

  private getColorForRank(index: number, total: number): number[] {
    const hue = (index / total) * 120; // Green to Red
    return this.hslToRgb(hue, 70, 50);
  }

  private getColorForDistribution(index: number, total: number): number[] {
    const hue = (index / total) * 360; // Full color spectrum
    return this.hslToRgb(hue, 70, 50);
  }

  private hslToRgb(h: number, s: number, l: number): number[] {
    s /= 100;
    l /= 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4)), 0.7];
  }

  private getStatisticalInfo() {
    return {
      mean: this.calculateMean(),
      median: this.calculateMedian(),
      standardDeviation: this.calculateStandardDeviation(),
      correlation: this.calculateCorrelation(),
      relevantFields: this.analysisResult?.relevantFields
    };
  }

  private calculateMean(): number {
    const strategy = this.enhancedAnalysis?.visualizationStrategy;
    if (!strategy?.targetVariable) return 0;

    const values = this.features.features.map((f: Feature) => 
      f.attributes[strategy.targetVariable] as number
    );
    return values.reduce((a: number, b: number) => a + b, 0) / values.length;
  }

  private calculateMedian(): number {
    const strategy = this.enhancedAnalysis?.visualizationStrategy;
    if (!strategy?.targetVariable) return 0;

    const values = this.features.features.map((f: Feature) => 
      f.attributes[strategy.targetVariable] as number
    );
    const sorted = [...values].sort((a: number, b: number) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];
  }

  private calculateStandardDeviation(): number {
    const strategy = this.enhancedAnalysis?.visualizationStrategy;
    if (!strategy?.targetVariable) return 0;

    const values = this.features.features.map((f: Feature) => 
      f.attributes[strategy.targetVariable] as number
    );
    const mean = this.calculateMean();
    const squareDiffs = values.map((value: number) => {
      const diff = value - mean;
      return diff * diff;
    });
    const avgSquareDiff = squareDiffs.reduce((a: number, b: number) => a + b, 0) / squareDiffs.length;
    return Math.sqrt(avgSquareDiff);
  }

  private calculateCorrelation(): number {
    const { enhancedAnalysis } = this;
    const relevantFields = enhancedAnalysis?.relevantFields || [];
    
    if (relevantFields.length < 2) {
      console.warn('[VisualizationIntegration] Not enough fields for correlation calculation');
      return 0;
    }

    // Use the first two relevant fields for correlation
    const primaryField = relevantFields[0];
    const comparisonField = relevantFields[1];

   /* console.log('[VisualizationIntegration] Calculating correlation between fields:', {
      primaryField,
      comparisonField
    });*/

    const xValues = this.features.features.map((f: Feature) => 
      f.attributes[primaryField] as number
    ).filter((v: number | undefined): v is number => typeof v === 'number' && isFinite(v));

    const yValues = this.features.features.map((f: Feature) => 
      f.attributes[comparisonField] as number
    ).filter((v: number | undefined): v is number => typeof v === 'number' && isFinite(v));

    if (xValues.length === 0 || yValues.length === 0) {
      console.warn('[VisualizationIntegration] No valid numeric values found for correlation');
      return 0;
    }
    
    const xMean = xValues.reduce((a: number, b: number) => a + b, 0) / xValues.length;
    const yMean = yValues.reduce((a: number, b: number) => a + b, 0) / yValues.length;
    
    const numerator = xValues.reduce((sum: number, x: number, i: number) => {
      const y = yValues[i];
      if (typeof y === 'undefined') return sum;
      return sum + ((x - xMean) * (y - yMean));
    }, 0);
    
    const xStdDev = Math.sqrt(xValues.reduce((sum: number, x: number) => sum + Math.pow(x - xMean, 2), 0));
    const yStdDev = Math.sqrt(yValues.reduce((sum: number, y: number) => sum + Math.pow(y - yMean, 2), 0));
    
    const correlation = numerator / (xStdDev * yStdDev);
   // console.log('[VisualizationIntegration] Calculated correlation:', correlation);
    
    return correlation;
  }

  public getVisualizationConfig(): VisualizationConfig {
    if (!this.visualizationType || !this.enhancedAnalysis?.visualizationStrategy) {
      return {
        type: 'default',
        title: 'Default Visualization',
        description: 'No specific visualization configuration available',
        legendConfig: this.getDefaultLegendConfig(),
        popupConfig: this.getDefaultPopupConfig()
      };
    }

    const strategy = this.enhancedAnalysis.visualizationStrategy;
    return {
      type: this.visualizationType,
      title: strategy.title || 'Visualization',
      description: strategy.description || '',
      legendConfig: this.getLegendConfig(),
      popupConfig: this.getPopupConfig()
    };
  }

  private getDefaultLegendConfig(): LegendConfig {
    return {
      title: 'Default Legend',
      description: '',
      showLegend: true,
      legendPosition: 'bottom-right'
    };
  }

  private getDefaultPopupConfig(): PopupConfig {
    return {
      title: 'Default Popup',
      content: [
        {
          type: 'text',
          text: 'No specific information available'
        }
      ]
    };
  }

  private getLegendConfig(): LegendConfig {
    const strategy = this.enhancedAnalysis?.visualizationStrategy;
    if (!strategy) {
      return this.getDefaultLegendConfig();
    }

    return {
      title: strategy.title || 'Legend',
      description: strategy.description || '',
      showLegend: true,
      legendPosition: 'bottom-right'
    };
  }

  private getPopupConfig(): PopupConfig {
    const strategy = this.enhancedAnalysis?.visualizationStrategy;
    if (!strategy || !this.analysisResult) {
      return this.getDefaultPopupConfig();
    }

    return {
      title: strategy.title || 'Popup',
      content: [
        {
          type: 'text',
          text: this.analysisResult.explanation || 'No explanation available'
        }
      ]
    };
  }

  public async initializeLayer(
    layer: any,
    layerConfig: LayerConfig
  ): Promise<void> {
    try {
      // Apply initial optimizations based on layer configuration
      await this.optimizer.optimizeRenderer(layer, layerConfig, {
        maxFeatures: layerConfig.performance?.maxFeatures ?? 10000,
        maxGeometryComplexity: layerConfig.performance?.maxGeometryComplexity,
        useClustering: layerConfig.type === 'point',
        useFeatureReduction: (layerConfig.performance?.maxFeatures ?? 0) > 10000,
        useWebGL: true
      });

      // Set up layer event listeners
      this.setupLayerEventListeners(layer);

    } catch (error) {
      this.errorHandler.handleValidationError('visualization_integration', error);
      throw error;
    }
  }

  private setupLayerEventListeners(layer: any): void {
    // Monitor layer loading
    layer.watch('loadStatus', (status: string) => {
      if (status === 'loaded') {
        this.optimizer.getMetrics(layer.id);
      }
    });

    // Monitor layer visibility changes
    layer.watch('visible', (visible: boolean) => {
      if (visible) {
        this.optimizer.getMetrics(layer.id);
      }
    });

    // Monitor layer extent changes
    layer.watch('extent', () => {
      this.optimizer.getMetrics(layer.id);
    });
  }

  public getLayerPerformanceReport(layerId: string): string {
    return this.optimizer.getPerformanceReport();
  }

  public async updateLayerOptimization(
    layer: any,
    layerConfig: LayerConfig,
    options: {
      useClustering?: boolean;
      useFeatureReduction?: boolean;
      useWebGL?: boolean;
      maxFeatures?: number;
      maxGeometryComplexity?: number;
    }
  ): Promise<void> {
    try {
      await this.optimizer.optimizeRenderer(layer, layerConfig, options);
    } catch (error) {
      this.errorHandler.handleValidationError('visualization_integration', error);
      throw error;
    }
  }

  public clearLayerMetrics(layerId: string): void {
    this.optimizer.clearMetrics();
  }
} 