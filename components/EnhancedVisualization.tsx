/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle, Info, TrendingUp, TrendingDown, BarChart3, PieChart, Activity, LineChart as LineChartIcon, BarChart2, Filter as FilterIcon, Save } from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  Bar,
  Line,
  Pie,
  Cell,
  Area as RechartsArea
} from 'recharts';

// Dynamic imports for all potentially problematic chart components to avoid type conflicts
const recharts = require('recharts') as any;
const ComposedChart = recharts.ComposedChart as React.ComponentType<any>;
const BarChart = recharts.BarChart as React.ComponentType<any>;
const LineChart = recharts.LineChart as React.ComponentType<any>;
const PieChartRecharts = recharts.PieChart as React.ComponentType<any>;
const RechartsPieChart = PieChartRecharts;
const ScatterChart = recharts.ScatterChart as React.ComponentType<any>;
const AreaChart = recharts.AreaChart as React.ComponentType<any>;
const RadarChart = recharts.RadarChart as React.ComponentType<any>;
const FunnelChart = recharts.FunnelChart as React.ComponentType<any>;
const Scatter = recharts.Scatter;
const PolarGrid = recharts.PolarGrid;
const PolarAngleAxis = recharts.PolarAngleAxis;
const PolarRadiusAxis = recharts.PolarRadiusAxis;
const Radar = recharts.Radar;
const Funnel = recharts.Funnel;
const LabelList = recharts.LabelList;
const Treemap = recharts.Treemap;
import { motion, AnimatePresence } from 'framer-motion';

// Use AnalysisEngine types instead of deleted AILayerManager
import { AnalysisState } from '@/lib/analysis/types';
import { useAnalysisEngine } from '@/lib/analysis';

// Type definitions
type VisualizationType = 'timeseries' | 'comparison' | 'geospatial';
type ChartType = 'line' | 'bar' | 'area' | 'composed' | 'scatter';
type AggregationMethod = 'sum' | 'average' | 'max' | 'min';

interface MetricConfig {
  name: string;
  value?: number;
  unit?: string;
  color?: string;
  format?: (value: number) => string;
  trend?: {
    direction: 'up' | 'down';
    value: number;
  };
}

// Type aliases for backward compatibility
interface FilterConfig {
  field: string;
  operator: string;
  value: any;
  type?: 'range' | 'select' | 'text';
  label?: string;
  min?: number;
  max?: number;
  options?: string[];
  enabled?: boolean;
}

interface FilterState {
  active: boolean;
  filters: FilterConfig[];
}

// Simple Typography component for compatibility
const Typography: React.FC<{
  variant?: string;
  className?: string;
  children: React.ReactNode;
}> = ({ className, children }) => (
  <span className={className}>{children}</span>
);

// Base Data Types
interface BaseDataPoint {
  metadata?: Record<string, any>;
  confidence?: number;
  category?: string;
}

interface TimeSeriesDataPoint extends BaseDataPoint {
  timestamp: string | Date;
  value: number;
}

interface ProcessedTimeSeriesDataPoint extends TimeSeriesDataPoint {
  formattedDate: string;
  confidenceRange?: {
    upper: number;
    lower: number;
  };
}

interface ComparisonDataPoint extends BaseDataPoint {
  category: string;
  values: Record<string, number>;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    percentage: number;
  };
}

// Type Guards
function isTimeSeriesData(data: any[]): data is TimeSeriesDataPoint[] {
  return data.length === 0 || (data.every(item => 
    'timestamp' in item && 
    'value' in item && 
    !('values' in item)
  ));
}

function isComparisonData(data: any[]): data is ComparisonDataPoint[] {
  return data.length === 0 || (data.every(item => 
    'category' in item && 
    'values' in item && 
    !('timestamp' in item)
  ));
}

// Filter Analytics
interface FilterAnalytics {
  appliedCount: number;
  lastApplied: Date;
  impactMetrics: {
    dataReduction: number;
    significantChanges: {
      metric: string;
      changePct: number;
    }[];
  };
}

// Filter Preset
interface FilterPreset {
  id: string;
  name: string;
  description?: string;
  filters: FilterState;
  metadata: {
    created: Date;
    lastUsed?: Date;
    useCount: number;
    tags?: string[];
  };
}

