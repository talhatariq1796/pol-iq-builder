import { LayerConfig as BaseLayerConfig } from '@/types/layers';
import { VisualizationType } from '@/types/visualization-learning';

interface QueryOptimization {
  originalQuery: string;
  optimizedQuery: string;
  confidence: number;
  reasoning?: string;
}

interface AnalysisContext {
  availableLayers: BaseLayerConfig[];
  userHistory?: string[];
  visualizationType?: VisualizationType;
}

export async function enhanceQueryWithAI(
  prompt: string,
  context: AnalysisContext
): Promise<QueryOptimization> {
  try {
    const response = await fetch('/api/enhance-query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, context }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to enhance query');
    }

    const data = await response.json();
    return {
      originalQuery: prompt,
      optimizedQuery: data.analysis.summary, // Assuming summary is the optimized query
      confidence: data.analysis.confidence,
      reasoning: data.analysis.reasoning,
    };
  } catch (error) {
    console.error('Error enhancing query with AI:', error);
    // Fallback to original query on error
    return {
      originalQuery: prompt,
      optimizedQuery: prompt,
      confidence: 0,
      reasoning: 'AI enhancement failed, using original query.',
    };
  }
}

interface SmartLayerSelection {
  primaryLayer: string;
  relatedLayers: string[];
  confidence: number;
  reasoning: string;
  suggestedJoins?: {
    sourceField: string;
    targetLayer: string;
    targetField: string;
  }[];
}

interface QueryResultsEnhancement {
  suggestedVisualizations: VisualizationType[];
  relatedDataLayers: string[];
  filterSuggestions: {
    field: string;
    operator: string;
    value: any;
    confidence: number;
  }[];
  insightSummary: string;
}

interface QueryOptimizationMetrics {
  executionTime: number;
  resultCount: number;
  cacheHitRate: number;
  optimizationGain: number;
}

interface OptimizationHistory {
  originalQuery: string;
  optimizedQuery: string;
  metrics: QueryOptimizationMetrics;
  timestamp: number;
}

interface LayerUsagePattern {
  frequency: number;
  averagePerformance: number;
  commonJoins: string[];
  lastOptimizations: OptimizationHistory[];
}

interface LayerPerformanceConfig {
  indexes?: string[];
  // Add other performance-related fields as needed
}

// Define the complete layer configuration type
type LayerConfig = BaseLayerConfig & {
  id: string;
  name: string;
  description?: string;
  fields: any[];
  performance?: LayerPerformanceConfig;
};

export class AIQueryEnhancementService {
  private queryHistory: Map<string, OptimizationHistory[]>;
  private layerUsagePatterns: Map<string, LayerUsagePattern>;
  private optimizationCache: Map<string, {
    optimization: QueryOptimization;
    timestamp: number;
    ttl: number;
  }>;
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  private readonly MAX_HISTORY_SIZE = 100;

  constructor() {
    this.queryHistory = new Map();
    this.layerUsagePatterns = new Map();
    this.optimizationCache = new Map();
    this.setupPeriodicCleanup();
  }

