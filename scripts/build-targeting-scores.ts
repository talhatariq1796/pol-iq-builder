/**
 * Build precinct_targeting_scores.json + <state>_precinct_election_history.json
 * for any configured state.
 *
 * Usage:
 *   npx ts-node scripts/build-targeting-scores.ts --state=california
 *   npx ts-node scripts/build-targeting-scores.ts --state=pennsylvania
 *
 * Algorithm (state-agnostic):
 *   1. Load primary precinct geometry (config.precincts.file)
 *   2. For each election year, load vote data (may be same file as primary or separate)
 *   3. Join multi-year votes using county+precinct key
 *   4. Compute GOTV priority, persuasion opportunity, swing potential, combined score
 *   5. Write targeting scores JSON + election history JSON
 */

import * as fs from 'fs';
import * as path from 'path';
import * as turf from '@turf/turf';
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from 'geojson';
import { loadStateConfig } from './lib/load-state-config';
import type { ElectionSource, PrecinctConfig, StateBuildConfig } from './types/state-build-config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function abs(p: string) { return path.join(process.cwd(), p); }

function normalizeKey(county: string, precinct: string, countyPad = 3, precinctPad = 6): string {
  return `${String(county).padStart(countyPad, '0')}_${String(precinct).padStart(precinctPad, '0')}`;
}

function parseVote(v: unknown): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function marginStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, x) => s + (x - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// ---------------------------------------------------------------------------
// Population estimation via block-group centroid join
// ---------------------------------------------------------------------------

function estimatePopulationByPrecinct(
  precinctFeatures: Feature[],
  popFile: string,
  countyFipsField: string,
  totalPopField: string,
  geoidField: string,
): Map<string, number> {
  const result = new Map<string, number>();
  if (!fs.existsSync(popFile)) {
    console.warn('  [pop] No population file found — total_population will be omitted.');
    return result;
  }

  const popGj = JSON.parse(fs.readFileSync(popFile, 'utf8')) as FeatureCollection;

  // Detect if the population layer is EPSG:3857 by checking first coordinate
  // (3857 coords are in meters, so |x| >> 180)
  let popIs3857 = false;
  for (const f of popGj.features || []) {
    const g = f.geometry;
    if (!g) continue;
    // Walk into nested arrays until we reach a number pair
    let node: unknown = (g as { coordinates: unknown }).coordinates;
    while (Array.isArray(node) && Array.isArray(node[0])) node = node[0];
    const pair = node as number[];
    if (Array.isArray(pair) && typeof pair[0] === 'number' && Math.abs(pair[0]) > 1000) {
      popIs3857 = true;
    }
    break;
  }
  if (popIs3857) console.log('  [pop] Detected EPSG:3857 geometry — converting centroids to Mercator for PIP');

  const byCounty = new Map<string, Feature[]>();
  for (const bg of popGj.features || []) {
    const id = String((bg.properties as Record<string, unknown>)?.[geoidField] ?? '');
    if (id.length < 5) continue;
    const county = id.slice(2, 5);
    if (!byCounty.has(county)) byCounty.set(county, []);
    byCounty.get(county)!.push(bg);
  }

  let hit = 0, miss = 0;
  for (const f of precinctFeatures) {
    const p = (f.properties || {}) as Record<string, unknown>;
    const uid = String(p.UNIQUE_ID ?? '');
    const cfp = String(p[countyFipsField] ?? '').padStart(3, '0');
    if (!uid) continue;
    try {
      const cent = turf.centroid(f as Feature);
      // If population layer is in 3857, project the centroid to Mercator before PIP
      const pipPt = popIs3857
        ? { type: 'Feature' as const, geometry: turf.toMercator(cent.geometry), properties: {} }
        : cent;
      const bgs = byCounty.get(cfp) || [];
      let pop = 0;
      for (const bg of bgs) {
        const g = bg.geometry;
        if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) continue;
        if (turf.booleanPointInPolygon(pipPt, { type: 'Feature', geometry: g, properties: {} } as Feature<Polygon | MultiPolygon>)) {
          pop = Number((bg.properties as Record<string, unknown>)?.[totalPopField]) || 0;
          break;
        }
      }
      if (pop > 0) { result.set(uid, Math.round(pop)); hit++; } else miss++;
    } catch { miss++; }
  }
  console.log(`  [pop] matched ${hit}, unmatched ${miss}`);
  return result;
}