// Map Synchronization
interface MapSyncConfig {
  enabled: boolean;
  syncBounds?: boolean;
  syncSelection?: boolean;
  syncFilters?: boolean;
  view?: __esri.MapView;
  layerIds?: string[];
}

// Filter Options
interface FilterOptions {
  enableFiltering?: boolean;
  initialFilters?: FilterState;
  onFilterChange?: (filters: FilterState) => void;
  filterConfigs?: FilterConfig[];
  persistence?: {
    enabled: boolean;
    storageKey?: string;
  };
  presets?: {
    enabled: boolean;
    initialPresets?: FilterPreset[];
    onPresetChange?: (preset: FilterPreset) => void;
  };
  analytics?: {
    enabled: boolean;
    onAnalyticsUpdate?: (analytics: FilterAnalytics) => void;
  };
  mapSync?: MapSyncConfig;
}

// Component Props
interface EnhancedVisualizationProps {
  data: TimeSeriesDataPoint[] | ComparisonDataPoint[];
  type: VisualizationType;
  title: string;
  metrics: MetricConfig[];
  options?: {
    showTrends?: boolean;
    defaultAggregation?: AggregationMethod;
    defaultVisualization?: ChartType;
    enableInteractions?: boolean;
    showConfidence?: boolean;
    animate?: boolean;
    timeFormat?: string;
    customTooltip?: React.FC<any>;
    opacity?: number;
    blendMode?: GlobalCompositeOperation;
    showInteractions?: boolean;
    showAnimations?: boolean;
  };
  filterOptions?: FilterOptions;
  onDataPointClick?: (data: any, index: number) => void;
  layer?: any;
}

// Constants
const DEFAULT_COLORS = [
  '#33a852', '#4285f4', '#fbbc05', '#ea4335', '#34a853', '#5f6368'
];

const STORAGE_VERSION = '1.0.0';

// Helper Functions
const aggregateData = (
  data: number[], 
  method: AggregationMethod = 'average'
): number => {
  if (data.length === 0) return 0;
  switch (method) {
    case 'sum': return data.reduce((a, b) => a + b, 0);
    case 'average': return data.reduce((a, b) => a + b, 0) / data.length;
    case 'max': return Math.max(...data);
    case 'min': return Math.min(...data);
    default: return data.reduce((a, b) => a + b, 0) / data.length;
  }
};

