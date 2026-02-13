import React, { createContext, useContext, useState } from 'react';
import { HybridQueryProcessor, HybridQueryResult } from '../lib/hybrid-query-processor';

// Interface for the context value
interface HybridQueryContextValue {
  processQuery: (query: string) => Promise<HybridQueryResult>;
  lastResult: HybridQueryResult | null;
  isProcessing: boolean;
  error: string | null;
  clearError: () => void;
  showMLIndicator: boolean;
}

// Create the context
const HybridQueryContext = createContext<HybridQueryContextValue | undefined>(undefined);

// Configuration for the hybrid processor
const processorConfig = {
  mlServiceConfig: {
    endpoint: process.env.ML_SERVICE_ENDPOINT || 'http://localhost:5000/api/predict',
    apiKey: process.env.ML_SERVICE_API_KEY,
    timeout: 12000,
    retries: 2
  },
  featureFlags: {
    mlEnabled: process.env.ENABLE_ML !== 'false', // Enable by default
    useTelemetry: process.env.COLLECT_TELEMETRY !== 'false', // Enable by default
    adaptiveThreshold: process.env.ADAPTIVE_THRESHOLD === 'true' // Disable by default
  }
};

// Provider component
export const HybridQueryProvider: React.FC<React.PropsWithChildren<Record<string, never>>> = ({ children }) => {
  // Initialize the processor
  const [processor] = useState<HybridQueryProcessor>(() => new HybridQueryProcessor(processorConfig));
  
  // State for tracking query processing
  const [lastResult, setLastResult] = useState<HybridQueryResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMLIndicator, setShowMLIndicator] = useState(false);
  
  // Process a query
  const processQuery = async (query: string): Promise<HybridQueryResult> => {
    setIsProcessing(true);
    setError(null);
    
    try {
      const result = await processor.processQuery(query);
      setLastResult(result);
      
      // Update ML indicator based on processing path
      setShowMLIndicator(result.processingPath === 'ml-based');
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Clear any errors
  const clearError = () => setError(null);
  
  // Create context value
  const contextValue: HybridQueryContextValue = {
    processQuery,
    lastResult,
    isProcessing,
    error,
    clearError,
    showMLIndicator
  };
  
  return (
    <HybridQueryContext.Provider value={contextValue}>
      {children}
    </HybridQueryContext.Provider>
  );
};

// Custom hook for using the context
export const useHybridQuery = (): HybridQueryContextValue => {
  const context = useContext(HybridQueryContext);
  
  if (context === undefined) {
    throw new Error('useHybridQuery must be used within a HybridQueryProvider');
  }
  
  return context;
};

// ML Indicator component
export const MLProcessingIndicator: React.FC = () => {
  const { showMLIndicator } = useHybridQuery();
  
  if (!showMLIndicator) return null;
  
  return (
    <div className="ml-processing-indicator">
      <div className="ml-icon">🧠</div>
      <div className="ml-text">Enhanced with ML</div>
    </div>
  );
}; 