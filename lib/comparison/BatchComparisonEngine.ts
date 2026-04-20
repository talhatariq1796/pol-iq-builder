import type { ComparisonEntity } from './types';
import type {
  BatchComparisonResult,
  BatchComparisonOptions,
  MatrixAnalytics,
  MetricGroupAnalysis,
  MetricStats,
  OutlierEntity,
  CorrelationMatrix,
  ParetoAnalysis,
  Rankings,
  RankedEntity,
  PairwiseSimilarity,
} from './types-batch';
import type { EntityCluster } from './types-similarity';
import { SimilarityEngine } from './SimilarityEngine';

function computeStats(values: number[], entities: ComparisonEntity[], entityNames: string[]): MetricStats {
  if (!values.length) {
    return { mean: 0, median: 0, stdDev: 0, min: 0, max: 0, outliers: [] };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  const stdDev = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  const outliers: OutlierEntity[] = values
    .map((v, i) => ({ entityId: entities[i].id, entityName: entityNames[i], value: v, deviation: stdDev > 0 ? Math.abs(v - mean) / stdDev : 0 }))
    .filter(o => o.deviation > 1.5);

  return { mean, median, stdDev, min, max, outliers };
}

function buildDemographicsAnalysis(entities: ComparisonEntity[]): MetricGroupAnalysis {
  const names = entities.map(e => e.name);
  return {
    medianIncome: computeStats(entities.map(e => e.demographics.medianIncome), entities, names),
    medianAge: computeStats(entities.map(e => e.demographics.medianAge), entities, names),
    collegePct: computeStats(entities.map(e => e.demographics.collegePct), entities, names),
    totalPopulation: computeStats(entities.map(e => e.demographics.totalPopulation), entities, names),
  };
}

function buildPoliticalAnalysis(entities: ComparisonEntity[]): MetricGroupAnalysis {
  const names = entities.map(e => e.name);
  return {
    partisanLean: computeStats(entities.map(e => e.politicalProfile.partisanLean), entities, names),
    swingPotential: computeStats(entities.map(e => e.politicalProfile.swingPotential), entities, names),
    avgTurnout: computeStats(entities.map(e => e.politicalProfile.avgTurnoutRate), entities, names),
  };
}

function buildTargetingAnalysis(entities: ComparisonEntity[]): MetricGroupAnalysis {
  const names = entities.map(e => e.name);
  return {
    gotvPriority: computeStats(entities.map(e => e.targetingScores.gotvPriority), entities, names),
    persuasionOpportunity: computeStats(entities.map(e => e.targetingScores.persuasionOpportunity), entities, names),
    combinedScore: computeStats(entities.map(e => e.targetingScores.combinedScore), entities, names),
  };
}

function buildCorrelationMatrix(): CorrelationMatrix {
  return { pairs: [], strongPositive: [], strongNegative: [] };
}

function buildParetoAnalysis(entities: ComparisonEntity[]): ParetoAnalysis {
  const values = entities.map(e => e.targetingScores.combinedScore).sort((a, b) => b - a);
  const total = values.reduce((s, v) => s + v, 0);
  const top20Count = Math.max(1, Math.ceil(values.length * 0.2));
  const top20Sum = values.slice(0, top20Count).reduce((s, v) => s + v, 0);
  return {
    metric: 'combinedScore',
    top20Pct: total > 0 ? (top20Sum / total) * 100 : 0,
    insight: `Top 20% of areas account for ${((top20Sum / total) * 100).toFixed(0)}% of total targeting score`,
  };
}

function buildRankings(entities: ComparisonEntity[]): Rankings {
  function rank(sorted: ComparisonEntity[], getValue: (e: ComparisonEntity) => number): RankedEntity[] {
    return sorted.map((entity, i) => ({ entity, value: getValue(entity), rank: i + 1 }));
  }

  return {
    gotvPriority: rank([...entities].sort((a, b) => b.targetingScores.gotvPriority - a.targetingScores.gotvPriority), e => e.targetingScores.gotvPriority),
    persuasionOpportunity: rank([...entities].sort((a, b) => b.targetingScores.persuasionOpportunity - a.targetingScores.persuasionOpportunity), e => e.targetingScores.persuasionOpportunity),
    resourceEfficiency: rank([...entities].sort((a, b) => b.targetingScores.canvassingEfficiency - a.targetingScores.canvassingEfficiency), e => e.targetingScores.canvassingEfficiency),
    donorDensity: rank([...entities].sort((a, b) => b.demographics.totalPopulation - a.demographics.totalPopulation), e => e.demographics.totalPopulation),
    overallScore: rank([...entities].sort((a, b) => b.targetingScores.combinedScore - a.targetingScores.combinedScore), e => e.targetingScores.combinedScore),
  };
}

function buildClusters(entities: ComparisonEntity[], k: number): EntityCluster[] {
  if (entities.length === 0) return [];
  const clusterSize = Math.ceil(entities.length / k);
  const sorted = [...entities].sort((a, b) => b.targetingScores.combinedScore - a.targetingScores.combinedScore);

  const clusters: EntityCluster[] = [];
  for (let i = 0; i < k; i++) {
    const clusterEntities = sorted.slice(i * clusterSize, (i + 1) * clusterSize);
    if (!clusterEntities.length) continue;
    const avg = (fn: (e: ComparisonEntity) => number) =>
      clusterEntities.reduce((s, e) => s + fn(e), 0) / clusterEntities.length;

    clusters.push({
      id: `cluster-${i + 1}`,
      label: i === 0 ? 'High Priority' : i === 1 ? 'Medium Priority' : 'Lower Priority',
      entities: clusterEntities,
      centroid: [
        avg(e => e.politicalProfile.partisanLean),
        avg(e => e.politicalProfile.swingPotential),
        avg(e => e.politicalProfile.avgTurnoutRate),
        avg(e => e.demographics.medianIncome),
        avg(e => e.demographics.medianAge),
        avg(e => e.demographics.collegePct),
        avg(e => e.targetingScores.gotvPriority),
        avg(e => e.targetingScores.persuasionOpportunity),
      ],
      characteristics: {
        avgPartisanLean: avg(e => e.politicalProfile.partisanLean),
        avgSwingPotential: avg(e => e.politicalProfile.swingPotential),
        avgGotvPriority: avg(e => e.targetingScores.gotvPriority),
        avgPersuasion: avg(e => e.targetingScores.persuasionOpportunity),
        avgIncome: avg(e => e.demographics.medianIncome),
        avgEducation: avg(e => e.demographics.collegePct),
        dominantStrategy: String(clusterEntities[0].targetingScores.recommendedStrategy),
        dominantCompetitiveness: String(clusterEntities[0].politicalProfile.competitiveness),
        size: clusterEntities.length,
      },
    });
  }
  return clusters;
}

function buildPairwiseSimilarities(entities: ComparisonEntity[]): PairwiseSimilarity[] {
  const engine = new SimilarityEngine();
  const results: PairwiseSimilarity[] = [];
  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const sim = engine.calculateSimilarity(entities[i], entities[j]);
      results.push({
        entity1Id: entities[i].id,
        entity2Id: entities[j].id,
        similarity: sim.score,
        matchingFactors: sim.factors,
      });
    }
  }
  return results;
}

