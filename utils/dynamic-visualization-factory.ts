// Import ArcGIS dependencies
import MapView from '@arcgis/core/views/MapView';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import SpatialReference from '@arcgis/core/geometry/SpatialReference';
import Point from '@arcgis/core/geometry/Point';
import Polygon from '@arcgis/core/geometry/Polygon';
import Polyline from '@arcgis/core/geometry/Polyline';
import Multipoint from '@arcgis/core/geometry/Multipoint';
import Extent from '@arcgis/core/geometry/Extent';
import type WebMap from '@arcgis/core/WebMap';
import type Geometry from '@arcgis/core/geometry/Geometry';

// Import local types and utilities
import { VisualizationOptions } from './visualizations/base-visualization';
import { LayerResult } from '../types/geospatial-ai-types';
import { SingleLayerVisualization, SingleLayerData, SingleLayerOptions } from './visualizations/single-layer-visualization';
import { PointLayerVisualization } from './visualizations/point-layer-visualization';
import { CorrelationVisualization } from './visualizations/correlation-visualization';
import type { CorrelationData } from './visualizations/correlation-visualization';
import { LayerField } from '../types/geospatial-ai-types';
import { TopNVisualization } from './visualizations/top-n-visualization';
import { TopNData } from './visualizations/top-n-visualization';
import { CorrelationService } from '../services/correlation-service';
import { createGeometry } from "@/utils/geometry";
import { layers } from '../config/layers';
import { ProcessedLayerResult, VisualizationResult } from '../types/geospatial-chat';
import { LocalGeospatialFeature } from '../types/index';
import { layers as configLayers } from '@/config/layers';
import { LayerConfig } from '@/types/layers';
import { AnalysisContext } from './feature-optimization';
import { JointHighVisualization } from './visualizations/joint-visualization';
import type { ArcGISGeometryType } from '../types/geospatial-chat-component';

// Define GeometryType locally since it's not exported from correlation-visualization
type GeometryType = Point | Polygon | Polyline | Multipoint | Extent;

// Add type guard for geometry
function isGeometryType(geometry: Geometry | null): geometry is GeometryType {
  return geometry instanceof Point ||
         geometry instanceof Polygon ||
         geometry instanceof Polyline ||
         geometry instanceof Multipoint ||
         geometry instanceof Extent;
}

// Add type definitions for graphics
interface GraphicWithProperties extends Graphic {
  properties?: {
    [key: string]: any;
  };
}

interface TypedGraphic extends Omit<Graphic, 'geometry'> {
  attributes: {
    [key: string]: any;
    OBJECTID: number;
    primary_value: number;
    comparison_value: number;
    correlation_strength: number;
  };
  geometry: Geometry | null;
}

type FieldType = "string" | "geometry" | "double" | "oid" | "small-integer" | "integer" | "single" | "long" | "date" | "big-integer" | "date-only" | "time-only" | "timestamp-offset" | "blob" | "raster" | "guid" | "global-id" | "xml";

interface Distribution {
  type: string;
  parameters: any;
}

interface Correlation {
  field1: string;
  field2: string;
  strength: number;
  method: 'pearson' | 'spearman' | 'kendall';
  significance: number;
  spatialStats?: {
    moransI: number;
    getisOrdG: number;
    hotSpots: number;
    coldSpots: number;
    outliers: number;
  };
}

interface SpatialRelationship {
  layer1: string;
  layer2: string;
  type: string;
  strength: number;
}

interface StatisticalRelationship {
  layer1: string;
  layer2: string;
  correlation: number;
  significance: number;
  method: 'pearson' | 'spearman' | 'kendall';
  spatialStats?: {
    moransI: number;
    getisOrdG: number;
    hotSpots: number;
    coldSpots: number;
    outliers: number;
  };
}

interface TemporalPattern {
  frequency: string;
  trend: string;
}

interface AIVisualizationContext {
  spatialPatterns?: {
    clustering: number;
    distribution: string;
    density: number;
  };
  attributePatterns?: {
    correlations: Array<{
      field1: string;
      field2: string;
      strength: number;
      method: 'pearson' | 'spearman' | 'kendall';
      significance: number;
      spatialStats?: {
        moransI: number;
        getisOrdG: number;
        hotSpots: number;
        coldSpots: number;
        outliers: number;
      };
    }>;
    distributions: { [field: string]: Distribution };
  };
  relationships?: {
    spatial: SpatialRelationship[];
    statistical: Array<{
      layer1: string;
      layer2: string;
      correlation: number;
      significance: number;
      method: 'pearson' | 'spearman' | 'kendall';
      spatialStats?: {
        moransI: number;
        getisOrdG: number;
        hotSpots: number;
        coldSpots: number;
        outliers: number;
      };
    }>;
  };
  temporalPatterns?: TemporalPattern;
  featureType?: string;
}

interface AIVisualizationPrompt {
  type: string;
  prompt: (context: AIVisualizationContext) => string;
  context: AIVisualizationContext;
}

interface DynamicAnalysis {
  layerCharacteristics: {
    spatialPatterns: {
      clustering: number;
      distribution: string;
      density: number;
    };
    attributePatterns: {
      correlations: Array<{
        field1: string;
        field2: string;
        strength: number;
        method: 'pearson' | 'spearman' | 'kendall';
        significance: number;
        spatialStats?: {
          moransI: number;
          getisOrdG: number;
          hotSpots: number;
          coldSpots: number;
          outliers: number;
        };
      }>;
      distributions: { [field: string]: Distribution };
    };
  };
  relationships: {
    spatial: Array<{
      layer1: string;
      layer2: string;
      type: string;
      strength: number;
    }>;
    statistical: Array<{
      layer1: string;
      layer2: string;
      correlation: number;
      significance: number;
      method: 'pearson' | 'spearman' | 'kendall';
      spatialStats?: {
        moransI: number;
        getisOrdG: number;
        hotSpots: number;
        coldSpots: number;
        outliers: number;
      };
    }>;
  };
  visualizationSuggestions: Array<{
    type: string;
    confidence: number;
    reasoning: string;
    parameters: {
      spatial: any;
      visual: any;
      analytical: any;
    };
  }>;
}

// Local interfaces for internal use
interface LocalPoint {
  x: number;
  y: number;
}

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface Layer {
  layer: {
    id: string;
    name: string;
    type: string;
    rendererField?: string;
    visualizationMode?: string;
    geographicType?: string;
  };
  features: Graphic[];
  fields?: LayerField[];
}

interface MultivariateData {
  features: Graphic[];
  fields: LayerField[];
  fieldBreaks: number[][];
  title: string;
}

interface MultivariateVisualizationData {
  features: Graphic[];
  fields: LayerField[];
  fieldBreaks: number[][];
  title: string;
}

interface FilterCondition {
  field: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  value: number;
}

interface PointVisualizationOptions {
  title: string;
  symbolConfig: {
    color: [number, number, number, number];
    size: number;
    outline: {
      color: [number, number, number, number];
      width: number;
    };
  };
}

interface PointVisualizationData {
  features: Array<{
    geometry: any;
    properties: any;
    attributes: any;
  }>;
  layerName: string;
  rendererField: string;
  layerConfig: {
    fields: LayerField[];
  };
}

// Define specific options for Correlation Visualization
interface CorrelationOptions extends VisualizationOptions {
  primaryField?: string;      // The main field to analyze (e.g., visible minority)
  comparisonField?: string;   // The second field for generic correlation (if no party)
  comparisonParty?: string;   // The political party to compare against (optional)
  isCrossGeography?: boolean; // Flag to indicate cross-geography correlation
  query?: string;             // The user's query string for additional context
  relevantFields?: string[];  // <-- ADD THIS LINE: Fields identified by AI
  colorScheme?: string;
  classificationMethod?: string;
  classificationBreaks?: number[];
  popupConfig?: any;
}

// Use the imported types directly
type ArcGISFeatureLayer = InstanceType<typeof FeatureLayer>;
type ArcGISGraphic = InstanceType<typeof Graphic>;
type ArcGISPoint = InstanceType<typeof Point>;
type ArcGISPolygon = InstanceType<typeof Polygon>;
type ArcGISPolyline = InstanceType<typeof Polyline>;
type ArcGISMultipoint = InstanceType<typeof Multipoint>;

// For geometry, we'll use the union type
type ArcGISGeometry = Point | Polygon | Polyline | Multipoint | Extent;

export class DynamicVisualizationFactory {
  private correlationViz: CorrelationVisualization;
  private jointHighViz: JointHighVisualization;
  public mapView: MapView | null = null;

  constructor() {
    this.correlationViz = new CorrelationVisualization();
    this.jointHighViz = new JointHighVisualization();
  }
  
