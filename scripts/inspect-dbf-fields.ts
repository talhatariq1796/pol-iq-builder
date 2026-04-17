/**
 * Inspect DBF field names from shapefiles without any extra dependencies.
 * Reads the binary DBF header to extract field names and types.
 *
 * Usage: npx ts-node scripts/inspect-dbf-fields.ts
 */

import * as fs from 'fs';
import * as path from 'path';

function readDbfFields(dbfPath: string): Array<{ name: string; type: string; length: number }> {
  if (!fs.existsSync(dbfPath)) {
    console.error(`  File not found: ${dbfPath}`);
    return [];
  }
  const buf = fs.readFileSync(dbfPath);
  if (buf.length < 32) return [];

  const headerSize = buf.readUInt16LE(8);
  const fields: Array<{ name: string; type: string; length: number }> = [];

  let offset = 32;
  while (offset + 32 <= buf.length && offset < headerSize) {
    if (buf[offset] === 0x0d) break; // header terminator

    // Field name: bytes 0–10, null-padded
    let name = '';
    for (let j = 0; j < 11; j++) {
      const c = buf[offset + j];
      if (c === 0) break;
      name += String.fromCharCode(c);
    }

    const type = String.fromCharCode(buf[offset + 11]);
    const length = buf[offset + 16];

    if (name.trim()) {
      fields.push({ name: name.trim(), type, length });
    }
    offset += 32;
  }
  return fields;
}

function inspectFile(label: string, dbfPath: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${label}`);
  console.log(`Path: ${dbfPath}`);
  console.log('='.repeat(60));

  const fields = readDbfFields(dbfPath);
  if (fields.length === 0) {
    console.log('  (no fields found or file missing)');
    return;
  }

  console.log(`  ${fields.length} fields:\n`);
  fields.forEach(({ name, type, length }) => {
    console.log(`  ${name.padEnd(30)} type=${type}  length=${length}`);
  });

  // Highlight vote-like fields
  const voteFields = fields.filter(f =>
    /^G\d{2}/.test(f.name) || /vote|dem|rep|total|pres/i.test(f.name)
  );
  if (voteFields.length) {
    console.log('\n  *** Vote/election-related fields:');
    voteFields.forEach(f => console.log(`    ${f.name} (${f.type}, len=${f.length})`));
  }

  // Highlight ID-like fields
  const idFields = fields.filter(f =>
    /id|key|fips|county|precinct|vtd|srprec|unique|geoid/i.test(f.name)
  );
  if (idFields.length) {
    console.log('\n  *** ID/key fields:');
    idFields.forEach(f => console.log(`    ${f.name} (${f.type}, len=${f.length})`));
  }
}

const CA_DIR = path.join(process.cwd(), 'public/data/political/california');

inspectFile(
  '2024 CA Election Precincts',
  path.join(CA_DIR, 'CA Election results and precincts/mprec_state_g24_v01_shp/mprec_state_g24_v01_shp.dbf'),
);

inspectFile(
  '2022 CA Election Precincts',
  path.join(CA_DIR, 'CA Election results and precincts/mprec_state_g22_v01_shp/mprec_state_g22_v01_shp.dbf'),
);

// Also peek at first feature of the 2020 GeoJSON (already converted)
const ca2020Path = path.join(CA_DIR, 'CA_GIS_Data/ca_2020_geojson/ca_2020.geojson');
if (fs.existsSync(ca2020Path)) {
  console.log(`\n${'='.repeat(60)}`);
  console.log('2020 CA GeoJSON (ca_2020.geojson) — first feature properties');
  console.log('='.repeat(60));
  // Read just the first feature efficiently
  const stream = fs.createReadStream(ca2020Path, { start: 0, end: 2000 });
  let chunk = '';
  stream.on('data', d => { chunk += d.toString(); });
  stream.on('end', () => {
    const match = chunk.match(/"properties"\s*:\s*(\{[^}]+\})/);
    if (match) {
      try {
        const props = JSON.parse(match[1]);
        Object.keys(props).forEach(k => console.log(`  ${k.padEnd(30)} = ${JSON.stringify(props[k])}`));
      } catch {
        console.log(chunk.slice(0, 800));
      }
    }
  });
}
