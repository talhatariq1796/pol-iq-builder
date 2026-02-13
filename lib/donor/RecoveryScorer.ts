/**
 * RecoveryScorer - Advanced scoring for lapsed donor recovery potential
 *
 * This class provides sophisticated scoring algorithms for lapsed donor recovery,
 * considering multiple factors beyond basic RFM analysis. It integrates demographic
 * data, geographic context, and behavioral patterns to predict which lapsed donors
 * are most likely to give again.
 *
 * Key Features:
 * - Multi-factor recovery scoring (0-100)
 * - Channel recommendation based on value and accessibility
 * - Demographic enhancement of recovery predictions
 * - Behavioral pattern analysis
 *
 * @module lib/donor/RecoveryScorer
 */

import type { LapsedDonor } from './LapsedDonorAnalyzer';

/**
 * Enhanced recovery score with component breakdown
 */
export interface RecoveryScoreDetailed {
  donorId: string;
  totalScore: number; // 0-100
  components: {
    lapseRecency: number; // How recently they lapsed (0-100)
    historicalValue: number; // Historical giving capacity (0-100)
    givingConsistency: number; // Pattern regularity (0-100)
    relationshipTenure: number; // Length of relationship (0-100)
    demographicMatch: number; // Demographic favorability (0-100)
  };
  confidence: number; // 0-100 confidence in score
  recommendedChannel: 'door' | 'phone' | 'mail' | 'digital';
  recommendedMessage: string;
  estimatedRecoveryAmount: number;
  estimatedRecoveryProbability: number; // 0-1
}

/**
 * Channel recommendation with reasoning
 */
export interface ChannelRecommendation {
  channel: 'door' | 'phone' | 'mail' | 'digital';
  priority: 1 | 2 | 3; // 1 = primary, 2 = secondary, 3 = tertiary
  reasoning: string;
  estimatedCostPerContact: number;
  estimatedResponseRate: number;
}

/**
 * Message recommendation based on donor characteristics
 */
export interface MessageRecommendation {
  tone: 'personal' | 'formal' | 'casual' | 'urgent';
  emphasis: 'impact' | 'community' | 'urgency' | 'gratitude';
  suggestedThemes: string[];
  avoidThemes: string[];
}

export class RecoveryScorer {
  /**
   * Calculate detailed recovery score with component breakdown
   *
   * @param lapsedDonor - Lapsed donor to score
   * @returns Detailed recovery score with components
   */
  calculateDetailedScore(lapsedDonor: LapsedDonor): RecoveryScoreDetailed {
    // Calculate each component
    const lapseRecency = this.scoreLapseRecency(lapsedDonor.monthsSinceLastGift);
    const historicalValue = this.scoreHistoricalValue(
      lapsedDonor.totalHistoricalAmount,
      lapsedDonor.giftCount
    );
    const givingConsistency = this.scoreGivingConsistency(
      lapsedDonor.historicalFrequencyScore
    );
    const relationshipTenure = this.scoreRelationshipTenure(
      lapsedDonor.daysSinceLastGift,
      lapsedDonor.giftCount
    );
    const demographicMatch = this.scoreDemographicMatch(lapsedDonor.zipCode);

    // Calculate weighted total score
    const totalScore = Math.round(
      lapseRecency * 0.25 +
        historicalValue * 0.3 +
        givingConsistency * 0.2 +
        relationshipTenure * 0.15 +
        demographicMatch * 0.1
    );

    // Calculate confidence based on data completeness
    const confidence = this.calculateConfidence(lapsedDonor);

    // Recommend channel
    const recommendedChannel = this.recommendChannel(
      lapsedDonor.totalHistoricalAmount,
      lapsedDonor.avgGift,
      totalScore
    );

    // Recommend message approach
    const messageRec = this.recommendMessage(lapsedDonor);

    // Estimate recovery amount and probability
    const { amount, probability } = this.estimateRecovery(
      lapsedDonor,
      totalScore
    );

    return {
      donorId: lapsedDonor.donorId,
      totalScore,
      components: {
        lapseRecency,
        historicalValue,
        givingConsistency,
        relationshipTenure,
        demographicMatch,
      },
      confidence,
      recommendedChannel,
      recommendedMessage: messageRec.suggestedThemes[0] || 'Impact story',
      estimatedRecoveryAmount: amount,
      estimatedRecoveryProbability: probability,
    };
  }

