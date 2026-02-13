/**
 * Revenue Property Dialog Component
 *
 * Comprehensive investment property analysis dialog with:
 * - Tabbed interface (Metrics, Cash Flow, Comparables)
 * - Integration of all Phase 3 components
 * - Professional investment-focused presentation
 * - PDF export capability
 */

'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  TrendingUp,
  Calculator,
  FileText,
  Download,
  X,
  MapPin,
  DollarSign
} from 'lucide-react';
import type { CMAProperty } from '../types';
import { InvestmentMetricsDisplay } from '../sections/InvestmentMetricsDisplay';
import { CashFlowCalculator } from '../sections/CashFlowCalculator';
import { RevenueComparables } from '../sections/RevenueComparables';

export interface RevenuePropertyDialogProps {
  property: CMAProperty | null;
  comparables?: CMAProperty[];
  open: boolean;
  onClose: () => void;
  onExportPDF?: () => void;
}

export const RevenuePropertyDialog: React.FC<RevenuePropertyDialogProps> = ({
  property,
  comparables = [],
  open,
  onClose,
  onExportPDF
}) => {
  const [activeTab, setActiveTab] = useState<'metrics' | 'cashflow' | 'comparables'>('metrics');

  if (!property) return null;

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

  // Get property status badge
  const getStatusBadge = () => {
    const gim = property.gim || property.gross_income_multiplier || 0;
    if (gim < 12) {
      return <Badge className="bg-green-500 text-white">Strong Value</Badge>;
    } else if (gim <= 15) {
      return <Badge className="bg-yellow-500 text-white">Market Average</Badge>;
    } else {
      return <Badge className="bg-red-500 text-white">Above Market</Badge>;
    }
  };

  // Filter comparables to revenue properties only
  const revenueComparables = comparables.filter(comp =>
    (comp.potential_gross_revenue || comp.pgi) &&
    (comp.gross_income_multiplier || comp.gim)
  );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-500 rounded-lg">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-bold text-gray-900">
                    Revenue Property Analysis
                  </DialogTitle>
                  <DialogDescription className="text-sm text-gray-600 mt-1">
                    Comprehensive investment metrics and cash flow analysis
                  </DialogDescription>
                </div>
              </div>

              {/* Property Summary */}
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-700">{property.municipality || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-semibold text-gray-900">
                    {formatCurrency(property.price)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-700">
                    GIM: {(property.gim || property.gross_income_multiplier || 0).toFixed(1)}x
                  </span>
                </div>
                {getStatusBadge()}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {onExportPDF && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onExportPDF}
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export PDF
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1 flex flex-col">
            <TabsList className="mx-6 mt-4 grid w-full max-w-2xl grid-cols-3">
              <TabsTrigger value="metrics" className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <span className="hidden sm:inline">Investment Metrics</span>
                <span className="sm:hidden">Metrics</span>
              </TabsTrigger>
              <TabsTrigger value="cashflow" className="flex items-center gap-2">
                <Calculator className="w-4 h-4" />
                <span className="hidden sm:inline">Cash Flow</span>
                <span className="sm:hidden">Cash Flow</span>
              </TabsTrigger>
              <TabsTrigger value="comparables" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Comparables</span>
                <span className="sm:hidden">Comps</span>
              </TabsTrigger>
            </TabsList>

            {/* Tab Content - Scrollable */}
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              <TabsContent value="metrics" className="mt-6">
                <InvestmentMetricsDisplay
                  property={property}
                  areaAverages={{
                    gim: revenueComparables.length > 0
                      ? revenueComparables.reduce((sum, c) => sum + (c.gim || c.gross_income_multiplier || 0), 0) / revenueComparables.length
                      : undefined,
                    nim: revenueComparables.length > 0
                      ? revenueComparables.reduce((sum, c) => sum + (c.nim || 0), 0) / revenueComparables.length
                      : undefined,
                    noi: revenueComparables.length > 0
                      ? revenueComparables.reduce((sum, c) => sum + (c.noi || 0), 0) / revenueComparables.length
                      : undefined,
                    pgi: revenueComparables.length > 0
                      ? revenueComparables.reduce((sum, c) => sum + (c.pgi || c.potential_gross_revenue || 0), 0) / revenueComparables.length
                      : undefined
                  }}
                />
              </TabsContent>

              <TabsContent value="cashflow" className="mt-6">
                <CashFlowCalculator property={property} />
              </TabsContent>

              <TabsContent value="comparables" className="mt-6">
                <RevenueComparables
                  property={property}
                  comparables={revenueComparables}
                  maxComparables={10}
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              <p>
                <strong>Disclaimer:</strong> This analysis is for informational purposes only.
                Consult with a qualified real estate professional before making investment decisions.
              </p>
            </div>
            <div className="text-xs text-gray-400">
              Generated by Real Estate QC Analysis Engine
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

RevenuePropertyDialog.displayName = 'RevenuePropertyDialog';
