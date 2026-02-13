import { LayerResult, LayerField } from '../types/geospatial-ai-types';
import { getLayerConfigById } from '../config/layers';
import * as geometryEngine from '@arcgis/core/geometry/geometryEngine';
import Point from '@arcgis/core/geometry/Point';
import Polygon from '@arcgis/core/geometry/Polygon';
import { BaseLayerConfig } from '../types/layers';

interface VisualizationScore {
  type: 'single' | 'point' | 'correlation' | '3d' | 'topN' | 'hotspot' | 'proportional';
  score: number;
  confidence: number;
  reasoning: string[];
}

interface DataCharacteristics {
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
    }>;
    distributions: {
      [field: string]: {
        type: string;
        skewness: number;
        kurtosis: number;
      };
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
    }>;
  };
}

interface FeedbackEntry {
  visualizationType: string;
  score: number;
  comments: string;
  context: {
    query: string;
    layerCount: number;
    timestamp: number;
  };
}

interface LayerWithFields {
  id: string;
  name: string;
  type: string;
  rendererField?: string;
  visualizationMode?: string;
  fields: LayerField[];
}

interface ExtendedLayerResult extends Omit<LayerResult, 'layer'> {
  layer: LayerWithFields;
}

interface LayerConfig {
  id: string;
  name: string;
  type: string;
  rendererField?: string;
  visualizationMode?: string;
  fields: LayerField[];
}

export class AIVisualizationSelector {
  private static instance: AIVisualizationSelector;
  private feedbackHistory: Map<string, FeedbackEntry[]> = new Map();

  private constructor() {}

  public static getInstance(): AIVisualizationSelector {
    if (!AIVisualizationSelector.instance) {
      AIVisualizationSelector.instance = new AIVisualizationSelector();
    }
    return AIVisualizationSelector.instance;
  }

  public addFeedback(feedback: FeedbackEntry) {
    const key = this.getFeedbackKey(feedback.context.query);
    const entries = this.feedbackHistory.get(key) || [];
    entries.push(feedback);
    this.feedbackHistory.set(key, entries);
    
    console.log('Feedback added:', {
      key,
      feedbackCount: entries.length,
      latestFeedback: feedback
    });
  }

