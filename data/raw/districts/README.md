# Michigan Legislative District Boundaries

Downloaded: 2025-11-30

## Files Downloaded

### GeoJSON Files (Ready to Use)
- `mi_house_districts.geojson` - Michigan State House Districts (110 districts) - 2.8 MB
- `mi_senate_districts.geojson` - Michigan State Senate Districts (38 districts) - 1.6 MB
- `us_congressional_districts.geojson` - US Congressional Districts for Michigan (13 districts) - 1.0 MB

### Source Shapefiles (TIGER/Line 2024)
- `mi_house/` - Michigan State House shapefile components
- `mi_senate/` - Michigan State Senate shapefile components
- `us_congressional/` - US Congressional Districts shapefile components

## Data Sources

### Primary Source: US Census Bureau TIGER/Line Shapefiles 2024
All data downloaded from the US Census Bureau TIGER/Line database:

1. **State House Districts (Lower Chamber - SLDL)**
   - URL: https://www2.census.gov/geo/tiger/TIGER2024/SLDL/tl_2024_26_sldl.zip
   - File: `tl_2024_26_sldl.zip` (956 KB)
   - Contains: 110 Michigan State House Districts

2. **State Senate Districts (Upper Chamber - SLDU)**
   - URL: https://www2.census.gov/geo/tiger/TIGER2024/SLDU/tl_2024_26_sldu.zip
   - File: `tl_2024_26_sldu.zip` (641 KB)
   - Contains: 38 Michigan State Senate Districts

3. **US Congressional Districts (119th Congress)**
   - URL: https://www2.census.gov/geo/tiger/TIGER2024/CD/tl_2024_26_cd119.zip
   - File: `tl_2024_26_cd119.zip` (404 KB)
   - Contains: 13 Michigan Congressional Districts
   - Note: These are for the 119th Congress (January 2025-2027)

### Alternate Sources Identified (Not Used)

- **Michigan GIS Open Data Portal**: https://gis-michigan.opendata.arcgis.com/
  - Michigan State House Districts (v17a): https://gis-michigan.opendata.arcgis.com/datasets/michigan-state-house-districts-v17a
  - Michigan State Senate Districts (v17a): https://gis-michigan.opendata.arcgis.com/datasets/michigan-state-senate-districts-v17a
  - Note: These appear to be older 2011 apportionment districts

- **All About Redistricting (Loyola Law School)**: https://redistricting.lls.edu/state/michigan/
  - Offers 2024 remedial maps (court-approved after VRA challenges)
  - Available formats: Shapefile, GeoJSON, PDF

- **Redistricting Data Hub**: https://redistrictingdatahub.org/state/michigan/
  - Requires account registration
  - Offers multiple redistricting data formats

## Districts Covering Ingham County

Based on spatial analysis using the center of Lansing (42.7325, -84.5555):

### State House Districts in Ingham County Area
- District 73
- District 74
- District 76
- District 77

**Primary district** (Lansing center): District 77

### State Senate Districts in Ingham County Area
- District 21
- District 28

**Primary district** (Lansing center): District 21

### US Congressional District
- District 7 (MI-7)

## Coordinate Reference System

All files use NAD83 geographic coordinate system:
- EPSG: 4269
- Datum: North American Datum 1983
- Coordinates: Latitude/Longitude in decimal degrees

## File Format Details

### Shapefile Components
Each shapefile directory contains:
- `.shp` - Main geometry file
- `.shx` - Shape index file
- `.dbf` - Attribute database (dBase format)
- `.prj` - Projection/coordinate system definition
- `.cpg` - Character encoding (UTF-8)
- `.shp.ea.iso.xml` - FGDC metadata (extended)
- `.shp.iso.xml` - ISO 19139 metadata

### GeoJSON Properties

**State House Districts** (`mi_house_districts.geojson`):
- `STATEFP`: State FIPS code (26 = Michigan)
- `SLDLST`: State Legislative District Lower chamber code
- `NAMELSAD`: Full district name (e.g., "State House District 77")
- `GEOID`: Geographic identifier
- `MTFCC`: MAF/TIGER Feature Class Code

**State Senate Districts** (`mi_senate_districts.geojson`):
- `STATEFP`: State FIPS code (26 = Michigan)
- `SLDUST`: State Legislative District Upper chamber code
- `NAMELSAD`: Full district name (e.g., "State Senate District 21")
- `GEOID`: Geographic identifier
- `MTFCC`: MAF/TIGER Feature Class Code

**US Congressional Districts** (`us_congressional_districts.geojson`):
- `STATEFP`: State FIPS code (26 = Michigan)
- `CD119FP`: Congressional District code (119th Congress)
- `NAMELSAD`: Full district name (e.g., "Congressional District 7")
- `GEOID`: Geographic identifier
- `MTFCC`: MAF/TIGER Feature Class Code

## Important Notes

1. **Michigan Redistricting History**: Michigan's legislative districts have undergone multiple revisions:
   - December 2021: Original commission maps approved
   - December 2023: Federal court struck down state legislative maps for VRA violations
   - March 2024: Remedial State House maps approved by court
   - July 2024: Remedial State Senate maps approved by court

2. **TIGER/Line 2024 Status**:
   - The TIGER/Line 2024 files may reflect the 2021 commission maps, not the 2024 remedial maps
   - For the most current court-approved boundaries, check the Loyola Law School redistricting site

3. **Congressional Districts**:
   - Downloaded files are for the 119th Congress (2025-2027)
   - Michigan has 13 congressional districts

4. **Data Updates**:
   - TIGER/Line files are updated annually by the US Census Bureau
   - Check https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html for latest versions

## Usage Examples

### Load with Python (GeoPandas)
```python
import geopandas as gpd

house = gpd.read_file('mi_house_districts.geojson')
senate = gpd.read_file('mi_senate_districts.geojson')
congress = gpd.read_file('us_congressional_districts.geojson')

# Filter for Ingham County districts
ingham_house = house[house['SLDLST'].isin(['073', '074', '076', '077'])]
ingham_senate = senate[senate['SLDUST'].isin(['021', '028'])]
```

### Load with JavaScript (Leaflet)
```javascript
fetch('mi_house_districts.geojson')
  .then(response => response.json())
  .then(data => {
    L.geoJSON(data, {
      style: { color: '#3388ff', weight: 2 },
      onEachFeature: (feature, layer) => {
        layer.bindPopup(feature.properties.NAMELSAD);
      }
    }).addTo(map);
  });
```

### Query with ogr2ogr
```bash
# Extract only Ingham County districts
ogr2ogr -f GeoJSON ingham_house.geojson mi_house_districts.geojson \
  -where "SLDLST IN ('073', '074', '076', '077')"
```

## Data Verification

Total district counts verified:
- State House: 110 districts (matches Michigan's 110-member House)
- State Senate: 38 districts (matches Michigan's 38-member Senate)
- Congressional: 13 districts (matches Michigan's 13 US House seats)

Bounding box for all files:
- Longitude: -90.418392 to -82.122971
- Latitude: 41.696118 to 48.306063
- Coverage: Entire state of Michigan including Upper Peninsula

## License & Attribution

Data source: US Census Bureau TIGER/Line Shapefiles
- Public domain, no copyright restrictions
- Attribution: US Census Bureau TIGER/Line Shapefiles (2024)

For citation:
```
U.S. Census Bureau. (2024). TIGER/Line Shapefiles: Michigan State Legislative Districts.
Retrieved from https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html
```
