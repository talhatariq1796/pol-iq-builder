/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, TrendingDown, Building2, Calculator } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/cmaStatistics';
import type { CMAProperty } from './types';

interface RevenuePropertyMetricsProps {
  properties: CMAProperty[];
}

interface RevenueMetrics {
  avgPGI: number;
  medianPGI: number;
  pgiRange: { min: number; max: number };
  avgGIM: number;
  medianGIM: number;
  gimRange: { min: number; max: number };
  avgPriceVsAssessment: number;
  medianPriceVsAssessment: number;
  totalCount: number;
  avgCapRate: number; // Estimated cap rate
  avgCashFlow: number; // Estimated cash flow potential
}

/**
 * Calculate comprehensive revenue property metrics
 * Focuses on investment metrics: PGI, GIM, Price vs Assessment, Cap Rate
 */
function calculateRevenueMetrics(properties: CMAProperty[]): RevenueMetrics {
  // Filter properties with revenue data
  const revenueProperties = properties.filter(p => {
    const propAny = p as any;
    return (
      propAny.potential_gross_revenue || 
      propAny.pgi || 
      propAny.gross_income_multiplier || 
      propAny.gim ||
      propAny.price_vs_assessment
    );
  });

  if (revenueProperties.length === 0) {
    return {
      avgPGI: 0,
      medianPGI: 0,
      pgiRange: { min: 0, max: 0 },
      avgGIM: 0,
      medianGIM: 0,
      gimRange: { min: 0, max: 0 },
      avgPriceVsAssessment: 0,
      medianPriceVsAssessment: 0,
      totalCount: 0,
      avgCapRate: 0,
      avgCashFlow: 0
    };
  }

  // Extract PGI values
  const pgiValues = revenueProperties
    .map(p => {
      const propAny = p as any;
      return propAny.potential_gross_revenue || propAny.pgi || 0;
    })
    .filter(v => v > 0)
    .sort((a, b) => a - b);

  // Extract GIM values
  const gimValues = revenueProperties
    .map(p => {
      const propAny = p as any;
      return propAny.gross_income_multiplier || propAny.gim || 0;
    })
    .filter(v => v > 0)
    .sort((a, b) => a - b);

  // Extract Price vs Assessment values
  const priceVsAssessmentValues = revenueProperties
    .map(p => {
      const propAny = p as any;
      return propAny.price_vs_assessment || 0;
    })
    .filter(v => v > 0)
    .sort((a, b) => a - b);

  // Calculate PGI statistics
  const avgPGI = pgiValues.length > 0 
    ? pgiValues.reduce((sum, v) => sum + v, 0) / pgiValues.length 
    : 0;
  const medianPGI = pgiValues.length > 0 
    ? pgiValues[Math.floor(pgiValues.length / 2)] 
    : 0;
  const pgiRange = pgiValues.length > 0
    ? { min: pgiValues[0], max: pgiValues[pgiValues.length - 1] }
    : { min: 0, max: 0 };

  // Calculate GIM statistics
  const avgGIM = gimValues.length > 0 
    ? gimValues.reduce((sum, v) => sum + v, 0) / gimValues.length 
    : 0;
  const medianGIM = gimValues.length > 0 
    ? gimValues[Math.floor(gimValues.length / 2)] 
    : 0;
  const gimRange = gimValues.length > 0
    ? { min: gimValues[0], max: gimValues[gimValues.length - 1] }
    : { min: 0, max: 0 };

  // Calculate Price vs Assessment statistics
  const avgPriceVsAssessment = priceVsAssessmentValues.length > 0
    ? priceVsAssessmentValues.reduce((sum, v) => sum + v, 0) / priceVsAssessmentValues.length
    : 0;
  const medianPriceVsAssessment = priceVsAssessmentValues.length > 0
    ? priceVsAssessmentValues[Math.floor(priceVsAssessmentValues.length / 2)]
    : 0;

  // Estimate cap rate (assuming 50% operating expense ratio)
  // Cap Rate = (PGI × 0.50) / Price
  const avgCapRate = avgPGI > 0 && avgGIM > 0
    ? ((avgPGI * 0.50) / (avgPGI * avgGIM)) * 100
    : 0;

  // Estimate cash flow (PGI - expenses - debt service estimate)
  // Simplified: PGI × 0.20 (assumes 50% expenses + 30% debt service)
  const avgCashFlow = avgPGI * 0.20;

  return {
    avgPGI,
    medianPGI,
    pgiRange,
    avgGIM,
    medianGIM,
    gimRange,
    avgPriceVsAssessment,
    medianPriceVsAssessment,
    totalCount: revenueProperties.length,
    avgCapRate,
    avgCashFlow
  };
}

/**
 * Revenue Property Metrics Component
 * Displays investment-focused KPIs for revenue properties
 */
