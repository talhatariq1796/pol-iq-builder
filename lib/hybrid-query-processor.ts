import { VisualizationType } from '../reference/dynamic-layers';
import { classifyQuery, enhanceAnalysisWithVisualization } from './query-classifier';
import { scoreQueryComplexity, ComplexityScoreResult } from './query-complexity-scorer';
import { MLServiceClient, PredictionParams, MLServiceResponse } from './ml-service-client';

// Define AnalysisResult interface
interface AnalysisResult {
  intent: string;
  relevantLayers: string[];
  queryType: string;
  confidence: number;
  explanation: string;
  originalQuery: string;
  visualizationType?: VisualizationType;
}

/**
 * Options for the hybrid query processor
 */
export interface HybridProcessorOptions {
  mlServiceConfig?: any;
  featureFlags?: {
    mlEnabled: boolean;
    useTelemetry: boolean;
    adaptiveThreshold: boolean;
  };
}

/**
 * Result of hybrid query processing
 */
export interface HybridQueryResult extends AnalysisResult {
  complexityScore?: ComplexityScoreResult;
  mlResults?: MLServiceResponse;
  processingPath: 'rule-based' | 'ml-based';
  processingTime: number;
  originalQuery: string;
}

/**
 * Telemetry data point
 */
interface TelemetryDataPoint {
  query: string;
  visualizationType: VisualizationType;
  complexityScore: number;
  processingPath: 'rule-based' | 'ml-based';
  processingTime: number;
  timestamp: number;
}

/**
 * Hybrid query processor that combines rule-based and ML-based approaches
 */
export class HybridQueryProcessor {
  private mlClient: MLServiceClient;
  private telemetryData: TelemetryDataPoint[] = [];
  private featureFlags: {
    mlEnabled: boolean;
    useTelemetry: boolean;
    adaptiveThreshold: boolean;
  };
  private complexityThreshold: number = 4; // Default threshold
  
  constructor(options: HybridProcessorOptions = {}) {
    this.mlClient = new MLServiceClient(options.mlServiceConfig);
    this.featureFlags = {
      mlEnabled: true,
      useTelemetry: true,
      adaptiveThreshold: false,
      ...options.featureFlags
    };
  }
  
  /**
   * Process a user query using the hybrid approach
   */
  async processQuery(query: string): Promise<HybridQueryResult> {
    const startTime = Date.now();
    
    // Step 1: Classify the query to determine visualization type
    const analysisResult = await classifyQuery(query);
    const visualizationType = analysisResult.visualizationType || VisualizationType.CHOROPLETH;
    
    // Step 2: Score query complexity to determine processing path
    const complexityScore = scoreQueryComplexity(query, visualizationType);
    
    // Determine if we should use ML-based processing
    const useML = this.shouldUseMLProcessing(complexityScore);
    const processingPath = useML ? 'ml-based' : 'rule-based';
    
    // Step 3: Process the query using the appropriate path
    let result: HybridQueryResult;
    
    if (useML && this.featureFlags.mlEnabled) {
      // Process using ML-based approach
      result = await this.processWithML(query, visualizationType, complexityScore);
    } else {
      // Process using traditional rule-based approach
      result = await this.processWithRules(query, visualizationType, complexityScore);
    }
    
    const processingTime = Date.now() - startTime;
    result.processingTime = processingTime;
    
    // Collect telemetry if enabled
    if (this.featureFlags.useTelemetry) {
      this.collectTelemetry({
        query,
        visualizationType,
        complexityScore: complexityScore.score,
        processingPath,
        processingTime,
        timestamp: Date.now()
      });
      
      // Adjust complexity threshold if adaptive threshold is enabled
      if (this.featureFlags.adaptiveThreshold) {
        this.adjustComplexityThreshold();
      }
    }
    
    return result;
  }
  
  /**
   * Determine if ML processing should be used based on complexity score
   */
  private shouldUseMLProcessing(complexity: ComplexityScoreResult): boolean {
    // Always use ML for predictive queries
    if (complexity.queryType === 'predictive') {
      return true;
    }
    
    // Use ML if score exceeds threshold or override is true
    return complexity.score > this.complexityThreshold || complexity.requiresML;
  }
  
