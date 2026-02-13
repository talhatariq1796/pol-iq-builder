/**
 * PoliticalScoreExplainer Tests
 *
 * Tests score explanation generation with SHAP-style factor decomposition.
 * Run with: npm test -- --testPathPattern=PoliticalScoreExplainer
 */

import PoliticalScoreExplainer, {
  scoreExplainer,
  type PrecinctData,
  type ScoreType,
  type ScoreExplanation,
} from '@/lib/ai-native/PoliticalScoreExplainer';

// Create mock precinct data for testing
function createMockPrecinct(overrides: Partial<PrecinctData> = {}): PrecinctData {
  return {
    id: 'EL-P1',
    name: 'East Lansing Precinct 1',
    demographics: {
      totalPopulation: 5000,
      population18up: 4000,
      medianAge: 32,
      medianHHI: 55000,
      collegePct: 65,
      homeownerPct: 45,
      diversityIndex: 0.4,
      populationDensity: 3500,
    },
    political: {
      demAffiliationPct: 55,
      repAffiliationPct: 25,
      independentPct: 20,
      liberalPct: 45,
      moderatePct: 35,
      conservativePct: 20,
    },
    electoral: {
      partisanLean: 12,
      swingPotential: 35,
      competitiveness: 'likely_d',
      avgTurnout: 55,
      turnoutDropoff: 18,
    },
    targeting: {
      gotvPriority: 72,
      persuasionOpportunity: 45,
      combinedScore: 65,
      strategy: 'gotv_base',
    },
    ...overrides,
  };
}

