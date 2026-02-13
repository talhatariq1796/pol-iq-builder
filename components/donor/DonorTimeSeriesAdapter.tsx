'use client';

/**
 * Adapter component to transform API time series data format
 * to match DonorTimeSeriesChart expected interface
 */

import React from 'react';
import { DonorTimeSeriesChart, TimeSeriesData, MonthlyTotal, SeasonalPattern, YoYGrowth } from './DonorTimeSeriesChart';

// API response format from /api/donors?action=timeseries
interface APIMonthlyTotal {
  month: string;
  totalAmount: number;
  contributionCount: number;
  donorCount: number;
  avgContribution: number;
  demAmount: number;
  repAmount: number;
  otherAmount: number;
  demContributions: number;
  repContributions: number;
  newDonorCount: number;
  returningDonorCount: number;
}

interface APISeasonalPattern {
  month: number;
  avgAmount: number;
  avgContributions: number;
  stdDev: number;
  seasonalIndex?: number;
}

interface APIYoYGrowth {
  period: string;
  amountGrowth: number;
  donorGrowth: number;
  contributionGrowth: number;
}

interface APITimeSeriesData {
  generatedAt: string;
  sourceFile: string;
  dateRange: { earliest: string; latest: string };
  monthlyTotals: APIMonthlyTotal[];
  zipMonthly: Record<string, any[]>;
  cycleComparison: any[];
  cohorts: any[];
  seasonalPatterns: APISeasonalPattern[];
  yoyGrowth: APIYoYGrowth[];
}

interface DonorTimeSeriesAdapterProps {
  data: APITimeSeriesData | TimeSeriesData;
  className?: string;
}

/**
 * Transform API data format to chart format
 */
function transformTimeSeriesData(apiData: APITimeSeriesData): TimeSeriesData {
  // Transform monthly totals
  const monthlyTotals: MonthlyTotal[] = apiData.monthlyTotals.map(m => ({
    month: m.month,
    total: m.totalAmount,
    dem: m.demAmount,
    rep: m.repAmount,
    other: m.otherAmount,
    contributionCount: m.contributionCount,
    donorCount: m.donorCount,
  }));

  // Transform seasonal patterns
  const seasonalPatterns: SeasonalPattern[] = apiData.seasonalPatterns.map(s => ({
    month: s.month,
    avgAmount: s.avgAmount,
    avgCount: s.avgContributions,
    seasonalIndex: s.seasonalIndex ?? 1,
  }));

  // Transform YoY growth
  // API format is period-based ("2021-2022"), chart expects month-based
  // We'll expand each period to monthly growth rates
  const yoyGrowth: YoYGrowth[] = [];

  if (apiData.yoyGrowth && apiData.yoyGrowth.length > 0) {
    // For simplicity, we'll use the overall period growth as a constant for all months in that period
    apiData.yoyGrowth.forEach(period => {
      const [year1, year2] = period.period.split('-');
      const growthRate = period.amountGrowth;

      // Add one entry per year (simplified)
      yoyGrowth.push({
        month: `${year2}-01`,
        currentYear: 0, // Would need actual amounts
        priorYear: 0,
        growthRate: growthRate,
        growthAmount: 0,
      });
    });
  }

  return {
    monthlyTotals,
    seasonalPatterns,
    yoyGrowth,
    zipMonthly: apiData.zipMonthly,
  };
}

/**
 * Check if data needs transformation
 */
function isAPIFormat(data: any): data is APITimeSeriesData {
  return data.monthlyTotals?.[0]?.hasOwnProperty('totalAmount');
}

export function DonorTimeSeriesAdapter({ data, className }: DonorTimeSeriesAdapterProps) {
  // Transform API format if needed
  const chartData = isAPIFormat(data) ? transformTimeSeriesData(data) : data;

  return <DonorTimeSeriesChart data={chartData} className={className} />;
}

export default DonorTimeSeriesAdapter;