// ---------------------------------------------------------------------------
// Election data loading
// ---------------------------------------------------------------------------

interface VoteRow { demVotes: number; repVotes: number; registered?: number; }

/**
 * Load vote data from a GeoJSON file into a map keyed by join key.
 * If the file is the primary geometry file, key by UNIQUE_ID directly.
 */
function loadElectionVotes(
  src: ElectionSource,
  precinctsCfg: PrecinctConfig,
  dataDir: string,
  isPrimary: boolean,
): Map<string, VoteRow> {
  const filePath = abs(path.join(dataDir, src.file));
  if (!fs.existsSync(filePath)) {
    console.warn(`  [election ${src.year}] File not found: ${src.file}`);
    return new Map();
  }

  const gj = JSON.parse(fs.readFileSync(filePath, 'utf8')) as { features: Array<{ properties?: Record<string, unknown> }> };
  const map = new Map<string, VoteRow>();

  const countyPad = src.countyPad ?? 3;
  const precinctPad = src.precinctPad ?? 6;

  for (const f of gj.features || []) {
    const p = f.properties || {};
    const dem = parseVote(p[src.demField]);
    const rep = parseVote(p[src.repField]);
    const regDem = src.registeredDemField ? parseVote(p[src.registeredDemField]) : 0;
    const regRep = src.registeredRepField ? parseVote(p[src.registeredRepField]) : 0;
    const registered = regDem + regRep > 0 ? regDem + regRep : undefined;

    let key: string;
    if (isPrimary) {
      // Same file as primary geometry → key by UNIQUE_ID
      key = String(p[precinctsCfg.uniqueIdField] ?? '');
    } else {
      // Separate file → build join key from county+precinct fields
      const county = String(p[src.countyField ?? precinctsCfg.countyFipsField] ?? '');
      const precinct = String(p[src.precinctField ?? precinctsCfg.vtdstField] ?? '');
      key = normalizeKey(county, precinct, countyPad, precinctPad);
    }
    if (!key) continue;
    map.set(key, { demVotes: dem, repVotes: rep, registered });
  }
  console.log(`  [election ${src.year}] ${map.size.toLocaleString()} precincts loaded from ${path.basename(src.file)}`);
  return map;
}

// ---------------------------------------------------------------------------
// Scoring (state-agnostic)
// ---------------------------------------------------------------------------

function buildPrecinctElectionPayload(
  registered: number | undefined,
  demVotes: number,
  repVotes: number,
  electionType: 'general' | 'midterm',
  office: string,
  stateName: string,
) {
  const totalVotes = demVotes + repVotes;
  let reg = registered && registered > 0 ? registered : totalVotes;
  if (reg > 0 && totalVotes > reg) reg = totalVotes;
  const turnout = reg > 0 ? (totalVotes / reg) * 100 : 0;
  return {
    type: electionType,
    registered_voters: reg,
    ballots_cast: totalVotes,
    turnout,
    races: {
      [office]: {
        office,
        district: stateName,
        candidates: [] as unknown[],
        total_votes: totalVotes,
        dem_votes: demVotes,
        rep_votes: repVotes,
        other_votes: 0,
        winner: demVotes >= repVotes ? 'Democratic' : 'Republican',
        winner_party: demVotes >= repVotes ? 'DEM' : 'REP',
      },
    },
  };
}

