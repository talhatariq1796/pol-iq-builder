/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * useMultiEndpointAnalysis - React Hook for Multi-Endpoint Analysis
 * 
 * Demonstrates integration with existing analysis system
 * Can be gradually adopted without breaking existing functionality
 */

import { useState, useCallback } from 'react';
import { MultiEndpointAnalysisEngine } from '@/lib/analysis/MultiEndpointAnalysisEngine';
import { MultiEndpointQueryDetector } from '@/lib/analysis/MultiEndpointQueryDetector';

export interface MultiEndpointAnalysisState {
  isAnalyzing: boolean;
  currentStep: string;
  progress: number;
  result: any | null;
  error: string | null;
  isMultiEndpoint: boolean;
  endpointsUsed: string[];
  strategicInsights: any | null;
  performanceMetrics: any | null;
}

export interface MultiEndpointOptions {
  forceMultiEndpoint?: boolean;
  maxEndpoints?: number;
  combinationStrategy?: 'overlay' | 'comparison' | 'sequential' | 'correlation';
  debugMode?: boolean;
}

export function useMultiEndpointAnalysis() {
  const [state, setState] = useState<MultiEndpointAnalysisState>({
    isAnalyzing: false,
    currentStep: '',
    progress: 0,
    result: null,
    error: null,
    isMultiEndpoint: false,
    endpointsUsed: [],
    strategicInsights: null,
    performanceMetrics: null
  });

  // Initialize engines (lazy loading)
  const [analysisEngine, setAnalysisEngine] = useState<MultiEndpointAnalysisEngine | null>(null);
  const [queryDetector, setQueryDetector] = useState<MultiEndpointQueryDetector | null>(null);

  const initializeEngines = useCallback(() => {
    if (!analysisEngine) {
      const engine = new MultiEndpointAnalysisEngine({ debugMode: true });
      const detector = new MultiEndpointQueryDetector();
      setAnalysisEngine(engine);
      setQueryDetector(detector);
      return { engine, detector };
    }
    return { engine: analysisEngine, detector: queryDetector };
  }, [analysisEngine, queryDetector]);

  // Check if query should use multi-endpoint analysis
  const detectMultiEndpoint = useCallback((query: string) => {
    const { detector } = initializeEngines();
    if (!detector) return { isMultiEndpoint: false };

    const analysis = detector.analyzeQuery(query);
    return {
      isMultiEndpoint: analysis.isMultiEndpoint,
      confidence: analysis.confidence,
      reasoning: analysis.reasoning,
      primaryEndpoint: analysis.primaryEndpoint,
      secondaryEndpoints: analysis.secondaryEndpoints,
      strategy: analysis.combinationStrategy
    };
  }, [initializeEngines]);

  // Execute multi-endpoint analysis
  const executeAnalysis = useCallback(async (
    query: string, 
    options: MultiEndpointOptions = {}
  ) => {
    const { engine } = initializeEngines();
    if (!engine) {
      throw new Error('Failed to initialize analysis engine');
    }

    setState((prev: MultiEndpointAnalysisState) => ({
      ...prev,
      isAnalyzing: true,
      currentStep: 'Detecting query type',
      progress: 0,
      error: null
    }));

    try {
      // Step 1: Detect if multi-endpoint is needed
      const detection = detectMultiEndpoint(query);
      
      setState((prev: MultiEndpointAnalysisState) => ({
        ...prev,
        currentStep: detection.isMultiEndpoint ? 'Multi-endpoint analysis' : 'Single-endpoint analysis',
        progress: 10,
        isMultiEndpoint: detection.isMultiEndpoint
      }));

      if (options.debugMode) {
        console.log('Multi-endpoint detection:', detection);
      }

      // Step 2: Execute analysis
      setState((prev: MultiEndpointAnalysisState) => ({ ...prev, currentStep: 'Loading data', progress: 20 }));

      const result = await engine.executeAnalysis(query, {
        forceMultiEndpoint: options.forceMultiEndpoint,
        maxEndpoints: options.maxEndpoints || 4,
        combinationStrategy: options.combinationStrategy || detection.strategy || 'overlay'
      });

      // Step 3: Process results
      setState((prev: MultiEndpointAnalysisState) => ({ ...prev, currentStep: 'Processing results', progress: 90 }));

      setState((prev: MultiEndpointAnalysisState) => ({
        ...prev,
        isAnalyzing: false,
        currentStep: 'Complete',
        progress: 100,
        result,
        isMultiEndpoint: result.isMultiEndpoint,
        endpointsUsed: result.endpointsUsed || [],
        strategicInsights: result.strategicInsights,
        performanceMetrics: result.performanceMetrics
      }));

      return result;

    } catch (error) {
      setState((prev: MultiEndpointAnalysisState) => ({
        ...prev,
        isAnalyzing: false,
        currentStep: 'Error',
        progress: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
      throw error;
    }
  }, [initializeEngines, detectMultiEndpoint]);

  // Format multi-endpoint results for display
  const formatResults = useCallback((result: any) => {
    if (!result) return null;

    if (result.isMultiEndpoint) {
      return {
        type: 'multi-endpoint',
        summary: {
          strategy: result.mergeStrategy,
          endpoints: result.endpointsUsed,
          totalRecords: result.compositeData?.totalRecords || 0,
          executionTime: result.performanceMetrics?.totalAnalysisTime || 0
        },
        insights: {
          topOpportunities: result.strategicInsights?.topOpportunities || [],
          recommendations: result.strategicInsights?.recommendedActions || [],
          keyInsights: result.strategicInsights?.keyInsights || []
        },
        performance: {
          loadingTime: result.performanceMetrics?.dataLoadingTime || 0,
          processingTime: result.performanceMetrics?.processingTime || 0,
          visualizationTime: result.performanceMetrics?.visualizationTime || 0
        },
        quality: {
          dataCompleteness: result.metadata?.qualityMetrics?.dataCompleteness || 0,
          analysisConfidence: result.metadata?.qualityMetrics?.analysisConfidence || 0,
          spatialCoverage: result.metadata?.qualityMetrics?.spatialCoverage || 0
        }
      };
    } else {
      return {
        type: 'single-endpoint',
        endpoint: result.endpoint,
        records: result.data?.records?.length || 0,
        executionTime: result.metadata?.executionTime || 0
      };
    }
  }, []);

  // Generate user-friendly message
  const generateMessage = useCallback((result: any) => {
    const formatted = formatResults(result);
    if (!formatted) return '';

    let message = `🎯 **Multi-Endpoint Analysis Complete**\n\n`;

    if (formatted && formatted.summary) {
      message += `**Strategy:** ${formatted.summary.strategy}\n`;
      message += `**Endpoints:** ${formatted.summary.endpoints.join(', ')}\n`;
      message += `**Records Analyzed:** ${formatted.summary.totalRecords.toLocaleString()}\n\n`;
    }

    if (formatted && formatted.insights) {
      if (formatted.insights.topOpportunities.length > 0) {
        message += "**🎯 Top Opportunities:**\n";
        formatted.insights.topOpportunities.slice(0, 5).forEach((opportunity: any, index: number) => {
          message += `${index + 1}. ${opportunity.area_name} (Score: ${opportunity.score.toFixed(1)})\n`;
        });
        message += "\n";
      }

      if (formatted.insights.recommendations.length > 0) {
        message += "**💡 Strategic Recommendations:**\n";
        formatted.insights.recommendations.slice(0, 3).forEach((rec: any, index: number) => {
          message += `${index + 1}. ${rec.recommendation}\n`;
        });
        message += "\n";
      }
    }

    if (formatted && formatted.summary && formatted.quality) {
      message += `**⚡ Performance:** ${(formatted.summary.executionTime / 1000).toFixed(1)}s\n`;
      message += `**📊 Confidence:** ${(formatted.quality.analysisConfidence * 100).toFixed(1)}%`;
    }

    return message;
  }, [formatResults]);

  // Reset state
  const reset = useCallback(() => {
    setState({
      isAnalyzing: false,
      currentStep: '',
      progress: 0,
      result: null,
      error: null,
      isMultiEndpoint: false,
      endpointsUsed: [],
      strategicInsights: null,
      performanceMetrics: null
    });
  }, []);

  // Test multi-endpoint system
  const testSystem = useCallback(async () => {
    const testQueries = [
      "Where should Nike expand stores considering competition and demographics?",
      "Why is Vancouver underperforming and what's the root cause?",
      "Show me high-opportunity, low-risk markets for investment"
    ];

    console.log('🧪 Testing Multi-Endpoint System');
    
    for (const query of testQueries) {
      console.log(`\nTesting: "${query}"`);
      try {
        const detection = detectMultiEndpoint(query);
        console.log('Detection:', detection);
        
        // Simulate execution (without actually running)
        console.log(`Would use ${detection.isMultiEndpoint ? 'multi' : 'single'}-endpoint analysis`);
      } catch (error) {
        console.error('Test failed:', error);
      }
    }
  }, [detectMultiEndpoint]);

  return {
    // State
    ...state,
    
    // Actions
    executeAnalysis,
    detectMultiEndpoint,
    formatResults,
    generateMessage,
    reset,
    testSystem,
    
    // Utilities
    isReady: analysisEngine !== null,
    canUseMultiEndpoint: true
  };
}

// Example usage component
export function MultiEndpointAnalysisDemo() {
  const {
    isAnalyzing,
    currentStep,
    progress,
    result,
    error,
    isMultiEndpoint,
    endpointsUsed,
    executeAnalysis,
    generateMessage,
    testSystem
  } = useMultiEndpointAnalysis();

  const handleQuery = async (query: string) => {
    try {
      await executeAnalysis(query, { debugMode: true });
    } catch (err) {
      console.error('Analysis failed:', err);
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-bold mb-4">Multi-Endpoint Analysis Demo</h3>
      
      {isAnalyzing && (
        <div className="mb-4">
          <div className="text-sm text-gray-600">{currentStep}</div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          Error: {error}
        </div>
      )}

      {result && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 rounded">
          <div className="text-sm font-medium mb-2">
            {isMultiEndpoint ? '🔄 Multi-Endpoint' : '📋 Single-Endpoint'} Analysis
          </div>
          {isMultiEndpoint && (
            <div className="text-xs text-gray-600 mb-2">
              Endpoints: {endpointsUsed.join(', ')}
            </div>
          )}
          <pre className="text-xs whitespace-pre-wrap">{generateMessage(result)}</pre>
        </div>
      )}

      <div className="space-y-2">
        <button
          onClick={() => handleQuery("Where should Nike expand stores considering competition and demographics?")}
          disabled={isAnalyzing}
          className="block w-full p-2 text-left bg-blue-100 hover:bg-blue-200 rounded"
        >
          Test: Market Expansion Query
        </button>
        
        <button
          onClick={() => handleQuery("Why is Vancouver underperforming?")}
          disabled={isAnalyzing}
          className="block w-full p-2 text-left bg-yellow-100 hover:bg-yellow-200 rounded"
        >
          Test: Performance Diagnosis
        </button>
        
        <button
          onClick={testSystem}
          disabled={isAnalyzing}
          className="block w-full p-2 text-left bg-gray-100 hover:bg-gray-200 rounded"
        >
          Test System Detection
        </button>
      </div>
    </div>
  );
} 