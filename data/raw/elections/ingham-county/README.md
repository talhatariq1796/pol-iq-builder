# Ingham County, Michigan - Precinct-Level Election Data

**Status**: ✅ **COMPLETE**
**Collection Date**: 2025-11-30
**Elections**: November 2020, 2022, 2024 General Elections
**Format**: Machine-readable CSV + Official PDF documents
**Total Size**: 82 MB

---

## 🚀 Quick Start

**Want to start analyzing right away?** See [QUICK_START.md](QUICK_START.md)

**Need the full collection report?** See [COLLECTION_REPORT.md](COLLECTION_REPORT.md)

---

## 📊 What's Included

### Elections Covered
- ✅ November 3, 2020 General Election
- ✅ November 8, 2022 General Election
- ✅ November 5, 2024 General Election

### Races Available
| Race Type | 2020 | 2022 | 2024 |
|-----------|:----:|:----:|:----:|
| Presidential | ✅ | - | ✅ |
| Governor | - | ✅ | - |
| U.S. Senate | ✅ | - | ✅ |
| U.S. House | ✅ | ✅ | ✅ |
| State Senate | - | ✅ | - |
| State House | ✅ | ✅ | ✅ |

**Complete list**: See [RACES_AVAILABLE.md](RACES_AVAILABLE.md)

---

## 📁 Files Overview

### Primary Data (Machine-Readable CSV)
- `20241105__mi__general__precinct.csv` - **2024 all races** (14 MB, 3,302 records)
- `20221108__mi__general__precinct.csv` - **2022 all races** (15 MB, 4,295 records)
- `20201103__mi__general__precinct.csv` - **2020 all races** (6.7 MB, 3,086 records)

### Official Documents (PDF)
- `november_2024_precinct_results.pdf` - 2024 official precinct report (19 MB)
- `november_2024_summary.pdf` - 2024 county summary (2.6 MB)
- `november_2022_precinct_results.pdf` - 2022 official precinct report (9.5 MB)
- `november_2022_summary.pdf` - 2022 county summary (303 KB)
- `november_2020_precinct_results.pdf` - 2020 official precinct report (10 MB)
- `november_2020_summary.pdf` - 2020 county summary (782 KB)

### Audit Data
- `november_2020_audit_precincts.xlsx` - 2020 post-election audit (4.0 MB)

### Documentation
- `README.md` - This file (overview)
- `QUICK_START.md` - Quick start guide with code examples
- `COLLECTION_REPORT.md` - Full collection report
- `DATA_INVENTORY.md` - Detailed file inventory
- `RACES_AVAILABLE.md` - Complete race list by election
- `extract_races.py` - Utility script to extract race lists

---

## 🔍 Data Structure

### CSV Format (OpenElections)
```
county,precinct,office,district,candidate,party,votes,election_day,absentee,av_counting_boards,early_voting,mail,provisional,pre_process_absentee
```

**Example:**
```
Ingham,"Delhi Charter Township, Precinct 1",President,,Kamala D. Harris,DEM,1232,320,,171,741,,,
```

### Key Fields
- **county**: Always "Ingham" for this dataset
- **precinct**: Full precinct name (township/city + precinct number)
- **office**: Race name (President, U.S. Senate, Governor, etc.)
- **district**: Congressional/legislative district number (if applicable)
- **candidate**: Candidate name
- **party**: Party code (DEM, REP, LIB, GRN, UST, etc.)
- **votes**: Total vote count
- **election_day, absentee, early_voting, mail, etc.**: Vote method breakdown

---

## 📈 Quick Stats

### Precinct Coverage
- **2024**: 103 unique precincts
- **2022**: 112 unique precincts
- **2020**: 115 unique precincts

### Geographic Coverage (20 municipalities)
Alaiedon Township • Aurelius Township • Bunker Hill Township • City of East Lansing • City of Lansing • City of Leslie • City of Mason • City of Williamston • Delhi Charter Township • Ingham Township • Lansing Charter Township • Leroy Township • Leslie Township • Locke Township • Meridian Charter Township • Onondaga Township • Stockbridge Township • Vevay Township • Wheatfield Township • White Oak Township

### Race Counts
- **2024**: 6 competitive races + turnout/registration data
- **2022**: 11 competitive races + ballot measure + turnout/registration
- **2020**: 6 competitive races + turnout/registration data

---

## 💻 Usage Examples

### Extract 2024 Presidential Results (Bash)
```bash
grep "^Ingham," 20241105__mi__general__precinct.csv | grep "President"
```

### Load 2024 Data (Python)
```python
import pandas as pd
df = pd.read_csv('20241105__mi__general__precinct.csv')
ingham = df[df['county'] == 'Ingham']
```

### Count Votes by Candidate (Python)
```python
pres = ingham[ingham['office'] == 'President']
pres.groupby('candidate')['votes'].sum()
```

**More examples**: See [QUICK_START.md](QUICK_START.md)

---

## 📚 Documentation Guide

| Document | Use When |
|----------|----------|
| [README.md](README.md) | You need an overview (you are here) |
| [QUICK_START.md](QUICK_START.md) | You want to start analyzing data immediately |
| [COLLECTION_REPORT.md](COLLECTION_REPORT.md) | You need full collection details and sources |
| [DATA_INVENTORY.md](DATA_INVENTORY.md) | You need detailed file descriptions |
| [RACES_AVAILABLE.md](RACES_AVAILABLE.md) | You need a complete list of races |

---

## 🔗 Data Sources

### Primary Source: Ingham County Clerk
- **Website**: [clerk.ingham.org/election_results](https://clerk.ingham.org/departments_and_officials/county_clerk/election_results.php)
- **Contact**: Elections Director at (517) 676-7255
- **Data**: Official PDF reports (certified results)

### Secondary Source: OpenElections Project
- **Repository**: [github.com/openelections/openelections-data-mi](https://github.com/openelections/openelections-data-mi)
- **Data**: Pre-processed CSV files (validated, community-maintained)
- **License**: Open data, free to use

---

## ✅ Data Quality

**CSV Files (Recommended for Analysis)**
- ✅ Machine-readable format
- ✅ Standardized across years
- ✅ Complete precinct coverage
- ✅ Vote method breakdown
- ✅ Community-validated
- ✅ Ready for immediate use

**PDF Files (For Verification)**
- ✅ Official certified results
- ⚠️ Requires PDF parsing/extraction
- 💡 Use for verification against CSV data

**Excel File (2020 Audit)**
- ✅ Structured format
- ✅ Ready for analysis
- 💡 Contains audit sampling results

---

## 🎯 Next Steps

1. **Start exploring**: See [QUICK_START.md](QUICK_START.md)
2. **Load into your tool**: CSV files work with Python, R, SQL, Excel
3. **Analyze patterns**: Precinct-level data enables detailed geographic analysis
4. **Verify if needed**: Cross-reference with PDF documents
5. **Extract more races**: Run `python3 extract_races.py`

---

## 📧 Questions?

**About the original data**: Contact Ingham County Clerk at (517) 676-7255

**About the CSV format**: See [OpenElections GitHub](https://github.com/openelections/openelections-data-mi/issues)

**About this collection**: See [COLLECTION_REPORT.md](COLLECTION_REPORT.md) for full details

---

**Collection completed**: 2025-11-30
**Data researcher**: Data Acquisition Agent
**Data quality**: ✅ Validated and ready for analysis
