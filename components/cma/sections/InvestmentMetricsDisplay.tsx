/**
 * Investment Metrics Display Component
 *
 * Displays all 7 investment metrics for revenue properties with:
 * - Visual metric cards with color coding
 * - Tooltips with explanations
 * - Comparison to area averages
 * - Validation warnings for unusual values
 */

'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  DollarSign,
  Target,
  AlertTriangle,
  Info,
  TrendingDown,
  CheckCircle
} from 'lucide-react';
import type { CMAProperty } from '../types';

export interface InvestmentMetricsDisplayProps {
  property: CMAProperty;
  areaAverages?: {
    gim?: number;
    nim?: number;
    pgi?: number;
    noi?: number;
  };
}

interface MetricCardProps {
  label: string;
  value: string | number;
  tooltip: string;
  icon: React.ReactNode;
  status?: 'good' | 'caution' | 'warning' | 'neutral';
  areaAverage?: string | number;
  acronym?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  tooltip,
  icon,
  status = 'neutral',
  areaAverage,
  acronym
}) => {
  const statusColors = {
    good: 'bg-green-500/10 border-green-500/20 text-green-600',
    caution: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600',
    warning: 'bg-red-500/10 border-red-500/20 text-red-600',
    neutral: 'bg-blue-500/10 border-blue-500/20 text-blue-600'
  };

  const statusIcons = {
    good: <CheckCircle className="w-4 h-4" />,
    caution: <AlertTriangle className="w-4 h-4" />,
    warning: <AlertTriangle className="w-4 h-4" />,
    neutral: <Info className="w-4 h-4" />
  };

  return (
    <Card className="relative group hover:shadow-lg transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${statusColors[status]}`}>
              {icon}
            </div>
            <div>
              <CardTitle className="text-sm font-medium text-gray-700">
                {label}
                {acronym && (
                  <span className="ml-2 text-xs text-gray-500">({acronym})</span>
                )}
              </CardTitle>
            </div>
          </div>
          <div className={`${statusColors[status]} p-1 rounded`}>
            {statusIcons[status]}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="text-2xl font-bold text-gray-900">{value}</div>

          {areaAverage && (
            <div className="text-xs text-gray-500">
              Area Avg: {areaAverage}
            </div>
          )}

          <div className="text-xs text-gray-600 leading-relaxed">
            {tooltip}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const InvestmentMetricsDisplay: React.FC<InvestmentMetricsDisplayProps> = ({
  property,
  areaAverages
}) => {
  // Format currency
  const formatCurrency = (value?: number): string => {
    if (!value) return 'N/A';
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Format ratio (1 decimal place)
  const formatRatio = (value?: number): string => {
    if (!value) return 'N/A';
    return `${value.toFixed(1)}x`;
  };

  // Format percentage
  const formatPercentage = (value?: number): string => {
    if (!value) return 'N/A';
    return `${value.toFixed(1)}%`;
  };

  // Determine status for each metric
  const getGIMStatus = (gim?: number): 'good' | 'caution' | 'warning' | 'neutral' => {
    if (!gim) return 'neutral';
    if (gim < 8) return 'good'; // Excellent value
    if (gim <= 12) return 'good'; // Good value
    if (gim <= 15) return 'caution'; // Market average
    return 'warning'; // High (poor value)
  };

  const getNIMStatus = (nim?: number): 'good' | 'caution' | 'warning' | 'neutral' => {
    if (!nim) return 'neutral';
    if (nim < 10) return 'good'; // Strong cash flow
    if (nim <= 15) return 'good'; // Good cash flow
    if (nim <= 20) return 'caution'; // Moderate cash flow
    return 'warning'; // Weak cash flow
  };

  const getPriceVsAssessmentStatus = (ratio?: number): 'good' | 'caution' | 'warning' | 'neutral' => {
    if (!ratio) return 'neutral';
    if (ratio < 90) return 'good'; // Below assessment (good deal)
    if (ratio <= 110) return 'good'; // Near assessment
    if (ratio <= 130) return 'caution'; // Above assessment
    return 'warning'; // Significantly above assessment
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Investment Metrics</h3>
        <p className="text-sm text-gray-600">
          Comprehensive financial analysis for this revenue property
        </p>
      </div>

      {/* Primary Metrics (Most Important) */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Key Investment Indicators</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard
            label="Gross Income Multiplier"
            acronym="GIM"
            value={formatRatio(property.gim || property.gross_income_multiplier)}
            tooltip="Sale Price ÷ Gross Income. Lower is better. Typical range: 8-15x. Measures how many years of gross income to recover purchase price."
            icon={<Target className="w-5 h-5" />}
            status={getGIMStatus(property.gim || property.gross_income_multiplier)}
            areaAverage={areaAverages?.gim ? formatRatio(areaAverages.gim) : undefined}
          />

          <MetricCard
            label="Net Income Multiplier"
            acronym="NIM"
            value={formatRatio(property.nim)}
            tooltip="Sale Price ÷ NOI. Lower is better. Typical range: 10-20x. Shows years to recover purchase price after operating expenses."
            icon={<TrendingDown className="w-5 h-5" />}
            status={getNIMStatus(property.nim)}
            areaAverage={areaAverages?.nim ? formatRatio(areaAverages.nim) : undefined}
          />

          <MetricCard
            label="Potential Gross Income"
            acronym="PGI"
            value={formatCurrency(property.pgi || property.potential_gross_revenue)}
            tooltip="Annual rental income at 100% occupancy. This is the total possible income before any deductions."
            icon={<DollarSign className="w-5 h-5" />}
            status="neutral"
            areaAverage={areaAverages?.pgi ? formatCurrency(areaAverages.pgi) : undefined}
          />
        </div>
      </div>

      {/* Operating Metrics */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Operating Performance</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard
            label="Net Operating Income"
            acronym="NOI"
            value={formatCurrency(property.noi)}
            tooltip="Annual income after operating expenses (PGI - Operating Expenses). Does not include debt service or taxes."
            icon={<TrendingUp className="w-5 h-5" />}
            status={property.noi && property.noi > 0 ? 'good' : 'warning'}
            areaAverage={areaAverages?.noi ? formatCurrency(areaAverages.noi) : undefined}
          />

          <MetricCard
            label="Effective Gross Income"
            acronym="EGI"
            value={formatCurrency(property.egi)}
            tooltip="Income after vacancy losses (PGI × 97.5%). Assumes 2.5% vacancy rate based on CMHC 2025 Montreal projection."
            icon={<DollarSign className="w-5 h-5" />}
            status="neutral"
          />

          <MetricCard
            label="Effective NOI"
            acronym="Effective NOI"
            value={formatCurrency(property.effective_noi)}
            tooltip="Conservative NOI after accounting for vacancy (EGI - Operating Expenses). More realistic than basic NOI."
            icon={<TrendingUp className="w-5 h-5" />}
            status={property.effective_noi && property.effective_noi > 0 ? 'good' : 'warning'}
          />
        </div>
      </div>

      {/* Valuation Metrics */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Valuation Analysis</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricCard
            label="Price vs Assessment"
            value={formatPercentage(property.price_vs_assessment || property.price_to_assessment_ratio)}
            tooltip="Sale price as percentage of municipal assessment. Below 100% indicates property sold under assessment value."
            icon={<Target className="w-5 h-5" />}
            status={getPriceVsAssessmentStatus(property.price_vs_assessment || property.price_to_assessment_ratio)}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Understanding the Metrics</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-600">
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
            <span><strong>Good:</strong> Metric indicates strong investment value or performance</span>
          </div>
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
            <span><strong>Caution:</strong> Metric is near market average, acceptable but not exceptional</span>
          </div>
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <span><strong>Warning:</strong> Metric indicates potential concerns or poor value</span>
          </div>
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <span><strong>Neutral:</strong> Informational metric without good/bad implications</span>
          </div>
        </div>
      </div>

      {/* Data Source Note */}
      <div className="text-xs text-gray-500 italic">
        * Metrics marked with 📊 use actual Centris data. Metrics marked with ⚠️ are estimates based on CMHC 2025 vacancy projections (2.5% for Montreal).
      </div>
    </div>
  );
};

InvestmentMetricsDisplay.displayName = 'InvestmentMetricsDisplay';
