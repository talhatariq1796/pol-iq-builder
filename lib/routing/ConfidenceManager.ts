/**
 * Adaptive Confidence Manager
 * 
 * Manages confidence thresholds and routing recommendations with dynamic adjustment
 */

import { ValidationResult, QueryScope } from './types/DomainTypes';

export interface ConfidenceThresholds {
  // Primary routing thresholds
  high_confidence: number;         // 0.8+ - Route with full confidence
  medium_confidence: number;       // 0.6+ - Route with confidence warning
  low_confidence: number;          // 0.4+ - Route to fallback with explanation
  validation_threshold: number;    // 0.2+ - Minimum to attempt routing
  
  // Dynamic adjustment factors
  user_feedback_weight: number;    // How much to adjust based on user corrections
  historical_success_weight: number; // How much to weight past routing success
  domain_specificity_bonus: number;  // Bonus for domain-specific terminology
}

export interface UserFeedback {
  query: string;
  routed_endpoint: string;
  was_correct: boolean;
  user_rating: number;             // 1-5 scale
  timestamp: number;
  confidence_at_routing: number;
  alternative_endpoint?: string;   // If user corrected the routing
}

export interface RoutingRecommendation {
  action: 'route' | 'route_with_warning' | 'fallback_with_explanation' | 'request_clarification' | 'reject';
  confidence: number;
  message?: string;
  alternatives?: Array<{
    endpoint: string;
    confidence: number;
    description: string;
  }>;
}

export class AdaptiveConfidenceManager {
  private thresholds: ConfidenceThresholds;
  private feedbackHistory: UserFeedback[] = [];
  private routingHistory: Map<string, any> = new Map();
  
  constructor(initialThresholds?: Partial<ConfidenceThresholds>) {
    this.thresholds = {
      high_confidence: 0.8,
      medium_confidence: 0.6,
      low_confidence: 0.4,
      validation_threshold: 0.2,
      user_feedback_weight: 0.3,
      historical_success_weight: 0.4,
      domain_specificity_bonus: 0.1,
      ...initialThresholds
    };
  }

  /**
   * Get routing recommendation based on confidence and validation
   */
  getRecommendedAction(
    confidence: number,
    validation: ValidationResult,
    alternatives?: Array<any>
  ): RoutingRecommendation {
    // Handle validation-based rejection first
  if (validation.scope === QueryScope.OUT_OF_SCOPE && validation.confidence >= 0.6) {
      return {
        action: 'reject',
        confidence: validation.confidence,
        message: validation.redirect_message || 'Query is outside our analysis domain'
      };
    }
    
    if (validation.scope === QueryScope.MALFORMED) {
      return {
        action: 'reject',
        confidence: validation.confidence,
        message: 'Query appears to be incomplete or malformed. Please provide a more specific question.'
      };
    }
    
  // For borderline queries, always ask for clarification regardless of confidence
  if (validation.scope === QueryScope.BORDERLINE) {
      return {
        action: 'request_clarification',
        confidence,
        message: "I'm not sure what type of analysis you're looking for. Could you clarify or choose from these options?",
        alternatives: alternatives?.slice(0, 3).map(alt => ({
          endpoint: alt.endpoint,
          confidence: alt.confidence,
          description: this.getEndpointDescription(alt.endpoint)
        }))
      };
    }

    // Apply adaptive thresholds based on validation
    const adjustedThresholds = this.adjustThresholdsForValidation(validation);
    
    // Make routing decision based on adjusted confidence
    if (confidence >= adjustedThresholds.high_confidence) {
      return { 
        action: 'route', 
        confidence 
      };
    } else if (confidence >= adjustedThresholds.medium_confidence) {
      return { 
        action: 'route_with_warning', 
        confidence,
        message: `Routing with ${Math.round(confidence * 100)}% confidence. Let me know if this doesn't match what you're looking for.`
      };
    } else if (confidence >= adjustedThresholds.low_confidence) {
      // For in-scope queries, prefer routing with a warning instead of fallback
      if (validation.scope === QueryScope.IN_SCOPE) {
        return {
          action: 'route_with_warning',
          confidence,
          message: `Routing with ${Math.round(confidence * 100)}% confidence. Let me know if this doesn't match what you're looking for.`,
          alternatives: alternatives?.slice(0, 2).map(alt => ({
            endpoint: alt.endpoint,
            confidence: alt.confidence,
            description: this.getEndpointDescription(alt.endpoint)
          }))
        };
      }
      // For other cases, provide a gentle fallback
      return {
        action: 'fallback_with_explanation',
        confidence,
        message: `I'm not completely confident about this routing (${Math.round(confidence * 100)}%). I'll try my best with general analysis.`,
        alternatives: alternatives?.slice(0, 2).map(alt => ({
          endpoint: alt.endpoint,
          confidence: alt.confidence,
          description: this.getEndpointDescription(alt.endpoint)
        }))
      };
  } else {
      return {
        action: 'reject',
        confidence,
    message: 'Query confidence too low for reliable routing. Please rephrase with more specific analysis terms.'
      };
    }
  }

