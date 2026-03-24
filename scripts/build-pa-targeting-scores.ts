/**
 * Build PA precinct_targeting_scores.json from election GeoJSON files
 *
 * Usage: npx ts-node scripts/build-pa-targeting-scores.ts
 *
 * Reads:
 *   - public/data/political/pensylvania/pa_2020_presidential.geojson
 *   - public/data/political/pensylvania/pa_2022_precinct.geojson
 *   - public/data/political/pensylvania/pa_2024_precincts_with_votes.geojson
 *
 * Outputs:
 *   - public/data/political/pensylvania/precinct_targeting_scores.json
 */

import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(process.cwd(), 'public/data/political/pensylvania');
const OUTPUT_FILE = path.join(DATA_DIR, 'precinct_targeting_scores.json');

interface ElectionRecord {
  key: string;
  name: string;
  countyFp: string;
  vtdst: string;
  demVotes: number;
  repVotes: number;
  totalVotes: number;
  demPct: number;
  repPct: number;
  margin: number;
  registeredVoters?: number;
  turnout?: number;
}

function normalizeKey(countyFp: string, vtdst: string): string {
  return `${String(countyFp).padStart(3, '0')}_${String(vtdst).padStart(6, '0')}`;
}

function loadPa2020(): Map<string, ElectionRecord> {
  const file = path.join(DATA_DIR, 'pa_2020_presidential.geojson');
  const gj = JSON.parse(fs.readFileSync(file, 'utf8')) as { features: Array<{ properties?: Record<string, unknown> }> };
  const map = new Map<string, ElectionRecord>();

  for (const f of gj.features || []) {
    const p = f.properties || {};
    const countyFp = String(p.COUNTYFP || '').padStart(3, '0');
    const vtdst = String(p.VTDST || '').padStart(6, '0');
    const uniqueId = String(p.UNIQUE_ID || `${countyFp}-${vtdst}`);

    const dem = Number(p.G20PREDBID) || 0;
    const rep = Number(p.G20PRERTRU) || 0;
    const regDem = Number(p.G20AUDDAHM) || 0;
    const regRep = Number(p.G20AUDRDEF) || 0;
    const total = dem + rep;
    const registered = regDem + regRep;

    const demPct = total > 0 ? (dem / total) * 100 : 50;
    const repPct = total > 0 ? (rep / total) * 100 : 50;
    const margin = demPct - repPct;
    const turnout = registered > 0 ? (total / registered) * 100 : null;

    const record: ElectionRecord = {
      key: uniqueId,
      name: String(p.NAME || uniqueId),
      countyFp,
      vtdst,
      demVotes: dem,
      repVotes: rep,
      totalVotes: total,
      demPct,
      repPct,
      margin,
      registeredVoters: registered > 0 ? registered : undefined,
      turnout: turnout ?? undefined,
    };
    map.set(uniqueId, record);
  }
  return map;
}

function loadPa2022(): Map<string, { demVotes: number; repVotes: number }> {
  const file = path.join(DATA_DIR, 'pa_2022_precinct.geojson');
  const gj = JSON.parse(fs.readFileSync(file, 'utf8')) as { features: Array<{ properties?: Record<string, unknown> }> };
  const map = new Map<string, { demVotes: number; repVotes: number }>();

  for (const f of gj.features || []) {
    const p = f.properties || {};
    const countyFp = String(p.COUNTYFP20 || p.COUNTYFP || '').padStart(3, '0');
    const vtdst = String(p.VTDST20 || p.VTDST || '').padStart(6, '0');
    const key = normalizeKey(countyFp, vtdst);
    const dem = Number(p.DEM_VOTES) || 0;
    const rep = Number(p.REP_VOTES) || 0;
    map.set(key, { demVotes: dem, repVotes: rep });
  }
  return map;
}

function loadPa2024(): Map<string, { demVotes: number; repVotes: number }> {
  const file = path.join(DATA_DIR, 'pa_2024_precincts_with_votes.geojson');
  const gj = JSON.parse(fs.readFileSync(file, 'utf8')) as { features: Array<{ properties?: Record<string, unknown> }> };
  const map = new Map<string, { demVotes: number; repVotes: number }>();

  for (const f of gj.features || []) {
    const p = f.properties || {};
    const countyFp = String(p.COUNTYFP20 || p.COUNTYFP || '').padStart(3, '0');
    const vtdst = String(p.VTDST20 || p.VTDST || '').padStart(6, '0');
    const key = normalizeKey(countyFp, vtdst);
    const dem = Number(p.dem_votes || p.DEM_VOTES) || 0;
    const rep = Number(p.rep_votes || p.REP_VOTES) || 0;
    map.set(key, { demVotes: dem, repVotes: rep });
  }
  return map;
}

