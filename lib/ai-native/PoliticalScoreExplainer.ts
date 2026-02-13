/**
 * PoliticalScoreExplainer
 *
 * Generates human-readable explanations for political targeting scores.
 * Uses a SHAP-style approach to decompose scores into contributing factors.
 *
 * Key Scores Explained:
 * - GOTV Priority: Value of turnout mobilization efforts
 * - Persuasion Opportunity: Proportion of persuadable voters
 * - Swing Potential: Likelihood of partisan outcome change
 * - Partisan Lean: Historical voting pattern strength
 * - Combined Score: Weighted aggregate for targeting
 */

// ============================================================================
// Types
// ============================================================================

export interface PrecinctData {
  id: string;
  name: string;
  demographics: {
    totalPopulation: number;
    population18up: number;
    medianAge: number;
    medianHHI: number;
    collegePct: number;
    homeownerPct: number;
    diversityIndex: number;
    populationDensity: number;
  };
  political: {
    demAffiliationPct: number;
    repAffiliationPct: number;
    independentPct: number;
    liberalPct: number;
    moderatePct: number;
    conservativePct: number;
  };
  electoral: {
    partisanLean: number;
    swingPotential: number;
    competitiveness: string;
    avgTurnout: number;
    turnoutDropoff: number;
  };
  targeting: {
    gotvPriority: number;
    persuasionOpportunity: number;
    combinedScore: number;
    strategy: string;
  };
  elections?: Record<string, ElectionResult>;
}

export interface ElectionResult {
  demPct: number;
  repPct: number;
  margin: number;
  turnout: number;
  ballotsCast: number;
}

export interface ScoreContribution {
  factor: string;
  value: number;
  contribution: number;
  direction: 'positive' | 'negative' | 'neutral';
  explanation: string;
}

export interface ScoreExplanation {
  scoreType: ScoreType;
  score: number;
  percentile?: number;
  rating: 'very_low' | 'low' | 'moderate' | 'high' | 'very_high';
  summary: string;
  contributions: ScoreContribution[];
  recommendations: string[];
  comparedTo?: ComparisonContext;
}

export interface ComparisonContext {
  average: number;
  countyRank: number;
  countyTotal: number;
  similarPrecincts: string[];
}

export type ScoreType =
  | 'gotv_priority'
  | 'persuasion_opportunity'
  | 'swing_potential'
  | 'partisan_lean'
  | 'combined_score';

// ============================================================================
// Constants
// ============================================================================

const SCORE_THRESHOLDS = {
  very_low: 20,
  low: 40,
  moderate: 60,
  high: 80,
  // very_high: 80+
};

const FACTOR_WEIGHTS: Record<ScoreType, Record<string, number>> = {
  gotv_priority: {
    avgTurnout: -0.35,          // Lower turnout = higher GOTV priority
    demAffiliationPct: 0.25,    // Higher Dem affiliation = higher GOTV value (for Dem campaigns)
    population18up: 0.15,       // More voters = higher value
    turnoutDropoff: 0.15,       // Higher dropoff = more room to improve
    collegePct: 0.10,           // College areas often undervote in midterms
  },
  persuasion_opportunity: {
    independentPct: 0.30,       // More independents = more persuadable
    moderatePct: 0.25,          // More moderates = more persuadable
    swingPotential: 0.20,       // Historical swing behavior
    turnoutDropoff: -0.15,      // Lower dropoff = more consistent voters to persuade
    ticketSplitting: 0.10,      // Historical ticket-splitting (if available)
  },
  swing_potential: {
    marginVolatility: 0.30,     // How much margin changes election to election
    independentPct: 0.25,       // Independent voters swing elections
    ticketSplitting: 0.20,      // Historical ticket-splitting
    competitiveRaces: 0.15,     // History of close races
    demographic_shifts: 0.10,   // Population changes that affect voting
  },
  partisan_lean: {
    demAffiliationPct: 0.35,
    historicalMargin: 0.30,
    liberalPct: 0.20,
    demVote2024: 0.15,
  },
  combined_score: {
    gotvPriority: 0.40,
    persuasionOpportunity: 0.35,
    swingPotential: 0.25,
  },
};

