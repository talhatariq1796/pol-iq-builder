/**
 * Cash Flow Calculator Component
 *
 * Interactive calculator showing complete cash flow analysis for revenue properties:
 * - Waterfall from PGI → EGI → NOI → Effective NOI
 * - Annual and monthly breakdowns
 * - Operating expense details
 * - Visual flow chart
 * - CMHC vacancy assumptions
 */

'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TrendingDown,
  TrendingUp,
  DollarSign,
  AlertCircle,
  Calendar,
  ArrowDown,
  Info
} from 'lucide-react';
import type { CMAProperty } from '../types';

export interface CashFlowCalculatorProps {
  property: CMAProperty;
}

const VACANCY_RATE = 0.025; // 2.5% CMHC 2025 Montreal projection

interface CashFlowBreakdown {
  pgi: number;
  vacancyLoss: number;
  egi: number;
  operatingExpenses: number;
  noi: number;
  effectiveNOI: number;
}

export const CashFlowCalculator: React.FC<CashFlowCalculatorProps> = ({ property }) => {
  const [viewMode, setViewMode] = useState<'annual' | 'monthly'>('annual');

  // Format currency
  const formatCurrency = (value: number, monthly: boolean = false): string => {
    const amount = monthly ? value / 12 : value;
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Calculate cash flow breakdown
  const calculateCashFlow = (): CashFlowBreakdown => {
    const pgi = property.pgi || property.potential_gross_revenue || 0;
    const vacancyLoss = pgi * VACANCY_RATE;
    const egi = property.egi || (pgi * (1 - VACANCY_RATE));
    const operatingExpenses = (property.common_expenses || 0) * 12;
    const noi = property.noi || (pgi - operatingExpenses);
    const effectiveNOI = property.effective_noi || (egi - operatingExpenses);

    return {
      pgi,
      vacancyLoss,
      egi,
      operatingExpenses,
      noi,
      effectiveNOI
    };
  };

  const cashFlow = calculateCashFlow();
  const isMonthly = viewMode === 'monthly';

  // Calculate percentages
  const vacancyPercent = (cashFlow.vacancyLoss / cashFlow.pgi) * 100;
  const expensePercent = (cashFlow.operatingExpenses / cashFlow.pgi) * 100;
  const noiPercent = (cashFlow.effectiveNOI / cashFlow.pgi) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Cash Flow Analysis</h3>
          <p className="text-sm text-gray-600">
            Complete income and expense breakdown
          </p>
        </div>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'annual' | 'monthly')}>
          <TabsList>
            <TabsTrigger value="annual" className="text-xs">
              <Calendar className="w-4 h-4 mr-1" />
              Annual
            </TabsTrigger>
            <TabsTrigger value="monthly" className="text-xs">
              <Calendar className="w-4 h-4 mr-1" />
              Monthly
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Cash Flow Waterfall */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Income Waterfall</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 1: PGI */}
          <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border-2 border-green-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500 rounded-lg">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">Potential Gross Income (PGI)</div>
                <div className="text-xs text-gray-600">100% occupancy, no deductions</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-700">
                {formatCurrency(cashFlow.pgi, isMonthly)}
              </div>
              {isMonthly && (
                <div className="text-xs text-gray-500">
                  {formatCurrency(cashFlow.pgi, false)} annually
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-center">
            <ArrowDown className="w-6 h-6 text-gray-400" />
          </div>

          {/* Step 2: Vacancy Loss */}
          <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500 rounded-lg">
                <TrendingDown className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">Less: Vacancy Loss</div>
                <div className="text-xs text-gray-600">
                  {vacancyPercent.toFixed(1)}% vacancy (CMHC 2025 projection)
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-yellow-700">
                -{formatCurrency(cashFlow.vacancyLoss, isMonthly)}
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <ArrowDown className="w-6 h-6 text-gray-400" />
          </div>

          {/* Step 3: EGI */}
          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">Effective Gross Income (EGI)</div>
                <div className="text-xs text-gray-600">After vacancy adjustment</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-700">
                {formatCurrency(cashFlow.egi, isMonthly)}
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <ArrowDown className="w-6 h-6 text-gray-400" />
          </div>

          {/* Step 4: Operating Expenses */}
          <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500 rounded-lg">
                <TrendingDown className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">Less: Operating Expenses</div>
                <div className="text-xs text-gray-600">
                  {expensePercent.toFixed(1)}% of PGI (Common expenses)
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-red-700">
                -{formatCurrency(cashFlow.operatingExpenses, isMonthly)}
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <ArrowDown className="w-6 h-6 text-gray-400" />
          </div>

          {/* Step 5: Effective NOI (Final) */}
          <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500 rounded-lg">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">Net Operating Income (Effective NOI)</div>
                <div className="text-xs text-gray-600">
                  {noiPercent.toFixed(1)}% of PGI retained
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-purple-700">
                {formatCurrency(cashFlow.effectiveNOI, isMonthly)}
              </div>
              {isMonthly && (
                <div className="text-xs text-gray-500">
                  {formatCurrency(cashFlow.effectiveNOI, false)} annually
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Operating Expense Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Operating Expense Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-700">Common Expenses (Monthly)</span>
              <span className="font-semibold text-gray-900">
                {formatCurrency((property.common_expenses || 0) * 12, true)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-700">Common Expenses (Annual)</span>
              <span className="font-semibold text-gray-900">
                {formatCurrency(cashFlow.operatingExpenses, false)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-700">Expense Ratio (% of PGI)</span>
              <Badge variant="outline" className="font-semibold">
                {expensePercent.toFixed(1)}%
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Ratios */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance Ratios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">NOI Margin</div>
              <div className="text-2xl font-bold text-green-700">{noiPercent.toFixed(1)}%</div>
              <div className="text-xs text-gray-500 mt-1">of gross income retained</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Operating Expense Ratio</div>
              <div className="text-2xl font-bold text-blue-700">{expensePercent.toFixed(1)}%</div>
              <div className="text-xs text-gray-500 mt-1">of gross income</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Vacancy Rate</div>
              <div className="text-2xl font-bold text-yellow-700">{vacancyPercent.toFixed(1)}%</div>
              <div className="text-xs text-gray-500 mt-1">CMHC projection</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assumptions & Notes */}
      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <div className="font-semibold mb-2">Assumptions & Data Sources:</div>
            <ul className="space-y-1 text-xs">
              <li>• <strong>Vacancy Rate:</strong> 2.5% based on CMHC 2025 projection for Montreal</li>
              <li>• <strong>Operating Expenses:</strong> Common expenses from Centris listing (annualized)</li>
              <li>• <strong>PGI:</strong> Potential Gross Income from Centris (potential_gross_revenue field)</li>
              <li>• <strong>NOI:</strong> Calculated as PGI minus Operating Expenses (does not include debt service or taxes)</li>
              <li>• <strong>Effective NOI:</strong> More conservative estimate accounting for vacancy</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Additional Considerations */}
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            Important Considerations
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-700 space-y-2">
          <p>
            <strong>Not Included in NOI:</strong> This analysis does not include debt service (mortgage payments),
            capital expenses, reserves, or income taxes. These should be factored into your investment decision.
          </p>
          <p>
            <strong>Expense Verification:</strong> Common expenses from Centris may not include all operating costs.
            Verify actual expenses with property management or current owner.
          </p>
          <p>
            <strong>Vacancy Rate:</strong> The 2.5% vacancy rate is a market average. Specific properties may
            experience higher or lower vacancy based on location, condition, and management.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

CashFlowCalculator.displayName = 'CashFlowCalculator';