function computeScores(record: ElectionRecord, data2022?: { demVotes: number; repVotes: number }, data2024?: { demVotes: number; repVotes: number }) {
  const margin = record.margin;
  const demPct = record.demPct;
  const turnout = record.turnout ?? 65;
  const absMargin = Math.abs(margin);

  const supportStrength = Math.min(100, Math.max(0, demPct));
  const turnoutOpportunity = Math.min(100, Math.max(0, 100 - turnout));
  const marginCloseness = Math.min(100, Math.max(0, 100 - absMargin));

  const margins: number[] = [record.margin];
  if (data2022 && data2022.demVotes + data2022.repVotes > 0) {
    const total = data2022.demVotes + data2022.repVotes;
    margins.push((data2022.demVotes / total) * 100 - (data2022.repVotes / total) * 100);
  }
  if (data2024 && data2024.demVotes + data2024.repVotes > 0) {
    const total = data2024.demVotes + data2024.repVotes;
    margins.push((data2024.demVotes / total) * 100 - (data2024.repVotes / total) * 100);
  }
  const avgMargin = margins.reduce((a, b) => a + b, 0) / margins.length;
  const avgMarginCount = margins.length;
  const effectiveMarginCloseness = avgMarginCount > 1 ? 100 - Math.abs(avgMargin / avgMarginCount) : marginCloseness;

  const voterPoolWeight = Math.min(100, (record.registeredVoters ?? record.totalVotes) / 50);

  const gotvPriority = Math.min(
    100,
    Math.max(
      0,
      (supportStrength * 0.4 + turnoutOpportunity * 0.4 + voterPoolWeight * 0.2) * (demPct > 45 ? 1.2 : 0.8)
    )
  );

  const persuasionOpportunity = Math.min(100, Math.max(0, effectiveMarginCloseness * 1.1));

  let gotvClassification: string;
  if (gotvPriority >= 70) gotvClassification = 'High Priority';
  else if (gotvPriority >= 55) gotvClassification = 'Medium-High';
  else if (gotvPriority >= 40) gotvClassification = 'Medium';
  else gotvClassification = 'Low Priority';

  let persuasionClassification: string;
  if (persuasionOpportunity >= 50) persuasionClassification = 'Moderate Opportunity';
  else persuasionClassification = 'Limited Opportunity';

  let targetingStrategy: string;
  if (absMargin < 12 && demPct > 40 && demPct < 60) {
    targetingStrategy = 'Battleground';
  } else if (margin > 25 && turnout < 72) {
    targetingStrategy = 'Base Mobilization';
  } else if (margin < -25) {
    targetingStrategy = 'Maintenance';
  } else if (absMargin >= 12 && absMargin < 30) {
    targetingStrategy = 'Persuasion Target';
  } else if (margin > 25) {
    targetingStrategy = 'Maintenance';
  } else {
    targetingStrategy = 'Persuasion Target';
  }

  const combinedScore = (gotvPriority + persuasionOpportunity) / 2;
  const targetingPriority = targetingStrategy === 'Battleground' ? 1 : targetingStrategy === 'Base Mobilization' ? 2 : targetingStrategy === 'Persuasion Target' ? 3 : 4;

  const recommendation =
    targetingStrategy === 'Battleground'
      ? 'High-priority competitive area: Persuasion and GOTV'
      : targetingStrategy === 'Base Mobilization'
        ? 'GOTV focus: Strong support with turnout opportunity'
        : targetingStrategy === 'Persuasion Target'
          ? 'Persuasion focus: Swing voters present'
          : 'Maintenance: Lower campaign priority';

  return {
    gotv_priority: Math.round(gotvPriority * 10) / 10,
    gotv_components: {
      support_strength: Math.round(supportStrength * 10) / 10,
      turnout_opportunity: Math.round(turnoutOpportunity * 10) / 10,
      voter_pool_weight: Math.round(voterPoolWeight * 10) / 10,
    },
    gotv_classification: gotvClassification,
    persuasion_opportunity: Math.round(persuasionOpportunity * 10) / 10,
    persuasion_components: {
      margin_closeness: Math.round(effectiveMarginCloseness * 10) / 10,
      swing_factor: Math.round(effectiveMarginCloseness * 0.5 * 10) / 10,
      moderate_factor: 50,
      independent_factor: 50,
      low_engagement: Math.round(turnoutOpportunity * 10) / 10,
    },
    persuasion_classification: persuasionClassification,
    targeting_strategy: targetingStrategy,
    targeting_priority: targetingPriority,
    combined_score: Math.round(combinedScore * 10) / 10,
    recommendation,
  };
}

