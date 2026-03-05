

export type TemporalVisualizationMode =
  | 'animated'      // Animated playback through time
  | 'slider'        // Manual time slider
  | 'momentum'      // Rate of change heatmap
  | 'comparison';   // Small multiples comparison

export interface TimePeriod {
  key: string;        // e.g., "2024-10"
  label: string;      // e.g., "Oct 2024"
  startDate: Date;
  endDate: Date;
  isElection?: boolean;
  electionType?: 'primary' | 'general' | 'special';
}

export interface TemporalDataPoint {
  locationId: string;   // ZIP, precinct, H3 index, etc.
  period: string;       // Matches TimePeriod.key
  value: number;
  metadata?: Record<string, any>;
}

export interface MomentumConfig {
  comparisonPeriod: 'prior_month' | 'prior_quarter' | 'prior_year' | 'same_month_prior_year';
  colorScale: 'diverging' | 'sequential';
  thresholds: {
    strongDecline: number;   // e.g., -20%
    decline: number;         // e.g., -5%
    growth: number;          // e.g., +5%
    strongGrowth: number;    // e.g., +20%
  };
}

export interface TemporalMapConfig {
  mode: TemporalVisualizationMode;
  timePeriods: TimePeriod[];
  currentPeriodIndex: number;
  comparisonPeriods?: string[];   // For comparison mode
  animationSpeed: number;         // ms per frame
  isPlaying: boolean;
  momentumConfig: MomentumConfig;
}

export interface TemporalMapControlsProps {
  config: TemporalMapConfig;
  onConfigChange: (config: TemporalMapConfig) => void;
  onPeriodChange: (period: TimePeriod) => void;
  onMomentumDataRequest: (currentPeriod: string, comparisonPeriod: string) => void;
  className?: string;
}


// Michigan election markers
const ELECTION_MARKERS: Record<string, { type: 'primary' | 'general' | 'special'; label: string }> = {
  '2024-08': { type: 'primary', label: 'MI Primary' },
  '2024-11': { type: 'general', label: 'General Election' },
  '2025-05': { type: 'special', label: 'Local Elections' },
  '2026-08': { type: 'primary', label: 'MI Primary' },
  '2026-11': { type: 'general', label: 'Midterms' },
};


export function generateTimePeriods(
  startDate: Date,
  endDate: Date,
  granularity: 'month' | 'quarter' | 'year' = 'month'
): TimePeriod[] {
  const periods: TimePeriod[] = [];
  const current = new Date(startDate);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  while (current <= endDate) {
    const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
    const electionInfo = ELECTION_MARKERS[key];

    periods.push({
      key,
      label: `${monthNames[current.getMonth()]} ${current.getFullYear()}`,
      startDate: new Date(current.getFullYear(), current.getMonth(), 1),
      endDate: new Date(current.getFullYear(), current.getMonth() + 1, 0),
      isElection: !!electionInfo,
      electionType: electionInfo?.type,
    });

    if (granularity === 'month') {
      current.setMonth(current.getMonth() + 1);
    } else if (granularity === 'quarter') {
      current.setMonth(current.getMonth() + 3);
    } else {
      current.setFullYear(current.getFullYear() + 1);
    }
  }

  return periods;
}

/**
 * Calculate momentum values (% change) between two periods
 */
export function calculateMomentum(
  currentData: TemporalDataPoint[],
  priorData: TemporalDataPoint[]
): Map<string, { change: number; changePercent: number; momentum: 'strong_decline' | 'decline' | 'stable' | 'growth' | 'strong_growth' }> {
  const priorMap = new Map(priorData.map((d) => [d.locationId, d.value]));
  const result = new Map();

  for (const current of currentData) {
    const prior = priorMap.get(current.locationId) || 0;
    const change = current.value - prior;
    const changePercent = prior > 0 ? (change / prior) * 100 : current.value > 0 ? 100 : 0;

    let momentum: 'strong_decline' | 'decline' | 'stable' | 'growth' | 'strong_growth';
    if (changePercent <= -20) {
      momentum = 'strong_decline';
    } else if (changePercent <= -5) {
      momentum = 'decline';
    } else if (changePercent >= 20) {
      momentum = 'strong_growth';
    } else if (changePercent >= 5) {
      momentum = 'growth';
    } else {
      momentum = 'stable';
    }

    result.set(current.locationId, { change, changePercent, momentum });
  }

  return result;
}

