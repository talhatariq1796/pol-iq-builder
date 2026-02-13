import { 
  layerRegistry, 
  LayerProviderFactory,
  VisualizationOptions,
  visualizationTypesConfig,
  LoadedLayer
} from '../config/dynamic-layers';
import { VisualizationType } from '../reference/dynamic-layers';
import { Extent } from '@arcgis/core/geometry';
import { queryClassifier } from './query-classifier';
import { FieldMappingHelper } from "../utils/visualizations/field-mapping-helper";

/**
 * Interface for visualization cache keys
 */
interface VisualizationCacheKey {
  type: VisualizationType;
  layerId: string;
  options: string; // JSON stringified options for comparison
}

/**
 * Interface for cached visualization result
 */
interface CachedVisualization {
  result: any;
  timestamp: number;
  expiresAt: number;
}

/**
 * Class responsible for creating visualizations dynamically based on analysis results
 * This factory bridges the gap between the geospatial-chat-interface and the layer registry system
 */
export class DynamicVisualizationFactory {
  private _mapView: __esri.MapView | null = null;
  private _initialized: boolean = false;
  private _visualizationLayers: Map<string, __esri.FeatureLayer> = new Map();
  private visualizationCache: Map<string, CachedVisualization> = new Map();
  private CACHE_TTL_MS: number = 5 * 60 * 1000; // 5 minutes default TTL
  private readonly MAX_CACHE_SIZE: number = 20; // Maximum number of cached visualizations
  private useMLClassification: boolean = false; // Whether to use ML for query classification

  constructor(mapView?: __esri.MapView, useML: boolean = false) {
    if (mapView) {
      this._mapView = mapView;
      this._initialized = true;
    }
    this.useMLClassification = useML;
  }

  /**
   * Initialize the factory with a map view
   * This should be called before using the factory
   */
  async initialize(mapView: __esri.MapView, useML: boolean = false): Promise<void> {
    this._mapView = mapView;
    this.useMLClassification = useML;
    
    try {
      // Initialize the layer registry if not already done
      // Add initial configurations that might be available in app state
      const existingConfigs = this._mapView.map.allLayers
        .filter(layer => layer.type === 'feature')
        .map(layer => {
          const featureLayer = layer as __esri.FeatureLayer;
          // Extract basic metadata from existing layers to populate registry
          return {
            id: featureLayer.id,
            name: featureLayer.title,
            url: featureLayer.url,
            geometryType: featureLayer.geometryType,
            // Additional properties could be extracted here
          };
        });
      
      // Log detected layers
      console.log('Detected existing layers:', existingConfigs.length);
      
      // Initialize ML classifier if requested
      if (this.useMLClassification) {
        console.log('Initializing ML query classifier');
        await queryClassifier.initializeML(true, {
          confidenceThreshold: 0.65 // Start with a slightly lower threshold
        });
      }
      
      this._initialized = true;
    } catch (error) {
      console.error('Failed to initialize DynamicVisualizationFactory:', error);
      throw error;
    }
  }

  /**
   * Get a suggested visualization type based on the layer and query
   * This combines registry suggestions with additional heuristics
   */
  async suggestVisualizationType(
    query: string, 
    layerId: string, 
    geometryType?: string, 
    numFields?: number
  ): Promise<VisualizationType> {
    // Use the enhanced classifier (which now tries ML first, then fallback)
    const analysisResult = {
      intent: '',
      relevantLayers: [layerId],
      queryType: 'unknown',
      confidence: 0,
      explanation: '',
      originalQuery: query
    };
    
    const result = await queryClassifier.classifyAnalysisResult(analysisResult);
    return result || VisualizationType.CHOROPLETH;
  }