  private readonly visualizationPrompts: AIVisualizationPrompt[] = [
    {
      type: 'point-layer',
      prompt: (context) => `Analyze point data visualization needs.
        Consider:
        - Point density: ${context.spatialPatterns?.density || 'unknown'}
        - Clustering level: ${context.spatialPatterns?.clustering || 'unknown'}
        - Distribution pattern: ${context.spatialPatterns?.distribution || 'unknown'}
        Best for: Individual point locations, discrete events, or facilities
        Avoid if: Data represents areas or continuous phenomena`,
      context: {}
    },
    {
      type: 'single-layer',
      prompt: (context) => `Analyze single layer polygon visualization needs.
        Consider:
        - Data distribution: ${Object.entries(context.attributePatterns?.distributions || {}).map(([field, dist]) => `${field}: ${dist.type}`).join(', ') || 'none'}
        - Feature count: ${context.spatialPatterns?.density || 'unknown'}
        Best for: Area-based data, administrative boundaries, zones
        Avoid if: Data represents points or networks`,
      context: {}
    },
    {
      type: 'correlation',
      prompt: (context) => `Analyze correlation visualization needs.
        Consider:
        - Statistical correlations: ${context.relationships?.statistical.map(r => `${r.layer1}-${r.layer2}: ${r.correlation}`).join(', ') || 'none'}
        - Variable relationships: ${context.attributePatterns?.correlations.map(c => `${c.field1}-${c.field2}: ${c.strength}`).join(', ') || 'none'}
        Best for: Comparing two or more variables, finding relationships
        Avoid if: Single variable analysis or spatial patterns are more important`,
      context: {}
    },
    {
      type: 'hotspot',
      prompt: (context) => `Analyze hotspot visualization needs.
        Consider:
        - Clustering intensity: ${context.spatialPatterns?.clustering || 'unknown'}
        - Point density variations: ${context.spatialPatterns?.density || 'unknown'}
        Best for: Identifying areas of high concentration or activity
        Avoid if: Data is uniformly distributed or categorical`,
      context: {}
    },
    {
      type: 'bivariate',
      prompt: (context) => `Analyze bivariate visualization needs.
        Consider:
        - Variable correlations: ${context.attributePatterns?.correlations.map(c => `${c.field1}-${c.field2}: ${c.strength}`).join(', ') || 'none'}
        - Distribution types: ${Object.entries(context.attributePatterns?.distributions || {}).map(([field, dist]) => `${field}: ${dist.type}`).join(', ') || 'none'}
        Best for: Showing relationship between two variables simultaneously
        Avoid if: More than two variables or single variable is sufficient`,
      context: {}
    },
    {
      type: 'multivariate',
      prompt: (context) => `Analyze multivariate visualization needs.
        Consider:
        - Number of variables: ${Object.keys(context.attributePatterns?.distributions || {}).length}
        - Variable relationships: ${context.attributePatterns?.correlations.map(c => `${c.field1}-${c.field2}: ${c.strength}`).join(', ') || 'none'}
        Best for: Complex relationships between multiple variables
        Avoid if: Simple relationships or too many variables (>5)`,
      context: {}
    },
    {
      type: 'proportional-symbol',
      prompt: (context) => `Analyze proportional symbol visualization needs.
        Consider:
        - Value range: ${Object.entries(context.attributePatterns?.distributions || {}).map(([field, dist]) => `${field}: ${dist.type}`).join(', ') || 'none'}
        - Spatial distribution: ${context.spatialPatterns?.distribution || 'unknown'}
        Best for: Showing quantities at specific locations, magnitude differences
        Avoid if: Data represents areas or continuous surfaces`,
      context: {}
    },
    {
      type: 'choropleth',
      prompt: (context) => `Analyze choropleth visualization needs.
        Consider:
        - Data normalization: ${Object.entries(context.attributePatterns?.distributions || {}).map(([field, dist]) => `${field}: ${dist.type}`).join(', ') || 'none'}
        - Area unit consistency: ${context.spatialPatterns?.distribution || 'unknown'}
        Best for: Showing normalized data across areas, rates, densities
        Avoid if: Data is not normalized or areas vary greatly in size`,
      context: {}
    },
    {
      type: 'hexbin',
      prompt: (context) => `Analyze hexbin visualization needs.
        Consider:
        - Point density: ${context.spatialPatterns?.density || 'unknown'}
        - Clustering patterns: ${context.spatialPatterns?.clustering || 'unknown'}
        Best for: Aggregating point data into regular hexagonal bins
        Avoid if: Exact point locations are important or data is already aggregated`,
      context: {}
    },
    {
      type: 'spider',
      prompt: (context) => `Analyze spider/flow visualization needs.
        Consider:
        - Connection density: ${context.relationships?.spatial.length || 0}
        - Node distribution: ${context.spatialPatterns?.distribution || 'unknown'}
        Best for: Showing connections between locations, networks, flows
        Avoid if: No meaningful connections between features`,
      context: {}
    },
    {
      type: 'time-series',
      prompt: (context) => `Analyze time-series visualization needs.
        Consider:
        - Temporal patterns: ${context.temporalPatterns?.frequency || 'unknown'}
        - Value changes: ${context.temporalPatterns?.trend || 'unknown'}
        Best for: Showing change over time, temporal patterns
        Avoid if: No temporal component or single time point`,
      context: {}
    },
    {
      type: 'density',
      prompt: (context) => `Analyze density visualization needs.
        Consider:
        - Point concentration: ${context.spatialPatterns?.density || 'unknown'}
        - Distribution type: ${context.spatialPatterns?.distribution || 'unknown'}
        Best for: Showing continuous density surfaces from point data
        Avoid if: Discrete locations are important or data is already continuous`,
      context: {}
    },
    {
      type: 'cluster',
      prompt: (context) => `Analyze cluster visualization needs.
        Consider:
        - Clustering strength: ${context.spatialPatterns?.clustering || 'unknown'}
        - Group patterns: ${context.attributePatterns?.distributions || 'unknown'}
        Best for: Identifying and showing groups of similar features
        Avoid if: Continuous surfaces or individual points are more important`,
      context: {}
    },
    {
      type: 'proximity',
      prompt: (context) => `Analyze proximity visualization needs.
        Consider:
        - Distance relationships: ${context.relationships?.spatial.map(r => r.type).join(', ') || 'none'}
        - Feature distribution: ${context.spatialPatterns?.distribution || 'unknown'}
        Best for: Showing distance-based relationships, service areas
        Avoid if: Distance is not a key factor`,
      context: {}
    },
    {
      type: 'buffer',
      prompt: (context) => `Analyze buffer visualization needs.
        Consider:
        - Feature type: ${context.featureType || 'unknown'}
        - Spatial distribution: ${context.spatialPatterns?.distribution || 'unknown'}
        Best for: Showing areas of influence, impact zones
        Avoid if: Exact boundaries or distances are not relevant`,
      context: {}
    },
    {
      type: 'network',
      prompt: (context) => `Analyze network visualization needs.
        Consider:
        - Connection patterns: ${context.relationships?.spatial.map(r => r.type).join(', ') || 'none'}
        - Node distribution: ${context.spatialPatterns?.distribution || 'unknown'}
        Best for: Showing connected systems, transportation networks
        Avoid if: No network structure exists in data`,
      context: {}
    },
    {
      type: 'composite',
      prompt: (context) => `Analyze composite visualization needs.
        Consider:
        - Layer relationships: ${context.relationships?.spatial.map(r => r.type).join(', ') || 'none'}
        - Data complexity: ${Object.keys(context.attributePatterns?.distributions || {}).length} variables
        Best for: Combining multiple visualization types for complex data
        Avoid if: Single visualization type is sufficient`,
      context: {}
    }
  ];

  private layers: Layer[] = [];

  /**
   * Sets the map view for the visualization factory
   * @param mapView The map view to be used for visualizations
   */
  public setMapView(mapView: MapView): void {
    this.mapView = mapView;
    console.log('[DynamicVisualizationFactory] Map view has been set');
  }

  private async analyzeLayerCharacteristics(layers: LayerResult[]): Promise<DynamicAnalysis['layerCharacteristics']> {
    const spatialPatterns = await this.analyzeSpatialPatterns(layers[0].features);
    const attributePatterns = await this.analyzeAttributePatterns(layers[0].features, this.findPrimaryField(layers[0]));
    
    return {
      spatialPatterns,
      attributePatterns: {
        correlations: attributePatterns.correlations.map(c => ({
          field1: c.field1,
          field2: c.field2,
          strength: c.strength,
          method: 'pearson' as const,
          significance: 0.95,
          spatialStats: c.spatialStats
        })),
        distributions: { [this.findPrimaryField(layers[0])]: attributePatterns.distribution }
      }
    };
  }

  private async analyzeSpatialPatterns(features: any[]) {
    console.log('Analyzing spatial patterns');
    // Calculate spatial statistics
    const points = features.map(f => {
      const centroid = this.getFeatureCentroid(f);
      return centroid || null;
    }).filter((point): point is [number, number] => point !== null);

    if (!points.length) return { clustering: 0, distribution: 'unknown', density: 0 };

    // Calculate clustering using nearest neighbor analysis
    const clustering = await this.calculateClustering(points);
    
    // Calculate density
    const density = points.length / this.calculateArea(points);

    console.log('Spatial analysis results:', {
      clustering,
      distribution: this.determineDistribution(points),
      density
    });

    return {
      clustering,
      distribution: this.determineDistribution(points),
      density
    };
  }

  private async analyzeAttributePatterns(features: any[], rendererField: string) {
    console.log('Analyzing attribute patterns');
    const values = features
      .map(f => f.properties?.[rendererField] || f.attributes?.[rendererField])
      .filter((v): v is number => typeof v === 'number' && !isNaN(v));

    if (!values.length) return { correlations: [], distribution: { type: 'unknown', parameters: {} } };

    // Calculate distribution type
    const distribution = this.determineValueDistribution(values);

    // Find correlations with other numeric fields
    const correlations = await this.findCorrelations(features, rendererField);

    console.log('Attribute analysis results:', {
      correlations,
      distribution
    });

    return {
      correlations: correlations.map(c => ({
        field1: c.field1,
        field2: c.field2,
        strength: c.strength,
        method: 'pearson' as const,
        significance: 0.95,
        spatialStats: c.spatialStats
      })),
      distribution
    };
  }

