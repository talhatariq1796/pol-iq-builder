/**
 * RevenuePropertyFilters Component
 *
 * Investment-focused filters for revenue properties (duplex, multiplex, commercial)
 * Uses different metrics than residential properties:
 * - Gross Income (PGI)
 * - Gross Income Multiplier (GIM)
 * - Price vs Assessment
 *
 * Field mappings from Centris data:
 * - potential_gross_revenue: Annual rental income
 * - gross_income_multiplier: GIM ratio (already calculated)
 * - price_vs_assessment: Price as % of municipal assessment
 */

'use client';

import React from 'react';
import { CMAFilters } from './types';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export interface RevenuePropertyFiltersProps {
  filters: CMAFilters;
  onFilterChange: (updates: Partial<CMAFilters>) => void;
  disabled?: boolean;
}

export const RevenuePropertyFilters: React.FC<RevenuePropertyFiltersProps> = ({
  filters,
  onFilterChange,
  disabled = false,
}) => {
  // Format currency for display
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Listing Status - Radio Buttons (MOVE TO TOP, same as residential) */}
      <div className="space-y-2">
        <Label className="text-xs text-[#484247] font-montserrat font-semibold">Listing Status</Label>
        <RadioGroup
          value={filters.listingStatus}
          onValueChange={(value: string) => onFilterChange({ listingStatus: value as 'both' | 'sold' | 'active' })}
          className="flex flex-wrap gap-4"
          disabled={disabled}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem 
              value="both" 
              id="revenue-both" 
              className="border-[#660D39] text-[#660D39]"
              disabled={disabled}
            />
            <Label 
              htmlFor="revenue-both" 
              className={`text-xs font-montserrat ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              Both
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem 
              value="sold" 
              id="revenue-sold" 
              className="border-[#660D39] text-[#660D39]"
              disabled={disabled}
            />
            <Label 
              htmlFor="revenue-sold" 
              className={`text-xs font-montserrat ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              Sold
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem 
              value="active" 
              id="revenue-active" 
              className="border-[#660D39] text-[#660D39]"
              disabled={disabled}
            />
            <Label 
              htmlFor="revenue-active" 
              className={`text-xs font-montserrat ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              Active
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Info Banner */}
      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
        <p className="text-xs text-green-700">
          💡 These filters are optimized for investment analysis using income and valuation metrics.
        </p>
      </div>

      {/* Price Range */}
      <div className="space-y-2">
        <Label className="text-xs text-[#484247] font-montserrat font-semibold">
          Sale Price Range
          <span className="text-xs font-normal ml-2 text-[#484247]/70">
            {formatCurrency(filters.priceRange.min)} - {formatCurrency(filters.priceRange.max)}
          </span>
        </Label>
        <div className="space-y-2">
          <input
            type="range"
            min="0"
            max="5000000"
            step="50000"
            value={filters.priceRange.min}
            onChange={(e) => onFilterChange({
              priceRange: { ...filters.priceRange, min: parseInt(e.target.value) }
            })}
            disabled={disabled}
            className="w-full h-2 bg-figma-glass-white-10 rounded-lg appearance-none cursor-pointer"
          />
          <input
            type="range"
            min="0"
            max="5000000"
            step="50000"
            value={filters.priceRange.max}
            onChange={(e) => onFilterChange({
              priceRange: { ...filters.priceRange, max: parseInt(e.target.value) }
            })}
            disabled={disabled}
            className="w-full h-2 bg-figma-glass-white-10 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>

      {/* Gross Income Range */}
      <div className="space-y-2">
        <Label className="text-xs text-[#484247] font-montserrat font-semibold">
          Annual Gross Income (PGI)
          <span className="text-xs font-normal ml-2 text-[#484247]/70">
            {formatCurrency(filters.grossIncomeRange?.min || 0)} - {formatCurrency(filters.grossIncomeRange?.max || 500000)}
          </span>
        </Label>
        <div className="space-y-2">
          <input
            type="range"
            min="0"
            max="500000"
            step="5000"
            value={filters.grossIncomeRange?.min || 0}
            onChange={(e) => onFilterChange({
              grossIncomeRange: {
                min: parseInt(e.target.value),
                max: filters.grossIncomeRange?.max || 500000
              }
            })}
            disabled={disabled}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#660D39]"
          />
          <input
            type="range"
            min="0"
            max="500000"
            step="5000"
            value={filters.grossIncomeRange?.max || 500000}
            onChange={(e) => onFilterChange({
              grossIncomeRange: {
                min: filters.grossIncomeRange?.min || 0,
                max: parseInt(e.target.value)
              }
            })}
            disabled={disabled}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#660D39]"
          />
        </div>
        <p className="text-[#484247]/70 text-[10px] mt-1">
          Potential annual rental income before expenses
        </p>
      </div>

      {/* GIM Range */}
      <div className="space-y-2">
        <Label className="text-xs text-[#484247] font-montserrat font-semibold">
          Gross Income Multiplier (GIM)
          <span className="text-xs font-normal ml-2 text-[#484247]/70">
            {(filters.gimRange?.min || 0).toFixed(1)}x - {(filters.gimRange?.max || 30).toFixed(1)}x
          </span>
        </Label>
        <div className="space-y-2">
          <input
            type="range"
            min="0"
            max="30"
            step="0.5"
            value={filters.gimRange?.min || 0}
            onChange={(e) => onFilterChange({
              gimRange: {
                min: parseFloat(e.target.value),
                max: filters.gimRange?.max || 30
              }
            })}
            disabled={disabled}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#660D39]"
          />
          <input
            type="range"
            min="0"
            max="30"
            step="0.5"
            value={filters.gimRange?.max || 30}
            onChange={(e) => onFilterChange({
              gimRange: {
                min: filters.gimRange?.min || 0,
                max: parseFloat(e.target.value)
              }
            })}
            disabled={disabled}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#660D39]"
          />
        </div>
        <p className="text-[#484247]/70 text-[10px] mt-1">
          Lower GIM = better value. Typical range: 8-15x
        </p>
      </div>

      {/* Price vs Assessment Range */}
      <div className="space-y-2">
        <Label className="text-xs text-[#484247] font-montserrat font-semibold">
          Price vs Assessment
          <span className="text-xs font-normal ml-2 text-[#484247]/70">
            {(filters.priceVsAssessmentRange?.min || 0).toFixed(0)}% - {(filters.priceVsAssessmentRange?.max || 200).toFixed(0)}%
          </span>
        </Label>
        <div className="space-y-2">
          <input
            type="range"
            min="0"
            max="200"
            step="5"
            value={filters.priceVsAssessmentRange?.min || 0}
            onChange={(e) => onFilterChange({
              priceVsAssessmentRange: {
                min: parseInt(e.target.value),
                max: filters.priceVsAssessmentRange?.max || 200
              }
            })}
            disabled={disabled}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#660D39]"
          />
          <input
            type="range"
            min="0"
            max="200"
            step="5"
            value={filters.priceVsAssessmentRange?.max || 200}
            onChange={(e) => onFilterChange({
              priceVsAssessmentRange: {
                min: filters.priceVsAssessmentRange?.min || 0,
                max: parseInt(e.target.value)
              }
            })}
            disabled={disabled}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#660D39]"
          />
        </div>
        <p className="text-[#484247]/70 text-[10px] mt-1">
          Sale price as % of municipal assessment. &lt;100% = below assessment
        </p>
      </div>

      {/* Date Range */}
      <div className="space-y-2">
        <Label className="text-xs text-[#484247] font-montserrat font-semibold">Date Range</Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[#484247]/70 text-[10px] mb-1 block font-montserrat">From</label>
            <input
              type="date"
              value={filters.dateRange.start.toISOString().split('T')[0]}
              onChange={(e) => onFilterChange({
                dateRange: {
                  ...filters.dateRange,
                  start: new Date(e.target.value)
                }
              })}
              disabled={disabled}
              className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded text-[#484247] text-xs focus:outline-none focus:ring-2 focus:ring-[#660D39]"
            />
          </div>
          <div>
            <label className="text-[#484247]/70 text-[10px] mb-1 block font-montserrat">To</label>
            <input
              type="date"
              value={filters.dateRange.end.toISOString().split('T')[0]}
              onChange={(e) => onFilterChange({
                dateRange: {
                  ...filters.dateRange,
                  end: new Date(e.target.value)
                }
              })}
              disabled={disabled}
              className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded text-[#484247] text-xs focus:outline-none focus:ring-2 focus:ring-[#660D39]"
            />
          </div>
        </div>
      </div>

      {/* Investment Metrics Info */}
      <div className="pt-4 border-t border-gray-200">
        <div className="text-[#484247]/70 text-[10px] space-y-1 font-montserrat">
          <div className="flex items-start gap-2">
            <span className="text-green-600">•</span>
            <span><strong className="text-[#484247]">PGI:</strong> Potential Gross Income (annual)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-600">•</span>
            <span><strong className="text-[#484247]">GIM:</strong> Price ÷ Gross Income (lower is better)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-600">•</span>
            <span><strong className="text-[#484247]">Assessment:</strong> Municipal tax assessment value</span>
          </div>
        </div>
      </div>
    </div>
  );
};

RevenuePropertyFilters.displayName = 'RevenuePropertyFilters';
