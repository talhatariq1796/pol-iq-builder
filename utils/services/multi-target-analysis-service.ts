/**
 * Multi-Target Analysis Service
 * 
 * Provides intelligent routing between single-target and multi-target microservice endpoints
 * for real estate data analysis with automatic fallback capabilities.
 * 
 * This service provides:
 * - Smart endpoint selection (single vs multi-target)
 * - Native multi-target analysis via /analyze-multi-target endpoint
 * - Fallback to parallel single-target calls when needed
 * - Result merging and correlation analysis
 * - Backward compatibility adapters
 * - Real estate specific target variable handling
 */

import { 
  AnalysisResult, 
  ProcessedAnalysisData,
  AnalysisStatistics,
  FeatureImportance,
  MultiTargetAnalysisData,
  TargetVariableAnalysis,
  TargetCorrelationMatrix,
  MultiTargetSummary,
  TargetVariableType,
  GeographicDataPoint 
} from '@/lib/analysis/types';

import { 
  MicroserviceResponse, 
  ShapAsyncAnalyzeJobResult,
  MultiTargetPredictionResponse,
  isValidMicroserviceResponse 
} from '@/types/microservice-types';

// ============================================================================
// INTERFACES AND TYPES
// ============================================================================

export interface MultiTargetAnalysisRequest {
  targetVariables: string[];
  primaryTarget: string;
  baseRequest: MicroserviceAnalysisRequest;
  analysisOptions?: {
    enableCorrelations?: boolean;
    parallelProcessing?: boolean;
    confidenceThreshold?: number;
  };
}

export interface MicroserviceAnalysisRequest {
  analysis_type: string;
  target_variable: string;
  query: string;
  matched_fields: string[];
  demographic_filters?: string[];
  conversationContext?: string;
}

export interface MultiTargetMicroserviceRequest {
  analysis_type: string;
  target_variables: string[];
  primary_target: string;
  query: string;
  matched_fields: string[];
  demographic_filters?: string[];
  conversationContext?: string;
}

export interface MultiTargetMicroserviceResponse {
  primary_target: string;
  target_results: Record<string, SingleTargetResult>;
  combined_results: CombinedResult[];
  multi_target_summary: string;
  cross_target_correlations?: CrossTargetCorrelation[];
  processing_metadata: {
    total_processing_time: number;
    individual_call_times: Record<string, number>;
    parallel_execution: boolean;
    success_rate: number;
  };
}

export interface SingleTargetResult {
  feature_importance: FeatureImportance[];
  statistics: AnalysisStatistics;
  results: any[];
  processing_time: number;
  success: boolean;
  error?: string;
}

export interface CombinedResult {
  area_id: string;
  area_name: string;
  values: Record<string, number>;
  combined_shap_values?: Record<string, number>;
  coordinates?: [number, number];
  properties?: Record<string, any>;
}

export interface CrossTargetCorrelation {
  target1: string;
  target2: string;
  coefficient: number;
  significance: number;
  strength: 'weak' | 'moderate' | 'strong';
}

// Real Estate Target Variable Definitions
export const REAL_ESTATE_TARGETS: Record<string, TargetVariableConfig> = {
  time_on_market: {
    field_code: 'TIME_ON_MARKET_AVG',
    display_name: 'Average Time on Market',
    unit: 'days',
    description: 'Average days properties stay on market before selling',
    data_type: 'numeric',
    calculation_method: 'average',
    type: 'time_on_market'
  },
  avg_sold_price: {
    field_code: 'SOLD_PRICE_AVG',
    display_name: 'Average Sold Price',
    unit: 'CAD',
    description: 'Mean price of recently sold properties',
    data_type: 'currency',
    calculation_method: 'average',
    type: 'avg_sold_price'
  },
  avg_rent_price: {
    field_code: 'RENT_PRICE_AVG',
    display_name: 'Average Rent Price',
    unit: 'CAD/month',
    description: 'Mean monthly rental price for similar properties',
    data_type: 'currency',
    calculation_method: 'average',
    type: 'avg_rent_price'
  },
  price_delta: {
    field_code: 'PRICE_DELTA_AVG',
    display_name: 'Asking vs Sold Price Delta',
    unit: '%',
    description: 'Percentage difference between asking and sold prices',
    data_type: 'percentage',
    calculation_method: 'percentage_change',
    type: 'price_delta'
  },
  market_velocity: {
    field_code: 'MARKET_VELOCITY_AVG',
    display_name: 'Market Velocity',
    unit: 'sales/month',
    description: 'Rate of property sales activity in the area',
    data_type: 'numeric',
    calculation_method: 'average',
    type: 'market_velocity'
  },
  appreciation_rate: {
    field_code: 'APPRECIATION_RATE_AVG',
    display_name: 'Property Appreciation Rate',
    unit: '%/year',
    description: 'Annual property value appreciation rate',
    data_type: 'percentage',
    calculation_method: 'percentage_change',
    type: 'appreciation_rate'
  },
  inventory_levels: {
    field_code: 'INVENTORY_LEVELS_AVG',
    display_name: 'Inventory Levels',
    unit: 'units',
    description: 'Available property inventory in the area',
    data_type: 'numeric',
    calculation_method: 'count',
    type: 'inventory_levels'
  }
};

