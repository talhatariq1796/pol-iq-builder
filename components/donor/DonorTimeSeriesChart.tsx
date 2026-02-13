'use client';

/**
 * Donor Time Series Chart
 *
 * Visualizes contribution trends over time with:
 * - Monthly totals by party
 * - Year-over-year comparison
 * - Election cycle markers
 * - Seasonal patterns
 * - Simple forecasting projection
 */

import React, { useState, useMemo } from 'react';
import * as Recharts from 'recharts';

// Extract components - some have type issues in recharts 2.15
const {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
} = Recharts as Record<string, React.ComponentType<any>>;
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Target,
  BarChart3,
} from 'lucide-react';

// Types for time series data
export interface MonthlyTotal {
  month: string; // YYYY-MM
  total: number;
  dem: number;
  rep: number;
  other: number;
  contributionCount: number;
  donorCount: number;
}

export interface SeasonalPattern {
  month: number; // 1-12
  avgAmount: number;
  avgCount: number;
  seasonalIndex: number;
}

export interface YoYGrowth {
  month: string;
  currentYear: number;
  priorYear: number;
  growthRate: number;
  growthAmount: number;
}

export interface ElectionMarker {
  date: string;
  type: 'primary' | 'general' | 'special';
  label: string;
}

export interface ZIPMonthlyData {
  month: string;
  total: number;
  dem: number;
  rep: number;
  other: number;
}

export interface TimeSeriesData {
  monthlyTotals: MonthlyTotal[];
  seasonalPatterns: SeasonalPattern[];
  yoyGrowth: YoYGrowth[];
  forecast?: ForecastPoint[];
  zipMonthly?: Record<string, ZIPMonthlyData[]>;
}

export interface ForecastPoint {
  month: string;
  predicted: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
}

interface DonorTimeSeriesChartProps {
  data: TimeSeriesData;
  electionMarkers?: ElectionMarker[];
  className?: string;
}

// Election calendar for Michigan
const MICHIGAN_ELECTIONS: ElectionMarker[] = [
  { date: '2024-08', type: 'primary', label: 'MI Primary' },
  { date: '2024-11', type: 'general', label: 'General Election' },
  { date: '2025-05', type: 'special', label: 'Local Elections' },
  { date: '2026-08', type: 'primary', label: 'MI Primary' },
  { date: '2026-11', type: 'general', label: 'Midterms' },
];

// Format currency
const formatCurrency = (value: number) => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
};

// Format month for display
const formatMonth = (monthStr: string) => {
  const [year, month] = monthStr.split('-');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[parseInt(month) - 1]} ${year.slice(2)}`;
};

// Custom tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
      <p className="font-medium text-sm mb-2">{formatMonth(label)}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-600 dark:text-gray-300">{entry.name}:</span>
          <span className="font-medium">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

// Growth indicator component
const GrowthIndicator = ({ value, label }: { value: number; label: string }) => {
  const isPositive = value >= 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  const colorClass = isPositive ? 'text-green-600' : 'text-red-600';
  const bgClass = isPositive ? 'bg-green-50' : 'bg-red-50';

  return (
    <div className={`p-3 rounded-lg ${bgClass}`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${colorClass}`} />
        <span className={`text-lg font-bold ${colorClass}`}>
          {isPositive ? '+' : ''}{value.toFixed(1)}%
        </span>
      </div>
      <p className="text-xs text-gray-600 mt-1">{label}</p>
    </div>
  );
};

