import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Renderer from '@arcgis/core/renderers/Renderer';
import FeatureEffect from '@arcgis/core/layers/support/FeatureEffect';
import FeatureFilter from '@arcgis/core/layers/support/FeatureFilter';
import ArcGISMap from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import { LayerConfig } from '@/types/layers';
import { LayerErrorHandler } from './layer-error-handler';

interface RendererMetrics {
  renderTime: number;
  featureCount: number;
  geometryComplexity: number;
  memoryUsage: number;
}

interface OptimizationOptions {
  maxFeatures?: number;
  maxGeometryComplexity?: number;
  useClustering?: boolean;
  useFeatureReduction?: boolean;
  useWebGL?: boolean;
  batchSize?: number;
}

// Extend FeatureLayer type to include our custom properties
export interface ExtendedFeatureLayer extends FeatureLayer {
  map?: ArcGISMap & { 
    view?: MapView & { 
      environment?: { 
        lighting?: { 
          directShadowsEnabled?: boolean 
        } 
      } 
    } 
  };
  view?: MapView;
  maxRecordCount?: number;
  maxGeometryComplexity?: number;
  loadingMode?: string;
  refreshInterval: number;
  featureCount?: number;
  customProperties?: {
    analysisType?: string;
    statisticalInfo?: any;
    visualizationConfig?: any;
  };
}

export class RendererOptimizer {
  private static instance: RendererOptimizer;
  private errorHandler: LayerErrorHandler;
  private metrics = new globalThis.Map<string, RendererMetrics>();
  private readonly DEFAULT_BATCH_SIZE = 1000;
  private readonly DEFAULT_MAX_FEATURES = 10000;
  private readonly DEFAULT_MAX_GEOMETRY_COMPLEXITY = 100000;

  private constructor() {
    this.errorHandler = LayerErrorHandler.getInstance();
  }

  public static getInstance(): RendererOptimizer {
    if (!RendererOptimizer.instance) {
      RendererOptimizer.instance = new RendererOptimizer();
    }
    return RendererOptimizer.instance;
  }

  public async optimizeRenderer(
    layer: ExtendedFeatureLayer,
    layerConfig: LayerConfig,
    options: OptimizationOptions = {}
  ): Promise<void> {
    try {
      const startTime = performance.now();
      
      // Apply performance optimizations
      await this.applyOptimizations(layer, layerConfig, options);
      
      // Record metrics
      this.recordMetrics(layer, startTime);
      
      // Apply feature reduction if needed
      if (options.useFeatureReduction) {
        await this.applyFeatureReduction(layer, options);
      }
      
      // Apply clustering if enabled
      if (options.useClustering) {
        await this.applyClustering(layer);
      }
      
      // Enable WebGL rendering if supported
      if (options.useWebGL) {
        await this.enableWebGLRendering(layer);
      }
      
    } catch (error) {
      if (this.errorHandler.handleValidationError) {
        this.errorHandler.handleValidationError('renderer_optimization', error);
      }
      throw error;
    }
  }

  private async applyOptimizations(
    layer: ExtendedFeatureLayer,
    layerConfig: LayerConfig,
    options: OptimizationOptions
  ): Promise<void> {
    // Set batch size for feature loading
    layer.outFields = ['*'];
    layer.maxRecordCount = options.maxFeatures || this.DEFAULT_MAX_FEATURES;
    
    // Apply feature effect for large datasets
    if (layerConfig.performance?.maxFeatures && layerConfig.performance.maxFeatures > this.DEFAULT_MAX_FEATURES) {
      const effect = new FeatureEffect({
        filter: new FeatureFilter({
          where: '1=1',
          geometry: layer.map?.view?.extent
        }),
        excludedEffect: 'grayscale(100%) opacity(30%)'
      });
      layer.featureEffect = effect;
    }
    
    // Set geometry complexity limits
    if (layerConfig.performance?.maxGeometryComplexity) {
      layer.maxGeometryComplexity = options.maxGeometryComplexity || 
        layerConfig.performance.maxGeometryComplexity;
    }
  }

  private async applyFeatureReduction(
    layer: ExtendedFeatureLayer,
    options: OptimizationOptions
  ): Promise<void> {
    const batchSize = options.batchSize || this.DEFAULT_BATCH_SIZE;
    
    // Implement progressive loading
    layer.loadingMode = 'async';
    layer.refreshInterval = 0;
    
    // Set up feature reduction
    layer.featureReduction = {
      type: 'cluster',
      clusterRadius: '100px',
      clusterMinSize: 2,
      clusterMaxSize: 100,
      labelingInfo: [{
        labelExpressionInfo: {
          expression: 'Text($feature.cluster_count, "#,###")'
        },
        labelPlacement: 'center-center',
        symbol: {
          type: 'text',
          color: 'white',
          haloColor: 'black',
          haloSize: 1,
          font: {
            size: 12,
            weight: 'bold'
          }
        }
      }]
    };
  }

  private async applyClustering(layer: ExtendedFeatureLayer): Promise<void> {
    // Configure clustering
    layer.featureReduction = {
      type: 'cluster',
      clusterRadius: '100px',
      clusterMinSize: 2,
      clusterMaxSize: 100,
      labelingInfo: [{
        labelExpressionInfo: {
          expression: 'Text($feature.cluster_count, "#,###")'
        },
        labelPlacement: 'center-center',
        symbol: {
          type: 'text',
          color: 'white',
          haloColor: 'black',
          haloSize: 1,
          font: {
            size: 12,
            weight: 'bold'
          }
        }
      }]
    };
  }

  private async enableWebGLRendering(layer: ExtendedFeatureLayer): Promise<void> {
    // Enable WebGL rendering if supported
    if (layer.map?.view?.environment?.lighting?.directShadowsEnabled) {
      layer.renderer = {
        ...layer.renderer,
        type: 'simple',
        symbol: {
          type: 'simple-marker',
          size: 6,
          color: [0, 92, 230, 0.7],
          outline: {
            color: [0, 0, 0, 0], // No border
            width: 0
          }
        }
      };
    }
  }

  private recordMetrics(layer: ExtendedFeatureLayer, startTime: number): void {
    const endTime = performance.now();
    const renderTime = endTime - startTime;
    
    this.metrics.set(layer.id, {
      renderTime,
      featureCount: layer.featureCount || 0,
      geometryComplexity: layer.maxGeometryComplexity || 0,
      memoryUsage: (performance as any).memory?.usedJSHeapSize || 0
    });
  }

  public getMetrics(layerId: string): RendererMetrics | undefined {
    return this.metrics.get(layerId);
  }

  public clearMetrics(): void {
    this.metrics.clear();
  }

  public getPerformanceReport(): string {
    let report = 'Renderer Performance Report:\n';
    this.metrics.forEach((metrics, layerId) => {
      report += `\nLayer: ${layerId}\n`;
      report += `Render Time: ${metrics.renderTime.toFixed(2)}ms\n`;
      report += `Feature Count: ${metrics.featureCount}\n`;
      report += `Geometry Complexity: ${metrics.geometryComplexity}\n`;
      report += `Memory Usage: ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB\n`;
    });
    return report;
  }
} 