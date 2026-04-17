/**
 * Merge California 2024 VBM analysis into the app election-history bundle.
 *
 * Input:
 *   public/data/political/california/CA_2024_VBM_Analysis/CA_2024_VBM_Analysis.dbf
 *
 * Output:
 *   public/data/political/california/precincts/ca_precinct_election_history.json
 *
 * The app's current CA precinct IDs come from the converted 2020 VEST precinct
 * layer: "<countyFP3>-:-<SRPREC>". The 2024 VBM file uses the same county/SRPREC
 * shape for a subset of rows, so this script merges only direct key matches.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as turf from '@turf/turf';
import type { Feature, Geometry, Polygon, MultiPolygon } from 'geojson';

const CA_DIR = path.join(process.cwd(), 'public/data/political/california');
const VBM_DBF = path.join(
  CA_DIR,
  'CA_2024_VBM_Analysis',
  'CA_2024_VBM_Analysis.dbf',
);
const VBM_SHP = path.join(
  CA_DIR,
  'CA_2024_VBM_Analysis',
  'CA_2024_VBM_Analysis.shp',
);
const ELECTION_HISTORY = path.join(
  CA_DIR,
  'precincts',
  'ca_precinct_election_history.json',
);
const PRECINCT_PARTS = [
  path.join(CA_DIR, 'precincts', 'ca_precincts.part000.geojson'),
  path.join(CA_DIR, 'precincts', 'ca_precincts.part001.geojson'),
  path.join(CA_DIR, 'precincts', 'ca_precincts.part002.geojson'),
];

interface DbfField {
  name: string;
  type: string;
  length: number;
}

interface VbmRow {
  SRPREC?: string;
  COUNTY?: string;
  ELECTION?: string;
  PREC_TYPE?: string;
  FIPS_CODE?: string;
  SRPREC_KEY?: string;
  TOTREG?: string;
  TOTVOTE?: string;
  DEMREG?: string;
  REPREG?: string;
  PRSDEM01?: string;
  PRSREP01?: string;
  TURN_Rate?: string;
  DEM_Share?: string;
  REP_Share?: string;
  DEM_RegPct?: string;
  REP_RegPct?: string;
}

interface ElectionHistoryFile {
  metadata: {
    generated: string;
    state: string;
    elections: Array<{ year: string; type: string; date: string; office?: string }>;
    precinct_count: number;
    conversion_notes?: string[];
  };
  precincts: Record<string, { elections: Record<string, unknown> }>;
}

interface IndexedPrecinct {
  key: string;
  county: string;
  bbox: [number, number, number, number];
  feature: Feature<Polygon | MultiPolygon>;
}

interface AggregatedVotes {
  key: string;
  totalReg: number;
  totalVote: number;
  demVotes: number;
  repVotes: number;
  sourceRows: number;
  matchMethod: 'direct' | 'spatial' | 'mixed';
}

function readDbfRows(dbfPath: string): VbmRow[] {
  const buf = fs.readFileSync(dbfPath);
  const recordCount = buf.readUInt32LE(4);
  const headerLength = buf.readUInt16LE(8);
  const recordLength = buf.readUInt16LE(10);
  const fields: DbfField[] = [];

  for (let offset = 32; offset < headerLength - 1; offset += 32) {
    if (buf[offset] === 0x0d) break;
    const name = buf
      .toString('ascii', offset, offset + 11)
      .replace(/\0.*$/, '')
      .trim();
    const type = String.fromCharCode(buf[offset + 11]);
    const length = buf[offset + 16];
    if (name) fields.push({ name, type, length });
  }

  const rows: VbmRow[] = [];
  for (let i = 0; i < recordCount; i++) {
    const offset = headerLength + i * recordLength;
    if (buf[offset] === 0x2a) continue;

    let pos = offset + 1;
    const row: Record<string, string> = {};
    for (const field of fields) {
      row[field.name] = buf.toString('utf8', pos, pos + field.length).trim();
      pos += field.length;
    }
    rows.push(row as VbmRow);
  }

  return rows;
}

function parseDbfNumber(value: string | undefined): number | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes('*')) return null;
  const parsed = Number(trimmed.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function buildPrecinctKey(row: VbmRow): string | null {
  const countyNum = parseInt(String(row.COUNTY ?? ''), 10);
  const srprec = String(row.SRPREC ?? '').trim();
  if (!Number.isFinite(countyNum) || !srprec) return null;
  const county = String(countyNum).padStart(3, '0');
  const precinct = srprec.replace(/^0+/, '') || '0';
  return `${county}-:-${precinct}`;
}

function pctFromRate(rate: number | null, totalVote: number, totalReg: number): number {
  const clampPct = (value: number) => Math.min(100, Math.max(0, value));
  if (rate != null && rate >= 0 && rate <= 1) {
    return Math.round(clampPct(rate * 100) * 10) / 10;
  }
  if (totalReg > 0) {
    return Math.round(clampPct((totalVote / totalReg) * 100) * 10) / 10;
  }
  return 0;
}

function loadCurrentPrecinctIndex(
  historyKeys: Set<string>,
): Map<string, IndexedPrecinct[]> {
  const byCounty = new Map<string, IndexedPrecinct[]>();

  for (const part of PRECINCT_PARTS) {
    const data = JSON.parse(fs.readFileSync(part, 'utf8')) as {
      features: Array<Feature<Polygon | MultiPolygon, Record<string, unknown>>>;
    };

    for (const feature of data.features || []) {
      const key = String(feature.properties?.UNIQUE_ID ?? '');
      if (!key || !historyKeys.has(key)) continue;
      if (
        !feature.geometry ||
        (feature.geometry.type !== 'Polygon' &&
          feature.geometry.type !== 'MultiPolygon')
      ) {
        continue;
      }

      const county = key.slice(0, 3);
      const bbox = turf.bbox(feature) as [number, number, number, number];
      const item: IndexedPrecinct = {
        key,
        county,
        bbox,
        feature: feature as Feature<Polygon | MultiPolygon>,
      };
      if (!byCounty.has(county)) byCounty.set(county, []);
      byCounty.get(county)!.push(item);
    }
  }

  return byCounty;
}

function pointInBbox(point: Feature, bbox: [number, number, number, number]): boolean {
  const coords = point.geometry.type === 'Point' ? point.geometry.coordinates : null;
  if (!coords) return false;
  const [x, y] = coords;
  return x >= bbox[0] && x <= bbox[2] && y >= bbox[1] && y <= bbox[3];
}

function findSpatialHistoryKey(
  geometry: Geometry | undefined,
  county: string,
  precinctIndex: Map<string, IndexedPrecinct[]>,
): string | null {
  if (!geometry || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) {
    return null;
  }

  const feature = { type: 'Feature', geometry, properties: {} } as Feature<
    Polygon | MultiPolygon
  >;
  const point = turf.centroid(feature);
  const candidates = precinctIndex.get(county) || [];

  for (const candidate of candidates) {
    if (
      pointInBbox(point, candidate.bbox) &&
      turf.booleanPointInPolygon(point, candidate.feature)
    ) {
      return candidate.key;
    }
  }

  return null;
}

function addAggregate(
  aggregates: Map<string, AggregatedVotes>,
  key: string,
  totalReg: number,
  totalVote: number,
  demVotes: number,
  repVotes: number,
  matchMethod: 'direct' | 'spatial',
) {
  const existing = aggregates.get(key);
  if (!existing) {
    aggregates.set(key, {
      key,
      totalReg,
      totalVote,
      demVotes,
      repVotes,
      sourceRows: 1,
      matchMethod,
    });
    return;
  }

  existing.totalReg += totalReg;
  existing.totalVote += totalVote;
  existing.demVotes += demVotes;
  existing.repVotes += repVotes;
  existing.sourceRows++;
  if (existing.matchMethod !== matchMethod) existing.matchMethod = 'mixed';
}

async function main() {
  if (!fs.existsSync(VBM_DBF)) {
    throw new Error(`Missing CA VBM DBF: ${VBM_DBF}`);
  }
  if (!fs.existsSync(VBM_SHP)) {
    throw new Error(`Missing CA VBM SHP: ${VBM_SHP}`);
  }
  if (!fs.existsSync(ELECTION_HISTORY)) {
    throw new Error(`Missing CA election history JSON: ${ELECTION_HISTORY}`);
  }

  const history = JSON.parse(
    fs.readFileSync(ELECTION_HISTORY, 'utf8'),
  ) as ElectionHistoryFile;
  const rows = readDbfRows(VBM_DBF);
  const historyKeys = new Set(Object.keys(history.precincts));
  const precinctIndex = loadCurrentPrecinctIndex(historyKeys);

  (globalThis as unknown as { self: unknown }).self = globalThis;
  const importShpjs = new Function('return import("shpjs")') as () => Promise<{
    parseShp: (buffer: ArrayBuffer) => Geometry[];
  }>;
  const shpjs = await importShpjs();
  const shpBuffer = fs.readFileSync(VBM_SHP);
  const geometries = shpjs.parseShp(
    shpBuffer.buffer.slice(
      shpBuffer.byteOffset,
      shpBuffer.byteOffset + shpBuffer.byteLength,
    ),
  ) as Geometry[];

  let normalized2020TurnoutUnavailable = 0;
  let rowsWithPresident = 0;
  let rowsWithTurnout = 0;
  let directMatchedRows = 0;
  let spatialMatchedRows = 0;
  let merged = 0;
  let skippedNoKey = 0;
  let skippedNoGeometry = 0;
  let skippedNoSpatialMatch = 0;
  let skippedInvalidVotes = 0;
  let skippedInvalidRegistration = 0;
  const aggregates = new Map<string, AggregatedVotes>();

  for (const precinct of Object.values(history.precincts)) {
    delete precinct.elections['2024-11-05'];
    const e2020 = precinct.elections['2020-11-03'] as
      | {
          registered_voters?: number;
          ballots_cast?: number;
          turnout?: number | null;
          turnout_source?: string;
        }
      | undefined;
    if (e2020) {
      if (
        e2020.turnout === 100 &&
        e2020.registered_voters === e2020.ballots_cast
      ) {
        e2020.turnout = null;
        e2020.turnout_source = 'unavailable_2020_registration_not_delivered';
      }
      if (
        e2020.turnout == null &&
        e2020.turnout_source === 'unavailable_2020_registration_not_delivered'
      ) {
        normalized2020TurnoutUnavailable++;
      }
    }
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const key = buildPrecinctKey(row);
    if (!key) {
      skippedNoKey++;
      continue;
    }

    const demVotes = parseDbfNumber(row.PRSDEM01);
    const repVotes = parseDbfNumber(row.PRSREP01);
    const totalVote = parseDbfNumber(row.TOTVOTE);
    const totalReg = parseDbfNumber(row.TOTREG);
    const turnoutRate = parseDbfNumber(row.TURN_Rate);

    if (totalReg != null && totalReg > 0 && turnoutRate != null) {
      rowsWithTurnout++;
    }
    if (demVotes != null && repVotes != null && demVotes + repVotes > 0) {
      rowsWithPresident++;
    }

    if (demVotes == null || repVotes == null || demVotes + repVotes <= 0) {
      skippedInvalidVotes++;
      continue;
    }
    if (totalReg == null || totalReg <= 0 || totalVote == null || totalVote < 0) {
      skippedInvalidRegistration++;
      continue;
    }

    let historyKey = history.precincts[key] ? key : null;
    let matchMethod: 'direct' | 'spatial' = 'direct';
    if (historyKey) {
      directMatchedRows++;
    } else {
      const geometry = geometries[i];
      const county = key.slice(0, 3);
      if (!geometry) {
        skippedNoGeometry++;
        continue;
      }
      historyKey = findSpatialHistoryKey(geometry, county, precinctIndex);
      if (!historyKey) {
        skippedNoSpatialMatch++;
        continue;
      }
      spatialMatchedRows++;
      matchMethod = 'spatial';
    }

    addAggregate(
      aggregates,
      historyKey,
      totalReg,
      totalVote,
      demVotes,
      repVotes,
      matchMethod,
    );
  }

  for (const aggregate of aggregates.values()) {
    const historyPrecinct = history.precincts[aggregate.key];
    if (!historyPrecinct) continue;

    const otherVotes = Math.max(
      0,
      Math.round(aggregate.totalVote - aggregate.demVotes - aggregate.repVotes),
    );
    const turnout = pctFromRate(null, aggregate.totalVote, aggregate.totalReg);

    historyPrecinct.elections['2024-11-05'] = {
      type: 'general',
      registered_voters: Math.round(aggregate.totalReg),
      ballots_cast: Math.round(aggregate.totalVote),
      turnout,
      source_rows: aggregate.sourceRows,
      match_method: aggregate.matchMethod,
      races: {
        President: {
          office: 'President',
          district: 'California',
          candidates: [],
          total_votes: Math.round(aggregate.totalVote),
          dem_votes: Math.round(aggregate.demVotes),
          rep_votes: Math.round(aggregate.repVotes),
          other_votes: otherVotes,
          winner:
            aggregate.demVotes >= aggregate.repVotes
              ? 'Democratic'
              : 'Republican',
          winner_party: aggregate.demVotes >= aggregate.repVotes ? 'DEM' : 'REP',
        },
      },
    };
    merged++;
  }

  const electionExists = history.metadata.elections.some(
    (e) => String(e.year) === '2024' && e.date === '2024-11-05',
  );
  if (!electionExists) {
    history.metadata.elections.push({
      year: '2024',
      type: 'general',
      date: '2024-11-05',
      office: 'President',
    });
  }
  history.metadata.elections.sort((a, b) => String(a.year).localeCompare(String(b.year)));
  history.metadata.generated = new Date().toISOString();
  history.metadata.precinct_count = Object.keys(history.precincts).length;
  history.metadata.conversion_notes = [
    '2020 data comes from the converted CA 2020 VEST precinct layer fields G20PREDBID/G20PRERTRU.',
    '2020 turnout is marked unavailable because the delivered 2020 source did not include real registration totals.',
    '2024 data was merged from CA_2024_VBM_Analysis by direct county/SRPREC key matches, then centroid-in-polygon spatial fallback onto the app precinct layer.',
    `${merged} app precincts received aggregated 2024 presidential VBM turnout/election records.`,
  ];

  fs.writeFileSync(ELECTION_HISTORY, `${JSON.stringify(history, null, 2)}\n`, 'utf8');

    console.log(
    JSON.stringify(
      {
        source: path.relative(process.cwd(), VBM_DBF),
        output: path.relative(process.cwd(), ELECTION_HISTORY),
        rows: rows.length,
        vbmGeometries: geometries.length,
        normalized2020TurnoutUnavailable,
        rowsWithPresident,
        rowsWithTurnout,
        directMatchedRows,
        spatialMatchedRows,
        aggregatePrecincts: aggregates.size,
        merged,
        skippedNoKey,
        skippedNoGeometry,
        skippedNoSpatialMatch,
        skippedInvalidVotes,
        skippedInvalidRegistration,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
