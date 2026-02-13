'use client';

/**
 * Temporal Map Controls
 *
 * Provides time-series visualization modes for map layers:
 * 1. Animated Playback - Watch changes over time
 * 2. Time Slider - Explore specific moments
 * 3. Momentum Heatmap - Show rate of change
 * 4. Small Multiples - Compare periods side-by-side
 *
 * Used when a dataset has time-series compatible data (date field + numeric values).
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Clock,
  TrendingUp,
  Grid3X3,
  Layers,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Gauge,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_MOMENTUM_CONFIG: MomentumConfig = {
  comparisonPeriod: 'prior_month',
  colorScale: 'diverging',
  thresholds: {
    strongDecline: -20,
    decline: -5,
    growth: 5,
    strongGrowth: 20,
  },
};

// Michigan election markers
const ELECTION_MARKERS: Record<string, { type: 'primary' | 'general' | 'special'; label: string }> = {
  '2024-08': { type: 'primary', label: 'MI Primary' },
  '2024-11': { type: 'general', label: 'General Election' },
  '2025-05': { type: 'special', label: 'Local Elections' },
  '2026-08': { type: 'primary', label: 'MI Primary' },
  '2026-11': { type: 'general', label: 'Midterms' },
};

// ============================================================================
// Component
// ============================================================================

export function TemporalMapControls({
  config,
  onConfigChange,
  onPeriodChange,
  onMomentumDataRequest,
  className,
}: TemporalMapControlsProps) {
  const animationRef = useRef<NodeJS.Timeout | null>(null);

  // Current period helper
  const currentPeriod = config.timePeriods[config.currentPeriodIndex];

  // Animation control
  useEffect(() => {
    if (config.isPlaying && config.mode === 'animated') {
      animationRef.current = setInterval(() => {
        onConfigChange({
          ...config,
          currentPeriodIndex:
            config.currentPeriodIndex < config.timePeriods.length - 1
              ? config.currentPeriodIndex + 1
              : 0, // Loop back to start
        });
      }, config.animationSpeed);
    }

    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
    };
  }, [config.isPlaying, config.mode, config.animationSpeed, config.currentPeriodIndex]);

  // Notify parent of period change
  useEffect(() => {
    if (currentPeriod) {
      onPeriodChange(currentPeriod);
    }
  }, [config.currentPeriodIndex]);

  // Mode change handler
  const handleModeChange = (mode: TemporalVisualizationMode) => {
    onConfigChange({
      ...config,
      mode,
      isPlaying: false, // Stop animation when switching modes
    });
  };

  // Playback controls
  const togglePlayback = () => {
    onConfigChange({ ...config, isPlaying: !config.isPlaying });
  };

  const stepBackward = () => {
    onConfigChange({
      ...config,
      currentPeriodIndex: Math.max(0, config.currentPeriodIndex - 1),
      isPlaying: false,
    });
  };

  const stepForward = () => {
    onConfigChange({
      ...config,
      currentPeriodIndex: Math.min(
        config.timePeriods.length - 1,
        config.currentPeriodIndex + 1
      ),
      isPlaying: false,
    });
  };

  const goToStart = () => {
    onConfigChange({ ...config, currentPeriodIndex: 0, isPlaying: false });
  };

  const goToEnd = () => {
    onConfigChange({
      ...config,
      currentPeriodIndex: config.timePeriods.length - 1,
      isPlaying: false,
    });
  };

  // Slider change handler
  const handleSliderChange = (value: number[]) => {
    onConfigChange({
      ...config,
      currentPeriodIndex: value[0],
      isPlaying: false,
    });
  };

  // Speed change handler
  const handleSpeedChange = (speed: string) => {
    onConfigChange({
      ...config,
      animationSpeed: parseInt(speed),
    });
  };

  // Momentum comparison period handler
  const handleMomentumPeriodChange = (period: MomentumConfig['comparisonPeriod']) => {
    const newMomentumConfig = { ...config.momentumConfig, comparisonPeriod: period };
    onConfigChange({ ...config, momentumConfig: newMomentumConfig });

    // Calculate comparison period key and request data
    if (currentPeriod) {
      const comparisonKey = calculateComparisonPeriod(currentPeriod.key, period);
      onMomentumDataRequest(currentPeriod.key, comparisonKey);
    }
  };

  // Comparison period selection handler
  const handleComparisonSelect = (periodKey: string) => {
    const currentComparisons = config.comparisonPeriods || [];
    const isSelected = currentComparisons.includes(periodKey);

    let newComparisons: string[];
    if (isSelected) {
      newComparisons = currentComparisons.filter((p) => p !== periodKey);
    } else if (currentComparisons.length < 4) {
      newComparisons = [...currentComparisons, periodKey];
    } else {
      return; // Max 4 comparisons
    }

    onConfigChange({ ...config, comparisonPeriods: newComparisons });
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Time-Series Visualization
          </CardTitle>
          {currentPeriod?.isElection && (
            <Badge variant="destructive" className="text-xs">
              {currentPeriod.electionType === 'general' ? 'Election' : 'Primary'}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Mode Selection */}
        <Tabs value={config.mode} onValueChange={(v) => handleModeChange(v as TemporalVisualizationMode)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="animated" className="text-xs px-2">
              <Play className="h-3 w-3 mr-1" />
              Animate
            </TabsTrigger>
            <TabsTrigger value="slider" className="text-xs px-2">
              <Calendar className="h-3 w-3 mr-1" />
              Slider
            </TabsTrigger>
            <TabsTrigger value="momentum" className="text-xs px-2">
              <Gauge className="h-3 w-3 mr-1" />
              Momentum
            </TabsTrigger>
            <TabsTrigger value="comparison" className="text-xs px-2">
              <Grid3X3 className="h-3 w-3 mr-1" />
              Compare
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Current Period Display */}
        <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
          <span className="text-sm font-medium">{currentPeriod?.label || 'No data'}</span>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {config.currentPeriodIndex + 1} / {config.timePeriods.length}
            </span>
          </div>
        </div>

        {/* Mode-specific controls */}
        {config.mode === 'animated' && (
          <AnimatedModeControls
            config={config}
            onTogglePlayback={togglePlayback}
            onStepBackward={stepBackward}
            onStepForward={stepForward}
            onGoToStart={goToStart}
            onGoToEnd={goToEnd}
            onSpeedChange={handleSpeedChange}
          />
        )}

        {config.mode === 'slider' && (
          <SliderModeControls
            config={config}
            onSliderChange={handleSliderChange}
            onStepBackward={stepBackward}
            onStepForward={stepForward}
          />
        )}

        {config.mode === 'momentum' && (
          <MomentumModeControls
            config={config}
            onPeriodChange={handleMomentumPeriodChange}
          />
        )}

        {config.mode === 'comparison' && (
          <ComparisonModeControls
            config={config}
            onComparisonSelect={handleComparisonSelect}
          />
        )}

        {/* Timeline with election markers */}
        <TimelineBar
          periods={config.timePeriods}
          currentIndex={config.currentPeriodIndex}
          onPeriodClick={(index) =>
            onConfigChange({ ...config, currentPeriodIndex: index, isPlaying: false })
          }
        />
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface AnimatedModeControlsProps {
  config: TemporalMapConfig;
  onTogglePlayback: () => void;
  onStepBackward: () => void;
  onStepForward: () => void;
  onGoToStart: () => void;
  onGoToEnd: () => void;
  onSpeedChange: (speed: string) => void;
}

