# Donor Analysis Map Layers

Map visualization components for political donor intelligence, built on ArcGIS Maps SDK for React.

## Overview

This package provides three specialized map layers for visualizing donor data:

1. **LapsedDonorLayer** - Shows geographic concentration of lapsed donors with recovery scores
2. **UpgradeProspectLayer** - Displays donors with untapped giving potential by ZIP code
3. **IESpendingLayer** - Visualizes Independent Expenditure spending by district
4. **DonorLayerSwitcher** - UI component for toggling between layers and controlling options

## Installation

These components are already part of the project. Just import them:

```typescript
import {
  LapsedDonorLayer,
  UpgradeProspectLayer,
  IESpendingLayer,
  DonorLayerSwitcher,
  type DonorLayerType,
} from '@/components/map/layers';
```

## Quick Start

See `/components/map/DonorMapExample.tsx` for a complete working example.

```tsx
import { DonorMapExample } from '@/components/map/DonorMapExample';

function MyPage() {
  return <DonorMapExample />;
}
```

## Layer Components

### LapsedDonorLayer

Visualizes lapsed donors with cluster markers and heatmap overlay.

**Props:**
```typescript
interface LapsedDonorLayerProps {
  view: __esri.MapView;              // ArcGIS MapView instance
  visible?: boolean;                  // Layer visibility (default: true)
  colorBy?: 'recoveryScore' | 'historicalValue' | 'count';  // Color scheme
  onClusterClick?: (cluster: DonorCluster) => void;  // Click handler
  onDonorClick?: (donor: LapsedDonor) => void;       // Donor click handler
}
```

**Features:**
- Cluster markers sized by donor count
- Color-coded by recovery potential (green = high, red = low)
- Heatmap showing concentration
- Interactive popups with cluster stats

**Usage:**
```tsx
<LapsedDonorLayer
  view={mapView}
  visible={activeLayer === 'lapsed'}
  colorBy="recoveryScore"
  onClusterClick={(cluster) => {
    console.log('Clicked cluster:', cluster.clusterId);
    console.log('Donors in cluster:', cluster.donorCount);
    console.log('Estimated recovery:', cluster.totalEstimatedRecovery);
  }}
/>
```

**Color Schemes:**
- `recoveryScore`: Green (high recovery chance) → Red (low recovery chance)
- `historicalValue`: Purple gradient by total historical giving
- `count`: Blue gradient by number of donors

---

### UpgradeProspectLayer

Shows ZIP codes with donors who have room to give more.

**Props:**
```typescript
interface UpgradeProspectLayerProps {
  view: __esri.MapView;
  visible?: boolean;
  colorBy?: 'upgradeScore' | 'upgradeGap' | 'utilization';
  minScore?: number;                  // Filter by minimum upgrade score
  onZipClick?: (zip: string, prospects: UpgradeProspect[]) => void;
}
```

**Features:**
- ZIP code choropleth map
- Color intensity by upgrade potential
- Popup shows top prospects per ZIP
- Filter by minimum upgrade score

**Usage:**
```tsx
<UpgradeProspectLayer
  view={mapView}
  visible={activeLayer === 'upgrade'}
  colorBy="upgradeGap"
  minScore={60}  // Only show ZIPs with avg score >= 60
  onZipClick={(zip, prospects) => {
    console.log('ZIP code:', zip);
    console.log('Top 5 prospects:', prospects);
  }}
/>
```

**Color Schemes:**
- `upgradeScore`: Deep purple (high score) → Light purple (low score)
- `upgradeGap`: Darker purple for larger dollar gaps
- `utilization`: Darker purple for lower utilization (more opportunity)

---

### IESpendingLayer

Visualizes Independent Expenditure spending by congressional district.

**Props:**
```typescript
interface IESpendingLayerProps {
  view: __esri.MapView;
  visible?: boolean;
  showFor?: 'all' | 'DEM' | 'REP';    // Filter by party
  colorBy?: 'totalSpending' | 'netAdvantage';
  selectedRace?: string;               // Highlight specific race
  onRaceClick?: (race: string) => void;
}
```

**Features:**
- District boundaries colored by spending
- Party advantage indicator
- Popup shows spending breakdown by candidate
- Filter by party support

**Usage:**
```tsx
<IESpendingLayer
  view={mapView}
  visible={activeLayer === 'ie'}
  showFor="all"
  colorBy="netAdvantage"
  onRaceClick={(race) => {
    console.log('Race:', race);
    // Show candidate details, spending timeline, etc.
  }}
/>
```

**Color Schemes:**
- `netAdvantage`:
  - Blue: DEM advantage
  - Red: REP advantage
  - Purple: Contested (< $500K difference)
- `totalSpending`: Orange gradient (light → dark for more spending)

---

### DonorLayerSwitcher

UI component for switching between layers and controlling options.