// ============================================================================
// Score Explainer Implementation
// ============================================================================

export class PoliticalScoreExplainer {
  private static instance: PoliticalScoreExplainer;

  private constructor() {}

  static getInstance(): PoliticalScoreExplainer {
    if (!PoliticalScoreExplainer.instance) {
      PoliticalScoreExplainer.instance = new PoliticalScoreExplainer();
    }
    return PoliticalScoreExplainer.instance;
  }

  /**
   * Generate full explanation for a score
   */
  explainScore(
    precinct: PrecinctData,
    scoreType: ScoreType,
    allPrecincts?: PrecinctData[]
  ): ScoreExplanation {
    const score = this.getScoreValue(precinct, scoreType);
    const rating = this.getRating(score);
    const contributions = this.calculateContributions(precinct, scoreType);
    const summary = this.generateSummary(precinct, scoreType, score, contributions);
    const recommendations = this.generateRecommendations(precinct, scoreType, contributions);

    const explanation: ScoreExplanation = {
      scoreType,
      score,
      rating,
      summary,
      contributions,
      recommendations,
    };

    // Add comparison context if other precincts provided
    if (allPrecincts && allPrecincts.length > 1) {
      explanation.comparedTo = this.calculateComparison(precinct, scoreType, allPrecincts);
      explanation.percentile = this.calculatePercentile(score, scoreType, allPrecincts);
    }

    return explanation;
  }

  /**
   * Generate a natural language explanation
   */
  generateNaturalLanguageExplanation(
    precinct: PrecinctData,
    scoreType: ScoreType,
    allPrecincts?: PrecinctData[]
  ): string {
    const explanation = this.explainScore(precinct, scoreType, allPrecincts);
    const parts: string[] = [];

    // Opening statement
    parts.push(explanation.summary);

    // Top contributing factors
    const topFactors = explanation.contributions
      .filter(c => c.direction !== 'neutral')
      .slice(0, 3);

    if (topFactors.length > 0) {
      parts.push('\n\nKey factors:');
      topFactors.forEach((factor, i) => {
        const direction = factor.direction === 'positive' ? 'increases' : 'decreases';
        parts.push(`${i + 1}. ${factor.factor}: ${factor.explanation} (${direction} score by ${Math.abs(factor.contribution).toFixed(0)} points)`);
      });
    }

    // Comparison context
    if (explanation.comparedTo) {
      const ctx = explanation.comparedTo;
      parts.push(`\n\nThis ranks #${ctx.countyRank} out of ${ctx.countyTotal} precincts in Ingham County.`);
      if (explanation.percentile) {
        parts.push(`That's the ${this.ordinal(explanation.percentile)} percentile.`);
      }
    }

    // Top recommendation
    if (explanation.recommendations.length > 0) {
      parts.push(`\n\nRecommendation: ${explanation.recommendations[0]}`);
    }

    return parts.join('\n');
  }

  /**
   * Get the raw score value from precinct data
   */
  private getScoreValue(precinct: PrecinctData, scoreType: ScoreType): number {
    switch (scoreType) {
      case 'gotv_priority':
        return precinct.targeting.gotvPriority;
      case 'persuasion_opportunity':
        return precinct.targeting.persuasionOpportunity;
      case 'swing_potential':
        return precinct.electoral.swingPotential;
      case 'partisan_lean':
        return precinct.electoral.partisanLean;
      case 'combined_score':
        return precinct.targeting.combinedScore;
      default:
        return 0;
    }
  }

