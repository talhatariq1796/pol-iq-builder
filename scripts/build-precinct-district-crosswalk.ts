/**
 * Build <state>_precinct_district_crosswalk.json
 * Spatial join: precinct centroid → legislative, municipal, school, ZIP districts.
 *
 * Usage:
 *   npx ts-node scripts/build-precinct-district-crosswalk.ts --state=california
 *   npx ts-node scripts/build-precinct-district-crosswalk.ts --state=pennsylvania
 */

import * as fs from 'fs';
import * as path from 'path';
import * as turf from '@turf/turf';
import type { Feature, FeatureCollection, MultiPolygon, Point, Polygon } from 'geojson';
import { loadStateConfig } from './lib/load-state-config';
import type { CRS } from './types/state-build-config';

function abs(p: string) { return path.join(process.cwd(), p); }

// ---------------------------------------------------------------------------
// Reprojection (for 3857 district layers like PA DCED files)
// ---------------------------------------------------------------------------

function webMercToLngLat(x: number, y: number): [number, number] {
  const lng = (x / 20037508.34) * 180;
  let lat = (y / 20037508.34) * 180;
  lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
  return [lng, lat];
}

function reprojectRing(ring: number[][]): number[][] {
  return ring.map(([x, y]) => webMercToLngLat(x, y));
}

function reproject3857FC(fc: FeatureCollection<Polygon | MultiPolygon>): FeatureCollection<Polygon | MultiPolygon> {
  return {
    type: 'FeatureCollection',
    features: fc.features.map(f => {
      const g = f.geometry;
      if (!g) return f;
      if (g.type === 'Polygon') return { ...f, geometry: { type: 'Polygon', coordinates: g.coordinates.map(reprojectRing) } };
      if (g.type === 'MultiPolygon') return { ...f, geometry: { type: 'MultiPolygon', coordinates: g.coordinates.map(p => p.map(reprojectRing)) } };
      return f;
    }),
  };
}

// ---------------------------------------------------------------------------
// Spatial index
// ---------------------------------------------------------------------------

type PolyFeat = Feature<Polygon | MultiPolygon>;
type BBox2D = [number, number, number, number];

interface IndexedPoly { f: PolyFeat; bbox: BBox2D; }

function bboxOf(f: PolyFeat): BBox2D {
  const b = turf.bbox(f);
  return [b[0], b[1], b[2], b[3]];
}

