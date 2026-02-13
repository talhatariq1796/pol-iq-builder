import {
  AnalysisResult,
  EnhancedAnalysisResult,
} from '@/types/analysis';
import {
  LocalLayerResult,
  VisualizationOptions,
} from './visualization-factory';
import { VisualizationIntegration } from './visualization-integration';
import { AdvancedVisualizations } from './visualizations/advanced-visualizations';
import { isTopNQuery } from './visualization-helpers';
import { VisualizationResult } from './visualizations/base-visualization';
import { CorrelationVisualization } from './visualizations/correlation-visualization';
import { RankingVisualization } from './visualizations/ranking-visualization';
import { SingleLayerVisualization } from './visualizations/single-layer-visualization';
import { TrendsCorrelationVisualization } from './visualizations/trends-correlation-visualization';
import { TrendsVisualization } from './visualizations/trends-visualization';
import {
  createPopupTemplateFromConfig,
  createSimplePopupConfigForLayer,
} from './popup-utils';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { Renderer } from '@arcgis/core/renderers';
import { JointHighVisualization } from './visualizations/joint-visualization';

export interface VisualizationFactoryOptions {
  analysisResult: AnalysisResult;
  enhancedAnalysis: EnhancedAnalysisResult;
  features: { features: any[] };
  useAdvancedVisualization?: boolean;
  advancedOptions?: {
    field?: string;
    targetField?: string;
  };
}

export class VisualizationFactory {
  private visualizationIntegration: VisualizationIntegration;
  private useAdvancedVisualization: boolean;
  private advancedOptions: VisualizationFactoryOptions['advancedOptions'];

  constructor(options: VisualizationFactoryOptions) {
    this.visualizationIntegration = new VisualizationIntegration({
      analysisResult: options.analysisResult,
      enhancedAnalysis: options.enhancedAnalysis,
      features: options.features,
    });
    this.useAdvancedVisualization = options.useAdvancedVisualization || false;
    this.advancedOptions = options.advancedOptions;
  }

  private getNumericValue(value: any): number {
    if (typeof value === 'number' && !isNaN(value)) {
      return value;
    }

    if (typeof value === 'string') {
      // Remove any commas and percentage signs
      const cleanValue = value.replace(/,|%/g, '');
      const parsed = parseFloat(cleanValue);
      if (!isNaN(parsed)) {
        // If it was a percentage, divide by 100
        return value.includes('%') ? parsed / 100 : parsed;
      }
    }

    // Log unhandled value types for debugging
    console.log('[VisualizationFactory DEBUG] Unable to parse numeric value:', {
      value,
      type: typeof value,
      isNull: value === null,
      isUndefined: value === undefined,
    });

    return 0; // Default to 0 if parsing fails
  }

