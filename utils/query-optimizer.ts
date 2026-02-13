import type { LayerConfig, LayerType } from '@/types/layers';

interface OptimizedQuery {
  originalQuery: string;
  intent: QueryIntent;
  relevanceScores: Map<string, number>;
  suggestedFields: string[];
  dataRequirements: DataRequirement[];
}

interface QueryIntent {
  primary: 'comparison' | 'distribution' | 'correlation' | 'hotspot' | 'trend' | 'trends';
  secondary?: string[];
  confidence: number;
}

interface DataRequirement {
  type: 'numeric' | 'categorical' | 'temporal' | 'spatial';
  priority: number;
  description: string;
}

const QUERY_PATTERNS = {
  comparison: ['compare', 'difference', 'versus', 'vs', 'between'],
  distribution: ['distribution', 'spread', 'pattern', 'across', 'throughout'],
  correlation: ['correlation', 'relationship', 'associated', 'linked'],
  hotspot: ['hotspot', 'cluster', 'concentration', 'density'],
  trend: ['trend', 'change', 'over time', 'historical'],
  trends: ['trending', 'popularity', 'interest over time', 'search volume', 'google trends']
};

export class QueryOptimizer {
  private queryCache: Map<string, OptimizedQuery>;
  private patternCache: Map<string, RegExp>;

  constructor() {
    this.queryCache = new Map();
    this.patternCache = new Map();
    this.initializePatternCache();
  }

  private initializePatternCache(): void {
    Object.entries(QUERY_PATTERNS).forEach(([intent, patterns]) => {
      patterns.forEach(pattern => {
        const regex = new RegExp(`\\b${pattern}\\b`, 'i');
        this.patternCache.set(pattern, regex);
      });
    });
  }

  async optimizeQuery(query: string, availableLayers: LayerConfig[]): Promise<OptimizedQuery> {
    // Check cache first
    const cachedResult = this.queryCache.get(query);
    if (cachedResult) {
      return cachedResult;
    }

    // Analyze query intent
    const intent = this.analyzeIntent(query);

    // Calculate layer relevance scores
    const relevanceScores = this.calculateLayerRelevance(query, availableLayers, intent);

    // Determine required fields
    const suggestedFields = this.determineSuggestedFields(query, availableLayers, intent);

    // Identify data requirements
    const dataRequirements = this.identifyDataRequirements(intent, availableLayers);

    const optimizedQuery: OptimizedQuery = {
      originalQuery: query,
      intent,
      relevanceScores,
      suggestedFields,
      dataRequirements
    };

    // Cache the result
    this.queryCache.set(query, optimizedQuery);

    return optimizedQuery;
  }

  private analyzeIntent(query: string): QueryIntent {
    const scores = new Map<string, number>();
    let maxScore = 0;
    let primaryIntent: QueryIntent['primary'] = 'distribution';

    // Score each intent type based on pattern matches
    Object.entries(QUERY_PATTERNS).forEach(([intent, patterns]) => {
      let intentScore = 0;
      patterns.forEach(pattern => {
        const regex = this.patternCache.get(pattern);
        if (regex?.test(query)) {
          intentScore += 1;
        }
      });
      scores.set(intent, intentScore);
      if (intentScore > maxScore) {
        maxScore = intentScore;
        primaryIntent = intent as QueryIntent['primary'];
      }
    });

    // Identify secondary intents
    const secondary = Array.from(scores.entries())
      .filter(([intent, score]) => score > 0 && intent !== primaryIntent)
      .map(([intent]) => intent);

    return {
      primary: primaryIntent,
      secondary,
      confidence: maxScore / (Object.keys(QUERY_PATTERNS).length * 2)
    };
  }

