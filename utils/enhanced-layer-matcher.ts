import type { LayerConfig } from '@/types/layers';
import type { LayerMatch } from '@/types/geospatial-ai-types';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Extent from '@arcgis/core/geometry/Extent';

interface SemanticScore {
  score: number;
  reason: string;
  confidence: number;
}

interface FieldMatch {
  fieldName: string;
  relevance: number;
  matchType: 'direct' | 'semantic' | 'inferred';
}

interface LayerContext {
  recentQueries: string[];
  successfulMatches: Map<string, number>;
  userFeedback: Map<string, number>;
}

export class EnhancedLayerMatcher {
  private context: LayerContext;
  private semanticCache: Map<string, SemanticScore>;

  constructor() {
    this.context = {
      recentQueries: [],
      successfulMatches: new Map(),
      userFeedback: new Map()
    };
    this.semanticCache = new Map();
  }

  async findRelevantLayers(
    query: string,
    availableLayers: LayerConfig[]
  ): Promise<LayerMatch[]> {
    // Update context with new query
    this.updateQueryContext(query);

    // Calculate matches for each layer
    const matches = await Promise.all(
      availableLayers.map(layer => this.scoreLayer(query, layer))
    );

    // Sort by relevance and filter low-confidence matches
    const relevantMatches = matches
      .filter(match => match.confidence > 0.3)
      .sort((a, b) => b.relevance - a.relevance);

    // Update successful matches in context
    relevantMatches.forEach(match => {
      const currentCount = this.context.successfulMatches.get(match.layerId) || 0;
      this.context.successfulMatches.set(match.layerId, currentCount + 1);
    });

    return relevantMatches;
  }

  private async scoreLayer(
    query: string,
    layer: LayerConfig
  ): Promise<LayerMatch> {
    const scores: SemanticScore[] = [];

    // Name and description matching
    scores.push(this.scoreLayerMetadata(query, layer));

    // Field matching
    const fieldMatches = this.findRelevantFields(query, layer);
    scores.push(this.scoreFieldMatches(fieldMatches));

    // Historical performance
    scores.push(this.scoreHistoricalPerformance(layer.id));

    // Data type compatibility
    scores.push(this.scoreDataTypeCompatibility(query, layer));

    // Calculate final scores
    const relevance = this.calculateFinalScore(scores);
    const confidence = this.calculateConfidence(scores);
    const reasoning = this.generateReasoning(scores);

    // Create the feature layer
    const featureLayer = new FeatureLayer({
      url: layer.url,
      outFields: ["*"]
    });

    // Create a default extent if none is provided
    const extent = featureLayer.fullExtent || new Extent({
      xmin: -180,
      ymin: -90,
      xmax: 180,
      ymax: 90,
      spatialReference: { wkid: 4326 }
    });

    return {
      layerId: layer.id,
      layer: featureLayer,
      extent: extent,
      relevance,
      confidence,
      reasoning,
      matchMethod: 'ai',
      field: layer.rendererField
    };
  }

  private scoreLayerMetadata(
    query: string,
    layer: LayerConfig
  ): SemanticScore {
    const cacheKey = `${query}-${layer.id}-metadata`;
    if (this.semanticCache.has(cacheKey)) {
      return this.semanticCache.get(cacheKey)!;
    }

    const searchableText = [
      layer.name,
      ...(layer.metadata?.tags || []),
      layer.type
    ].filter(Boolean).join(' ').toLowerCase();

    const queryTerms = query.toLowerCase().split(/\s+/);
    let score = 0;
    let matchedTerms = 0;

    queryTerms.forEach(term => {
      if (searchableText.includes(term)) {
        score += 1;
        matchedTerms++;
      }
    });

    const result: SemanticScore = {
      score: matchedTerms ? score / queryTerms.length : 0,
      reason: matchedTerms ? `Matched ${matchedTerms} query terms in layer metadata` : 'No metadata matches',
      confidence: matchedTerms ? 0.8 : 0.4
    };

    this.semanticCache.set(cacheKey, result);
    return result;
  }