  /**
   * Get rating from score value
   */
  private getRating(score: number): ScoreExplanation['rating'] {
    if (score < SCORE_THRESHOLDS.very_low) return 'very_low';
    if (score < SCORE_THRESHOLDS.low) return 'low';
    if (score < SCORE_THRESHOLDS.moderate) return 'moderate';
    if (score < SCORE_THRESHOLDS.high) return 'high';
    return 'very_high';
  }

  /**
   * Calculate contribution of each factor to the score
   */
  private calculateContributions(
    precinct: PrecinctData,
    scoreType: ScoreType
  ): ScoreContribution[] {
    const contributions: ScoreContribution[] = [];

    switch (scoreType) {
      case 'gotv_priority':
        contributions.push(...this.calculateGOTVContributions(precinct));
        break;
      case 'persuasion_opportunity':
        contributions.push(...this.calculatePersuasionContributions(precinct));
        break;
      case 'swing_potential':
        contributions.push(...this.calculateSwingContributions(precinct));
        break;
      case 'partisan_lean':
        contributions.push(...this.calculatePartisanLeanContributions(precinct));
        break;
      case 'combined_score':
        contributions.push(...this.calculateCombinedContributions(precinct));
        break;
    }

    // Sort by absolute contribution
    return contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  }

  /**
   * Calculate GOTV Priority contributions
   */
  private calculateGOTVContributions(precinct: PrecinctData): ScoreContribution[] {
    const contributions: ScoreContribution[] = [];
    const { electoral, political, demographics } = precinct;

    // Low turnout = high GOTV priority
    const turnoutContrib = (60 - electoral.avgTurnout) * 1.2;
    contributions.push({
      factor: 'Average Turnout',
      value: electoral.avgTurnout,
      contribution: turnoutContrib,
      direction: turnoutContrib > 5 ? 'positive' : turnoutContrib < -5 ? 'negative' : 'neutral',
      explanation: electoral.avgTurnout < 50
        ? `Low turnout (${electoral.avgTurnout.toFixed(1)}%) means significant room for GOTV gains`
        : `Average turnout (${electoral.avgTurnout.toFixed(1)}%) limits GOTV ceiling`,
    });

    // Turnout dropoff midterm vs presidential
    const dropoffContrib = electoral.turnoutDropoff * 0.8;
    contributions.push({
      factor: 'Midterm Dropoff',
      value: electoral.turnoutDropoff,
      contribution: dropoffContrib,
      direction: dropoffContrib > 5 ? 'positive' : dropoffContrib < -5 ? 'negative' : 'neutral',
      explanation: electoral.turnoutDropoff > 15
        ? `High midterm dropoff (${electoral.turnoutDropoff.toFixed(1)}%) suggests many mobilizable voters`
        : `Low dropoff (${electoral.turnoutDropoff.toFixed(1)}%) indicates consistent voters`,
    });

    // Democratic affiliation (for Dem campaigns)
    const demContrib = (political.demAffiliationPct - 40) * 0.5;
    contributions.push({
      factor: 'Democratic Affiliation',
      value: political.demAffiliationPct,
      contribution: demContrib,
      direction: demContrib > 5 ? 'positive' : demContrib < -5 ? 'negative' : 'neutral',
      explanation: political.demAffiliationPct > 50
        ? `Strong Democratic base (${political.demAffiliationPct.toFixed(1)}%) makes GOTV highly valuable`
        : `Lower Democratic affiliation (${political.demAffiliationPct.toFixed(1)}%) reduces GOTV ROI`,
    });

    // Population size
    const popContrib = Math.min(demographics.population18up / 100, 20);
    contributions.push({
      factor: 'Voter Population',
      value: demographics.population18up,
      contribution: popContrib,
      direction: popContrib > 10 ? 'positive' : 'neutral',
      explanation: `${demographics.population18up.toLocaleString()} voting-age adults`,
    });

    return contributions;
  }

