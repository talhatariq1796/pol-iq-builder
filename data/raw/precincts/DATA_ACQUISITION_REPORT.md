# Ingham County, Michigan - Precinct Boundary Data Acquisition Report

## Executive Summary

Successfully downloaded voting precinct boundary data for Ingham County, Michigan from the Michigan GIS Open Data Portal.

**Status:** ✅ Complete  
**Date:** November 30, 2025  
**Total Precincts:** 103  
**File Format:** GeoJSON  
**File Size:** 795 KB

---

## Data Source

**Primary Source:** Michigan GIS Open Data Portal  
**Portal URL:** https://gis-michigan.opendata.arcgis.com/datasets/Michigan::2024-voting-precincts  
**ArcGIS REST Service:** https://gisagocss.state.mi.us/arcgis/rest/services/OpenData/boundaries/MapServer/9  
**Dataset Name:** 2024 Voting Precincts  
**Provider:** Center for Shared Solutions, Department of Technology, Management, and Budget, State of Michigan

---

## County Information

- **County:** Ingham County
- **State FIPS Code:** 26 (Michigan)
- **County FIPS Code:** 065
- **Full FIPS Code:** 26065
- **County Seat:** Lansing

---

## Dataset Characteristics

### File Details
- **Format:** GeoJSON (RFC 7946 compliant)
- **Geometry Type:** Polygon and MultiPolygon
- **Coordinate System:** WGS 84 (EPSG:4326) - implied by GeoJSON standard
- **Total Features:** 103 voting precincts
- **File Size:** 795 KB

### Available Fields
The dataset includes rich attribute data for each precinct:

- `NAME` - Unique precinct identifier (14-digit code)
- `COUNTYFIPS` - County FIPS code (065)
- `MCDFIPS` - Minor Civil Division FIPS code
- `Precinct_Long_Name` - Full precinct name (e.g., "Alaiedon Township, Precinct 1")
- `Precinct_Short_Name` - Abbreviated name (e.g., "Alaiedon Twp 1")
- `Jurisdiction_Name` - Municipality name
- `Registered_Voters` - Total registered voters
- `Active_Voters` - Active registered voters
- `WARD` - Ward designation (where applicable)
- `VTDST` - Voting Tabulation District code
- `ELECTIONYE` - Election year (2024)
- `PRECINCT` - Precinct number
- `PRECINCTID` - Precinct identifier
- `Tabulator_Voter_Assist` - Tabulator voter assistance flag
- `Shape.STArea()` - Polygon area
- `Shape.STLength()` - Polygon perimeter

---

## Geographic Coverage

### Jurisdictions (19 Total)

The dataset covers all 19 municipalities in Ingham County:

| Jurisdiction | Type | Precincts | Registered Voters | Active Voters |
|-------------|------|-----------|-------------------|---------------|
| Lansing | City | 36 | 94,498 | 76,268 |
| Meridian | Township | 22 | 33,759 | 29,311 |
| Delhi | Township | 9 | 23,169 | 20,637 |
| East Lansing | City | 16 | 20,936 | 15,338 |
| Mason | City | 2 | 6,366 | 5,724 |
| Williamstown | Township | 2 | 4,598 | 4,144 |
| Aurelius | Township | 2 | 3,541 | 3,218 |
| Leslie | City | 2 | 3,442 | 2,997 |
| Stockbridge | Township | 1 | 3,209 | 2,845 |
| Williamston | City | 1 | 3,156 | 2,879 |
| Vevay | Township | 1 | 3,119 | 2,796 |
| Leroy | Township | 1 | 2,984 | 2,766 |
| Alaiedon | Township | 2 | 2,512 | 2,288 |
| Onondaga | Township | 1 | 2,480 | 2,198 |
| Ingham | Township | 1 | 2,093 | 1,882 |
| Bunker Hill | Township | 1 | 1,648 | 1,453 |
| Locke | Township | 1 | 1,567 | 1,424 |
| Wheatfield | Township | 1 | 1,381 | 1,275 |
| White Oak | Township | 1 | 1,025 | 924 |

