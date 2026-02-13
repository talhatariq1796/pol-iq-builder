# Ingham County Election Data Inventory

## Data Collection Summary
**Collection Date**: 2025-11-30
**Target County**: Ingham County, Michigan
**Elections Covered**: November 2020, November 2022, November 2024 General Elections

---

## Data Sources

### 1. Ingham County Clerk (Primary Source)
**Website**: [clerk.ingham.org/election_results](https://clerk.ingham.org/departments_and_officials/county_clerk/election_results.php)
**Contact**: Elections Director at (517) 676-7255

#### Files Downloaded:

**November 2024 General Election (OFFICIAL)**
- `november_2024_precinct_results.pdf` (19 MB)
  - Official Statement of Votes Cast - Precinct-level results
  - Source: https://docs.ingham.org/Department/County%20Clerk/Elections/Election%20Results/OFFICIALInghamNovember2024StatementofVotesCastRPT.pdf

- `november_2024_summary.pdf` (2.6 MB)
  - Election Summary Report
  - Source: https://docs.ingham.org/Department/County%20Clerk/Elections/Election%20Results/OFFICIALInghamNovember2024ElectionSummaryReportRPT.pdf

**November 2022 General Election (OFFICIAL)**
- `november_2022_precinct_results.pdf` (9.5 MB)
  - Official Statement of Votes Cast - Precinct-level results
  - Source: https://www.dropbox.com/s/pcvahmm4spt0ote/OFFICIALStatementOfVotesCastRPT.pdf

- `november_2022_summary.pdf` (303 KB)
  - Election Summary Report
  - Source: https://www.dropbox.com/s/kkk111zxhjcklco/OFFICIALElectionSummaryReportRPT.pdf

**November 2020 General Election (OFFICIAL)**
- `november_2020_precinct_results.pdf` (10 MB)
  - Official Statement of Votes Cast - Precinct-level results
  - Source: https://docs.ingham.org/Department/County%20Clerk/Elections/Election%20Results/OFFICIALNovember2020StatementOfVotesCastRPT.pdf

- `november_2020_summary.pdf` (782 KB)
  - Election Summary Report
  - Source: https://docs.ingham.org/Department/County%20Clerk/Elections/Election%20Results/OFFICIALNovember2020ElectionSummaryReportRPT.pdf

- `november_2020_audit_precincts.xlsx` (4.0 MB)
  - Post-election audit results (precinct-level)
  - Source: https://docs.ingham.org/Department/County%20Clerk/Elections/Election%20Results/November%202020%20Election%20Audit%20Results.web.xlsx

---

### 2. OpenElections Project (Secondary Source)
**Repository**: [github.com/openelections/openelections-data-mi](https://github.com/openelections/openelections-data-mi)
**Description**: Volunteer-maintained repository of converted official precinct results

#### Files Downloaded:

- `20241105__mi__general__precinct.csv` (14 MB)
  - Statewide precinct-level results for November 5, 2024 General Election
  - Includes 3,302 records for Ingham County
  - Source: https://raw.githubusercontent.com/openelections/openelections-data-mi/master/2024/20241105__mi__general__precinct.csv

- `20221108__mi__general__precinct.csv` (15 MB)
  - Statewide precinct-level results for November 8, 2022 General Election
  - Includes 4,295 records for Ingham County
  - Source: https://raw.githubusercontent.com/openelections/openelections-data-mi/master/2022/20221108__mi__general__precinct.csv

- `20201103__mi__general__precinct.csv` (6.7 MB)
  - Statewide precinct-level results for November 3, 2020 General Election
  - Includes 3,086 records for Ingham County
  - Source: https://raw.githubusercontent.com/openelections/openelections-data-mi/master/2020/20201103__mi__general__precinct.csv

---

## CSV Data Format (OpenElections)

### Column Headers:
```
county,precinct,office,district,candidate,party,votes,election_day,absentee,av_counting_boards,early_voting,mail,provisional,pre_process_absentee
```

### Fields Description:
- **county**: County name (e.g., "Ingham")
- **precinct**: Full precinct name (e.g., "Alaiedon Township, Precinct 1")
- **office**: Race/office name
- **district**: District number (if applicable)
- **candidate**: Candidate name
- **party**: Party abbreviation (DEM, REP, LIB, GRN, UST, etc.)
- **votes**: Total vote count
- **election_day**: Votes cast on Election Day
- **absentee**: Absentee ballot votes
- **av_counting_boards**: Absentee voter counting board votes
- **early_voting**: Early voting votes
- **mail**: Mail-in ballot votes
- **provisional**: Provisional ballot votes
- **pre_process_absentee**: Pre-processed absentee votes

### Record Counts:
- **2024**: 3,302 Ingham County records
- **2022**: 4,295 Ingham County records
- **2020**: 3,086 Ingham County records

---

## Races Available

### November 2024 General Election
**Precinct-level data for 103 unique precincts**

Competitive Races:
- President (Presidential race)
- U.S. Senate (Statewide)
- U.S. House - District 7
- State House - District 73
- State House - District 74
- State House - District 75
- State House - District 77

Additional Data:
- Ballots Cast
- Registered Voters
- Straight Party

**Total**: 10 data types (6 competitive races)

### November 2022 General Election
**Precinct-level data for 112 unique precincts**

Competitive Races:
- Governor (Statewide)
- Attorney General (Statewide)
- Secretary of State (Statewide)
- U.S. House - District 7
- State Senate - District 21
- State Senate - District 22
- State Senate - District 28
- State House - District 73
- State House - District 74
- State House - District 75
- State House - District 77
- Proposal 22-3 (Ballot measure)

Additional Data:
- Ballots Cast
- Registered Voters
- Straight Party

**Total**: 15 data types (11 competitive races)

### November 2020 General Election
**Precinct-level data for 115 unique precincts**

Competitive Races:
- President (Presidential race)
- U.S. Senate (Statewide)
- U.S. House - District 8
- State House - District 67
- State House - District 68
- State House - District 69

Additional Data:
- Ballots Cast
- Registered Voters
- Straight Party

**Total**: 9 data types (6 competitive races)

### Sample Data (2024 Presidential)
```
Precinct: Alaiedon Township, Precinct 1
  Candidate: Kamala D. Harris (DEM)
  Total Votes: 475
  Election Day: 147, Early: 62, Mail: 266

Precinct: Delhi Charter Township, Precinct 1
  Candidate: Kamala D. Harris (DEM)
  Total Votes: 1232
  Election Day: 320, Early: 171, Mail: 741
```

---

## Data Processing Needs

### PDF Files (Manual Extraction Required)
All PDF files from Ingham County Clerk contain precinct-level results but require:
- PDF text extraction (OCR may be needed if scanned)
- Table parsing and data structuring
- Verification against OpenElections CSV data

**Tools Suggested**:
- Tabula (for table extraction from PDFs)
- pdfplumber (Python library)
- Manual verification for accuracy

### Excel File (Ready to Use)
- `november_2020_audit_precincts.xlsx` - Already in structured format, can be imported directly

### CSV Files (Ready to Use)
All OpenElections CSV files are:
- ✅ Machine-readable
- ✅ Standardized format across years
- ✅ Pre-validated by OpenElections community
- ✅ Can be filtered for Ingham County using: `grep "^Ingham," filename.csv`

---

## Next Steps

1. **Extract race lists** from CSV files (in progress)
2. **Parse PDF files** to verify against CSV data
3. **Create race-specific datasets** for each election
4. **Validate data completeness** across all sources
5. **Document any discrepancies** between sources

---

## File Locations
All files saved to: `/path/to/project/data/raw/elections/ingham-county/`

```
/path/to/project/data/raw/elections/ingham-county/
├── 20201103__mi__general__precinct.csv          (6.7 MB)
├── 20221108__mi__general__precinct.csv          (15 MB)
├── 20241105__mi__general__precinct.csv          (14 MB)
├── november_2020_audit_precincts.xlsx           (4.0 MB)
├── november_2020_precinct_results.pdf           (10 MB)
├── november_2020_summary.pdf                    (782 KB)
├── november_2022_precinct_results.pdf           (9.5 MB)
├── november_2022_summary.pdf                    (303 KB)
├── november_2024_precinct_results.pdf           (19 MB)
├── november_2024_summary.pdf                    (2.6 MB)
└── DATA_INVENTORY.md                            (this file)
```

**Total Size**: ~82 MB