  private async findCorrelations(features: any[], field: string): Promise<Array<{
    field1: string;
    field2: string;
    strength: number;
    method: 'pearson' | 'spearman' | 'kendall';
    significance: number;
    spatialStats?: {
      moransI: number;
      getisOrdG: number;
      hotSpots: number;
      coldSpots: number;
      outliers: number;
    };
  }>> {
    const correlations: Array<{
      field1: string;
      field2: string;
      strength: number;
      method: 'pearson' | 'spearman' | 'kendall';
      significance: number;
      spatialStats?: {
        moransI: number;
        getisOrdG: number;
        hotSpots: number;
        coldSpots: number;
        outliers: number;
      };
    }> = [];

    // Get all numeric fields
    const numericFields = Object.keys(features[0].attributes || features[0].properties || {})
      .filter(key => {
        const value = features[0].attributes?.[key] || features[0].properties?.[key];
        return typeof value === 'number' && !isNaN(value);
      });

    // Create a temporary feature layer for correlation analysis
    const tempLayer = new FeatureLayer({
      source: features.map(f => new Graphic({
        attributes: f.attributes || f.properties,
        geometry: f.geometry
      }))
    });

    // Calculate correlations with other fields
    for (const otherField of numericFields) {
      if (otherField !== field) {
        try {
          const result = await CorrelationService.calculateCorrelation(
            tempLayer,
            field,
            otherField
          );

          correlations.push({
            field1: field,
            field2: otherField,
            strength: result.pearson,
            method: 'pearson',
            significance: 0.05,
            spatialStats: {
              hotSpots: result.spatialStats?.hotSpots || 0,
              coldSpots: result.spatialStats?.coldSpots || 0,
              outliers: result.spatialStats?.outliers || 0,
              moransI: 0,
              getisOrdG: 0
            }
          });
        } catch (error) {
          console.error(`Error calculating correlation between ${field} and ${otherField}:`, error);
        }
      }
    }

    return correlations;
  }