  /**
   * Process a query using the ML-based approach
   */
  private async processWithML(
    query: string,
    visualizationType: VisualizationType,
    complexityScore: ComplexityScoreResult
  ): Promise<HybridQueryResult> {
    try {
      // Create a basic analysis result
      const analysisResult = {
        intent: 'visualization',
        relevantLayers: [],
        queryType: complexityScore.queryType,
        confidence: 0.8,
        explanation: '',
        originalQuery: query,
        visualizationType
      } as AnalysisResult;
      
      // Prepare ML service parameters
      const params: PredictionParams = {
        query,
        visualizationType,
        // Additional parameters would be added here in a real implementation
      };
      
      // Call ML service
      const mlResults = await this.mlClient.predict(params);
      
      // Enhance analysis result with ML insights
      const enhancedResult: HybridQueryResult = {
        ...analysisResult,
        complexityScore,
        mlResults,
        processingPath: 'ml-based',
        processingTime: 0, // Will be updated by the caller
        // Additional ML-specific enhancements would be added here
      };
      
      return enhancedResult;
    } catch (error) {
      console.error('ML processing failed:', error);
      
      // Fallback to rule-based processing
      return this.processWithRules(query, visualizationType, complexityScore);
    }
  }
  
  /**
   * Process a query using the traditional rule-based approach
   */
  private async processWithRules(
    query: string,
    visualizationType: VisualizationType,
    complexityScore: ComplexityScoreResult
  ): Promise<HybridQueryResult> {
    // Create a basic analysis result
    const baseAnalysisResult: AnalysisResult = {
      intent: 'visualization',
      relevantLayers: [],
      queryType: 'visualization',
      confidence: 0.7,
      explanation: '',
      originalQuery: query,
      visualizationType
    };
    
    // Enhance with visualization type
    const enhancedResult = await enhanceAnalysisWithVisualization(baseAnalysisResult);
    
    // Add hybrid-specific properties
    const hybridResult: HybridQueryResult = {
      ...enhancedResult,
      complexityScore,
      processingPath: 'rule-based',
      processingTime: 0, // Will be updated by the caller
      originalQuery: query // Ensure originalQuery is set
    };
    
    return hybridResult;
  }
  
  /**
   * Collect telemetry data for analysis and threshold adjustment
   */
  private collectTelemetry(dataPoint: TelemetryDataPoint): void {
    this.telemetryData.push(dataPoint);
    
    // Limit telemetry data size to prevent memory issues
    if (this.telemetryData.length > 1000) {
      this.telemetryData.shift();
    }
  }
  
  /**
   * Adjust complexity threshold based on telemetry data
   */
  private adjustComplexityThreshold(): void {
    // Only adjust if we have enough data points
    if (this.telemetryData.length < 50) {
      return;
    }
    
    // Get recent data (last 50 queries)
    const recentData = this.telemetryData.slice(-50);
    
    // Calculate average processing time for each path
    const mlQueries = recentData.filter(d => d.processingPath === 'ml-based');
    const ruleQueries = recentData.filter(d => d.processingPath === 'rule-based');
    
    const avgMLTime = mlQueries.reduce((sum, d) => sum + d.processingTime, 0) / 
                     (mlQueries.length || 1);
    const avgRuleTime = ruleQueries.reduce((sum, d) => sum + d.processingTime, 0) / 
                       (ruleQueries.length || 1);
    
    // Calculate optimal threshold based on processing time ratio
    const timeRatio = avgMLTime / avgRuleTime;
    
    // If ML is taking too long compared to rule-based, increase threshold
    if (timeRatio > 5 && this.complexityThreshold < 7) {
      this.complexityThreshold += 0.5;
    } 
    // If ML is reasonably fast, decrease threshold to use ML more often
    else if (timeRatio < 3 && this.complexityThreshold > 2) {
      this.complexityThreshold -= 0.5;
    }
  }
  
  /**
   * Get telemetry data for analysis
   */
  getTelemetryData(): TelemetryDataPoint[] {
    return [...this.telemetryData];
  }
  
  /**
   * Clear cached data
   */
  clearCache(): void {
    this.mlClient.clearCache();
  }
} 