export class BatchComparisonEngine {
  compareBatch(entities: ComparisonEntity[], options?: Partial<BatchComparisonOptions>): BatchComparisonResult {
    const includeClustering = options?.includeClustering ?? true;
    const includeSimilarities = options?.includeSimilarities ?? false;
    const clusterCount = options?.clusterCount ?? 3;

    const analytics: MatrixAnalytics = {
      demographics: buildDemographicsAnalysis(entities),
      political: buildPoliticalAnalysis(entities),
      targeting: buildTargetingAnalysis(entities),
      correlations: buildCorrelationMatrix(),
      paretoAnalysis: buildParetoAnalysis(entities),
    };

    return {
      entities,
      analytics,
      rankings: buildRankings(entities),
      clusters: includeClustering ? buildClusters(entities, clusterCount) : [],
      pairwiseSimilarities: includeSimilarities ? buildPairwiseSimilarities(entities) : undefined,
      timestamp: new Date(),
    };
  }

  generateInsights(result: BatchComparisonResult): string[] {
    const insights: string[] = [];
    const { entities, analytics, rankings } = result;

    const topGotv = rankings.gotvPriority[0]?.entity;
    if (topGotv) insights.push(`${topGotv.name} has the highest GOTV priority score.`);

    const topPersuasion = rankings.persuasionOpportunity[0]?.entity;
    if (topPersuasion) insights.push(`${topPersuasion.name} offers the best persuasion opportunity.`);

    const leanStats = analytics.political.partisanLean;
    if (leanStats) {
      insights.push(`Partisan lean ranges from ${leanStats.min.toFixed(1)} to ${leanStats.max.toFixed(1)} across selected areas.`);
    }

    if (result.clusters.length > 0) {
      insights.push(`${entities.length} areas grouped into ${result.clusters.length} clusters by targeting profile.`);
    }

    insights.push(`Top 20% of areas account for ${analytics.paretoAnalysis.top20Pct.toFixed(0)}% of combined targeting score.`);

    return insights;
  }
}
