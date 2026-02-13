/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * MultiEndpointAnalysisEngine - Main orchestrator for multi-endpoint analysis
 * 
 * Integrates all components:
 * 1. MultiEndpointQueryDetector - Query analysis
 * 2. MultiEndpointRouter - Data loading
 * 3. DatasetMerger - Data combination
 * 4. CompositeDataProcessor - Analysis
 * 5. MultiEndpointVisualizationRenderer - Visualization
 */

import { 
  AnalysisOptions, 
  AnalysisResult,
  AnalysisEngineConfig,
  DeepPartial
} from './types';

import { MultiEndpointQueryDetector, MultiEndpointQuery } from './MultiEndpointQueryDetector';
import { MultiEndpointRouter } from './MultiEndpointRouter';
import { DatasetMerger, MergedDataset, MergeOptions } from './DatasetMerger';
import { CompositeDataProcessor, CompositeAnalysisResult } from './CompositeDataProcessor';
import { MultiEndpointVisualizationRenderer, MultiEndpointVisualizationConfig } from './MultiEndpointVisualizationRenderer';
import { ConfigurationManager } from './ConfigurationManager';
import { StateManager } from './StateManager';

export interface MultiEndpointAnalysisOptions extends Omit<AnalysisOptions, 'visualizationConfig'> {
  endpoints?: string[];
  combinationStrategy?: 'overlay' | 'comparison' | 'sequential' | 'correlation';
  mergeOptions?: Partial<MergeOptions>;
  visualizationConfig?: Partial<MultiEndpointVisualizationConfig>;
  forceMultiEndpoint?: boolean;
  maxEndpoints?: number;
}

export interface MultiEndpointAnalysisResult extends AnalysisResult {
  isMultiEndpoint: boolean;
  endpointsUsed: string[];
  mergeStrategy: string;
  compositeData: CompositeAnalysisResult;
  strategicInsights: any;
  performanceMetrics: {
    totalAnalysisTime: number;
    dataLoadingTime: number;
    processingTime: number;
    visualizationTime: number;
    endpointLoadTimes: Record<string, number>;
  };
  qualityMetrics?: {
    analysisConfidence?: number;
    dataQuality?: number;
    mergeEfficiency?: number;
  };
}

export class MultiEndpointAnalysisEngine {
  private queryDetector: MultiEndpointQueryDetector;
  private router: MultiEndpointRouter;
  private datasetMerger: DatasetMerger;
  private compositeProcessor: CompositeDataProcessor;
  private visualizationRenderer: MultiEndpointVisualizationRenderer;
  private configManager: ConfigurationManager;
  private stateManager: StateManager;
  private config: AnalysisEngineConfig;

  constructor(config?: DeepPartial<AnalysisEngineConfig>) {
    // Initialize configuration
    this.config = this.initializeConfig(config);
    
    // Initialize all components
    this.configManager = ConfigurationManager.getInstance();
    this.stateManager = new StateManager();
    this.queryDetector = new MultiEndpointQueryDetector();
    this.router = new MultiEndpointRouter(this.configManager);
    this.datasetMerger = new DatasetMerger();
    this.compositeProcessor = new CompositeDataProcessor();
    this.visualizationRenderer = new MultiEndpointVisualizationRenderer();

    console.log('[MultiEndpointAnalysisEngine] Initialized with multi-endpoint capabilities');
  }

