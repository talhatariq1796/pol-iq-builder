/**
 * Context Enhancement Types
 * 
 * Dataset-aware context and routing optimization types
 */

export interface DatasetContext {
  // Dynamically discovered field categories
  available_fields: {
    all_fields: string[];            // All available fields in dataset
    categorized_fields: {            // Fields categorized by detected patterns
      [category: string]: string[];   // Dynamic categories based on field analysis
    };
  };
  
  // Data distribution insights
  field_characteristics: {
    [field: string]: {
      coverage: number;              // 0.0-1.0, percentage of non-null values
      variance: number;              // Data variance/spread
      uniqueness: number;            // Unique value ratio
      relevance_score: number;       // Historical routing success for this field
      data_type: 'numeric' | 'categorical' | 'text' | 'boolean';
      sample_values?: any[];         // Sample values for understanding
    };
  };
  
  // Historical routing patterns
  routing_history: {
    [query_pattern: string]: {
      successful_endpoint: string;
      confidence: number;
      frequency: number;
      last_updated: Date;
      success_rate: number;
      avg_user_satisfaction?: number;
    };
  };

  // Dataset metadata
  metadata: {
    total_records: number;
    last_updated: Date;
    data_quality_score: number;
    completeness_score: number;
    consistency_score: number;
  };
}

export interface ContextEnhancement {
  type: 'field_availability' | 'historical_pattern' | 'data_quality' | 'similarity_boost' | 'performance_boost';
  impact: number;                    // Multiplier effect on confidence
  reasoning: string;
  confidence: number;                // Confidence in this enhancement
  metadata?: any;                    // Additional context-specific data
}

export interface ContextuallyEnhancedCandidate {
  endpoint: string;
  base_score: number;
  contextual_score: number;
  final_confidence: number;
  enhancements: ContextEnhancement[];
  field_requirements: {
    required: string[];
    optional: string[];
    coverage_score: number;
  };
  historical_performance: {
    success_rate: number;
    frequency: number;
    avg_confidence: number;
  };
  reasoning: string[];
}

export interface FieldRequirements {
  [endpoint: string]: {
    required: string[];
    optional: string[];
    alternatives: string[][];         // Alternative field combinations
    min_coverage: number;             // Minimum field coverage required
  };
}

export interface RoutingPattern {
  query_signature: string;           // Normalized query pattern
  endpoint: string;
  success_count: number;
  failure_count: number;
  confidence_history: number[];
  user_feedback_scores: number[];
  last_used: Date;
  pattern_strength: number;          // 0.0-1.0 indicating pattern reliability
}

export interface PerformanceMetrics {
  endpoint: string;
  total_routes: number;
  success_rate: number;
  avg_confidence: number;
  avg_processing_time: number;
  user_satisfaction: number;
  failure_reasons: { [reason: string]: number };
  improvement_suggestions: string[];
}

export interface DataQualityAssessment {
  overall_score: number;             // 0.0-1.0
  field_scores: { [field: string]: number };
  missing_data_impact: number;
  consistency_issues: string[];
  recommendations: string[];
}