function AnimatedModeControls({
  config,
  onTogglePlayback,
  onStepBackward,
  onStepForward,
  onGoToStart,
  onGoToEnd,
  onSpeedChange,
}: AnimatedModeControlsProps) {
  return (
    <div className="space-y-3">
      {/* Playback buttons */}
      <div className="flex items-center justify-center gap-1">
        <Button variant="outline" size="icon" onClick={onGoToStart}>
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={onStepBackward}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant={config.isPlaying ? 'destructive' : 'default'}
          size="icon"
          onClick={onTogglePlayback}
        >
          {config.isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
        <Button variant="outline" size="icon" onClick={onStepForward}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={onGoToEnd}>
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>

      {/* Speed control */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Speed:</span>
        <Select value={config.animationSpeed.toString()} onValueChange={onSpeedChange}>
          <SelectTrigger className="w-24 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2000">Slow</SelectItem>
            <SelectItem value="1000">Normal</SelectItem>
            <SelectItem value="500">Fast</SelectItem>
            <SelectItem value="250">Very Fast</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

interface SliderModeControlsProps {
  config: TemporalMapConfig;
  onSliderChange: (value: number[]) => void;
  onStepBackward: () => void;
  onStepForward: () => void;
}

function SliderModeControls({
  config,
  onSliderChange,
  onStepBackward,
  onStepForward,
}: SliderModeControlsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={onStepBackward}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Slider
          value={[config.currentPeriodIndex]}
          min={0}
          max={config.timePeriods.length - 1}
          step={1}
          onValueChange={onSliderChange}
          className="flex-1"
        />
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={onStepForward}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Period quick-select buttons */}
      <div className="flex flex-wrap gap-1">
        {config.timePeriods
          .filter((p) => p.isElection)
          .map((period, idx) => (
            <Button
              key={period.key}
              variant="outline"
              size="sm"
              className="text-xs h-6 px-2"
              onClick={() =>
                onSliderChange([config.timePeriods.findIndex((p) => p.key === period.key)])
              }
            >
              {period.label}
            </Button>
          ))}
      </div>
    </div>
  );
}

interface MomentumModeControlsProps {
  config: TemporalMapConfig;
  onPeriodChange: (period: MomentumConfig['comparisonPeriod']) => void;
}

function MomentumModeControls({ config, onPeriodChange }: MomentumModeControlsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Compare to:</span>
        <Select
          value={config.momentumConfig.comparisonPeriod}
          onValueChange={(v) => onPeriodChange(v as MomentumConfig['comparisonPeriod'])}
        >
          <SelectTrigger className="flex-1 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="prior_month">Prior Month</SelectItem>
            <SelectItem value="prior_quarter">Prior Quarter</SelectItem>
            <SelectItem value="prior_year">Prior Year</SelectItem>
            <SelectItem value="same_month_prior_year">Same Month Last Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Color legend */}
      <div className="p-2 bg-muted rounded-lg">
        <p className="text-xs font-medium mb-2">Momentum Legend</p>
        <div className="flex items-center gap-1 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 bg-red-500 rounded" />
            <span>Declining</span>
          </div>
          <div className="flex items-center gap-1 ml-2">
            <div className="w-4 h-3 bg-gray-300 rounded" />
            <span>Stable</span>
          </div>
          <div className="flex items-center gap-1 ml-2">
            <div className="w-4 h-3 bg-green-500 rounded" />
            <span>Growing</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Shows % change from comparison period. Darker = stronger change.
        </p>
      </div>
    </div>
  );
}