  private async calculateClustering(points: [number, number][]): Promise<number> {
    if (points.length < 2) return 0;

    // Calculate average distance between points
    let totalDistance = 0;
    let count = 0;

    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const dx = points[i][0] - points[j][0];
        const dy = points[i][1] - points[j][1];
        totalDistance += Math.sqrt(dx * dx + dy * dy);
        count++;
      }
    }

    const avgDistance = totalDistance / count;

    // Calculate expected random distance
    const area = this.calculateArea(points);
    const expectedRandomDistance = Math.sqrt(area / (Math.PI * points.length));

    // Calculate clustering index (0 = random, 1 = clustered)
    // Lower average distance compared to random indicates clustering
    const clusteringIndex = Math.max(0, Math.min(1, 1 - (avgDistance / expectedRandomDistance)));

    return clusteringIndex;
  }

  private calculateArea(points: [number, number][]): number {
    // Calculate the area covered by points
    const bounds = points.reduce((acc: Bounds, point: [number, number]) => ({
      minX: Math.min(acc.minX, point[0]),
      maxX: Math.max(acc.maxX, point[0]),
      minY: Math.min(acc.minY, point[1]),
      maxY: Math.max(acc.maxY, point[1])
    }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });

    return (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY);
  }

  private determineDistribution(points: [number, number][]): string {
    if (points.length < 3) return 'unknown';

    // Calculate quadrat analysis
    const bounds = points.reduce((acc: Bounds, point: [number, number]) => ({
      minX: Math.min(acc.minX, point[0]),
      maxX: Math.max(acc.maxX, point[0]),
      minY: Math.min(acc.minY, point[1]),
      maxY: Math.max(acc.maxY, point[1])
    }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });

    // Divide area into 4 quadrants
    const midX = (bounds.minX + bounds.maxX) / 2;
    const midY = (bounds.minY + bounds.maxY) / 2;

    const quadrants = [0, 0, 0, 0];
    points.forEach(point => {
      if (point[0] < midX && point[1] < midY) quadrants[0]++;
      else if (point[0] >= midX && point[1] < midY) quadrants[1]++;
      else if (point[0] < midX && point[1] >= midY) quadrants[2]++;
      else quadrants[3]++;
    });

    // Calculate chi-square statistic for uniform distribution
    const expected = points.length / 4;
    const chiSquare = quadrants.reduce((sum, count) => 
      sum + Math.pow(count - expected, 2) / expected, 0);

    // Determine distribution type based on chi-square value
    if (chiSquare < 3) return 'uniform';
    if (chiSquare < 7) return 'random';
    return 'clustered';
  }

  private determineValueDistribution(values: number[]): { type: string; parameters: any } {
    if (values.length < 10) return { type: 'unknown', parameters: {} };

    // Calculate basic statistics
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const skewness = values.reduce((a, b) => a + Math.pow((b - mean) / stdDev, 3), 0) / values.length;
    const kurtosis = values.reduce((a, b) => a + Math.pow((b - mean) / stdDev, 4), 0) / values.length - 3;

    // Determine distribution type based on statistical properties
    if (Math.abs(skewness) < 0.5 && Math.abs(kurtosis) < 1) {
      return {
        type: 'normal',
        parameters: { mean, stdDev }
      };
    } else if (skewness > 0) {
      return {
        type: 'right-skewed',
        parameters: { mean, stdDev, skewness }
      };
    } else {
      return {
        type: 'left-skewed',
        parameters: { mean, stdDev, skewness }
      };
    }
  }

  private async discoverRelationships(layers: LayerResult[], characteristics: DynamicAnalysis['layerCharacteristics']): Promise<DynamicAnalysis['relationships']> {
    const relationships = {
      spatial: [] as Array<{
        layer1: string;
        layer2: string;
        type: string;
        strength: number;
      }>,
      statistical: [] as Array<{
        layer1: string;
        layer2: string;
        correlation: number;
        significance: number;
        method: 'pearson' | 'spearman' | 'kendall';
        spatialStats?: {
          moransI: number;
          getisOrdG: number;
          hotSpots: number;
          coldSpots: number;
          outliers: number;
        };
      }>
    };

    // Analyze relationships between layers
    for (let i = 0; i < layers.length; i++) {
      for (let j = i + 1; j < layers.length; j++) {
        const layer1 = layers[i];
        const layer2 = layers[j];

        // Analyze spatial relationships
        const spatialRelationship = await this.analyzeSpatialRelationship(layer1, layer2);
        if (spatialRelationship) {
          relationships.spatial.push(spatialRelationship);
        }

        // Analyze statistical relationships
        const statisticalRelationship = await this.analyzeStatisticalRelationship(layer1, layer2);
        if (statisticalRelationship) {
          relationships.statistical.push(statisticalRelationship);
        }
      }
    }

    return relationships;
  }

  private async analyzeSpatialRelationship(layer1: LayerResult, layer2: LayerResult): Promise<SpatialRelationship> {
    // Calculate centroids for both layers
    const centroids1 = layer1.features
      .map(f => this.getFeatureCentroid(f))
      .filter((point): point is [number, number] => point !== null);
    
    const centroids2 = layer2.features
      .map(f => this.getFeatureCentroid(f))
      .filter((point): point is [number, number] => point !== null);

    if (!centroids1.length || !centroids2.length) {
      return {
        layer1: layer1.layer.id,
        layer2: layer2.layer.id,
        type: 'unknown',
        strength: 0
      };
    }

    // Calculate average distance between features
    let totalDistance = 0;
    let count = 0;

    for (const c1 of centroids1) {
      for (const c2 of centroids2) {
        const dx = c1[0] - c2[0];
        const dy = c1[1] - c2[1];
        totalDistance += Math.sqrt(dx * dx + dy * dy);
        count++;
      }
    }

    const avgDistance = count > 0 ? totalDistance / count : 0;

    // Calculate expected random distance
    const bounds1 = this.getLayerBounds(centroids1);
    const bounds2 = this.getLayerBounds(centroids2);
    const area1 = (bounds1.maxX - bounds1.minX) * (bounds1.maxY - bounds1.minY);
    const area2 = (bounds2.maxX - bounds2.minX) * (bounds2.maxY - bounds2.minY);
    const expectedDistance = Math.sqrt((area1 + area2) / (Math.PI * centroids1.length * centroids2.length));

    // Calculate relationship strength (0 = random, 1 = strongly related)
    const strength = Math.max(0, Math.min(1, 1 - (avgDistance / expectedDistance)));

    return {
      layer1: layer1.layer.id,
      layer2: layer2.layer.id,
      type: strength > 0.7 ? 'strong' : strength > 0.4 ? 'moderate' : 'weak',
      strength
    };
  }

  private async analyzeStatisticalRelationship(layer1: LayerResult, layer2: LayerResult): Promise<StatisticalRelationship> {
    if (!layer1.layer.rendererField || !layer2.layer.rendererField) {
      return { 
        layer1: layer1.layer.id, 
        layer2: layer2.layer.id, 
        correlation: 0, 
        significance: 0,
        method: 'pearson'
      };
    }

    try {
      const result = await CorrelationService.calculateCorrelation(
        layer1.layer as unknown as ArcGISFeatureLayer,
        layer1.layer.rendererField,
        layer2.layer.rendererField
      );

      return {
        layer1: layer1.layer.id,
        layer2: layer2.layer.id,
        correlation: result.pearson,
        significance: 0.05,
        method: 'pearson',
        spatialStats: {
          hotSpots: result.spatialStats?.hotSpots || 0,
          coldSpots: result.spatialStats?.coldSpots || 0,
          outliers: result.spatialStats?.outliers || 0,
          moransI: 0,
          getisOrdG: 0
        }
      };
    } catch (error) {
      console.error('Error analyzing statistical relationship:', error);
      return { 
        layer1: layer1.layer.id, 
        layer2: layer2.layer.id, 
        correlation: 0, 
        significance: 0,
        method: 'pearson'
      };
    }
  }

  private getFeatureCentroid(feature: { geometry: ArcGISGeometry }): [number, number] | null {
    const geom = feature.geometry;
    try {
      if (geom instanceof Point) {
      return [geom.x, geom.y];
      } else if (geom instanceof Polygon) {
        const centroid = geom.centroid;
        return centroid ? [centroid.x, centroid.y] : null;
      } else if (geom instanceof Polyline) {
        const extent = geom.extent;
        return extent?.center ? [extent.center.x, extent.center.y] : null;
      } else if (geom instanceof Multipoint) {
        const extent = geom.extent;
        return extent?.center ? [extent.center.x, extent.center.y] : null;
      } else if (geom instanceof Extent) {
        return [geom.xmin, geom.ymin];
      }
    } catch (error) {
      console.error('Error calculating centroid:', error);
    }
    return null;
  }

  private getLayerBounds(points: [number, number][]): Bounds {
    return points.reduce((acc, point) => ({
      minX: Math.min(acc.minX, point[0]),
      maxX: Math.max(acc.maxX, point[0]),
      minY: Math.min(acc.minY, point[1]),
      maxY: Math.max(acc.maxY, point[1])
    }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
  }

  private calculateSignificance(correlation: number, n: number): number {
    // Calculate t-statistic
    const t = correlation * Math.sqrt((n - 2) / (1 - correlation * correlation));
    // Calculate p-value (two-tailed)
    return 2 * (1 - this.studentT(Math.abs(t), n - 2));
  }

  private studentT(t: number, df: number): number {
    // Approximation of Student's t-distribution CDF
    const x = df / (df + t * t);
    let result = 1;
    for (let i = 0; i < df; i++) {
      result *= x;
    }
    return 1 - result / 2;
  }

  private async generateAIVisualizationSuggestion(
    analysis: DynamicAnalysis,
    layerType: string
  ): Promise<{
    type: string;
    confidence: number;
    reasoning: string;
    parameters: {
      spatial: any;
      visual: any;
      analytical: any;
    };
  }> {
    // Find the appropriate prompt for the layer type
    const prompt = this.visualizationPrompts.find(p => p.type === layerType);
    if (!prompt) {
      throw new Error(`No AI prompt found for layer type: ${layerType}`);
    }

    // Update the prompt context with current analysis
    const context = {
      spatialPatterns: analysis.layerCharacteristics.spatialPatterns,
      attributePatterns: {
        correlations: analysis.layerCharacteristics.attributePatterns.correlations.map(c => ({
          ...c,
          method: 'pearson' as const,
          significance: 0.05
        })),
        distributions: analysis.layerCharacteristics.attributePatterns.distributions
      },
      relationships: analysis.relationships
    };

    // Generate the prompt with the current context
    const promptText = typeof prompt.prompt === 'function' ? prompt.prompt(context) : prompt.prompt;

    // Here you would integrate with your AI service to analyze the prompt and context
    // For now, we'll return a basic suggestion based on the analysis
    return {
      type: layerType,
      confidence: 0.7,
      reasoning: `AI analysis suggests ${layerType} visualization based on data patterns`,
      parameters: {
        spatial: {
          clustering: analysis.layerCharacteristics.spatialPatterns.clustering,
          distribution: analysis.layerCharacteristics.spatialPatterns.distribution,
          density: analysis.layerCharacteristics.spatialPatterns.density
        },
        visual: {
          opacity: 0.8,
          colorScheme: 'default'
        },
        analytical: {
          threshold: 'default'
        }
      }
    };
  }

  private async generateVisualizationSuggestions(
    analysis: DynamicAnalysis,
    layers: LayerResult[]
  ): Promise<DynamicAnalysis['visualizationSuggestions']> {
    const suggestions = [];

    // Generate suggestions for each visualization type
    for (const layerType of ['point-layer', 'single-layer', 'correlation', 'hotspot', 'bivariate', 'multivariate', 'proportional-symbol', 'choropleth', 'hexbin', 'spider', 'time-series', 'density', 'cluster', 'proximity', 'buffer', 'network', 'composite', 'trends']) {
      try {
        const suggestion = await this.generateAIVisualizationSuggestion(analysis, layerType);
        suggestions.push(suggestion);
      } catch (error) {
        console.error(`Error generating ${layerType} visualization suggestion:`, error);
      }
    }

    return suggestions;
  }

  private convertExtentToBounds(extent: Extent): Bounds {
    return {
      minX: extent.xmin,
      maxX: extent.xmax,
      minY: extent.ymin,
      maxY: extent.ymax
    };
  }

  private async analyzeHotspots(features: any[], field: string): Promise<{ threshold: number; clusters: any[] }> {
    // Calculate intensity values
    const values = features.map(f => f.properties?.[field] || f.attributes?.[field])
      .filter((v): v is number => typeof v === 'number' && !isNaN(v));

    if (!values.length) {
      return { threshold: 0, clusters: [] };
    }

    // Calculate statistics
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length
    );

    // Set threshold at mean + 1 standard deviation
    const threshold = mean + stdDev;

    // Identify clusters
    const clusters = features.filter(f => {
      const value = f.properties?.[field] || f.attributes?.[field];
      return typeof value === 'number' && value > threshold;
    });

    return { threshold, clusters };
  }

  private async analyzeBivariate(features: any[], field1: string, field2: string): Promise<{
    correlation: number;
    categories: string[];
  }> {
    const pairs = features.map(f => ({
      val1: f.properties?.[field1] || f.attributes?.[field1],
      val2: f.properties?.[field2] || f.attributes?.[field2]
    })).filter(p => 
      typeof p.val1 === 'number' && !isNaN(p.val1) &&
      typeof p.val2 === 'number' && !isNaN(p.val2)
    );

    if (!pairs.length) {
      return { correlation: 0, categories: [] };
    }

    // Calculate correlation
    const correlation = this.calculatePearsonCorrelation(
      pairs.map(p => p.val1),
      pairs.map(p => p.val2)
    );

    // Create categories based on quartiles
    const categories = ['Low-Low', 'Low-High', 'High-Low', 'High-High'];

    return { correlation, categories };
  }

  private analyzeBivariateBreaks(features: ArcGISGraphic[], field1: string, field2: string): {
    field1Breaks: number[];
    field2Breaks: number[];
    field1Label: string;
    field2Label: string;
  } {
    const field1Values = features.map(f => f.attributes[field1]).filter(v => v !== null);
    const field2Values = features.map(f => f.attributes[field2]).filter(v => v !== null);

    const field1Breaks = this.calculateQuartileBreaks(field1Values);
    const field2Breaks = this.calculateQuartileBreaks(field2Values);

    // Get field metadata
    const field1Meta = this.getFieldMetadata(field1) as LayerField;
    const field2Meta = this.getFieldMetadata(field2) as LayerField;

    return {
      field1Breaks,
      field2Breaks,
      field1Label: field1Meta?.label || field1,
      field2Label: field2Meta?.label || field2
    };
  }

  private getFieldMetadata(fieldName: string): LayerField | undefined {
    if (!fieldName) {
      console.warn('No field name provided for metadata lookup');
      return undefined;
    }

    const [layerId, field] = fieldName.split('.');
    const layer = this.getLayerById(layerId);
    
    if (!layer?.fields) {
      console.warn(`No fields found for layer ${layerId}`);
      return undefined;
    }

    const metadata = layer.fields.find(f => f.name === field);
    
    console.log('Field metadata lookup:', {
      layerId,
      fieldName: field,
      found: !!metadata,
      metadata
    });

    return metadata;
  }

  private calculateQuartileBreaks(values: number[]): number[] {
    const sorted = [...values].sort((a, b) => a - b);
    const q1Index = Math.floor(sorted.length * 0.33);
    const q2Index = Math.floor(sorted.length * 0.67);
    return [sorted[q1Index], sorted[q2Index]];
  }

  private getLayerById(layerId: string): Layer | undefined {
    return this.layers.find((l: Layer) => l.layer.id === layerId);
  }

  private analyzeMultivariateFields(features: ArcGISGraphic[]): LayerField[] {
    if (!features.length) {
      console.warn('No features provided for multivariate analysis');
      return [];
    }

    console.log('=== Analyzing Multivariate Fields ===', {
      featureCount: features.length,
      sampleFeature: features[0],
      availableFields: Object.keys(features[0]?.attributes || {})
    });

    // Get all numeric fields from the first feature
    const numericFields = Object.entries(features[0]?.attributes || {})
      .filter(([_, value]) => typeof value === 'number' && !isNaN(value))
      .map(([fieldName]) => ({
        name: fieldName,
        type: 'double' as const,
        label: fieldName
      }));

    // Check for sufficient variation in each field
    return numericFields
      .filter(field => {
        const values = features
          .map(f => f.attributes[field.name])
          .filter(v => v !== null && !isNaN(v));
        
        const uniqueValues = new Set(values);
        const hasVariation = uniqueValues.size > 5;

        console.log(`Field variation check: ${field.name}`, {
          uniqueValues: uniqueValues.size,
          hasVariation
        });

        return hasVariation;
      })
      .slice(0, 5); // Limit to 5 fields for visualization clarity
  }

  private analyzeMultivariateBreaks(features: ArcGISGraphic[], fields: LayerField[]): number[][] {
    return fields.map(field => {
      const values = features.map((f: __esri.Graphic) => f.attributes[field.name]).filter(v => v !== null);
      return this.calculateQuartileBreaks(values);
    });
  }

  private findValueField(feature: any, layerConfig: LayerConfig): string {
    console.log('=== Finding Value Field ===', {
      layerId: layerConfig.id,
      layerName: layerConfig.name,
      rendererField: layerConfig.rendererField,
      availableFields: Object.keys(feature.attributes || {})
    });

    // First try the renderer field from layer config
    if (layerConfig.rendererField) {
      if (feature.attributes?.[layerConfig.rendererField] !== undefined) {
      console.log('Using configured renderer field:', layerConfig.rendererField);
      return layerConfig.rendererField;
      } else {
        throw new Error(`Configured renderer field '${layerConfig.rendererField}' not found in feature attributes. Available fields: ${Object.keys(feature.attributes || {}).join(', ')}`);
      }
    }

    // Check for thematic_value
    if (feature.attributes?.thematic_value !== undefined) {
      console.log('Using thematic_value for rendering');
      return 'thematic_value';
      }

    throw new Error(`No renderer field configured and thematic_value not found in feature attributes. Please configure a renderer field in the layer configuration. Available fields: ${Object.keys(feature.attributes || {}).join(', ')}`);
  }

  private extractFilterConditions(query: string): FilterCondition[] {
    const conditions: FilterCondition[] = [];
    const fieldPattern = /(\w+)\s*(>|<|>=|<=|==|!=)\s*(\d+)/g;
    let match;

    while ((match = fieldPattern.exec(query)) !== null) {
      conditions.push({
        field: match[1],
        operator: match[2] as '>' | '<' | '>=' | '<=' | '==' | '!=',
        value: parseInt(match[3], 10)
      });
    }

    return conditions;
  }

  private findPrimaryField(layer: LayerResult): string {
    console.log('[DEBUG Field Detection] Finding primary field for layer:', {
        layerId: layer.layer.id,
        layerName: layer.layer.name,
        rendererField: layer.layer.rendererField
    });

    // First try to use the renderer field from layer config
    if (layer.layer.rendererField && !['FEDNAME', 'PARTY_1', 'NAME_1', 'VOTES_1'].includes(layer.layer.rendererField)) {
        console.log('[DEBUG Field Detection] Using configured renderer field:', layer.layer.rendererField);
        return layer.layer.rendererField;
    }

    // Get layer configuration from the layers config
    const layerConfigs = configLayers;
    const layerConfig = layerConfigs[layer.layer.id] as LayerConfig;
    
    if (!layerConfig || !layerConfig.fields) {
      throw new Error(`No layer configuration or fields found for layer: ${layer.layer.id}. Please ensure the layer is properly configured with field definitions.`);
    }

        // Look for numeric fields in layer configuration, excluding electoral fields
        const configuredFields = layerConfig.fields.filter(field => 
            ['double', 'integer', 'single', 'small-integer'].includes(field.type) &&
            !['FEDNAME', 'PARTY_1', 'NAME_1', 'VOTES_1'].includes(field.name)
        );

        if (configuredFields.length > 0) {
            console.log('[DEBUG Field Detection] Using first configured numeric field:', configuredFields[0].name);
            return configuredFields[0].name;
        }

    // If no suitable fields found in configuration, provide detailed error
    const availableFields = layerConfig.fields.map(f => `${f.name} (${f.type})`).join(', ');
    throw new Error(`No suitable numeric fields found in layer configuration for layer: ${layer.layer.id}. Available fields: ${availableFields}`);
  }
  
  /**
   * Finds the first available numeric field in attributes, excluding a specified field.
   */
  private findSecondNumericField(feature: any, primaryField: string): string {
    if (!feature?.attributes) {
      throw new Error('Cannot find second numeric field: Feature has no attributes.');
    }
    
    const numericFields = Object.entries(feature.attributes)
      .filter(([key, value]) => 
        key !== primaryField && // Exclude the primary field
        typeof value === 'number' && 
        !isNaN(value) && 
        isFinite(value)
      )
      .map(([key]) => key);
      
    if (numericFields.length > 0) {
      console.log(`[DynamicVisualizationFactory] Found second numeric field: ${numericFields[0]}`);
      return numericFields[0];
    }

    const availableFields = Object.entries(feature.attributes)
      .map(([key, value]) => `${key} (${typeof value})`)
      .join(', ');
    
    throw new Error(`No suitable second numeric field found for comparison. Primary field was '${primaryField}'. Available fields: ${availableFields}`);
  }

  /**
   * Creates a standard correlation visualization, handling single-layer and join cases.
   */
  public async createStandardCorrelationVisualization(
    layerResults: ProcessedLayerResult[],
    options: CorrelationOptions
  ): Promise<VisualizationResult> {
    console.log('[Factory] createStandardCorrelationVisualization called', {
        layerResultCount: layerResults.length,
      options
    });

    // Basic validation
    if (!layerResults || layerResults.length === 0) {
        throw new Error('[Data Error] No layer results provided for standard correlation.');
    }

    // Combine features if multiple layers are involved (assuming same geography)
    let allFeatures: LocalGeospatialFeature[] = [];
    let primaryLayerConfig: LayerConfig | null = null;
    let extent: Extent | null = null;
    
    // Before combining features, tag each feature with its layerId
    allFeatures = [];
    for (const result of layerResults) {
        const layerId = result.layerId;
        if (!result.layer) {
            console.warn(`[Factory] Skipping layer result due to missing layer config:`, result);
            continue;
        }
        if (!result.features || result.features.length === 0) {
            console.warn(`[Factory] Skipping layer result ${layerId} due to no features.`);
            continue;
        }
        // Annotate features with layerId for later splitting
        for (const feature of result.features) {
            feature.properties = feature.properties || {};
            feature.properties._layerId = layerId;
        }
        allFeatures = allFeatures.concat(result.features);
        if (!primaryLayerConfig) {
            primaryLayerConfig = result.layer;
        }
        if (!extent && result.extent && validateExtent(result.extent)) {
            extent = result.extent;
        } else if (result.extent && validateExtent(result.extent) && extent) {
            extent = extent.union(result.extent);
        }
    }

    if (allFeatures.length === 0) {
         throw new Error('[Data Error] No valid features found across provided layer results.');
    }
    if (!primaryLayerConfig) {
        throw new Error('[Data Error] Could not determine primary layer configuration.');
    }

    // --- ADD LOGGING: Inspect features passed to CorrelationVisualization --- 
    const primaryField = options?.primaryField || 'unknown_primary';
    const comparisonField = options?.comparisonField || 'unknown_comparison';
    console.log(`[Factory DEBUG CONCISE] Inspecting first 3 features passed to CorrelationVisualization (Need ${primaryField}, ${comparisonField})`);
    for (let i = 0; i < Math.min(3, allFeatures.length); i++) {
        const props = allFeatures[i].properties; 
        // console.log(`  [Feature ${i} Properties]:`, JSON.stringify(props)); // REMOVED FULL STRINGIFY
        const primaryVal = props ? props[primaryField] : undefined;
        const comparisonVal = props ? props[comparisonField] : undefined;
        const ecyacterVal = props?.ECYACTER;
        const visvmPVal = props?.ECYVISVM_P;
        console.log(`  [Feature ${i}]: ` +
            `${primaryField}(${(props ? Object.prototype.hasOwnProperty.call(props, primaryField) : undefined)}, ${typeof primaryVal === 'number' || typeof primaryVal === 'string' ? primaryVal : typeof primaryVal}), ` +
            `${comparisonField}(${(props ? Object.prototype.hasOwnProperty.call(props, comparisonField) : undefined)}, ${typeof comparisonVal === 'number' || typeof comparisonVal === 'string' ? comparisonVal : typeof comparisonVal}), ` +
            `ECYACTER(${(props ? Object.prototype.hasOwnProperty.call(props, 'ECYACTER') : undefined)}, ${typeof ecyacterVal === 'number' || typeof ecyacterVal === 'string' ? ecyacterVal : typeof ecyacterVal}), ` +
            `ECYVISVM_P(${(props ? Object.prototype.hasOwnProperty.call(props, 'ECYVISVM_P') : undefined)}, ${typeof visvmPVal === 'number' || typeof visvmPVal === 'string' ? visvmPVal : typeof visvmPVal})`
        );
        // console.log(`    - Has ${primaryField}: ${(props ? Object.prototype.hasOwnProperty.call(props, primaryField) : undefined)}, Value: ${props ? props[primaryField] : 'N/A'}`);
        // console.log(`    - Has ${comparisonField}: ${(props ? Object.prototype.hasOwnProperty.call(props, comparisonField) : undefined)}, Value: ${props ? props[comparisonField] : 'N/A'}`);
        // Specifically check the fields from the error context again
        // console.log(`    - Has ECYACTER: ${(props ? Object.prototype.hasOwnProperty.call(props, 'ECYACTER') : undefined)}, Value: ${props?.ECYACTER}`);
        // console.log(`    - Has ECYVISVM_P: ${(props ? Object.prototype.hasOwnProperty.call(props, 'ECYVISVM_P') : undefined)}, Value: ${props?.ECYVISVM_P}`);
    }
    // --- END LOGGING ---

    // --- CONVERT LocalGeospatialFeature to Graphic --- 
    const graphicsForViz: ArcGISGraphic[] = allFeatures.map((feature, index) => {
        let geometry: __esri.Geometry | null = null;
        let attributes: { [key: string]: any } = {}; 

        try {
            // --- Use _originalEsriGeometry from properties --- 
            const originalGeometry = feature.properties?._originalEsriGeometry;
            if (!originalGeometry) {
                console.warn(`[Factory DEBUG] Skipping feature ${index}: Missing _originalEsriGeometry in properties.`);
                return null;
            }
            geometry = createGeometry(originalGeometry);
            
            if (!geometry) {
                console.warn(`[Factory DEBUG] Skipping feature ${index}: Geometry creation failed.`);
                return null;
            }

            // --- MODIFICATION START: Copy properties with prefixed field names --- 
            const props = feature.properties || {};
            const layerId = feature.properties?._layerId || 'unknown';
            
            // Create prefixed field names for thematic_value
            const prefixedThematicValue = `${layerId}_thematic_value`;
            
            attributes = { 
                ...props, // Copy all original properties
                OBJECTID: props['OBJECTID'] ?? (index + 1), // Ensure OBJECTID exists
                [prefixedThematicValue]: props['thematic_value'] // Add prefixed field
            }; 
            // --- END MODIFICATION --- 

            // Create Graphic with the modified attributes
            const newGraphic = new Graphic({
                geometry: geometry,
                attributes: attributes
            });

            return newGraphic;

        } catch (error) {
            console.error(`[Factory DEBUG] Error converting feature ${index} to Graphic:`, error);
            return null;
        }
    }).filter((g): g is ArcGISGraphic => g !== null);

    if (graphicsForViz.length === 0) {
        throw new Error('[Data Error] Failed to convert any features to Graphics for visualization.');
    }
    console.log(`[Factory DEBUG] Converted ${graphicsForViz.length} features to Graphics. Sample attributes:`, graphicsForViz[0]?.attributes);
    // --- END CONVERSION --- 

    // Instantiate the specific visualization class
    const correlationViz = new CorrelationVisualization();

    try {
        // Get the layer IDs for field prefixing
        const layer1Id = layerResults[0].layerId;
        const layer2Id = layerResults[1].layerId;
        
        // Transform graphics to match CorrelationData interface
        const transformedFeatures = graphicsForViz
            .filter(graphic => graphic.geometry != null) // Filter out features with no geometry
            .map((graphic, index) => {
                const primaryValue = graphic.attributes[`${layer1Id}_thematic_value`];
                const comparisonValue = graphic.attributes[`${layer2Id}_thematic_value`];
                
                // Get the geometry and ensure it's of a supported type
                const geometry = graphic.geometry!; // Safe to use ! because of filter above
                const geomType = geometry.type.toLowerCase() as ArcGISGeometryType;
                
                // Validate geometry type
                if (!['polygon', 'point', 'polyline', 'extent', 'multipoint'].includes(geomType)) {
                    console.warn(`[Factory] Invalid geometry type for feature ${index}:`, geometry.type);
                    return null;
                }
                
                // Cast the geometry to the appropriate type based on its type
                let typedGeometry: __esri.Geometry;
                switch (geomType) {
                    case 'polygon':
                        typedGeometry = geometry as __esri.Polygon;
                        break;
                    case 'point':
                        typedGeometry = geometry as __esri.Point;
                        break;
                    case 'polyline':
                        typedGeometry = geometry as Polyline;
                        break;
                    case 'extent':
                        typedGeometry = geometry as Extent;
                        break;
                    case 'multipoint':
                        typedGeometry = geometry as Multipoint;
                        break;
                    default:
                        console.warn(`[Factory] Unsupported geometry type: ${geomType}`);
                        return null;
                }
                
                return {
                    attributes: {
                        OBJECTID: index + 1,
                        primary_value: Number(primaryValue) || 0,
                        comparison_value: Number(comparisonValue) || 0,
                        correlation_strength: 0, // Will be calculated by the visualization
                        ...graphic.attributes // Include other attributes
                    },
                    geometry: typedGeometry
                };
            })
            .filter((feature): feature is NonNullable<typeof feature> => feature !== null);
        
        const { layer, extent: vizExtent } = await correlationViz.create({
          features: transformedFeatures as unknown as { 
            attributes: { [key: string]: any; OBJECTID: number; primary_value: number; comparison_value: number; correlation_strength: number; }; 
            geometry?: GeometryType 
          }[],
                layerConfig: primaryLayerConfig, 
                primaryLayerId: primaryLayerConfig.id,
          comparisonLayerId: layer2Id, // Add the missing comparisonLayerId
                primaryField: `${layer1Id}_thematic_value`,
                comparisonField: `${layer2Id}_thematic_value`,
                layerName: primaryLayerConfig.name || 'Standard Correlation',
                rendererField: `${layer1Id}_thematic_value` // Added rendererField
        });
        
        // Use the extent calculated by the visualization if valid, otherwise the combined input extent
        const finalExtent = (vizExtent && validateExtent(vizExtent)) ? vizExtent : extent;
        
        return { layer, extent: finalExtent };
    } catch (error) {
        console.error('[Factory] Error creating standard correlation visualization:', error);
        throw error; // Re-throw the error to be caught by handleVisualization/handleSubmit
    }
  }

  /**
   * Creates a visualization for the top N features based on a specified field.
   */
  public async createTopNVisualization(
    layers: LayerResult[],
    options: any // Using 'any' for options as primaryField might be passed dynamically
  ): Promise<{ layer: any; extent: any }> {
    console.log('Creating top N visualization');
    const topNViz = new TopNVisualization();

    // Extract N from query
    const nMatch = options.query?.match(/(?:top|highest|largest|greatest)\s+(\d+)/i);
    const n = nMatch ? parseInt(nMatch[1], 10) : 10; // Default to 10 if not found

    // Extract filter conditions from query - DISABLED FOR NOW
    // const filterConditions = this.extractFilterConditions(options.query || '');
    const filterConditions: FilterCondition[] = []; // No filtering - show all results

    // Get layer configuration 
    if (!layers || layers.length === 0 || !layers[0] || !layers[0].layer) {
        throw new Error("Invalid LayerResult provided for TopN visualization.");
    }
    
    // Get the layer ID from the first layer in the results
    const layerId = layers[0].layer.id;
    console.log(`[TopN Viz] Getting layer config for ID: ${layerId}`);
    
    // Use the imported configLayers directly
    const layerConfig = configLayers[layerId] as LayerConfig;
    
    if (!layerConfig) {
        console.error(`[TopN Viz] Layer configuration not found for ${layerId}. Available configs:`, 
            Object.keys(configLayers).slice(0,5));
        throw new Error(`Layer configuration not found for ${layerId}`);
    }
    
    const configuredFields = layerConfig.fields;
    const configuredFieldNames = new Set(configuredFields?.map(f => f.name) ?? []);

    // --- Determine Primary Field for Ranking ---
    let primaryField: string | null = null;
    const primaryFieldOption = options.primaryField; // Check if field provided in options

    // 1. Try field from options
    if (primaryFieldOption) {
        // Validate against configured fields if available
        if (configuredFieldNames.size > 0 && !configuredFieldNames.has(primaryFieldOption)) {
            console.error(`[Validation Error] Provided primary field "${primaryFieldOption}" not found in configured fields for layer ${layerConfig.id}.`);
            throw new Error(`Configuration Mismatch: The requested primary field "${primaryFieldOption}" is not defined for TopN visualization on layer "${layerConfig.name}".`);
        }
        // Field name is valid based on config (or config check skipped), type checked later
        primaryField = primaryFieldOption;
        console.log(`[TopN Viz] Using primary field from options: "${primaryField}"`);
    }

    // 2. Try configured rendererField (if no options field)
    if (!primaryField && layerConfig.rendererField) {
        // Validate against configured fields if available
        if (configuredFieldNames.size > 0 && !configuredFieldNames.has(layerConfig.rendererField)) {
             console.warn(`[TopN Viz] Configured rendererField "${layerConfig.rendererField}" not found in configured fields list for layer ${layerConfig.id}. Skipping rendererField.`);
        } else {
           // Field name is valid based on config (or config check skipped), type checked later
           primaryField = layerConfig.rendererField;
           console.log(`[TopN Viz] Using configured rendererField: "${primaryField}"`);
        }
    }

    // 3. Try first configured numeric field (if still no field determined)
    if (!primaryField && configuredFields && configuredFields.length > 0) {
        const firstNumericConfigured = configuredFields.find(field =>
            // Check if the field type indicates it's numeric
            ['double', 'integer', 'single', 'small-integer', 'oid'].includes(field.type) // Include 'oid' as potentially numeric
        );
        if (firstNumericConfigured) {
             primaryField = firstNumericConfigured.name;
             console.log(`[TopN Viz] Using first configured numeric field: "${primaryField}"`);
        }
    }

    // 4. Fallback: Try first numeric field from actual feature data (if still no field)
    if (!primaryField) {
        // Check the first feature for any numeric attribute/property
        const sampleFeature = layers[0]?.features?.[0];
        if (sampleFeature) {
            // Combine attributes and properties, giving preference to properties
            const attrsToCheck = { ...(sampleFeature.attributes || {}), ...(sampleFeature.properties || {}) };
            const firstNumericInData = Object.entries(attrsToCheck)
                .find(([key, value]) => typeof value === 'number' && isFinite(value)); // Check for finite numbers

            if (firstNumericInData) {
                primaryField = firstNumericInData[0]; // Use the key (field name)
                console.log(`[TopN Viz] Using first numeric field found in feature data: "${primaryField}"`); // Fixed no-useless-escape
            }
        }
    }

    // 5. Final check: Ensure a field was determined, otherwise throw error
    if (!primaryField) {
        // If no field could be determined after all checks, throw an error
        console.error(`[TopN Viz] Could not determine a suitable numeric field for ranking on layer ${layerConfig.id}. Please check layer configuration or provide a field in options.`);
        throw new Error(`Could not determine a numeric field for Top N visualization on layer "${layerConfig.name}".`); // Fixed no-useless-escape
    }
    // --- End Primary Field Determination ---

    // Get features from the layer and normalize their structure
    let validFeatures = layers[0].features.map((feature, index) => {
        try {
            // Skip features without geometry
            if (!feature.geometry) {
                console.log('Skipping feature without geometry:', feature);
                return null;
            }

            // Normalize attributes first, giving preference to properties
            const attributes = {
                OBJECTID: index + 1,
                ...(feature.attributes || {}), // Include original attributes
                ...(feature.properties || {}), // Overwrite/add with properties
                DESCRIPTION: feature.properties?.DESCRIPTION || feature.attributes?.DESCRIPTION || `Feature Area` // Ensure DESCRIPTION exists
            };

            // Verify the feature has the required field with a valid number
            const value = Number(attributes[primaryField!]); // Use non-null assertion as we validated primaryField
            if (!isFinite(value)) {
                // Log detailed info if the value is invalid
                console.log('[TopN Viz] Skipping feature with invalid/non-finite value for ranking field:', {
                    featureIndex: index,
                    field: primaryField, 
                    value: attributes[primaryField!], // Log the actual value
                    attributesSample: Object.keys(attributes).slice(0, 5) // Log some available attribute keys
                });
                return null; // Skip features with non-finite values for the ranking field
            }

            // Handle geometry conversion using createGeometry utility
            let geometry;
            try {
              // Use properties._originalEsriGeometry if available, otherwise feature.geometry
              const geometrySource = feature.properties?._originalEsriGeometry || feature.geometry;
              if (!geometrySource) throw new Error("Missing geometry source for createGeometry");
              geometry = createGeometry(geometrySource);
            } catch (geomError) {
              console.warn(`[TopN Viz] Feature ${index} geometry conversion failed:`, geomError);
              return null; // Skip features where geometry creation fails
            }

            if (!geometry) {
                console.warn(`[TopN Viz] Feature ${index} has null geometry after conversion`);
                return null; // Skip features with null geometry after conversion
            }

            // Create a new Graphic with the normalized structure
            const graphic = new Graphic({
                geometry: geometry,
                attributes: attributes
            });

            // Verify the geometry is valid
            if (!graphic.geometry || !graphic.geometry.extent || 
                !isFinite(graphic.geometry.extent.xmin) || 
                !isFinite(graphic.geometry.extent.ymin) ||
                !isFinite(graphic.geometry.extent.xmax) || 
                !isFinite(graphic.geometry.extent.ymax)) {
                console.warn(`[TopN Viz] Feature ${index} has invalid extent after creation`);
                return null; // Skip features with invalid extents
            }

            return graphic;
        } catch (error) {
            console.warn(`[TopN Viz] Error processing feature ${index}:`, error);
            return null; // Skip features that cause processing errors
        }
    }).filter((f): f is ArcGISGraphic => f !== null); // Filter out nulls and ensure correct type

    if (validFeatures.length === 0) {
        console.error("[TopN Viz] No valid features remained after processing. Cannot create TopN visualization.");
        // Depending on desired behavior, you might throw an error or return an empty result
         throw new Error(`No valid features found for TopN analysis on layer "${layerConfig.name}" with field "${primaryField}".`);
        // return { layer: null, extent: null }; // Alternative: return empty
    }

    console.log('[TopN Viz] Valid features before sorting:', {
        count: validFeatures.length,
        field: primaryField,
        sampleValues: validFeatures.slice(0, 5).map(f => ({
            value: f.attributes[primaryField!],
            description: f.attributes?.DESCRIPTION,
            hasGeometry: !!f.geometry,
        }))
    });

    // Sort features by value in descending order
    validFeatures = validFeatures.sort((a, b) => {
        // Use non-null assertion as we've filtered for valid numbers
        const valueA = Number(a.attributes[primaryField!]);
        const valueB = Number(b.attributes[primaryField!]);
        return valueB - valueA; // Descending order
    });

    // Take only the top N features
    const topNFeatures = validFeatures.slice(0, n);

    console.log('[TopN Viz] Top N features after filtering and sorting:', {
        count: topNFeatures.length,
        field: primaryField,
        sampleValues: topNFeatures.map(f => ({
            value: f.attributes[primaryField!],
            description: f.attributes?.DESCRIPTION,
        }))
    });

    // Add rank attribute
    topNFeatures.forEach((feature, index) => {
       feature.attributes['rank'] = index + 1;
    });

    // Create visualization data
    const visualizationData: TopNData = {
        features: topNFeatures,
        field: primaryField,
        n,
        filterConditions,
        title: options.title || `Top ${n} Areas by ${primaryField}`, // Use determined field in title
        layerName: layers[0].layer.name || 'Top N Layer',
        layerConfig: { // Pass relevant layer config info
             ...layerConfig, // Include original config
             fields: [ // Ensure rank field is defined for popups etc.
                ...(layerConfig.fields || []), // Safely spread original fields
                {
                    name: 'rank',
                    type: 'integer' as const,
                    label: 'Rank',
                    alias: 'Rank'
                }
            ]
        }
    };

    // Create and return the visualization
    return await topNViz.create(visualizationData, options);
  }
  /**
   * Creates a standard single-layer thematic visualization.
   */
  public async createSingleLayerVisualization(
    layers: ProcessedLayerResult[], // Use ProcessedLayerResult
    options: SingleLayerOptions // Use typed options
  ): Promise<VisualizationResult> { // Use VisualizationResult type
    // <<< ADD LOGGING: Entry point and inputs >>>
    console.log('[DYN_FACTORY][createSingleLayer] Entry point');
    console.log('[DYN_FACTORY][createSingleLayer] Input LayerResults:', layers.map(l => ({ layerId: l.layerId, features: l.features?.length })));
    console.log('[DYN_FACTORY][createSingleLayer] Input Options:', options);

    // --- 1. Validate Input --- 
    if (!layers || layers.length === 0 || !layers[0].features || layers[0].features.length === 0) {
      console.error('[DYN_FACTORY][createSingleLayer] Validation failed: No layers or features provided.');
      return { layer: null, extent: null }; // Return empty result if no features
    }
    
    // --- 2. Prepare Data for Visualization --- 
    const firstLayerResult = layers[0]; // Assume first layer for single-layer viz
    const layerId = firstLayerResult.layerId;
    const layerConfig = configLayers[layerId];

    if (!layerConfig) {
      console.error(`[DYN_FACTORY][createSingleLayer] Config not found for layer ID: ${layerId}`);
      return { layer: null, extent: null };
    }
    
    // Determine renderer field (Use optional chaining and fallback)
    let rendererField = options?.rendererField || layerConfig?.rendererField || 'thematic_value';
    
    // Ensure features have attributes and check if rendererField exists
    if (firstLayerResult.features[0]?.properties) {
        if (!Object.prototype.hasOwnProperty.call(firstLayerResult.features[0].properties, rendererField)) { // Fixed no-prototype-builtins
            console.warn(`[DYN_FACTORY][createSingleLayer] Renderer field '${rendererField}' not found in first feature properties. Keys: ${Object.keys(firstLayerResult.features[0].properties)}. Falling back to 'thematic_value'.`);
            rendererField = 'thematic_value';
        }
    } else {
        console.warn(`[DYN_FACTORY][createSingleLayer] First feature has no properties. Using default renderer field '${rendererField}'.`);
    }
    
    // <<< ADD LOGGING: Determined renderer field >>>
    console.log(`[DYN_FACTORY][createSingleLayer] Determined rendererField: ${rendererField}`);

    // Package data for the SingleLayerVisualization class
    const vizData: SingleLayerData = {
      features: firstLayerResult.features, // Directly pass LocalGeospatialFeature[]
      layerName: firstLayerResult.layerName || layerConfig.name,
      rendererField: rendererField,
      layerConfig: {
        fields: layerConfig.fields || [], // Use fields from config
        sourceSR: firstLayerResult.extent?.spatialReference?.wkid ?? undefined // Fixed type null issue
      }
    };

    // <<< ADD LOGGING: Prepared vizData >>>
    console.log('[DYN_FACTORY][createSingleLayer] Prepared vizData:', {
      featureCount: vizData.features?.length,
      layerName: vizData.layerName,
      rendererField: vizData.rendererField,
      layerConfigFields: vizData.layerConfig.fields?.length,
      layerConfigSourceSR: vizData.layerConfig.sourceSR
    });
    
    // --- 3. Create and Execute Visualization --- 
    try {
      const singleLayerViz = new SingleLayerVisualization();
      
      // <<< ADD LOGGING: Before calling viz.create >>>
      console.log('[DYN_FACTORY][createSingleLayer] Calling singleLayerViz.create()...');
      
      // Pass AnalysisContext if available in options
      const finalOptions = { ...options };
      if (options?.analysisContext) {
        finalOptions.analysisContext = options.analysisContext;
      }
      if (this.mapView) {
          finalOptions.mapView = this.mapView;
      }
      // <<< ADD THE DETERMINED RENDERER FIELD TO FINAL OPTIONS >>>
      finalOptions.rendererField = rendererField; 
      
      const result = await singleLayerViz.create(vizData, finalOptions);
      
      // <<< ADD LOGGING: After calling viz.create >>>
      console.log('[DYN_FACTORY][createSingleLayer] singleLayerViz.create() result:', {
        hasLayer: !!result?.layer,
        layerId: result?.layer?.id,
        layerTitle: result?.layer?.title,
        layerVisible: result?.layer?.visible,
        layerSourceCount: result?.layer?.source?.length,
        hasExtent: !!result?.extent
      });
      
      return result;
    } catch (error) {
      console.error('[DYN_FACTORY][createSingleLayer] Error during visualization creation:', error);
      return { layer: null, extent: null };
    }
  }

  public async createPointVisualization(
    layers: LayerResult[],
    options: any
  ): Promise<{ layer: any; extent: any }> {
    console.log('Creating point visualization:', {
      layerCount: layers.length,
      firstLayer: layers[0]?.layer.id,
      featureCount: layers[0]?.features.length,
      options
    });

    // --- Input Validation ---
    if (!layers || layers.length !== 1) {
      throw new Error(`[Validation Error] createPointVisualization requires exactly 1 LayerResult, received ${layers?.length ?? 0}.`);
    }
    const layer = layers[0];
    if (!layer || !layer.layer || !Array.isArray(layer.features)) {
      throw new Error(`[Validation Error] createPointVisualization received invalid LayerResult structure.`);
    }
    if (layer.features.length === 0) {
      console.warn('[Validation Warning] createPointVisualization received 0 features.');
      // Potentially return null layer or throw error if 0 features is invalid
    }
    // Optional: Check if features actually have point geometry (or warn if not)
    const firstGeomType = layer.features[0]?.geometry?.type;
    if (layer.features.length > 0 && firstGeomType !== 'point') {
        console.warn(`[Validation Warning] createPointVisualization expected 'point' geometry but received '${firstGeomType}'. Will attempt to use centroids.`);
    }
    // --- End Validation ---

    const pointViz = new PointLayerVisualization();
    // const layer = layers[0]; // Already defined above

    // Convert features to the expected format
    const features = layer.features.map(feature => ({
      geometry: feature.geometry,
      properties: feature.properties,
      attributes: feature.properties
    }));

    // Create visualization data
    const visualizationData: PointVisualizationData = {
      features,
      layerName: layer.layer.name || 'Point Layer',
      rendererField: layer.features[0]?.properties?.rendererField || 'CONAME',
      layerConfig: {
        fields: [
          {
            name: 'CONAME',
            type: 'string' as FieldType,
            alias: 'Store Name',
            label: 'Store Name'
          },
          {
            name: 'OBJECTID',
            type: 'oid' as FieldType,
            alias: 'Object ID',
            label: 'ID'
          }
        ]
      }
    };

    // Set visualization options with proper typing
    const vizOptions: PointVisualizationOptions = {
      title: options.title || `${layer.layer.name || 'Point Locations'}`,
      symbolConfig: {
        color: [0, 122, 194, 0.8],
        size: 8,
        outline: {
          color: [255, 255, 255, 0.8],
          width: 1
        }
      }
    };

    console.log('Creating point visualization with:', {
      dataFeatures: visualizationData.features.length,
      rendererField: visualizationData.rendererField,
      sampleFeature: features[0]
    });

    return await pointViz.create(visualizationData, vizOptions);
  }

  // Keep private as it's internal helper detail
  private async createHotspotVisualization(
    layers: LayerResult[],
    options: any
  ): Promise<{ layer: any; extent: any }> {
    console.log('Creating hotspot visualization - SKIPPED FOR REFACTORING');
    // const hotspotViz = new HotspotVisualization(); // Commented out
    // return await hotspotViz.create(...);
    return { layer: null, extent: null }; // Return null during refactor
  }

  // Keep private as it's internal helper detail
  private async createProportionalVisualization(
    layers: LayerResult[],
    options: any
  ): Promise<{ layer: any; extent: any }> {
     console.log('Creating proportional symbol visualization - SKIPPED FOR REFACTORING');
    // const proportionalViz = new ProportionalSymbolVisualization(); // Commented out
    // ... implementation ...
    // const graphics = layer.features.map(...);
    // const visualizationData = { ... };
    // const vizOptions: VisualizationOptions = { ... };
    // return await proportionalViz.create(visualizationData, vizOptions);
     return { layer: null, extent: null }; // Return null during refactor
  }

  private calculatePearsonCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length) {
      throw new Error('Arrays must have the same length');
    }

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
    const sumY2 = y.reduce((sum, val) => sum + val * val, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Finds the field containing voting percentage for a specific party
   * @param feature Sample feature to examine (an individual feature with attributes, NOT a LayerResult)
   * @param partyName The party name to search for (e.g., 'Conservative')
   * @returns The field name containing the voting percentage
   */
  private findComparisonFieldForParty(feature: any, partyName: string): string {
    console.log(`[DynamicVisualizationFactory] Finding comparison field for party: ${partyName}`, {
      availableFields: feature.attributes ? Object.keys(feature.attributes) : []
    });
    
    if (!feature?.attributes) {
      throw new Error('Cannot find comparison field: Feature has no attributes.');
    }
    
    // First try the direct approach - look for obvious field patterns
    const directMatches = [
      `${partyName.toUpperCase()}_PERCENT`,
      `${partyName.toUpperCase()}_VOTE_PERCENT`,
      `${partyName}_PERCENT`,
      `${partyName}_VOTE_PERCENT`
    ];
    
    for (const field of directMatches) {
      if (feature.attributes[field] !== undefined) {
        console.log(`[DynamicVisualizationFactory] Found direct match field: ${field}`);
        return field;
      }
    }
    
    // If no direct matches found, look for fields containing the party name
    const availableFields = Object.keys(feature.attributes);
    const partyFields = availableFields.filter(field => 
      field.toLowerCase().includes(partyName.toLowerCase()) &&
      typeof feature.attributes[field] === 'number'
    );
    
    if (partyFields.length > 0) {
      console.log(`[DynamicVisualizationFactory] Found field containing party name: ${partyFields[0]}`);
      return partyFields[0];
    }
    
    // If no field was found, check for pre-calculated comparison_value
    if (feature.attributes.comparison_value !== undefined) {
      console.log(`[DynamicVisualizationFactory] Using pre-calculated comparison_value field`);
      return 'comparison_value';
    }
    
    // If no suitable field found, provide detailed error message
    const fieldList = availableFields.map(field => 
      `${field} (${typeof feature.attributes[field]})`
    ).join(', ');

    throw new Error(
      `Could not find a suitable field for party "${partyName}". ` +
      `Tried the following patterns: ${directMatches.join(', ')}. ` +
      `Available fields: ${fieldList}`
    );
  }

  /**
   * Creates a joint high visualization, mirroring the correlation join logic.
   */
  public async createJointHighVisualization(
    layerResults: ProcessedLayerResult[],
    options: { primaryField?: string; comparisonField?: string; title?: string }
  ): Promise<VisualizationResult> {
    // Validation
    if (!layerResults || layerResults.length < 2) {
      throw new Error('[JointHigh] Need two layers for joint high visualization.');
    }
    const primaryLayer = layerResults[0];
    const comparisonLayer = layerResults[1];
    const primaryField = options.primaryField || this.findPrimaryField(primaryLayer);
    const comparisonField = options.comparisonField || this.findPrimaryField(comparisonLayer);

    // Convert features to Graphics (mirroring correlation logic)
    const toGraphics = (features: any[]) => features
      .map((feature: any) => {
        const geometry = createGeometry(feature.properties?._originalEsriGeometry || feature.geometry);
        if (!geometry) return null;
        return new Graphic({
          geometry,
          attributes: { ...feature.properties, ...feature.attributes }
        });
      })
      .filter((g: ArcGISGraphic | null): g is ArcGISGraphic => g !== null);
    const primaryGraphics = toGraphics(primaryLayer.features);
    const comparisonGraphics = toGraphics(comparisonLayer.features);

    // Join features by a common key (try to use 'CSDNAME', fallback to OBJECTID)
    const joinField = 'CSDNAME';
    const getJoinValue = (attrs: any) => (attrs && (attrs[joinField] || attrs.OBJECTID || attrs.objectid || attrs.id || attrs.Id));
    const comparisonMap = new Map<string | number, any>();
    for (const g of comparisonGraphics) {
      const val = getJoinValue(g.attributes);
      if (val !== undefined && val !== null) comparisonMap.set(String(val).toLowerCase(), g);
    }
    const mergedFeatures = [];
    for (const g of primaryGraphics) {
      const val = getJoinValue(g.attributes);
      if (val !== undefined && val !== null) {
        const match = comparisonMap.get(String(val).toLowerCase());
        if (match && g.geometry) { // Ensure geometry is not null
          const newAttributes: { [key: string]: any } = {
            ...g.attributes,
            [primaryField]: g.attributes[primaryField],
            [comparisonField]: match.attributes[comparisonField]
          };
          if (g.geometry && typeof g.geometry.toJSON === 'function') {
            newAttributes._originalEsriGeometry = g.geometry.toJSON();
          }
          mergedFeatures.push(new Graphic({
            geometry: g.geometry,
            attributes: newAttributes
          }));
        }
      }
    }
    if (!mergedFeatures.length) {
      throw new Error('[JointHigh] No matching features found between layers for joint high visualization.');
    }

    // Prepare data for JointHighVisualization
    const data = {
      features: mergedFeatures,
      layerConfig: primaryLayer.layer,
      layerId: primaryLayer.layer.id,
      layerName: primaryLayer.layer.name || 'Joint High Layer',
      primaryField,
      comparisonField
    };
    // --- NEW: Get display names for both layers ---
    const primaryLayerName = primaryLayer.layer.name || primaryLayer.layer.id || primaryField;
    const comparisonLayerName = comparisonLayer.layer.name || comparisonLayer.layer.id || comparisonField;
    // Use a neutral combined title
    const legendTitle = `Combined: ${primaryLayerName} & ${comparisonLayerName}`;
    const jointHighViz = new JointHighVisualization();
    return await jointHighViz.create(data, { title: legendTitle });
  }
}