  private setupPeriodicCleanup(): void {
    setInterval(() => {
      this.cleanupCache();
      this.pruneHistory();
    }, 15 * 60 * 1000); // Run every 15 minutes
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.optimizationCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.optimizationCache.delete(key);
      }
    }
  }

  private pruneHistory(): void {
    for (const [layerId, history] of this.queryHistory.entries()) {
      if (history.length > this.MAX_HISTORY_SIZE) {
        // Keep most recent entries
        this.queryHistory.set(layerId, history.slice(-this.MAX_HISTORY_SIZE));
      }
    }
  }

  private generateOptimizationKey(query: string, layerId: string): string {
    return `${layerId}_${this.hashString(query)}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  async optimizeQuery(
    query: string,
    layerConfig: LayerConfig
  ): Promise<QueryOptimization> {
    const cacheKey = this.generateOptimizationKey(query, layerConfig.id);
    const cachedResult = this.optimizationCache.get(cacheKey);

    if (cachedResult && Date.now() - cachedResult.timestamp < cachedResult.ttl) {
      return cachedResult.optimization;
    }

    const startTime = Date.now();
    const layerHistory = this.queryHistory.get(layerConfig.id) || [];
    const recentOptimizations = layerHistory
      .slice(-5)
      .map(h => ({
        original: h.originalQuery,
        optimized: h.optimizedQuery,
        gain: h.metrics.optimizationGain
      }));

    const analysisPrompt = `Analyze and optimize this ArcGIS SQL query:
Query: ${query}
Layer: ${layerConfig.name}
Fields: ${JSON.stringify(layerConfig.fields)}
Current indexes: ${JSON.stringify(layerConfig.performance?.indexes || [])}

Recent successful optimizations:
${JSON.stringify(recentOptimizations, null, 2)}

Consider:
1. Query structure and complexity
2. Field usage patterns
3. Available indexes
4. Historical performance data
5. Common access patterns

Return JSON with:
{
  "optimizedQuery": "optimized SQL query",
  "suggestedIndexes": ["field1", "field2"],
  "confidence": 0.95,
  "explanation": "Explanation of optimizations",
  "estimatedPerformanceGain": 0.3,
  "complexity": {
    "original": "O(n)",
    "optimized": "O(log n)"
  }
}`;

    const analysis = await enhanceQueryWithAI(analysisPrompt, {
      availableLayers: [layerConfig],
      userHistory: recentOptimizations.map(o => o.original),
      visualizationType: layerConfig.performance?.indexes?.length ? layerConfig.performance.indexes[0] as VisualizationType : undefined
    });

    // Cache the optimization result
    this.optimizationCache.set(cacheKey, {
      optimization: analysis,
      timestamp: Date.now(),
      ttl: this.CACHE_TTL
    });

    // Record optimization for learning
    this.recordQueryOptimization(layerConfig.id, query, analysis, {
      executionTime: Date.now() - startTime,
      resultCount: 0, // Will be updated after query execution
      cacheHitRate: 0,
      optimizationGain: analysis.confidence
    });

    return analysis;
  }

  private getLayerPerformanceStats(layerId: string): {
    averageGain: number;
    successRate: number;
    commonPatterns: string[];
  } {
    const history = this.queryHistory.get(layerId) || [];
    const pattern = this.layerUsagePatterns.get(layerId);

    if (history.length === 0) {
      return {
        averageGain: 0,
        successRate: 0,
        commonPatterns: []
      };
    }

    const gains = history.map(h => h.metrics.optimizationGain);
    const averageGain = gains.reduce((a, b) => a + b, 0) / gains.length;
    const successRate = pattern ? pattern.frequency / (pattern.frequency + 1) : 0;

    return {
      averageGain,
      successRate,
      commonPatterns: pattern?.commonJoins || []
    };
  }

  private recordQueryOptimization(
    layerId: string,
    originalQuery: string,
    optimization: QueryOptimization,
    metrics: QueryOptimizationMetrics
  ): void {
    if (!this.queryHistory.has(layerId)) {
      this.queryHistory.set(layerId, []);
    }

    const history = this.queryHistory.get(layerId)!;
    const newHistoryEntry: OptimizationHistory = {
      originalQuery,
      optimizedQuery: optimization.optimizedQuery,
      metrics,
      timestamp: Date.now()
    };
    
    history.push(newHistoryEntry);

    // Create a new pattern with all required fields
    const existingPattern = this.layerUsagePatterns.get(layerId);
    const newPattern: LayerUsagePattern = {
      frequency: (existingPattern?.frequency || 0) + 1,
      averagePerformance: existingPattern ? 
        ((existingPattern.averagePerformance * existingPattern.frequency + metrics.optimizationGain) / (existingPattern.frequency + 1)) :
        metrics.optimizationGain,
      commonJoins: existingPattern?.commonJoins || [],
      lastOptimizations: [
        ...(existingPattern?.lastOptimizations || []).slice(-4),
        newHistoryEntry
      ]
    };

    this.layerUsagePatterns.set(layerId, newPattern);
  }

  async selectSmartLayers(
    userQuery: string,
    availableLayers: Record<string, LayerConfig>
  ): Promise<SmartLayerSelection> {
    console.log('Selecting smart layers for query:', userQuery);

    const layerPatterns = Array.from(this.layerUsagePatterns.entries())
      .map(([layerId, patterns]) => ({
        layerId,
        ...patterns
      }));

    const analysisPrompt = `Select the most relevant layers for this query:
Query: ${userQuery}
Available layers: ${JSON.stringify(availableLayers, null, 2)}
Historical usage patterns: ${JSON.stringify(layerPatterns, null, 2)}

Consider:
1. Query intent and context
2. Layer relationships
3. Historical performance
4. Potential joins

Return JSON with:
{
  "primaryLayer": "layerId",
  "relatedLayers": ["layerId1", "layerId2"],
  "confidence": 0.95,
  "reasoning": "Explanation of selection",
  "suggestedJoins": [
    {
      "sourceField": "field1",
      "targetLayer": "layer2",
      "targetField": "field2"
    }
  ]
}`;

    const analysis = await enhanceQueryWithAI(analysisPrompt, {
      availableLayers: Object.values(availableLayers),
      userHistory: layerPatterns.map(p => p.layerId),
      visualizationType: undefined
    });

    // Parse and validate the layer selection
    const selection = JSON.parse(analysis.optimizedQuery);
    
    // Record the selection for learning
    this.recordLayerSelection(selection);

    return selection;
  }

  async enhanceQueryResults(
    results: any[],
    userQuery: string,
    layerConfig: LayerConfig
  ): Promise<QueryResultsEnhancement> {
    console.log('Enhancing query results:', {
      resultCount: results.length,
      query: userQuery
    });

    const analysisPrompt = `Analyze these query results and suggest enhancements:
Query: ${userQuery}
Layer: ${layerConfig.name}
Result sample: ${JSON.stringify(results.slice(0, 5), null, 2)}
Total results: ${results.length}

Suggest:
1. Appropriate visualizations
2. Related data layers
3. Relevant filters
4. Key insights

Return JSON with:
{
  "suggestedVisualizations": ["visualization types"],
  "relatedDataLayers": ["layer ids"],
  "filterSuggestions": [
    {
      "field": "fieldName",
      "operator": "operator",
      "value": "value",
      "confidence": 0.95
    }
  ],
  "insightSummary": "Summary of key insights"
}`;

    const analysis = await enhanceQueryWithAI(analysisPrompt, {
      availableLayers: [layerConfig],
      userHistory: results.map(r => JSON.stringify(r)),
      visualizationType: results.length > 0 ? results[0] as VisualizationType : undefined
    });

    // Parse and validate the enhancement suggestions
    const enhancements = JSON.parse(analysis.optimizedQuery);
    
    // Record the enhancements for learning
    this.recordResultEnhancements(layerConfig.id, enhancements);

    return enhancements;
  }

  private recordLayerSelection(selection: SmartLayerSelection): void {
    const { primaryLayer, relatedLayers } = selection;
    
    // Update usage patterns for primary layer
    this.updateLayerUsagePattern(primaryLayer);
    
    // Update patterns for related layers
    relatedLayers.forEach(layerId => {
      this.updateLayerUsagePattern(layerId);
    });
  }

  private recordResultEnhancements(
    layerId: string,
    enhancements: QueryResultsEnhancement
  ): void {
    // Update layer usage patterns with visualization preferences
    const pattern = this.layerUsagePatterns.get(layerId) || {
      frequency: 0,
      averagePerformance: 0,
      commonJoins: [],
      lastOptimizations: []
    };

    pattern.frequency++;
    this.layerUsagePatterns.set(layerId, pattern);
  }

  private updateLayerUsagePattern(layerId: string): void {
    const pattern = this.layerUsagePatterns.get(layerId) || {
      frequency: 0,
      averagePerformance: 0,
      commonJoins: [],
      lastOptimizations: []
    };

    pattern.frequency++;
    this.layerUsagePatterns.set(layerId, pattern);
  }
} 