  /**
   * Create a visualization based on the provided type, layer ID, and options
   * @param vizType Visualization type to create
   * @param layerId ID of the layer to use for visualization
   * @param options Options for configuring the visualization
   * @returns Visualization result with layer and extent
   */
  async createVisualization(
    vizType: string, 
    layerId: string, 
    options: any = {}
  ): Promise<{ layer: __esri.FeatureLayer | null, extent: __esri.Extent | null }> {
    if (!this._initialized || !this._mapView) {
      throw new Error("Factory not initialized. Call initialize() first.");
    }

    // Convert vizType to VisualizationType enum if not already
    const visualizationType = vizType as VisualizationType;

    // Generate cache key and check cache
    const cacheKey = this.generateCacheKey(visualizationType, layerId, options);
    const cachedResult = this.getCachedVisualization(cacheKey);
    
    if (cachedResult) {
      console.log(`Using cached visualization for type: ${visualizationType}, layer: ${layerId}`);
      return cachedResult;
    }

    console.log(`Creating visualization of type: ${visualizationType} for layer: ${layerId}`);

    try {
      // Get layer info from registry
      const layerInfo = layerRegistry.getLayerConfig(layerId);
      if (!layerInfo) {
        throw new Error(`Layer ${layerId} not found in registry`);
      }

      // Prepare visualization options
      const vizOptions = {
        ...options,
        layer: layerInfo,
        mapView: this._mapView
      };

      // Create appropriate visualization
      let result;
      
      switch (visualizationType) {
        case VisualizationType.CHOROPLETH: {
          const { ChoroplethVisualization } = await import("../utils/visualizations/choropleth-visualization");
          const choroplethViz = new ChoroplethVisualization();
          result = await choroplethViz.create(vizOptions);
          break;
        }
          
        case VisualizationType.HEATMAP: {
          const { DensityVisualization } = await import("../utils/visualizations/density-visualization");
          const heatViz = new DensityVisualization();
          result = await heatViz.create(vizOptions);
          break;
        }
          
        case VisualizationType.SCATTER: {
          const { PointLayerVisualization } = await import("../utils/visualizations/point-layer-visualization");
          const scatterViz = new PointLayerVisualization();
          result = await scatterViz.create(vizOptions);
          break;
        }
          
        case VisualizationType.CLUSTER: {
          const { ClusterVisualization } = await import("../utils/visualizations/cluster-visualization");
          const clusterViz = new ClusterVisualization();
          result = await clusterViz.create(vizOptions);
          break;
        }
          
        // CORRELATION case removed - queries now route to BIVARIATE for proper relationship analysis
        // instead of the problematic normalized difference calculation
          
        case VisualizationType.JOINT_HIGH: {
          console.log('[DynamicVisualizationFactory] Creating JOINT_HIGH visualization with options:', {
            layerId,
            hasFeatures: vizOptions.features?.length > 0,
            primaryField: vizOptions.primaryField,
            comparisonField: vizOptions.comparisonField,
            metrics: vizOptions.metrics
          });
          
          // We want to use a specialized visualization for multi-field analysis
          // Import the JointHighVisualization
          const { JointHighVisualization } = await import("../utils/visualizations/joint-visualization");
          const jointViz = new JointHighVisualization();
          
          // Add feature data to options if not present but available in layer registry
          if ((!vizOptions.features || vizOptions.features.length === 0) && this._mapView) {
            const layer = this._mapView?.map.findLayerById(layerId) as __esri.FeatureLayer;
            if (layer) {
              try {
                console.log(`[DynamicVisualizationFactory] Querying features from layer ${layerId} for joint high visualization`);
                const query = layer.createQuery();
                query.outFields = ["*"];
                query.returnGeometry = true;
                
                const results = await layer.queryFeatures(query);
                if (results && results.features && results.features.length > 0) {
                  vizOptions.features = results.features;
                  console.log(`[DynamicVisualizationFactory] Added ${results.features.length} features from layer to joint high visualization options`);
                }
              } catch (e) {
                console.error(`[DynamicVisualizationFactory] Error querying features from layer ${layerId}:`, e);
              }
            }
          }
          
          // Create the visualization
          result = await jointViz.create(vizOptions);
          break;
        }
          
        case VisualizationType.PROPORTIONAL_SYMBOL: {
          const { ProportionalSymbolVisualization } = await import("../utils/visualizations/proportional-symbol-visualization");
          const propViz = new ProportionalSymbolVisualization();
          result = await propViz.create(vizOptions);
          break;
        }
          
        case VisualizationType.TRENDS: {
          const { TrendsVisualization } = await import("../utils/visualizations/trends-visualization");
          const trendsViz = new TrendsVisualization();
          result = await trendsViz.create(vizOptions);
          break;
        }
          
        case VisualizationType.TOP_N: {
          const { TopNVisualization } = await import("../utils/visualizations/top-n-visualization");
          const topNViz = new TopNVisualization();
          result = await topNViz.create(vizOptions);
          break;
        }
          
        case VisualizationType.CATEGORICAL: {
          // Fallback to single layer visualization with categorical renderer
          const { SingleLayerVisualization: CategoricalViz } = await import("../utils/visualizations/single-layer-visualization");
          const categoricalViz = new CategoricalViz();
          
          // Set categorical renderer options
          const categoricalOptions = {
            ...vizOptions,
            rendererType: 'categorical'
          };
          
          result = await categoricalViz.create(categoricalOptions);
          break;
        }
          
        case VisualizationType.HEXBIN: {
          const { HexbinVisualization } = await import("../utils/visualizations/hexbin-visualization");
          const hexbinViz = new HexbinVisualization();
          result = await hexbinViz.create(vizOptions);
          break;
        }
          
        case VisualizationType.BIVARIATE: {
          const { BivariateVisualization } = await import("../utils/visualizations/bivariate-visualization");
          const bivariateViz = new BivariateVisualization();
          result = await bivariateViz.create(vizOptions);
          break;
        }
          
        case VisualizationType.BUFFER: {
          const { BufferVisualization } = await import("../utils/visualizations/buffer-visualization");
          const bufferViz = new BufferVisualization();
          result = await bufferViz.create(vizOptions);
          break;
        }
          
        case VisualizationType.HOTSPOT: {
          const { HotspotVisualization } = await import("../utils/visualizations/hotspot-visualization");
          const hotspotViz = new HotspotVisualization();
          result = await hotspotViz.create(vizOptions);
          break;
        }
          
        case VisualizationType.NETWORK: {
          const { NetworkVisualization } = await import("../utils/visualizations/network-visualization");
          const networkViz = new NetworkVisualization();
          result = await networkViz.create(vizOptions);
          break;
        }
          
        case VisualizationType.MULTIVARIATE: {
          const { MultivariateVisualization } = await import("../utils/visualizations/multivariate-visualization");
          const multivariateViz = new MultivariateVisualization();
          result = await multivariateViz.create(vizOptions);
          break;
        }
          
        case VisualizationType.DIFFERENCE: {
          console.log('[DynamicVisualizationFactory] Creating DIFFERENCE visualization with options:', {
            layerId,
            hasFeatures: vizOptions.features?.length > 0,
            primaryField: vizOptions.primaryField,
            secondaryField: vizOptions.secondaryField,
            primaryLabel: vizOptions.primaryLabel,
            secondaryLabel: vizOptions.secondaryLabel
          });
          
          const { DifferenceVisualization } = await import("../utils/visualizations/difference-visualization");
          const differenceViz = new DifferenceVisualization();
          
          // Add feature data to options if not present but available in layer registry
          if ((!vizOptions.features || vizOptions.features.length === 0) && this._mapView) {
            const layer = this._mapView?.map.findLayerById(layerId) as __esri.FeatureLayer;
            if (layer) {
              try {
                console.log(`[DynamicVisualizationFactory] Querying features from layer ${layerId} for difference visualization`);
                const query = layer.createQuery();
                query.outFields = ["*"];
                query.returnGeometry = true;
                
                const results = await layer.queryFeatures(query);
                if (results && results.features && results.features.length > 0) {
                  vizOptions.features = results.features;
                  console.log(`[DynamicVisualizationFactory] Added ${results.features.length} features from layer to difference visualization options`);
                }
              } catch (e) {
                console.error(`[DynamicVisualizationFactory] Error querying features from layer ${layerId}:`, e);
              }
            }
          }
          
          // Derive friendly labels for legend if not provided
          if (vizOptions.primaryField && !vizOptions.primaryLabel) {
            vizOptions.primaryLabel = FieldMappingHelper.getFriendlyFieldName(vizOptions.primaryField);
          }
          if (vizOptions.secondaryField && !vizOptions.secondaryLabel) {
            vizOptions.secondaryLabel = FieldMappingHelper.getFriendlyFieldName(vizOptions.secondaryField);
          }
          
          result = await differenceViz.create(vizOptions);
          break;
        }
          
        default: {
          // Fallback to single layer visualization
          const { SingleLayerVisualization: DefaultViz } = await import("../utils/visualizations/single-layer-visualization");
          const defaultViz = new DefaultViz();
          result = await defaultViz.create(vizOptions);
          break;
        }
      }
      
      // Store the visualization layer for later reference
      if (result.layer) {
        this._visualizationLayers.set(layerId, result.layer);
      }
      
      // Cache the visualization result
      this.cacheVisualization(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error(`Error creating visualization for layer ${layerId}:`, error);
      return { layer: null, extent: null };
    }
  }

  /**
   * Create a temporary provider for a layer not in the registry
   * This allows working with layers dynamically without prior configuration
   */
  private _createTemporaryProvider(layerId: string, options: any) {
    // Find layer in the map
    const mapLayer = this._mapView?.map.findLayerById(layerId) as __esri.FeatureLayer;
    
    if (!mapLayer) {
      throw new Error(`Layer ${layerId} not found in map`);
    }
    
    // Create temporary config based on the existing layer
    const tempConfig = {
      id: layerId,
      name: mapLayer.title || layerId,
      description: mapLayer.title || '',
      type: 'feature-service', // Use a consistent type value
      url: mapLayer.url,
      geometryType: mapLayer.geometryType,
      // Additional layer properties to help with visualization
      fields: mapLayer.fields?.map(f => ({
        name: f.name,
        alias: f.alias,
        type: f.type
      }))
    };
    
    return LayerProviderFactory.createProvider('feature-service', tempConfig);
  }

  /**
   * Get a previously created visualization layer
   */
  getVisualizationLayer(layerId: string): __esri.FeatureLayer | null {
    return this._visualizationLayers.get(layerId) || null;
  }

  /**
   * Update an existing visualization with new options
   */
  async updateVisualization(
    layerId: string,
    newOptions: Partial<VisualizationOptions>
  ): Promise<{ layer: __esri.FeatureLayer | null; extent: __esri.Extent | null }> {
    const layer = this._visualizationLayers.get(layerId);
    
    if (!layer) {
      console.warn(`Layer ${layerId} not found in visualization layers`);
      return { layer: null, extent: null };
    }
    
    try {
      // Implementation would update the existing layer's renderer, etc.
      // For now, just return the existing layer
      return { 
        layer, 
        extent: layer.fullExtent || null
      };
    } catch (error) {
      console.error('Failed to update visualization:', error);
      return { layer: null, extent: null };
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this._mapView = null;
    this._initialized = false;
    this._visualizationLayers.clear();
  }

  /**
   * Generates a unique cache key for the visualization
   */
  private generateCacheKey(
    type: VisualizationType,
    layerId: string,
    options: Partial<VisualizationOptions>
  ): string {
    const key: VisualizationCacheKey = {
      type,
      layerId,
      // Include query in cache key to differentiate between different queries
      options: JSON.stringify({
        query: options.query,
        fields: options.fields,
        where: options.where,
        outFields: options.outFields,
        renderer: options.renderer ? options.renderer.type : undefined,
        colorRamp: options.colorRamp,
        classification: options.classification,
        normalizeField: options.normalizeField,
        orderBy: options.orderBy
      })
    };
    
    return `${key.type}|${key.layerId}|${key.options}`;
  }
  
  /**
   * Retrieves a visualization from the cache if it exists and is not expired
   */
  private getCachedVisualization(cacheKey: string): any | null {
    const cached = this.visualizationCache.get(cacheKey);
    
    if (cached) {
      // Check if cache entry is expired
      if (Date.now() > cached.expiresAt) {
        // Remove expired cache entry
        this.visualizationCache.delete(cacheKey);
        return null;
      }
      
      return cached.result;
    }
    
    return null;
  }
  
  /**
   * Caches a visualization result
   */
  private cacheVisualization(cacheKey: string, result: any): void {
    // Manage cache size - if we're at max capacity, remove oldest entry
    if (this.visualizationCache.size >= this.MAX_CACHE_SIZE) {
      let oldestKey: string | null = null;
      let oldestTimestamp = Infinity;
      
      // Find the oldest cache entry
      for (const [key, entry] of this.visualizationCache.entries()) {
        if (entry.timestamp < oldestTimestamp) {
          oldestTimestamp = entry.timestamp;
          oldestKey = key;
        }
      }
      
      // Delete the oldest entry
      if (oldestKey) {
        this.visualizationCache.delete(oldestKey);
      }
    }
    
    // Add new cache entry
    const now = Date.now();
    this.visualizationCache.set(cacheKey, {
      result,
      timestamp: now,
      expiresAt: now + this.CACHE_TTL_MS
    });
  }
  
  /**
   * Clears all cached visualizations
   */
  clearCache(): void {
    this.visualizationCache.clear();
    console.log('Visualization cache cleared');
  }
  
  /**
   * Sets the cache time-to-live in milliseconds
   */
  setCacheTTL(ttlMs: number): void {
    if (ttlMs < 0) {
      throw new Error('Cache TTL must be a positive number');
    }
    this.CACHE_TTL_MS = ttlMs;
  }

  /**
   * Enable or disable ML classification
   */
  async toggleMLClassification(enable: boolean): Promise<void> {
    this.useMLClassification = enable;
    await queryClassifier.initializeML(enable);
  }
  
  /**
   * Update ML configuration
   */
  async updateMLConfig(config: any): Promise<void> {
    if (this.useMLClassification) {
      // Use proper method to update configuration instead of direct property access
      await queryClassifier.initializeML(true, config);
    }
  }
}

/**
 * Map analysis type to visualization type
 */
export function mapAnalysisTypeToVisualization(analysisType: string): VisualizationType {
  switch (analysisType.toLowerCase()) {
    case 'correlation':
      return VisualizationType.CORRELATION;
    case 'distribution':
    case 'thematic':
      return VisualizationType.CHOROPLETH;
    case 'cluster':
      return VisualizationType.CLUSTER;
    case 'joint_high':
    case 'joint-high':
      return VisualizationType.JOINT_HIGH;
    case 'trends':
      return VisualizationType.TRENDS;
    case 'categorical':
      return VisualizationType.CATEGORICAL;
    case 'heatmap':
    case 'density':
      return VisualizationType.HEATMAP;
    case 'point':
    case 'point_scatter':
      return VisualizationType.SCATTER;
    case 'top_n':
    case 'top-n':
    case 'ranking':
      return VisualizationType.TOP_N;
    case 'hexbin':
    case 'hex_bin':
    case 'hexagonal':
      return VisualizationType.HEXBIN;
    case 'bivariate':
    case 'dual_variable':
      return VisualizationType.BIVARIATE;
    case 'buffer':
    case 'proximity':
    case 'distance':
      return VisualizationType.BUFFER;
    case 'hotspot':
    case 'hot_spot':
    case 'coldspot':
    case 'significant_cluster':
      return VisualizationType.HOTSPOT;
    case 'network':
    case 'flow':
    case 'connection':
    case 'link':
      return VisualizationType.NETWORK;
    case 'multivariate':
    case 'multi_variable':
    case 'complex_analysis':
      return VisualizationType.MULTIVARIATE;
    case 'difference':
    case 'versus':
    case 'vs':
    case 'compare':
    case 'comparison':
      return VisualizationType.DIFFERENCE;
    default:
      return VisualizationType.CHOROPLETH;
  }
}

/**
 * Create a compatibility adapter for legacy code
 */
export function createCompatibilityAdapter(factory: DynamicVisualizationFactory) {
  return {
    createVisualization: async (type: string, layerId: string, options: any) => {
      return factory.createVisualization(type, layerId, options);
    },
    
    updateVisualization: async (layerId: string, options: any) => {
      return factory.updateVisualization(layerId, options);
    }
  };
} 