# Canvassing Tool Components

React components for the Canvassing Tool upgrade, providing interactive map layers and visualizations for door-knocking operations.

## Components

### TurfBoundaryLayer

Displays canvassing turf boundaries on the map with status-based coloring and interactive features.

**Features:**
- Status-based coloring (not started, in progress, stalled, complete)
- Completion percentage visualization
- Priority-based coloring
- Density classification (urban, suburban, rural)
- Interactive popups with turf details
- Click and hover event handlers
- Selected turf highlighting with MPIQ green
- Optional labels

**Props:**
```typescript
interface TurfBoundaryLayerProps {
  view: __esri.MapView;                    // ArcGIS MapView instance
  turfs: CanvassingTurf[];                 // Array of turf definitions
  progress: Map<string, TurfProgress>;     // Progress data by turfId
  selectedTurfId?: string | null;          // Highlighted turf
  onTurfClick?: (turfId: string, attributes: any) => void;
  onTurfHover?: (turfId: string | null, attributes?: any) => void;
  colorBy?: 'status' | 'completion' | 'priority' | 'density';
  visible?: boolean;
  opacity?: number;
  showLabels?: boolean;
  enablePopup?: boolean;
}
```

**Usage:**
```tsx
import { TurfBoundaryLayer } from '@/components/canvassing';

function CanvassingMap() {
  const [selectedTurf, setSelectedTurf] = useState<string | null>(null);

  const handleTurfClick = (turfId: string, attributes: any) => {
    setSelectedTurf(turfId);
    console.log('Turf clicked:', turfId, attributes);
  };

  return (
    <PoliticalMapContainer>
      {(view) => (
        <TurfBoundaryLayer
          view={view}
          turfs={canvassingTurfs}
          progress={progressMap}
          selectedTurfId={selectedTurf}
          onTurfClick={handleTurfClick}
          colorBy="status"
          visible={true}
          opacity={0.7}
          showLabels={true}
          enablePopup={true}
        />
      )}
    </PoliticalMapContainer>
  );
}
```

### TurfBoundaryLegend

Companion legend component for TurfBoundaryLayer.

**Props:**
```typescript
interface TurfBoundaryLegendProps {
  colorBy: 'status' | 'completion' | 'priority' | 'density';
  className?: string;
}
```

**Usage:**
```tsx
import { TurfBoundaryLegend } from '@/components/canvassing';

<div className="legend-container">
  <TurfBoundaryLegend colorBy="status" />
</div>
```

### ProgressHeatmapLayer

Displays canvassing progress as a heatmap across the map.

### VolunteerLocationLayer

Shows real-time or historical volunteer locations during canvassing.

### RouteVisualizationLayer

Displays optimized canvassing routes on the map.

## Color Schemes

### Status Colors
- **Not Started**: Gray (#6b7280)
- **In Progress**: Blue (#3b82f6)
- **Stalled**: Red (#ef4444)
- **Complete**: Green (#22c55e)

### Completion Colors (Gradient)
- 0%: Light Red (#fecaca)
- 25%: Light Yellow (#fcd34d)
- 50%: Yellow (#fcd34d)
- 75%: Lime (#a3e635)
- 100%: Green (#22c55e)

### Priority Colors
- Low (0-3): Gray (#e5e7eb)
- Medium (3-7): Yellow (#fde047)
- High (7-10): Orange-Red gradient

### Density Colors
- **Urban**: Red (#ef4444)
- **Suburban**: Orange (#fb923c)
- **Rural**: Yellow (#fde047)

## Data Requirements

### CanvassingTurf
```typescript
interface CanvassingTurf {
  turfId: string;
  turfName: string;
  precinctIds: string[];              // Precinct IDs included in turf
  estimatedDoors: number;
  estimatedHours: number;
  doorsPerHour: number;
  density: 'urban' | 'suburban' | 'rural';
  priority: number;                   // 0-10 scale
  avgGotvPriority: number;            // 0-100
  avgPersuasionOpportunity: number;   // 0-100
}
```

### TurfProgress
```typescript
interface TurfProgress {
  turfId: string;
  turfName: string;
  universeId: string;
  targetDoors: number;
  doorsKnocked: number;
  doorsRemaining: number;
  percentComplete: number;
  totalContacts: number;
  contactRate: number;
  notHomeCount: number;
  refusedCount: number;
  totalHoursSpent: number;
  doorsPerHour: number;
  totalSessions: number;
  uniqueVolunteers: number;
  lastActivityDate?: string;
  status: 'not_started' | 'in_progress' | 'stalled' | 'complete';
  daysInactive?: number;
}
```

## Integration with PoliticalMapContainer

The TurfBoundaryLayer integrates seamlessly with the existing PoliticalMapContainer:

```tsx
import PoliticalMapContainer from '@/components/map/PoliticalMapContainer';
import { TurfBoundaryLayer, TurfBoundaryLegend } from '@/components/canvassing';

function CanvassingToolPage() {
  const [turfs, setTurfs] = useState<CanvassingTurf[]>([]);
  const [progress, setProgress] = useState<Map<string, TurfProgress>>(new Map());
  const [colorMode, setColorMode] = useState<'status' | 'completion' | 'priority' | 'density'>('status');

  return (
    <div className="flex h-screen">
      <PoliticalMapContainer
        height="100%"
        onMapReady={handleMapReady}
      >
        {(view) => (
          <TurfBoundaryLayer
            view={view}
            turfs={turfs}
            progress={progress}
            colorBy={colorMode}
            visible={true}
            opacity={0.7}
          />
        )}
      </PoliticalMapContainer>

      <div className="legend-panel">
        <TurfBoundaryLegend colorBy={colorMode} />
      </div>
    </div>
  );
}
```

## Notes

- Turf geometries are built by merging precinct boundaries from `politicalDataService`
- Uses ArcGIS Maps SDK for JavaScript (not react-map-gl)
- Supports all standard ArcGIS layer features (opacity, visibility, popups, labels)
- Automatically highlights selected turf with MPIQ green (#33a852)
- Popups include progress bars, metrics, and status indicators
- Leverages existing PoliticalMapContainer infrastructure

## Future Enhancements

- [ ] Real-time progress updates via WebSocket
- [ ] Animated turf transitions
- [ ] Route overlay integration
- [ ] Volunteer location clustering
- [ ] Time-series progress visualization
- [ ] Export turf boundaries as GeoJSON/Shapefile
