/**
 * Performance Tab Component - Advanced Analysis Optimization
 * 
 * This tab provides comprehensive performance optimization controls for large-scale analysis:
 * 
 * ## DATA SAMPLING
 * - Reduces processing time for large datasets (>10K records)
 * - Three strategies: Random, Systematic, and Stratified sampling
 * - Maintains statistical significance while improving speed
 * - Configurable sample sizes from 100 to 50K records
 * 
 * ## CACHING & STORAGE  
 * - Dramatically improves performance for repeated queries
 * - Configurable TTL from 5 minutes to 24 hours
 * - Enables offline analysis and reduces API calls
 * - Recommended: 1 hour for most workflows
 * 
 * ## TIMEOUT CONTROLS
 * - Prevents hung requests and improves user experience
 * - Configurable from 30 seconds to 10 minutes
 * - Balances responsiveness vs. complex analysis completion
 * - Recommended: 2 minutes for most analysis
 * 
 * ## QUALITY CONTROLS
 * - Filters out low-confidence data points
 * - Ensures reliable results by setting minimum quality thresholds
 * - Considers data completeness, spatial coverage, and analysis confidence
 * - Recommended: 85% minimum quality threshold
 * 
 * **Impact**: These optimizations can reduce analysis time from minutes to seconds
 * while maintaining accuracy for business decision-making.
 */

