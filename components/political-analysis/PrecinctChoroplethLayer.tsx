/**
 * PrecinctChoroplethLayer Component
 *
 * Visualizes precinct targeting strategies with choropleth coloring.
 * Integrates precinct boundaries with targeting score data to create
 * a thematic map showing campaign targeting priorities.
 *
 * Targeting Strategies:
 * - Battleground: Purple - High persuasion + competitive precincts
 * - Base Mobilization: Blue - High GOTV priority + strong support
 * - Persuasion Target: Orange - High persuasion + moderate support
 * - Maintenance: Gray - Low priority / safe areas
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

// ============================================================================
// Precinct Name Normalization
// ============================================================================

/**
 * Normalizes a boundary precinct name to match targeting scores format.
 *
 * Boundary data uses: "City of East Lansing, Precinct 2", "Delhi Charter Township, Precinct 5"
 * Targeting scores use: "East Lansing Precinct 2", "Delhi Precinct 5"
 *
 * This function converts boundary names to targeting score keys.
 */
function normalizePrecinctName(boundaryName: string): string {
  if (!boundaryName) return '';

  let normalized = boundaryName;

  // Remove "City of " prefix
  normalized = normalized.replace(/^City of /i, '');

  // Remove "Charter Township" and replace with just the name
  normalized = normalized.replace(/ Charter Township/i, '');

  // Remove " Township" suffix (but keep the base name)
  normalized = normalized.replace(/ Township/i, '');

  // Replace ", Precinct" with " Precinct" (remove comma)
  normalized = normalized.replace(/,\s*Precinct/i, ' Precinct');

  // Clean up any double spaces
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Creates a lookup map from boundary names to targeting score keys.
 * Attempts multiple normalization strategies to find matches.
 */
function createPrecinctNameLookup(
  targetingScoreKeys: string[]
): Map<string, string> {
  const lookup = new Map<string, string>();

  // Create a normalized version of each targeting score key for matching
  const normalizedScoreKeys = new Map<string, string>();
  for (const key of targetingScoreKeys) {
    // Store both the original key and lowercase version for fuzzy matching
    normalizedScoreKeys.set(key.toLowerCase(), key);
    normalizedScoreKeys.set(key.toLowerCase().replace(/\s+/g, ''), key);
  }

  return {
    get: (boundaryName: string): string | undefined => {
      // Try exact match first
      if (targetingScoreKeys.includes(boundaryName)) {
        return boundaryName;
      }

      // Try normalized name
      const normalized = normalizePrecinctName(boundaryName);
      if (targetingScoreKeys.includes(normalized)) {
        return normalized;
      }

      // Try lowercase match
      const normalizedLower = normalized.toLowerCase();
      if (normalizedScoreKeys.has(normalizedLower)) {
        return normalizedScoreKeys.get(normalizedLower);
      }

      // Try without spaces
      const noSpaces = normalizedLower.replace(/\s+/g, '');
      if (normalizedScoreKeys.has(noSpaces)) {
        return normalizedScoreKeys.get(noSpaces);
      }

      return undefined;
    },
    set: lookup.set.bind(lookup),
    has: lookup.has.bind(lookup),
  } as Map<string, string>;
}
import GeoJSONLayer from '@arcgis/core/layers/GeoJSONLayer';
import Graphic from '@arcgis/core/Graphic';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import UniqueValueRenderer from '@arcgis/core/renderers/UniqueValueRenderer';
import ClassBreaksRenderer from '@arcgis/core/renderers/ClassBreaksRenderer';
import PopupTemplate from '@arcgis/core/PopupTemplate';
import LabelClass from '@arcgis/core/layers/support/LabelClass';
import TextSymbol from '@arcgis/core/symbols/TextSymbol';

import { politicalDataService } from '@/lib/services/PoliticalDataService';

// ============================================================================
// Temporal Color Ramps
// ============================================================================

const TEMPORAL_COLORS = {
  margin: {
    // Red (R) to Purple (tossup) to Blue (D)
    breaks: [-40, -20, -10, -5, 0, 5, 10, 20, 40],
    colors: [
      [153, 27, 30, 0.8],   // R +40+
      [239, 68, 68, 0.75],  // R +20-40
      [252, 165, 165, 0.7], // R +10-20
      [254, 202, 202, 0.65],// R +5-10
      [167, 139, 250, 0.6], // Tossup -5 to +5
      [191, 219, 254, 0.65],// D +5-10
      [147, 197, 253, 0.7], // D +10-20
      [59, 130, 246, 0.75], // D +20-40
      [29, 78, 216, 0.8],   // D +40+
    ],
  },
  turnout: {
    // Low to high turnout (gray to green)
    breaks: [0, 30, 45, 55, 65, 75, 100],
    colors: [
      [229, 231, 235, 0.6], // Very low < 30%
      [254, 240, 138, 0.65],// Low 30-45%
      [253, 224, 71, 0.7],  // Below avg 45-55%
      [163, 230, 53, 0.75], // Average 55-65%
      [74, 222, 128, 0.8],  // Good 65-75%
      [34, 197, 94, 0.85],  // High 75%+
    ],
  },
  demPct: {
    // Blue gradient (light to dark)
    breaks: [0, 30, 40, 50, 60, 70, 100],
    colors: [
      [254, 202, 202, 0.65], // <30% - Light red (heavily R)
      [253, 224, 71, 0.6],   // 30-40% - Yellow
      [209, 213, 219, 0.6],  // 40-50% - Gray (competitive)
      [147, 197, 253, 0.7],  // 50-60% - Light blue
      [59, 130, 246, 0.75],  // 60-70% - Blue
      [29, 78, 216, 0.85],   // 70%+ - Dark blue
    ],
  },
};

// ============================================================================
// Color Scheme for Targeting Strategies
// ============================================================================

// STRATEGY_COLORS must match the actual values in targeting_scores data:
// "Base Mobilization", "Battleground", "Maintenance", "Persuasion Target"
const STRATEGY_COLORS = {
  'Battleground': {
    fill: [147, 51, 234, 0.6],      // Purple #9333ea - Competitive areas
    outline: [126, 34, 206, 1],     // Dark purple
    label: 'Battleground',
  },
  'Base Mobilization': {
    fill: [37, 99, 235, 0.6],       // Blue #2563eb - Turnout focus
    outline: [29, 78, 216, 1],      // Dark blue
    label: 'Base Mobilization',
  },
  'Persuasion Target': {
    fill: [234, 88, 12, 0.6],       // Orange #ea580c - Persuadable voters
    outline: [194, 65, 12, 1],      // Dark orange
    label: 'Persuasion Target',
  },
  'Maintenance': {
    fill: [156, 163, 175, 0.5],     // Gray #9ca3af - Low priority
    outline: [107, 114, 128, 1],    // Dark gray
    label: 'Maintenance',
  },
} as const;

// Default for precincts without data - more visible "no data" styling
const DEFAULT_SYMBOL = new SimpleFillSymbol({
  color: [220, 220, 220, 0.6],  // More visible gray
  outline: new SimpleLineSymbol({
    color: [100, 100, 100],      // Darker outline for visibility
    width: 1,
  }),
});

// MPIQ Green highlight symbol for selected precincts
const HIGHLIGHT_SYMBOL = new SimpleFillSymbol({
  color: [51, 168, 82, 0.3],      // MPIQ green with 30% opacity
  outline: new SimpleLineSymbol({
    color: [51, 168, 82, 1],      // Solid MPIQ green
    width: 3,
  }),
});

// ============================================================================
// Component Props
// ============================================================================

/** Temporal mode configuration */
export interface TemporalConfig {
  enabled: boolean;
  electionYear: number;
  metric: 'margin' | 'turnout' | 'demPct';
}

interface PrecinctChoroplethLayerProps {
  view: __esri.MapView;
  visible?: boolean;
  opacity?: number;
  onPrecinctClick?: (precinctName: string, attributes: any) => void;
  onPrecinctHover?: (precinctName: string | null, attributes?: any) => void;
  selectedPrecinctName?: string | null;
  /** @deprecated Use selectedPrecinctName instead */
  selectedPrecinctId?: string | null;
  showLabels?: boolean;
  enablePopup?: boolean;
  /** Temporal mode - when enabled, colors by election year data */
  temporalConfig?: TemporalConfig;
}

// ============================================================================
// Main Component
// ============================================================================

export function PrecinctChoroplethLayer({
  view,
  visible = true,
  opacity = 1.0,
  onPrecinctClick,
  onPrecinctHover,
  selectedPrecinctName = null,
  selectedPrecinctId = null,
  showLabels = false,
  enablePopup = true,
  temporalConfig,
}: PrecinctChoroplethLayerProps) {
  // Support both prop names
  const effectiveSelectedName = selectedPrecinctName || selectedPrecinctId;
  const layerRef = useRef<GeoJSONLayer | null>(null);
  const clickHandlerRef = useRef<IHandle | null>(null);
  const hoverHandlerRef = useRef<IHandle | null>(null);
  const highlightRef = useRef<__esri.Handle | null>(null);
  const highlightGraphicRef = useRef<__esri.Graphic | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // Create Renderer
  // ============================================================================

  const createRenderer = useCallback(() => {
    const renderer = new UniqueValueRenderer({
      field: 'targeting_strategy',
      defaultSymbol: DEFAULT_SYMBOL,
      uniqueValueInfos: Object.entries(STRATEGY_COLORS).map(([strategy, colors]) => ({
        value: strategy,
        symbol: new SimpleFillSymbol({
          color: colors.fill as [number, number, number, number],
          outline: new SimpleLineSymbol({
            color: colors.outline as [number, number, number, number],
            width: 1,
          }),
        }),
        label: colors.label,
      })),
    });

    return renderer;
  }, []);

  // ============================================================================
  // Create Temporal Renderer (when temporal mode is enabled)
  // ============================================================================

  const createTemporalRenderer = useCallback((metric: 'margin' | 'turnout' | 'demPct', year: number) => {
    const config = TEMPORAL_COLORS[metric];
    const fieldName = `election_${year}_${metric}`;

    const classBreakInfos = [];
    for (let i = 0; i < config.breaks.length - 1; i++) {
      const minVal = config.breaks[i];
      const maxVal = config.breaks[i + 1];
      const color = config.colors[i];

      classBreakInfos.push({
        minValue: minVal,
        maxValue: maxVal,
        symbol: new SimpleFillSymbol({
          color: color as [number, number, number, number],
          outline: new SimpleLineSymbol({
            color: [255, 255, 255, 0.6],
            width: 0.75,
          }),
        }),
        label: metric === 'margin'
          ? `${minVal >= 0 ? 'D+' : 'R+'}${Math.abs(minVal)} to ${maxVal >= 0 ? 'D+' : 'R+'}${Math.abs(maxVal)}`
          : `${minVal}% - ${maxVal}%`,
      });
    }

    return new ClassBreaksRenderer({
      field: fieldName,
      classBreakInfos,
      defaultSymbol: DEFAULT_SYMBOL,
      defaultLabel: 'No data',
    });
  }, []);

  // ============================================================================
  // Create Popup Template
  // ============================================================================

  const createPopupTemplate = useCallback(() => {
    return new PopupTemplate({
      title: '<div style="font-size: 14px; font-weight: 600; color: #1f2937; font-family: Inter, system-ui, -apple-system, sans-serif;">{precinct_name}</div>',
      content: `
        <div style="font-family: Inter, system-ui, -apple-system, sans-serif; font-size: 13px; line-height: 1.5;">
          <!-- Strategy Badge -->
          <div style="margin-bottom: 12px; padding: 8px 12px; background: #f3f4f6; border-radius: 6px; border-left: 3px solid #33a852;">
            <div style="font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Targeting Strategy</div>
            <div style="font-size: 14px; font-weight: 600; color: #1f2937;">{targeting_strategy}</div>
          </div>

          <!-- Score Grid -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
            <div style="padding: 8px; background: #fef3c7; border-radius: 6px; text-align: center;">
              <div style="font-size: 10px; color: #92400e;">GOTV Priority</div>
              <div style="font-size: 18px; font-weight: 700; color: #b45309;">{gotv_priority}</div>
            </div>
            <div style="padding: 8px; background: #faf5ff; border-radius: 6px; text-align: center;">
              <div style="font-size: 10px; color: #6b21a8;">Persuasion</div>
              <div style="font-size: 18px; font-weight: 700; color: #7c3aed;">{persuasion_opportunity}</div>
            </div>
          </div>

          <!-- Classifications -->
          <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px;">
            <span style="padding: 2px 8px; background: #dcfce7; color: #166534; border-radius: 12px; font-size: 11px;">{gotv_classification}</span>
            <span style="padding: 2px 8px; background: #e9d5ff; color: #6b21a8; border-radius: 12px; font-size: 11px;">{persuasion_classification}</span>
          </div>

          <!-- Partisan Lean -->
          <div style="margin-bottom: 8px;">
            <div style="font-size: 10px; color: #6b7280; margin-bottom: 4px;">Partisan Lean</div>
            <div style="height: 8px; background: linear-gradient(to right, #dc2626, #f3f4f6, #2563eb); border-radius: 4px; position: relative;">
              <div style="position: absolute; width: 12px; height: 12px; background: white; border: 2px solid #1f2937; border-radius: 50%; top: -2px; left: calc(50% + {partisan_lean}% * 0.5 - 6px);"></div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 10px; color: #6b7280; margin-top: 2px;">
              <span>R+100</span>
              <span>D+100</span>
            </div>
          </div>

          <!-- Recommendation -->
          <div style="padding: 8px; background: #f0fdf4; border-radius: 6px; border: 1px solid #bbf7d0;">
            <div style="font-size: 10px; color: #166534; font-weight: 500;">Recommendation</div>
            <div style="font-size: 11px; color: #15803d;">{recommendation}</div>
          </div>
        </div>
      `,
    });
  }, []);

  // ============================================================================
  // Create Label Class
  // ============================================================================

  const createLabelClass = useCallback(() => {
    return new LabelClass({
      labelExpressionInfo: {
        expression: '$feature.precinct_name',
      },
      symbol: new TextSymbol({
        color: [0, 0, 0, 0.8],
        haloColor: [255, 255, 255, 0.9],
        haloSize: 2,
        font: {
          size: 10,
          weight: 'bold',
        },
      }),
      minScale: 150000, // Only show labels when zoomed in
    });
  }, []);

  // ============================================================================
  // Load Layer with Targeting Data
  // ============================================================================

  useEffect(() => {
    if (!view) return;

    let isMounted = true;

    const loadLayer = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Initialize service and load data
        await politicalDataService.initialize();

        // Load precinct boundaries, targeting scores, and election data in parallel
        const [boundaries, targetingScores, electionResults] = await Promise.all([
          politicalDataService.loadPrecinctBoundaries(),
          politicalDataService.getAllTargetingScores(),
          politicalDataService.getAllElectionResults(),
        ]);

        if (!isMounted) return;

        console.log(`[PrecinctChoroplethLayer] Loaded ${boundaries.features.length} precinct boundaries`);
        console.log(`[PrecinctChoroplethLayer] Loaded ${Object.keys(targetingScores).length} targeting scores`);
        console.log(`[PrecinctChoroplethLayer] Loaded election results: ${electionResults ? 'yes' : 'no'}`);

        // Create name lookup for matching boundary names to targeting score keys
        const targetingScoreKeys = Object.keys(targetingScores);
        const nameLookup = createPrecinctNameLookup(targetingScoreKeys);

        // Debug: Log first few precinct names from boundaries
        console.log('[PrecinctChoroplethLayer] Sample boundary precinct names:',
          boundaries.features.slice(0, 3).map(f => f.properties?.PRECINCT_NAME || f.properties?.Precinct_Long_Name || f.properties?.NAME));

        // Debug: Log first few keys from targeting scores
        console.log('[PrecinctChoroplethLayer] Sample targeting score keys:',
          targetingScoreKeys.slice(0, 3));

        // Date-to-year mapping for election results lookup
        const electionDateToYear: Record<string, number> = {
          '2020-11-03': 2020,
          '2022-11-08': 2022,
          '2024-11-05': 2024,
        };

        // Join targeting data and election data to precinct features
        let matchedCount = 0;
        let unmatchedCount = 0;
        const enrichedFeatures = boundaries.features.map((feature) => {
          // Handle both local GeoJSON format (PRECINCT_NAME) and blob storage format (Precinct_Long_Name)
          const boundaryName = feature.properties?.PRECINCT_NAME
            || feature.properties?.Precinct_Long_Name
            || feature.properties?.NAME;

          // Try direct match first (local file names match targeting scores),
          // then fallback to normalized lookup (for blob storage names)
          let scores = targetingScores[boundaryName] as typeof targetingScores[string] | undefined;
          if (!scores) {
            const targetingKey = nameLookup.get(boundaryName);
            scores = targetingKey ? targetingScores[targetingKey] : undefined;
          }

          // Debug: Track matches
          if (scores) {
            matchedCount++;
          } else {
            unmatchedCount++;
            const normalized = normalizePrecinctName(boundaryName);
            console.warn(`[PrecinctChoroplethLayer] No targeting scores found for precinct: "${boundaryName}" (normalized: "${normalized}")`);
          }

          // Look up election data by precinct name (try direct match first, then normalized)
          const electionPrecinctData = electionResults?.precincts?.[boundaryName]
            || electionResults?.precincts?.[normalizePrecinctName(boundaryName)];
          const electionsByDate = electionPrecinctData?.elections || {};

          // Build election year fields for temporal rendering
          // Election data is keyed by date (e.g., "2020-11-03"), not year
          const electionFields: Record<string, number | null> = {};
          for (const year of [2020, 2022, 2024]) {
            // Find the election date for this year
            const dateKey = Object.keys(electionDateToYear).find(d => electionDateToYear[d] === year);
            const electionData = dateKey ? electionsByDate[dateKey] : null;

            // Extract presidential/gubernatorial race data
            // Data structure: { "President": { dem_pct, rep_pct, margin, turnout }, ... }
            const raceData = electionData
              ? (electionData['President'] || electionData['Governor'] || Object.values(electionData)[0])
              : null;

            if (raceData) {
              // Parse percentage strings like "55.2%" to numbers
              const parsePercent = (val: string | number | null | undefined): number | null => {
                if (val === null || val === undefined) return null;
                if (typeof val === 'number') return val;
                const parsed = parseFloat(val.replace('%', ''));
                return isNaN(parsed) ? null : parsed;
              };
              const parseMargin = (val: string | number | null | undefined): number | null => {
                if (val === null || val === undefined) return null;
                if (typeof val === 'number') return val;
                // Margin format: "D+15" or "R+8" or "+15" etc
                const match = val.toString().match(/([DR]?)[+]?([-\d.]+)/);
                if (!match) return null;
                const num = parseFloat(match[2]);
                // D+ is positive, R+ is negative
                return match[1] === 'R' ? -num : num;
              };

              electionFields[`election_${year}_margin`] = parseMargin(raceData.margin);
              electionFields[`election_${year}_turnout`] = parsePercent(raceData.turnout);
              electionFields[`election_${year}_demPct`] = parsePercent(raceData.dem_pct);
              electionFields[`election_${year}_repPct`] = parsePercent(raceData.rep_pct);
              electionFields[`election_${year}_ballotsCast`] = raceData.total_votes ?? null;
            } else {
              electionFields[`election_${year}_margin`] = null;
              electionFields[`election_${year}_turnout`] = null;
              electionFields[`election_${year}_demPct`] = null;
              electionFields[`election_${year}_repPct`] = null;
              electionFields[`election_${year}_ballotsCast`] = null;
            }
          }

          // Merge targeting data into feature properties
          return {
            ...feature,
            properties: {
              ...feature.properties,
              precinct_name: boundaryName,
              targeting_strategy: scores?.targeting_strategy || 'Unknown',
              gotv_priority: scores?.gotv_priority ?? null,
              persuasion_opportunity: scores?.persuasion_opportunity ?? null,
              combined_score: scores?.combined_score ?? null,
              gotv_classification: scores?.gotv_classification || 'Unknown',
              persuasion_classification: scores?.persuasion_classification || 'Unknown',
              recommendation: scores?.recommendation || 'No data available',
              // Include political scores if available
              partisan_lean: scores?.political_scores?.partisan_lean ?? null,
              swing_potential: scores?.political_scores?.swing_potential ?? null,
              // Voter metrics from targeting scores
              registered_voters: scores?.registered_voters ?? null,
              active_voters: scores?.active_voters ?? null,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              turnout: (scores?.political_scores as any)?.turnout?.average ?? null,
              // Demographics
              total_population: scores?.total_population ?? null,
              median_income: scores?.median_household_income ?? null,
              dem_affiliation_pct: scores?.dem_affiliation_pct ?? null,
              rep_affiliation_pct: scores?.rep_affiliation_pct ?? null,
              // Election year data for temporal mode
              ...electionFields,
            },
          };
        });

        // Debug: Log join results
        console.log(`[PrecinctChoroplethLayer] Join complete: ${matchedCount} matched, ${unmatchedCount} unmatched`);

        // Debug: Log sample of enriched features
        const sampleFeature = enrichedFeatures[0];
        if (sampleFeature) {
          const props = sampleFeature.properties as Record<string, unknown>;
          console.log('[PrecinctChoroplethLayer] Sample enriched feature:', {
            precinct_name: props?.precinct_name,
            targeting_strategy: props?.targeting_strategy,
            gotv_priority: props?.gotv_priority,
            persuasion_opportunity: props?.persuasion_opportunity,
            partisan_lean: props?.partisan_lean,
            has_scores: !!props?.targeting_strategy && props.targeting_strategy !== 'Unknown',
            // Election data for temporal mode
            election_2020_margin: props?.election_2020_margin,
            election_2024_margin: props?.election_2024_margin,
            election_2020_turnout: props?.election_2020_turnout,
          });
        }

        // Debug: Count features with election data
        const electionsCount = enrichedFeatures.filter(f => {
          const props = f.properties as Record<string, unknown>;
          return props?.election_2020_margin !== null ||
            props?.election_2022_margin !== null ||
            props?.election_2024_margin !== null;
        }).length;
        console.log(`[PrecinctChoroplethLayer] Features with election data: ${electionsCount}/${enrichedFeatures.length}`);

        // Debug: Log ALL unique targeting strategies in enriched data
        const strategies = new Set(enrichedFeatures.map(f => f.properties?.targeting_strategy));
        console.log('[PrecinctChoroplethLayer] Unique targeting strategies in enriched data:', Array.from(strategies));

        // Debug: Count features by strategy
        const strategyCount: Record<string, number> = {};
        enrichedFeatures.forEach(f => {
          const s = f.properties?.targeting_strategy || 'Unknown';
          strategyCount[s] = (strategyCount[s] || 0) + 1;
        });
        console.log('[PrecinctChoroplethLayer] Features by strategy:', strategyCount);

        // Create enriched GeoJSON
        const enrichedGeoJSON: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: enrichedFeatures,
        };

        // Convert to Blob URL for GeoJSONLayer
        const blob = new Blob([JSON.stringify(enrichedGeoJSON)], {
          type: 'application/json',
        });
        const blobUrl = URL.createObjectURL(blob);

        if (!isMounted) {
          URL.revokeObjectURL(blobUrl);
          return;
        }

        // Remove existing layer
        if (layerRef.current) {
          view.map.remove(layerRef.current);
          layerRef.current = null;
        }

        // Create GeoJSON layer
        // Choose renderer based on temporal mode
        const renderer = temporalConfig?.enabled
          ? createTemporalRenderer(temporalConfig.metric, temporalConfig.electionYear)
          : createRenderer();

        const layer = new GeoJSONLayer({
          url: blobUrl,
          title: temporalConfig?.enabled
            ? `Election ${temporalConfig.electionYear} - ${temporalConfig.metric}`
            : 'Precinct Targeting Strategies',
          visible,
          opacity,
          outFields: ['*'],
          renderer,
          popupTemplate: enablePopup ? createPopupTemplate() : undefined,
          popupEnabled: enablePopup,
          labelingInfo: showLabels ? [createLabelClass()] : undefined,
        });

        // Add to map
        view.map.add(layer);
        layerRef.current = layer;

        // Wait for layer to load
        await layer.load();
        console.log('[PrecinctChoroplethLayer] Layer loaded');

        // Query a feature to verify data was loaded correctly
        try {
          const query = layer.createQuery();
          query.where = '1=1';
          query.num = 1;
          query.outFields = ['*'];
          const result = await layer.queryFeatures(query);
          if (result.features.length > 0) {
            const f = result.features[0];
            console.log('[PrecinctChoroplethLayer] Sample queried feature attributes:', {
              precinct_name: f.getAttribute('precinct_name'),
              targeting_strategy: f.getAttribute('targeting_strategy'),
              gotv_priority: f.getAttribute('gotv_priority'),
              all_keys: Object.keys(f.attributes || {}).join(', ')
            });
          }
        } catch (queryErr) {
          console.warn('[PrecinctChoroplethLayer] Query test failed:', queryErr);
        }

        // Wait for layer view to be ready before setting up click handler
        const layerView = await view.whenLayerView(layer);

        // Set up click handler
        if (onPrecinctClick) {
          clickHandlerRef.current?.remove();
          clickHandlerRef.current = view.on('click', async (event) => {
            try {
              // Use hit test with specific layer to improve accuracy
              const response = await view.hitTest(event, {
                include: [layer],
              });

              console.log('[PrecinctChoroplethLayer] Click hit test results:', response.results.length);

              const hit = response.results.find(
                (result) => result.type === 'graphic' && 'graphic' in result
              ) as { graphic: __esri.Graphic } | undefined;

              if (hit) {
                const precinctName = hit.graphic.getAttribute('precinct_name');
                const attributes = hit.graphic.attributes;
                console.log('[PrecinctChoroplethLayer] Precinct clicked:', precinctName);
                if (precinctName && onPrecinctClick) {
                  onPrecinctClick(precinctName, attributes);
                }
              } else {
                console.log('[PrecinctChoroplethLayer] No precinct found at click location');
              }
            } catch (err) {
              console.error('[PrecinctChoroplethLayer] Click handler error:', err);
            }
          });
        }

        // Set up hover handler
        if (onPrecinctHover) {
          hoverHandlerRef.current?.remove();
          hoverHandlerRef.current = view.on('pointer-move', async (event) => {
            try {
              const response = await view.hitTest(event, {
                include: [layer],
              });

              const hit = response.results.find(
                (result) => result.type === 'graphic' && 'graphic' in result
              ) as { graphic: __esri.Graphic } | undefined;

              if (hit) {
                const precinctName = hit.graphic.getAttribute('precinct_name');
                const attributes = hit.graphic.attributes;
                if (view.container) {
                  view.container.style.cursor = 'pointer';
                }
                if (onPrecinctHover) {
                  onPrecinctHover(precinctName, attributes);
                }
              } else {
                if (view.container) {
                  view.container.style.cursor = 'default';
                }
                if (onPrecinctHover) {
                  onPrecinctHover(null);
                }
              }
            } catch (err) {
              // Silently ignore hover errors to avoid console spam
            }
          });
        }

        setIsLoading(false);

        // Cleanup blob URL after layer is loaded
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      } catch (err) {
        console.error('[PrecinctChoroplethLayer] Error loading layer:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load precinct data');
          setIsLoading(false);
        }
      }
    };

    loadLayer();

    // Cleanup
    return () => {
      isMounted = false;
      clickHandlerRef.current?.remove();
      hoverHandlerRef.current?.remove();
      highlightRef.current?.remove();

      // Remove highlight graphic
      if (highlightGraphicRef.current) {
        view?.graphics.remove(highlightGraphicRef.current);
        highlightGraphicRef.current = null;
      }

      if (layerRef.current) {
        view.map?.remove(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [
    view,
    createRenderer,
    createTemporalRenderer,
    createPopupTemplate,
    createLabelClass,
    onPrecinctClick,
    onPrecinctHover,
    enablePopup,
    showLabels,
    temporalConfig?.enabled,
    temporalConfig?.electionYear,
    temporalConfig?.metric,
  ]);

  // ============================================================================
  // Update Visibility
  // ============================================================================

  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.visible = visible;
    }
  }, [visible]);

  // ============================================================================
  // Update Opacity
  // ============================================================================

  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.opacity = opacity;
    }
  }, [opacity]);

  // ============================================================================
  // Update Labels Dynamically
  // ============================================================================

  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.labelingInfo = showLabels ? [createLabelClass()] : [];
    }
  }, [showLabels, createLabelClass]);

  // ============================================================================
  // Handle Selection Highlighting
  // ============================================================================

  useEffect(() => {
    if (!view || !layerRef.current || !effectiveSelectedName) {
      // Clear highlight graphic
      if (highlightGraphicRef.current) {
        view?.graphics.remove(highlightGraphicRef.current);
        highlightGraphicRef.current = null;
      }
      // Clear default highlight
      highlightRef.current?.remove();
      highlightRef.current = null;
      return;
    }

    const highlightPrecinct = async () => {
      try {
        const layer = layerRef.current;
        if (!layer || !effectiveSelectedName) return;

        // Wait for layer view
        const layerView = await view.whenLayerView(layer);

        // Query the selected feature
        const query = layer.createQuery();
        query.where = `precinct_name = '${effectiveSelectedName.replace(/'/g, "''")}'`;
        query.returnGeometry = true;

        const result = await layer.queryFeatures(query);

        if (result.features.length > 0) {
          // Remove old highlight graphic if exists
          if (highlightGraphicRef.current) {
            view.graphics.remove(highlightGraphicRef.current);
          }

          // Create custom highlight graphic with MPIQ green
          const highlightGraphic = new Graphic({
            geometry: result.features[0].geometry,
            symbol: HIGHLIGHT_SYMBOL,
          });

          // Add highlight graphic to view
          view.graphics.add(highlightGraphic);
          highlightGraphicRef.current = highlightGraphic;

          // Zoom to feature
          await view.goTo(result.features[0].geometry, { duration: 500 });
        }
      } catch (err) {
        console.warn('[PrecinctChoroplethLayer] Error highlighting precinct:', err);
      }
    };

    highlightPrecinct();
  }, [view, effectiveSelectedName]);

  // ============================================================================
  // Error Display
  // ============================================================================

  useEffect(() => {
    if (error) {
      console.error('[PrecinctChoroplethLayer] Error:', error);
    }
  }, [error]);

  // This is a non-visual component (layer is added to the map)
  return null;
}

// ============================================================================
// Legend Component
// ============================================================================

interface PrecinctChoroplethLegendProps {
  className?: string;
  onStrategyClick?: (strategy: string) => void;
}

export function PrecinctChoroplethLegend({
  className = '',
  onStrategyClick,
}: PrecinctChoroplethLegendProps) {
  return (
    <div className={className}>
      <div className="space-y-1.5">
        {Object.entries(STRATEGY_COLORS).map(([strategy, colors]) => {
          const [r, g, b, a] = colors.fill;
          const bgColor = `rgba(${r}, ${g}, ${b}, ${a})`;
          const [or, og, ob] = colors.outline;
          const borderColor = `rgb(${or}, ${og}, ${ob})`;

          return (
            <button
              key={strategy}
              onClick={() => onStrategyClick?.(strategy)}
              className="flex items-center gap-2 w-full text-left hover:bg-gray-50 rounded px-1 py-0.5 transition-colors"
            >
              <div
                className="w-2.5 h-2.5 rounded border"
                style={{
                  backgroundColor: bgColor,
                  borderColor: borderColor,
                  borderWidth: '1.5px',
                }}
              />
              <span className="text-xs text-gray-700">{colors.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default PrecinctChoroplethLayer;