  private getFeedbackKey(query: string): string {
    // Normalize query to group similar queries
    return query.toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  private getRelevantFeedback(query: string, layerCount: number): FeedbackEntry[] {
    const key = this.getFeedbackKey(query);
    const directMatches = this.feedbackHistory.get(key) || [];
    
    // Also find similar queries
    const similarEntries = Array.from(this.feedbackHistory.entries())
      .filter(([k, _]) => k !== key && this.calculateQuerySimilarity(k, key) > 0.7)
      .flatMap(([_, entries]) => entries);

    // Prioritize recent and similar layer count feedback
    return [...directMatches, ...similarEntries]
      .filter(entry => Math.abs(entry.context.layerCount - layerCount) <= 2)
      .sort((a, b) => b.context.timestamp - a.context.timestamp);
  }

  private calculateQuerySimilarity(query1: string, query2: string): number {
    const words1 = new Set(query1.toLowerCase().split(/\s+/));
    const words2 = new Set(query2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  private adjustScoreBasedOnFeedback(
    score: number,
    visualizationType: string,
    query: string,
    layerCount: number
  ): number {
    const relevantFeedback = this.getRelevantFeedback(query, layerCount);
    
    if (relevantFeedback.length === 0) {
      return score;
    }

    // Calculate feedback adjustment
    const typeFeedback = relevantFeedback.filter(f => f.visualizationType === visualizationType);
    if (typeFeedback.length === 0) {
      return score;
    }

    const avgFeedbackScore = typeFeedback.reduce((sum, f) => sum + f.score, 0) / typeFeedback.length;
    const feedbackWeight = Math.min(0.3, 0.1 * typeFeedback.length); // Cap at 30% influence
    
    // Adjust score based on feedback
    const adjustedScore = score * (1 - feedbackWeight) + (avgFeedbackScore / 5) * feedbackWeight;
    
    console.log('Score adjustment:', {
      visualizationType,
      originalScore: score,
      feedbackCount: typeFeedback.length,
      avgFeedbackScore,
      adjustedScore
    });

    return adjustedScore;
  }

  public async determineVisualizationType(
    layers: LayerResult[],
    query: string
  ): Promise<VisualizationScore[]> {
    console.log('AI Visualization Selection:', {
      layerCount: layers.length,
      query,
      layerTypes: layers.map(l => l.layer.type)
    });

    // Analyze data characteristics
    const characteristics = await this.analyzeData(layers);
    console.log('Data characteristics:', characteristics);

    // Generate initial scores
    let scores = await this.scoreVisualizationTypes(characteristics, query, layers);

    // Adjust scores based on feedback
    scores = scores.map(score => ({
      ...score,
      score: this.adjustScoreBasedOnFeedback(
        score.score,
        score.type,
        query,
        layers.length
      )
    }));

    // Sort by adjusted scores
    return scores.sort((a, b) => b.score - a.score);
  }

  private async analyzeData(layers: LayerResult[]): Promise<DataCharacteristics> {
    const characteristics: DataCharacteristics = {
      spatialPatterns: await this.analyzeSpatialPatterns(layers),
      attributePatterns: await this.analyzeAttributePatterns(layers),
      relationships: await this.analyzeRelationships(layers)
    };

    return characteristics;
  }

  private async analyzeSpatialPatterns(layers: LayerResult[]): Promise<DataCharacteristics['spatialPatterns']> {
    try {
      let totalClustering = 0;
      let totalDensity = 0;
      let pointCount = 0;

      for (const layer of layers) {
        const points = layer.features.map(f => {
          if (!f.geometry) return null;

          if (f.geometry.type === 'point') {
            // Handle point geometry
            const x = f.geometry.x || (f.geometry.coordinates && f.geometry.coordinates[0]);
            const y = f.geometry.y || (f.geometry.coordinates && f.geometry.coordinates[1]);
            
            if (typeof x === 'number' && typeof y === 'number') {
              return [x, y];
            }
          } else if (f.geometry.type === 'polygon') {
            // Handle polygon geometry
            try {
              const polygon = f.geometry as Polygon;
              const centroid = polygon.centroid;
              if (centroid && typeof centroid.x === 'number' && typeof centroid.y === 'number') {
                return [centroid.x, centroid.y];
              }
            } catch (error) {
              console.warn('Error getting polygon centroid:', error);
            }
          }
          return null;
        }).filter((p): p is number[] => p !== null);

        if (points.length > 0) {
          const clustering = await this.calculateClustering(points);
          const density = this.calculateDensity(points);
          
          totalClustering += clustering;
          totalDensity += density;
          pointCount++;
        }
      }

      // Get numeric values from features for distribution analysis
      const numericValues = layers.flatMap(layer => 
        layer.features.flatMap(f => {
          const attributes = f.attributes || {};
          return Object.values(attributes).filter((v): v is number => 
            typeof v === 'number' && !isNaN(v)
          );
        })
      );

      return {
        clustering: pointCount > 0 ? totalClustering / pointCount : 0,
        distribution: this.determineDistributionType(numericValues),
        density: pointCount > 0 ? totalDensity / pointCount : 0
      };
    } catch (error) {
      console.error('Error analyzing spatial patterns:', error);
      return {
        clustering: 0,
        distribution: 'random',
        density: 0
      };
    }
  }

  private async analyzeAttributePatterns(layers: LayerResult[]): Promise<DataCharacteristics['attributePatterns']> {
    const correlations: Array<{field1: string; field2: string; strength: number}> = [];
    const distributions: {[field: string]: {type: string; skewness: number; kurtosis: number}} = {};

    for (const layer of layers) {
      const numericFields = this.getNumericFields(layer);
      
      // Analyze distributions
      for (const field of numericFields) {
        const values = layer.features.map(f => f.attributes[field]).filter(v => typeof v === 'number');
        if (values.length > 0) {
          const stats = this.calculateDistributionStats(values);
          distributions[field] = stats;
        }
      }

      // Analyze correlations between fields
      for (let i = 0; i < numericFields.length; i++) {
        for (let j = i + 1; j < numericFields.length; j++) {
          const field1 = numericFields[i];
          const field2 = numericFields[j];
          const correlation = this.calculateCorrelation(layer.features, field1, field2);
          if (correlation !== null) {
            correlations.push({
              field1,
              field2,
              strength: correlation
            });
          }
        }
      }
    }

    return {
      correlations,
      distributions
    };
  }

  private async analyzeRelationships(layers: LayerResult[]): Promise<DataCharacteristics['relationships']> {
    const spatial: Array<{layer1: string; layer2: string; type: string; strength: number}> = [];
    const statistical: Array<{layer1: string; layer2: string; correlation: number; significance: number}> = [];

    // Analyze relationships between layers
    for (let i = 0; i < layers.length; i++) {
      for (let j = i + 1; j < layers.length; j++) {
        const layer1 = layers[i];
        const layer2 = layers[j];

        // Spatial relationship
        const spatialRelation = await this.analyzeSpatialRelationship(layer1, layer2);
        if (spatialRelation) {
          spatial.push(spatialRelation);
        }

        // Statistical relationship
        const statRelation = await this.analyzeStatisticalRelationship(layer1, layer2);
        if (statRelation) {
          statistical.push(statRelation);
        }
      }
    }

    return {
      spatial,
      statistical
    };
  }

  private async scoreVisualizationTypes(
    characteristics: DataCharacteristics,
    query: string,
    layers: LayerResult[]
  ): Promise<VisualizationScore[]> {
    const scores: VisualizationScore[] = [];
    const queryLower = query.toLowerCase();

    // Score proportional symbol visualization first
    scores.push(this.scoreProportionalVisualization(characteristics, queryLower, layers));

    // Score hotspot visualization
    scores.push(this.scoreHotspotVisualization(characteristics, queryLower, layers));

    // Score correlation visualization
    scores.push(this.scoreCorrelationVisualization(characteristics, queryLower, layers));

    // Score 3D visualization
    scores.push(this.score3DVisualization(characteristics, queryLower, layers));

    // Score point visualization
    scores.push(this.scorePointVisualization(characteristics, queryLower, layers));

    // Score top N visualization
    scores.push(this.scoreTopNVisualization(characteristics, queryLower, layers));

    // Score single layer visualization
    scores.push(this.scoreSingleVisualization(characteristics, queryLower, layers));

    return scores;
  }

  private scoreProportionalVisualization(
    characteristics: DataCharacteristics,
    query: string,
    layers: LayerResult[]
  ): VisualizationScore {
    const reasons: string[] = [];
    let score = 0;
    let confidence = 0;

    // Check query intent
    const proportionalKeywords = [
      'proportional', 'symbol', 'size', 'magnitude', 'distribution',
      'vary', 'varying', 'scaled', 'scaling', 'proportion', 'relative'
    ];

    const measurementKeywords = [
      'population', 'count', 'amount', 'quantity', 'total',
      'size', 'volume', 'number', 'value', 'magnitude'
    ];

    // Check for proportional visualization keywords
    if (proportionalKeywords.some(keyword => query.toLowerCase().includes(keyword))) {
      score += 0.4;
      confidence += 0.3;
      reasons.push('Query explicitly requests proportional or scaled visualization');
    }

    // Check for measurement-related keywords
    if (measurementKeywords.some(keyword => query.toLowerCase().includes(keyword))) {
      score += 0.3;
      confidence += 0.2;
      reasons.push('Query references quantities suitable for proportional representation');
    }

    // Check for numeric fields with good distribution
    const hasNumericFields = layers.some(l => {
      const numericFields = this.getNumericFields(l);
      return numericFields.length > 0;
    });

    if (hasNumericFields) {
      score += 0.2;
      confidence += 0.2;
      reasons.push('Numeric fields available for proportional scaling');
    }

    // Check distribution characteristics
    const distributions = Object.values(characteristics.attributePatterns.distributions);
    const hasWideDistribution = distributions.some(d => 
      d.type === 'continuous' || Math.abs(d.skewness) > 0.5
    );

    if (hasWideDistribution) {
      score += 0.2;
      reasons.push('Data shows distribution suitable for proportional representation');
    }

    // Check for point or polygon features
    const hasValidGeometry = layers.some(l => 
      l.layer.type === 'point' || l.layer.type === 'polygon'
    );

    if (hasValidGeometry) {
      score += 0.2;
      confidence += 0.2;
      reasons.push('Features suitable for proportional symbol representation');
    }

    // Boost score for ideal combinations
    if (
      (proportionalKeywords.some(k => query.includes(k)) && hasNumericFields) ||
      (measurementKeywords.some(k => query.includes(k)) && hasWideDistribution)
    ) {
      score = Math.min(1, score * 1.3);
      confidence = Math.min(1, confidence * 1.2);
      reasons.push('Strong indication for proportional symbol visualization');
    }

    // Normalize final scores
    score = Math.min(1, score);
    confidence = Math.min(1, confidence);

    return {
      type: 'proportional',
      score,
      confidence,
      reasoning: reasons
    };
  }

  private scoreHotspotVisualization(
    characteristics: DataCharacteristics,
    query: string,
    layers: LayerResult[]
  ): VisualizationScore {
    const reasons: string[] = [];
    let score = 0;
    let confidence = 0;

    // Check clustering
    if (characteristics.spatialPatterns.clustering > 0.6) {
      score += 0.3;
      reasons.push('High spatial clustering detected');
    }

    // Check density
    if (characteristics.spatialPatterns.density > 0.5) {
      score += 0.2;
      reasons.push('Significant point density patterns found');
    }

    // Check query intent
    const hotspotKeywords = ['hotspot', 'concentration', 'density', 'cluster'];
    if (hotspotKeywords.some(keyword => query.includes(keyword))) {
      score += 0.3;
      reasons.push('Query explicitly requests hotspot analysis');
    }

    // Check layer types
    const hasPointLayers = layers.some(l => l.layer.type === 'point');
    if (hasPointLayers) {
      score += 0.2;
      reasons.push('Point features present for hotspot analysis');
    }

    // Calculate confidence
    confidence = Math.min(1, (reasons.length / 4) * 0.8 + 0.2);

    return {
      type: 'hotspot',
      score,
      confidence,
      reasoning: reasons
    };
  }

  private scoreCorrelationVisualization(
    characteristics: DataCharacteristics,
    query: string,
    layers: LayerResult[]
  ): VisualizationScore {
    const reasons: string[] = [];
    let score = 0;
    let confidence = 0;

    // Check for strong correlations
    const hasStrongCorrelations = characteristics.attributePatterns.correlations.some(c => Math.abs(c.strength) > 0.7);
    if (hasStrongCorrelations) {
      score += 0.3;
      reasons.push('Strong correlations found between variables');
    }

    // Check query intent
    const correlationKeywords = ['correlation', 'relationship', 'compare', 'versus', 'vs'];
    if (correlationKeywords.some(keyword => query.includes(keyword))) {
      score += 0.3;
      reasons.push('Query explicitly requests correlation analysis');
    }

    // Check layer compatibility
    if (layers.length >= 2) {
      score += 0.2;
      reasons.push('Multiple layers available for correlation');
    }

    // Check statistical relationships
    if (characteristics.relationships.statistical.some(r => Math.abs(r.correlation) > 0.5)) {
      score += 0.2;
      reasons.push('Significant statistical relationships detected');
    }

    // Calculate confidence
    confidence = Math.min(1, (reasons.length / 4) * 0.8 + 0.2);

    return {
      type: 'correlation',
      score,
      confidence,
      reasoning: reasons
    };
  }

  private score3DVisualization(
    characteristics: DataCharacteristics,
    query: string,
    layers: LayerResult[]
  ): VisualizationScore {
    const reasons: string[] = [];
    let score = 0;
    let confidence = 0;

    // Check query intent
    const threeDKeywords = ['3d', 'three dimensional', 'height', 'elevation'];
    if (threeDKeywords.some(keyword => query.includes(keyword))) {
      score += 0.4;
      reasons.push('Query explicitly requests 3D visualization');
    }

    // Check layer types
    const hasHeightData = layers.some(l => {
      const config = getLayerConfigById(l.layer.id);
      const metadata = config?.metadata;
      return metadata?.tags?.some((tag: string) => 
        tag.toLowerCase().includes('elevation') || 
        tag.toLowerCase().includes('height') ||
        tag.toLowerCase().includes('3d')
      ) || false;
    });

    if (hasHeightData) {
      score += 0.3;
      reasons.push('Height/elevation data available');
    }

    // Check for polygon layers
    const hasPolygonLayer = layers.some(l => l.layer.type === 'polygon');
    if (hasPolygonLayer) {
      score += 0.3;
      reasons.push('Polygon features available for 3D extrusion');
    }

    // Calculate confidence
    confidence = Math.min(1, (reasons.length / 3) * 0.8 + 0.2);

    return {
      type: '3d',
      score,
      confidence,
      reasoning: reasons
    };
  }

  private scorePointVisualization(
    characteristics: DataCharacteristics,
    query: string,
    layers: LayerResult[]
  ): VisualizationScore {
    const reasons: string[] = [];
    let score = 0;
    let confidence = 0;

    // Check layer types
    const hasPointLayers = layers.some(l => l.layer.type === 'point');
    if (hasPointLayers) {
      score += 0.3;
      confidence += 0.3;
      reasons.push('Point features present');
    }

    // Enhanced query intent checking with more comprehensive keywords
    const locationKeywords = [
      'location', 'locations', 'place', 'places', 'where', 'address', 'addresses',
      'store', 'stores', 'branch', 'branches', 'site', 'sites', 'facility', 'facilities',
      'building', 'buildings', 'office', 'offices', 'outlet', 'outlets'
    ];

    const businessKeywords = [
      'costco', 'walmart', 'target', 'restaurant', 'shop', 'business', 'company',
      'school', 'hospital', 'bank', 'station', 'hotel', 'cafe', 'market'
    ];

    const spatialKeywords = [
      'in the area', 'nearby', 'near', 'around', 'within', 'closest', 'nearest'
    ];

    // Check for location-related keywords
    if (locationKeywords.some(keyword => query.toLowerCase().includes(keyword))) {
      score += 0.3;
      confidence += 0.2;
      reasons.push('Query explicitly references locations or places');
    }

    // Check for business/facility names
    if (businessKeywords.some(keyword => query.toLowerCase().includes(keyword))) {
      score += 0.3;
      confidence += 0.2;
      reasons.push('Query references specific business or facility types');
    }

    // Check for spatial relationship keywords
    if (spatialKeywords.some(keyword => query.toLowerCase().includes(keyword))) {
      score += 0.2;
      confidence += 0.2;
      reasons.push('Query includes spatial relationship indicators');
    }

    // Check spatial patterns
    if (characteristics.spatialPatterns.distribution === 'dispersed') {
      score += 0.2;
      reasons.push('Points show dispersed pattern suitable for point visualization');
    }

    // Check density - prefer point visualization for lower density
    if (characteristics.spatialPatterns.density < 0.5) {
      score += 0.2;
      reasons.push('Low point density suitable for individual point display');
    }

    // Penalize if data suggests other visualization types would be better
    if (characteristics.spatialPatterns.clustering > 0.7) {
      score -= 0.2;
      reasons.push('High clustering suggests hotspot visualization might be more appropriate');
    }

    // Normalize score and confidence
    score = Math.min(1, score);
    confidence = Math.min(1, confidence);

    // Boost score significantly if query strongly indicates point visualization
    if (
      (hasPointLayers && locationKeywords.some(k => query.toLowerCase().includes(k))) ||
      (hasPointLayers && businessKeywords.some(k => query.toLowerCase().includes(k)))
    ) {
      score = Math.min(1, score * 1.5);
      confidence = Math.min(1, confidence * 1.3);
      reasons.push('Strong indication of point-based location query');
    }

    return {
      type: 'point',
      score,
      confidence,
      reasoning: reasons
    };
  }

  private scoreTopNVisualization(
    characteristics: DataCharacteristics,
    query: string,
    layers: LayerResult[]
  ): VisualizationScore {
    const reasons: string[] = [];
    let score = 0;
    let confidence = 0;

    // Check query intent with expanded patterns
    const topNPatterns = [
      /top\s+\d+/i,
      /highest\s+\d+/i,
      /largest\s+\d+/i,
      /greatest\s+\d+/i,
      /most\s+\d+/i,
      /\d+\s+(highest|largest|greatest|top)/i
    ];

    const rankingKeywords = ['ranking', 'ranked', 'rank', 'highest', 'top', 'best'];
    const measurementKeywords = ['income', 'revenue', 'sales', 'population', 'value', 'score', 'price'];

    // Check for explicit top N patterns
    if (topNPatterns.some(pattern => pattern.test(query))) {
      score += 0.4;
      reasons.push('Query explicitly requests top N results');
      confidence += 0.4;
    }

    // Check for ranking keywords
    if (rankingKeywords.some(keyword => query.toLowerCase().includes(keyword))) {
      score += 0.3;
      reasons.push('Query indicates ranking or comparison');
      confidence += 0.2;
    }

    // Check for measurement keywords that often indicate ranking intent
    if (measurementKeywords.some(keyword => query.toLowerCase().includes(keyword))) {
      score += 0.2;
      reasons.push('Query references measurable attributes suitable for ranking');
      confidence += 0.2;
    }

    // Check for numeric fields with clear ranking potential
    const hasRankableFields = layers.some(l => {
      const numericFields = this.getNumericFields(l);
      return numericFields.length > 0;
    });

    if (hasRankableFields) {
      score += 0.3;
      reasons.push('Numeric fields available for ranking');
      confidence += 0.2;
    }

    // Check distribution characteristics
    const hasSkewedDistribution = Object.values(characteristics.attributePatterns.distributions)
      .some(d => Math.abs(d.skewness) > 1);

    if (hasSkewedDistribution) {
      score += 0.2;
      reasons.push('Data shows skewed distribution suitable for top N analysis');
    }

    // Normalize score and confidence
    score = Math.min(1, score);
    confidence = Math.min(1, confidence);

    return {
      type: 'topN',
      score,
      confidence,
      reasoning: reasons
    };
  }

  private scoreSingleVisualization(
    characteristics: DataCharacteristics,
    query: string,
    layers: LayerResult[]
  ): VisualizationScore {
    const reasons: string[] = [];
    let score = 0;
    let confidence = 0;

    // Check layer count
    if (layers.length === 1) {
      score += 0.3;
      reasons.push('Single layer available');
    }

    // Check query intent
    const singleLayerKeywords = ['show', 'display', 'visualize', 'map'];
    const proportionalKeywords = ['proportional', 'symbol', 'distribution', 'vary', 'varying', 'scaled', 'proportion'];
    const measurementKeywords = ['population', 'count', 'amount', 'quantity', 'total', 'size', 'volume', 'number'];

    // Reduce score if query suggests proportional visualization
    if (proportionalKeywords.some(keyword => query.toLowerCase().includes(keyword)) ||
        measurementKeywords.some(keyword => query.toLowerCase().includes(keyword))) {
      score -= 0.3;
      reasons.push('Query suggests proportional visualization might be more appropriate');
    } else if (singleLayerKeywords.some(keyword => query.includes(keyword))) {
      score += 0.2;
      reasons.push('Query suggests simple visualization');
    }

    // Check for continuous data
    const hasContinuousData = Object.values(characteristics.attributePatterns.distributions)
      .some(d => d.type === 'continuous');

    if (hasContinuousData) {
      score += 0.2;
      reasons.push('Continuous data suitable for choropleth/single layer visualization');
    }

    // Check for low complexity
    const hasSimpleRelationships = characteristics.relationships.statistical.length === 0;
    if (hasSimpleRelationships) {
      score += 0.3;
      reasons.push('Simple data relationships suggest single layer visualization');
    }

    // Normalize score
    score = Math.max(0, Math.min(1, score));
    confidence = Math.min(1, (reasons.length / 4) * 0.8 + 0.2);

    return {
      type: 'single',
      score,
      confidence,
      reasoning: reasons
    };
  }

  // Helper methods
  private async calculateClustering(points: number[][]): Promise<number> {
    if (points.length < 2) return 0;

    let totalDistance = 0;
    let count = 0;
    const sampleSize = Math.min(points.length, 100); // Limit sample size for performance

    for (let i = 0; i < sampleSize; i++) {
      for (let j = i + 1; j < sampleSize; j++) {
        const dist = Math.sqrt(
          Math.pow(points[i][0] - points[j][0], 2) +
          Math.pow(points[i][1] - points[j][1], 2)
        );
        totalDistance += dist;
        count++;
      }
    }

    const avgDistance = totalDistance / count;
    const maxDistance = Math.sqrt(
      Math.pow(Math.max(...points.map(p => p[0])) - Math.min(...points.map(p => p[0])), 2) +
      Math.pow(Math.max(...points.map(p => p[1])) - Math.min(...points.map(p => p[1])), 2)
    );

    return 1 - (avgDistance / maxDistance);
  }

  private calculateDensity(points: number[][]): number {
    if (points.length < 2) return 0;

    const bounds = this.getBounds(points);
    const area = (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY);
    
    return points.length / area;
  }

  private determineDistributionType(values: number[]): string {
    if (values.length < 2) return 'unknown';

    // Calculate mean and standard deviation
    const mean = values.reduce((a, b) => a + b) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Calculate skewness
    const skewness = this.calculateSkewness(values, mean, stdDev);

    // Determine distribution type based on skewness
    if (Math.abs(skewness) < 0.5) {
      return 'normal';
    } else if (skewness > 0) {
      return 'right-skewed';
    } else {
      return 'left-skewed';
    }
  }

  private getBounds(points: number[][]): {minX: number; maxX: number; minY: number; maxY: number} {
    return {
      minX: Math.min(...points.map(p => p[0])),
      maxX: Math.max(...points.map(p => p[0])),
      minY: Math.min(...points.map(p => p[1])),
      maxY: Math.max(...points.map(p => p[1]))
    };
  }

  private getNumericFields(layer: LayerResult): string[] {
    if (!layer.features || layer.features.length === 0) {
      throw new Error('No features available for analysis. Please ensure the layer contains data.');
    }

    // Get layer configuration which contains field information
    const config = getLayerConfigById(layer.layer.id);
    if (!config || !config.fields) {
      throw new Error('Layer configuration missing or has no fields defined. Please configure the layer with appropriate field definitions.');
    }

    // Get numeric fields from configuration
    const numericTypes = ['double', 'single', 'integer', 'small-integer'];
    const configuredNumericFields = config.fields
      .filter((field: LayerField) => 
        numericTypes.includes(field.type) &&
        field.name !== 'thematic_value' // Exclude thematic_value as it's for rendering only
      )
      .map((field: LayerField) => field.name);

    if (configuredNumericFields.length === 0) {
      const availableFields = config.fields.map((f: LayerField) => `${f.name} (${f.type})`).join(', ');
      throw new Error(`No numeric fields configured in layer. Available fields: ${availableFields}`);
    }

    // Verify fields exist in features
    const firstFeature = layer.features[0];
    const attributes = firstFeature?.attributes || {};
    const availableFields = configuredNumericFields.filter((fieldName: string) => 
      attributes[fieldName] !== undefined && 
      typeof attributes[fieldName] === 'number'
    );

    if (availableFields.length === 0) {
      throw new Error(`Configured numeric fields (${configuredNumericFields.join(', ')}) not found in feature attributes. Available attributes: ${Object.keys(attributes).join(', ')}`);
    }

    return availableFields;
  }

  private calculateDistributionStats(values: number[]): {type: string; skewness: number; kurtosis: number} {
    const n = values.length;
    if (n < 2) return { type: 'unknown', skewness: 0, kurtosis: 0 };

    const mean = values.reduce((a, b) => a + b) / n;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    const skewness = this.calculateSkewness(values, mean, stdDev);
    const kurtosis = this.calculateKurtosis(values, mean, stdDev);

    return {
      type: this.determineDistributionType(values),
      skewness,
      kurtosis
    };
  }

  private calculateSkewness(values: number[], mean: number, stdDev: number): number {
    const n = values.length;
    return (values.reduce((a, b) => a + Math.pow(b - mean, 3), 0) / n) / Math.pow(stdDev, 3);
  }

  private calculateKurtosis(values: number[], mean: number, stdDev: number): number {
    const n = values.length;
    return (values.reduce((a, b) => a + Math.pow(b - mean, 4), 0) / n) / Math.pow(stdDev, 4);
  }

  private calculateCorrelation(features: any[], field1: string, field2: string): number | null {
    const pairs = features
      .map(f => [f.attributes[field1], f.attributes[field2]])
      .filter((pair): pair is [number, number] => 
        typeof pair[0] === 'number' && 
        typeof pair[1] === 'number' &&
        !isNaN(pair[0]) && 
        !isNaN(pair[1])
      );

    if (pairs.length < 2) return null;

    const n = pairs.length;
    const sum1 = pairs.reduce((sum, pair) => sum + pair[0], 0);
    const sum2 = pairs.reduce((sum, pair) => sum + pair[1], 0);
    const sum1Sq = pairs.reduce((sum, pair) => sum + pair[0] * pair[0], 0);
    const sum2Sq = pairs.reduce((sum, pair) => sum + pair[1] * pair[1], 0);
    const pSum = pairs.reduce((sum, pair) => sum + pair[0] * pair[1], 0);

    const num = pSum - (sum1 * sum2 / n);
    const den = Math.sqrt((sum1Sq - sum1 * sum1 / n) * (sum2Sq - sum2 * sum2 / n));

    return den === 0 ? 0 : num / den;
  }

  private async analyzeSpatialRelationship(layer1: LayerResult, layer2: LayerResult): Promise<{
    layer1: string;
    layer2: string;
    type: string;
    strength: number;
  } | null> {
    try {
      // Simple implementation - can be enhanced
      return {
        layer1: layer1.layer.id,
        layer2: layer2.layer.id,
        type: 'overlap',
        strength: 0.5
      };
    } catch (error) {
      console.error('Error analyzing spatial relationship:', error);
      return null;
    }
  }

  private async analyzeStatisticalRelationship(layer1: LayerResult, layer2: LayerResult): Promise<{
    layer1: string;
    layer2: string;
    correlation: number;
    significance: number;
  } | null> {
    try {
      // Simple implementation - can be enhanced
      return {
        layer1: layer1.layer.id,
        layer2: layer2.layer.id,
        correlation: 0.5,
        significance: 0.95
      };
    } catch (error) {
      console.error('Error analyzing statistical relationship:', error);
      return null;
    }
  }
} 