**Props:**
```typescript
interface DonorLayerSwitcherProps {
  activeLayer: DonorLayerType;
  onLayerChange: (layer: DonorLayerType) => void;
  layerOptions: DonorLayerOptions;
  onOptionsChange: (layer: string, options: any) => void;
  className?: string;
}

type DonorLayerType = 'individual' | 'lapsed' | 'upgrade' | 'ie' | 'comparison';
```

**Features:**
- Tab-based layer selection
- Layer-specific controls (color by, filters)
- Built-in legend for active layer
- Collapsible controls panel

**Usage:**
```tsx
const [activeLayer, setActiveLayer] = useState<DonorLayerType>('lapsed');
const [options, setOptions] = useState({
  lapsed: { colorBy: 'recoveryScore', minRecoveryScore: 0 },
  upgrade: { colorBy: 'upgradeScore', minScore: 0 },
  ie: { showFor: 'all', colorBy: 'netAdvantage' },
});

<DonorLayerSwitcher
  activeLayer={activeLayer}
  onLayerChange={setActiveLayer}
  layerOptions={options}
  onOptionsChange={(layer, opts) => {
    setOptions(prev => ({ ...prev, [layer]: opts }));
  }}
  className="w-80"
/>
```

---

## Data Requirements

Each layer expects specific JSON data files in `/public/data/donors/`:

### lapsed-donors.json
```json
{
  "metadata": {
    "totalLapsed": 74,
    "totalHistoricalValue": 166766,
    "estimatedRecoveryValue": 17432
  },
  "donors": [
    {
      "donorId": "...",
      "zipCode": "48821",
      "recoveryScore": 86,
      "estimatedRecoveryAmount": 58,
      "priority": "high"
    }
  ],
  "clusters": [
    {
      "clusterId": "cluster_48823_48840_48842_48864",
      "centroid": { "lat": 42.718125, "lng": -84.416375 },
      "donorCount": 24,
      "avgRecoveryScore": 59.67
    }
  ]
}
```

### upgrade-prospects.json
```json
{
  "metadata": {
    "totalProspects": 5159,
    "totalUpgradeGap": 7834328
  },
  "prospects": [
    {
      "donorId": "...",
      "zipCode": "48823",
      "upgradeScore": 80,
      "upgradeGap": 14167,
      "recommendedAsk": 50
    }
  ]
}
```

### independent-expenditures.json
```json
{
  "metadata": {
    "totalSpending": 325604194.03
  },
  "byCandidateId": {
    "P80001571": {
      "candidateName": "TRUMP, DONALD",
      "party": "REPUBLICAN PARTY",
      "supportSpending": 248727.29,
      "opposeSpending": 29685395.87,
      "netSpending": -29436668.58
    }
  }
}
```

---

## Styling & Theming

All components use:
- **MPIQ Green** (#33a852) for highlights and selected states
- **Tailwind CSS** utility classes
- **ArcGIS Symbols** for map rendering

Color palettes are defined within each layer component and can be customized by editing the color functions.

---

## Integration with PoliticalMapContainer

To integrate these layers into the main map container:

```tsx
// In PoliticalMapContainer.tsx
import { DonorLayerSwitcher, LapsedDonorLayer, /* ... */ } from './layers';

// Add state for donor layers
const [donorLayer, setDonorLayer] = useState<DonorLayerType>('lapsed');
const [donorOptions, setDonorOptions] = useState({...});

// Render in map
{mapState.view && (
  <>
    <LapsedDonorLayer
      view={mapState.view}
      visible={donorLayer === 'lapsed'}
      colorBy={donorOptions.lapsed.colorBy}
    />
    {/* ... other layers */}
  </>
)}

// Add switcher to UI
<DonorLayerSwitcher
  activeLayer={donorLayer}
  onLayerChange={setDonorLayer}
  layerOptions={donorOptions}
  onOptionsChange={(layer, opts) => {
    setDonorOptions(prev => ({ ...prev, [layer]: opts }));
  }}
/>
```

---

## Performance Considerations

1. **Cluster Aggregation**: Lapsed donors are pre-clustered to reduce graphics load
2. **ZIP-Level Aggregation**: Upgrade prospects aggregate to ZIP polygons
3. **Conditional Rendering**: Only active layer is rendered to DOM
4. **Heatmap Optimization**: Uses ArcGIS HeatmapRenderer for efficient visualization
5. **Data Filtering**: Apply minScore/minRecoveryScore filters before rendering

---

## Troubleshooting

### Layer not appearing
- Check that data files exist in `/public/data/donors/`
- Verify `visible={true}` prop is set
- Ensure MapView is fully initialized (`view.when()` resolved)
- Check browser console for loading errors

### Click events not firing
- Ensure `hitTest` includes your layer
- Verify click handlers are attached after layer loads
- Check z-index ordering (clusters should be on top)

### ZIP codes not rendering
- Verify ZIP code geometries exist in `INGHAM_COUNTY_ZIPS` map
- Check that prospect data includes matching ZIP codes
- Ensure spatial reference is WGS84 (WKID 4326)

---

## License

Part of the Political Landscape Analysis Platform.

**Version**: 1.0
**Last Updated**: 2025-12-04