// Query type detection functions
const isCorrelationQuery = (query: string): boolean => {
  const correlationKeywords = [
    'correlation',
    'relationship',
    'compare',
    'versus',
    'vs',
    'between',
    'against'
  ];
  
  return correlationKeywords.some(keyword => 
    query.toLowerCase().includes(keyword)
  );
};

const is3DVisualizationQuery = (query: string): boolean => {
  const threeDKeywords = [
    '3d',
    'three dimensional',
    'height',
    'elevation',
    'terrain',
    'buildings',
    'skyline'
  ];
  
  return threeDKeywords.some(keyword => 
    query.toLowerCase().includes(keyword)
  );
};

// --- ADD LOCAL validateExtent HELPER --- 
const validateExtent = (extent: Extent | null | undefined): extent is Extent => {
    if (!extent) return false;
    const requiredProps: (keyof Extent)[] = [
        'xmin', 'ymin', 'xmax', 'ymax', 'spatialReference'
    ];
    const hasRequiredProps = requiredProps.every(prop => Object.prototype.hasOwnProperty.call(extent, prop)); // Fixed no-prototype-builtins
    if (!hasRequiredProps) return false;

    const numericProps: (keyof Extent)[] = ['xmin', 'ymin', 'xmax', 'ymax'];
    const areNumeric = numericProps.every(prop => typeof extent[prop] === 'number' && isFinite(extent[prop] as number));
    if (!areNumeric) return false;

    if (extent.xmin >= extent.xmax || extent.ymin >= extent.ymax) return false;

    return extent.spatialReference != null;
};
// --- END HELPER ---