import React, { useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { 
  Zap,
  Database,
  Clock,
  ShieldCheck,
  Settings,
  RotateCcw,
  Info,
  AlertTriangle,
  TrendingUp,
  Filter,
  Timer,
  HardDrive
} from 'lucide-react';

import { FilterTabProps, PerformanceConfig } from '../types';

// ============================================================================
// SAMPLING STRATEGY DEFINITIONS
// ============================================================================

interface SamplingStrategy {
  id: 'random' | 'systematic' | 'stratified';
  name: string;
  description: string;
  icon: React.ComponentType<{className?: string}>;
  bestFor: string;
  minSampleSize: number;
  maxSampleSize: number;
}

const SAMPLING_STRATEGIES: SamplingStrategy[] = [
  {
    id: 'random',
    name: 'Random Sampling',
    description: 'Randomly select records from the entire dataset',
    icon: Filter,
    bestFor: 'General analysis with uniform data distribution',
    minSampleSize: 100,
    maxSampleSize: 50000,
  },
  {
    id: 'systematic',
    name: 'Systematic Sampling',
    description: 'Select every nth record for consistent coverage',
    icon: TrendingUp,
    bestFor: 'Time-series or ordered data analysis',
    minSampleSize: 500,
    maxSampleSize: 25000,
  },
  {
    id: 'stratified',
    name: 'Stratified Sampling',
    description: 'Proportional sampling across different categories',
    icon: Database,
    bestFor: 'Maintaining representation across demographic groups',
    minSampleSize: 1000,
    maxSampleSize: 30000,
  },
];

// ============================================================================
// CACHE TTL PRESETS
// ============================================================================

interface CacheTTLPreset {
  value: number;
  label: string;
  description: string;
  bestFor: string;
}

const CACHE_TTL_PRESETS: CacheTTLPreset[] = [
  {
    value: 5,
    label: '5 minutes',
    description: 'Very short cache for rapidly changing data',
    bestFor: 'Real-time analysis or frequently updated datasets',
  },
  {
    value: 30,
    label: '30 minutes',
    description: 'Short cache for dynamic workflows',
    bestFor: 'Interactive exploration and iterative analysis',
  },
  {
    value: 60,
    label: '1 hour',
    description: 'Standard cache duration (recommended)',
    bestFor: 'Most analysis workflows and general usage',
  },
  {
    value: 240,
    label: '4 hours',
    description: 'Extended cache for stable data',
    bestFor: 'Production reports and scheduled analysis',
  },
  {
    value: 1440,
    label: '24 hours',
    description: 'Long-term cache for static datasets',
    bestFor: 'Historical data and reference datasets',
  },
];

// ============================================================================
// TIMEOUT PRESETS
// ============================================================================

interface TimeoutPreset {
  value: number;
  label: string;
  description: string;
  bestFor: string;
}

const TIMEOUT_PRESETS: TimeoutPreset[] = [
  {
    value: 30,
    label: '30 seconds',
    description: 'Fast timeout for quick queries',
    bestFor: 'Simple analysis on small datasets',
  },
  {
    value: 60,
    label: '1 minute',
    description: 'Standard timeout for most queries',
    bestFor: 'General analysis workflows',
  },
  {
    value: 120,
    label: '2 minutes',
    description: 'Extended timeout (recommended)',
    bestFor: 'Complex analysis and larger datasets',
  },
  {
    value: 300,
    label: '5 minutes',
    description: 'Long timeout for complex operations',
    bestFor: 'Multi-endpoint analysis and heavy computation',
  },
  {
    value: 600,
    label: '10 minutes',
    description: 'Maximum timeout for large-scale analysis',
    bestFor: 'Comprehensive analysis on very large datasets',
  },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PerformanceTab({
  config,
  onConfigChange,
  availableFields,
  endpoint,
}: FilterTabProps) {
  
  // This project uses a custom accordion that only allows one item open at a time
  // So we don't need to manage multiple selected items

  // Handle performance config changes
  const handlePerformanceChange = useCallback((changes: Partial<PerformanceConfig>) => {
    onConfigChange({
      ...config,
      performance: {
        ...config.performance,
        ...changes,
      },
    });
  }, [config, onConfigChange]);

  // Reset performance config to defaults
  const handleReset = useCallback(() => {
    const defaultConfig: PerformanceConfig = {
      sampling: {
        enabled: false,
        maxSampleSize: 10000,
        strategy: 'random',
      },
      caching: {
        enabled: true,
        ttlMinutes: 60,
      },
      timeout: {
        enabled: true,
        seconds: 120,
      },
      quality: {
        enabled: true,
        threshold: 0.85,
      },
    };

    handlePerformanceChange(defaultConfig);
  }, [handlePerformanceChange]);

  // Calculate active optimizations count
  const activeOptimizations = useMemo(() => {
    let count = 0;
    if (config.performance.sampling.enabled) count++;
    if (!config.performance.caching.enabled || config.performance.caching.ttlMinutes !== 60) count++;
    if (!config.performance.timeout.enabled || config.performance.timeout.seconds !== 120) count++;
    if (!config.performance.quality.enabled || config.performance.quality.threshold !== 0.85) count++;
    return count;
  }, [config.performance]);

  // Get current sampling strategy details
  const currentSamplingStrategy = SAMPLING_STRATEGIES.find(s => s.id === config.performance.sampling.strategy);

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Header with stats and controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            <span className="font-medium">Performance Options</span>
            {activeOptimizations > 0 && (
              <Badge variant="secondary">
                {activeOptimizations} active optimization{activeOptimizations !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="text-xs"
          disabled={activeOptimizations === 0}
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          Reset
        </Button>
      </div>

      <Separator />

      {/* Performance Options */}
      <div className="flex-1 overflow-y-auto">
        <Accordion className="space-y-2">
          
          {/* Data Sampling Section */}
          <AccordionItem value="sampling">
            <AccordionTrigger className="py-3">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                <span>Data Sampling</span>
                {config.performance.sampling.enabled && (
                  <Badge variant="secondary" className="text-xs">
                    {config.performance.sampling.maxSampleSize.toLocaleString()} max
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="sampling-enabled" className="text-sm font-medium">
                    Enable Data Sampling
                  </Label>
                  <Switch
                    id="sampling-enabled"
                    checked={config.performance.sampling.enabled}
                    onCheckedChange={(enabled: boolean) =>
                      handlePerformanceChange({
                        sampling: { ...config.performance.sampling, enabled }
                      })
                    }
                  />
                </div>

                {config.performance.sampling.enabled && (
                  <div className="space-y-4 ml-4 border-l-2 border-muted pl-4">
                    {/* Sampling Strategy Selection */}
                    <div className="space-y-3">
                      <Label className="text-sm">Sampling Strategy</Label>
                      <div className="grid grid-cols-1 gap-2">
                        {SAMPLING_STRATEGIES.map((strategy) => {
                          const Icon = strategy.icon;
                          const isSelected = config.performance.sampling.strategy === strategy.id;
                          
                          return (
                            <Card
                              key={strategy.id}
                              className={`cursor-pointer transition-all duration-200 ${
                                isSelected
                                  ? 'ring-2 ring-primary border-primary'
                                  : 'hover:border-primary/50'
                              }`}
                              onClick={() =>
                                handlePerformanceChange({
                                  sampling: { 
                                    ...config.performance.sampling, 
                                    strategy: strategy.id,
                                    maxSampleSize: Math.min(config.performance.sampling.maxSampleSize, strategy.maxSampleSize)
                                  }
                                })
                              }
                            >
                              <CardContent className="p-3">
                                <div className="flex items-start gap-3">
                                  <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-sm">{strategy.name}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {strategy.description}
                                    </p>
                                    <p className="text-xs text-primary mt-1">
                                      Best for: {strategy.bestFor}
                                    </p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>

                    {/* Sample Size Configuration */}
                    {currentSamplingStrategy && (
                      <div className="space-y-2">
                        <Label className="text-sm">Maximum Sample Size</Label>
                        <div className="px-2">
                          <Slider
                            value={config.performance.sampling.maxSampleSize}
                            onValueChange={(value: number[]) =>
                              handlePerformanceChange({
                                sampling: { ...config.performance.sampling, maxSampleSize: value[0] }
                              })
                            }
                            min={currentSamplingStrategy.minSampleSize}
                            max={currentSamplingStrategy.maxSampleSize}
                            step={currentSamplingStrategy.minSampleSize}
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-muted-foreground mt-2">
                            <span>{currentSamplingStrategy.minSampleSize.toLocaleString()}</span>
                            <span className="font-medium">
                              {config.performance.sampling.maxSampleSize.toLocaleString()} records
                            </span>
                            <span>{currentSamplingStrategy.maxSampleSize.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                      <Info className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      <span className="text-sm text-blue-700 dark:text-blue-300">
                        Sampling reduces processing time for large datasets while maintaining statistical significance.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Caching Section */}
          <AccordionItem value="caching">
            <AccordionTrigger className="py-3">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                <span>Caching & Storage</span>
                {config.performance.caching.enabled && (
                  <Badge variant="secondary" className="text-xs">
                    {config.performance.caching.ttlMinutes}m TTL
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="caching-enabled" className="text-sm font-medium">
                    Enable Result Caching
                  </Label>
                  <Switch
                    id="caching-enabled"
                    checked={config.performance.caching.enabled}
                    onCheckedChange={(enabled: boolean) =>
                      handlePerformanceChange({
                        caching: { ...config.performance.caching, enabled }
                      })
                    }
                  />
                </div>

                {config.performance.caching.enabled && (
                  <div className="space-y-4 ml-4 border-l-2 border-muted pl-4">
                    <div className="space-y-3">
                      <Label className="text-sm">Cache Duration (Time to Live)</Label>
                      <div className="grid grid-cols-1 gap-2">
                        {CACHE_TTL_PRESETS.map((preset) => {
                          const isSelected = config.performance.caching.ttlMinutes === preset.value;
                          
                          return (
                            <Card
                              key={preset.value}
                              className={`cursor-pointer transition-all duration-200 ${
                                isSelected
                                  ? 'ring-2 ring-primary border-primary'
                                  : 'hover:border-primary/50'
                              }`}
                              onClick={() =>
                                handlePerformanceChange({
                                  caching: { ...config.performance.caching, ttlMinutes: preset.value }
                                })
                              }
                            >
                              <CardContent className="p-3">
                                <div className="flex items-start gap-3">
                                  <Clock className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-sm">{preset.label}</span>
                                      {preset.value === 60 && (
                                        <Badge variant="outline" className="text-xs">
                                          Recommended
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {preset.description}
                                    </p>
                                    <p className="text-xs text-primary mt-1">
                                      Best for: {preset.bestFor}
                                    </p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                      <Info className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm text-green-700 dark:text-green-300">
                        Caching dramatically improves performance for repeated queries and enables offline analysis.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Timeout Section */}
          <AccordionItem value="timeout">
            <AccordionTrigger className="py-3">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4" />
                <span>Timeout Controls</span>
                {config.performance.timeout.enabled && (
                  <Badge variant="secondary" className="text-xs">
                    {config.performance.timeout.seconds}s max
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="timeout-enabled" className="text-sm font-medium">
                    Enable Request Timeout
                  </Label>
                  <Switch
                    id="timeout-enabled"
                    checked={config.performance.timeout.enabled}
                    onCheckedChange={(enabled: boolean) =>
                      handlePerformanceChange({
                        timeout: { ...config.performance.timeout, enabled }
                      })
                    }
                  />
                </div>

                {config.performance.timeout.enabled && (
                  <div className="space-y-4 ml-4 border-l-2 border-muted pl-4">
                    <div className="space-y-3">
                      <Label className="text-sm">Timeout Duration</Label>
                      <div className="grid grid-cols-1 gap-2">
                        {TIMEOUT_PRESETS.map((preset) => {
                          const isSelected = config.performance.timeout.seconds === preset.value;
                          
                          return (
                            <Card
                              key={preset.value}
                              className={`cursor-pointer transition-all duration-200 ${
                                isSelected
                                  ? 'ring-2 ring-primary border-primary'
                                  : 'hover:border-primary/50'
                              }`}
                              onClick={() =>
                                handlePerformanceChange({
                                  timeout: { ...config.performance.timeout, seconds: preset.value }
                                })
                              }
                            >
                              <CardContent className="p-3">
                                <div className="flex items-start gap-3">
                                  <Timer className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-sm">{preset.label}</span>
                                      {preset.value === 120 && (
                                        <Badge variant="outline" className="text-xs">
                                          Recommended
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {preset.description}
                                    </p>
                                    <p className="text-xs text-primary mt-1">
                                      Best for: {preset.bestFor}
                                    </p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
                      <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                      <span className="text-sm text-yellow-700 dark:text-yellow-300">
                        Shorter timeouts prevent hung requests but may interrupt complex analysis.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Quality Controls Section */}
          <AccordionItem value="quality">
            <AccordionTrigger className="py-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                <span>Quality Controls</span>
                {config.performance.quality.enabled && (
                  <Badge variant="secondary" className="text-xs">
                    {Math.round(config.performance.quality.threshold * 100)}% min
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="quality-enabled" className="text-sm font-medium">
                    Enable Quality Filtering
                  </Label>
                  <Switch
                    id="quality-enabled"
                    checked={config.performance.quality.enabled}
                    onCheckedChange={(enabled: boolean) =>
                      handlePerformanceChange({
                        quality: { ...config.performance.quality, enabled }
                      })
                    }
                  />
                </div>

                {config.performance.quality.enabled && (
                  <div className="space-y-4 ml-4 border-l-2 border-muted pl-4">
                    <div className="space-y-2">
                      <Label className="text-sm">Minimum Data Quality Threshold</Label>
                      <div className="px-2">
                        <Slider
                          value={config.performance.quality.threshold}
                          onValueChange={(value: number[]) =>
                            handlePerformanceChange({
                              quality: { ...config.performance.quality, threshold: value[0] }
                            })
                          }
                          min={0.5}
                          max={1.0}
                          step={0.05}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground mt-2">
                          <span>50% (Permissive)</span>
                          <span className="font-medium">
                            {Math.round(config.performance.quality.threshold * 100)}% Quality Required
                          </span>
                          <span>100% (Strict)</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Quality Indicators</Label>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span>Data Completeness</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span>Spatial Coverage</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                          <span>Analysis Confidence</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                          <span>Result Validity</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
                      <ShieldCheck className="h-4 w-4 text-purple-500 flex-shrink-0" />
                      <span className="text-sm text-purple-700 dark:text-purple-300">
                        Quality filtering ensures reliable results by excluding low-confidence data points.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

        </Accordion>
      </div>

      {/* Performance Summary */}
      {activeOptimizations > 0 && (
        <div className="border-t pt-4">
          <Card className="bg-muted/20">
            <CardHeader className="py-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings className="h-3 w-3" />
                Active Performance Optimizations
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <div className="flex flex-wrap gap-1">
                {config.performance.sampling.enabled && (
                  <Badge variant="secondary" className="text-xs">
                    Sampling: {config.performance.sampling.strategy} ({config.performance.sampling.maxSampleSize.toLocaleString()})
                  </Badge>
                )}
                {(!config.performance.caching.enabled || config.performance.caching.ttlMinutes !== 60) && (
                  <Badge variant="secondary" className="text-xs">
                    Cache: {config.performance.caching.enabled ? `${config.performance.caching.ttlMinutes}m TTL` : 'Disabled'}
                  </Badge>
                )}
                {(!config.performance.timeout.enabled || config.performance.timeout.seconds !== 120) && (
                  <Badge variant="secondary" className="text-xs">
                    Timeout: {config.performance.timeout.enabled ? `${config.performance.timeout.seconds}s` : 'Unlimited'}
                  </Badge>
                )}
                {(!config.performance.quality.enabled || config.performance.quality.threshold !== 0.85) && (
                  <Badge variant="secondary" className="text-xs">
                    Quality: {config.performance.quality.enabled ? `${Math.round(config.performance.quality.threshold * 100)}% min` : 'Disabled'}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}