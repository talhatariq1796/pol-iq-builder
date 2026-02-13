import { useState, useEffect, useCallback, useRef } from 'react';
import { AnalysisEngine } from '../lib/analysis/AnalysisEngine';
import { AnalysisOptions, AnalysisResult, AnalysisState, AnalysisEngineConfig, DeepPartial } from '../lib/analysis/types';
import { AnalysisEventType, AnalysisEvent } from '../lib/analysis/types';

/**
 * React hook for AnalysisEngine integration
 * 
 * Provides a clean, React-friendly interface to the AnalysisEngine
 * with automatic state synchronization and performance optimizations.
 */
export const useAnalysisEngine = (config?: DeepPartial<AnalysisEngineConfig>) => {
  // Get singleton instance (ensures all components share the same engine)
  const engineRef = useRef<AnalysisEngine>();
  if (!engineRef.current) {
    engineRef.current = AnalysisEngine.getInstance(config);
  }
  const engine = engineRef.current;

  // Local state synchronized with engine
  const [state, setState] = useState<AnalysisState>(engine.getState());
  const [isInitialized, setIsInitialized] = useState(true);

  // Subscribe to engine state changes
  useEffect(() => {
    const unsubscribe = engine.subscribe((newState) => {
      setState(newState);
    });

    // Initial state sync
    setState(engine.getState());
    setIsInitialized(true);

    return unsubscribe;
  }, [engine]);

  // Main analysis execution function
  const executeAnalysis = useCallback(async (query: string, options?: AnalysisOptions): Promise<AnalysisResult> => {
    try {
      return await engine.executeAnalysis(query, options);
    } catch (error) {
      console.error('[useAnalysisEngine] Execute analysis error:', error);
      throw error;
    }
  }, [engine]);

  // Update visualization settings
  const updateVisualization = useCallback(async (updates: any) => {
    try {
      await engine.updateVisualization(updates);
    } catch (error) {
      console.error('[useAnalysisEngine] Update visualization error:', error);
      throw error;
    }
  }, [engine]);

  // Clear current analysis
  const clearAnalysis = useCallback(() => {
    engine.clearAnalysis();
  }, [engine]);

  // Set preferred endpoint
  const setPreferredEndpoint = useCallback((endpoint: string) => {
    engine.setPreferredEndpoint(endpoint);
  }, [engine]);

  // Get available endpoints
  const getAvailableEndpoints = useCallback(() => {
    return engine.getAvailableEndpoints();
  }, [engine]);

  // Get analysis history
  const getAnalysisHistory = useCallback(() => {
    return engine.getAnalysisHistory();
  }, [engine]);

  // Clear history
  const clearHistory = useCallback(() => {
    engine.clearHistory();
  }, [engine]);

  // Event listeners
  const addEventListener = useCallback((eventType: AnalysisEventType, callback: (event: AnalysisEvent) => void) => {
    return engine.addEventListener(eventType, callback);
  }, [engine]);

  // Convenience getters for common state properties
  const isProcessing = state.processingStatus.isProcessing;
  const currentStep = state.processingStatus.currentStep;
  const progress = state.processingStatus.progress;
  const hasError = !!state.errorState;
  const errorMessage = state.errorState?.message;
  const lastQuery = state.lastQuery;
  const currentAnalysis = state.currentAnalysis;
  const currentVisualization = state.currentVisualization;
  const selectedEndpoint = state.selectedEndpoint;
  const history = state.history;

  return {
    // Core functions
    executeAnalysis,
    updateVisualization,
    clearAnalysis,
    setPreferredEndpoint,
    
    // Data access
    getAvailableEndpoints,
    getAnalysisHistory,
    clearHistory,
    addEventListener,
    
    // State
    state,
    isInitialized,
    
    // Convenience state getters
    isProcessing,
    currentStep,
    progress,
    hasError,
    errorMessage,
    lastQuery,
    currentAnalysis,
    currentVisualization,
    selectedEndpoint,
    history,
    
    // Direct engine access (for advanced usage)
    engine
  };
};

/**
 * Hook for accessing analysis state without creating an engine instance
 * Useful for components that only need to read state
 */
export const useAnalysisState = () => {
  const { state, isProcessing, currentStep, progress, hasError, errorMessage, 
          lastQuery, currentAnalysis, currentVisualization, selectedEndpoint, history } = useAnalysisEngine();
  
  return {
    state,
    isProcessing,
    currentStep,
    progress,
    hasError,
    errorMessage,
    lastQuery,
    currentAnalysis,
    currentVisualization,
    selectedEndpoint,
    history
  };
};

/**
 * Hook for endpoint management
 */
export const useEndpoints = () => {
  const { getAvailableEndpoints, setPreferredEndpoint, selectedEndpoint } = useAnalysisEngine();
  
  const [endpoints, setEndpoints] = useState<any[]>([]);
  const [endpointsByCategory, setEndpointsByCategory] = useState<Record<string, any[]>>({});
  
  useEffect(() => {
    const availableEndpoints = getAvailableEndpoints();
    setEndpoints(availableEndpoints);
    
    // Group by category
    const grouped = availableEndpoints.reduce((acc, endpoint) => {
      const category = endpoint.category;
      if (!acc[category]) acc[category] = [];
      acc[category].push(endpoint);
      return acc;
    }, {} as Record<string, any[]>);
    
    setEndpointsByCategory(grouped);
  }, [getAvailableEndpoints]);
  
  return {
    endpoints,
    endpointsByCategory,
    selectedEndpoint,
    setPreferredEndpoint
  };
};

/**
 * Hook for analysis history management
 */
export const useAnalysisHistory = () => {
  const { getAnalysisHistory, clearHistory } = useAnalysisEngine();
  
  const [history, setHistory] = useState<any[]>([]);
  
  useEffect(() => {
    setHistory(getAnalysisHistory() || []);
  }, [getAnalysisHistory]);
  
  const rerunAnalysis = useCallback(async (historyItem: any) => {
    const { executeAnalysis } = useAnalysisEngine();
    return executeAnalysis(historyItem.query, { endpoint: historyItem.endpoint });
  }, []);
  
  return {
    history,
    clearHistory,
    rerunAnalysis
  };
}; 