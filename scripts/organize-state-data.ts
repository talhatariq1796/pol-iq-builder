/**
 * Organize raw state data into the app's expected folder structure.
 *
 * Reads organizeSteps from the state build config and executes:
 *   copy         — copy a GeoJSON as-is
 *   reproject    — reproject from EPSG:3857 or NAD83/4269 → WGS84, inject extra fields
 *   filter       — write only features matching a predicate (e.g. national → state-only)
 *   dir-copy     — copy files from one dir to another (with optional prefix filter)
 *
 * Usage:
 *   npx ts-node scripts/organize-state-data.ts --state=california
 *   npx ts-node scripts/organize-state-data.ts --state=pennsylvania
 *
 * After running, split large block-group files:
 *   npx ts-node scripts/split-geojson-for-github.ts \
 *     public/data/political/<state>/block-groups/<state>_block_groups.geojson \
 *     --max-mb=95
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import type { FeatureCollection, Feature, Polygon, MultiPolygon } from 'geojson';
import type {
  OrganizeOperation,
  OrganizeCopy,
  OrganizeReproject,
  OrganizeFilter,
  OrganizeDirCopy,
} from './types/state-build-config';
import { loadStateConfig } from './lib/load-state-config';

/** Files larger than this (bytes) use streaming readline instead of JSON.parse. */
const STREAM_THRESHOLD_BYTES = 500 * 1024 * 1024; // 500 MB

// ---------------------------------------------------------------------------
// Reprojection helpers
// ---------------------------------------------------------------------------

function webMercToWgs84(x: number, y: number): [number, number] {
  const lng = (x / 20037508.34) * 180;
  let lat = (y / 20037508.34) * 180;
  lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
  return [lng, lat];
}

/** NAD83 (EPSG:4269) → WGS84 difference is sub-metre; treat as identical. */
function nad83ToWgs84(x: number, y: number): [number, number] {
  return [x, y];
}

function reprojectRing(ring: number[][], from: '3857' | '4269'): number[][] {
  return ring.map(([x, y]) =>
    from === '3857' ? webMercToWgs84(x, y) : nad83ToWgs84(x, y),
  );
}

function reprojectGeometry(geom: GeoJSON.Geometry, from: '3857' | '4269'): GeoJSON.Geometry {
  if (geom.type === 'Polygon') {
    return { type: 'Polygon', coordinates: geom.coordinates.map(r => reprojectRing(r, from)) };
  }
  if (geom.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: geom.coordinates.map(poly => poly.map(r => reprojectRing(r, from))),
    };
  }
  // Pass through other geometry types (Point, LineString, etc.)
  return geom;
}

// ---------------------------------------------------------------------------
// Operation handlers
// ---------------------------------------------------------------------------

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function handleCopy(op: OrganizeCopy, dataDir: string) {
  const src = path.join(process.cwd(), dataDir, op.src);
  const dst = path.join(process.cwd(), dataDir, op.dst);
  if (!fs.existsSync(src)) {
    console.warn(`  [skip] Source not found: ${op.src}`);
    return;
  }
  if (fs.existsSync(dst)) {
    console.log(`  [skip] Already exists: ${op.dst}`);
    return;
  }
  ensureDir(path.dirname(dst));
  fs.copyFileSync(src, dst);
  const mb = (fs.statSync(dst).size / 1024 / 1024).toFixed(1);
  console.log(`  [copy] ${op.src} → ${op.dst} (${mb} MB)`);
}

function handleReproject(op: OrganizeReproject, dataDir: string) {
  const src = path.join(process.cwd(), dataDir, op.src);
  const dst = path.join(process.cwd(), dataDir, op.dst);
  if (!fs.existsSync(src)) {
    console.warn(`  [skip] Source not found: ${op.src}`);
    return;
  }
  if (fs.existsSync(dst)) {
    console.log(`  [skip] Already exists: ${op.dst}`);
    return;
  }
  ensureDir(path.dirname(dst));

  console.log(`  [reproject] ${op.src} (${op.srcCrs} → WGS84)…`);
  const srcMb = (fs.statSync(src).size / 1024 / 1024).toFixed(0);
  console.log(`    Reading ${srcMb} MB…`);

  const fc = JSON.parse(fs.readFileSync(src, 'utf8')) as FeatureCollection;
  const total = fc.features.length;
  console.log(`    ${total.toLocaleString()} features, reprojecting…`);

  const features = fc.features.map((f, i) => {
    if (i > 0 && i % 5000 === 0) console.log(`    …${i.toLocaleString()}/${total.toLocaleString()}`);

    const geom = f.geometry ? reprojectGeometry(f.geometry, op.srcCrs) : f.geometry;
    const extraProps = op.addFields ? op.addFields(f.properties as Record<string, unknown>) : {};
    return {
      ...f,
      geometry: geom,
      properties: { ...(f.properties || {}), ...extraProps },
    };
  });

  const out: FeatureCollection = { type: 'FeatureCollection', features };
  fs.writeFileSync(dst, JSON.stringify(out), 'utf8');
  const dstMb = (fs.statSync(dst).size / 1024 / 1024).toFixed(1);
  console.log(`  [reproject] Done → ${op.dst} (${dstMb} MB)`);
}