  /**
   * Calculate Persuasion Opportunity contributions
   */
  private calculatePersuasionContributions(precinct: PrecinctData): ScoreContribution[] {
    const contributions: ScoreContribution[] = [];
    const { political, electoral } = precinct;

    // Independent voters
    const indContrib = political.independentPct * 1.5;
    contributions.push({
      factor: 'Independent Voters',
      value: political.independentPct,
      contribution: indContrib,
      direction: indContrib > 15 ? 'positive' : indContrib < 5 ? 'negative' : 'neutral',
      explanation: political.independentPct > 25
        ? `High independent rate (${political.independentPct.toFixed(1)}%) provides large persuasion pool`
        : `Lower independent rate (${political.independentPct.toFixed(1)}%) limits persuadable targets`,
    });

    // Moderate voters
    const modContrib = political.moderatePct * 1.2;
    contributions.push({
      factor: 'Moderate Ideology',
      value: political.moderatePct,
      contribution: modContrib,
      direction: modContrib > 15 ? 'positive' : modContrib < 5 ? 'negative' : 'neutral',
      explanation: political.moderatePct > 30
        ? `Strong moderate population (${political.moderatePct.toFixed(1)}%) increases persuasion targets`
        : `Few moderates (${political.moderatePct.toFixed(1)}%) suggests partisan polarization`,
    });

    // Swing potential
    const swingContrib = electoral.swingPotential * 0.3;
    contributions.push({
      factor: 'Historical Swing',
      value: electoral.swingPotential,
      contribution: swingContrib,
      direction: swingContrib > 10 ? 'positive' : swingContrib < 5 ? 'negative' : 'neutral',
      explanation: electoral.swingPotential > 40
        ? `High swing history (${electoral.swingPotential}) shows voters are persuadable`
        : `Low swing score (${electoral.swingPotential}) indicates stable preferences`,
    });

    return contributions;
  }

  /**
   * Calculate Swing Potential contributions
   */
  private calculateSwingContributions(precinct: PrecinctData): ScoreContribution[] {
    const contributions: ScoreContribution[] = [];
    const { political, electoral, elections } = precinct;

    // Competitiveness
    const isCompetitive = electoral.competitiveness.includes('toss') ||
                         electoral.competitiveness.includes('lean');
    contributions.push({
      factor: 'Competitiveness Rating',
      value: isCompetitive ? 1 : 0,
      contribution: isCompetitive ? 25 : -10,
      direction: isCompetitive ? 'positive' : 'negative',
      explanation: `Currently rated as ${electoral.competitiveness.replace('_', ' ')}`,
    });

    // Independent voter percentage
    const indContrib = political.independentPct * 0.8;
    contributions.push({
      factor: 'Independent Voters',
      value: political.independentPct,
      contribution: indContrib,
      direction: indContrib > 10 ? 'positive' : 'neutral',
      explanation: `${political.independentPct.toFixed(1)}% independent voters can swing elections`,
    });

    // Margin volatility (if historical data available)
    if (elections) {
      const margins = Object.values(elections).map(e => e.margin);
      if (margins.length >= 2) {
        const volatility = Math.abs(margins[0] - margins[1]);
        const volContrib = volatility * 0.5;
        contributions.push({
          factor: 'Margin Volatility',
          value: volatility,
          contribution: volContrib,
          direction: volContrib > 10 ? 'positive' : 'neutral',
          explanation: volatility > 10
            ? `Margin swung ${volatility.toFixed(1)} points between elections`
            : `Relatively stable margins between elections`,
        });
      }
    }

    // Partisan lean magnitude (lower = more swingable)
    const leanContrib = (50 - Math.abs(electoral.partisanLean)) * 0.4;
    contributions.push({
      factor: 'Partisan Lean',
      value: electoral.partisanLean,
      contribution: leanContrib,
      direction: Math.abs(electoral.partisanLean) < 15 ? 'positive' : 'negative',
      explanation: Math.abs(electoral.partisanLean) < 10
        ? `Near-neutral lean (+${electoral.partisanLean}D) makes outcomes uncertain`
        : `Strong lean (${electoral.partisanLean > 0 ? '+' : ''}${electoral.partisanLean}D) reduces swing likelihood`,
    });

    return contributions;
  }