  /**
   * Main analysis execution with multi-endpoint support
   */
  async executeAnalysis(
    query: string, 
    options?: MultiEndpointAnalysisOptions
  ): Promise<MultiEndpointAnalysisResult> {
    
    const startTime = Date.now();
    // const analysisId = this.generateAnalysisId(); // Reserved for future use

    try {
      console.log(`[MultiEndpointAnalysisEngine] Starting analysis: "${query}"`);
      
      // Update state
      this.updateProcessingState('analyzing_query', 0);

      // Step 1: Analyze query to determine endpoints needed
      const queryAnalysis = await this.analyzeQuery(query, options);
      
      if (!queryAnalysis.isMultiEndpoint && !options?.forceMultiEndpoint) {
        // Fallback to single endpoint analysis
        return this.executeSingleEndpointAnalysis(query, queryAnalysis, options, startTime);
      }

      console.log(`[MultiEndpointAnalysisEngine] Multi-endpoint analysis detected:`, {
        primary: queryAnalysis.primaryEndpoint,
        secondary: queryAnalysis.secondaryEndpoints,
        strategy: queryAnalysis.combinationStrategy
      });

      // Step 2: Load data from multiple endpoints
      this.updateProcessingState('loading_data', 20);
      const dataLoadStartTime = Date.now();
      
      // Convert back to AnalysisOptions for router compatibility
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { visualizationConfig: _, endpoints: __, combinationStrategy: ___, mergeOptions: ____, forceMultiEndpoint: _____, maxEndpoints: ______, ...routerOptions } = options || {};
      const multiEndpointResult = await this.router.executeMultiEndpointAnalysis(query, {
        ...routerOptions,
        endpoints: [queryAnalysis.primaryEndpoint, ...queryAnalysis.secondaryEndpoints],
        combinationStrategy: queryAnalysis.combinationStrategy
      });
      
      const dataLoadingTime = Date.now() - dataLoadStartTime;

      // Step 3: Merge datasets
      this.updateProcessingState('merging_data', 40);
      const mergeOptions: MergeOptions = {
        strategy: queryAnalysis.combinationStrategy,
        locationField: 'FSA_ID',
        includePartialRecords: true,
        fieldPrefixes: queryAnalysis.combinationStrategy === 'comparison',
        ...options?.mergeOptions
      };

      const mergedDataset = await this.datasetMerger.mergeDatasets(
        [multiEndpointResult.primaryResult, ...Object.values(multiEndpointResult.secondaryResults)], 
        mergeOptions
      ) as unknown as MergedDataset;

      // Step 4: Process composite analysis
      this.updateProcessingState('processing_analysis', 60);
      const processingStartTime = Date.now();
      
      const compositeData = await this.compositeProcessor.processCompositeAnalysis(
        mergedDataset,
        multiEndpointResult
      );
      
      const processingTime = Date.now() - processingStartTime;

      // Step 5: Create visualization
      this.updateProcessingState('creating_visualization', 80);
      const visualizationStartTime = Date.now();
      
      const visualizationConfig = this.createVisualizationConfig(
        queryAnalysis,
        compositeData,
        options?.visualizationConfig
      );

      const visualization = await this.visualizationRenderer.createCompositeVisualization(
        compositeData,
        mergedDataset,
        visualizationConfig
      );
      
      const visualizationTime = Date.now() - visualizationStartTime;

      // Step 6: Compile final result
      this.updateProcessingState('finalizing', 95);
      
      const totalAnalysisTime = Date.now() - startTime;
      
      const result: MultiEndpointAnalysisResult = {
        endpoint: queryAnalysis.primaryEndpoint,
        data: compositeData,
        visualization,
        success: true,
        metadata: {
          executionTime: totalAnalysisTime,
          dataPointCount: compositeData.totalRecords || 0,
          timestamp: new Date().toISOString(),
          // Add confidence score from composite analysis
          confidenceScore: compositeData.qualityMetrics?.analysisConfidence || queryAnalysis.confidence
        },
        
        // Multi-endpoint specific
        isMultiEndpoint: true,
        endpointsUsed: [queryAnalysis.primaryEndpoint, ...queryAnalysis.secondaryEndpoints],
        mergeStrategy: queryAnalysis.combinationStrategy,
        compositeData,
        strategicInsights: compositeData.strategicSummary,
        performanceMetrics: {
          totalAnalysisTime,
          dataLoadingTime,
          processingTime,
          visualizationTime,
          endpointLoadTimes: multiEndpointResult.loadingStats.endpointLoadTimes
        },
        qualityMetrics: {
          analysisConfidence: compositeData.qualityMetrics?.analysisConfidence || queryAnalysis.confidence,
          dataQuality: compositeData.qualityMetrics?.dataCompleteness || 0.8,
          mergeEfficiency: totalAnalysisTime > 0 ? Math.min(1.0, 10000 / totalAnalysisTime) : 0.5
        }
      };

      this.updateProcessingState('complete', 100);
      
      console.log(`[MultiEndpointAnalysisEngine] Multi-endpoint analysis complete:`, {
        endpoints: result.endpointsUsed.length,
        records: result.compositeData.totalRecords,
        insights: result.strategicInsights.topOpportunities.length,
        totalTime: totalAnalysisTime
      });

      return result;

    } catch (error) {
      console.error(`[MultiEndpointAnalysisEngine] Analysis failed:`, error);
      
      // Try fallback to single endpoint
      try {
        const fallback = await this.executeFallbackAnalysis(query, options, startTime);
        return { ...fallback, isMultiEndpoint: false };
      } catch (fallbackError) {
        throw new Error(`Multi-endpoint analysis failed: ${error}. Fallback also failed: ${fallbackError}`);
      }
    }
  }