  public async createVisualization(
    layerResults: any[],
    options: VisualizationOptions
  ): Promise<VisualizationResult> {
    const { visualizationMode } = options;

    console.log(
      `[VisualizationFactory DEBUG] Creating visualization with mode: ${visualizationMode}`,
      {
        layerCount: layerResults.length,
        options,
        firstLayer: layerResults[0]
          ? {
              layerId: layerResults[0].layerId,
              layerName: layerResults[0].layerName,
              layerType: layerResults[0].layerType,
              featureCount: layerResults[0].features?.length,
              hasLayer: !!layerResults[0].layer,
              hasFeatures: !!layerResults[0].features,
              firstFeature: layerResults[0].features?.[0]
                ? {
                    hasGeometry: !!layerResults[0].features[0].geometry,
                    properties: Object.keys(
                      layerResults[0].features[0].properties || {}
                    ),
                  }
                : null,
            }
          : null,
      }
    );

    if (!layerResults || layerResults.length === 0) {
      throw new Error('No layer data provided for visualization.');
    }

    // Transform layerResults to the expected LocalLayerResult format
    const localLayerResults: LocalLayerResult[] = layerResults.map((lr) => ({
      layer: {
        id: lr.layerId,
        name: lr.layerName,
        type: lr.layerType || 'polygon', // default to polygon
        fields: lr.fields || [],
      },
      features: lr.features,
    }));

    try {
      const vizType =
        visualizationMode ||
        this.determineVisualizationType(localLayerResults, options);
      let result: VisualizationResult | null = null;

      switch (vizType) {
        case 'correlation':
          // Remove limit if present
          const correlationOptions = { ...options };
          if ('limit' in correlationOptions) delete correlationOptions.limit;
          result = await this.createCorrelationVisualization(
            localLayerResults,
            correlationOptions
          );
          break;

        case 'joint-high':
          // Remove limit if present
          const jointHighOptions = { ...options };
          if ('limit' in jointHighOptions) delete jointHighOptions.limit;
          result = await this.createJointHighVisualization(
            localLayerResults,
            jointHighOptions as any
          );
          break;

        case 'trends-correlation':
          // Remove limit if present
          const trendsCorrelationOptions = { ...options };
          if ('limit' in trendsCorrelationOptions) delete trendsCorrelationOptions.limit;
          result = await this.createTrendsCorrelationVisualization(
            localLayerResults,
            trendsCorrelationOptions
          );
          break;

        case 'trends':
          // Remove limit if present
          const trendsOptions = { ...options };
          if ('limit' in trendsOptions) delete trendsOptions.limit;
          result = await this.createTrendsVisualization(
            localLayerResults,
            trendsOptions
          );
          break;

        case 'ranking': {
          const { limit } = this.extractTopNLimit(options.query || '');
          const updatedOptions = {
            ...options,
            limit,
          };
          result = await this.createRankingVisualization(
            localLayerResults,
            updatedOptions
          );
          break;
        }

        case 'choropleth':
        case 'single-layer':
        default:
          // Remove limit if present
          const singleLayerOptions = { ...options };
          if ('limit' in singleLayerOptions) delete singleLayerOptions.limit;
          result = await this.createSingleLayerVisualization(
            localLayerResults,
            singleLayerOptions
          );
          break;
      }

      // Default popup handling
      if (
        result &&
        result.layer &&
        !result.layer.popupTemplate &&
        options.popupConfig
      ) {
        const popupTemplate = createPopupTemplateFromConfig(options.popupConfig);
        if (popupTemplate) {
          result.layer.popupTemplate = popupTemplate;
        }
      } else if (result && result.layer && !result.layer.popupTemplate) {
        // Create a default popup if none is provided but there are features
        const firstLayer = layerResults[0];
        if (firstLayer && firstLayer.features && firstLayer.features.length > 0) {
          const popupConfig = createSimplePopupConfigForLayer(
            firstLayer,
            options.title
          );
          const popupTemplate = createPopupTemplateFromConfig(popupConfig);
          if (popupTemplate) {
            result.layer.popupTemplate = popupTemplate;
          }
        }
      }

      if (!result) {
        throw new Error(`Unsupported visualization type: ${vizType}`);
      }

      // Add legend info to the result
      if (result.layer) {
        const renderer = (result.layer as FeatureLayer).renderer;
        if (renderer && 'legendOptions' in renderer && renderer.legendOptions) {
          result.legendInfo = {
            type: 'standard',
            title: (renderer.legendOptions as any).title,
            items:
              (renderer as any).authoringInfo?.visualVariables?.map((vv: any) => ({
                label: vv.label,
                color: vv.color || 'transparent',
              })) || [],
          };
        }
      }

      return result;
    } catch (error) {
      console.error(
        '[VisualizationFactory DEBUG] Error creating visualization:',
        error
      );
      throw error;
    }
  }