  /**
   * Score lapse recency (0-100)
   * Sweet spot: 6-12 months lapsed
   */
  private scoreLapseRecency(monthsSinceLapse: number): number {
    if (monthsSinceLapse < 3) {
      return 40; // Too fresh
    } else if (monthsSinceLapse <= 6) {
      return 100; // Ideal window
    } else if (monthsSinceLapse <= 12) {
      return 90; // Good window
    } else if (monthsSinceLapse <= 18) {
      return 70; // Moderate window
    } else if (monthsSinceLapse <= 24) {
      return 50; // Long lapse
    } else if (monthsSinceLapse <= 36) {
      return 30; // Very long lapse
    } else {
      return Math.max(10, 30 - (monthsSinceLapse - 36) * 2); // Decay
    }
  }

  /**
   * Score historical value (0-100)
   * Based on lifetime giving and gift count
   */
  private scoreHistoricalValue(totalAmount: number, giftCount: number): number {
    // Amount component (0-100)
    let amountScore: number;
    if (totalAmount >= 5000) {
      amountScore = 100;
    } else if (totalAmount >= 1000) {
      amountScore = 80 + ((totalAmount - 1000) / 4000) * 20;
    } else if (totalAmount >= 500) {
      amountScore = 60 + ((totalAmount - 500) / 500) * 20;
    } else if (totalAmount >= 200) {
      amountScore = 40 + ((totalAmount - 200) / 300) * 20;
    } else {
      amountScore = (totalAmount / 200) * 40;
    }

    // Gift count component (0-100)
    let countScore: number;
    if (giftCount >= 20) {
      countScore = 100;
    } else if (giftCount >= 10) {
      countScore = 80 + ((giftCount - 10) / 10) * 20;
    } else if (giftCount >= 5) {
      countScore = 60 + ((giftCount - 5) / 5) * 20;
    } else {
      countScore = (giftCount / 5) * 60;
    }

    // Weighted average: 70% amount, 30% count
    return Math.round(amountScore * 0.7 + countScore * 0.3);
  }

  /**
   * Score giving consistency (0-100)
   * Based on historical frequency score
   */
  private scoreGivingConsistency(frequencyScore: number): number {
    // Frequency score is 1-5, convert to 0-100
    return ((frequencyScore - 1) / 4) * 100;
  }

  /**
   * Score relationship tenure (0-100)
   * Longer relationships = higher score
   */
  private scoreRelationshipTenure(
    daysSinceLastGift: number,
    giftCount: number
  ): number {
    // Estimate relationship length from gift count and lapse time
    // Assume avg 90 days between gifts during active period
    const estimatedActiveMonths = (giftCount * 90) / 30;

    if (estimatedActiveMonths >= 36) {
      return 100; // 3+ years
    } else if (estimatedActiveMonths >= 24) {
      return 85; // 2-3 years
    } else if (estimatedActiveMonths >= 12) {
      return 70; // 1-2 years
    } else if (estimatedActiveMonths >= 6) {
      return 50; // 6-12 months
    } else {
      return 30; // < 6 months
    }
  }

  /**
   * Score demographic match (0-100)
   * Based on ZIP code characteristics
   *
   * Note: Demographic data integration is available via precinct cross-reference.
   * To enhance this score, cross-reference donor ZIP codes with precinct demographics
   * from PoliticalDataService to access income, education, and Tapestry segments.
   * This would allow scoring based on demographic profiles that correlate with
   * donor recovery likelihood (e.g., higher education levels, median income bands).
   */
  private scoreDemographicMatch(zipCode: string): number {
    // For MVP, return neutral score
    // Future enhancement: Cross-reference with precinct demographics via
    // ZIP-to-precinct mapping to access ArcGIS Business Analyst data
    return 50; // Neutral
  }

