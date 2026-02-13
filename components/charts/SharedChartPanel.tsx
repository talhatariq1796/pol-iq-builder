/**
 * SharedChartPanel
 *
 * Container component for displaying AI-recommended charts.
 * Supports multiple chart types with consistent styling, controls, and animations.
 */

'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import * as Recharts from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

// Extract components - some have type issues in recharts 2.15
// This pattern is used throughout the codebase (see DonorTimeSeriesChart.tsx)
const {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} = Recharts as Record<string, React.ComponentType<any>>;
import { X, BarChart3, Download, Maximize2, Minimize2 } from 'lucide-react';
import type {
  SharedChartPanelProps,
  ChartConfig,
  ChartDataPoint,
  HistogramBin,
} from './types';
import { chartDataService } from './ChartDataService';
import { ChartTooltip } from './ChartTooltip';
import { ChartLegend } from './ChartLegend';
import {
  PARTISAN_COLORS,
  SEQUENTIAL_COLORS,
  CATEGORICAL_COLORS,
  getPartisanColor,
} from './types';
import {
  ChartSkeleton,
  AnimatedNumber,
  getRechartsAnimationProps,
  ANIMATION_DURATIONS,
  panelVariants,
  contentVariants,
} from './ChartAnimations';

// ============================================================================
// Color Utilities
// ============================================================================

function getColorArray(scheme: ChartConfig['colorScheme'], count: number): string[] {
  switch (scheme) {
    case 'partisan':
      return [PARTISAN_COLORS.leanD, PARTISAN_COLORS.tossUp, PARTISAN_COLORS.leanR];
    case 'blue':
      return SEQUENTIAL_COLORS.blue.slice(1);
    case 'green':
      return SEQUENTIAL_COLORS.green.slice(1);
    case 'orange':
      return SEQUENTIAL_COLORS.orange.slice(1);
    case 'purple':
      return SEQUENTIAL_COLORS.purple.slice(1);
    case 'categorical':
    default:
      return [...CATEGORICAL_COLORS];
  }
}

function getBarColor(value: number, config: ChartConfig): string {
  if (config.metric === 'partisan_lean' || config.colorScheme === 'partisan') {
    return getPartisanColor(value);
  }

  const colors = getColorArray(config.colorScheme, 5);
  return colors[2] || colors[0];
}

// ============================================================================
// SharedChartPanel Component
// ============================================================================

