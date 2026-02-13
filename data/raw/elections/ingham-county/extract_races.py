#!/usr/bin/env python3
"""Extract unique races from Ingham County election CSV files."""

import csv
from pathlib import Path

def extract_races(csv_file):
    """Extract unique offices/races from a CSV file."""
    races = set()
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row['county'] == 'Ingham':
                office = row['office']
                district = row['district']
                if district:
                    races.add(f"{office} - District {district}")
                else:
                    races.add(office)
    return sorted(races)

def main():
    data_dir = Path(__file__).parent

    files = {
        '2024': '20241105__mi__general__precinct.csv',
        '2022': '20221108__mi__general__precinct.csv',
        '2020': '20201103__mi__general__precinct.csv',
    }

    for year, filename in files.items():
        filepath = data_dir / filename
        print(f"\n{'='*60}")
        print(f"November {year} General Election - Races Available")
        print(f"{'='*60}")

        races = extract_races(filepath)
        for race in races:
            print(f"  - {race}")

        print(f"\nTotal races: {len(races)}")

if __name__ == '__main__':
    main()