  /**
   * Calculate Partisan Lean contributions
   */
  private calculatePartisanLeanContributions(precinct: PrecinctData): ScoreContribution[] {
    const contributions: ScoreContribution[] = [];
    const { political, electoral, elections } = precinct;

    // Democratic affiliation
    const demContrib = (political.demAffiliationPct - 50) * 0.8;
    contributions.push({
      factor: 'Democratic Affiliation',
      value: political.demAffiliationPct,
      contribution: demContrib,
      direction: demContrib > 5 ? 'positive' : demContrib < -5 ? 'negative' : 'neutral',
      explanation: `${political.demAffiliationPct.toFixed(1)}% Democratic affiliation`,
    });

    // Liberal ideology
    const libContrib = (political.liberalPct - 35) * 0.6;
    contributions.push({
      factor: 'Liberal Ideology',
      value: political.liberalPct,
      contribution: libContrib,
      direction: libContrib > 5 ? 'positive' : libContrib < -5 ? 'negative' : 'neutral',
      explanation: `${political.liberalPct.toFixed(1)}% self-identify as liberal`,
    });

    // 2024 results
    if (elections?.['2024']) {
      const resultContrib = (elections['2024'].demPct - 50) * 0.7;
      contributions.push({
        factor: '2024 Election Result',
        value: elections['2024'].demPct,
        contribution: resultContrib,
        direction: resultContrib > 5 ? 'positive' : resultContrib < -5 ? 'negative' : 'neutral',
        explanation: `Democrats won ${elections['2024'].demPct.toFixed(1)}% in 2024`,
      });
    }

    return contributions;
  }

  /**
   * Calculate Combined Score contributions
   */
  private calculateCombinedContributions(precinct: PrecinctData): ScoreContribution[] {
    const { targeting } = precinct;
    const contributions: ScoreContribution[] = [];

    // GOTV Priority (40% weight)
    const gotvContrib = targeting.gotvPriority * 0.4;
    contributions.push({
      factor: 'GOTV Priority',
      value: targeting.gotvPriority,
      contribution: gotvContrib,
      direction: gotvContrib > 20 ? 'positive' : gotvContrib < 10 ? 'negative' : 'neutral',
      explanation: `GOTV score of ${targeting.gotvPriority} (40% weight)`,
    });

    // Persuasion (35% weight)
    const persContrib = targeting.persuasionOpportunity * 0.35;
    contributions.push({
      factor: 'Persuasion Opportunity',
      value: targeting.persuasionOpportunity,
      contribution: persContrib,
      direction: persContrib > 15 ? 'positive' : persContrib < 8 ? 'negative' : 'neutral',
      explanation: `Persuasion score of ${targeting.persuasionOpportunity} (35% weight)`,
    });

    // Swing (25% weight)
    const swingContrib = precinct.electoral.swingPotential * 0.25;
    contributions.push({
      factor: 'Swing Potential',
      value: precinct.electoral.swingPotential,
      contribution: swingContrib,
      direction: swingContrib > 10 ? 'positive' : swingContrib < 5 ? 'negative' : 'neutral',
      explanation: `Swing score of ${precinct.electoral.swingPotential} (25% weight)`,
    });

    return contributions;
  }

  /**
   * Generate summary text for explanation
   */
  private generateSummary(
    precinct: PrecinctData,
    scoreType: ScoreType,
    score: number,
    contributions: ScoreContribution[]
  ): string {
    const rating = this.getRating(score);
    const topFactor = contributions[0];
    const scoreName = this.getScoreName(scoreType);

    const ratingText: Record<typeof rating, string> = {
      very_high: 'exceptionally high',
      high: 'high',
      moderate: 'moderate',
      low: 'low',
      very_low: 'very low',
    };

    return `${precinct.name} has a ${ratingText[rating]} ${scoreName} of ${score}/100. ` +
           `The biggest factor is ${topFactor.factor.toLowerCase()}: ${topFactor.explanation.toLowerCase()}`;
  }