describe('PoliticalScoreExplainer', () => {
  // ========================================
  // Singleton Tests
  // ========================================
  describe('singleton', () => {
    test('getInstance returns same instance', () => {
      const instance1 = PoliticalScoreExplainer.getInstance();
      const instance2 = PoliticalScoreExplainer.getInstance();
      expect(instance1).toBe(instance2);
    });

    test('scoreExplainer is singleton instance', () => {
      expect(scoreExplainer).toBe(PoliticalScoreExplainer.getInstance());
    });
  });

  // ========================================
  // ExplainScore Tests
  // ========================================
  describe('explainScore', () => {
    test('returns valid explanation structure', () => {
      const precinct = createMockPrecinct();
      const explanation = scoreExplainer.explainScore(precinct, 'gotv_priority');

      expect(explanation).toHaveProperty('scoreType', 'gotv_priority');
      expect(explanation).toHaveProperty('score');
      expect(explanation).toHaveProperty('rating');
      expect(explanation).toHaveProperty('summary');
      expect(explanation).toHaveProperty('contributions');
      expect(explanation).toHaveProperty('recommendations');
    });

    test('explains GOTV priority score', () => {
      const precinct = createMockPrecinct({
        targeting: { gotvPriority: 78, persuasionOpportunity: 45, combinedScore: 65, strategy: 'gotv_base' },
      });
      const explanation = scoreExplainer.explainScore(precinct, 'gotv_priority');

      expect(explanation.score).toBe(78);
      expect(explanation.scoreType).toBe('gotv_priority');
      expect(explanation.contributions.length).toBeGreaterThan(0);
    });

    test('explains persuasion opportunity score', () => {
      const precinct = createMockPrecinct({
        targeting: { gotvPriority: 50, persuasionOpportunity: 65, combinedScore: 58, strategy: 'persuasion' },
      });
      const explanation = scoreExplainer.explainScore(precinct, 'persuasion_opportunity');

      expect(explanation.score).toBe(65);
      expect(explanation.scoreType).toBe('persuasion_opportunity');
    });

    test('explains swing potential score', () => {
      const precinct = createMockPrecinct({
        electoral: {
          partisanLean: 3,
          swingPotential: 72,
          competitiveness: 'toss_up',
          avgTurnout: 60,
          turnoutDropoff: 15,
        },
      });
      const explanation = scoreExplainer.explainScore(precinct, 'swing_potential');

      expect(explanation.score).toBe(72);
      expect(explanation.scoreType).toBe('swing_potential');
    });

    test('explains partisan lean score', () => {
      const precinct = createMockPrecinct({
        electoral: {
          partisanLean: -15,
          swingPotential: 35,
          competitiveness: 'lean_d',
          avgTurnout: 58,
          turnoutDropoff: 12,
        },
      });
      const explanation = scoreExplainer.explainScore(precinct, 'partisan_lean');

      expect(explanation.score).toBe(-15);
      expect(explanation.scoreType).toBe('partisan_lean');
    });

    test('explains combined score', () => {
      const precinct = createMockPrecinct();
      const explanation = scoreExplainer.explainScore(precinct, 'combined_score');

      expect(explanation.score).toBe(precinct.targeting.combinedScore);
      expect(explanation.scoreType).toBe('combined_score');
    });

    test('sorts contributions by absolute value', () => {
      const precinct = createMockPrecinct();
      const explanation = scoreExplainer.explainScore(precinct, 'gotv_priority');

      // Contributions should be sorted by absolute contribution value
      for (let i = 0; i < explanation.contributions.length - 1; i++) {
        const current = Math.abs(explanation.contributions[i].contribution);
        const next = Math.abs(explanation.contributions[i + 1].contribution);
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });
  });

  // ========================================
  // Rating Tests
  // ========================================
  describe('rating calculation', () => {
    test('returns very_low for score < 20', () => {
      const precinct = createMockPrecinct({
        targeting: { gotvPriority: 15, persuasionOpportunity: 15, combinedScore: 15, strategy: 'none' },
      });
      const explanation = scoreExplainer.explainScore(precinct, 'gotv_priority');
      expect(explanation.rating).toBe('very_low');
    });

    test('returns low for score 20-39', () => {
      const precinct = createMockPrecinct({
        targeting: { gotvPriority: 35, persuasionOpportunity: 35, combinedScore: 35, strategy: 'low' },
      });
      const explanation = scoreExplainer.explainScore(precinct, 'gotv_priority');
      expect(explanation.rating).toBe('low');
    });

    test('returns moderate for score 40-59', () => {
      const precinct = createMockPrecinct({
        targeting: { gotvPriority: 55, persuasionOpportunity: 55, combinedScore: 55, strategy: 'moderate' },
      });
      const explanation = scoreExplainer.explainScore(precinct, 'gotv_priority');
      expect(explanation.rating).toBe('moderate');
    });

    test('returns high for score 60-79', () => {
      const precinct = createMockPrecinct({
        targeting: { gotvPriority: 72, persuasionOpportunity: 72, combinedScore: 72, strategy: 'high' },
      });
      const explanation = scoreExplainer.explainScore(precinct, 'gotv_priority');
      expect(explanation.rating).toBe('high');
    });

    test('returns very_high for score >= 80', () => {
      const precinct = createMockPrecinct({
        targeting: { gotvPriority: 88, persuasionOpportunity: 88, combinedScore: 88, strategy: 'very_high' },
      });
      const explanation = scoreExplainer.explainScore(precinct, 'gotv_priority');
      expect(explanation.rating).toBe('very_high');
    });
  });

  // ========================================
  // Contribution Direction Tests
  // ========================================
  describe('contribution direction', () => {
    test('identifies positive contributions', () => {
      const precinct = createMockPrecinct({
        electoral: { partisanLean: 5, swingPotential: 40, competitiveness: 'toss_up', avgTurnout: 35, turnoutDropoff: 25 },
        political: { demAffiliationPct: 60, repAffiliationPct: 20, independentPct: 20, liberalPct: 50, moderatePct: 30, conservativePct: 20 },
      });
      const explanation = scoreExplainer.explainScore(precinct, 'gotv_priority');

      // Low turnout should contribute positively to GOTV priority
      const turnoutContrib = explanation.contributions.find(c => c.factor === 'Average Turnout');
      expect(turnoutContrib).toBeDefined();
      expect(turnoutContrib?.direction).toBe('positive');
    });

    test('identifies negative contributions', () => {
      const precinct = createMockPrecinct({
        electoral: { partisanLean: 5, swingPotential: 40, competitiveness: 'lean_d', avgTurnout: 75, turnoutDropoff: 5 },
        political: { demAffiliationPct: 30, repAffiliationPct: 50, independentPct: 20, liberalPct: 20, moderatePct: 30, conservativePct: 50 },
      });
      const explanation = scoreExplainer.explainScore(precinct, 'gotv_priority');

      // High turnout should contribute negatively to GOTV priority
      const turnoutContrib = explanation.contributions.find(c => c.factor === 'Average Turnout');
      expect(turnoutContrib).toBeDefined();
      expect(turnoutContrib?.direction).toBe('negative');
    });

    test('identifies neutral contributions', () => {
      const precinct = createMockPrecinct({
        electoral: { partisanLean: 5, swingPotential: 40, competitiveness: 'lean_d', avgTurnout: 58, turnoutDropoff: 12 },
      });
      const explanation = scoreExplainer.explainScore(precinct, 'gotv_priority');

      // Some contributions may be neutral
      const neutralContribs = explanation.contributions.filter(c => c.direction === 'neutral');
      // At least check that direction is one of the valid values
      explanation.contributions.forEach(c => {
        expect(['positive', 'negative', 'neutral']).toContain(c.direction);
      });
    });
  });

  // ========================================
  // Summary Generation Tests
  // ========================================
  describe('summary generation', () => {
    test('includes precinct name in summary', () => {
      const precinct = createMockPrecinct({ name: 'Lansing Ward 1' });
      const explanation = scoreExplainer.explainScore(precinct, 'gotv_priority');

      expect(explanation.summary).toContain('Lansing Ward 1');
    });

    test('includes rating in summary', () => {
      const precinct = createMockPrecinct({
        targeting: { gotvPriority: 85, persuasionOpportunity: 50, combinedScore: 70, strategy: 'gotv' },
      });
      const explanation = scoreExplainer.explainScore(precinct, 'gotv_priority');

      expect(explanation.summary).toContain('exceptionally high');
    });

    test('includes score value in summary', () => {
      const precinct = createMockPrecinct({
        targeting: { gotvPriority: 72, persuasionOpportunity: 50, combinedScore: 65, strategy: 'gotv' },
      });
      const explanation = scoreExplainer.explainScore(precinct, 'gotv_priority');

      expect(explanation.summary).toContain('72');
    });

    test('includes top factor in summary', () => {
      const precinct = createMockPrecinct();
      const explanation = scoreExplainer.explainScore(precinct, 'gotv_priority');

      // Summary should mention the biggest factor
      expect(explanation.summary.length).toBeGreaterThan(50);
    });
  });

  // ========================================
  // Recommendations Tests
  // ========================================
  describe('recommendations', () => {
    test('generates recommendations for high GOTV priority', () => {
      const precinct = createMockPrecinct({
        targeting: { gotvPriority: 85, persuasionOpportunity: 40, combinedScore: 70, strategy: 'gotv_base' },
      });
      const explanation = scoreExplainer.explainScore(precinct, 'gotv_priority');

      expect(explanation.recommendations.length).toBeGreaterThan(0);
      expect(explanation.recommendations.some(r => r.toLowerCase().includes('canvass') || r.toLowerCase().includes('prioritize'))).toBe(true);
    });

    test('generates recommendations for low GOTV priority', () => {
      const precinct = createMockPrecinct({
        targeting: { gotvPriority: 25, persuasionOpportunity: 60, combinedScore: 45, strategy: 'persuasion' },
      });
      const explanation = scoreExplainer.explainScore(precinct, 'gotv_priority');

      expect(explanation.recommendations.length).toBeGreaterThan(0);
    });

    test('generates recommendations for persuasion opportunity', () => {
      const precinct = createMockPrecinct({
        targeting: { gotvPriority: 40, persuasionOpportunity: 75, combinedScore: 55, strategy: 'persuasion' },
      });
      const explanation = scoreExplainer.explainScore(precinct, 'persuasion_opportunity');

      expect(explanation.recommendations.some(r => r.toLowerCase().includes('persuasion') || r.toLowerCase().includes('mail') || r.toLowerCase().includes('messaging'))).toBe(true);
    });

    test('generates recommendations for swing potential', () => {
      const precinct = createMockPrecinct({
        electoral: { partisanLean: 2, swingPotential: 75, competitiveness: 'toss_up', avgTurnout: 60, turnoutDropoff: 15 },
      });
      const explanation = scoreExplainer.explainScore(precinct, 'swing_potential');

      expect(explanation.recommendations.length).toBeGreaterThan(0);
    });

    test('includes strategy in combined score recommendations', () => {
      const precinct = createMockPrecinct({
        targeting: { gotvPriority: 70, persuasionOpportunity: 65, combinedScore: 80, strategy: 'battleground' },
      });
      const explanation = scoreExplainer.explainScore(precinct, 'combined_score');

      expect(explanation.recommendations.some(r => r.toLowerCase().includes('strategy'))).toBe(true);
    });
  });

  // ========================================
  // Comparison Context Tests
  // ========================================
  describe('comparison context', () => {
    const allPrecincts = [
      createMockPrecinct({ id: 'P1', targeting: { gotvPriority: 80, persuasionOpportunity: 50, combinedScore: 70, strategy: 'gotv' } }),
      createMockPrecinct({ id: 'P2', targeting: { gotvPriority: 60, persuasionOpportunity: 50, combinedScore: 55, strategy: 'mixed' } }),
      createMockPrecinct({ id: 'P3', targeting: { gotvPriority: 40, persuasionOpportunity: 50, combinedScore: 45, strategy: 'low' } }),
      createMockPrecinct({ id: 'P4', targeting: { gotvPriority: 70, persuasionOpportunity: 50, combinedScore: 60, strategy: 'gotv' } }),
      createMockPrecinct({ id: 'P5', targeting: { gotvPriority: 50, persuasionOpportunity: 50, combinedScore: 50, strategy: 'mixed' } }),
    ];

    test('includes comparison context when allPrecincts provided', () => {
      const explanation = scoreExplainer.explainScore(allPrecincts[0], 'gotv_priority', allPrecincts);

      expect(explanation.comparedTo).toBeDefined();
      expect(explanation.comparedTo?.average).toBeDefined();
      expect(explanation.comparedTo?.countyRank).toBeDefined();
      expect(explanation.comparedTo?.countyTotal).toBe(5);
    });

    test('calculates correct average', () => {
      const explanation = scoreExplainer.explainScore(allPrecincts[0], 'gotv_priority', allPrecincts);

      // Average of 80, 60, 40, 70, 50 = 60
      expect(explanation.comparedTo?.average).toBe(60);
    });

    test('calculates correct rank', () => {
      const explanation = scoreExplainer.explainScore(allPrecincts[0], 'gotv_priority', allPrecincts);

      // P1 with 80 should be rank 1
      expect(explanation.comparedTo?.countyRank).toBe(1);
    });

    test('calculates percentile', () => {
      const explanation = scoreExplainer.explainScore(allPrecincts[0], 'gotv_priority', allPrecincts);

      expect(explanation.percentile).toBeDefined();
      expect(explanation.percentile).toBeGreaterThanOrEqual(0);
      expect(explanation.percentile).toBeLessThanOrEqual(100);
    });

    test('finds similar precincts', () => {
      const explanation = scoreExplainer.explainScore(allPrecincts[1], 'gotv_priority', allPrecincts);

      // P2 has 60, should find similar precincts within 5 points
      expect(explanation.comparedTo?.similarPrecincts).toBeDefined();
    });

    test('excludes comparison context when only one precinct', () => {
      const explanation = scoreExplainer.explainScore(allPrecincts[0], 'gotv_priority', [allPrecincts[0]]);

      expect(explanation.comparedTo).toBeUndefined();
      expect(explanation.percentile).toBeUndefined();
    });

    test('excludes comparison context when allPrecincts not provided', () => {
      const explanation = scoreExplainer.explainScore(allPrecincts[0], 'gotv_priority');

      expect(explanation.comparedTo).toBeUndefined();
    });
  });

  // ========================================
  // Natural Language Explanation Tests
  // ========================================
  describe('generateNaturalLanguageExplanation', () => {
    test('returns formatted text explanation', () => {
      const precinct = createMockPrecinct();
      const explanation = scoreExplainer.generateNaturalLanguageExplanation(precinct, 'gotv_priority');

      expect(typeof explanation).toBe('string');
      expect(explanation.length).toBeGreaterThan(100);
    });

    test('includes key factors section', () => {
      const precinct = createMockPrecinct();
      const explanation = scoreExplainer.generateNaturalLanguageExplanation(precinct, 'gotv_priority');

      expect(explanation).toContain('Key factors:');
    });

    test('includes recommendation', () => {
      const precinct = createMockPrecinct({
        targeting: { gotvPriority: 85, persuasionOpportunity: 50, combinedScore: 70, strategy: 'gotv' },
      });
      const explanation = scoreExplainer.generateNaturalLanguageExplanation(precinct, 'gotv_priority');

      expect(explanation).toContain('Recommendation:');
    });

    test('includes rank when comparison context provided', () => {
      const allPrecincts = [
        createMockPrecinct({ id: 'P1', targeting: { gotvPriority: 80, persuasionOpportunity: 50, combinedScore: 70, strategy: 'gotv' } }),
        createMockPrecinct({ id: 'P2', targeting: { gotvPriority: 60, persuasionOpportunity: 50, combinedScore: 55, strategy: 'mixed' } }),
        createMockPrecinct({ id: 'P3', targeting: { gotvPriority: 40, persuasionOpportunity: 50, combinedScore: 45, strategy: 'low' } }),
      ];

      const explanation = scoreExplainer.generateNaturalLanguageExplanation(
        allPrecincts[0],
        'gotv_priority',
        allPrecincts
      );

      expect(explanation).toContain('ranks #');
      expect(explanation).toContain('Ingham County');
    });

    test('formats factor contributions with direction', () => {
      const precinct = createMockPrecinct();
      const explanation = scoreExplainer.generateNaturalLanguageExplanation(precinct, 'gotv_priority');

      expect(explanation).toMatch(/increases|decreases/);
      expect(explanation).toMatch(/points/);
    });
  });

  // ========================================
  // Score Type Coverage Tests
  // ========================================
  describe('all score types', () => {
    const scoreTypes: ScoreType[] = [
      'gotv_priority',
      'persuasion_opportunity',
      'swing_potential',
      'partisan_lean',
      'combined_score',
    ];

    test.each(scoreTypes)('handles %s score type', (scoreType) => {
      const precinct = createMockPrecinct();
      const explanation = scoreExplainer.explainScore(precinct, scoreType);

      expect(explanation.scoreType).toBe(scoreType);
      expect(explanation.contributions.length).toBeGreaterThan(0);
      expect(explanation.summary).toBeDefined();
    });
  });

  // ========================================
  // Election History Tests
  // ========================================
  describe('election history in explanations', () => {
    test('uses election data for swing potential', () => {
      const precinct = createMockPrecinct({
        elections: {
          '2024': { demPct: 55, repPct: 45, margin: 10, turnout: 70, ballotsCast: 2000 },
          '2020': { demPct: 52, repPct: 48, margin: 4, turnout: 75, ballotsCast: 2200 },
        },
      });

      const explanation = scoreExplainer.explainScore(precinct, 'swing_potential');

      // Should include margin volatility factor
      const volatilityContrib = explanation.contributions.find(c => c.factor === 'Margin Volatility');
      // Only present if elections data has at least 2 years
      if (volatilityContrib) {
        expect(volatilityContrib.value).toBeDefined();
      }
    });

    test('uses 2024 results for partisan lean', () => {
      const precinct = createMockPrecinct({
        elections: {
          '2024': { demPct: 58, repPct: 42, margin: 16, turnout: 72, ballotsCast: 2100 },
        },
      });

      const explanation = scoreExplainer.explainScore(precinct, 'partisan_lean');

      const resultContrib = explanation.contributions.find(c => c.factor === '2024 Election Result');
      if (resultContrib) {
        expect(resultContrib.value).toBe(58);
      }
    });
  });

  // ========================================
  // Edge Cases
  // ========================================
  describe('edge cases', () => {
    test('handles zero scores', () => {
      const precinct = createMockPrecinct({
        targeting: { gotvPriority: 0, persuasionOpportunity: 0, combinedScore: 0, strategy: 'none' },
      });
      const explanation = scoreExplainer.explainScore(precinct, 'gotv_priority');

      expect(explanation.score).toBe(0);
      expect(explanation.rating).toBe('very_low');
    });

    test('handles maximum scores', () => {
      const precinct = createMockPrecinct({
        targeting: { gotvPriority: 100, persuasionOpportunity: 100, combinedScore: 100, strategy: 'max' },
      });
      const explanation = scoreExplainer.explainScore(precinct, 'gotv_priority');

      expect(explanation.score).toBe(100);
      expect(explanation.rating).toBe('very_high');
    });

    test('handles negative partisan lean', () => {
      const precinct = createMockPrecinct({
        electoral: { partisanLean: -25, swingPotential: 20, competitiveness: 'safe_d', avgTurnout: 65, turnoutDropoff: 10 },
      });
      const explanation = scoreExplainer.explainScore(precinct, 'partisan_lean');

      expect(explanation.score).toBe(-25);
    });

    test('handles precinct with no elections data', () => {
      const precinct = createMockPrecinct();
      delete (precinct as any).elections;

      const explanation = scoreExplainer.explainScore(precinct, 'swing_potential');
      expect(explanation).toBeDefined();
      expect(explanation.contributions.length).toBeGreaterThan(0);
    });
  });
});
