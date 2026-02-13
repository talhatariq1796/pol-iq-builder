/**
 * Base Intent Classification Types
 * 
 * Domain-agnostic intent recognition for analytical queries
 */

export enum BaseIntent {
  // Primary Analysis Types
  DEMOGRAPHIC_ANALYSIS = 'demographic_analysis',
  COMPETITIVE_ANALYSIS = 'competitive_analysis',
  STRATEGIC_ANALYSIS = 'strategic_analysis',
  COMPARATIVE_ANALYSIS = 'comparative_analysis',
  
  // Analytical Approaches
  PERFORMANCE_RANKING = 'performance_ranking',
  DIFFERENCE_ANALYSIS = 'difference_analysis',
  RELATIONSHIP_ANALYSIS = 'relationship_analysis',
  TREND_ANALYSIS = 'trend_analysis',
  
  // Advanced Analytics
  PREDICTION_MODELING = 'prediction_modeling',
  CLUSTERING_SEGMENTATION = 'clustering_segmentation',
  ANOMALY_DETECTION = 'anomaly_detection',
  OPTIMIZATION = 'optimization',
  
  // Meta-Analysis
  GENERAL_EXPLORATION = 'general_exploration',
  COMPREHENSIVE_OVERVIEW = 'comprehensive_overview'
}

export interface IntentSignature {
  subject_indicators: string[];
  analysis_indicators: string[];
  scope_indicators: string[];
  quality_indicators: string[];
}

export interface IntentSignatures {
  [BaseIntent.DEMOGRAPHIC_ANALYSIS]: IntentSignature;
  [BaseIntent.COMPETITIVE_ANALYSIS]: IntentSignature;
  [BaseIntent.STRATEGIC_ANALYSIS]: IntentSignature;
  [BaseIntent.COMPARATIVE_ANALYSIS]: IntentSignature;
  [BaseIntent.PERFORMANCE_RANKING]: IntentSignature;
  [BaseIntent.DIFFERENCE_ANALYSIS]: IntentSignature;
  [BaseIntent.RELATIONSHIP_ANALYSIS]: IntentSignature;
  [BaseIntent.TREND_ANALYSIS]: IntentSignature;
  [BaseIntent.PREDICTION_MODELING]: IntentSignature;
  [BaseIntent.CLUSTERING_SEGMENTATION]: IntentSignature;
  [BaseIntent.ANOMALY_DETECTION]: IntentSignature;
  [BaseIntent.OPTIMIZATION]: IntentSignature;
  [BaseIntent.GENERAL_EXPLORATION]: IntentSignature;
  [BaseIntent.COMPREHENSIVE_OVERVIEW]: IntentSignature;
}

export interface IntentClassification {
  primary_intent: BaseIntent;
  confidence: number;
  secondary_intents: Array<{
    intent: BaseIntent;
    confidence: number;
  }>;
  matched_categories: number;
  reasoning: string[];
}

export interface IntentMatchResult {
  intent: BaseIntent;
  score: number;
  matched_categories: number;
  category_scores: {
    subject: number;
    analysis: number;
    scope: number;
    quality: number;
  };
  matched_terms: string[];
}