export function SharedChartPanel({
  visible = true,
  defaultCollapsed = false,
  position = 'right',
  config,
  data: propData,
  onClose,
  onDataPointClick,
  onHighlightPrecincts,
  className = '',
}: SharedChartPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isExpanded, setIsExpanded] = useState(false);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [histogramData, setHistogramData] = useState<HistogramBin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Calculate summary stats for animated numbers
  const summaryStats = useMemo(() => {
    if (chartData.length === 0) return null;
    const values = chartData.map(d => d.value);
    return {
      total: values.reduce((a, b) => a + b, 0),
      average: values.reduce((a, b) => a + b, 0) / values.length,
      max: Math.max(...values),
      min: Math.min(...values),
      count: chartData.length,
    };
  }, [chartData]);

  // Load chart data when config changes
  useEffect(() => {
    if (!config) {
      setChartData([]);
      setHistogramData([]);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        if (config.type === 'histogram') {
          const data = await chartDataService.getHistogramData(config);
          setHistogramData(data);
          setChartData([]);
        } else {
          const data = await chartDataService.getChartData(config);
          setChartData(data);
          setHistogramData([]);
        }
      } catch (err) {
        console.error('[SharedChartPanel] Error loading data:', err);
        setError('Failed to load chart data');
      } finally {
        setLoading(false);
      }
    };

    if (propData) {
      setChartData(propData);
    } else {
      loadData();
    }
  }, [config, propData]);

  // Handle data point click
  const handleClick = useCallback(
    (dataPoint: ChartDataPoint) => {
      if (onDataPointClick) {
        onDataPointClick(dataPoint);
      }

      // Highlight precincts if available
      if (onHighlightPrecincts && dataPoint.rawData) {
        const precinctNames = dataPoint.rawData.items as string[] | undefined;
        if (precinctNames) {
          onHighlightPrecincts(precinctNames);
        } else {
          onHighlightPrecincts([dataPoint.name]);
        }
      }
    },
    [onDataPointClick, onHighlightPrecincts]
  );

  // Handle bar click in histogram
  const handleHistogramClick = useCallback(
    (bin: HistogramBin) => {
      if (onHighlightPrecincts && bin.items) {
        onHighlightPrecincts(bin.items);
      }
    },
    [onHighlightPrecincts]
  );

  // Export chart data to CSV
  const handleExport = useCallback(() => {
    if (chartData.length === 0 && histogramData.length === 0) return;

    let csv = '';
    if (config?.type === 'histogram') {
      csv = 'Bin Start,Bin End,Count,Percentage\n';
      csv += histogramData
        .map(bin => `${bin.x0.toFixed(2)},${bin.x1.toFixed(2)},${bin.count},${bin.percentage.toFixed(1)}`)
        .join('\n');
    } else {
      csv = 'Name,Value\n';
      csv += chartData.map(d => `"${d.name}",${d.value}`).join('\n');
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config?.title?.replace(/\s+/g, '_') || 'chart'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [chartData, histogramData, config]);

  if (!visible || !config) return null;

  const panelWidth = isExpanded ? 'w-[600px]' : 'w-[400px]';
  const chartHeight = isExpanded ? 500 : 300;
  const animate = config.animate !== false;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={config.title || 'chart-panel'}
        variants={panelVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className={`
          fixed ${position === 'right' ? 'right-4' : position === 'left' ? 'left-4' : 'bottom-4'}
          ${position === 'bottom' ? 'left-1/2 -translate-x-1/2' : 'top-20'}
          ${isCollapsed ? 'w-12' : panelWidth}
          bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700
          z-50 ${className}
        `}
        layout
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: loading ? 360 : 0 }}
              transition={{ duration: 1, repeat: loading ? Infinity : 0, ease: 'linear' }}
            >
              <BarChart3 className="w-4 h-4 text-blue-500" />
            </motion.div>
            <AnimatePresence mode="wait">
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="font-medium text-sm truncate max-w-[250px]"
                >
                  {config.title || 'Chart'}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-1">
            <AnimatePresence>
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-1"
                >
                  <motion.button
                    onClick={handleExport}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                    title="Export CSV"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Download className="w-4 h-4" />
                  </motion.button>
                  <motion.button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                    title={isExpanded ? 'Minimize' : 'Expand'}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
            <motion.button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              title={isCollapsed ? 'Expand' : 'Collapse'}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              {isCollapsed ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
            </motion.button>
            {onClose && (
              <motion.button
                onClick={onClose}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-gray-500"
                title="Close"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <X className="w-4 h-4" />
              </motion.button>
            )}
          </div>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.div
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="p-3"
            >
              {/* Subtitle */}
              {config.subtitle && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-gray-500 dark:text-gray-400 mb-2"
                >
                  {config.subtitle}
                </motion.p>
              )}

              {/* Summary Stats with Animated Numbers */}
              {summaryStats && !loading && !error && config.showSummary !== false && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex gap-4 mb-3 text-xs"
                >
                  <div className="flex flex-col">
                    <span className="text-gray-500 dark:text-gray-400">Count</span>
                    <AnimatedNumber
                      value={summaryStats.count}
                      className="font-semibold text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-500 dark:text-gray-400">Avg</span>
                    <AnimatedNumber
                      value={summaryStats.average}
                      format={(v) => v.toFixed(1)}
                      className="font-semibold text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-500 dark:text-gray-400">Range</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      <AnimatedNumber value={summaryStats.min} format={(v) => v.toFixed(0)} />
                      {' - '}
                      <AnimatedNumber value={summaryStats.max} format={(v) => v.toFixed(0)} />
                    </span>
                  </div>
                </motion.div>
              )}

              {/* Loading State with Skeleton */}
              {loading && (
                <ChartSkeleton
                  type={getSkeletonType(config.type)}
                  height={chartHeight}
                />
              )}

              {/* Error State */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center justify-center text-red-500 text-sm"
                  style={{ height: chartHeight }}
                >
                  {error}
                </motion.div>
              )}

              {/* Chart Content with Type Transition */}
              <AnimatePresence mode="wait">
                {!loading && !error && (
                  <motion.div
                    key={config.type}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    style={{ height: chartHeight }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      {renderChart(
                        config,
                        chartData,
                        histogramData,
                        handleClick,
                        handleHistogramClick,
                        animate,
                        hoveredIndex,
                        setHoveredIndex
                      )}
                    </ResponsiveContainer>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Legend */}
              {config.showLegend && !loading && !error && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <ChartLegend config={config} data={chartData} />
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function getSkeletonType(chartType: ChartConfig['type']): 'bar' | 'line' | 'pie' | 'area' | 'scatter' {
  switch (chartType) {
    case 'bar':
    case 'horizontalBar':
    case 'histogram':
    case 'grouped':
    case 'stacked':
      return 'bar';
    case 'line':
      return 'line';
    case 'area':
      return 'area';
    case 'scatter':
      return 'scatter';
    case 'pie':
    case 'donut':
      return 'pie';
    default:
      return 'bar';
  }
}

// ============================================================================
// Chart Renderers with Animations
// ============================================================================

function renderChart(
  config: ChartConfig,
  data: ChartDataPoint[],
  histogramData: HistogramBin[],
  onClick: (d: ChartDataPoint) => void,
  onHistogramClick: (bin: HistogramBin) => void,
  animate: boolean,
  hoveredIndex: number | null,
  setHoveredIndex: (index: number | null) => void
): React.ReactElement {
  const colors = getColorArray(config.colorScheme, 10);
  const animProps = getRechartsAnimationProps(animate, ANIMATION_DURATIONS.chart);

  switch (config.type) {
    case 'horizontalBar':
      return (
        <BarChart data={data} layout="vertical" margin={{ left: 100, right: 20, top: 10, bottom: 10 }}>
          {config.showGrid && <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />}
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={95} />
          <ChartTooltip config={config} />
          <Bar
            dataKey="value"
            onClick={(entry: unknown) => onClick(entry as ChartDataPoint)}
            onMouseEnter={(_: unknown, index: number) => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            cursor="pointer"
            {...animProps}
          >
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={getBarColor(entry.value, config)}
                opacity={hoveredIndex === null || hoveredIndex === index ? 1 : 0.5}
                style={{
                  filter: hoveredIndex === index ? 'brightness(1.1)' : undefined,
                  transition: 'opacity 0.2s, filter 0.2s',
                }}
              />
            ))}
          </Bar>
        </BarChart>
      );

    case 'bar':
    case 'histogram':
      const barData = config.type === 'histogram'
        ? histogramData.map(bin => ({
            name: `${bin.x0.toFixed(0)}-${bin.x1.toFixed(0)}`,
            value: bin.count,
            bin,
          }))
        : data;

      return (
        <BarChart data={barData} margin={{ left: 20, right: 20, top: 10, bottom: 30 }}>
          {config.showGrid && <CartesianGrid strokeDasharray="3 3" />}
          <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 11 }} />
          <ChartTooltip config={config} />
          <Bar
            dataKey="value"
            fill={colors[2]}
            onClick={(entry: unknown) => {
              const typedEntry = entry as { bin?: HistogramBin };
              if (typedEntry.bin) {
                onHistogramClick(typedEntry.bin);
              } else {
                onClick(entry as ChartDataPoint);
              }
            }}
            onMouseEnter={(_: unknown, index: number) => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            cursor="pointer"
            {...animProps}
          >
            {barData.map((entry, index) => (
              <Cell
                key={index}
                fill={colors[index % colors.length]}
                opacity={hoveredIndex === null || hoveredIndex === index ? 1 : 0.5}
                style={{
                  filter: hoveredIndex === index ? 'brightness(1.1)' : undefined,
                  transition: 'opacity 0.2s, filter 0.2s',
                }}
              />
            ))}
          </Bar>
        </BarChart>
      );

    case 'line':
      return (
        <LineChart data={data} margin={{ left: 20, right: 20, top: 10, bottom: 30 }}>
          {config.showGrid && <CartesianGrid strokeDasharray="3 3" />}
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <ChartTooltip config={config} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={colors[0]}
            strokeWidth={2}
            dot={config.showMarkers !== false ? {
              r: 4,
              strokeWidth: 2,
              fill: 'white',
            } : false}
            activeDot={{
              r: 6,
              strokeWidth: 2,
              fill: colors[0],
              stroke: 'white',
            }}
            {...animProps}
          />
          {config.showLegend && <Legend />}
        </LineChart>
      );

    case 'area':
      return (
        <AreaChart data={data} margin={{ left: 20, right: 20, top: 10, bottom: 30 }}>
          {config.showGrid && <CartesianGrid strokeDasharray="3 3" />}
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <ChartTooltip config={config} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={colors[0]}
            fill={colors[0]}
            fillOpacity={0.3}
            {...animProps}
          />
          {config.showLegend && <Legend />}
        </AreaChart>
      );

    case 'scatter':
      return (
        <ScatterChart margin={{ left: 20, right: 20, top: 10, bottom: 30 }}>
          {config.showGrid && <CartesianGrid strokeDasharray="3 3" />}
          <XAxis
            dataKey="value"
            type="number"
            name={config.metric}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            dataKey="secondaryValue"
            type="number"
            name={config.secondaryMetric || ''}
            tick={{ fontSize: 11 }}
          />
          <ChartTooltip config={config} />
          <Scatter
            data={data}
            fill={colors[0]}
            onClick={(entry: unknown) => onClick(entry as ChartDataPoint)}
            cursor="pointer"
            {...animProps}
          >
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={entry.colorValue !== undefined ? getPartisanColor(entry.colorValue) : colors[0]}
                opacity={hoveredIndex === null || hoveredIndex === index ? 1 : 0.6}
                style={{
                  transform: hoveredIndex === index ? 'scale(1.3)' : 'scale(1)',
                  transformOrigin: 'center',
                  transition: 'transform 0.2s, opacity 0.2s',
                }}
              />
            ))}
          </Scatter>
        </ScatterChart>
      );

    case 'pie':
    case 'donut':
      return (
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={config.type === 'donut' ? '40%' : 0}
            outerRadius="70%"
            label={({ name, percent }: { name: string; percent: number }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            labelLine={true}
            onClick={(entry: unknown) => onClick(entry as ChartDataPoint)}
            onMouseEnter={(_: unknown, index: number) => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            cursor="pointer"
            paddingAngle={2}
            {...animProps}
          >
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={colors[index % colors.length]}
                opacity={hoveredIndex === null || hoveredIndex === index ? 1 : 0.6}
                style={{
                  transform: hoveredIndex === index ? 'scale(1.05)' : 'scale(1)',
                  transformOrigin: 'center',
                  transition: 'transform 0.2s ease-out, opacity 0.2s',
                }}
              />
            ))}
          </Pie>
          <ChartTooltip config={config} />
          {config.showLegend && <Legend />}
        </PieChart>
      );

    case 'grouped':
    case 'stacked':
      const categories = [...new Set(data.map(d => d.category).filter(Boolean))];
      const groups = [...new Set(data.map(d => d.name))];

      // Transform data for grouped/stacked charts
      const transformedData = groups.map(group => {
        const groupData: Record<string, string | number> = { name: group };
        categories.forEach(cat => {
          const item = data.find(d => d.name === group && d.category === cat);
          groupData[cat as string] = item?.value || 0;
        });
        return groupData;
      });

      return (
        <BarChart data={transformedData} margin={{ left: 20, right: 20, top: 10, bottom: 30 }}>
          {config.showGrid && <CartesianGrid strokeDasharray="3 3" />}
          <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 11 }} />
          <ChartTooltip config={config} />
          {categories.map((cat, i) => (
            <Bar
              key={cat}
              dataKey={cat as string}
              fill={colors[i % colors.length]}
              stackId={config.type === 'stacked' ? 'stack' : undefined}
              {...animProps}
              animationBegin={i * 100}
            />
          ))}
          {config.showLegend && <Legend />}
        </BarChart>
      );

    default:
      return (
        <BarChart data={data}>
          <Bar dataKey="value" fill={colors[0]} {...animProps} />
        </BarChart>
      );
  }
}

export default SharedChartPanel;
