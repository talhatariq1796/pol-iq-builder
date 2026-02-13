# Census Block Group Boundaries - Ingham County, Michigan

## Data Acquisition Summary

**Date Downloaded:** November 30, 2025
**Data Source:** US Census Bureau TIGER/Line 2024
**Geographic Area:** Ingham County, Michigan (FIPS: 26065)

## Data Source Details

- **Primary URL:** https://www2.census.gov/geo/tiger/TIGER2024/BG/
- **Downloaded File:** tl_2024_26_bg.zip (9.8 MB)
- **Census Product:** TIGER/Line Shapefiles - 2024 Block Groups
- **State:** Michigan (FIPS: 26)
- **County:** Ingham (FIPS: 065)

## Files in This Directory

1. **tl_2024_26_bg.zip** - Original downloaded shapefile (Michigan statewide)
2. **tl_2024_26_bg.*** - Extracted shapefile components (statewide)
3. **ingham_county_block_groups_2024.geojson** - Ingham County only (NAD83/EPSG:4269)
4. **ingham_county_block_groups_2024_wgs84.geojson** - Ingham County only (WGS84/EPSG:4326) **[RECOMMENDED]**

## Dataset Statistics

- **Total Block Groups in Ingham County:** 238
- **File Format:** GeoJSON
- **Coordinate Reference System:** WGS84 (EPSG:4326)
- **Original CRS:** NAD83 (EPSG:4269)
- **Geometry Type:** Polygon
- **Extent:**
  - Longitude: -84.603132 to -84.140595
  - Latitude: 42.421937 to 42.776639

## Attribute Schema

| Field Name | Type | Description |
|------------|------|-------------|
| STATEFP | String | State FIPS code (26 = Michigan) |
| COUNTYFP | String | County FIPS code (065 = Ingham) |
| TRACTCE | String | Census tract code (6 digits) |
| BLKGRPCE | String | Block group number (1 digit) |
| GEOID | String | Full Census block group identifier (12 digits) |
| GEOIDFQ | String | Fully qualified GEOID with prefix |
| NAMELSAD | String | Block group name (e.g., "Block Group 1") |
| MTFCC | String | MAF/TIGER Feature Class Code |
| FUNCSTAT | String | Functional status |
| ALAND | Integer | Land area (square meters) |
| AWATER | Integer | Water area (square meters) |
| INTPTLAT | String | Internal point latitude |
| INTPTLON | String | Internal point longitude |

## GEOID Format

The 12-digit GEOID uniquely identifies each block group:
- **Positions 1-2:** State FIPS (26 = Michigan)
- **Positions 3-5:** County FIPS (065 = Ingham)
- **Positions 6-11:** Census tract code
- **Position 12:** Block group number

**Examples:**
- `260650055011` = Michigan, Ingham County, Tract 005501, Block Group 1
- `260650028001` = Michigan, Ingham County, Tract 002800, Block Group 1
- `260650017032` = Michigan, Ingham County, Tract 001703, Block Group 2

## Usage Notes

1. **Recommended File:** Use `ingham_county_block_groups_2024_wgs84.geojson` for compatibility with most GIS tools and web mapping applications.

2. **Coordinate System:** The WGS84 version uses EPSG:4326, which is the standard for GPS and web mapping (Google Maps, Leaflet, Mapbox, etc.).

3. **Crosswalk Development:** This data will be used to build a precinct-to-block-group crosswalk for Ingham County election analysis.

4. **Census Vintage:** This is 2024 TIGER/Line data with block groups delineated for the 2020 Census.

## Command Used to Download and Process

```bash
# Download Michigan block groups
curl -o tl_2024_26_bg.zip https://www2.census.gov/geo/tiger/TIGER2024/BG/tl_2024_26_bg.zip

# Extract shapefile
unzip -o tl_2024_26_bg.zip

# Filter to Ingham County and convert to WGS84 GeoJSON
ogr2ogr -f GeoJSON -t_srs EPSG:4326 -where "COUNTYFP='065'" \
  ingham_county_block_groups_2024_wgs84.geojson tl_2024_26_bg.shp
```

## Data Quality

- All 238 block groups have complete geometry and attributes
- No null or missing GEOID values
- Geometries are topologically valid polygons
- Coverage is complete for Ingham County

## References

- [US Census TIGER/Line Shapefiles](https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html)
- [TIGER/Line 2024 Technical Documentation](https://www.census.gov/programs-surveys/geography/technical-documentation/complete-technical-documentation/tiger-geo-line.html)
- [Census Block Group Overview](https://www.census.gov/programs-surveys/geography/about/glossary.html#par_textimage_4)
