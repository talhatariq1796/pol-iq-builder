import type { ComparisonEntity } from './types';
import type {
  FieldBrief,
  AreaProfiles,
  AreaProfile,
  KeyDifference,
  TalkingPoints,
  AreaTalkingPoints,
  VoterProfiles,
  VoterProfile,
  FieldOperations,
  FieldOpsInfo,
  BriefOptions,
  BriefFormat,
} from './types-brief';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function formatPartisanLean(lean: number): string {
  if (lean > 0) return `D+${lean.toFixed(0)}`;
  if (lean < 0) return `R+${Math.abs(lean).toFixed(0)}`;
  return 'Even';
}

function buildAreaProfile(entity: ComparisonEntity): AreaProfile {
  return {
    name: entity.name,
    partisanLean: formatPartisanLean(entity.politicalProfile.partisanLean),
    population: entity.demographics.totalPopulation,
    medianIncome: entity.demographics.medianIncome,
    collegePct: entity.demographics.collegePct,
    strategy: entity.targetingScores.recommendedStrategy,
    competitiveness: entity.politicalProfile.competitiveness,
  };
}

function buildTalkingPoints(entity: ComparisonEntity): AreaTalkingPoints {
  const isLeft = entity.politicalProfile.partisanLean > 0;
  return {
    areaName: entity.name,
    topIssues: ['Economy & Jobs', 'Healthcare', 'Education'],
    avoidTopics: [],
    keyMessages: isLeft
      ? ['Protect working families', 'Expand healthcare access', 'Invest in public schools']
      : ['Lower taxes', 'Reduce government spending', 'Support small business'],
    connectionPoints: ['Local community values', 'Economic opportunity', 'Quality of life'],
  };
}

function buildVoterProfile(entity: ComparisonEntity): VoterProfile {
  const density = entity.demographics.populationDensity > 3000 ? 'urban' :
    entity.demographics.populationDensity > 500 ? 'suburban' : 'rural';
  return {
    areaName: entity.name,
    dominantSegment: `${density.charAt(0).toUpperCase() + density.slice(1)} voter`,
    lifestyleDescription: `Primarily ${density} residents with median income of ${formatCurrency(entity.demographics.medianIncome)}`,
    typicalOccupations: density === 'urban'
      ? ['Professional', 'Service worker', 'Government']
      : density === 'suburban'
      ? ['Manager', 'Professional', 'Contractor']
      : ['Farmer', 'Tradesperson', 'Small business owner'],
    mediaHabits: ['Local news', 'Social media', 'Talk radio'],
    valuesAndPriorities: ['Community safety', 'Economic stability', 'Education quality'],
  };
}

function buildFieldOps(entity: ComparisonEntity): FieldOpsInfo {
  const density = entity.demographics.populationDensity > 3000 ? 'urban' :
    entity.demographics.populationDensity > 500 ? 'suburban' : 'rural';
  return {
    areaName: entity.name,
    doorsPerHour: density === 'urban' ? 15 : density === 'suburban' ? 10 : 6,
    bestTimes: ['Saturday 10am-6pm', 'Sunday 12pm-6pm', 'Weekdays 5pm-8pm'],
    density,
    parkingNotes: density === 'urban' ? 'Street parking limited; use public transit where possible' : 'Ample street parking available',
    safetyNotes: 'Always work in pairs after dark',
  };
}

export class FieldBriefGenerator {
  async generateBrief(
    left: ComparisonEntity,
    right: ComparisonEntity,
    _options?: BriefOptions
  ): Promise<FieldBrief> {
    const leftProfile = buildAreaProfile(left);
    const rightProfile = buildAreaProfile(right);

    const keyDifferences: KeyDifference[] = [
      {
        metric: 'Partisan Lean',
        leftValue: leftProfile.partisanLean,
        rightValue: rightProfile.partisanLean,
        implication: 'Adjust messaging based on political environment',
      },
      {
        metric: 'Median Income',
        leftValue: formatCurrency(left.demographics.medianIncome),
        rightValue: formatCurrency(right.demographics.medianIncome),
        implication: 'Tailor economic messaging to local income levels',
      },
      {
        metric: 'College %',
        leftValue: `${left.demographics.collegePct.toFixed(1)}%`,
        rightValue: `${right.demographics.collegePct.toFixed(1)}%`,
        implication: 'Higher education levels correlate with receptiveness to policy detail',
      },
    ];

    const profiles: AreaProfiles = {
      left: leftProfile,
      right: rightProfile,
      keyDifferences,
    };

    const talkingPoints: TalkingPoints = {
      left: buildTalkingPoints(left),
      right: buildTalkingPoints(right),
    };

    const voterProfiles: VoterProfiles = {
      left: buildVoterProfile(left),
      right: buildVoterProfile(right),
    };

    const fieldOps: FieldOperations = {
      left: buildFieldOps(left),
      right: buildFieldOps(right),
    };

    const leanDiff = Math.abs(left.politicalProfile.partisanLean - right.politicalProfile.partisanLean);
    const summary = `Comparing ${left.name} (${leftProfile.partisanLean}) vs ${right.name} (${rightProfile.partisanLean}). ` +
      `These areas differ by ${leanDiff.toFixed(0)} partisan points. ` +
      `${left.name} is recommended for ${left.targetingScores.recommendedStrategy}, ` +
      `while ${right.name} is recommended for ${right.targetingScores.recommendedStrategy}.`;

    return {
      summary,
      profiles,
      talkingPoints,
      voterProfiles,
      fieldOps,
      metadata: {
        generated: new Date(),
        comparison: { left: left.id, right: right.id },
        format: 'json' as BriefFormat,
      },
    };
  }

  exportBrief(brief: FieldBrief, format: 'markdown' | 'html' | 'text'): string {
    if (format === 'markdown') {
      return [
        `# Field Brief: ${brief.metadata.comparison.left} vs ${brief.metadata.comparison.right}`,
        '',
        `## Summary`,
        brief.summary,
        '',
        `## ${brief.profiles.left.name}`,
        `- Partisan Lean: ${brief.profiles.left.partisanLean}`,
        `- Population: ${brief.profiles.left.population.toLocaleString()}`,
        `- Strategy: ${brief.profiles.left.strategy}`,
        '',
        `## ${brief.profiles.right.name}`,
        `- Partisan Lean: ${brief.profiles.right.partisanLean}`,
        `- Population: ${brief.profiles.right.population.toLocaleString()}`,
        `- Strategy: ${brief.profiles.right.strategy}`,
      ].join('\n');
    }

    if (format === 'html') {
      return `<h1>Field Brief</h1><p>${brief.summary}</p>`;
    }

    return `FIELD BRIEF\n\n${brief.summary}`;
  }
}