  private createAdvancedRenderer(): Renderer | null {
    const { enhancedAnalysis, features } = this.visualizationIntegration;

    // Add comprehensive null checks for enhancedAnalysis and its properties
    if (!enhancedAnalysis?.queryType || !enhancedAnalysis?.visualizationStrategy) {
      console.warn(
        '[VisualizationFactory] Missing required analysis properties for advanced renderer'
      );
      return null;
    }

    const { queryType, visualizationStrategy } = enhancedAnalysis;

    // Validate features array
    if (!features?.features?.length) {
      console.warn('[VisualizationFactory] No features available for rendering');
      return null;
    }

    const advancedOptions = {
      features: features.features,
      field: visualizationStrategy.targetVariable,
      ...this.advancedOptions,
    };

    switch (queryType) {
      case 'correlation':
        if (!visualizationStrategy.correlationField) {
          console.warn(
            '[VisualizationFactory] Missing correlation field for correlation visualization'
          );
          return null;
        }
        return AdvancedVisualizations.createBivariateRenderer({
          ...advancedOptions,
          targetField: visualizationStrategy.correlationField,
        });

      case 'ranking':
        if (!visualizationStrategy.rankingField) {
          console.warn(
            '[VisualizationFactory] Missing ranking field for ranking visualization'
          );
          return null;
        }
        return AdvancedVisualizations.createQuantileRenderer({
          ...advancedOptions,
          field: visualizationStrategy.rankingField,
        });

      case 'distribution':
        if (!visualizationStrategy.distributionField) {
          console.warn(
            '[VisualizationFactory] Missing distribution field for distribution visualization'
          );
          return null;
        }
        return AdvancedVisualizations.createStandardDeviationRenderer({
          ...advancedOptions,
          field: visualizationStrategy.distributionField,
        });

      default:
        return AdvancedVisualizations.createHeatmapRenderer(advancedOptions);
    }
  }

  private determineVisualizationType(
    layerResults: LocalLayerResult[],
    options: VisualizationOptions
  ):
    | 'correlation'
    | 'point-layer'
    | 'single-layer'
    | 'trends'
    | 'trends-correlation'
    | 'joint-high'
    | 'ranking'
    | 'choropleth' {
    console.log('Determining visualization type:', {
      query: options.query,
      layerCount: layerResults.length,
      layerNames: layerResults.map((l) => l.layer.name),
    });

    // First check if visualization mode is explicitly set
    if (options.visualizationMode) {
      console.log('Using explicit visualization mode:', options.visualizationMode);
      return options.visualizationMode as any;
    }

    // Use the analysis result's query type if available
    if (this.visualizationIntegration.analysisResult?.queryType) {
      const queryType = this.visualizationIntegration.analysisResult.queryType;
      console.log('Using query type from analysis result:', queryType);
      
      // Map the query type to visualization type
      switch (queryType) {
        case 'correlation':
          return 'correlation';
        case 'jointHigh':
          return 'joint-high';
        case 'trends':
          return 'trends';
        case 'topN':
          return 'ranking';
        case 'distribution':
        case 'simple_display':
        default:
          return 'single-layer';
      }
    }

    const query = options.query?.toLowerCase() || '';

    // Check for topN queries first
    if (isTopNQuery(query)) {
      console.log('Detected topN query');
      return 'ranking';
    }

    // Check for JOINT HIGH queries - areas that are high in multiple variables
    const jointHighKeywords = [
      'highest rates of',
      'high levels of.*and.*',
      'areas.*highest.*and',
      'regions.*highest.*and',
      'high.*both',
      'areas with high.*and.*',
      'regions with high.*and.*',
      'highest.*both',
      'areas that have high.*and.*',
      'regions that have high.*and.*',
    ];

    const hasJointHighPattern = jointHighKeywords.some((pattern) =>
      new RegExp(pattern, 'i').test(query)
    );

    // Additional check for "and" with superlative terms and multiple layer results
    const hasSuperlativeAndMultipleVariables =
      (query.includes('highest') ||
        query.includes('top') ||
        query.includes('most')) &&
      query.includes(' and ') &&
      layerResults.length >= 2;

    if (hasJointHighPattern || hasSuperlativeAndMultipleVariables) {
      return 'joint-high';
    }

    // Check for correlation queries
    if (
      query.includes('correlation') ||
      query.includes('relationship') ||
      query.includes('compare') ||
      query.includes('versus') ||
      query.includes('vs')
    ) {
      return 'correlation';
    }

    // Check for trends queries
    if (
      query.includes('trend') ||
      query.includes('over time') ||
      query.includes('change')
    ) {
      return 'trends';
    }

    // Default to single layer visualization
    return 'single-layer';
  }