export const RevenuePropertyMetrics: React.FC<RevenuePropertyMetricsProps> = ({ properties }) => {
  const metrics = calculateRevenueMetrics(properties);

  if (metrics.totalCount === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#660D39] font-montserrat">
            <Building2 className="h-5 w-5" />
            Investment Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[#484247]">
            No revenue property data available for this selection.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Investment Performance Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#660D39] font-montserrat">
            <DollarSign className="h-5 w-5" />
            Investment Performance
            <Badge variant="outline" className="ml-auto">
              {metrics.totalCount} Properties
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Average PGI */}
            <div className="space-y-1">
              <p className="text-xs text-[#484247]/70 font-montserrat">Avg. Gross Income (PGI)</p>
              <p className="text-2xl font-bold text-[#660D39] font-montserrat">
                {formatCurrency(metrics.avgPGI)}
              </p>
              <p className="text-xs text-[#484247]/50">
                Range: {formatCurrency(metrics.pgiRange.min)} - {formatCurrency(metrics.pgiRange.max)}
              </p>
            </div>

            {/* Median GIM */}
            <div className="space-y-1">
              <p className="text-xs text-[#484247]/70 font-montserrat">Median GIM</p>
              <p className="text-2xl font-bold text-[#660D39] font-montserrat">
                {metrics.medianGIM.toFixed(1)}x
              </p>
              <p className="text-xs text-[#484247]/50">
                Range: {metrics.gimRange.min.toFixed(1)}x - {metrics.gimRange.max.toFixed(1)}x
              </p>
            </div>

            {/* Estimated Cap Rate */}
            <div className="space-y-1">
              <p className="text-xs text-[#484247]/70 font-montserrat">Est. Cap Rate</p>
              <p className="text-2xl font-bold text-[#660D39] font-montserrat flex items-center gap-1">
                {metrics.avgCapRate.toFixed(1)}%
                {metrics.avgCapRate > 5 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-orange-600" />
                )}
              </p>
              <p className="text-xs text-[#484247]/50">
                {metrics.avgCapRate > 6 ? 'Strong' : metrics.avgCapRate > 4 ? 'Moderate' : 'Conservative'} Return
              </p>
            </div>

            {/* Price vs Assessment */}
            <div className="space-y-1">
              <p className="text-xs text-[#484247]/70 font-montserrat">Price vs Assessment</p>
              <p className="text-2xl font-bold text-[#660D39] font-montserrat">
                {metrics.avgPriceVsAssessment.toFixed(0)}%
              </p>
              <p className="text-xs text-[#484247]/50">
                {metrics.avgPriceVsAssessment < 100 ? 'Below' : metrics.avgPriceVsAssessment > 110 ? 'Above' : 'Near'} Assessment
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Investment Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#660D39] font-montserrat">
            <Calculator className="h-5 w-5" />
            Investment Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* GIM Analysis */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-semibold text-[#484247] font-montserrat">GIM Valuation</p>
              <p className="text-xs text-[#484247]/70">
                The median Gross Income Multiplier of <strong>{metrics.medianGIM.toFixed(1)}x</strong> indicates{' '}
                {metrics.medianGIM < 10 
                  ? 'strong investment value with lower price-to-income ratios'
                  : metrics.medianGIM < 15 
                  ? 'moderate pricing relative to income potential'
                  : 'premium pricing that may require strong rent growth'}
                . Lower GIM values typically indicate better cash flow potential.
              </p>
            </div>
          </div>

          {/* Cap Rate Analysis */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-semibold text-[#484247] font-montserrat">Return Potential</p>
              <p className="text-xs text-[#484247]/70">
                Estimated cap rate of <strong>{metrics.avgCapRate.toFixed(1)}%</strong> suggests{' '}
                {metrics.avgCapRate > 6
                  ? 'attractive returns for income-focused investors'
                  : metrics.avgCapRate > 4
                  ? 'moderate returns typical of stable markets'
                  : 'lower returns indicating appreciation-focused market'}
                . Average estimated cash flow: <strong>{formatCurrency(metrics.avgCashFlow)}/year</strong> after operating expenses.
              </p>
            </div>
          </div>

          {/* Price vs Assessment Analysis */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-purple-50 border border-purple-200">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                <Building2 className="h-4 w-4 text-purple-600" />
              </div>
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-semibold text-[#484247] font-montserrat">Market Pricing</p>
              <p className="text-xs text-[#484247]/70">
                Properties selling at <strong>{metrics.avgPriceVsAssessment.toFixed(0)}%</strong> of municipal assessment{' '}
                {metrics.avgPriceVsAssessment < 100
                  ? 'indicates value opportunities below assessed values'
                  : metrics.avgPriceVsAssessment > 110
                  ? 'suggests strong market demand pushing prices above assessments'
                  : 'shows pricing aligned with municipal assessments'}
                . This metric helps identify undervalued properties and market strength.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export { calculateRevenueMetrics };
export type { RevenueMetrics };