**Total:** 103 precincts | 215,483 registered voters | 180,367 active voters

---

## Voter Statistics

- **Total Registered Voters:** 215,483
- **Total Active Voters:** 180,367
- **Active Voter Rate:** 83.7%
- **Average Voters per Precinct:** 2,091 registered / 1,751 active
- **Largest Jurisdiction:** Lansing (36 precincts, 94,498 registered)
- **Smallest Jurisdiction:** White Oak Township (1 precinct, 1,025 registered)

---

## Data Quality

### Validation Notes
The 2024 Precinct data set represents the geography used for the 2024 election cycle. Information was collected from local election officials along with county/local GIS authorities as well as a validation done by most, but not all jurisdictions.

### Geometry Validation
- ✅ All 103 features contain valid geometries
- ✅ Mix of Polygon and MultiPolygon types (appropriate for complex precinct boundaries)
- ✅ Coordinates in WGS 84 decimal degrees
- ✅ Sample coordinate range: -84.36° to -84.37° longitude, 42.68° latitude

### Completeness
- ✅ All precincts have geometry
- ✅ All precincts have voter registration data
- ✅ All precincts have jurisdiction assignments
- ✅ Full attribute data populated

---

## File Locations

All files saved to: `/path/to/project/data/raw/precincts/`

### Downloaded Files
1. **ingham_county_precincts_2024.geojson** (795 KB)
   - Primary precinct boundary file with full attributes
   
2. **INGHAM_COUNTY_PRECINCTS_METADATA.txt** (2.3 KB)
   - Detailed metadata documentation
   
3. **precinct_statistics.json** (2.5 KB)
   - Voter registration statistics by jurisdiction
   
4. **DATA_ACQUISITION_REPORT.md** (this file)
   - Complete data acquisition report

---

## Download Method

### API Query Parameters
```
Service: https://gisagocss.state.mi.us/arcgis/rest/services/OpenData/boundaries/MapServer/9/query
Method: GET
Parameters:
  - where: COUNTYFIPS='065'
  - outFields: *
  - f: geojson
  - returnGeometry: true
```

### Command Used
```bash
curl -s "https://gisagocss.state.mi.us/arcgis/rest/services/OpenData/boundaries/MapServer/9/query?where=COUNTYFIPS%3D%27065%27&outFields=*&f=geojson&returnGeometry=true" \
  -o ingham_county_precincts_2024.geojson
```

---

## Usage Restrictions

**Public Domain Data**  
This dataset is a public record and there are no restrictions on the use, reproduction, or distribution of this dataset.

**Credit/Attribution:**  
Center for Shared Solutions, Department of Technology, Management, and Budget, State of Michigan

---

## Issues Encountered

### Resolution Required
Initially attempted to query with FIPS code "26065" (state+county), but the service stores county codes as 3-digit values without state prefix. Query was corrected to use "065".

### No Other Issues
- ✅ API accessible without authentication
- ✅ GeoJSON format available directly
- ✅ Complete dataset downloaded successfully
- ✅ All geometries valid
- ✅ All attributes populated

---

## Next Steps / Recommendations

1. **Validate Geometries:** Run topology checks to ensure no gaps or overlaps
2. **Verify Coverage:** Compare against county boundary to ensure complete coverage
3. **Election Data Integration:** Join with election results using precinct identifiers
4. **Historical Comparison:** Download previous years (2020, 2022) to track boundary changes
5. **Demographic Analysis:** Consider joining with Census data using VTDST codes

---

## Related Datasets Available

The Michigan GIS Open Data Portal also provides:
- 2022 Voting Precincts
- 2020 Voting Precincts  
- 2018 Voting Precincts
- 2016 Voting Precincts

Consider downloading if historical analysis is needed.

---

## Contact Information

**Data Provider:**  
Center for Shared Solutions  
Department of Technology, Management, and Budget  
State of Michigan  
Portal: https://gis-michigan.opendata.arcgis.com

**Data Acquisition Agent:** Research and Analysis Agent  
**Acquisition Date:** November 30, 2025

---

*End of Report*