  /**
   * Record user feedback for threshold adjustment
   */
  recordFeedback(feedback: UserFeedback): void {
    this.feedbackHistory.push(feedback);
    
    // Keep only recent feedback (last 30 days)
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    this.feedbackHistory = this.feedbackHistory.filter(f => f.timestamp > thirtyDaysAgo);
    
    // Update thresholds based on feedback
    this.updateThresholdsFromFeedback();
  }

  /**
   * Update thresholds based on user feedback
   */
  private updateThresholdsFromFeedback(): void {
    if (this.feedbackHistory.length < 10) {
      return; // Need minimum feedback to adjust
    }
    
    const recentFeedback = this.feedbackHistory
      .filter(f => f.timestamp > Date.now() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
    
    if (recentFeedback.length < 5) {
      return;
    }
    
    const successRate = recentFeedback.filter(f => f.was_correct).length / recentFeedback.length;
    const avgRating = recentFeedback.reduce((sum, f) => sum + f.user_rating, 0) / recentFeedback.length;
    
    // Adjust thresholds based on performance
    if (successRate < 0.8 || avgRating < 3.5) {
      // System is over-confident, raise thresholds
      this.thresholds.high_confidence = Math.min(0.95, this.thresholds.high_confidence + 0.05);
      this.thresholds.medium_confidence = Math.min(0.85, this.thresholds.medium_confidence + 0.05);
      this.thresholds.low_confidence = Math.min(0.7, this.thresholds.low_confidence + 0.05);
    } else if (successRate > 0.95 && avgRating > 4.2) {
      // System is under-confident, lower thresholds slightly
      this.thresholds.high_confidence = Math.max(0.7, this.thresholds.high_confidence - 0.02);
      this.thresholds.medium_confidence = Math.max(0.5, this.thresholds.medium_confidence - 0.02);
      this.thresholds.low_confidence = Math.max(0.3, this.thresholds.low_confidence - 0.02);
    }
    
    console.log(`[ConfidenceManager] Updated thresholds based on ${recentFeedback.length} feedback entries. Success rate: ${Math.round(successRate * 100)}%, Avg rating: ${avgRating.toFixed(1)}`);
  }

  /**
   * Adjust thresholds based on validation result
   */
  private adjustThresholdsForValidation(validation: ValidationResult): ConfidenceThresholds {
    const adjusted = { ...this.thresholds };
    
    // Lower thresholds for borderline queries (give them more chance)
    if (validation.scope === QueryScope.BORDERLINE) {
      adjusted.high_confidence *= 0.9;
      adjusted.medium_confidence *= 0.85;
      adjusted.low_confidence *= 0.8;
    }
    
    // Raise thresholds for queries with low domain confidence
    if (validation.confidence < 0.5) {
      adjusted.high_confidence *= 1.1;
      adjusted.medium_confidence *= 1.05;
    }
    
    return adjusted;
  }

  /**
   * Get endpoint description for user display
   */
  private getEndpointDescription(endpoint: string): string {
    const descriptions: { [key: string]: string } = {
      '/analyze': 'General market analysis and insights',
      '/strategic-analysis': 'Strategic opportunities and expansion analysis',
      '/demographic-insights': 'Population and demographic analysis',
      '/competitive-analysis': 'Market competition and positioning',
      '/customer-profile': 'Ideal customer profiles and personas',
      '/comparative-analysis': 'Compare performance between locations',
      '/brand-difference': 'Brand positioning and market differences',
      '/predictive-modeling': 'Future market predictions',
      '/spatial-clusters': 'Geographic market segmentation',
      '/correlation-analysis': 'Relationship analysis between factors',
      '/trend-analysis': 'Market trends and growth patterns',
      '/scenario-analysis': 'What-if scenario modeling',
      '/outlier-detection': 'Identify unusual market characteristics',
      '/feature-importance-ranking': 'Most important predictive factors',
      '/model-performance': 'Prediction accuracy assessment'
    };
    
    return descriptions[endpoint] || 'Specialized market analysis';
  }

  /**
   * Get current threshold configuration
   */
  getThresholds(): ConfidenceThresholds {
    return { ...this.thresholds };
  }

  /**
   * Manually update thresholds (for testing or admin adjustment)
   */
  updateThresholds(updates: Partial<ConfidenceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...updates };
    
    // Validate threshold ordering
    if (this.thresholds.high_confidence <= this.thresholds.medium_confidence ||
        this.thresholds.medium_confidence <= this.thresholds.low_confidence ||
        this.thresholds.low_confidence <= this.thresholds.validation_threshold) {
      throw new Error('Thresholds must be in descending order: high > medium > low > validation');
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    total_feedback: number;
    success_rate: number | null;
    avg_rating: number | null;
    confidence_calibration: Array<{ threshold: number; accuracy: number | null; count: number }> | null;
    current_thresholds?: ConfidenceThresholds;
  } {
    if (this.feedbackHistory.length === 0) {
      return {
        total_feedback: 0,
        success_rate: null,
        avg_rating: null,
        confidence_calibration: null
      };
    }
    
    const successRate = this.feedbackHistory.filter(f => f.was_correct).length / this.feedbackHistory.length;
    const avgRating = this.feedbackHistory.reduce((sum, f) => sum + f.user_rating, 0) / this.feedbackHistory.length;
    
    // Calculate confidence calibration (how well confidence predicts success)
    const calibrationBuckets = [0.2, 0.4, 0.6, 0.8, 1.0];
    const calibration = calibrationBuckets.map(threshold => {
      const feedbackInBucket = this.feedbackHistory.filter(f => 
        f.confidence_at_routing >= (threshold - 0.2) && f.confidence_at_routing < threshold
      );
      
      if (feedbackInBucket.length === 0) return { threshold, accuracy: null, count: 0 };
      
      const accuracy = feedbackInBucket.filter(f => f.was_correct).length / feedbackInBucket.length;
      return { threshold, accuracy, count: feedbackInBucket.length };
    });
    
  return {
      total_feedback: this.feedbackHistory.length,
      success_rate: successRate,
      avg_rating: avgRating,
      confidence_calibration: calibration,
      current_thresholds: this.thresholds
    };
  }

  /**
   * Simulate feedback for testing
   */
  simulateFeedback(scenarios: Array<{
    query: string;
    endpoint: string;
    confidence: number;
    wasCorrect: boolean;
    rating: number;
  }>): void {
    const now = Date.now();
    
    for (const scenario of scenarios) {
      this.recordFeedback({
        query: scenario.query,
        routed_endpoint: scenario.endpoint,
        was_correct: scenario.wasCorrect,
        user_rating: scenario.rating,
        timestamp: now - Math.random() * 7 * 24 * 60 * 60 * 1000, // Random time within last week
        confidence_at_routing: scenario.confidence
      });
    }
  }

  /**
   * Reset to default thresholds
   */
  resetToDefaults(): void {
    this.thresholds = {
      high_confidence: 0.8,
      medium_confidence: 0.6,
      low_confidence: 0.4,
      validation_threshold: 0.2,
      user_feedback_weight: 0.3,
      historical_success_weight: 0.4,
      domain_specificity_bonus: 0.1
    };
    this.feedbackHistory = [];
  }
}