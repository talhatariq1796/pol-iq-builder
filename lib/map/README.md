# Map Configuration

This directory contains centralized configuration for map-related functionality.

## Heatmap Metrics Configuration

**File**: `heatmapMetrics.ts`

Provides a centralized, type-safe configuration for heatmap metric mappings used throughout the application.

### Why Centralized Configuration?

Previously, metric mappings were hardcoded in multiple places (e.g., `PoliticalMapContainer.tsx`), leading to:
- Duplication of mapping logic
- Risk of inconsistencies across components
- Difficulty updating metric configurations

The centralized configuration eliminates these issues by providing a single source of truth.

### Usage

```typescript
import {
  resolveHeatmapMetric,
  getMetricConfig,
  getAvailableMetrics
} from '@/lib/map/heatmapMetrics';

// Resolve metric names (handles aliases and validation)
const metric = resolveHeatmapMetric('gotv'); // Returns 'gotv_priority'

// Get full metric configuration
const config = getMetricConfig('gotv');
console.log(config.label); // "GOTV Priority"
console.log(config.description); // "Get-out-the-vote mobilization value (0-100)"

// Get all available metrics (for UI dropdowns)
const metrics = getAvailableMetrics();
```

### Supported Metrics

| Metric Name | Aliases | Description |
|-------------|---------|-------------|
| `partisan_lean` | `swing_potential` | Historical voting pattern (-100 D to +100 R) |
| `gotv_priority` | `gotv`, `turnout` | Get-out-the-vote mobilization value (0-100) |
| `persuasion_opportunity` | `persuasion` | Proportion of persuadable voters (0-100) |
| `combined_score` | `combined` | Composite targeting score (0-100) |

### API Reference

#### `resolveHeatmapMetric(metric?: string): H3Metric`

Resolves a metric name (including aliases) to its canonical H3Metric value.

**Parameters:**
- `metric` - The metric name to resolve (can be canonical or alias)

**Returns:** The canonical H3Metric value, or `DEFAULT_HEATMAP_METRIC` if invalid

**Example:**
```typescript
resolveHeatmapMetric('gotv') // 'gotv_priority'
resolveHeatmapMetric('invalid') // 'partisan_lean' (default)
```

#### `getMetricConfig(metric?: string): HeatmapMetricConfig`

Get the full configuration for a metric.

**Parameters:**
- `metric` - The metric name (canonical or alias)

**Returns:** The metric configuration object

**Example:**
```typescript
const config = getMetricConfig('gotv');
// {
//   canonical: 'gotv_priority',
//   label: 'GOTV Priority',
//   description: 'Get-out-the-vote mobilization value (0-100)',
//   colorScheme: 'sequential',
//   higherIsBetter: true
// }
```

#### `getAvailableMetrics(): Array<{ value: H3Metric; config: HeatmapMetricConfig }>`

Get all available metrics with their configurations.

**Returns:** Array of metric values and configurations

**Example:**
```typescript
const metrics = getAvailableMetrics();
// [
//   { value: 'partisan_lean', config: { ... } },
//   { value: 'gotv_priority', config: { ... } },
//   ...
// ]
```

#### `isValidMetric(metric: string): boolean`

Validate if a metric name is recognized.

**Parameters:**
- `metric` - The metric name to validate

**Returns:** True if the metric is recognized (canonical or alias)

**Example:**
```typescript
isValidMetric('gotv') // true
isValidMetric('invalid') // false
```

### Adding New Metrics

To add a new metric:

1. Add the metric to the `H3Metric` type in `components/political-analysis/H3HeatmapLayer.tsx`:
   ```typescript
   export type H3Metric =
     | 'partisan_lean'
     | 'gotv_priority'
     | 'persuasion_opportunity'
     | 'combined_score'
     | 'new_metric'; // Add here
   ```

2. Add the metric configuration to `HEATMAP_METRIC_CONFIGS`:
   ```typescript
   export const HEATMAP_METRIC_CONFIGS: Record<H3Metric, HeatmapMetricConfig> = {
     // ... existing metrics
     new_metric: {
       canonical: 'new_metric',
       label: 'New Metric',
       description: 'Description of what this metric represents',
       colorScheme: 'sequential',
       higherIsBetter: true,
     },
   };
   ```

3. Add metric name and any aliases to `HEATMAP_METRIC_MAPPING`:
   ```typescript
   export const HEATMAP_METRIC_MAPPING: Record<HeatmapMetricName, H3Metric> = {
     // ... existing mappings
     new_metric: 'new_metric',
     new_alias: 'new_metric', // Optional alias
   };
   ```

4. Update the `HeatmapMetricName` type to include new names:
   ```typescript
   export type HeatmapMetricName =
     | /* existing names */
     | 'new_metric'
     | 'new_alias'; // If you added an alias
   ```

5. Add tests in `__tests__/heatmapMetrics.test.ts`

### Migration Notes

**Before (Hardcoded in PoliticalMapContainer.tsx):**
```typescript
const metricMapping: Record<string, H3Metric> = {
  'partisan_lean': 'partisan_lean',
  'swing_potential': 'partisan_lean',
  'gotv_priority': 'gotv_priority',
  'gotv': 'gotv_priority',
  // ...
};
const h3MetricValue = metricMapping[mapCommand.metric] || 'partisan_lean';
```

**After (Using Centralized Config):**
```typescript
import { resolveHeatmapMetric } from '@/lib/map/heatmapMetrics';

const h3MetricValue = resolveHeatmapMetric(mapCommand.metric);
```

### Related Issues

- **S1A-014**: showHeatmap metric mapping is hardcoded (Fixed)

### See Also

- `components/political-analysis/H3HeatmapLayer.tsx` - H3 heatmap layer component
- `components/map/PoliticalMapContainer.tsx` - Map container that uses these metrics
- `lib/ai-native/types.ts` - MapCommand types