  private async createSingleLayerVisualization(
    layerResults: LocalLayerResult[],
    options: VisualizationOptions
  ): Promise<{ layer: __esri.FeatureLayer | null; extent: __esri.Extent | null }> {
    try {
      console.log(
        '[VisualizationFactory DEBUG] About to create SingleLayerVisualization instance'
      );
      console.log(
        '[VisualizationFactory DEBUG] SingleLayerVisualization class:',
        SingleLayerVisualization
      );
      console.log(
        '[VisualizationFactory DEBUG] SingleLayerVisualization type:',
        typeof SingleLayerVisualization
      );

      const singleViz = new SingleLayerVisualization();

      console.log(
        '[VisualizationFactory DEBUG] SingleLayerVisualization instance created:',
        singleViz
      );
      console.log(
        '[VisualizationFactory DEBUG] Instance has create method:',
        typeof singleViz.create
      );
      console.log(
        '[VisualizationFactory DEBUG] Instance methods:',
        Object.getOwnPropertyNames(Object.getPrototypeOf(singleViz))
      );

      // Handle cases where layer property might not exist
      const layerResult = layerResults[0];
      const layerConfig = layerResult.layer || layerResult;
      const layerName = layerConfig.name || 'Default Layer';

      const result = await singleViz.create(
        {
          features: layerResult.features || [],
          layerName: layerName,
          rendererField: layerConfig.rendererField || 'thematic_value',
          layerConfig: {
            fields: (layerConfig.fields || []).map((field) => ({
              ...field,
              type: field.type as
                | 'string'
                | 'oid'
                | 'small-integer'
                | 'integer'
                | 'single'
                | 'double'
                | 'long'
                | 'date'
                | 'big-integer'
                | 'date-only'
                | 'time-only'
                | 'timestamp-offset'
                | 'geometry'
                | 'blob'
                | 'raster'
                | 'guid'
                | 'global-id'
                | 'xml',
            })),
          },
        },
        options
      );
      return result;
    } catch (error) {
      console.error('Error creating single layer visualization:', error);
      return { layer: null, extent: null };
    }
  }

  private async createTrendsVisualization(
    layerResults: LocalLayerResult[],
    options: VisualizationOptions
  ): Promise<{ layer: __esri.FeatureLayer | null; extent: __esri.Extent | null }> {
    try {
      const trendsViz = new TrendsVisualization();

      // Extract keyword from query using more sophisticated parsing
      let keyword = 'default';
      if (options.query) {
        // Look for phrases like "trends for X" or "trending X"
        const trendMatch = options.query.match(
          /(?:trends?|trending)\s+(?:for\s+)?([a-zA-Z0-9\s]+)/i
        );
        if (trendMatch) {
          keyword = trendMatch[1].trim();
        } else {
          // Fallback to last word if no specific pattern found
          keyword = options.query.split(' ').pop() || 'default';
        }
      }

      const result = await trendsViz.create(
        {
          features: [], // Will be populated by the visualization
          layerName: `Trends: ${keyword}`,
          keyword: keyword,
          timeframe: 'today 12-m',
          geo: 'US',
        },
        options
      );

      return result;
    } catch (error) {
      console.error('Error creating trends visualization:', error);
      return { layer: null, extent: null };
    }
  }

