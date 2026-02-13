# Donor Analysis Library

Comprehensive donor analysis, fundraising intelligence, and candidate comparison tools for political campaigns.

## Components

### Core Analysis

- **DonorAggregator** - Aggregate contributions by ZIP, occupation, time period
- **DonorStore** - Persistent storage for contribution data
- **ProspectFinder** - Identify high-potential fundraising areas
- **ProspectScorer** - Score and rank prospects

### Candidate Comparison (NEW)

- **CandidateRegistry** - Central registry of candidates with aggregated fundraising data
- **RecipientFilter** - Filter contributions by recipient (candidate/committee)
- **ComparisonEngine** - Head-to-head fundraising comparisons

### Data Sources

- **FECClient** - Federal Election Commission API client
- **CommitteeLookup** - Committee party and type lookup

## Quick Start

### Candidate Comparison

```typescript
import { candidateRegistry, comparisonEngine } from '@/lib/donor';

// Initialize
await candidateRegistry.initialize();

// Get candidates
const slotkin = candidateRegistry.getCandidateById('S4MI00470');
const rogers = candidateRegistry.getCandidateById('S4MI00XXX');

// Compare
const comparison = comparisonEngine.compareCandidates(
  [slotkin, rogers],
  contributions,
  committeeData,
  ieData
);

console.log(comparison.comparison.totalRaisedAdvantage);
```

## Data Files

- `contributions.json` - Individual contributions
- `committee-contributions.json` - PAC contributions
- `independent-expenditures.json` - Super PAC spending
- `mi-candidates.json` - Michigan candidate registry

## Building Registry

```bash
npm run build:mi-candidates
```

## Documentation

- [Full Guide](/docs/donor/RECIPIENT-FILTER-COMPARISON-ENGINE.md)
- [Examples](/lib/donor/examples/comparison-examples.ts)