export const EnhancedVisualization: React.FC<EnhancedVisualizationProps> = ({
  data,
  type,
  title,
  metrics,
  options = {},
  filterOptions = {},
  onDataPointClick,
  layer
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<any>(null);

  // State Management
  const [visualization, setVisualization] = useState<ChartType>(
    options.defaultVisualization || 'line'
  );
  const [aggregationMethod, setAggregationMethod] = useState<AggregationMethod>(
    options.defaultAggregation || 'average'
  );
  const [activeFilters, setActiveFilters] = useState<FilterState>(
    filterOptions.initialFilters || { active: false, filters: [] }
  );
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filterAnalytics, setFilterAnalytics] = useState<FilterAnalytics>({
    appliedCount: 0,
    lastApplied: new Date(),
    impactMetrics: {
      dataReduction: 0,
      significantChanges: []
    }
  });
  const [presets, setPresets] = useState<FilterPreset[]>(
    filterOptions.presets?.initialPresets || []
  );
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [showPresetDialog, setShowPresetDialog] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDescription, setNewPresetDescription] = useState('');

  // Refs for cleanup and optimization
  const previousDataRef = useRef<typeof data>();
  const mapSyncTimeoutRef = useRef<number>();

  // Build filter expression with proper typing
  const buildFilterExpression = useCallback((filters: FilterState): string => {
    if (!filterOptions.filterConfigs) return '1=1';

    const expressions: string[] = [];
    Object.entries(filters.filters || {}).forEach(([field, filter]) => {
      if (!filter.enabled) return;

      const config = filterOptions.filterConfigs?.find(c => c.field === field);
      if (!config || !config.type) return;

      switch (config.type) {
        case 'range': {
          const [min, max] = filter.value as [number, number];
          expressions.push(`${field} >= ${min} AND ${field} <= ${max}`);
          break;
        }
        case 'select': {
          expressions.push(`${field} = '${filter.value}'`);
          break;
        }
        case 'text': {
          expressions.push(
            `${field} LIKE '%${(filter.value as string).replace(/'/g, "''")}%'`
          );
          break;
        }
      }
    });

    return expressions.length > 0 ? expressions.join(' AND ') : '1=1';
  }, [filterOptions.filterConfigs]);

  // Filter data with proper type handling
  const filteredData = useMemo(() => {
    if (!filterOptions.enableFiltering || Object.keys(activeFilters).length === 0) {
      return data;
    }

    const getFieldValue = (item: TimeSeriesDataPoint | ComparisonDataPoint, field: string): any => {
      if ('values' in item) {
        return item.values[field];
      }
      if ('value' in item && field === 'value') {
        return item.value;
      }
      return (item as any)[field];
    };

    return data.filter((item) => {
      return Object.entries(activeFilters).every(([field, filter]) => {
        if (!filter.enabled) return true;
        const value = getFieldValue(item, field);

        const config = filterOptions.filterConfigs?.find(c => c.field === field);
        if (!config) return true;

        switch (config.type) {
          case 'range': {
            const [min, max] = filter.value as [number, number];
            return value >= min && value <= max;
          }
          case 'select':
            return value === filter.value;
          case 'text':
            return value?.toString().toLowerCase().includes(
              (filter.value as string).toLowerCase()
            );
          default:
            return true;
        }
      });
    });
  }, [data, activeFilters, filterOptions.enableFiltering, filterOptions.filterConfigs]);

  // Process data for visualization with proper typing
  const processedData = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return [];
  
    switch (type) {
      case 'timeseries': {
        if (!isTimeSeriesData(filteredData)) return [];
        return filteredData.map(item => ({
          ...item,
          formattedDate: new Date(item.timestamp).toLocaleDateString()
        }));
      }
      case 'comparison': {
        if (!isComparisonData(filteredData)) return [];
        return filteredData;
      }
      default:
        return [];
    }
  }, [filteredData, type]);

  // Calculate metric averages for analytics
  const calculateMetricAverage = useCallback((
    dataSet: (TimeSeriesDataPoint | ComparisonDataPoint)[],
    metric: MetricConfig
  ): number => {
    if (dataSet.length === 0) return 0;
  
    const values = dataSet.map(item => {
      if ('values' in item) {
        return item.values[metric.name];
      }
      if ('value' in item) {
        return item.value;
      }
      return 0;
    });
  
    return values.reduce((a, b) => a + b, 0) / values.length;
  }, []);

  // Calculate trends with proper typing
  const trends = useMemo(() => {
    if (!options.showTrends || !processedData.length) return null;
  
    switch (type) {
      case 'timeseries': {
        if (!isTimeSeriesData(processedData)) return null;
        const firstValue = processedData[0].value;
        const lastValue = processedData[processedData.length - 1].value;
        const change = ((lastValue - firstValue) / firstValue) * 100;
  
        return {
          direction: change >= 0 ? 'up' : 'down',
          percentage: Math.abs(change),
          difference: Math.abs(lastValue - firstValue)
        };
      }
      case 'comparison': {
        if (!isComparisonData(processedData)) return null;
        return processedData
          .map(item => item.trend)
          .filter(Boolean);
      }
      default:
        return null;
    }
  }, [processedData, options.showTrends, type]);

  // Effect Hooks
  // Initialize filter persistence
  useEffect(() => {
    if (!filterOptions.persistence?.enabled) return;

    const storageKey = filterOptions.persistence.storageKey || 'enhancedVisualizationFilters';
    const savedFilters = localStorage.getItem(storageKey);
    
    if (savedFilters) {
      try {
        const parsed = JSON.parse(savedFilters);
        if (parsed.version === STORAGE_VERSION) {
          setActiveFilters(parsed.filters);
        }
      } catch (error) {
        console.error('Error loading saved filters:', error);
      }
    }
  }, [filterOptions.persistence]);

  // Map synchronization
  useEffect(() => {
    if (!filterOptions.mapSync?.enabled || !filterOptions.mapSync.view) return;

    const syncFiltersToMap = () => {
      if (!filterOptions.mapSync?.view || !filterOptions.mapSync.layerIds) return;

      const view = filterOptions.mapSync.view;
      const definitionExpression = buildFilterExpression(activeFilters);

      filterOptions.mapSync.layerIds.forEach(layerId => {
        const layer = view.map.findLayerById(layerId) as __esri.FeatureLayer;
        if (layer) {
          layer.definitionExpression = definitionExpression;
        }
      });
    };

    const timeoutId = window.setTimeout(syncFiltersToMap, 250);
    mapSyncTimeoutRef.current = timeoutId;

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [activeFilters, filterOptions.mapSync, buildFilterExpression]);

  // Analytics tracking
  useEffect(() => {
    if (!filterOptions.analytics?.enabled) return;

    const calculateAnalytics = () => {
      const totalDataPoints = data.length;
      const currentFilteredPoints = filteredData.length;
      const dataReduction = ((totalDataPoints - currentFilteredPoints) / totalDataPoints) * 100;

      const significantChanges = metrics.map(metric => {
        const originalAvg = calculateMetricAverage(data, metric);
        const filteredAvg = calculateMetricAverage(filteredData, metric);
        const changePct = ((filteredAvg - originalAvg) / originalAvg) * 100;

        return {
          metric: metric.name,
          changePct
        };
      }).filter(change => Math.abs(change.changePct) > 10);

      const newAnalytics: FilterAnalytics = {
        appliedCount: filterAnalytics.appliedCount + 1,
        lastApplied: new Date(),
        impactMetrics: {
          dataReduction,
          significantChanges
        }
      };

      setFilterAnalytics(newAnalytics);
      filterOptions.analytics?.onAnalyticsUpdate?.(newAnalytics);
    };

    if (previousDataRef.current !== data) {
      calculateAnalytics();
      previousDataRef.current = data;
    }
  }, [
    data, 
    filteredData, 
    metrics, 
    filterOptions.analytics, 
    calculateMetricAverage, 
    filterAnalytics.appliedCount
  ]);

  // Filter Handlers
  const saveFilters = useCallback(() => {
    if (!filterOptions.persistence?.enabled) return;

    const storageKey = filterOptions.persistence.storageKey || 'enhancedVisualizationFilters';
    const filterData = {
      version: STORAGE_VERSION,
      filters: activeFilters,
      timestamp: new Date().toISOString()
    };

    try {
      localStorage.setItem(storageKey, JSON.stringify(filterData));
    } catch (error) {
      console.error('Error saving filters:', error);
    }
  }, [activeFilters, filterOptions.persistence]);

  // Preset Management
  const saveAsPreset = useCallback(() => {
    if (!filterOptions.presets?.enabled || !newPresetName) return;

    const newPreset: FilterPreset = {
      id: crypto.randomUUID(),
      name: newPresetName,
      description: newPresetDescription,
      filters: activeFilters,
      metadata: {
        created: new Date(),
        useCount: 0,
        tags: []
      }
    };

    setPresets((prev: FilterPreset[]) => [...prev, newPreset]);
    filterOptions.presets?.onPresetChange?.(newPreset);
    setShowPresetDialog(false);
    setNewPresetName('');
    setNewPresetDescription('');
  }, [
    newPresetName,
    newPresetDescription,
    activeFilters,
    filterOptions.presets
  ]);

  const applyPreset = useCallback((presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (!preset) return;

    setActiveFilters(preset.filters);
    setActivePresetId(presetId);

    const updatedPresets = presets.map(p => 
      p.id === presetId
        ? {
            ...p,
            metadata: {
              ...p.metadata,
              lastUsed: new Date(),
              useCount: p.metadata.useCount + 1
            }
          }
        : p
    );

    setPresets(updatedPresets);
    filterOptions.presets?.onPresetChange?.(preset);
  }, [presets, filterOptions.presets]);

  // Filter Change Handler
  const handleFilterChange = useCallback((
    field: string,
    value: unknown,
    enabled: boolean
  ) => {
    const newFilters = {
      ...activeFilters,
      [field]: { value, enabled }
    };
  
    setActiveFilters(newFilters);
    filterOptions.onFilterChange?.(newFilters);
    saveFilters();
  
    if (activePresetId) {
      setActivePresetId(null);
    }
  }, [
    activeFilters,
    filterOptions,  // Add filterOptions to dependencies
    saveFilters,
    activePresetId
  ]);

  const clearFilters = useCallback(() => {
    const emptyFilterState: FilterState = { active: false, filters: [] };
    setActiveFilters(emptyFilterState);
    filterOptions.onFilterChange?.(emptyFilterState);
    setActivePresetId(null);
    saveFilters();
  }, [filterOptions.onFilterChange, saveFilters]);

  // Validation function for filter values
  const validateFilterValue = useCallback((
    config: FilterConfig,
    value: unknown
  ): boolean => {
    switch (config.type) {
      case 'range': {
        if (!Array.isArray(value)) return false;
        const [min, max] = value as number[];
        return (
          typeof min === 'number' &&
          typeof max === 'number' &&
          min <= max &&
          (!config.min || min >= config.min) &&
          (!config.max || max <= config.max)
        );
      }
      case 'select':
        return config.options?.includes(value as string) ?? false;
      case 'text':
        return typeof value === 'string';
      default:
        return false;
    }
  }, []);

  // Safe filter application with validation
  const safelyApplyFilter = useCallback((
    field: string,
    value: unknown,
    enabled: boolean
  ) => {
    const config = filterOptions.filterConfigs?.find(c => c.field === field);
    if (!config) return;
  
    if (validateFilterValue(config, value)) {
      handleFilterChange(field, value, enabled);
    } else {
      console.warn(`Invalid filter value for field ${field}:`, value);
    }
  }, [filterOptions, handleFilterChange, validateFilterValue]);

  // Utility function for default filter values
  const getDefaultValueForConfig = useCallback((config: FilterConfig): unknown => {
    switch (config.type) {
      case 'range':
        return [config.min ?? 0, config.max ?? 100];
      case 'select':
        return config.options?.[0] ?? '';
      case 'text':
        return '';
      default:
        return null;
    }
  }, []);

  // Render Methods
  const renderVisualizationSelector = () => (
    <Select
      value={visualization}
      onValueChange={(value: string) => setVisualization(value as ChartType)}
    >
      <SelectTrigger className="w-40">
        <SelectValue placeholder="Select visualization" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="line">
          <div className="flex items-center gap-2">
            <LineChartIcon className="h-4 w-4" />
            <span>Line Chart</span>
          </div>
        </SelectItem>
        <SelectItem value="bar">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4" />
            <span>Bar Chart</span>
          </div>
        </SelectItem>
        <SelectItem value="area">
          <div className="flex items-center gap-2">
            <LineChartIcon className="h-4 w-4" />
            <span>Area Chart</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );

  // Render Preset Dialog
  const renderPresetDialog = () => (
    <Dialog open={showPresetDialog} onOpenChange={setShowPresetDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Typography variant="h6" className="flex items-center gap-2">
              <Save className="h-5 w-5" />
              Save Filter Preset
            </Typography>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="preset-name">Preset Name</Label>
            <Input
              id="preset-name"
              value={newPresetName}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewPresetName(e.target.value)}
              placeholder="Enter preset name..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="preset-description">Description</Label>
            <Input
              id="preset-description"
              value={newPresetDescription}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewPresetDescription(e.target.value)}
              placeholder="Enter description..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowPresetDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveAsPreset} disabled={!newPresetName}>
              Save Preset
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  // Chart Rendering Methods
  const renderTimeSeriesChart = () => {
    const typedData = processedData as ProcessedTimeSeriesDataPoint[];
    const ChartComponent = visualization === 'composed' ? ComposedChart : 
                         visualization === 'bar' ? BarChart : LineChart;

    return (
      <ResponsiveContainer width="100%" height={400}>
        <ChartComponent 
          data={typedData}
          onClick={options.enableInteractions ? onDataPointClick : undefined}
          {...(options.animate ? { animationDuration: 300 } : {})}
        >
          <XAxis 
            dataKey="formattedDate" 
            tick={{ fontSize: 12 }}
            interval="preserveStartEnd"
          />
          <YAxis tick={{ fontSize: 12 }} />
          {options.customTooltip ? (
            <RechartsTooltip content={options.customTooltip} />
          ) : (
            <RechartsTooltip
              formatter={(value: number, name: string) => {
                const metric = metrics.find(m => m.name === name);
                return [metric?.format?.(value) ?? value, name];
              }}
            />
          )}
          <Legend />
          {metrics.map((metric: MetricConfig) => {
            const props = {
              key: metric.name,
              dataKey: "value",
              name: metric.name,
              stroke: metric.color ?? DEFAULT_COLORS[metrics.indexOf(metric) % DEFAULT_COLORS.length],
              fill: metric.color ?? DEFAULT_COLORS[metrics.indexOf(metric) % DEFAULT_COLORS.length],
              strokeWidth: 2,
            };

            if (options.showConfidence) {
              return (
                <React.Fragment key={metric.name}>
                  {visualization === 'area' && (
                    <RechartsArea
                      {...props}
                      fillOpacity={0.1}
                    />
                  )}
                  <Line
                    {...props}
                    dot={false}
                  />
                  {typedData[0]?.confidenceRange && (
                    <>
                      <RechartsArea
                        {...props}
                        dataKey="confidenceRange.upper"
                        strokeDasharray="3 3"
                        strokeWidth={1}
                        fillOpacity={0.1}
                      />
                      <RechartsArea
                        {...props}
                        dataKey="confidenceRange.lower"
                        strokeDasharray="3 3"
                        strokeWidth={1}
                        fillOpacity={0.1}
                      />
                    </>
                  )}
                </React.Fragment>
              );
            }

            switch (visualization) {
              case 'area':
                return <RechartsArea {...props} />;
              case 'bar':
                return <Bar {...props} />;
              default:
                return <Line {...props} dot={false} />;
            }
          })}
        </ChartComponent>
      </ResponsiveContainer>
    );
  };

  const renderComparisonChart = () => {
    const typedData = processedData as ComparisonDataPoint[];
    
    return (
      <ResponsiveContainer width="100%" height={400}>
        <BarChart 
          data={typedData}
          onClick={options.enableInteractions ? onDataPointClick : undefined}
          {...(options.animate ? { animationDuration: 300 } : {})}
        >
          <XAxis 
            dataKey="category" 
            tick={{ fontSize: 12 }}
            interval={0}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis tick={{ fontSize: 12 }} />
          {options.customTooltip ? (
            <RechartsTooltip content={options.customTooltip} />
          ) : (
            <RechartsTooltip
              formatter={(value: number, name: string) => {
                const metric = metrics.find(m => m.name === name);
                return [metric?.format?.(value) ?? value, name];
              }}
            />
          )}
          <Legend />
          {metrics.map((metric: MetricConfig) => (
            <Bar
              key={metric.name}
              dataKey={`values.${metric.name}`}
              name={metric.name}
              fill={metric.color ?? DEFAULT_COLORS[metrics.indexOf(metric) % DEFAULT_COLORS.length]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderGeospatialChart = () => {
    const typedData = processedData as ComparisonDataPoint[];
    
    return (
      <ResponsiveContainer width="100%" height={400}>
        <BarChart 
          data={typedData}
          onClick={options.enableInteractions ? onDataPointClick : undefined}
          {...(options.animate ? { animationDuration: 300 } : {})}
        >
          <XAxis 
            dataKey="category" 
            tick={{ fontSize: 12 }}
            interval={0}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis tick={{ fontSize: 12 }} />
          {options.customTooltip ? (
            <RechartsTooltip content={options.customTooltip} />
          ) : (
            <RechartsTooltip
              formatter={(value: number, name: string) => {
                const metric = metrics.find(m => m.name === name);
                return [metric?.format?.(value) ?? value, name];
              }}
            />
          )}
          <Legend />
          {metrics.map((metric: MetricConfig) => (
            <Bar
              key={metric.name}
              dataKey={`values.${metric.name}`}
              name={metric.name}
              fill={metric.color ?? DEFAULT_COLORS[metrics.indexOf(metric) % DEFAULT_COLORS.length]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderTrendIndicator = () => {
    if (!trends || type !== 'timeseries') return null;

    const trend = trends as {
      direction: 'up' | 'down';
      percentage: number;
      difference: number;
    };

    return (
      <div className="flex items-center gap-2">
        <Typography variant="body2" className="text-gray-500">
          {trend.direction === 'up' ? '↑' : '↓'} {trend.percentage.toFixed(1)}%
        </Typography>
      </div>
    );
  };

  // Filter Panel
  const renderFilterPanel = () => {
    if (!filterOptions.enableFiltering) return null;

    return (
      <div className="p-4 border rounded-lg bg-white shadow-sm">
        <Typography variant="body2" className="text-gray-700">
          Filter Options
        </Typography>
        {filterOptions.filterConfigs?.map((config, index) => (
          <div key={index} className="mt-4">
            <Typography variant="body2" className="text-gray-600">
              {config.label}
            </Typography>
            {/* ... rest of the filter panel ... */}
          </div>
        ))}
      </div>
    );
  };

  const renderMetricCard = (metric: MetricConfig) => (
    <Card className="p-4">
      <CardHeader>
        <CardTitle>
          <Typography variant="h6" className="text-gray-900">
            {metric.name}
          </Typography>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Typography variant="body2" className="text-gray-700">
          {metric.value} {metric.unit}
        </Typography>
        {metric.trend && (
          <Typography variant="body2" className="text-gray-500">
            {metric.trend.direction === 'up' ? '↑' : '↓'} {metric.trend.value}%
          </Typography>
        )}
      </CardContent>
    </Card>
  );

  const renderMetricValue = (metric: MetricConfig) => (
    <div className="flex items-center gap-2">
      <Typography variant="body2" className="text-gray-700">
        {metric.value} {metric.unit}
      </Typography>
      {metric.trend && (
        <Typography variant="body2" className="text-gray-500">
          {metric.trend.direction === 'up' ? '↑' : '↓'} {metric.trend.value}%
        </Typography>
      )}
    </div>
  );

  // Main render
  if (!data || data.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          No data available for visualization
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[300px]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Visualization Container */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="w-full h-full"
      >
        {type === 'timeseries' && renderTimeSeriesChart()}
        {type === 'comparison' && renderComparisonChart()}
      </motion.div>

      {/* Filter Panel */}
      {filterOptions.enableFiltering && (
        <div className="absolute top-4 right-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className="flex items-center gap-2"
          >
            <FilterIcon className="h-4 w-4" />
            <Typography variant="body2" className="text-gray-700">
              Filters
            </Typography>
          </Button>
        </div>
      )}

      {/* Hover Info */}
      <AnimatePresence>
        {isHovered && selectedFeature && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-4 left-4 right-4"
          >
            <Card className="p-4 bg-white/90 backdrop-blur-sm">
              <Typography variant="body2">
                {selectedFeature.attributes?.name || 'Selected Feature'}
              </Typography>
              {metrics && (
                <div className="mt-2 space-y-1">
                  {metrics.map((metric: MetricConfig) => (
                    <div key={metric.name} className="flex items-center justify-between">
                      <span className="text-gray-600">{metric.name}:</span>
                      <span className="font-medium">
                        {renderMetricValue(metric)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading State */}
      {!layer && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 flex items-center justify-center bg-gray-50"
        >
          <Typography variant="body2" className="text-gray-500">
            Loading visualization...
          </Typography>
        </motion.div>
      )}

      {showFilterPanel && (
        <div className="w-1/4">
          {renderFilterPanel()}
        </div>
      )}

      {renderPresetDialog()}
    </div>
  );
};

// Type exports
export type {
  TimeSeriesDataPoint,
  ComparisonDataPoint,
  MetricConfig,
  FilterOptions,
  FilterAnalytics,
  FilterPreset,
  MapSyncConfig,
  EnhancedVisualizationProps,
  VisualizationType,
  ChartType,
  AggregationMethod
};