  private async createCorrelationVisualization(
    layerResults: LocalLayerResult[],
    options: VisualizationOptions
  ): Promise<{ layer: __esri.FeatureLayer | null; extent: __esri.Extent | null }> {
    try {
      console.log('[VisualizationFactory DEBUG] Creating correlation visualization:', {
        layerCount: layerResults.length,
        options,
      });

      // Get the primary layer and its configuration
      const primaryLayer = layerResults[0];
      if (!primaryLayer || !primaryLayer.layer) {
        console.error(
          '[VisualizationFactory DEBUG] Missing primary layer or layer configuration'
        );
        return { layer: null, extent: null };
      }

      const layerConfig = primaryLayer.layer;
      console.log('[VisualizationFactory DEBUG] Using layer config:', layerConfig);

      // Get numeric fields from the layer
      const numericFields = primaryLayer.features[0]
        ? Object.entries(
            primaryLayer.features[0].properties ||
              primaryLayer.features[0].attributes ||
              {}
          )
            .filter(([_, v]) => typeof v === 'number' && !isNaN(v))
            .map(([k]) => k)
        : [];

      console.log('Available numeric fields:', {
        layerId: layerConfig.id || 'unknown',
        fields: numericFields,
        rendererField: layerConfig.rendererField,
        sampleFeature: primaryLayer.features[0]
          ? {
              attributes: primaryLayer.features[0].attributes,
              properties: primaryLayer.features[0].properties,
              geometry: primaryLayer.features[0].geometry,
            }
          : null,
      });

      // Improved field selection logic for correlation
      const primaryField = layerConfig.rendererField || numericFields[0];
      const comparisonField = numericFields.find((f) => f !== primaryField);

      if (!primaryField || !comparisonField) {
        console.warn('Missing required numeric fields for correlation:', {
          layerId: layerConfig.id || 'unknown',
          availableFields: numericFields,
          rendererField: layerConfig.rendererField,
          primaryField,
          comparisonField,
        });
        return { layer: null, extent: null };
      }

      console.log('Proceeding with correlation visualization using fields:', {
        primaryField,
        comparisonField,
        layerId: layerConfig.id || 'unknown',
      });

      // Create correlation visualization
      const correlationViz = new CorrelationVisualization();

      // Prepare the data for the correlation visualization
      const correlationData = {
        features: primaryLayer.features.map((feature, index) => {
          const values = feature.properties || feature.attributes || {};
          return {
            geometry: feature.geometry,
            attributes: {
              OBJECTID: index + 1,
              primary_value: this.getNumericValue(values[primaryField]),
              comparison_value: this.getNumericValue(values[comparisonField]),
              correlation_strength: 0, // Will be calculated by the visualization
              ...values,
            },
          };
        }),
        layerName: layerConfig.name || 'Correlation Layer',
        rendererField: 'correlation_strength',
        primaryField,
        comparisonField,
        primaryLayerId: layerConfig.id || 'primary',
        comparisonLayerId: layerConfig.id || 'comparison',
        layerConfig: {
          name: layerConfig.name || 'Correlation Layer',
          fields: [
            { name: 'OBJECTID', type: 'oid' as any },
            { name: 'primary_value', type: 'double' as any },
            { name: 'comparison_value', type: 'double' as any },
            { name: 'correlation_strength', type: 'double' as any },
          ],
        },
      };

      // Create the visualization
      const result = await correlationViz.create(correlationData, {
        ...options,
        title: `Correlation: ${primaryField} vs ${comparisonField}`,
      });

      console.log('Correlation visualization created:', {
        layerTitle: result.layer?.title,
        featureCount: result.layer?.source?.length,
        extent: result.extent?.toJSON(),
      });

      return result;
    } catch (error) {
      console.error('Error creating correlation visualization:', error);
      return { layer: null, extent: null };
    }
  }