function handleFilter(op: OrganizeFilter, dataDir: string): Promise<void> | void {
  const src = path.join(process.cwd(), dataDir, op.src);
  const dst = path.join(process.cwd(), dataDir, op.dst);
  if (!fs.existsSync(src)) {
    console.warn(`  [skip] Source not found: ${op.src}`);
    return;
  }
  if (fs.existsSync(dst)) {
    console.log(`  [skip] Already exists: ${op.dst}`);
    return;
  }
  ensureDir(path.dirname(dst));

  const srcBytes = fs.statSync(src).size;
  const srcMb = (srcBytes / 1024 / 1024).toFixed(0);
  console.log(`  [filter] ${op.src} → ${op.dst}…`);
  console.log(`    Reading ${srcMb} MB…`);

  if (srcBytes > STREAM_THRESHOLD_BYTES) {
    return handleFilterStreaming(src, dst, op);
  }

  const fc = JSON.parse(fs.readFileSync(src, 'utf8')) as FeatureCollection;
  const before = fc.features.length;
  const features = fc.features.filter(f => op.keep((f.properties || {}) as Record<string, unknown>));
  const after = features.length;

  const out: FeatureCollection = { type: 'FeatureCollection', features };
  fs.writeFileSync(dst, JSON.stringify(out), 'utf8');
  const dstMb = (fs.statSync(dst).size / 1024 / 1024).toFixed(1);
  console.log(`  [filter] ${before.toLocaleString()} → ${after.toLocaleString()} features → ${op.dst} (${dstMb} MB)`);
}

/**
 * Streaming line-by-line filter for large GeoJSON files (>500 MB).
 * Assumes each feature is serialized on a single line, which is standard
 * for large Census TIGER GeoJSON exports.
 */
async function handleFilterStreaming(src: string, dst: string, op: OrganizeFilter): Promise<void> {
  const rl = readline.createInterface({ input: fs.createReadStream(src, { encoding: 'utf8' }), crlfDelay: Infinity });

  const ws = fs.createWriteStream(dst, { encoding: 'utf8' });
  ws.write('{"type":"FeatureCollection","features":[\n');

  let before = 0;
  let after = 0;
  let firstWritten = false;
  let inFeatures = false;

  for await (const line of rl) {
    const trimmed = line.trim();
    // Detect the start of the features array
    if (!inFeatures) {
      if (trimmed === '"features": [' || trimmed === '"features":[') inFeatures = true;
      continue;
    }
    // Strip trailing comma and detect end of features array
    const stripped = trimmed.replace(/,$/, '');
    if (stripped === ']' || stripped === ']}') break;
    if (!stripped.startsWith('{')) continue;

    before++;
    let feat: { properties?: Record<string, unknown> };
    try {
      feat = JSON.parse(stripped);
    } catch {
      continue;
    }

    if (!op.keep((feat.properties || {}) as Record<string, unknown>)) continue;

    if (firstWritten) ws.write(',\n');
    ws.write(stripped);
    firstWritten = true;
    after++;

    if (after % 500 === 0) process.stdout.write(`\r    …${after.toLocaleString()} matching / ${before.toLocaleString()} scanned`);
  }

  ws.write('\n]}');
  await new Promise<void>((res, rej) => ws.end((err: Error | null | undefined) => err ? rej(err) : res()));

  process.stdout.write('\n');
  const dstMb = (fs.statSync(dst).size / 1024 / 1024).toFixed(1);
  console.log(`  [filter] ${before.toLocaleString()} → ${after.toLocaleString()} features → ${path.basename(dst)} (${dstMb} MB)`);
}

function handleDirCopy(op: OrganizeDirCopy, dataDir: string) {
  const srcDir = path.join(process.cwd(), dataDir, op.srcDir);
  const dstDir = path.join(process.cwd(), dataDir, op.dstDir);

  if (!fs.existsSync(srcDir)) {
    console.warn(`  [skip] Source dir not found: ${op.srcDir}`);
    return;
  }

  ensureDir(dstDir);
  const files = fs.readdirSync(srcDir).filter(f => {
    if (!f.endsWith('.geojson')) return false;
    if (op.prefix && !f.startsWith(op.prefix)) return false;
    return true;
  });

  let copied = 0;
  let skipped = 0;
  for (const file of files) {
    const dst = path.join(dstDir, file);
    if (fs.existsSync(dst)) { skipped++; continue; }
    fs.copyFileSync(path.join(srcDir, file), dst);
    copied++;
  }
  console.log(`  [dir-copy] ${op.srcDir} → ${op.dstDir}: ${copied} copied, ${skipped} already existed`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const cfg = loadStateConfig();
  console.log(`\nOrganizing data for ${cfg.stateName}…`);

  if (cfg.organizeSteps.length === 0) {
    console.log('  No organize steps defined (data already organized).');
    return;
  }

  for (const op of cfg.organizeSteps) {
    switch (op.type) {
      case 'copy':      handleCopy(op, cfg.dataDir); break;
      case 'reproject': handleReproject(op, cfg.dataDir); break;
      case 'filter':    await handleFilter(op, cfg.dataDir); break;
      case 'dir-copy':  handleDirCopy(op, cfg.dataDir); break;
    }
  }

  console.log('\nOrganize complete.');
  console.log(
    'Next — split block groups if needed:\n' +
    `  npx ts-node scripts/split-geojson-for-github.ts ` +
    `${cfg.dataDir}/block-groups/<state>_block_groups.geojson --max-mb=95`,
  );
}

main().catch(err => { console.error(err); process.exit(1); });