  /**
   * Analyze query to determine endpoint strategy
   */
  private async analyzeQuery(
    query: string, 
    options?: MultiEndpointAnalysisOptions
  ): Promise<MultiEndpointQuery> {
    
    // If explicitly specified, use those endpoints
    if (options?.endpoints && options.endpoints.length > 1) {
      return {
        isMultiEndpoint: true,
        primaryEndpoint: options.endpoints[0],
        secondaryEndpoints: options.endpoints.slice(1),
        combinationStrategy: options.combinationStrategy || 'overlay',
        confidence: 1.0,
        reasoning: 'Explicitly specified multi-endpoint query'
      };
    }

    // Use detector to analyze query
    const analysis = this.queryDetector.analyzeQuery(query);
    
    // Apply constraints
    if (options?.maxEndpoints && analysis.secondaryEndpoints.length > options.maxEndpoints - 1) {
      analysis.secondaryEndpoints = analysis.secondaryEndpoints.slice(0, options.maxEndpoints - 1);
    }

    return analysis;
  }

  /**
   * Create visualization configuration
   */
  private createVisualizationConfig(
    queryAnalysis: MultiEndpointQuery,
    compositeData: CompositeAnalysisResult,
    userConfig?: Partial<MultiEndpointVisualizationConfig>
  ): MultiEndpointVisualizationConfig {
    
    // Default configuration based on strategy
    const defaultConfig: MultiEndpointVisualizationConfig = {
      strategy: queryAnalysis.combinationStrategy,
      primaryLayer: {
        endpoint: queryAnalysis.primaryEndpoint,
        visualizationType: this.getVisualizationTypeForEndpoint(queryAnalysis.primaryEndpoint),
        field: 'opportunityScore',
        colorScheme: 'viridis',
        opacity: 0.8,
        showInLegend: true,
        classificationMethod: 'natural_breaks'
      },
      secondaryLayers: queryAnalysis.secondaryEndpoints.map(endpoint => ({
        endpoint,
        visualizationType: this.getVisualizationTypeForEndpoint(endpoint),
        field: this.getDefaultFieldForEndpoint(endpoint),
        colorScheme: 'plasma',
        opacity: 0.6,
        showInLegend: true,
        classificationMethod: 'quantile'
      })),
      interactionMode: 'synchronized',
      dashboardLayout: queryAnalysis.combinationStrategy === 'comparison' ? 'split_view' : 'map_focused',
      showLegend: true,
      enableInteractivity: true,
      
      // Base VisualizationConfig properties
      colorScheme: 'viridis',
      opacity: 0.8,
      strokeWidth: 1,
      valueField: 'opportunityScore',
      labelField: 'area_name',
      popupFields: ['area_name', 'opportunityScore', 'riskScore'],
      classificationMethod: 'natural_breaks'
    };

    // Merge with user configuration
    return { ...defaultConfig, ...userConfig };
  }

  /**
   * Execute single endpoint analysis (fallback)
   */
  private async executeSingleEndpointAnalysis(
    query: string,
    queryAnalysis: MultiEndpointQuery,
    options?: MultiEndpointAnalysisOptions,
    startTime?: number
  ): Promise<MultiEndpointAnalysisResult> {
    
    console.log(`[MultiEndpointAnalysisEngine] Executing single-endpoint fallback`);
    
    // Use standard single endpoint processing
    // Convert back to AnalysisOptions for router compatibility
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { visualizationConfig: _, endpoints: __, combinationStrategy: ___, mergeOptions: ____, forceMultiEndpoint: _____, maxEndpoints: ______, ...routerOptions } = options || {};
    const singleResult = await this.router.callEndpoint(queryAnalysis.primaryEndpoint, query, routerOptions);
    
    // Wrap in multi-endpoint format
    return {
      endpoint: queryAnalysis.primaryEndpoint,
      data: singleResult as any,
      visualization: null as any, // Would need proper single-endpoint visualization
      success: true,
      metadata: {
        executionTime: Date.now() - (startTime || 0),
        dataPointCount: singleResult.results?.length || 0,
        timestamp: new Date().toISOString(),
        confidenceScore: singleResult.model_info?.accuracy || undefined
      },
      isMultiEndpoint: false,
      endpointsUsed: [queryAnalysis.primaryEndpoint],
      mergeStrategy: 'single',
      compositeData: null as any,
      strategicInsights: null,
      performanceMetrics: {
        totalAnalysisTime: Date.now() - (startTime || 0),
        dataLoadingTime: 0,
        processingTime: 0,
        visualizationTime: 0,
        endpointLoadTimes: { [queryAnalysis.primaryEndpoint]: 0 }
      },
      qualityMetrics: {
        analysisConfidence: singleResult.model_info?.accuracy || 0.7,
        dataQuality: 0.8,
        mergeEfficiency: 1.0
      }
    };
  }