function loadAndIndex(filePath: string, crs?: CRS): IndexedPoly[] {
  if (!fs.existsSync(filePath)) return [];
  let fc = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as FeatureCollection<Polygon | MultiPolygon>;
  if (crs === '3857') fc = reproject3857FC(fc);
  return fc.features
    .filter(f => f.geometry)
    .map(f => ({ f, bbox: bboxOf(f) }));
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ---------------------------------------------------------------------------
// Point-in-polygon finders
// ---------------------------------------------------------------------------

function findContaining(
  indexed: IndexedPoly[],
  lon: number,
  lat: number,
  pick: (props: GeoJSON.GeoJsonProperties) => string | null,
): string | null {
  const pt = turf.point([lon, lat]);
  for (const { f, bbox } of indexed) {
    if (lon < bbox[0] || lon > bbox[2] || lat < bbox[1] || lat > bbox[3]) continue;
    try {
      if (turf.booleanPointInPolygon(pt, f)) return pick(f.properties);
    } catch { continue; }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const cfg = loadStateConfig();
  const dataDir = cfg.dataDir;
  const dist = cfg.districts;

  console.log(`\nBuilding district crosswalk for ${cfg.stateName}…`);

  // Load primary precincts
  const precinctFile = abs(path.join(dataDir, cfg.precincts.file));
  if (!fs.existsSync(precinctFile)) {
    throw new Error(`Primary precinct file not found: ${precinctFile}\nRun organize:data first.`);
  }
  const precinctFc = JSON.parse(fs.readFileSync(precinctFile, 'utf-8')) as FeatureCollection<Polygon | MultiPolygon>;
  console.log(`  ${precinctFc.features.length.toLocaleString()} precincts`);

  // Load district layers
  const houseIdx  = dist.stateHouse    ? loadAndIndex(abs(path.join(dataDir, dist.stateHouse.file)),    dist.stateHouse.crs)    : [];
  const senateIdx = dist.stateSenate   ? loadAndIndex(abs(path.join(dataDir, dist.stateSenate.file)),   dist.stateSenate.crs)   : [];
  const congressIdx= dist.congressional ? loadAndIndex(abs(path.join(dataDir, dist.congressional.file)), dist.congressional.crs) : [];
  const muniIdx   = dist.municipality  ? loadAndIndex(abs(path.join(dataDir, dist.municipality.file)),  dist.municipality.crs)  : [];
  const schoolIdx = dist.schoolDistrict ? loadAndIndex(abs(path.join(dataDir, dist.schoolDistrict.file)), dist.schoolDistrict.crs) : [];
  const zipIdx    = dist.zipCode       ? loadAndIndex(abs(path.join(dataDir, dist.zipCode.file)),        dist.zipCode.crs)       : [];

  console.log(`  Loaded: house=${houseIdx.length} senate=${senateIdx.length} congress=${congressIdx.length} muni=${muniIdx.length} school=${schoolIdx.length} zip=${zipIdx.length}`);

  // ---------------------------------------------------------------------------
  // Helpers per district type
  // ---------------------------------------------------------------------------

  const findDistrict = (
    indexed: IndexedPoly[],
    lon: number, lat: number,
    idField: string,
    slugPrefix: string,
    padWidth?: number,
  ): string | null => {
    if (!indexed.length) return null;
    return findContaining(indexed, lon, lat, props => {
      const o = props as Record<string, unknown>;
      // Handle dotted key names (e.g. "PA.SLDUST")
      const key = Object.keys(o).find(k => k === idField || k.endsWith('.' + idField)) ?? idField;
      const raw = o[key];
      const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
      if (!Number.isFinite(n)) return null;
      const padded = padWidth ? String(n).padStart(padWidth, '0') : String(n);
      return `${slugPrefix}-${padded}`;
    });
  };

  const findMunicipality = (lon: number, lat: number): { slug: string | null; type: string | null } => {
    if (!muniIdx.length || !dist.municipality) return { slug: null, type: null };
    const m = dist.municipality;
    const pt = turf.point([lon, lat]);
    for (const { f, bbox } of muniIdx) {
      if (lon < bbox[0] || lon > bbox[2] || lat < bbox[1] || lat > bbox[3]) continue;
      try {
        if (!turf.booleanPointInPolygon(pt, f)) continue;
        const o = f.properties as Record<string, unknown>;
        const name = String(o[m.nameField] ?? '').trim();
        const county = m.countyField ? String(o[m.countyField] ?? '').trim() : '';
        const geoid = m.geoidField ? String(o[m.geoidField] ?? '').trim() : '';
        const typeRaw = m.typeField ? String(o[m.typeField] ?? '').toUpperCase() : '';

        let muniType: string | null = null;
        if (typeRaw) {
          if (typeRaw === 'CITY' || typeRaw === 'C1') muniType = 'city';
          else if (typeRaw === 'BORO') muniType = 'borough';
          else if (typeRaw === 'TOWN') muniType = 'town';
          else if (typeRaw.includes('TWP')) muniType = 'township';
          else muniType = 'place';
        } else {
          muniType = 'place';
        }

        let slug: string | null = null;
        if (name) {
          slug = county ? `${slugify(county)}-${slugify(name)}` : slugify(name);
        } else if (geoid) {
          slug = `place-${geoid}`;
        }
        return { slug, type: muniType };
      } catch { continue; }
    }
    return { slug: null, type: null };
  };

  const findSchoolDistrict = (lon: number, lat: number): { id: string; name: string } | null => {
    if (!schoolIdx.length || !dist.schoolDistrict) return null;
    const sd = dist.schoolDistrict;
    return findContaining(schoolIdx, lon, lat, props => {
      const o = props as Record<string, unknown>;
      const rawId = String(o[sd.idField] ?? '').trim();
      if (!rawId || rawId === 'null') return null;
      const name = String(o[sd.nameField] ?? rawId).trim();
      return JSON.stringify({ id: `${sd.slugPrefix}-${rawId}`, name }); // embed as JSON
    }) as unknown as null;
  };

  const findZipCode = (lon: number, lat: number): { id: string; name: string } | null => {
    if (!zipIdx.length || !dist.zipCode) return null;
    const zc = dist.zipCode;
    return findContaining(zipIdx, lon, lat, props => {
      const o = props as Record<string, unknown>;
      const code = String(o[zc.idField] ?? '').trim().padStart(5, '0').slice(0, 5);
      if (!/^\d{5}$/.test(code)) return null;
      return JSON.stringify({ id: `${zc.slugPrefix}-${code}`, name: `ZIP ${code}` });
    }) as unknown as null;
  };

  // ---------------------------------------------------------------------------
  // Iterate precincts
  // ---------------------------------------------------------------------------
  const precincts: Record<string, Record<string, unknown>> = {};
  const coverage = { stateHouse: 0, stateSenate: 0, congressional: 0, municipalities: 0, schoolDistricts: 0, zcta: 0 };
  let n = 0;

  for (const feat of precinctFc.features) {
    if (!feat.geometry) continue;
    const props = feat.properties as Record<string, unknown>;
    const uniqueId = String(props[cfg.precincts.uniqueIdField] ?? '').trim();
    if (!uniqueId) continue;

    let lon: number, lat: number;
    try {
      const rep = turf.pointOnFeature(feat as PolyFeat);
      [lon, lat] = rep.geometry.coordinates;
    } catch {
      try { const c = turf.centroid(feat as PolyFeat); [lon, lat] = c.geometry.coordinates; }
      catch { continue; }
    }

    let centroidOut: [number, number];
    try { const c = turf.centroid(feat as PolyFeat); centroidOut = [c.geometry.coordinates[0], c.geometry.coordinates[1]]; }
    catch { centroidOut = [lon, lat]; }

    const houseSlug = dist.stateHouse
      ? findDistrict(houseIdx, lon, lat, dist.stateHouse.idField, dist.stateHouse.slugPrefix, dist.stateHouse.padWidth)
      : null;
    const senateSlug = dist.stateSenate
      ? findDistrict(senateIdx, lon, lat, dist.stateSenate.idField, dist.stateSenate.slugPrefix, dist.stateSenate.padWidth)
      : null;
    const congressSlug = dist.congressional
      ? findDistrict(congressIdx, lon, lat, dist.congressional.idField, dist.congressional.slugPrefix, dist.congressional.padWidth)
      : null;

    const { slug: muniSlug, type: muniType } = findMunicipality(lon, lat);

    // School district — stored as serialised JSON in findContaining return
    let schoolId: string | null = null, schoolName: string | null = null;
    const sdRaw = findSchoolDistrict(lon, lat);
    if (sdRaw) {
      try { const o = JSON.parse(sdRaw as unknown as string); schoolId = o.id; schoolName = o.name; } catch { schoolId = sdRaw as unknown as string; }
    }

    // ZIP code
    let zipId: string | null = null, zipName: string | null = null;
    const zipRaw = findZipCode(lon, lat);
    if (zipRaw) {
      try { const o = JSON.parse(zipRaw as unknown as string); zipId = o.id; zipName = o.name; } catch { zipId = zipRaw as unknown as string; }
    }

    if (houseSlug) coverage.stateHouse++;
    if (senateSlug) coverage.stateSenate++;
    if (congressSlug) coverage.congressional++;
    if (muniSlug) coverage.municipalities++;
    if (schoolId) coverage.schoolDistricts++;
    if (zipId) coverage.zcta++;

    const jurisdiction = String(props[cfg.precincts.nameField ?? 'NAME'] ?? uniqueId.split('-:-')[1] ?? uniqueId).trim();

    precincts[uniqueId] = {
      precinctId: uniqueId,
      precinctName: uniqueId,
      precinctNameAlt: [] as string[],
      jurisdiction,
      congressional: congressSlug,
      stateSenate: senateSlug,
      stateHouse: houseSlug,
      municipality: muniSlug,
      municipalityType: muniType,
      cityWard: null,
      schoolDistrict: schoolId,
      schoolDistrictName: schoolName,
      zcta: zipId,
      zctaName: zipName,
      registeredVoters: null,
      activeVoters: null,
      centroid: centroidOut,
    };

    n++;
    if (n % 1000 === 0) console.log(`  …${n.toLocaleString()} precincts`);
  }

  // ---------------------------------------------------------------------------
  // Write
  // ---------------------------------------------------------------------------
  const outFile = abs(path.join(dataDir, cfg.outputFiles.districtCrosswalk));
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify({
    metadata: {
      state: cfg.stateName,
      generated: new Date().toISOString(),
      precinctCount: Object.keys(precincts).length,
      districtCoverage: coverage,
    },
    precincts,
  }));

  console.log(`\nWrote ${Object.keys(precincts).length.toLocaleString()} precincts → ${cfg.outputFiles.districtCrosswalk}`);
  console.log('Coverage:', coverage);
}

main();