  private async createTrendsCorrelationVisualization(
    layerResults: LocalLayerResult[],
    options: VisualizationOptions
  ): Promise<{ layer: __esri.FeatureLayer | null; extent: __esri.Extent | null }> {
    try {
      console.log('=== Creating Trends Correlation Visualization ===');

      if (layerResults.length < 2) {
        console.error(
          'Insufficient layers for trends correlation. Need at least 2 layers.'
        );
        return { layer: null, extent: null };
      }

      const primaryLayer = layerResults[0];
      const comparisonLayer = layerResults[1];

      // Safely access layer properties with proper fallbacks
      const primaryLayerConfig = primaryLayer.layer || primaryLayer;
      const comparisonLayerConfig = comparisonLayer.layer || comparisonLayer;

      // Special handling for Mark Carney data with safe property access
      const isPrimaryMarkCarney =
        primaryLayerConfig.id?.includes('markcarney') ||
        primaryLayerConfig.name?.toLowerCase().includes('mark carney') ||
        false;

      const isComparisonMarkCarney =
        comparisonLayerConfig.id?.includes('markcarney') ||
        comparisonLayerConfig.name?.toLowerCase().includes('mark carney') ||
        false;

      // Determine the type of each layer (trends or demographics) with safe property access
      const isPrimaryTrends =
        isPrimaryMarkCarney ||
        primaryLayerConfig.id?.includes('trends') ||
        primaryLayerConfig.name?.toLowerCase().includes('trend') ||
        false;

      const isComparisonTrends =
        isComparisonMarkCarney ||
        comparisonLayerConfig.id?.includes('trends') ||
        comparisonLayerConfig.name?.toLowerCase().includes('trend') ||
        false;

      // Force Mark Carney data to be considered as trends type
      const primaryType = isPrimaryTrends ? 'trends' : 'demographics';
      const comparisonType = isComparisonTrends ? 'trends' : 'demographics';

      // Find fields to use for correlation with safe property access
      const primaryField =
        primaryLayerConfig.rendererField ||
        Object.keys(primaryLayer.features[0]?.attributes || {}).find(
          (key) =>
            typeof primaryLayer.features[0]?.attributes[key] === 'number'
        ) ||
        'value';

      const comparisonField =
        comparisonLayerConfig.rendererField ||
        Object.keys(comparisonLayer.features[0]?.attributes || {}).find(
          (key) =>
            typeof comparisonLayer.features[0]?.attributes[key] === 'number'
        ) ||
        'value';

      console.log('Creating trends correlation with:', {
        primaryLayer: primaryLayerConfig.name || 'Primary Layer',
        primaryType,
        primaryField,
        primaryFeatureCount: primaryLayer.features?.length || 0,
        comparisonLayer: comparisonLayerConfig.name || 'Comparison Layer',
        comparisonType,
        comparisonField,
        comparisonFeatureCount: comparisonLayer.features?.length || 0,
        isPrimaryMarkCarney,
        isComparisonMarkCarney,
      });

      // Create visualization with the determined parameters
      console.log(
        '[VisualizationFactory DEBUG] Creating TrendsCorrelationVisualization instance'
      );

      try {
        const trendsCorrelationViz = new TrendsCorrelationVisualization();

        // Debug check to ensure the instance has the create method
        console.log(
          '[VisualizationFactory DEBUG] TrendsCorrelationVisualization instance created:',
          {
            hasCreateMethod: typeof trendsCorrelationViz.create === 'function',
            instanceType: typeof trendsCorrelationViz,
            className: trendsCorrelationViz.constructor.name,
            methods: Object.getOwnPropertyNames(
              Object.getPrototypeOf(trendsCorrelationViz)
            ),
          }
        );

        if (typeof trendsCorrelationViz.create !== 'function') {
          console.error(
            '[VisualizationFactory DEBUG] TrendsCorrelationVisualization.create is not a function, falling back to correlation visualization'
          );
          // Fall back to regular correlation visualization
          return this.createCorrelationVisualization(layerResults, options);
        }

        const result = await trendsCorrelationViz.create(
          {
            features: [], // Base visualization will handle this
            layerName: `Correlation: ${
              primaryLayerConfig.name || 'Layer 1'
            } vs ${comparisonLayerConfig.name || 'Layer 2'}`,
            primaryLayerFeatures: primaryLayer.features || [],
            primaryField,
            primaryType,
            comparisonLayerFeatures: comparisonLayer.features || [],
            comparisonField,
            comparisonType,
            joinField: options.joinField || 'CSDNAME', // Default join field for Census Subdivisions
          },
          options
        );

        return result;
      } catch (error) {
        console.error(
          '[VisualizationFactory DEBUG] Error with TrendsCorrelationVisualization, falling back to correlation visualization:',
          error
        );
        // Fall back to regular correlation visualization
        return this.createCorrelationVisualization(layerResults, options);
      }
    } catch (error) {
      console.error('Error creating trends correlation visualization:', error);
      return { layer: null, extent: null };
    }
  }