export function DonorTimeSeriesChart({
  data,
  electionMarkers = MICHIGAN_ELECTIONS,
  className,
}: DonorTimeSeriesChartProps) {
  const [activeTab, setActiveTab] = useState('trend');

  // Calculate summary metrics
  const metrics = useMemo(() => {
    const { monthlyTotals, yoyGrowth } = data;

    if (monthlyTotals.length === 0) {
      return {
        totalRaised: 0,
        avgMonthly: 0,
        latestMonth: null,
        yoyChange: 0,
        trend: 'flat' as const,
      };
    }

    const totalRaised = monthlyTotals.reduce((sum, m) => sum + m.total, 0);
    const avgMonthly = totalRaised / monthlyTotals.length;
    const latestMonth = monthlyTotals[monthlyTotals.length - 1];

    // Calculate recent trend (last 3 months vs prior 3)
    const recentMonths = monthlyTotals.slice(-3);
    const priorMonths = monthlyTotals.slice(-6, -3);
    const recentAvg = recentMonths.reduce((sum, m) => sum + m.total, 0) / Math.max(recentMonths.length, 1);
    const priorAvg = priorMonths.reduce((sum, m) => sum + m.total, 0) / Math.max(priorMonths.length, 1);
    const trendPct = priorAvg > 0 ? ((recentAvg - priorAvg) / priorAvg) * 100 : 0;

    // YoY change from most recent data
    const latestYoY = yoyGrowth.length > 0 ? yoyGrowth[yoyGrowth.length - 1].growthRate : 0;

    return {
      totalRaised,
      avgMonthly,
      latestMonth,
      yoyChange: latestYoY,
      trendPct,
      trend: trendPct > 5 ? 'up' : trendPct < -5 ? 'down' : 'flat',
    };
  }, [data]);

  // Prepare chart data with election markers
  const chartDataWithMarkers = useMemo(() => {
    return data.monthlyTotals.map((month) => {
      const marker = electionMarkers.find((e) => e.date === month.month);
      return {
        ...month,
        electionType: marker?.type,
        electionLabel: marker?.label,
      };
    });
  }, [data.monthlyTotals, electionMarkers]);

  // Prepare forecast data if available
  const forecastData = useMemo(() => {
    if (!data.forecast || data.forecast.length === 0) {
      // Generate simple linear projection if no forecast provided
      const { monthlyTotals } = data;
      if (monthlyTotals.length < 6) return [];

      const recentMonths = monthlyTotals.slice(-6);
      const avgGrowth = recentMonths.reduce((sum, m, i, arr) => {
        if (i === 0) return 0;
        return sum + (m.total - arr[i - 1].total);
      }, 0) / (recentMonths.length - 1);

      const lastMonth = monthlyTotals[monthlyTotals.length - 1];
      const lastDate = new Date(lastMonth.month + '-01');

      const projections: ForecastPoint[] = [];
      for (let i = 1; i <= 6; i++) {
        const nextDate = new Date(lastDate);
        nextDate.setMonth(nextDate.getMonth() + i);
        const monthStr = nextDate.toISOString().slice(0, 7);
        const predicted = lastMonth.total + (avgGrowth * i);
        const variance = Math.abs(avgGrowth) * 0.5;

        projections.push({
          month: monthStr,
          predicted: Math.max(0, predicted),
          lowerBound: Math.max(0, predicted - variance * i),
          upperBound: predicted + variance * i,
          confidence: 0.85 - (i * 0.05), // Decreasing confidence over time
        });
      }

      return projections;
    }

    return data.forecast;
  }, [data]);

  // Combine historical and forecast for trend chart
  const combinedTrendData = useMemo(() => {
    const historical = chartDataWithMarkers.map((m) => ({
      month: m.month,
      actual: m.total,
      dem: m.dem,
      rep: m.rep,
      other: m.other,
      electionType: m.electionType,
      electionLabel: m.electionLabel,
    }));

    const forecast = forecastData.map((f) => ({
      month: f.month,
      predicted: f.predicted,
      lowerBound: f.lowerBound,
      upperBound: f.upperBound,
    }));

    // Merge last historical point with first forecast for smooth transition
    if (historical.length > 0 && forecast.length > 0) {
      const lastHistorical = historical[historical.length - 1];
      forecast[0] = {
        ...forecast[0],
        predicted: lastHistorical.actual, // Start forecast from actual value
      };
    }

    return { historical, forecast };
  }, [chartDataWithMarkers, forecastData]);

  return (
    <div className={className}>
      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Total Raised</p>
                <p className="text-lg font-bold">{formatCurrency(metrics.totalRaised)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Avg Monthly</p>
                <p className="text-lg font-bold">{formatCurrency(metrics.avgMonthly)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <GrowthIndicator value={metrics.trendPct ?? 0} label="3-Month Trend" />
        <GrowthIndicator value={metrics.yoyChange ?? 0} label="Year-over-Year" />
      </div>

      {/* Chart Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="trend" className="text-xs">Trend</TabsTrigger>
          <TabsTrigger value="party" className="text-xs">By Party</TabsTrigger>
          <TabsTrigger value="seasonal" className="text-xs">Seasonal</TabsTrigger>
          <TabsTrigger value="forecast" className="text-xs">Forecast</TabsTrigger>
        </TabsList>

        {/* Trend Chart */}
        <TabsContent value="trend">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Monthly Contribution Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={combinedTrendData.historical}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="demGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.3} />
                      </linearGradient>
                      <linearGradient id="repGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="#f87171" stopOpacity={0.3} />
                      </linearGradient>
                      <linearGradient id="otherGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#9ca3af" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#d1d5db" stopOpacity={0.2} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="month"
                      tickFormatter={formatMonth}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    {/* Election markers */}
                    {electionMarkers.map((marker) => (
                      <ReferenceLine
                        key={marker.date}
                        x={marker.date}
                        stroke={marker.type === 'general' ? '#ef4444' : '#f59e0b'}
                        strokeDasharray="3 3"
                        label={{
                          value: marker.label,
                          position: 'top',
                          fontSize: 10,
                          fill: marker.type === 'general' ? '#ef4444' : '#f59e0b',
                        }}
                      />
                    ))}
                    <Area
                      type="monotone"
                      dataKey="actual"
                      name="Total Contributions"
                      stroke="#3b82f6"
                      fill="url(#colorTotal)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-0.5 bg-red-400" style={{ borderStyle: 'dashed' }} />
                  <span>General Election</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-0.5 bg-yellow-400" style={{ borderStyle: 'dashed' }} />
                  <span>Primary / Local</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Party Breakdown Chart */}
        <TabsContent value="party">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4" />
                Contributions by Party
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={combinedTrendData.historical}>
                    <defs>
                      <linearGradient id="barDemGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#60a5fa" />
                      </linearGradient>
                      <linearGradient id="barRepGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" />
                        <stop offset="100%" stopColor="#f87171" />
                      </linearGradient>
                      <linearGradient id="barOtherGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#9ca3af" />
                        <stop offset="100%" stopColor="#d1d5db" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="month"
                      tickFormatter={formatMonth}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar
                      dataKey="dem"
                      name="Democratic"
                      stackId="party"
                      fill="url(#barDemGradient)"
                    />
                    <Bar
                      dataKey="rep"
                      name="Republican"
                      stackId="party"
                      fill="url(#barRepGradient)"
                    />
                    <Bar
                      dataKey="other"
                      name="Other"
                      stackId="party"
                      fill="url(#barOtherGradient)"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Seasonal Pattern Chart */}
        <TabsContent value="seasonal">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Seasonal Patterns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.seasonalPatterns}>
                    <defs>
                      <linearGradient id="seasonalBarGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#60a5fa" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="month"
                      tickFormatter={(m: number) =>
                        ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]
                      }
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis yAxisId="left" tickFormatter={formatCurrency} tick={{ fontSize: 11 }} />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                      domain={[0.5, 1.5]}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        if (name === 'Seasonal Index') {
                          return [`${(value * 100).toFixed(0)}%`, name];
                        }
                        return [formatCurrency(value), name];
                      }}
                    />
                    <Legend />
                    <Bar
                      yAxisId="left"
                      dataKey="avgAmount"
                      name="Avg Amount"
                      fill="url(#seasonalBarGradient)"
                      opacity={0.8}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="seasonalIndex"
                      name="Seasonal Index"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                    <ReferenceLine
                      yAxisId="right"
                      y={1}
                      stroke="#9ca3af"
                      strokeDasharray="3 3"
                      label={{ value: 'Baseline', fontSize: 10 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Seasonal index shows months that typically perform above (over 100%) or below (under 100%) average.
                October-November typically sees highest activity due to election cycles.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Forecast Chart */}
        <TabsContent value="forecast">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                6-Month Forecast
                <Badge variant="secondary" className="ml-2 text-xs">
                  Linear Projection
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={[
                      ...combinedTrendData.historical.slice(-6).map((h) => ({
                        month: h.month,
                        actual: h.actual,
                      })),
                      ...combinedTrendData.forecast.map((f) => ({
                        month: f.month,
                        predicted: f.predicted,
                        lowerBound: f.lowerBound,
                        upperBound: f.upperBound,
                      })),
                    ]}
                  >
                    <defs>
                      <linearGradient id="colorConfidence" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="month"
                      tickFormatter={formatMonth}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    {/* Confidence band */}
                    <Area
                      type="monotone"
                      dataKey="upperBound"
                      name="Upper Bound"
                      stroke="transparent"
                      fill="url(#colorConfidence)"
                    />
                    <Area
                      type="monotone"
                      dataKey="lowerBound"
                      name="Lower Bound"
                      stroke="transparent"
                      fill="#ffffff"
                    />
                    {/* Historical line */}
                    <Line
                      type="monotone"
                      dataKey="actual"
                      name="Actual"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                    {/* Forecast line */}
                    <Line
                      type="monotone"
                      dataKey="predicted"
                      name="Forecast"
                      stroke="#10b981"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ r: 4 }}
                    />
                    {/* Dividing line between actual and forecast */}
                    {combinedTrendData.historical.length > 0 && (
                      <ReferenceLine
                        x={combinedTrendData.historical[combinedTrendData.historical.length - 1].month}
                        stroke="#9ca3af"
                        strokeDasharray="3 3"
                        label={{
                          value: 'Forecast Start',
                          position: 'top',
                          fontSize: 10,
                        }}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  <strong>Note:</strong> This is a simple linear projection based on recent trends.
                  Actual contributions may vary significantly due to election cycles, candidate announcements,
                  and other political events.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default DonorTimeSeriesChart;