  /**
   * Generate recommendations based on score analysis
   */
  private generateRecommendations(
    precinct: PrecinctData,
    scoreType: ScoreType,
    contributions: ScoreContribution[]
  ): string[] {
    const recommendations: string[] = [];
    const strategy = precinct.targeting.strategy;

    switch (scoreType) {
      case 'gotv_priority':
        if (precinct.targeting.gotvPriority > 70) {
          recommendations.push('Prioritize this precinct for door-to-door canvassing and phone banking');
          recommendations.push('Focus on voters who voted in 2020 but skipped 2022');
        } else if (precinct.targeting.gotvPriority < 40) {
          recommendations.push('Deprioritize for GOTV - resources better spent elsewhere');
        }
        break;

      case 'persuasion_opportunity':
        if (precinct.targeting.persuasionOpportunity > 60) {
          recommendations.push('Ideal target for persuasion mail and digital advertising');
          recommendations.push('Focus messaging on moderate positions and local issues');
        }
        break;

      case 'swing_potential':
        if (precinct.electoral.swingPotential > 50) {
          recommendations.push('Monitor this precinct closely - outcomes are unpredictable');
          recommendations.push('Invest in both persuasion AND turnout operations');
        }
        break;

      case 'combined_score':
        recommendations.push(`Recommended strategy: ${strategy}`);
        if (precinct.targeting.combinedScore > 70) {
          recommendations.push('This is a high-priority precinct - allocate maximum resources');
        }
        break;
    }

    return recommendations;
  }

  /**
   * Calculate comparison context
   */
  private calculateComparison(
    precinct: PrecinctData,
    scoreType: ScoreType,
    allPrecincts: PrecinctData[]
  ): ComparisonContext {
    const scores = allPrecincts.map(p => ({
      id: p.id,
      score: this.getScoreValue(p, scoreType),
    }));

    scores.sort((a, b) => b.score - a.score);
    const rank = scores.findIndex(s => s.id === precinct.id) + 1;
    const avg = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;

    // Find similar precincts (within 5 points)
    const targetScore = this.getScoreValue(precinct, scoreType);
    const similar = scores
      .filter(s => s.id !== precinct.id && Math.abs(s.score - targetScore) <= 5)
      .slice(0, 3)
      .map(s => allPrecincts.find(p => p.id === s.id)?.name || s.id);

    return {
      average: Math.round(avg),
      countyRank: rank,
      countyTotal: allPrecincts.length,
      similarPrecincts: similar,
    };
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(
    score: number,
    scoreType: ScoreType,
    allPrecincts: PrecinctData[]
  ): number {
    const scores = allPrecincts.map(p => this.getScoreValue(p, scoreType)).sort((a, b) => a - b);
    const below = scores.filter(s => s < score).length;
    return Math.round((below / scores.length) * 100);
  }

  /**
   * Get human-readable score name
   */
  private getScoreName(scoreType: ScoreType): string {
    const names: Record<ScoreType, string> = {
      gotv_priority: 'GOTV Priority',
      persuasion_opportunity: 'Persuasion Opportunity',
      swing_potential: 'Swing Potential',
      partisan_lean: 'Partisan Lean',
      combined_score: 'Combined Targeting Score',
    };
    return names[scoreType];
  }

  /**
   * Get ordinal suffix for a number
   */
  private ordinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
}

// ============================================================================
// Export singleton
// ============================================================================

export const scoreExplainer = PoliticalScoreExplainer.getInstance();

export default PoliticalScoreExplainer;