  /**
   * Execute fallback analysis on failure
   */
  private async executeFallbackAnalysis(
    query: string,
    options?: MultiEndpointAnalysisOptions,
    startTime?: number
  ): Promise<MultiEndpointAnalysisResult> {
    
    // Try with just the analyze endpoint
    const fallbackQuery: MultiEndpointQuery = {
      isMultiEndpoint: false,
      primaryEndpoint: '/analyze',
      secondaryEndpoints: [],
      combinationStrategy: 'overlay',
      confidence: 0.3,
      reasoning: 'Fallback to default endpoint due to multi-endpoint failure'
    };

    return this.executeSingleEndpointAnalysis(query, fallbackQuery, options, startTime);
  }

  /**
   * Helper methods
   */
  private getVisualizationTypeForEndpoint(endpoint: string): 'choropleth' | 'proportional_symbol' | 'cluster' | 'heatmap' | 'categorical' {
    const typeMap: Record<string, any> = {
      '/analyze': 'choropleth',
      '/competitive-analysis': 'proportional_symbol',
      '/spatial-clusters': 'cluster',
      '/demographic-insights': 'choropleth',
      '/trend-analysis': 'choropleth',
      '/anomaly-detection': 'heatmap',
      '/predictive-modeling': 'choropleth'
    };
    
    return typeMap[endpoint] || 'choropleth';
  }

  private getDefaultFieldForEndpoint(endpoint: string): string {
    const fieldMap: Record<string, string> = {
      '/competitive-analysis': 'competitiveAdvantage',
      '/demographic-insights': 'targetDemographicFit', 
      '/spatial-clusters': 'clusterMembership',
      '/trend-analysis': 'growthPotential',
      '/anomaly-detection': 'riskScore',
      '/predictive-modeling': 'futureOpportunity'
    };
    
    return fieldMap[endpoint] || 'primaryScore';
  }

  private updateProcessingState(step: string, progress: number): void {
    this.stateManager.updateState({
      processingStatus: {
        isProcessing: true,
        currentStep: step as any, // Cast to avoid ProcessingStep type constraint
        progress
      }
    });
  }

  private generateAnalysisId(): string {
    return `multi_analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeConfig(config?: DeepPartial<AnalysisEngineConfig>): AnalysisEngineConfig {
    return {
      debugMode: false,
      enableCaching: true,
      maxConcurrentRequests: 3,
      defaultTimeout: 30000,
      retryAttempts: 2,
      ...config
    };
  }
}

// Demo/Testing functionality
export async function demonstrateMultiEndpointAnalysis() {
  console.log('🚀 Multi-Endpoint Analysis Demo');
  console.log('='.repeat(50));
  
  const engine = new MultiEndpointAnalysisEngine({
    debugMode: true
  });

  // Test queries
  const testQueries = [
    {
      query: "Where should Nike expand stores considering competition, demographics, and growth potential?",
      expected: "Market entry strategy analysis"
    },
    {
      query: "Why is our Vancouver store underperforming and what's the root cause?",
      expected: "Performance diagnosis with sequential analysis"
    },
    {
      query: "Show me high-opportunity, low-risk markets for investment",
      expected: "Risk-opportunity overlay analysis"
    },
    {
      query: "Compare Nike vs Adidas across different demographic segments",
      expected: "Competitive comparison analysis"
    }
  ];

  for (const test of testQueries) {
    try {
      console.log(`\n📋 Testing: "${test.query}"`);
      console.log(`Expected: ${test.expected}`);
      
      const result = await engine.executeAnalysis(test.query);
      
      console.log(`✅ Success:`, {
        isMultiEndpoint: result.isMultiEndpoint,
        endpoints: result.endpointsUsed,
        strategy: result.mergeStrategy,
        records: result.compositeData?.totalRecords || 0,
        insights: result.strategicInsights?.topOpportunities?.length || 0,
        executionTime: result.performanceMetrics.totalAnalysisTime
      });
      
    } catch (error) {
      console.log(`❌ Failed: ${error}`);
    }
  }
  
  console.log('\n🎉 Multi-endpoint analysis demo complete!');
} 