function main() {
  console.log('[build-pa-targeting-scores] Loading PA election data...');
  const data2020 = loadPa2020();
  const data2022 = loadPa2022();
  const data2024 = loadPa2024();

  console.log(`[build-pa-targeting-scores] 2020: ${data2020.size}, 2022: ${data2022.size}, 2024: ${data2024.size}`);

  const precincts: Record<string, any> = {};
  const strategyCounts: Record<string, number> = {};
  const gotvCounts: Record<string, number> = {};
  const persuasionCounts: Record<string, number> = {};
  const gotvValues: number[] = [];
  const persuasionValues: number[] = [];
  const combinedValues: number[] = [];

  for (const [uniqueId, record] of data2020) {
    const compKey = normalizeKey(record.countyFp, record.vtdst);
    const d22 = data2022.get(compKey);
    const d24 = data2024.get(compKey);
    const scores = computeScores(record, d22, d24);

    precincts[uniqueId] = {
      precinct_id: uniqueId,
      precinct_name: record.name,
      short_name: record.name,
      jurisdiction: record.countyFp,
      registered_voters: record.registeredVoters,
      ...scores,
    };

    strategyCounts[scores.targeting_strategy] = (strategyCounts[scores.targeting_strategy] || 0) + 1;
    gotvCounts[scores.gotv_classification] = (gotvCounts[scores.gotv_classification] || 0) + 1;
    persuasionCounts[scores.persuasion_classification] = (persuasionCounts[scores.persuasion_classification] || 0) + 1;
    gotvValues.push(scores.gotv_priority);
    persuasionValues.push(scores.persuasion_opportunity);
    combinedValues.push(scores.combined_score);
  }

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const std = (arr: number[]) => {
    const m = avg(arr);
    return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length);
  };

  const output = {
    metadata: {
      generated: new Date().toISOString(),
      source: 'pa_2020_presidential, pa_2022_precinct, pa_2024_precincts_with_votes',
      precinct_count: Object.keys(precincts).length,
      scores_calculated: ['gotv_priority', 'persuasion_opportunity', 'combined_score', 'targeting_strategy'],
    },
    summary: {
      strategy_distribution: strategyCounts,
      gotv_distribution: gotvCounts,
      persuasion_distribution: persuasionCounts,
      score_stats: {
        gotv: {
          mean: Math.round(avg(gotvValues) * 10) / 10,
          median: Math.round(gotvValues.sort((a, b) => a - b)[Math.floor(gotvValues.length / 2)] * 10) / 10,
          std: Math.round(std(gotvValues) * 10) / 10,
          min: Math.min(...gotvValues),
          max: Math.max(...gotvValues),
        },
        persuasion: {
          mean: Math.round(avg(persuasionValues) * 10) / 10,
          median: Math.round(persuasionValues.sort((a, b) => a - b)[Math.floor(persuasionValues.length / 2)] * 10) / 10,
          std: Math.round(std(persuasionValues) * 10) / 10,
          min: Math.min(...persuasionValues),
          max: Math.max(...persuasionValues),
        },
        combined: {
          mean: Math.round(avg(combinedValues) * 10) / 10,
          median: Math.round(combinedValues.sort((a, b) => a - b)[Math.floor(combinedValues.length / 2)] * 10) / 10,
          std: Math.round(std(combinedValues) * 10) / 10,
          min: Math.min(...combinedValues),
          max: Math.max(...combinedValues),
        },
      },
    },
    precincts,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8');
  console.log(`[build-pa-targeting-scores] Wrote ${OUTPUT_FILE}`);
  console.log(`[build-pa-targeting-scores] Strategy distribution:`, strategyCounts);
}

main();
