/**
 * Build <state>_precinct_demographics.json
 * Joins Esri ACS 2025 demographic layers (EPSG:3857) to precinct centroids.
 *
 * Usage:
 *   npx ts-node scripts/build-precinct-demographics.ts --state=california
 *   npx ts-node scripts/build-precinct-demographics.ts --state=pennsylvania
 */

import * as fs from 'fs';
import * as path from 'path';
import * as turf from '@turf/turf';
import type { Feature, FeatureCollection, Polygon, MultiPolygon, Point } from 'geojson';
import { loadStateConfig } from './lib/load-state-config';

const SQ_M_PER_SQ_MI = 2589988.110336;

function abs(p: string) { return path.join(process.cwd(), p); }

// ---------------------------------------------------------------------------
// Block-group attribute map (keyed by block-group ID field value)
// ---------------------------------------------------------------------------

interface BgAttrs {
  median_household_income?: number;
  educ_base?: number;
  hs?: number;
  some_col?: number;
  bach?: number;
  grad?: number;
  med_home_value?: number;
  median_age?: number;
}

function loadDemographicLayer(
  filePath: string,
  geoidField: string,
  pick: (props: Record<string, unknown>) => Partial<BgAttrs>,
): Map<string, BgAttrs> {
  if (!fs.existsSync(filePath)) return new Map();
  const gj = JSON.parse(fs.readFileSync(filePath, 'utf8')) as FeatureCollection;
  const out = new Map<string, BgAttrs>();
  for (const f of gj.features || []) {
    const props = (f.properties || {}) as Record<string, unknown>;
    const id = String(props[geoidField] ?? '');
    if (!id) continue;
    const cur = out.get(id) || {};
    out.set(id, { ...cur, ...pick(props) });
  }
  return out;
}

function mergeMaps(target: Map<string, BgAttrs>, source: Map<string, BgAttrs>) {
  for (const [id, attrs] of source) {
    const cur = target.get(id) || {};
    target.set(id, { ...cur, ...attrs });
  }
}

/** Index block-group features by 3-digit county FIPS (chars 2–4 of 11-char GEOID or ID). */
function indexByCounty(gj: FeatureCollection, geoidField: string): Map<string, Feature<Polygon | MultiPolygon>[]> {
  const m = new Map<string, Feature<Polygon | MultiPolygon>[]>();
  for (const f of gj.features || []) {
    const id = String((f.properties as Record<string, unknown>)?.[geoidField] ?? '');
    if (id.length < 5) continue;
    const county = id.slice(2, 5);
    if (!m.has(county)) m.set(county, []);
    m.get(county)!.push(f as Feature<Polygon | MultiPolygon>);
  }
  return m;
}

function pipWgs84(
  pt: Feature<Point>,
  byCounty: Map<string, Feature<Polygon | MultiPolygon>[]>,
  countyFp: string,
): Feature<Polygon | MultiPolygon> | null {
  const bgs = byCounty.get(countyFp) || [];
  for (const bg of bgs) {
    const g = bg.geometry;
    if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) continue;
    if (turf.booleanPointInPolygon(pt, { type: 'Feature', geometry: g, properties: {} } as Feature<Polygon | MultiPolygon>)) {
      return bg;
    }
  }
  return null;
}

function educationEntropy(a: BgAttrs): number {
  const base = a.educ_base || 0;
  if (base <= 0) return 50;
  const hs = Math.max(0, a.hs || 0);
  const sm = Math.max(0, a.some_col || 0);
  const ba = Math.max(0, a.bach || 0);
  const gr = Math.max(0, a.grad || 0);
  const parts = [hs / base, sm / base, ba / base, gr / base].filter(p => p > 1e-9);
  if (parts.length === 0) return 50;
  const h = -parts.reduce((s, p) => s + p * Math.log(p), 0);
  return Math.round(Math.min(100, Math.max(0, (h / Math.log(4)) * 100)) * 10) / 10;
}

function collegePct(a: BgAttrs): number {
  const base = a.educ_base || 0;
  if (base <= 0) return 0;
  return Math.round(((Math.max(0, a.bach || 0) + Math.max(0, a.grad || 0)) / base) * 1000) / 10;
}

