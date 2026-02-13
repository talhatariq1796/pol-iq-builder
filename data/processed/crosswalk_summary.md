# Precinct-Block Group Crosswalk Summary

**Generated:** 2025-11-30
**Script:** `/scripts/political/build-crosswalk.js`

## Overview

Successfully built spatial crosswalk between Ingham County precincts and Census block groups using area-weighted overlap ratios.

## Statistics

- **Total Crosswalk Entries:** 449
- **Precincts Covered:** 103/103 (100%)
- **Block Groups Involved:** 238/238 (100%)
- **Average Block Groups per Precinct:** 4.36

## Coverage Quality

- **Perfect Coverage (≥99.9%):** 82 precincts (79.6%)
- **Good Coverage (95-99.9%):** 20 precincts (19.4%)
- **Coverage Gaps (<95%):** 1 precinct (1.0%)

### Precinct with Coverage Gap

**WP-065-46000-04040** (City of Lansing, Ward 4, Precinct 40)
- Coverage: 24.73%
- Block Groups: 4
- Likely Reason: Contains water bodies (northern Lansing near Grand River) or areas outside Census block group boundaries

This is expected and normal for spatial crosswalks in areas with water bodies or uninhabited regions.

## Overlap Distribution

- **Minimum Overlap Ratio:** 0.0011 (0.11%)
- **Maximum Overlap Ratio:** 0.9997 (99.97%)
- **Overlap Threshold:** 0.001 (0.1%) - entries below this were excluded

## Sample Crosswalk Entries

```json
{
  "precinct_id": "WP-065-00800-00001",
  "precinct_name": "0650080000001",
  "block_group_geoid": "260650056001",
  "overlap_ratio": 0.4756
}
```

## Validation

✅ **All precincts have at least one block group**
✅ **102 out of 103 precincts have coverage ≥95%**
✅ **Overlap ratios sum to ~1.0 for 99% of precincts**

## Usage

This crosswalk enables aggregation of Census demographic data (attached to block groups) to precinct level using area-weighted calculations:

```
Precinct_Value = Σ (BlockGroup_Value × overlap_ratio)
```

For example, to estimate precinct population:
```
Precinct_Population = (BG1_Pop × 0.45) + (BG2_Pop × 0.35) + (BG3_Pop × 0.20)
```

## Files

- **Input:** 
  - `data/raw/precincts/ingham_county_precincts_2024.geojson` (103 precincts)
  - `data/raw/block-groups/ingham_county_block_groups_2024_wgs84.geojson` (238 block groups)
- **Output:** 
  - `data/processed/precinct_blockgroup_crosswalk.json` (449 entries)
- **Script:** 
  - `scripts/political/build-crosswalk.js`

## Methodology

1. For each precinct, tested intersection with all 238 block groups
2. Calculated overlap as: `intersection_area / precinct_area`
3. Filtered out overlaps <0.1% to reduce noise
4. Validated that overlap ratios sum to ~1.0 for each precinct

## Technical Details

- **CRS:** WGS84 (EPSG:4326) for both inputs
- **Spatial Library:** Turf.js v7.3.1
- **Area Calculation:** Geodesic (accounts for Earth curvature)
- **Performance:** ~5 seconds for 103 × 238 = 24,514 intersection tests
