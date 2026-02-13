/* eslint-disable @typescript-eslint/no-explicit-any */
// Accept a minimal layer shape to avoid tight coupling to ArcGIS types in the browser
export interface MinimalClientLayer {
  layerId: string;
  layerName: string;
  layerType?: string;
  field?: string;
  features: Array<{ properties?: Record<string, any> } | any>;
}

export interface HistogramBin {
  start: number;
  end: number;
  count: number;
}

export interface LayerSummary {
  layerId: string;
  layerName: string;
  layerType?: string;
  field?: string;
  featureCount: number;
  numericField?: string;
  stats?: {
    min: number;
    max: number;
    mean: number;
    median: number;
    p25: number;
    p75: number;
    std: number;
  };
  histogram?: HistogramBin[];
  top?: Array<{ id: string; name: string; value: number; }>; // highest values
  bottom?: Array<{ id: string; name: string; value: number; }>; // lowest values
  samples?: Array<Record<string, any>>; // small set of representative properties (no geometry)
}

export interface ClientSummary {
  totalLayers: number;
  totalFeatures: number;
  layers: LayerSummary[];
  approxBytes?: number;
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

function computeStats(values: number[]) {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const min = sorted[0];
  const max = sorted[n - 1];
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  const median = quantile(sorted, 0.5);
  const p25 = quantile(sorted, 0.25);
  const p75 = quantile(sorted, 0.75);
  const variance = sorted.reduce((s, v) => s + (v - mean) * (v - mean), 0) / n;
  const std = Math.sqrt(variance);
  return { min, max, mean, median, p25, p75, std };
}

function buildHistogram(values: number[], bins = 10): HistogramBin[] | undefined {
  if (!values.length) return undefined;
  const stats = computeStats(values);
  if (!stats) return undefined;
  const { min, max } = stats;
  if (!isFiniteNumber(min) || !isFiniteNumber(max) || min === max) {
    return [{ start: min, end: max, count: values.length }];
  }
  const width = (max - min) / bins;
  const counts = new Array(bins).fill(0);
  for (const v of values) {
    if (!isFiniteNumber(v)) continue;
    let idx = Math.floor((v - min) / width);
    if (idx < 0) idx = 0;
    if (idx >= bins) idx = bins - 1;
    counts[idx]++;
  }
  const out: HistogramBin[] = [];
  for (let i = 0; i < bins; i++) {
    out.push({ start: min + i * width, end: min + (i + 1) * width, count: counts[i] });
  }
  return out;
}

function pickIdAndName(props: any): { id: string; name: string } {
  const id = String(
    props?.area_id ?? props?.zip ?? props?.ZIP ?? props?.zip_code ?? props?.id ?? props?.OBJECTID ?? props?.OBJECTID_1 ?? props?.GEOID ?? props?.FID ?? props?.NAME ?? 'unknown'
  );
  const name = String(
    props?.area_name ?? props?.NAME ?? props?.name ?? props?.DESCRIPTION ?? props?.city ?? props?.zip ?? id
  );
  
  // Debug logging for strategic analysis (first few only to reduce noise)
  if ((props?.strategic_analysis_score || props?.strategic_value_score) && id && ['32544', '33621', '32542'].includes(id)) {
    console.log(`🔍 [pickIdAndName] Strategic analysis - ${id}:`, {
      area_name: props?.area_name,
      final_id: id,
      final_name: name,
      name_source: props?.area_name ? 'area_name' : 'other'
    });
  }
  
  return { id, name };
}

function selectNumericFieldFromFeature(props: Record<string, any>): string | undefined {
  // Prefer explicit target field names if present
  const preferred = [
    'target_value',
    'value',
    // All endpoint scoring fields from ENDPOINT_SCORING_FIELD_MAPPING.md
    'strategic_analysis_score',
    'competitive_analysis_score',
    'demographic_insights_score',
    'correlation_analysis_score',
    'brand_difference_score',
    'comparative_analysis_score',
    'customer_profile_score',
    'trend_analysis_score',
    'segment_profiling_score',
    'anomaly_detection_score',
    'predictive_modeling_score',
    'feature_interactions_score',
    'outlier_detection_score',
    'scenario_analysis_score',
    'sensitivity_analysis_score',
    'model_performance_score',
    'ensemble_analysis_score',
    'feature_importance_ranking_score',
    'dimensionality_insights_score',
    'spatial_clusters_score',
    'consensus_analysis_score',
    'algorithm_comparison_score',
    'analyze_score',
    'algorithm_category', // Special case for model-selection
    // Legacy fields for backward compatibility
    'strategic_value_score',
    'competitive_advantage_score',
    'comparative_score'
  ];
  for (const key of preferred) {
    if (isFiniteNumber(props?.[key])) return key;
  }
  // Otherwise pick the first numeric-looking field
  for (const [k, v] of Object.entries(props)) {
    if (isFiniteNumber(v)) return k;
  }
  return undefined;
}

function safeSampleProperties(props: Record<string, any>, maxKeys = -1): Record<string, any> {
  // System/metadata fields to exclude for cleaner analysis
  const systemFieldsToExclude = new Set([
    'CREATED', 'MODIFIED', 'CREATOR', 'EDITOR', 'CreationDate', 'Creator', 'EditDate', 'Editor',
    'FLAGS', 'HIERARCHY', 'SYMBOL', 'SITE_METADATA', 'Shape__Area', 'Shape__Length',
    // Also exclude fields with placeholder/unknown values
    'REGION', 'GEONAME', 'GEOLEVEL' // Will be re-added if they have meaningful values
  ]);

  const out: Record<string, any> = {};
  let added = 0;
  
  for (const [k, v] of Object.entries(props)) {
    if (maxKeys > 0 && added >= maxKeys) break; // Only limit if maxKeys is positive
    if (v === null || v === undefined) continue;
    if (typeof v === 'object') continue; // skip nested objects/arrays
    
    // Skip system fields
    if (systemFieldsToExclude.has(k)) continue;
    
    // Skip fields with "Unknown" placeholder values unless they're important identifiers
    if (typeof v === 'string' && v === 'Unknown' && !['NAME', 'DESCRIPTION'].includes(k)) continue;
    
    // Skip zero-value system fields
    if (typeof v === 'number' && v === 0 && ['FLAGS', 'GEOID', 'SITE_METADATA'].includes(k)) continue;
    
    out[k] = v;
    added++;
  }
  return out;
}

/**
 * Intelligent stratified sampling for comprehensive dataset analysis
 * Provides statistical coverage while keeping payload manageable
 */
function createStratifiedSample(
  ranked: Array<{ id: string; name: string; value: number }>,
  totalRecords: number
): {
  top: Array<{ id: string; name: string; value: number }>;
  bottom: Array<{ id: string; name: string; value: number }>;
  samples: Array<{ id: string; name: string; value: number; sampleType: string }>;
} {
  if (ranked.length === 0) {
    return { top: [], bottom: [], samples: [] };
  }

  // Smart sample size calculation: 2% of dataset, min 30, max 100
  const targetSampleSize = Math.min(
    Math.max(30, Math.ceil(totalRecords * 0.02)), 
    100
  );

  const samples: Array<{ id: string; name: string; value: number; sampleType: string }> = [];
  const used = new Set<string>();

  // Helper to add unique samples
  const addSample = (item: typeof ranked[0], type: string) => {
    const key = `${item.id}_${item.value}`;
    if (!used.has(key) && samples.length < targetSampleSize) {
      samples.push({ ...item, sampleType: type });
      used.add(key);
      return true;
    }
    return false;
  };

  // Tier 1: Essential Records (Always Include)
  // Top performers (15-20 based on dataset size)
  const topCount = Math.min(Math.max(15, Math.ceil(totalRecords * 0.005)), 20);
  for (let i = 0; i < Math.min(topCount, ranked.length); i++) {
    addSample(ranked[i], 'top_performer');
  }

  // Bottom performers (8-12 based on dataset size)
  const bottomCount = Math.min(Math.max(8, Math.ceil(totalRecords * 0.003)), 12);
  for (let i = Math.max(0, ranked.length - bottomCount); i < ranked.length; i++) {
    addSample(ranked[i], 'bottom_performer');
  }

  // Tier 2: Statistical Coverage
  if (ranked.length >= 4) {
    // Quartile representatives (2-3 from each quartile)
    const quartileSize = Math.floor(ranked.length / 4);
    for (let q = 0; q < 4; q++) {
      const quartileStart = q * quartileSize;
      const quartileEnd = q === 3 ? ranked.length : (q + 1) * quartileSize;
      
      // Add 2-3 representatives from each quartile
      const repsPerQuartile = Math.min(3, Math.ceil((quartileEnd - quartileStart) / 10));
      for (let r = 0; r < repsPerQuartile; r++) {
        const idx = quartileStart + Math.floor((quartileEnd - quartileStart) * (r + 1) / (repsPerQuartile + 1));
        if (idx < ranked.length) {
          addSample(ranked[idx], `quartile_${q + 1}_rep`);
        }
      }
    }

    // Median representatives (3-5 around median)
    const medianIdx = Math.floor(ranked.length / 2);
    for (let offset = -2; offset <= 2; offset++) {
      const idx = medianIdx + offset;
      if (idx >= 0 && idx < ranked.length) {
        addSample(ranked[idx], 'median_area');
      }
    }

    // Statistical outliers (>2σ from mean)
    if (ranked.length >= 10) {
      const values = ranked.map(r => r.value);
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const stdDev = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);
      
      ranked.forEach(item => {
        if (Math.abs(item.value - mean) > 2 * stdDev) {
          addSample(item, 'statistical_outlier');
        }
      });
    }
  }