  private findRelevantFields(
    query: string,
    layer: LayerConfig
  ): FieldMatch[] {
    const matches: FieldMatch[] = [];
    const queryTerms = query.toLowerCase().split(/\s+/);

    layer.fields.forEach(field => {
      let relevance = 0;
      let matchType: FieldMatch['matchType'] = 'direct';

      // Direct name matching
      queryTerms.forEach(term => {
        if (field.name.toLowerCase().includes(term)) {
          relevance += 1;
        }
      });

      // Type-based inference
      if (this.isFieldTypeRelevant(field.type, query)) {
        relevance += 0.5;
        matchType = 'inferred';
      }

      if (relevance > 0) {
        matches.push({
          fieldName: field.name,
          relevance,
          matchType
        });
      }
    });

    return matches.sort((a, b) => b.relevance - a.relevance);
  }

  private isFieldTypeRelevant(fieldType: string, query: string): boolean {
    const numericalQueries = ['how many', 'count', 'total', 'average', 'mean', 'sum'];
    const temporalQueries = ['when', 'date', 'time', 'year', 'month', 'period'];
    
    if (fieldType === 'number' && numericalQueries.some(term => query.toLowerCase().includes(term))) {
      return true;
    }
    
    if (fieldType === 'date' && temporalQueries.some(term => query.toLowerCase().includes(term))) {
      return true;
    }

    return false;
  }

  private scoreFieldMatches(matches: FieldMatch[]): SemanticScore {
    if (matches.length === 0) {
      return {
        score: 0,
        reason: 'No relevant fields found',
        confidence: 0.3
      };
    }

    const totalRelevance = matches.reduce((sum, match) => sum + match.relevance, 0);
    const avgRelevance = totalRelevance / matches.length;

    return {
      score: avgRelevance,
      reason: `Found ${matches.length} relevant fields`,
      confidence: matches.some(m => m.matchType === 'direct') ? 0.9 : 0.7
    };
  }

  private scoreHistoricalPerformance(layerId: string): SemanticScore {
    const successCount = this.context.successfulMatches.get(layerId) || 0;
    const userScore = this.context.userFeedback.get(layerId) || 0;

    const score = Math.min((successCount * 0.1) + (userScore * 0.2), 1);

    return {
      score,
      reason: `Historical performance: ${successCount} successful matches`,
      confidence: successCount > 0 ? 0.8 : 0.4
    };
  }

  private scoreDataTypeCompatibility(
    query: string,
    layer: LayerConfig
  ): SemanticScore {
    const spatialQueries = ['where', 'location', 'area', 'region'];
    const isSpatialQuery = spatialQueries.some(term => query.toLowerCase().includes(term));

    // Check if layer type is suitable for spatial queries
    const isSpatialLayer = layer.type === 'index' || layer.type === 'point';

    if (isSpatialQuery && isSpatialLayer) {
      return {
        score: 1,
        reason: 'Layer type matches spatial query intent',
        confidence: 0.9
      };
    }

    return {
      score: 0.5,
      reason: 'Default compatibility score',
      confidence: 0.5
    };
  }

  private calculateFinalScore(scores: SemanticScore[]): number {
    const weights = {
      metadata: 0.4,
      fields: 0.3,
      historical: 0.2,
      dataType: 0.1
    };

    return scores.reduce((total, score, index) => {
      const weight = Object.values(weights)[index] || 0;
      return total + (score.score * weight);
    }, 0);
  }

  private calculateConfidence(scores: SemanticScore[]): number {
    const weightedConfidence = scores.reduce((sum, score) => sum + score.confidence, 0);
    return weightedConfidence / scores.length;
  }

  private generateReasoning(scores: SemanticScore[]): string {
    const reasons = scores
      .filter(score => score.score > 0)
      .map(score => score.reason);
    
    return reasons.join('; ');
  }

  private updateQueryContext(query: string) {
    this.context.recentQueries.unshift(query);
    if (this.context.recentQueries.length > 10) {
      this.context.recentQueries.pop();
    }
  }

  public provideFeedback(layerId: string, score: number) {
    this.context.userFeedback.set(layerId, score);
  }

  public clearCache() {
    this.semanticCache.clear();
  }
} 