function ownerPctFromHomeValue(medVal: number | undefined): number {
  if (medVal == null || medVal <= 0 || !Number.isFinite(medVal)) return 62;
  const v = Math.min(1.2, Math.max(0, medVal / 450000));
  return Math.round(Math.min(92, Math.max(28, 32 + v * 48)) * 10) / 10;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const cfg = loadStateConfig();
  const dataDir = cfg.dataDir;
  const demo = cfg.demographics;
  const demoDir = abs(path.join(dataDir, demo.dir));
  const f = demo.fields;

  console.log(`\nBuilding precinct demographics for ${cfg.stateName}…`);

  const precinctFile = abs(path.join(dataDir, cfg.precincts.file));
  if (!fs.existsSync(precinctFile)) {
    throw new Error(`Primary precinct file not found: ${precinctFile}\nRun organize:data first.`);
  }

  console.log('Loading precinct geometry…');
  const precinctGj = JSON.parse(fs.readFileSync(precinctFile, 'utf8')) as FeatureCollection;

  // Load targeting scores for population fallback
  const targetingPath = abs(path.join(dataDir, cfg.outputFiles.targetingScores));
  const targetingPopMap: Record<string, number> = {};
  if (fs.existsSync(targetingPath)) {
    const td = JSON.parse(fs.readFileSync(targetingPath, 'utf8')) as { precincts?: Record<string, { total_population?: number }> };
    for (const [id, row] of Object.entries(td.precincts || {})) {
      if (row.total_population) targetingPopMap[id] = row.total_population;
    }
  }

  // ---------------------------------------------------------------------------
  // Build merged BG attribute map from demographic layers
  // ---------------------------------------------------------------------------
  const bgMerged = new Map<string, BgAttrs>();

  const demFile = (name: string | null) =>
    name ? path.join(demoDir, name) : null;

  const mergeIfExists = (
    filePath: string | null,
    pick: (props: Record<string, unknown>) => Partial<BgAttrs>,
  ) => {
    if (!filePath) return;
    if (!fs.existsSync(filePath)) {
      console.warn(`  [demo] Not found, skipping: ${path.basename(filePath)}`);
      return;
    }
    mergeMaps(bgMerged, loadDemographicLayer(filePath, f.geoid, pick));
  };

  mergeIfExists(demFile(demo.files.educBase),        props => ({ educ_base: Number(props[f.educBase]) || 0 }));
  mergeIfExists(demFile(demo.files.hs),               props => ({ hs: Number(props[f.hs]) || 0 }));
  mergeIfExists(demFile(demo.files.someCollege),      props => ({ some_col: Number(props[f.someCollege]) || 0 }));
  mergeIfExists(demFile(demo.files.bach),             props => ({ bach: Number(props[f.bach]) || 0 }));
  mergeIfExists(demFile(demo.files.grad),             props => ({ grad: Number(props[f.grad]) || 0 }));
  mergeIfExists(demFile(demo.files.medianIncome),     props => ({ median_household_income: Number(props[f.medianIncome]) || 0 }));
  mergeIfExists(demFile(demo.files.medianHomeValue),  props => ({ med_home_value: Number(props[f.medianHomeValue]) || 0 }));

  // For Mercator PIP (3857 layers), build county index from educBase layer
  let mercByCounty = new Map<string, Feature<Polygon | MultiPolygon>[]>();
  const educBasePath = demFile(demo.files.educBase);
  if (educBasePath && fs.existsSync(educBasePath)) {
    mercByCounty = indexByCounty(
      JSON.parse(fs.readFileSync(educBasePath, 'utf8')) as FeatureCollection,
      f.geoid,
    );
  }

  // Median age (WGS84 layer, separate from Mercator stack)
  let ageByCounty = new Map<string, Feature<Polygon | MultiPolygon>[]>();
  if (demo.files.medianAge) {
    const agePath = path.isAbsolute(demo.files.medianAge)
      ? demo.files.medianAge
      : abs(path.join(demoDir, demo.files.medianAge));
    if (fs.existsSync(agePath)) {
      const ageGj = JSON.parse(fs.readFileSync(agePath, 'utf8')) as FeatureCollection;
      ageByCounty = indexByCounty(ageGj, f.geoid);
    }
  }

  // ---------------------------------------------------------------------------
  // Precinct-level join
  // ---------------------------------------------------------------------------
  console.log(`Processing ${precinctGj.features.length.toLocaleString()} precincts…`);
  const precincts: Record<string, Record<string, number>> = {};
  let hit = 0, miss = 0;

  for (const feat of precinctGj.features || []) {
    const p = (feat.properties || {}) as Record<string, unknown>;
    const uid = String(p[cfg.precincts.uniqueIdField] ?? '');
    const cfp = String(p[cfg.precincts.countyFipsField] ?? '').padStart(3, '0');
    if (!uid) continue;

    try {
      const cent = turf.centroid(feat as Feature);
      const areaSqM = turf.area(feat as Feature);
      const areaSqMi = areaSqM / SQ_M_PER_SQ_MI;

      // Age: WGS84 PIP
      const bgAge = pipWgs84(cent as Feature<Point>, ageByCounty, cfp);
      const medAge = bgAge ? Number((bgAge.properties as Record<string, unknown>)?.[f.medianAge]) || 0 : 0;

      // Mercator PIP for ACS layers
      const ptM = turf.toMercator(cent.geometry);
      const bgMerc = pipWgs84(
        { type: 'Feature', geometry: ptM as Point, properties: {} } as Feature<Point>,
        mercByCounty,
        cfp,
      );
      let attrs: BgAttrs | undefined;
      if (bgMerc) {
        const bid = String((bgMerc.properties as Record<string, unknown>)?.[f.geoid] ?? '');
        attrs = bgMerged.get(bid);
      }

      const popFromTargeting = targetingPopMap[uid];
      const pop = popFromTargeting && popFromTargeting > 0 ? popFromTargeting : Number(p.TOTPOP_CY) || 0;
      const density = areaSqMi > 0 && pop > 0 ? Math.round((pop / areaSqMi) * 10) / 10 : 0;

      const div = attrs ? educationEntropy(attrs) : 50;
      const coll = attrs ? collegePct(attrs) : 0;
      const hhi = attrs?.median_household_income || 0;
      const mhv = attrs?.med_home_value;
      const owner = ownerPctFromHomeValue(mhv);

      precincts[uid] = {
        median_age: Math.round(medAge * 10) / 10,
        median_household_income: Math.round(hhi),
        college_pct: coll,
        diversity_index: div,
        population_density: density,
        owner_pct: owner,
      };

      if (attrs && hhi > 0) hit++; else miss++;
    } catch { miss++; }
  }

  // ---------------------------------------------------------------------------
  // Write
  // ---------------------------------------------------------------------------
  const outFile = abs(path.join(dataDir, cfg.outputFiles.demographics));
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify({
    metadata: {
      generated: new Date().toISOString(),
      state: cfg.stateName,
      precinct_count: Object.keys(precincts).length,
    },
    precincts,
  }));
  console.log(
    `\nWrote ${Object.keys(precincts).length.toLocaleString()} precincts → ${cfg.outputFiles.demographics}`,
    `(full BG attrs: ${hit}, partial: ${miss})`,
  );
}

main();