function computeScores(
  demPct: number,
  repPct: number,
  margin: number,
  turnout: number,
  registeredVoters: number,
  totalVotes: number,
  allMargins: number[],
) {
  const absMargin = Math.abs(margin);
  const supportStrength = Math.min(100, Math.max(0, demPct));
  const turnoutOpportunity = Math.min(100, Math.max(0, 100 - turnout));
  const marginCloseness = Math.min(100, Math.max(0, 100 - absMargin));

  const avgMargin = allMargins.reduce((a, b) => a + b, 0) / allMargins.length;
  const effectiveMarginCloseness =
    allMargins.length > 1
      ? 100 - Math.abs(avgMargin / allMargins.length)
      : marginCloseness;

  const voterPoolWeight = Math.min(100, (registeredVoters > 0 ? registeredVoters : totalVotes) / 50);

  const gotvPriority = Math.min(100, Math.max(0,
    (supportStrength * 0.4 + turnoutOpportunity * 0.4 + voterPoolWeight * 0.2) *
    (demPct > 45 ? 1.2 : 0.8),
  ));
  const persuasionOpportunity = Math.min(100, Math.max(0, effectiveMarginCloseness * 1.1));

  let gotvClassification: string;
  if (gotvPriority >= 70) gotvClassification = 'High Priority';
  else if (gotvPriority >= 55) gotvClassification = 'Medium-High';
  else if (gotvPriority >= 40) gotvClassification = 'Medium';
  else gotvClassification = 'Low Priority';

  let targetingStrategy: string;
  if (absMargin < 12 && demPct > 40 && demPct < 60) targetingStrategy = 'Battleground';
  else if (margin > 25 && turnout < 72) targetingStrategy = 'Base Mobilization';
  else if (margin < -25) targetingStrategy = 'Maintenance';
  else if (absMargin >= 12 && absMargin < 30) targetingStrategy = 'Persuasion Target';
  else if (margin > 25) targetingStrategy = 'Maintenance';
  else targetingStrategy = 'Persuasion Target';

  const combinedScore = (gotvPriority + persuasionOpportunity) / 2;
  const volatility = marginStdDev(allMargins);
  const partisan_lean = Math.round((demPct - 50) * 2 * 10) / 10;
  const swing_potential =
    allMargins.length >= 2 && volatility >= 0.25
      ? Math.min(100, Math.round(volatility * 3.2 * 10) / 10)
      : Math.min(100, Math.round((100 - absMargin) * 0.62 * 10) / 10);

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
    persuasion_classification: persuasionOpportunity >= 50 ? 'Moderate Opportunity' : 'Limited Opportunity',
    targeting_strategy: targetingStrategy,
    targeting_priority: targetingStrategy === 'Battleground' ? 1 : targetingStrategy === 'Base Mobilization' ? 2 : targetingStrategy === 'Persuasion Target' ? 3 : 4,
    combined_score: Math.round(combinedScore * 10) / 10,
    recommendation:
      targetingStrategy === 'Battleground' ? 'High-priority competitive area: Persuasion and GOTV'
      : targetingStrategy === 'Base Mobilization' ? 'GOTV focus: Strong support with turnout opportunity'
      : targetingStrategy === 'Persuasion Target' ? 'Persuasion focus: Swing voters present'
      : 'Maintenance: Lower campaign priority',
    swing_potential,
    political_scores: { partisan_lean, swing_potential },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const cfg = loadStateConfig();
  const dataDir = cfg.dataDir;

  console.log(`\nBuilding targeting scores for ${cfg.stateName}…`);

  // Load primary geometry
  const primaryFile = abs(path.join(dataDir, cfg.precincts.file));
  if (!fs.existsSync(primaryFile)) {
    throw new Error(`Primary precinct file not found: ${primaryFile}\nRun organize:data first.`);
  }
  console.log(`Loading primary geometry: ${cfg.precincts.file}…`);
  const primaryGj = JSON.parse(fs.readFileSync(primaryFile, 'utf8')) as FeatureCollection;
  console.log(`  ${primaryGj.features.length.toLocaleString()} features`);

  // Population file (from demographics dir, totalPopulation)
  const popFile = cfg.demographics.files.totalPopulation
    ? abs(path.join(dataDir, cfg.demographics.dir, cfg.demographics.files.totalPopulation))
    : abs(path.join(dataDir, 'demographics', 'pa_total_population_2025.geojson')); // PA legacy path

  const popByPrecinct = estimatePopulationByPrecinct(
    primaryGj.features,
    popFile,
    cfg.precincts.countyFipsField,
    cfg.demographics.fields.totalPop,
    cfg.demographics.fields.geoid,
  );

  // Load each election source
  const electionMaps = new Map<string, Map<string, VoteRow>>();
  for (const src of cfg.elections) {
    const isPrimary = src.file === cfg.precincts.file;
    const votes = loadElectionVotes(src, cfg.precincts, dataDir, isPrimary);
    electionMaps.set(src.year, votes);
  }

  // Sort elections by year for consistent margin ordering
  const sortedElections = [...cfg.elections].sort((a, b) => a.year.localeCompare(b.year));
  const primaryElection = sortedElections[0]; // oldest = base for UNIQUE_ID iteration

  // ---------------------------------------------------------------------------
  // Build output: iterate primary geometry features
  // ---------------------------------------------------------------------------
  const precincts: Record<string, unknown> = {};
  const electionPrecincts: Record<string, { elections: Record<string, unknown> }> = {};
  const strategyCounts: Record<string, number> = {};

  for (const f of primaryGj.features || []) {
    const p = (f.properties || {}) as Record<string, unknown>;
    const uniqueId = String(p[cfg.precincts.uniqueIdField] ?? '').trim();
    const countyFp = String(p[cfg.precincts.countyFipsField] ?? '').padStart(3, '0');
    const vtdst = String(p[cfg.precincts.vtdstField] ?? '').padStart(6, '0');
    if (!uniqueId) continue;

    // The join key for supplemental election files
    const joinKey = normalizeKey(countyFp, vtdst);

    // Collect votes from all election years
    const allMargins: number[] = [];
    const yearVotes: Record<string, VoteRow & { margin: number; demPct: number; repPct: number }> = {};

    for (const src of sortedElections) {
      const elMap = electionMaps.get(src.year)!;
      // For primary-file elections, look up by UNIQUE_ID; for others by joinKey
      const isPrimary = src.file === cfg.precincts.file;
      const row = isPrimary ? elMap.get(uniqueId) : elMap.get(joinKey);
      if (!row || row.demVotes + row.repVotes === 0) continue;

      const total = row.demVotes + row.repVotes;
      const demPct = (row.demVotes / total) * 100;
      const repPct = (row.repVotes / total) * 100;
      const margin = demPct - repPct;
      allMargins.push(margin);
      yearVotes[src.year] = { ...row, margin, demPct, repPct };
    }

    if (allMargins.length === 0) continue; // no vote data for any year

    // Use the primary (first) year for base scores
    const baseYear = sortedElections.find(s => yearVotes[s.year]);
    if (!baseYear) continue;
    const base = yearVotes[baseYear.year];
    const turnout = base.registered && base.registered > 0
      ? (base.demVotes + base.repVotes) / base.registered * 100
      : 65;

    const scores = computeScores(
      base.demPct, base.repPct, base.margin, turnout,
      base.registered ?? base.demVotes + base.repVotes,
      base.demVotes + base.repVotes,
      allMargins,
    );

    const pop = popByPrecinct.get(uniqueId);
    // Fall back to total votes if no explicit registration count (e.g. CA 2020 has no reg fields)
    const registeredVoters = base.registered ?? (base.demVotes + base.repVotes);
    precincts[uniqueId] = {
      precinct_id: uniqueId,
      precinct_name: String(p[cfg.precincts.nameField ?? 'NAME'] ?? uniqueId),
      short_name: String(p[cfg.precincts.nameField ?? 'NAME'] ?? uniqueId),
      jurisdiction: countyFp,
      registered_voters: registeredVoters,
      ...(pop && pop > 0 ? { total_population: pop } : {}),
      ...scores,
    };

    strategyCounts[scores.targeting_strategy] = (strategyCounts[scores.targeting_strategy] || 0) + 1;

    // Election history entry
    const elections: Record<string, unknown> = {};
    for (const src of sortedElections) {
      const yv = yearVotes[src.year];
      if (!yv) continue;
      elections[src.date] = buildPrecinctElectionPayload(
        yv.registered, yv.demVotes, yv.repVotes, src.type, src.office, cfg.stateName,
      );
    }
    if (Object.keys(elections).length > 0) {
      electionPrecincts[uniqueId] = { elections };
    }
  }

  // ---------------------------------------------------------------------------
  // Compute summary stats (required by PoliticalDataService / analysis panel)
  // ---------------------------------------------------------------------------
  const allPrecinctValues = Object.values(precincts) as Array<Record<string, unknown>>;

  function statsOf(vals: number[]): { mean: number; median: number; min: number; max: number } {
    if (vals.length === 0) return { mean: 0, median: 0, min: 0, max: 0 };
    const sorted = [...vals].sort((a, b) => a - b);
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    return {
      mean: Math.round(mean * 10) / 10,
      median: Math.round(median * 10) / 10,
      min: Math.round(sorted[0] * 10) / 10,
      max: Math.round(sorted[sorted.length - 1] * 10) / 10,
    };
  }

  function distributionBuckets(vals: number[]): Record<string, number> {
    const buckets: Record<string, number> = {};
    for (const v of vals) {
      const lo = Math.floor(v / 10) * 10;
      const key = `${lo}-${lo + 10}`;
      buckets[key] = (buckets[key] || 0) + 1;
    }
    return buckets;
  }

  const gotvVals = allPrecinctValues.map(p => Number(p.gotv_priority)).filter(Number.isFinite);
  const persuasionVals = allPrecinctValues.map(p => Number(p.persuasion_opportunity)).filter(Number.isFinite);
  const combinedVals = allPrecinctValues.map(p => Number(p.combined_score)).filter(Number.isFinite);

  // ---------------------------------------------------------------------------
  // Write outputs
  // ---------------------------------------------------------------------------
  const outScores = abs(path.join(dataDir, cfg.outputFiles.targetingScores));
  const outHistory = abs(path.join(dataDir, cfg.outputFiles.electionHistory));
  fs.mkdirSync(path.dirname(outScores), { recursive: true });

  const precinctCount = Object.keys(precincts).length;
  fs.writeFileSync(outScores, JSON.stringify({
    metadata: {
      generated: new Date().toISOString(),
      state: cfg.stateName,
      precinct_count: precinctCount,
      elections: cfg.elections.map(e => ({ year: e.year, type: e.type, date: e.date, office: e.office })),
    },
    summary: {
      strategy_distribution: strategyCounts,
      gotv_distribution: distributionBuckets(gotvVals),
      persuasion_distribution: distributionBuckets(persuasionVals),
      score_stats: {
        gotv: statsOf(gotvVals),
        persuasion: statsOf(persuasionVals),
        combined: statsOf(combinedVals),
      },
    },
    precincts,
  }, null, 2));
  console.log(`\nWrote ${precinctCount.toLocaleString()} precincts → ${cfg.outputFiles.targetingScores}`);
  console.log('Strategy distribution:', strategyCounts);

  fs.writeFileSync(outHistory, JSON.stringify({
    metadata: {
      generated: new Date().toISOString(),
      state: cfg.stateName,
      elections: cfg.elections.map(e => ({ year: e.year, type: e.type, date: e.date })),
      precinct_count: Object.keys(electionPrecincts).length,
    },
    precincts: electionPrecincts,
  }, null, 2));
  console.log(`Wrote ${Object.keys(electionPrecincts).length.toLocaleString()} precincts → ${cfg.outputFiles.electionHistory}`);
}

main();