  // Add helper method to extract the limit from topN queries
  private extractTopNLimit(query: string): { limit: number } {
    const numberPattern = /(?:top|highest|largest|greatest|most)\s+(\d+)/i;
    const match = query.match(numberPattern);
    if (match && match[1]) {
      return { limit: parseInt(match[1], 10) };
    }
    return { limit: 10 }; // Default to top 10 if no number specified
  }

  // Add the createRankingVisualization method
  private async createRankingVisualization(
    layerResults: LocalLayerResult[],
    options: VisualizationOptions & { limit: number }
  ): Promise<VisualizationResult> {
    try {
      const layerConfig = layerResults[0]?.layer || {};
      const rankingField =
        options.primaryField || layerConfig.rendererField || 'value';

      // Get features and ensure they have valid geometries
      const features = layerResults[0]?.features || [];
      const validFeatures = features.filter((feature) => {
        // Check if feature has geometry
        if (!feature.geometry) {
          console.warn('Feature missing geometry:', {
            featureId: feature.properties?.FSA_ID || feature.properties?.ID,
          });
          return false;
        }

        // Normalize geometry type to uppercase for consistent comparison
        const geometryType = feature.geometry.type.toUpperCase();

        // For Polygon features
        if (geometryType === 'POLYGON') {
          // Check for either rings (ArcGIS format) or coordinates (GeoJSON format)
          const hasValidStructure =
            (Array.isArray(feature.geometry.rings) &&
              feature.geometry.rings.length > 0) ||
            (Array.isArray(feature.geometry.coordinates) &&
              feature.geometry.coordinates.length > 0);

          if (!hasValidStructure) {
            console.warn('Polygon feature missing valid rings/coordinates:', {
              featureId: feature.properties?.FSA_ID || feature.properties?.ID,
              hasRings: Array.isArray(feature.geometry.rings),
              ringsLength: feature.geometry.rings?.length,
              hasCoordinates: Array.isArray(feature.geometry.coordinates),
              coordsLength: feature.geometry.coordinates?.length,
            });
            return false;
          }

          // Ensure the coordinates are valid
          const coordinates = feature.geometry.coordinates || feature.geometry.rings;
          const hasValidCoordinates = coordinates.every((ring: number[][]) =>
            Array.isArray(ring) &&
            ring.length >= 3 && // At least 3 points for a valid polygon
            ring.every(
              (coord: number[]) =>
                Array.isArray(coord) &&
                coord.length >= 2 && // Each coordinate should have at least [lon, lat]
                coord[0] >= -180 &&
                coord[0] <= 180 && // Valid longitude
                coord[1] >= -90 &&
                coord[1] <= 90 // Valid latitude
            )
          );

          if (!hasValidCoordinates) {
            console.warn('Polygon feature has invalid coordinates:', {
              featureId: feature.properties?.FSA_ID || feature.properties?.ID,
              sampleCoordinates: coordinates[0]?.slice(0, 3),
            });
            return false;
          }

          return true;
        }

        // For Point features
        if (geometryType === 'POINT') {
          const coordinates = feature.geometry.coordinates;
          if (!Array.isArray(coordinates) || coordinates.length < 2) {
            console.warn('Point feature missing valid coordinates:', {
              featureId: feature.properties?.FSA_ID || feature.properties?.ID,
            });
            return false;
          }

          const [lon, lat] = coordinates;
          const hasValidCoordinates =
            lon >= -180 &&
            lon <= 180 && // Valid longitude
            lat >= -90 &&
            lat <= 90; // Valid latitude

          if (!hasValidCoordinates) {
            console.warn('Point feature has invalid coordinates:', {
              featureId: feature.properties?.FSA_ID || feature.properties?.ID,
              coordinates,
            });
            return false;
          }

          return true;
        }

        console.warn('Unsupported geometry type:', {
          featureId: feature.properties?.FSA_ID || feature.properties?.ID,
          geometryType,
        });
        return false;
      });

      if (validFeatures.length === 0) {
        throw new Error('No features with valid geometries found for visualization');
      }

      // Sort features by ranking field and convert to ArcGIS Graphics
      const topFeatures = validFeatures
        .sort(
          (a, b) =>
            (b.properties[rankingField] || 0) - (a.properties[rankingField] || 0)
        )
        .slice(0, options.limit)
        .map((feature) => {
          // Ensure proper geometry structure for ArcGIS
          const geometry =
            feature.geometry.type.toUpperCase() === 'POLYGON'
              ? {
                  type: 'polygon',
                  rings: feature.geometry.rings || feature.geometry.coordinates,
                  spatialReference:
                    feature.geometry.spatialReference || { wkid: 4326 },
                }
              : {
                  type: 'point',
                  x: feature.geometry.coordinates[0],
                  y: feature.geometry.coordinates[1],
                  spatialReference:
                    feature.geometry.spatialReference || { wkid: 4326 },
                };

          return {
            geometry,
            attributes: {
              ...feature.properties,
              OBJECTID:
                feature.properties.OBJECTID ||
                feature.properties.FSA_ID ||
                feature.properties.ID,
            },
          };
        });

      // Create visualization with proper data structure
      const rankingViz = new RankingVisualization();
      const result = await rankingViz.create(
        {
          features: topFeatures,
          layerName: `Top ${options.limit} ${layerConfig.name || 'Areas'}`,
          rendererField: rankingField,
          layerConfig: {
            name: layerConfig.name || 'Ranking Layer',
            fields: [
              { name: 'OBJECTID', type: 'oid' as any },
              { name: rankingField, type: 'double' as any },
              { name: 'FSA_ID', type: 'string' as any },
              { name: 'FREQUENCY', type: 'double' as any },
            ],
          },
        },
        {
          ...options,
          popupConfig: {
            titleExpression: '$feature.FSA_ID',
            content: [
              {
                type: 'fields',
                fieldInfos: [
                  { fieldName: rankingField, label: 'Value', visible: true },
                  { fieldName: 'FREQUENCY', label: 'Frequency', visible: true },
                ],
                displayType: 'list',
              },
            ],
          },
        }
      );

      return result;
    } catch (error) {
      console.error('Error creating ranking visualization:', error);
      return { layer: null, extent: null };
    }
  }

