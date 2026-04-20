import { activeState } from '@/lib/config/activeState';

/** Human-readable label for canonical district ids (e.g. ca-congress-07, pa-house-123). */
export function formatPoliticalDistrictLabel(districtId: string): string {
  // Match any state abbreviation prefix: <abbr>-congress-NN
  const congressMatch = districtId.match(/^[a-z]{2}-congress-(\d+)$/i);
  if (congressMatch) {
    const n = parseInt(congressMatch[1], 10);
    return `Congressional District ${Number.isFinite(n) ? n : congressMatch[1]}`;
  }
  // <abbr>-senate-N
  const senateMatch = districtId.match(/^[a-z]{2}-senate-(.+)$/i);
  if (senateMatch) {
    return `State Senate District ${senateMatch[1]}`;
  }
  // <abbr>-house-N
  const houseMatch = districtId.match(/^[a-z]{2}-house-(.+)$/i);
  if (houseMatch) {
    return `State House District ${houseMatch[1]}`;
  }
  // Legacy MI congressional shorthand: mi-07
  if (/^mi-0?\d{1,2}$/i.test(districtId)) {
    const raw = districtId.replace(/^mi-/i, '');
    const n = parseInt(raw, 10);
    return `Congressional District ${Number.isFinite(n) ? n : raw}`;
  }
  // Misc suffixes (county, school district, zip) — strip any known state prefix
  const abbr = activeState.abbreviation.toLowerCase();
  if (districtId.startsWith(`${abbr}-county-`)) {
    return `County FIPS ${districtId.replace(`${abbr}-county-`, '')}`;
  }
  if (districtId.startsWith(`${abbr}-sd-`)) {
    return `School District ${districtId.replace(`${abbr}-sd-`, '')}`;
  }
  if (districtId.startsWith(`${abbr}-zip-`)) {
    return `ZIP ${districtId.replace(`${abbr}-zip-`, '')}`;
  }
  return districtId;
}

/** Numeric / key fragment for enrichment APIs (state house/senate/congress). */
export function stripDistrictIdForEnrichment(
  districtId: string,
  level: 'congressional' | 'state_senate' | 'state_house'
): string {
  if (level === 'congressional') {
    const m = districtId.match(/^[a-z]{2}-congress-(\d+)$/i);
    if (m) return String(parseInt(m[1], 10));
    if (/^mi-0?\d{1,2}$/i.test(districtId)) {
      return String(parseInt(districtId.replace(/^mi-/i, ''), 10));
    }
  }
  if (level === 'state_senate') {
    const m = districtId.match(/^[a-z]{2}-senate-(.+)$/i);
    if (m) return m[1];
  }
  if (level === 'state_house') {
    const m = districtId.match(/^[a-z]{2}-house-(.+)$/i);
    if (m) return m[1];
  }
  return districtId.replace(/^[a-z]{2}-(congress|house|senate)-/i, '');
}

/** Returns true for all non-Michigan state deployments (PA-style district key format). */
export function isPAPoliticalRegion(): boolean {
  return activeState.fips !== '26';
}