  /**
   * Calculate confidence in score (0-100)
   * Based on data completeness and quality
   */
  private calculateConfidence(lapsedDonor: LapsedDonor): number {
    let confidence = 100;

    // Reduce confidence for low gift count (less behavioral data)
    if (lapsedDonor.giftCount < 3) {
      confidence -= 30;
    } else if (lapsedDonor.giftCount < 5) {
      confidence -= 15;
    }

    // Reduce confidence for very long lapse (harder to predict)
    if (lapsedDonor.monthsSinceLastGift > 24) {
      confidence -= 20;
    } else if (lapsedDonor.monthsSinceLastGift > 18) {
      confidence -= 10;
    }

    // Reduce confidence for unknown party
    if (lapsedDonor.likelyParty === 'unknown') {
      confidence -= 10;
    }

    return Math.max(0, Math.min(100, confidence));
  }

  /**
   * Recommend outreach channel based on value and score
   */
  private recommendChannel(
    totalAmount: number,
    avgGift: number,
    recoveryScore: number
  ): 'door' | 'phone' | 'mail' | 'digital' {
    // High value ($1000+) → Phone
    if (totalAmount >= 1000) {
      return 'phone';
    }

    // Medium-high value ($500-$1000) + high score → Phone or mail
    if (totalAmount >= 500 && recoveryScore >= 70) {
      return 'phone';
    } else if (totalAmount >= 500) {
      return 'mail';
    }

    // Medium value ($200-$500) + high score → Door or mail
    if (totalAmount >= 200 && recoveryScore >= 70) {
      return 'door';
    } else if (totalAmount >= 200) {
      return 'mail';
    }

    // Lower value or score → Digital
    return 'digital';
  }

  /**
   * Recommend message approach based on donor characteristics
   */
  private recommendMessage(lapsedDonor: LapsedDonor): MessageRecommendation {
    const { totalHistoricalAmount, monthsSinceLastGift, giftCount } =
      lapsedDonor;

    let tone: MessageRecommendation['tone'] = 'casual';
    let emphasis: MessageRecommendation['emphasis'] = 'impact';
    const suggestedThemes: string[] = [];
    const avoidThemes: string[] = [];

    // High value donors → Formal, grateful tone
    if (totalHistoricalAmount >= 1000) {
      tone = 'formal';
      emphasis = 'gratitude';
      suggestedThemes.push('Personal thank you', 'Impact of past support');
      avoidThemes.push('Urgent asks', 'Generic appeals');
    }
    // Medium value → Personal tone
    else if (totalHistoricalAmount >= 200) {
      tone = 'personal';
      emphasis = 'impact';
      suggestedThemes.push('Impact story', 'Community connection');
      avoidThemes.push('Overly formal', 'Too casual');
    }
    // Lower value → Casual, community-focused
    else {
      tone = 'casual';
      emphasis = 'community';
      suggestedThemes.push('Community updates', 'Easy giving options');
      avoidThemes.push('Large ask amounts', 'Formal language');
    }

    // Recent lapse (<12 months) → "We miss you"
    if (monthsSinceLastGift <= 12) {
      suggestedThemes.push('We miss you', 'What\'s changed');
    }

    // Long lapse (>18 months) → Re-introduction
    if (monthsSinceLastGift > 18) {
      suggestedThemes.push('Re-introduction', 'Fresh start');
      emphasis = 'urgency';
    }

    // Frequent past donor → Emphasize consistency
    if (giftCount >= 10) {
      suggestedThemes.push('Resume monthly giving', 'Sustainer program');
    }

    return {
      tone,
      emphasis,
      suggestedThemes,
      avoidThemes,
    };
  }

