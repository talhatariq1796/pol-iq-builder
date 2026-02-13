'use client';

/**
 * useTemporalMap Hook
 *
 * Provides shared temporal state management for map visualizations.
 * Supports election data (yearly), donor data (monthly), and custom time periods.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type {
  TemporalMapConfig,
  TemporalVisualizationMode,
  TimePeriod,
  MomentumConfig,
  TemporalDataPoint,
} from '@/components/map/TemporalMapControls';
import { generateTimePeriods, calculateMomentum } from '@/components/map/TemporalMapControls';

// ============================================================================
// Types
// ============================================================================

export type TemporalDataType = 'elections' | 'donations' | 'custom';

export interface ElectionTemporalData {
  type: 'elections';
  years: number[]; // e.g., [2020, 2022, 2024]
  metric: 'demPct' | 'repPct' | 'margin' | 'turnout' | 'ballotsCast';
}

export interface DonorTemporalData {
  type: 'donations';
  startMonth: string; // e.g., "2021-01"
  endMonth: string;   // e.g., "2025-10"
  metric: 'totalAmount' | 'contributionCount' | 'donorCount' | 'avgContribution';
}

export interface CustomTemporalData {
  type: 'custom';
  periods: TimePeriod[];
  dataPoints: TemporalDataPoint[];
}

export type TemporalDataSource = ElectionTemporalData | DonorTemporalData | CustomTemporalData;

export interface UseTemporalMapOptions {
  dataSource: TemporalDataSource;
  defaultMode?: TemporalVisualizationMode;
  defaultSpeed?: number;
  autoPlay?: boolean;
}

export interface UseTemporalMapReturn {
  // State
  isTemporalMode: boolean;
  config: TemporalMapConfig;
  currentPeriod: TimePeriod | null;
  currentData: TemporalDataPoint[];
  comparisonData: TemporalDataPoint[];
  momentumData: Map<string, { change: number; changePercent: number; momentum: string }>;

  // Actions
  enableTemporalMode: () => void;
  disableTemporalMode: () => void;
  toggleTemporalMode: () => void;
  setMode: (mode: TemporalVisualizationMode) => void;
  setCurrentPeriod: (index: number) => void;
  play: () => void;
  pause: () => void;
  stepForward: () => void;
  stepBackward: () => void;
  goToStart: () => void;
  goToEnd: () => void;
  setSpeed: (speed: number) => void;
  setMomentumComparison: (period: MomentumConfig['comparisonPeriod']) => void;
  setComparisonPeriods: (periods: string[]) => void;
  updateConfig: (config: Partial<TemporalMapConfig>) => void;

  // Utilities
  getDataForPeriod: (periodKey: string) => TemporalDataPoint[];
  hasTemporalData: boolean;
  availableYears: number[];
  availableMonths: string[];
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_MOMENTUM_CONFIG: MomentumConfig = {
  comparisonPeriod: 'prior_year',
  colorScale: 'diverging',
  thresholds: {
    strongDecline: -20,
    decline: -5,
    growth: 5,
    strongGrowth: 20,
  },
};

// ============================================================================
// Hook Implementation
// ============================================================================

export function useTemporalMap(options: UseTemporalMapOptions): UseTemporalMapReturn {
  const { dataSource, defaultMode = 'slider', defaultSpeed = 1000, autoPlay = false } = options;

  // Track if temporal mode is enabled
  const [isTemporalMode, setIsTemporalMode] = useState(false);

  // Animation ref
  const animationRef = useRef<NodeJS.Timeout | null>(null);

  // Generate time periods based on data source
  const timePeriods = useMemo(() => {
    if (dataSource.type === 'elections') {
      return dataSource.years.map((year) => ({
        key: year.toString(),
        label: year.toString(),
        startDate: new Date(year, 0, 1),
        endDate: new Date(year, 11, 31),
        isElection: true,
        electionType: 'general' as const,
      }));
    }

    if (dataSource.type === 'donations') {
      const [startYear, startMonth] = dataSource.startMonth.split('-').map(Number);
      const [endYear, endMonth] = dataSource.endMonth.split('-').map(Number);
      return generateTimePeriods(
        new Date(startYear, startMonth - 1, 1),
        new Date(endYear, endMonth - 1, 28)
      );
    }

    if (dataSource.type === 'custom') {
      return dataSource.periods;
    }

    return [];
  }, [dataSource]);

  // Main configuration state
  const [config, setConfig] = useState<TemporalMapConfig>(() => ({
    mode: defaultMode,
    timePeriods,
    currentPeriodIndex: timePeriods.length > 0 ? timePeriods.length - 1 : 0, // Start at most recent
    comparisonPeriods: [],
    animationSpeed: defaultSpeed,
    isPlaying: autoPlay,
    momentumConfig: DEFAULT_MOMENTUM_CONFIG,
  }));

  // Update config when timePeriods change
  useEffect(() => {
    setConfig((prev) => ({
      ...prev,
      timePeriods,
      currentPeriodIndex: Math.min(prev.currentPeriodIndex, timePeriods.length - 1),
    }));
  }, [timePeriods]);

  // Current period
  const currentPeriod = useMemo(() => {
    return config.timePeriods[config.currentPeriodIndex] || null;
  }, [config.timePeriods, config.currentPeriodIndex]);

  // Placeholder for data - in real implementation, this would fetch/filter data
  const [dataCache, setDataCache] = useState<Map<string, TemporalDataPoint[]>>(new Map());

  // Get data for current period
  const currentData = useMemo(() => {
    if (!currentPeriod) return [];
    return dataCache.get(currentPeriod.key) || [];
  }, [currentPeriod, dataCache]);

  // Get comparison data for momentum mode
  const comparisonData = useMemo(() => {
    if (!currentPeriod || config.mode !== 'momentum') return [];

    const comparisonKey = calculateComparisonPeriodKey(
      currentPeriod.key,
      config.momentumConfig.comparisonPeriod,
      dataSource.type
    );

    return dataCache.get(comparisonKey) || [];
  }, [currentPeriod, config.mode, config.momentumConfig.comparisonPeriod, dataCache, dataSource.type]);

  // Calculate momentum data
  const momentumData = useMemo(() => {
    if (currentData.length === 0 || comparisonData.length === 0) {
      return new Map();
    }
    return calculateMomentum(currentData, comparisonData);
  }, [currentData, comparisonData]);

  // Animation effect
  useEffect(() => {
    if (config.isPlaying && config.mode === 'animated' && isTemporalMode) {
      animationRef.current = setInterval(() => {
        setConfig((prev: TemporalMapConfig) => ({
          ...prev,
          currentPeriodIndex:
            prev.currentPeriodIndex < prev.timePeriods.length - 1
              ? prev.currentPeriodIndex + 1
              : 0, // Loop back to start
        }));
      }, config.animationSpeed);
    }

    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [config.isPlaying, config.mode, config.animationSpeed, isTemporalMode]);

  // Actions
  const enableTemporalMode = useCallback(() => setIsTemporalMode(true), []);
  const disableTemporalMode = useCallback(() => {
    setIsTemporalMode(false);
    setConfig((prev: TemporalMapConfig) => ({ ...prev, isPlaying: false }));
  }, []);
  const toggleTemporalMode = useCallback(() => {
    setIsTemporalMode((prev: boolean) => !prev);
  }, []);

  const setMode = useCallback((mode: TemporalVisualizationMode) => {
    setConfig((prev: TemporalMapConfig) => ({ ...prev, mode, isPlaying: false }));
  }, []);

  const setCurrentPeriod = useCallback((index: number) => {
    setConfig((prev: TemporalMapConfig) => ({
      ...prev,
      currentPeriodIndex: Math.max(0, Math.min(index, prev.timePeriods.length - 1)),
      isPlaying: false,
    }));
  }, []);

  const play = useCallback(() => {
    setConfig((prev: TemporalMapConfig) => ({ ...prev, isPlaying: true }));
  }, []);

  const pause = useCallback(() => {
    setConfig((prev: TemporalMapConfig) => ({ ...prev, isPlaying: false }));
  }, []);

  const stepForward = useCallback(() => {
    setConfig((prev: TemporalMapConfig) => ({
      ...prev,
      currentPeriodIndex: Math.min(prev.currentPeriodIndex + 1, prev.timePeriods.length - 1),
      isPlaying: false,
    }));
  }, []);

  const stepBackward = useCallback(() => {
    setConfig((prev: TemporalMapConfig) => ({
      ...prev,
      currentPeriodIndex: Math.max(prev.currentPeriodIndex - 1, 0),
      isPlaying: false,
    }));
  }, []);

  const goToStart = useCallback(() => {
    setConfig((prev: TemporalMapConfig) => ({ ...prev, currentPeriodIndex: 0, isPlaying: false }));
  }, []);

  const goToEnd = useCallback(() => {
    setConfig((prev: TemporalMapConfig) => ({
      ...prev,
      currentPeriodIndex: prev.timePeriods.length - 1,
      isPlaying: false,
    }));
  }, []);

  const setSpeed = useCallback((speed: number) => {
    setConfig((prev: TemporalMapConfig) => ({ ...prev, animationSpeed: speed }));
  }, []);

  const setMomentumComparison = useCallback((period: MomentumConfig['comparisonPeriod']) => {
    setConfig((prev: TemporalMapConfig) => ({
      ...prev,
      momentumConfig: { ...prev.momentumConfig, comparisonPeriod: period },
    }));
  }, []);

  const setComparisonPeriods = useCallback((periods: string[]) => {
    setConfig((prev: TemporalMapConfig) => ({
      ...prev,
      comparisonPeriods: periods.slice(0, 4), // Max 4 comparison periods
    }));
  }, []);

  const updateConfig = useCallback((partial: Partial<TemporalMapConfig>) => {
    setConfig((prev: TemporalMapConfig) => ({ ...prev, ...partial }));
  }, []);

  const getDataForPeriod = useCallback((periodKey: string): TemporalDataPoint[] => {
    return dataCache.get(periodKey) || [];
  }, [dataCache]);

  // Utilities
  const hasTemporalData = timePeriods.length > 1;

  const availableYears = useMemo(() => {
    if (dataSource.type === 'elections') {
      return dataSource.years;
    }
    const years = new Set(timePeriods.map((p) => parseInt(p.key.substring(0, 4))));
    return Array.from(years).sort();
  }, [dataSource, timePeriods]);

  const availableMonths = useMemo(() => {
    if (dataSource.type === 'donations') {
      return timePeriods.map((p) => p.key);
    }
    return [];
  }, [dataSource, timePeriods]);

  return {
    // State
    isTemporalMode,
    config,
    currentPeriod,
    currentData,
    comparisonData,
    momentumData,

    // Actions
    enableTemporalMode,
    disableTemporalMode,
    toggleTemporalMode,
    setMode,
    setCurrentPeriod,
    play,
    pause,
    stepForward,
    stepBackward,
    goToStart,
    goToEnd,
    setSpeed,
    setMomentumComparison,
    setComparisonPeriods,
    updateConfig,

    // Utilities
    getDataForPeriod,
    hasTemporalData,
    availableYears,
    availableMonths,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

function calculateComparisonPeriodKey(
  currentKey: string,
  comparisonType: MomentumConfig['comparisonPeriod'],
  dataType: TemporalDataType
): string {
  if (dataType === 'elections') {
    // For elections, always compare to prior election
    const year = parseInt(currentKey);
    return (year - 2).toString(); // Elections are every 2 years
  }

  // For monthly data
  const [year, month] = currentKey.split('-').map(Number);
  const currentDate = new Date(year, month - 1);

  switch (comparisonType) {
    case 'prior_month':
      currentDate.setMonth(currentDate.getMonth() - 1);
      break;
    case 'prior_quarter':
      currentDate.setMonth(currentDate.getMonth() - 3);
      break;
    case 'prior_year':
      currentDate.setFullYear(currentDate.getFullYear() - 1);
      break;
    case 'same_month_prior_year':
      currentDate.setFullYear(currentDate.getFullYear() - 1);
      break;
  }

  return `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
}

export default useTemporalMap;
