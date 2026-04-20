import type { ComparisonEntity } from './types';
import type {
  SimilarityResult,
  SimilarityBreakdown,
  SimilarityBonuses,
  SimilaritySearchOptions,
  SimilarityWeights,
  SimilarEntityResult,
} from './types-similarity';

const DEFAULT_WEIGHTS: SimilarityWeights = {
  partisanLean: 0.20,
  swingPotential: 0.10,
  turnout: 0.10,
  income: 0.10,
  age: 0.10,
  education: 0.10,
  gotvPriority: 0.15,
  persuasionOpportunity: 0.15,
};

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function scoreSimilarity(a: number, b: number, range: number): number {
  const diff = Math.abs(a - b);
  return clamp(100 - (diff / range) * 100, 0, 100);
}

export class SimilarityEngine {
  private weights: SimilarityWeights;

  constructor(customWeights?: Partial<SimilarityWeights>) {
    this.weights = { ...DEFAULT_WEIGHTS, ...customWeights };
  }

  calculateSimilarity(reference: ComparisonEntity, candidate: ComparisonEntity): SimilarityResult {
    const breakdown: SimilarityBreakdown = {
      partisanLean: scoreSimilarity(reference.politicalProfile.partisanLean, candidate.politicalProfile.partisanLean, 100),
      swingPotential: scoreSimilarity(reference.politicalProfile.swingPotential, candidate.politicalProfile.swingPotential, 100),
      turnout: scoreSimilarity(reference.politicalProfile.avgTurnoutRate, candidate.politicalProfile.avgTurnoutRate, 100),
      income: scoreSimilarity(reference.demographics.medianIncome, candidate.demographics.medianIncome, 100000),
      age: scoreSimilarity(reference.demographics.medianAge, candidate.demographics.medianAge, 50),
      education: scoreSimilarity(reference.demographics.collegePct, candidate.demographics.collegePct, 100),
      gotvPriority: scoreSimilarity(reference.targetingScores.gotvPriority, candidate.targetingScores.gotvPriority, 100),
      persuasionOpportunity: scoreSimilarity(reference.targetingScores.persuasionOpportunity, candidate.targetingScores.persuasionOpportunity, 100),
    };

    const w = this.weights;
    let score =
      breakdown.partisanLean * w.partisanLean +
      breakdown.swingPotential * w.swingPotential +
      breakdown.turnout * w.turnout +
      breakdown.income * w.income +
      breakdown.age * w.age +
      breakdown.education * w.education +
      breakdown.gotvPriority * w.gotvPriority +
      breakdown.persuasionOpportunity * w.persuasionOpportunity;

    const bonuses: SimilarityBonuses = {
      sameStrategy: reference.targetingScores.recommendedStrategy === candidate.targetingScores.recommendedStrategy,
      sameCompetitiveness: reference.politicalProfile.competitiveness === candidate.politicalProfile.competitiveness,
      sameTapestrySegment: false,
    };

    if (bonuses.sameStrategy) score += 10;
    if (bonuses.sameCompetitiveness) score += 5;
    score = clamp(score, 0, 100);

    const factors: string[] = [];
    if (breakdown.partisanLean > 80) factors.push('Similar partisan lean');
    if (breakdown.swingPotential > 80) factors.push('Similar swing potential');
    if (breakdown.income > 80) factors.push('Similar income levels');
    if (bonuses.sameStrategy) factors.push(`Same strategy: ${reference.targetingScores.recommendedStrategy}`);
    if (bonuses.sameCompetitiveness) factors.push('Same competitiveness level');

    return { score, factors, breakdown, bonuses };
  }

  findSimilar(
    reference: ComparisonEntity,
    allEntities: ComparisonEntity[],
    options?: Partial<SimilaritySearchOptions>
  ): SimilarEntityResult[] {
    const minSimilarity = options?.minSimilarity ?? 60;
    const maxResults = options?.maxResults ?? 10;

    const results: SimilarEntityResult[] = allEntities
      .filter(e => e.id !== reference.id)
      .map(entity => ({
        entity,
        similarity: this.calculateSimilarity(reference, entity),
      }))
      .filter(r => r.similarity.score >= minSimilarity)
      .sort((a, b) => b.similarity.score - a.similarity.score)
      .slice(0, maxResults);

    return results;
  }
}
