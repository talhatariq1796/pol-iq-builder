/**
 * Revenue Comparables Component
 *
 * Displays comparable revenue properties for investment analysis:
 * - Table of comparable properties with investment metrics
 * - Sort by investment performance (GIM, NIM, NOI)
 * - Highlight subject property
 * - Comparative statistics vs area averages
 * - Filter to revenue properties only
 */

'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Building2,
  Target,
  ArrowUpDown,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import type { CMAProperty } from '../types';

export interface RevenueComparablesProps {
  property: CMAProperty; // Subject property
  comparables: CMAProperty[]; // Comparable revenue properties
  maxComparables?: number;
}

type SortField = 'gim' | 'nim' | 'noi' | 'pgi' | 'price' | 'price_vs_assessment';
type SortDirection = 'asc' | 'desc';

export const RevenueComparables: React.FC<RevenueComparablesProps> = ({
  property,
  comparables,
  maxComparables = 10
}) => {
  const [sortField, setSortField] = useState<SortField>('gim');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

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

  // Format ratio
  const formatRatio = (value?: number): string => {
    if (!value) return 'N/A';
    return `${value.toFixed(1)}x`;
  };

  // Format percentage
  const formatPercentage = (value?: number): string => {
    if (!value) return 'N/A';
    return `${value.toFixed(1)}%`;
  };

  // Calculate area statistics
  const areaStats = useMemo(() => {
    const validComps = comparables.filter(c => c.gim && c.nim && c.noi && c.pgi);
    if (validComps.length === 0) {
      return { avgGIM: 0, avgNIM: 0, avgNOI: 0, avgPGI: 0, avgPriceVsAssessment: 0, count: 0 };
    }

    const sum = validComps.reduce((acc, c) => ({
      gim: acc.gim + (c.gim || c.gross_income_multiplier || 0),
      nim: acc.nim + (c.nim || 0),
      noi: acc.noi + (c.noi || 0),
      pgi: acc.pgi + (c.pgi || c.potential_gross_revenue || 0),
      priceVsAssessment: acc.priceVsAssessment + (c.price_vs_assessment || c.price_to_assessment_ratio || 0)
    }), { gim: 0, nim: 0, noi: 0, pgi: 0, priceVsAssessment: 0 });

    return {
      avgGIM: sum.gim / validComps.length,
      avgNIM: sum.nim / validComps.length,
      avgNOI: sum.noi / validComps.length,
      avgPGI: sum.pgi / validComps.length,
      avgPriceVsAssessment: sum.priceVsAssessment / validComps.length,
      count: validComps.length
    };
  }, [comparables]);

  // Calculate subject property comparison
  const subjectComparison = useMemo(() => {
    if (areaStats.count === 0) return null;

    const subjectGIM = property.gim || property.gross_income_multiplier || 0;
    const subjectNIM = property.nim || 0;
    const subjectNOI = property.noi || 0;
    const subjectPGI = property.pgi || property.potential_gross_revenue || 0;
    const subjectPriceVsAssessment = property.price_vs_assessment || property.price_to_assessment_ratio || 0;

    return {
      gimDiff: ((subjectGIM - areaStats.avgGIM) / areaStats.avgGIM) * 100,
      nimDiff: ((subjectNIM - areaStats.avgNIM) / areaStats.avgNIM) * 100,
      noiDiff: ((subjectNOI - areaStats.avgNOI) / areaStats.avgNOI) * 100,
      pgiDiff: ((subjectPGI - areaStats.avgPGI) / areaStats.avgPGI) * 100,
      priceVsAssessmentDiff: ((subjectPriceVsAssessment - areaStats.avgPriceVsAssessment) / areaStats.avgPriceVsAssessment) * 100
    };
  }, [property, areaStats]);

  // Sort comparables
  const sortedComparables = useMemo(() => {
    const sorted = [...comparables].sort((a, b) => {
      let aVal = 0;
      let bVal = 0;

      switch (sortField) {
        case 'gim':
          aVal = a.gim || a.gross_income_multiplier || 0;
          bVal = b.gim || b.gross_income_multiplier || 0;
          break;
        case 'nim':
          aVal = a.nim || 0;
          bVal = b.nim || 0;
          break;
        case 'noi':
          aVal = a.noi || 0;
          bVal = b.noi || 0;
          break;
        case 'pgi':
          aVal = a.pgi || a.potential_gross_revenue || 0;
          bVal = b.pgi || b.potential_gross_revenue || 0;
          break;
        case 'price':
          aVal = a.price || 0;
          bVal = b.price || 0;
          break;
        case 'price_vs_assessment':
          aVal = a.price_vs_assessment || a.price_to_assessment_ratio || 0;
          bVal = b.price_vs_assessment || b.price_to_assessment_ratio || 0;
          break;
      }

      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return sorted.slice(0, maxComparables);
  }, [comparables, sortField, sortDirection, maxComparables]);

  // Toggle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Get status for GIM comparison
  const getGIMStatus = (gim: number): 'good' | 'caution' | 'warning' => {
    if (gim < 8) return 'good';
    if (gim <= 12) return 'good';
    if (gim <= 15) return 'caution';
    return 'warning';
  };

  // Get comparison badge color
  const getComparisonColor = (diff: number, inverse: boolean = false): string => {
    // For metrics where lower is better (GIM, NIM, Price vs Assessment)
    if (inverse) {
      if (diff < -10) return 'text-green-600'; // Significantly below average (good)
      if (diff < 0) return 'text-green-500'; // Below average (good)
      if (diff < 10) return 'text-yellow-600'; // Near average (caution)
      return 'text-red-600'; // Above average (warning)
    }
    // For metrics where higher is better (NOI, PGI)
    else {
      if (diff > 10) return 'text-green-600'; // Significantly above average (good)
      if (diff > 0) return 'text-green-500'; // Above average (good)
      if (diff > -10) return 'text-yellow-600'; // Near average (caution)
      return 'text-red-600'; // Below average (warning)
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Comparable Revenue Properties</h3>
        <p className="text-sm text-gray-600">
          Investment analysis based on {areaStats.count} comparable revenue properties
        </p>
      </div>

      {/* Subject Property Comparison */}
      {subjectComparison && (
        <Card className="border-purple-200 bg-purple-50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-600" />
              Subject Property vs Area Averages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="text-center p-3 bg-white rounded-lg border border-purple-200">
                <div className="text-xs text-gray-600 mb-1">GIM Comparison</div>
                <div className={`text-lg font-bold ${getComparisonColor(subjectComparison.gimDiff, true)}`}>
                  {subjectComparison.gimDiff > 0 ? '+' : ''}{subjectComparison.gimDiff.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {subjectComparison.gimDiff < 0 ? 'Better value' : 'Above average'}
                </div>
              </div>

              <div className="text-center p-3 bg-white rounded-lg border border-purple-200">
                <div className="text-xs text-gray-600 mb-1">NIM Comparison</div>
                <div className={`text-lg font-bold ${getComparisonColor(subjectComparison.nimDiff, true)}`}>
                  {subjectComparison.nimDiff > 0 ? '+' : ''}{subjectComparison.nimDiff.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {subjectComparison.nimDiff < 0 ? 'Better value' : 'Above average'}
                </div>
              </div>

              <div className="text-center p-3 bg-white rounded-lg border border-purple-200">
                <div className="text-xs text-gray-600 mb-1">NOI Comparison</div>
                <div className={`text-lg font-bold ${getComparisonColor(subjectComparison.noiDiff, false)}`}>
                  {subjectComparison.noiDiff > 0 ? '+' : ''}{subjectComparison.noiDiff.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {subjectComparison.noiDiff > 0 ? 'Above average' : 'Below average'}
                </div>
              </div>

              <div className="text-center p-3 bg-white rounded-lg border border-purple-200">
                <div className="text-xs text-gray-600 mb-1">PGI Comparison</div>
                <div className={`text-lg font-bold ${getComparisonColor(subjectComparison.pgiDiff, false)}`}>
                  {subjectComparison.pgiDiff > 0 ? '+' : ''}{subjectComparison.pgiDiff.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {subjectComparison.pgiDiff > 0 ? 'Above average' : 'Below average'}
                </div>
              </div>

              <div className="text-center p-3 bg-white rounded-lg border border-purple-200">
                <div className="text-xs text-gray-600 mb-1">Price vs Assessment</div>
                <div className={`text-lg font-bold ${getComparisonColor(subjectComparison.priceVsAssessmentDiff, true)}`}>
                  {subjectComparison.priceVsAssessmentDiff > 0 ? '+' : ''}{subjectComparison.priceVsAssessmentDiff.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {subjectComparison.priceVsAssessmentDiff < 0 ? 'Below assessment' : 'Above assessment'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Area Averages */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Area Averages</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Avg GIM</div>
              <div className="text-lg font-bold text-gray-900">{formatRatio(areaStats.avgGIM)}</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Avg NIM</div>
              <div className="text-lg font-bold text-gray-900">{formatRatio(areaStats.avgNIM)}</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Avg NOI</div>
              <div className="text-lg font-bold text-gray-900">{formatCurrency(areaStats.avgNOI)}</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Avg PGI</div>
              <div className="text-lg font-bold text-gray-900">{formatCurrency(areaStats.avgPGI)}</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Avg Price/Assessment</div>
              <div className="text-lg font-bold text-gray-900">{formatPercentage(areaStats.avgPriceVsAssessment)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparables Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comparable Properties</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 font-medium text-gray-700">Property</th>
                  <th className="text-right py-3 px-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('price')}
                      className="text-gray-700 hover:text-gray-900 font-medium"
                    >
                      Price
                      <ArrowUpDown className="w-3 h-3 ml-1" />
                    </Button>
                  </th>
                  <th className="text-right py-3 px-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('gim')}
                      className="text-gray-700 hover:text-gray-900 font-medium"
                    >
                      GIM
                      <ArrowUpDown className="w-3 h-3 ml-1" />
                    </Button>
                  </th>
                  <th className="text-right py-3 px-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('nim')}
                      className="text-gray-700 hover:text-gray-900 font-medium"
                    >
                      NIM
                      <ArrowUpDown className="w-3 h-3 ml-1" />
                    </Button>
                  </th>
                  <th className="text-right py-3 px-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('noi')}
                      className="text-gray-700 hover:text-gray-900 font-medium"
                    >
                      NOI
                      <ArrowUpDown className="w-3 h-3 ml-1" />
                    </Button>
                  </th>
                  <th className="text-right py-3 px-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('pgi')}
                      className="text-gray-700 hover:text-gray-900 font-medium"
                    >
                      PGI
                      <ArrowUpDown className="w-3 h-3 ml-1" />
                    </Button>
                  </th>
                  <th className="text-right py-3 px-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('price_vs_assessment')}
                      className="text-gray-700 hover:text-gray-900 font-medium"
                    >
                      Price/Assess
                      <ArrowUpDown className="w-3 h-3 ml-1" />
                    </Button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Subject Property Row */}
                <tr className="border-b border-purple-200 bg-purple-50">
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-purple-600" />
                      <div>
                        <div className="font-semibold text-gray-900">Subject Property</div>
                        <div className="text-xs text-gray-600">{property.municipality || 'N/A'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-right py-3 px-2 font-semibold text-gray-900">
                    {formatCurrency(property.price)}
                  </td>
                  <td className="text-right py-3 px-2">
                    <Badge
                      variant="outline"
                      className={`font-semibold ${
                        getGIMStatus(property.gim || property.gross_income_multiplier || 0) === 'good'
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : getGIMStatus(property.gim || property.gross_income_multiplier || 0) === 'caution'
                          ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}
                    >
                      {formatRatio(property.gim || property.gross_income_multiplier)}
                    </Badge>
                  </td>
                  <td className="text-right py-3 px-2 font-semibold text-gray-900">
                    {formatRatio(property.nim)}
                  </td>
                  <td className="text-right py-3 px-2 font-semibold text-gray-900">
                    {formatCurrency(property.noi)}
                  </td>
                  <td className="text-right py-3 px-2 font-semibold text-gray-900">
                    {formatCurrency(property.pgi || property.potential_gross_revenue)}
                  </td>
                  <td className="text-right py-3 px-2 font-semibold text-gray-900">
                    {formatPercentage(property.price_vs_assessment || property.price_to_assessment_ratio)}
                  </td>
                </tr>

                {/* Comparable Properties */}
                {sortedComparables.map((comp, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="font-medium text-gray-700">Comparable #{index + 1}</div>
                          <div className="text-xs text-gray-500">{comp.municipality || 'N/A'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-right py-3 px-2 text-gray-700">
                      {formatCurrency(comp.price)}
                    </td>
                    <td className="text-right py-3 px-2">
                      <Badge
                        variant="outline"
                        className={`font-medium ${
                          getGIMStatus(comp.gim || comp.gross_income_multiplier || 0) === 'good'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : getGIMStatus(comp.gim || comp.gross_income_multiplier || 0) === 'caution'
                            ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}
                      >
                        {formatRatio(comp.gim || comp.gross_income_multiplier)}
                      </Badge>
                    </td>
                    <td className="text-right py-3 px-2 text-gray-700">
                      {formatRatio(comp.nim)}
                    </td>
                    <td className="text-right py-3 px-2 text-gray-700">
                      {formatCurrency(comp.noi)}
                    </td>
                    <td className="text-right py-3 px-2 text-gray-700">
                      {formatCurrency(comp.pgi || comp.potential_gross_revenue)}
                    </td>
                    <td className="text-right py-3 px-2 text-gray-700">
                      {formatPercentage(comp.price_vs_assessment || comp.price_to_assessment_ratio)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {sortedComparables.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm">No comparable revenue properties found in this area</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Interpretation Guide */}
      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <div className="font-semibold mb-2">How to Read Comparisons:</div>
            <ul className="space-y-1 text-xs">
              <li>• <strong>GIM & NIM:</strong> Lower is better. Negative % means better value than area average</li>
              <li>• <strong>NOI & PGI:</strong> Higher is better. Positive % means above-average income</li>
              <li>• <strong>Price vs Assessment:</strong> Lower is better. Below 100% = purchased under assessment value</li>
              <li>• <strong>Color Coding:</strong> Green = favorable, Yellow = near average, Red = unfavorable</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

RevenueComparables.displayName = 'RevenueComparables';
