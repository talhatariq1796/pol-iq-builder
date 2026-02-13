/**
 * Hybrid Routing System
 * 
 * Export all components of the hybrid routing architecture
 */

// Core routing engine
export { HybridRoutingEngine, hybridRoutingEngine } from './HybridRoutingEngine';

// Enhanced routing engines with multi-target support
export { SemanticEnhancedHybridEngine, semanticEnhancedHybridEngine } from './SemanticEnhancedHybridEngine';
export type { SemanticEnhancedResult } from './SemanticEnhancedHybridEngine';
export { RealEstateMultiTargetRouter, realEstateMultiTargetRouter } from './RealEstateMultiTargetRouter';

// Layer components
export { BaseIntentClassifier } from './BaseIntentClassifier';
export { DomainVocabularyAdapter } from './DomainVocabularyAdapter';
export { ContextEnhancementEngine } from './ContextEnhancementEngine';
export { QueryValidator } from './QueryValidator';
export { AdaptiveConfidenceManager } from './ConfidenceManager';

// Configuration management
export { DomainConfigurationLoader, domainConfigLoader } from './DomainConfigurationLoader';

// Testing framework
export { HybridRoutingTestSuite, hybridRoutingTestSuite } from './testing/HybridRoutingTestSuite';

// Type definitions
export * from './types/BaseIntentTypes';
export * from './types/DomainTypes';
export * from './types/ContextTypes';

// Utility functions
export const initializeHybridRouting = async () => {
  const { hybridRoutingEngine } = await import('./HybridRoutingEngine');
  await hybridRoutingEngine.initialize();
};

export const routeQuery = async (query: string, datasetContext?: any) => {
  const { hybridRoutingEngine } = await import('./HybridRoutingEngine');
  return await hybridRoutingEngine.route(query, datasetContext);
};

export const routeQueryWithMultiTarget = async (query: string, datasetContext?: any) => {
  const { semanticEnhancedHybridEngine } = await import('./SemanticEnhancedHybridEngine');
  return await semanticEnhancedHybridEngine.route(query, datasetContext);
};

export const testRoutingSystem = async (queries?: string[]) => {
  const defaultQueries = [
    "Show me demographic analysis",
    "What's the weather tomorrow?",
    "Strategic market opportunities",
    "How do I cook pasta?",
    "Competitive positioning analysis"
  ];
  
  const { hybridRoutingTestSuite } = await import('./testing/HybridRoutingTestSuite');
  return await hybridRoutingTestSuite.runTestSuite(undefined);
};