  // Tier 3: Decile sampling for remaining slots
  if (samples.length < targetSampleSize && ranked.length >= 10) {
    for (let d = 0; d < 10; d++) {
      const decileIdx = Math.floor(ranked.length * d / 10);
      if (decileIdx < ranked.length) {
        addSample(ranked[decileIdx], `decile_${d + 1}`);
      }
    }
  }

  // Ensure we have meaningful top/bottom for backward compatibility
  const top = samples
    .filter(s => s.sampleType === 'top_performer')
    .slice(0, 15); // Keep reasonable limit for legacy compatibility
    
  const bottom = samples
    .filter(s => s.sampleType === 'bottom_performer')
    .slice(0, 10);

  console.log(`🔍 [Stratified Sampling] Dataset: ${totalRecords} records → ${samples.length} samples`);
  console.log(`🔍 [Sample Composition] Top: ${top.length}, Bottom: ${bottom.length}, Statistical: ${samples.length - top.length - bottom.length}`);
  
  return { top, bottom, samples };
}

export function summarizeFeatureData(featureData: MinimalClientLayer[] | undefined | null): ClientSummary | undefined {
  if (!featureData || !Array.isArray(featureData) || featureData.length === 0) return undefined;

  const layerSummaries: LayerSummary[] = [];
  let totalFeatures = 0;

  for (const layer of featureData) {
    const featureCount = Array.isArray(layer.features) ? layer.features.length : 0;
    totalFeatures += featureCount;
  const firstProps = featureCount > 0 ? (layer.features[0] as any)?.properties ?? layer.features[0] ?? {} : {};
    const numericField = layer.field || selectNumericFieldFromFeature(firstProps);

    const values: number[] = [];
    const ranked: Array<{ id: string; name: string; value: number }> = [];
    if (numericField) {
      for (const f of layer.features) {
        const props = (f as any)?.properties ?? f;
        const v = props?.[numericField];
        if (isFiniteNumber(v)) {
          values.push(v);
          const { id, name } = pickIdAndName(props || {});
          ranked.push({ id, name, value: v });
        }
      }
    }

    ranked.sort((a, b) => b.value - a.value);

    const stats = values.length ? computeStats(values) : undefined;
    const histogram = values.length ? buildHistogram(values, 10) : undefined;
    
    // Use intelligent stratified sampling
    const { top, bottom, samples: stratifiedSamples } = createStratifiedSample(ranked, featureCount);

    // Convert stratified samples to the expected format with full properties
    const samples: Array<Record<string, any>> = [];
    for (const stratifiedSample of stratifiedSamples) {
      // Find the corresponding feature with full properties
      const matchingFeature = layer.features.find((f: any) => {
        const props = (f as any)?.properties ?? f;
        const { id } = pickIdAndName(props || {});
        return id === stratifiedSample.id;
      });
      
      if (matchingFeature) {
        const props = (matchingFeature as any)?.properties ?? matchingFeature ?? {};
        const { id, name } = pickIdAndName(props);
        samples.push({ 
          id, 
          name, 
          sampleType: stratifiedSample.sampleType,
          ...safeSampleProperties(props) 
        });
      }
    }

    layerSummaries.push({
      layerId: layer.layerId,
      layerName: layer.layerName,
      layerType: (layer as any)?.layerType,
      field: layer.field,
      featureCount,
      numericField,
      stats,
      histogram,
      top,
      bottom,
      samples
    });
  }

  const summary: ClientSummary = {
    totalLayers: featureData.length,
    totalFeatures,
    layers: layerSummaries
  };
  try {
    summary.approxBytes = Buffer.from(JSON.stringify(summary)).byteLength;
  } catch {
    // ignore if Buffer not available in browser; fall back
    try {
      summary.approxBytes = new TextEncoder().encode(JSON.stringify(summary)).length;
    } catch {
      // noop
    }
  }
  return summary;
}
