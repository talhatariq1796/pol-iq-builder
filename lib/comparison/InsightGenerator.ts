import type { ComparisonResult, MetricDifference } from './types';

export class InsightGenerator {
  generateInsights(comparison: ComparisonResult): string[] {
    const { leftEntity, rightEntity, differences } = comparison;
    const insights: string[] = [];

    const partisanDiff = this.findDifference(differences.politicalProfile, 'Partisan Lean');
    if (partisanDiff && partisanDiff.isSignificant) {
      insights.push(
        `${this.higherName(partisanDiff, leftEntity.name, rightEntity.name)} has a stronger ${this.leadingPartyLabel(partisanDiff, comparison)} lean by ${this.formatAbs(partisanDiff.difference, 'points')}.`
      );
    }

    const swingDiff = this.findDifference(differences.politicalProfile, 'Swing Potential');
    if (swingDiff && swingDiff.isSignificant) {
      insights.push(
        `${this.higherName(swingDiff, leftEntity.name, rightEntity.name)} has higher swing potential, making it the stronger persuasion opportunity.`
      );
    }

    const turnoutDiff = this.findDifference(differences.politicalProfile, 'Avg Turnout');
    if (turnoutDiff && turnoutDiff.isSignificant) {
      insights.push(
        `${this.higherName(turnoutDiff, leftEntity.name, rightEntity.name)} turns out at a higher rate by ${this.formatAbs(turnoutDiff.difference, 'percent')}, so mobilization assumptions should differ between the two areas.`
      );
    }

    const populationDiff = this.findDifference(differences.demographics, 'Population');
    if (populationDiff && populationDiff.isSignificant) {
      insights.push(
        `${this.higherName(populationDiff, leftEntity.name, rightEntity.name)} has the larger population base, which can change field capacity and vote goal planning.`
      );
    }

    const gotvDiff = this.findDifference(differences.targeting, 'GOTV Priority');
    if (gotvDiff && gotvDiff.isSignificant) {
      insights.push(
        `${this.higherName(gotvDiff, leftEntity.name, rightEntity.name)} is the higher GOTV priority based on the combined turnout and partisan profile.`
      );
    }

    const persuasionDiff = this.findDifference(differences.targeting, 'Persuasion Opp.');
    if (persuasionDiff && persuasionDiff.isSignificant) {
      insights.push(
        `${this.higherName(persuasionDiff, leftEntity.name, rightEntity.name)} offers the stronger persuasion target based on competitiveness and swing potential.`
      );
    }

    if (leftEntity.targetingScores.recommendedStrategy !== rightEntity.targetingScores.recommendedStrategy) {
      insights.push(
        `Use different field strategies: ${leftEntity.name} is best treated as ${leftEntity.targetingScores.recommendedStrategy}, while ${rightEntity.name} is best treated as ${rightEntity.targetingScores.recommendedStrategy}.`
      );
    }

    if (insights.length === 0) {
      insights.push(
        `${leftEntity.name} and ${rightEntity.name} are closely matched across the main demographic, electoral, and targeting metrics.`
      );
    }

    return insights.slice(0, 6);
  }

  generateStrategicRecommendations(comparison: ComparisonResult): string[] {
    const { leftEntity, rightEntity } = comparison;
    const recommendations: string[] = [];

    const gotvLeader =
      leftEntity.targetingScores.gotvPriority >= rightEntity.targetingScores.gotvPriority
        ? leftEntity
        : rightEntity;
    const persuasionLeader =
      leftEntity.targetingScores.persuasionOpportunity >= rightEntity.targetingScores.persuasionOpportunity
        ? leftEntity
        : rightEntity;
    const efficiencyLeader =
      leftEntity.targetingScores.canvassingEfficiency >= rightEntity.targetingScores.canvassingEfficiency
        ? leftEntity
        : rightEntity;

    recommendations.push(
      `Prioritize GOTV resources in ${gotvLeader.name} if the goal is reliable vote capture.`
    );
    recommendations.push(
      `Use persuasion messaging in ${persuasionLeader.name}, where the opportunity score is stronger.`
    );
    recommendations.push(
      `Plan canvassing capacity around ${efficiencyLeader.name}, which has the better expected field efficiency.`
    );

    return recommendations;
  }

  private findDifference(
    differences: MetricDifference[],
    metricName: string,
  ): MetricDifference | undefined {
    return differences.find((difference) => difference.metricName === metricName);
  }

  private higherName(
    difference: MetricDifference,
    leftName: string,
    rightName: string,
  ): string {
    if (difference.direction === 'left-higher') return leftName;
    if (difference.direction === 'right-higher') return rightName;
    return `${leftName} and ${rightName}`;
  }

  private leadingPartyLabel(
    difference: MetricDifference,
    comparison: ComparisonResult,
  ): string {
    const party =
      difference.direction === 'left-higher'
        ? comparison.leftEntity.politicalProfile.dominantParty
        : comparison.rightEntity.politicalProfile.dominantParty;
    if (party === 'D') return 'Democratic';
    if (party === 'R') return 'Republican';
    return 'swing';
  }

  private formatAbs(
    value: number,
    formatType: MetricDifference['formatType'],
  ): string {
    const abs = Math.abs(value);
    if (formatType === 'currency') {
      return `$${Math.round(abs).toLocaleString()}`;
    }
    if (formatType === 'percent' || formatType === 'points') {
      return `${abs.toFixed(1)} points`;
    }
    return abs.toLocaleString(undefined, { maximumFractionDigits: 1 });
  }
}