  private calculateLayerRelevance(
    query: string,
    layers: LayerConfig[],
    intent: QueryIntent
  ): Map<string, number> {
    const scores = new Map<string, number>();

    layers.forEach(layer => {
      let score = 0;

      // Check layer name and description match
      const searchText = `${layer.name} ${(layer as any).metadata?.description || ''}`.toLowerCase();
      const queryTerms = query.toLowerCase().split(' ');

      // Score based on term matches
      queryTerms.forEach(term => {
        if (searchText.includes(term)) {
          score += 0.5;
        }
      });

      // Score based on intent compatibility
      if (this.isLayerCompatibleWithIntent(layer, intent)) {
        score += 1;
      }

      // Score based on field availability
      const requiredFields = this.getRequiredFieldsForIntent(intent);
      const availableFields = layer.fields.map((f: any) => f.name.toLowerCase());
      requiredFields.forEach(field => {
        if (availableFields.some((f: any) => f.includes(field))) {
          score += 0.5;
        }
      });

      scores.set(layer.id, Math.min(score, 1));
    });

    return scores;
  }

  private isLayerCompatibleWithIntent(layer: LayerConfig, intent: QueryIntent): boolean {
    switch (intent.primary) {
      case 'distribution':
        return layer.type === 'percentage' as LayerType || layer.type === 'index' as LayerType;
      case 'hotspot':
        return layer.type === 'point' as LayerType;
      case 'correlation':
        return layer.fields.some((f: any) => ['small-integer', 'integer', 'single', 'double', 'long', 'big-integer'].includes(f.type));
      case 'trend':
        return layer.fields.some((f: any) => f.type === 'date');
      default:
        return true;
    }
  }

  private getRequiredFieldsForIntent(intent: QueryIntent): string[] {
    switch (intent.primary) {
      case 'distribution':
        return ['value', 'count', 'total', 'index'];
      case 'correlation':
        return ['value', 'rate', 'index', 'score'];
      case 'trend':
        return ['date', 'time', 'year', 'value'];
      case 'hotspot':
        return ['location', 'value', 'count'];
      default:
        return [];
    }
  }

  private determineSuggestedFields(
    query: string,
    layers: LayerConfig[],
    intent: QueryIntent
  ): string[] {
    const suggestedFields = new Set<string>();
    const requiredTypes = this.getRequiredFieldTypes(intent);

    layers.forEach(layer => {
      layer.fields.forEach((field: any) => {
        // Check if field type matches requirements
        if (requiredTypes.includes(field.type)) {
          // Check if field name is relevant to query
          if (this.isFieldRelevantToQuery(field.name, query)) {
            suggestedFields.add(field.name);
          }
        }
      });
    });

    return Array.from(suggestedFields);
  }

  private getRequiredFieldTypes(intent: QueryIntent): string[] {
    switch (intent.primary) {
      case 'distribution':
      case 'correlation':
        return ['number', 'integer'];
      case 'trend':
        return ['date', 'number'];
      case 'hotspot':
        return ['number', 'string'];
      default:
        return ['string', 'number'];
    }
  }

  private isFieldRelevantToQuery(fieldName: string, query: string): boolean {
    const fieldTerms = fieldName.toLowerCase().split('_');
    const queryTerms = query.toLowerCase().split(' ');
    
    return fieldTerms.some(term => 
      queryTerms.some(queryTerm => 
        term.includes(queryTerm) || queryTerm.includes(term)
      )
    );
  }

  private identifyDataRequirements(
    intent: QueryIntent,
    layers: LayerConfig[]
  ): DataRequirement[] {
    const requirements: DataRequirement[] = [];

    switch (intent.primary) {
      case 'distribution':
        requirements.push(
          { type: 'numeric', priority: 1, description: 'Numeric values for distribution analysis' },
          { type: 'spatial', priority: 1, description: 'Spatial boundaries for area coverage' }
        );
        break;
      case 'correlation':
        requirements.push(
          { type: 'numeric', priority: 1, description: 'Primary numeric variable' },
          { type: 'numeric', priority: 1, description: 'Secondary numeric variable' }
        );
        break;
      case 'trend':
        requirements.push(
          { type: 'temporal', priority: 1, description: 'Time series data' },
          { type: 'numeric', priority: 1, description: 'Measurable values' }
        );
        break;
      case 'hotspot':
        requirements.push(
          { type: 'spatial', priority: 1, description: 'Point or polygon locations' },
          { type: 'numeric', priority: 2, description: 'Intensity values' }
        );
        break;
    }

    return requirements;
  }
} 