  private async createJointHighVisualization(
    layerResults: LocalLayerResult[],
    options: VisualizationOptions
  ): Promise<VisualizationResult> {
    try {
      const layer = layerResults[0];
      if (!layer) throw new Error('No layer data available for joint-high visualization');

      // Heuristic: use rendererField as primary and pick another numeric field for comparison
      const numericFields = layer.features[0]
        ? Object.keys(layer.features[0].properties || {}).filter((k) =>
            typeof layer.features[0].properties[k] === 'number'
          )
        : [];
      let primaryField = layer.layer.rendererField || 'thematic_value';
      if (!numericFields.includes(primaryField)) {
        primaryField = numericFields[0];
      }
      const comparisonField = numericFields.find((f) => f !== primaryField) || numericFields[1];
      if (!primaryField || !comparisonField) {
        throw new Error('Could not determine two numeric fields for joint-high visualization');
      }

      const jointViz = new JointHighVisualization();
      const result = await jointViz.create(
        {
          features: layer.features,
          layerName: layer.layer.name || 'Joint High',
          primaryField,
          comparisonField,
          rendererField: 'joint_score',
          layerConfig: {
            fields: [
              { name: primaryField, type: 'double' as any },
              { name: comparisonField, type: 'double' as any },
            ],
          },
        },
        { title: options.title }
      );
      return result;
    } catch (err) {
      console.error('Error creating joint-high visualization:', err);
      return { layer: null, extent: null } as VisualizationResult;
    }
  }
} 