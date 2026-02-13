# Quick Start Guide - Ingham County Election Data

## TL;DR - What You Have

✅ **Complete precinct-level election results** for Ingham County, Michigan
✅ **Three elections**: November 2020, 2022, 2024
✅ **All major races**: President, Governor, U.S. Senate, Congress, State Legislature
✅ **Machine-readable CSV files** ready for immediate analysis
✅ **~82 MB total data** across 10 files

---

## Quick Analysis - Command Line

### Extract Ingham County 2024 Presidential Results
```bash
cd /path/to/project/data/raw/elections/ingham-county
grep "^Ingham," 20241105__mi__general__precinct.csv | grep "President" > ingham_2024_president.csv
```

### Count 2024 Presidential Votes by Candidate
```bash
grep "^Ingham," 20241105__mi__general__precinct.csv | \
  grep "President" | \
  awk -F',' '{votes[$5]+=$7} END {for(c in votes) print c ": " votes[c]}'
```

### List All Races in 2022
```bash
grep "^Ingham," 20221108__mi__general__precinct.csv | \
  cut -d',' -f3 | sort -u
```

### Extract State House District 73 Results (2024)
```bash
grep "^Ingham," 20241105__mi__general__precinct.csv | \
  grep "State House" | grep "73"
```

---

## Quick Analysis - Python

### Load 2024 Data
```python
import pandas as pd

# Load full Michigan data
df = pd.read_csv('20241105__mi__general__precinct.csv')

# Filter for Ingham County
ingham = df[df['county'] == 'Ingham']

# Filter for Presidential race
pres = ingham[ingham['office'] == 'President']

# Total votes by candidate
pres.groupby('candidate')['votes'].sum()
```

### Analyze Vote Methods (2024)
```python
# Load data
df = pd.read_csv('20241105__mi__general__precinct.csv')
ingham = df[df['county'] == 'Ingham']
pres = ingham[ingham['office'] == 'President']

# Vote method breakdown
vote_methods = ['election_day', 'early_voting', 'mail', 'absentee']
for method in vote_methods:
    total = pres[method].astype(float).sum()
    print(f"{method}: {total:,.0f}")
```

### Compare Presidential Results 2020 vs 2024
```python
import pandas as pd

# 2024
df_2024 = pd.read_csv('20241105__mi__general__precinct.csv')
pres_2024 = df_2024[(df_2024['county'] == 'Ingham') & (df_2024['office'] == 'President')]
results_2024 = pres_2024.groupby('candidate')['votes'].sum()

# 2020
df_2020 = pd.read_csv('20201103__mi__general__precinct.csv')
pres_2020 = df_2020[(df_2020['county'] == 'Ingham') & (df_2020['office'] == 'President')]
results_2020 = pres_2020.groupby('candidate')['votes'].sum()

# Compare
print("2024:", results_2024)
print("2020:", results_2020)
```

---

## File Descriptions

### Primary Data Files (Use These)
| File | Use For |
|------|---------|
| `20241105__mi__general__precinct.csv` | 2024 all races, precinct-level |
| `20221108__mi__general__precinct.csv` | 2022 all races, precinct-level |
| `20201103__mi__general__precinct.csv` | 2020 all races, precinct-level |

### Supplementary Files
| File | Use For |
|------|---------|
| `november_2020_audit_precincts.xlsx` | 2020 audit verification |
| `november_202*_precinct_results.pdf` | Official source documents |
| `november_202*_summary.pdf` | County-level summaries |

### Documentation Files
| File | Description |
|------|-------------|
| `COLLECTION_REPORT.md` | Full collection report |
| `DATA_INVENTORY.md` | Detailed file inventory |
| `RACES_AVAILABLE.md` | List of races by election |
| `QUICK_START.md` | This file |
| `extract_races.py` | Python utility script |

---

## Data Structure

### CSV Columns
```
county          - "Ingham"
precinct        - Full precinct name
office          - Race name (e.g., "President")
district        - District number (if applicable)
candidate       - Candidate name
party           - Party code (DEM, REP, LIB, GRN, etc.)
votes           - Total vote count
election_day    - Votes on Election Day
absentee        - Absentee ballot votes
early_voting    - Early voting (2024 only)
mail            - Mail-in votes
provisional     - Provisional votes
av_counting_boards      - AV counting board votes
pre_process_absentee    - Pre-processed absentee
```

### Example Row (CSV)
```
Ingham,"Delhi Charter Township, Precinct 1",President,,Kamala D. Harris,DEM,1232,320,,171,741,,,
```

---

## Common Queries

### Presidential Results
```bash
# 2024 Presidential by precinct
grep "^Ingham," 20241105__mi__general__precinct.csv | grep "President"

# 2020 Presidential by precinct
grep "^Ingham," 20201103__mi__general__precinct.csv | grep "President"
```

### Congressional Results
```bash
# 2024 U.S. House District 7
grep "^Ingham," 20241105__mi__general__precinct.csv | grep "U.S. House"

# 2020 U.S. House District 8
grep "^Ingham," 20201103__mi__general__precinct.csv | grep "U.S. House"
```

### State House Results
```bash
# 2024 State House all districts
grep "^Ingham," 20241105__mi__general__precinct.csv | grep "State House"

# 2024 State House District 73 only
grep "^Ingham," 20241105__mi__general__precinct.csv | grep "State House" | grep "73"
```

### Governor (2022 only)
```bash
grep "^Ingham," 20221108__mi__general__precinct.csv | grep "Governor"
```

---

## Data Summary

### Precinct Counts
- **2024**: 103 unique precincts
- **2022**: 112 unique precincts
- **2020**: 115 unique precincts

### Record Counts (Ingham County)
- **2024**: 3,302 records
- **2022**: 4,295 records
- **2020**: 3,086 records

### Races Available
- **2024**: 6 competitive races (President, Senate, House, State House x4)
- **2022**: 11 competitive races (Governor, AG, SOS, Senate races x3, House races x5)
- **2020**: 6 competitive races (President, Senate, House, State House x3)

---

## Need More Info?

- **Full Details**: See `COLLECTION_REPORT.md`
- **Race Lists**: See `RACES_AVAILABLE.md`
- **File Inventory**: See `DATA_INVENTORY.md`
- **Extract Races**: Run `python3 extract_races.py`

---

## Contact for Original Data

**Ingham County Clerk**
- Website: https://clerk.ingham.org/election_results
- Phone: (517) 676-7255
- Email: Contact via website

**OpenElections Project**
- GitHub: https://github.com/openelections/openelections-data-mi
- Issues: https://github.com/openelections/openelections-data-mi/issues