interface ComparisonModeControlsProps {
  config: TemporalMapConfig;
  onComparisonSelect: (periodKey: string) => void;
}

function ComparisonModeControls({ config, onComparisonSelect }: ComparisonModeControlsProps) {
  const selectedPeriods = config.comparisonPeriods || [];

  // Group periods by year for easier selection
  const periodsByYear = config.timePeriods.reduce((acc, period) => {
    const year = period.key.substring(0, 4);
    if (!acc[year]) acc[year] = [];
    acc[year].push(period);
    return acc;
  }, {} as Record<string, TimePeriod[]>);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Select 2-4 periods to compare side-by-side ({selectedPeriods.length}/4 selected)
      </p>

      <div className="max-h-32 overflow-y-auto space-y-2">
        {Object.entries(periodsByYear).map(([year, periods]) => (
          <div key={year}>
            <p className="text-xs font-medium text-muted-foreground mb-1">{year}</p>
            <div className="flex flex-wrap gap-1">
              {periods.map((period) => {
                const isSelected = selectedPeriods.includes(period.key);
                return (
                  <Button
                    key={period.key}
                    variant={isSelected ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs h-6 px-2"
                    onClick={() => onComparisonSelect(period.key)}
                    disabled={!isSelected && selectedPeriods.length >= 4}
                  >
                    {period.label.replace(` ${year}`, '')}
                    {period.isElection && ' *'}
                  </Button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {selectedPeriods.length >= 2 && (
        <p className="text-xs text-green-600">
          Showing {selectedPeriods.length} periods in small multiples view
        </p>
      )}
    </div>
  );
}

interface TimelineBarProps {
  periods: TimePeriod[];
  currentIndex: number;
  onPeriodClick: (index: number) => void;
}

function TimelineBar({ periods, currentIndex, onPeriodClick }: TimelineBarProps) {
  if (periods.length === 0) return null;

  return (
    <div className="relative">
      {/* Timeline track */}
      <div className="h-2 bg-muted rounded-full relative">
        {/* Progress indicator */}
        <div
          className="absolute h-full bg-blue-500 rounded-full transition-all"
          style={{ width: `${((currentIndex + 1) / periods.length) * 100}%` }}
        />

        {/* Election markers */}
        {periods.map((period, idx) => {
          if (!period.isElection) return null;
          const position = (idx / (periods.length - 1)) * 100;
          return (
            <div
              key={period.key}
              className="absolute top-0 w-1 h-2 bg-red-500 rounded"
              style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
              title={`${period.label} (${period.electionType})`}
            />
          );
        })}
      </div>

      {/* Period labels (show first, current, last) */}
      <div className="flex justify-between mt-1 text-xs text-muted-foreground">
        <span>{periods[0]?.label}</span>
        <span className="font-medium text-foreground">{periods[currentIndex]?.label}</span>
        <span>{periods[periods.length - 1]?.label}</span>
      </div>
    </div>
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

function calculateComparisonPeriod(
  currentKey: string,
  comparisonType: MomentumConfig['comparisonPeriod']
): string {
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

/**
 * Generate time periods from a date range
 */
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

export default TemporalMapControls;