  /**
   * Estimate recovery amount and probability
   */
  private estimateRecovery(
    lapsedDonor: LapsedDonor,
    recoveryScore: number
  ): { amount: number; probability: number } {
    // Base recovery amount: 40-60% of historical average
    const baseAmount = lapsedDonor.avgGift * 0.5;

    // Adjust by recovery score
    const scoreMultiplier = 0.5 + (recoveryScore / 100) * 0.5; // 0.5-1.0
    const amount = Math.round(baseAmount * scoreMultiplier);

    // Probability based on recovery score
    // Score 90+ = 40% probability
    // Score 70-89 = 30% probability
    // Score 50-69 = 20% probability
    // Score <50 = 10% probability
    let probability: number;
    if (recoveryScore >= 90) {
      probability = 0.4;
    } else if (recoveryScore >= 70) {
      probability = 0.3;
    } else if (recoveryScore >= 50) {
      probability = 0.2;
    } else {
      probability = 0.1;
    }

    // Adjust for lapse duration
    if (lapsedDonor.monthsSinceLastGift > 24) {
      probability *= 0.7; // Reduce by 30%
    } else if (lapsedDonor.monthsSinceLastGift > 18) {
      probability *= 0.85; // Reduce by 15%
    }

    return { amount, probability };
  }

  /**
   * Get all channel recommendations ranked by suitability
   */
  getChannelRecommendations(
    lapsedDonor: LapsedDonor
  ): ChannelRecommendation[] {
    const recommendations: ChannelRecommendation[] = [];

    const { totalHistoricalAmount, avgGift } = lapsedDonor;

    // Phone banking
    const phoneScore = totalHistoricalAmount >= 500 ? 95 : 60;
    recommendations.push({
      channel: 'phone',
      priority: phoneScore >= 80 ? 1 : 2,
      reasoning:
        totalHistoricalAmount >= 1000
          ? 'High-value donor deserves personal contact'
          : 'Medium-value donor - good ROI for phone',
      estimatedCostPerContact: 5, // $5 per call (staff time)
      estimatedResponseRate: totalHistoricalAmount >= 500 ? 0.25 : 0.15,
    });

    // Mail
    const mailScore = 80; // Mail is versatile
    recommendations.push({
      channel: 'mail',
      priority: 2,
      reasoning: 'Reliable channel with good tracking',
      estimatedCostPerContact: 2, // $2 per mail piece
      estimatedResponseRate: 0.1,
    });

    // Door-to-door
    const doorScore = totalHistoricalAmount >= 100 ? 70 : 40;
    recommendations.push({
      channel: 'door',
      priority: doorScore >= 70 ? 2 : 3,
      reasoning:
        doorScore >= 70
          ? 'Medium-value donor - good for targeted canvass'
          : 'Lower value - only if in high-density area',
      estimatedCostPerContact: 3, // $3 per door (field time)
      estimatedResponseRate: 0.2,
    });

    // Digital
    const digitalScore = 60; // Always a good backup
    recommendations.push({
      channel: 'digital',
      priority: totalHistoricalAmount < 100 ? 1 : 3,
      reasoning:
        totalHistoricalAmount < 100
          ? 'Cost-effective for lower-value donors'
          : 'Good for follow-up and reminders',
      estimatedCostPerContact: 0.1, // $0.10 per email
      estimatedResponseRate: 0.05,
    });

    // Sort by priority
    recommendations.sort((a, b) => a.priority - b.priority);

    return recommendations;
  }

  /**
   * Format detailed score for display
   */
  formatDetailedScore(score: RecoveryScoreDetailed): string {
    const amount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(score.estimatedRecoveryAmount);

    return [
      `Donor ID: ${score.donorId}`,
      `Total Recovery Score: ${score.totalScore}/100 (${score.confidence}% confidence)`,
      `Component Scores:`,
      `  Lapse Recency: ${score.components.lapseRecency}/100`,
      `  Historical Value: ${score.components.historicalValue}/100`,
      `  Giving Consistency: ${score.components.givingConsistency}/100`,
      `  Relationship Tenure: ${score.components.relationshipTenure}/100`,
      `  Demographic Match: ${score.components.demographicMatch}/100`,
      `Recommended Channel: ${score.recommendedChannel.toUpperCase()}`,
      `Message Theme: ${score.recommendedMessage}`,
      `Estimated Recovery: ${amount} (${(score.estimatedRecoveryProbability * 100).toFixed(0)}% probability)`,
    ].join('\n');
  }
}