export interface TargetVariableConfig {
  field_code: string;
  display_name: string;
  unit: string;
  description: string;
  data_type: 'numeric' | 'currency' | 'percentage';
  calculation_method: 'average' | 'median' | 'sum' | 'count' | 'percentage_change';
  type: TargetVariableType;
}

// ============================================================================
// MULTI-TARGET ANALYSIS SERVICE
// ============================================================================

export class MultiTargetAnalysisService {
  private apiUrl: string;
  private apiKey?: string;
  private defaultTimeout: number = 30000;

  constructor(apiUrl: string, apiKey?: string) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
  }

  /**
   * Get the appropriate endpoint URL for multi-target analysis
   */
  private getMultiTargetUrl(): string {
    // If the URL already ends with '/analyze', replace with '/analyze-multi-target'
    if (this.apiUrl.endsWith('/analyze')) {
      return this.apiUrl.replace('/analyze', '/analyze-multi-target');
    }
    
    // If it's a base URL, append the multi-target endpoint
    const baseUrl = this.apiUrl.endsWith('/') ? this.apiUrl.slice(0, -1) : this.apiUrl;
    return `${baseUrl}/analyze-multi-target`;
  }

  /**
   * Main analysis method that automatically chooses between single and multi-target endpoints
   */
  async analyze(
    request: MultiTargetAnalysisRequest
  ): Promise<MultiTargetMicroserviceResponse> {
    return this.analyzeMultipleTargets(request);
  }

  /**
   * Convenience method for single target analysis (backward compatibility)
   */
  async analyzeSingleTarget(
    request: MicroserviceAnalysisRequest
  ): Promise<MicroserviceResponse> {
    const singleResult = await this.callSingleTarget(request);
    return singleResult;
  }

  /**
   * Analyze multiple target variables using the appropriate endpoint
   */
  async analyzeMultipleTargets(
    request: MultiTargetAnalysisRequest
  ): Promise<MultiTargetMicroserviceResponse> {
    const startTime = Date.now();
    
    try {
      // Validate request
      this.validateMultiTargetRequest(request);

      // Single target optimization - use /analyze endpoint
      if (request.targetVariables.length === 1) {
        const singleResult = await this.callSingleTarget({
          ...request.baseRequest,
          target_variable: request.targetVariables[0]
        });
        
        return this.adaptSingleToMulti(singleResult, request.targetVariables[0]);
      }

      // Multi-target processing - use /analyze-multi-target endpoint
      const multiTargetResult = await this.callMultiTarget({
        analysis_type: request.baseRequest.analysis_type,
        query: request.baseRequest.query,
        matched_fields: request.baseRequest.matched_fields,
        demographic_filters: request.baseRequest.demographic_filters,
        conversationContext: request.baseRequest.conversationContext,
        target_variables: request.targetVariables,
        primary_target: request.primaryTarget
      });

      const totalProcessingTime = Date.now() - startTime;

      // Return the multi-target result with processing metadata
      return {
        ...multiTargetResult,
        processing_metadata: {
          ...multiTargetResult.processing_metadata,
          total_processing_time: totalProcessingTime
        }
      };

    } catch (error) {
      // Fallback to parallel single-target calls if multi-target endpoint fails
      console.warn('Multi-target endpoint failed, falling back to parallel single-target calls:', error);
      
      const individualCallTimes: Record<string, number> = {};
      const targetPromises = request.targetVariables.map(async (target) => {
        const targetStartTime = Date.now();
        
        try {
          const result = await this.callSingleTarget({
            ...request.baseRequest,
            target_variable: target
          });
          
          const processingTime = Date.now() - targetStartTime;
          individualCallTimes[target] = processingTime;
          
          return {
            target,
            result,
            success: true,
            processingTime
          };
        } catch (error) {
          const processingTime = Date.now() - targetStartTime;
          individualCallTimes[target] = processingTime;
          
          return {
            target,
            result: null,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            processingTime
          };
        }
      });

      const results = await Promise.all(targetPromises);
      const totalProcessingTime = Date.now() - startTime;
      
      // Calculate success rate
      const successfulResults = results.filter(r => r.success);
      const successRate = successfulResults.length / results.length;

      // Merge results
      return this.mergeResults(
        results,
        request.targetVariables,
        request.primaryTarget,
        {
          total_processing_time: totalProcessingTime,
          individual_call_times: individualCallTimes,
          parallel_execution: true,
          success_rate: successRate
        },
        request.analysisOptions?.enableCorrelations ?? true
      );
    }
  }

  /**
   * Merge results from multiple target variable analyses
   */
  mergeResults(
    results: Array<{
      target: string;
      result: MicroserviceResponse | null;
      success: boolean;
      error?: string;
      processingTime: number;
    }>,
    targetVariables: string[],
    primaryTarget: string,
    processingMetadata: MultiTargetMicroserviceResponse['processing_metadata'],
    enableCorrelations: boolean = true
  ): MultiTargetMicroserviceResponse {
    
    const targetResults: Record<string, SingleTargetResult> = {};
    const successfulResults = results.filter(r => r.success && r.result);

    // Process individual target results
    results.forEach(({ target, result, success, error, processingTime }) => {
      if (success && result) {
        targetResults[target] = {
          feature_importance: (result as any).feature_importance || [],
          statistics: this.calculateStatistics((result as any).results, target),
          results: (result as any).results || [],
          processing_time: processingTime,
          success: true
        };
      } else {
        targetResults[target] = {
          feature_importance: [],
          statistics: this.getEmptyStatistics(),
          results: [],
          processing_time: processingTime,
          success: false,
          error: error || 'Unknown error'
        };
      }
    });

    // Combine results by area - filter and map to expected type
    const filteredSuccessfulResults = successfulResults
      .filter((r): r is { target: string; result: MicroserviceResponse; success: true; processingTime: number } => 
        r.success && r.result !== null)
      .map(r => ({
        target: r.target,
        result: r.result!,
        success: r.success,
        processingTime: r.processingTime
      }));
    
    const combinedResults = this.combineResultsByArea(filteredSuccessfulResults, targetVariables);

    // Calculate cross-target correlations
    const crossTargetCorrelations = enableCorrelations 
      ? this.calculateCrossTargetCorrelations(combinedResults, targetVariables)
      : undefined;

    // Generate multi-target summary
    const multiTargetSummary = this.generateMultiTargetSummary(
      targetResults,
      targetVariables,
      primaryTarget,
      crossTargetCorrelations
    );

    return {
      primary_target: primaryTarget,
      target_results: targetResults,
      combined_results: combinedResults,
      multi_target_summary: multiTargetSummary,
      cross_target_correlations: crossTargetCorrelations,
      processing_metadata: processingMetadata
    };
  }

  /**
   * Backward compatibility: Adapt single target result to multi-target format
   */
  adaptSingleToMulti(
    singleResult: MicroserviceResponse,
    targetVariable: string
  ): MultiTargetMicroserviceResponse {
    const statistics = this.calculateStatistics((singleResult as any).results, targetVariable);
    
    const targetResults: Record<string, SingleTargetResult> = {
      [targetVariable]: {
        feature_importance: (singleResult as any).feature_importance || [],
        statistics,
        results: (singleResult as any).results || [],
        processing_time: 0, // Not available from single result
        success: true
      }
    };

    const combinedResults: CombinedResult[] = ((singleResult as any).results || []).map((result: any) => ({
      area_id: result.area_id || '',
      area_name: result.area_name || '',
      values: { [targetVariable]: result[targetVariable] || result.value || 0 },
      combined_shap_values: result.shap_values || {},
      coordinates: result.coordinates,
      properties: result.properties || {}
    }));

    return {
      primary_target: targetVariable,
      target_results: targetResults,
      combined_results: combinedResults,
      multi_target_summary: (singleResult as any).summary || '',
      processing_metadata: {
        total_processing_time: 0,
        individual_call_times: { [targetVariable]: 0 },
        parallel_execution: false,
        success_rate: 1.0
      }
    };
  }

  /**
   * Backward compatibility: Adapt multi-target result to single target format
   */
  adaptMultiToSingle(
    multiResult: MultiTargetMicroserviceResponse
  ): MicroserviceResponse {
    const primaryResult = multiResult.target_results[multiResult.primary_target];
    
    if (!primaryResult || !primaryResult.success) {
      throw new Error(`Primary target '${multiResult.primary_target}' not found or failed`);
    }

    return {
      predictions: [], // Not available in current structure
      explanations: {
        shap_values: [],
        feature_names: (primaryResult.feature_importance as any[]).map(fi => fi.feature),
        base_value: 0
      },
      processing_time: primaryResult.processing_time,
      model_version: '1.0.0',
      model_type: 'multi_target_wrapper',
      cached: false,
      // Add extra properties via type assertion
      ...({
        feature_importance: primaryResult.feature_importance as any,
        summary: multiResult.multi_target_summary,
        results: (primaryResult.results as any[]).map(result => ({
          ...result,
          [multiResult.primary_target]: result[multiResult.primary_target] || result.value
        }))
      } as any)
    };
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private async callSingleTarget(request: MicroserviceAnalysisRequest): Promise<MicroserviceResponse> {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(this.defaultTimeout)
    });

    if (!response.ok) {
      throw new Error(`Microservice call failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!isValidMicroserviceResponse(result)) {
      throw new Error('Invalid microservice response format');
    }

    return result;
  }

  private async callMultiTarget(request: MultiTargetMicroserviceRequest): Promise<MultiTargetMicroserviceResponse> {
    // Use the multi-target endpoint
    const multiTargetUrl = this.getMultiTargetUrl();
    
    const response = await fetch(multiTargetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(this.defaultTimeout * 2) // Longer timeout for multi-target
    });

    if (!response.ok) {
      throw new Error(`Multi-target microservice call failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!this.isValidMultiTargetResponse(result)) {
      throw new Error('Invalid multi-target microservice response format');
    }

    return result;
  }

  private validateMultiTargetRequest(request: MultiTargetAnalysisRequest): void {
    if (!request.targetVariables || request.targetVariables.length === 0) {
      throw new Error('At least one target variable must be specified');
    }

    if (!request.primaryTarget) {
      throw new Error('Primary target must be specified');
    }

    if (!request.targetVariables.includes(request.primaryTarget)) {
      throw new Error('Primary target must be included in target variables list');
    }

    if (!request.baseRequest) {
      throw new Error('Base request configuration is required');
    }
  }

  private isValidMultiTargetResponse(response: any): response is MultiTargetMicroserviceResponse {
    return (
      response &&
      typeof response === 'object' &&
      typeof response.primary_target === 'string' &&
      response.target_results &&
      typeof response.target_results === 'object' &&
      Array.isArray(response.combined_results) &&
      typeof response.multi_target_summary === 'string' &&
      response.processing_metadata &&
      typeof response.processing_metadata.total_processing_time === 'number' &&
      typeof response.processing_metadata.success_rate === 'number'
    );
  }

  private calculateStatistics(results: any[], targetVariable: string): AnalysisStatistics {
    if (!results || results.length === 0) {
      return this.getEmptyStatistics();
    }

    const values = results
      .map(r => r[targetVariable] || r.value || 0)
      .filter(v => typeof v === 'number' && !isNaN(v));

    if (values.length === 0) {
      return this.getEmptyStatistics();
    }

    const sorted = [...values].sort((a, b) => a - b);
    const total = values.length;
    const sum = values.reduce((acc, val) => acc + val, 0);
    const mean = sum / total;
    
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / total;
    const stdDev = Math.sqrt(variance);
    
    const median = total % 2 === 0 
      ? (sorted[total / 2 - 1] + sorted[total / 2]) / 2
      : sorted[Math.floor(total / 2)];

    const q1Index = Math.floor(total * 0.25);
    const q3Index = Math.floor(total * 0.75);

    return {
      total,
      mean,
      median,
      min: Math.min(...values),
      max: Math.max(...values),
      stdDev,
      percentile25: sorted[q1Index],
      percentile75: sorted[q3Index],
      iqr: sorted[q3Index] - sorted[q1Index]
    };
  }

  private getEmptyStatistics(): AnalysisStatistics {
    return {
      total: 0,
      mean: 0,
      median: 0,
      min: 0,
      max: 0,
      stdDev: 0
    };
  }

  private combineResultsByArea(
    successfulResults: Array<{
      target: string;
      result: MicroserviceResponse;
      success: boolean;
      processingTime: number;
    }>,
    targetVariables: string[]
  ): CombinedResult[] {
    if (successfulResults.length === 0) {
      return [];
    }

    // Create a map of area_id to combined data
    const areaMap = new Map<string, CombinedResult>();

    // Process each successful result
    successfulResults.forEach(({ target, result }) => {
      if (!(result as any).results) return;

      (result as any).results.forEach((areaResult: any) => {
        const areaId = areaResult.area_id || areaResult.id || '';
        
        if (!areaMap.has(areaId)) {
          areaMap.set(areaId, {
            area_id: areaId,
            area_name: areaResult.area_name || areaResult.name || areaId,
            values: {},
            combined_shap_values: {},
            coordinates: areaResult.coordinates,
            properties: areaResult.properties || {}
          });
        }

        const combinedResult = areaMap.get(areaId)!;
        
        // Add target value
        combinedResult.values[target] = areaResult[target] || areaResult.value || 0;
        
        // Combine SHAP values
        if (areaResult.shap_values) {
          Object.entries(areaResult.shap_values).forEach(([feature, value]) => {
            const shapKey = `${target}_${feature}`;
            combinedResult.combined_shap_values![shapKey] = value as number;
          });
        }
      });
    });

    return Array.from(areaMap.values());
  }

  private calculateCrossTargetCorrelations(
    combinedResults: CombinedResult[],
    targetVariables: string[]
  ): CrossTargetCorrelation[] {
    const correlations: CrossTargetCorrelation[] = [];

    // Calculate correlations between all pairs of target variables
    for (let i = 0; i < targetVariables.length; i++) {
      for (let j = i + 1; j < targetVariables.length; j++) {
        const target1 = targetVariables[i];
        const target2 = targetVariables[j];

        const values1: number[] = [];
        const values2: number[] = [];

        combinedResults.forEach(result => {
          const val1 = result.values[target1];
          const val2 = result.values[target2];

          if (typeof val1 === 'number' && typeof val2 === 'number' && 
              !isNaN(val1) && !isNaN(val2)) {
            values1.push(val1);
            values2.push(val2);
          }
        });

        if (values1.length > 2) {
          const correlation = this.calculatePearsonCorrelation(values1, values2);
          const significance = this.calculateSignificance(correlation, values1.length);
          
          correlations.push({
            target1,
            target2,
            coefficient: correlation,
            significance,
            strength: this.getCorrelationStrength(Math.abs(correlation))
          });
        }
      }
    }

    return correlations;
  }

  private calculatePearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    if (n !== y.length || n === 0) return 0;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateSignificance(correlation: number, sampleSize: number): number {
    if (sampleSize <= 2) return 1;
    
    const t = Math.abs(correlation) * Math.sqrt((sampleSize - 2) / (1 - correlation * correlation));
    // Simplified p-value approximation
    return Math.max(0, Math.min(1, 2 * (1 - this.normalCDF(t))));
  }

  private normalCDF(x: number): number {
    // Simplified normal CDF approximation
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  private erf(x: number): number {
    // Simplified error function approximation
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);

    const t = 1 / (1 + p * x);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  private getCorrelationStrength(absCorrelation: number): 'weak' | 'moderate' | 'strong' {
    if (absCorrelation >= 0.7) return 'strong';
    if (absCorrelation >= 0.3) return 'moderate';
    return 'weak';
  }

  private generateMultiTargetSummary(
    targetResults: Record<string, SingleTargetResult>,
    targetVariables: string[],
    primaryTarget: string,
    crossTargetCorrelations?: CrossTargetCorrelation[]
  ): string {
    const successfulTargets = targetVariables.filter(target => 
      targetResults[target] && targetResults[target].success
    );

    if (successfulTargets.length === 0) {
      return 'Multi-target analysis failed for all target variables.';
    }

    const parts: string[] = [];
    
    // Main summary
    parts.push(`Multi-target real estate analysis completed for ${successfulTargets.length} of ${targetVariables.length} target variables.`);
    
    // Primary target insight
    const primaryResult = targetResults[primaryTarget];
    if (primaryResult && primaryResult.success) {
      const config = REAL_ESTATE_TARGETS[primaryTarget];
      if (config) {
        parts.push(`Primary analysis on ${config.display_name}: mean value of ${primaryResult.statistics.mean.toFixed(2)} ${config.unit}.`);
      }
    }

    // Cross-correlations
    if (crossTargetCorrelations && crossTargetCorrelations.length > 0) {
      const strongCorrelations = crossTargetCorrelations.filter(c => c.strength === 'strong');
      if (strongCorrelations.length > 0) {
        const strongest = strongCorrelations.reduce((max, curr) => 
          Math.abs(curr.coefficient) > Math.abs(max.coefficient) ? curr : max
        );
        parts.push(`Strongest correlation found between ${strongest.target1} and ${strongest.target2} (r=${strongest.coefficient.toFixed(3)}).`);
      }
    }

    return parts.join(' ');
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Detect multi-target intent from query string
 */
export function detectMultiTargetIntent(query: string): {
  targets: string[];
  primaryTarget: string;
  analysisType: string;
} {
  const queryLower = query.toLowerCase();
  const detectedTargets: string[] = [];

  // Time on market detection
  if (queryLower.includes('time on market') || 
      queryLower.includes('how long') || 
      queryLower.includes('days to sell')) {
    detectedTargets.push('time_on_market');
  }

  // Price detection
  if (queryLower.includes('price') || 
      queryLower.includes('cost') || 
      queryLower.includes('value')) {
    detectedTargets.push('avg_sold_price');
  }

  // Rent detection
  if (queryLower.includes('rent') || 
      queryLower.includes('rental') || 
      queryLower.includes('lease')) {
    detectedTargets.push('avg_rent_price');
  }

  // Deal quality detection
  if (queryLower.includes('deal') || 
      queryLower.includes('discount') || 
      queryLower.includes('below asking')) {
    detectedTargets.push('price_delta');
  }

  // Market velocity detection
  if (queryLower.includes('velocity') || 
      queryLower.includes('turnover') || 
      queryLower.includes('activity')) {
    detectedTargets.push('market_velocity');
  }

  // Investment queries - include multiple metrics
  if (queryLower.includes('investment') || 
      queryLower.includes('roi') || 
      queryLower.includes('return')) {
    detectedTargets.push('time_on_market', 'avg_rent_price', 'price_delta');
  }

  return {
    targets: detectedTargets.length > 0 ? [...new Set(detectedTargets)] : ['time_on_market'],
    primaryTarget: detectedTargets[0] || 'time_on_market',
    analysisType: detectedTargets.length > 1 ? 'multi_target_correlation' : 'correlation'
  };
}

/**
 * Get target variable configuration
 */
export function getTargetVariableConfig(target: string): TargetVariableConfig | null {
  return REAL_ESTATE_TARGETS[target] || null;
}

/**
 * Validate target variable
 */
export function isValidTargetVariable(target: string): boolean {
  return target in REAL_ESTATE_TARGETS;
}

/**
 * Get all available target variables
 */
export function getAvailableTargetVariables(): string[] {
  return Object.keys(REAL_ESTATE_TARGETS);
}

export default MultiTargetAnalysisService;