import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AnalysisEngine } from '@/lib/analysis/AnalysisEngine';
import { AnalysisEngineConfig, AnalysisState, DeepPartial } from '@/lib/analysis/types';

/**
 * React Context for AnalysisEngine Singleton
 * 
 * Provides a clean way to access the singleton AnalysisEngine instance
 * across all React components while maintaining proper React patterns.
 */

interface AnalysisEngineContextType {
  engine: AnalysisEngine;
  state: AnalysisState;
  isReady: boolean;
}

const AnalysisEngineContext = createContext<AnalysisEngineContextType | null>(null);

interface AnalysisEngineProviderProps {
  children: ReactNode;
  config?: DeepPartial<AnalysisEngineConfig>;
}

/**
 * Provider component that initializes and manages the singleton AnalysisEngine
 * 
 * Usage:
 * ```tsx
 * <AnalysisEngineProvider>
 *   <App />
 * </AnalysisEngineProvider>
 * ```
 */
export const AnalysisEngineProvider: React.FC<AnalysisEngineProviderProps> = ({
  children,
  config
}) => {
  const [engine] = useState<AnalysisEngine>(() => {
    console.log('[AnalysisEngineProvider] Initializing singleton engine...');
    return AnalysisEngine.getInstance(config);
  });
  
  const [state, setState] = useState<AnalysisState>(() => engine.getState());
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    console.log('[AnalysisEngineProvider] Setting up engine state subscription...');
    
    // Subscribe to engine state changes
    const unsubscribe = engine.subscribe((newState: AnalysisState) => {
      setState(newState);
    });

    // Mark as ready
    setIsReady(true);
    console.log('[AnalysisEngineProvider] ✅ Engine ready');

    // Cleanup subscription on unmount
    return () => {
      console.log('[AnalysisEngineProvider] Cleaning up engine subscription...');
      unsubscribe();
    };
  }, [engine]);

  const contextValue: AnalysisEngineContextType = {
    engine,
    state,
    isReady
  };

  return (
    <AnalysisEngineContext.Provider value={contextValue}>
      {children}
    </AnalysisEngineContext.Provider>
  );
};

/**
 * Hook to access the singleton AnalysisEngine from any component
 * 
 * Usage:
 * ```tsx
 * const { engine, state, isReady } = useAnalysisEngineContext();
 * ```
 */
export const useAnalysisEngineContext = (): AnalysisEngineContextType => {
  const context = useContext(AnalysisEngineContext);
  
  if (!context) {
    throw new Error(
      'useAnalysisEngineContext must be used within an AnalysisEngineProvider. ' +
      'Make sure to wrap your app with <AnalysisEngineProvider>.'
    );
  }
  
  return context;
};

/**
 * Hook to get just the engine instance (most common use case)
 * 
 * Usage:
 * ```tsx
 * const engine = useAnalysisEngine();
 * const result = await engine.executeAnalysis(query);
 * ```
 */
export const useAnalysisEngineInstance = (): AnalysisEngine => {
  const { engine } = useAnalysisEngineContext();
  return engine;
};