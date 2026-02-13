"use client";

import React, { useMemo } from 'react';
import { TrendingUp, DollarSign, Clock, Home } from 'lucide-react';
import { CMAProperty } from './types';

interface CMAStatsPreviewProps {
  properties: CMAProperty[];
  isLoading?: boolean;
}

/**
 * Compact quick stats preview panel for CMA analysis
 * Shows aggregate statistics in a 2-column grid layout
 */
export function CMAStatsPreview({ properties, isLoading = false }: CMAStatsPreviewProps) {
  // Helper to get square footage from property (handles multiple field names)
  // Priority: squareFootage > square_footage > living_area
  const getSqft = (p: CMAProperty): number => {
    return p.squareFootage || (p as any).square_footage || p.living_area || 0;
  };

  // Calculate stats with useMemo for efficient recalculation
  const stats = useMemo(() => {
    if (properties.length === 0) {
      return {
        avgPrice: 0,
        avgPricePerSqft: 0,
        avgDaysOnMarket: 0,
        soldCount: 0,
        activeCount: 0,
        totalCount: 0,
      };
    }

    // Filter properties with valid data for each calculation
    const validPrices = properties.filter(p => p.price > 0);
    const validSqft = properties.filter(p => p.price > 0 && getSqft(p) > 0);
    const validDOM = properties.filter(p => (p.time_on_market || 0) > 0);

    const soldCount = properties.filter(p =>
      p.status === 'sold' || p.st?.toUpperCase() === 'SO'
    ).length;

    const activeCount = properties.filter(p =>
      p.status === 'active' || p.st?.toUpperCase() === 'AC'
    ).length;

    return {
      avgPrice: validPrices.length > 0
        ? Math.round(validPrices.reduce((sum, p) => sum + p.price, 0) / validPrices.length)
        : 0,
      avgPricePerSqft: validSqft.length > 0
        ? Math.round(validSqft.reduce((sum, p) => sum + (p.price / getSqft(p)), 0) / validSqft.length)
        : 0,
      avgDaysOnMarket: validDOM.length > 0
        ? Math.round(validDOM.reduce((sum, p) => sum + (p.time_on_market || 0), 0) / validDOM.length)
        : 0,
      soldCount,
      activeCount,
      totalCount: properties.length,
    };
  }, [properties]);

  // Format currency values
  const formatCurrency = (value: number): string => {
    if (value === 0) return 'N/A';
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    }
    return `$${value.toLocaleString()}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#660D39]"></div>
        <span className="text-xs text-[#484247]">Calculating...</span>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="p-3 bg-gray-50 rounded-lg border text-center">
        <p className="text-xs text-[#484247]/60">No properties to analyze</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-lg border">
      {/* Avg Price */}
      <div className="flex items-center gap-2">
        <DollarSign className="h-3.5 w-3.5 text-[#660D39] flex-shrink-0" />
        <span className="text-xs text-[#484247]">Avg:</span>
        <span className="text-xs font-semibold text-[#660D39]">{formatCurrency(stats.avgPrice)}</span>
      </div>

      {/* Avg $/sqft */}
      <div className="flex items-center gap-2">
        <TrendingUp className="h-3.5 w-3.5 text-[#660D39] flex-shrink-0" />
        <span className="text-xs text-[#484247]">$/sqft:</span>
        <span className="text-xs font-semibold text-[#660D39]">
          {stats.avgPricePerSqft > 0 ? `$${stats.avgPricePerSqft}` : 'N/A'}
        </span>
      </div>

      {/* Avg DOM */}
      <div className="flex items-center gap-2">
        <Clock className="h-3.5 w-3.5 text-[#660D39] flex-shrink-0" />
        <span className="text-xs text-[#484247]">DOM:</span>
        <span className="text-xs font-semibold text-[#660D39]">
          {stats.avgDaysOnMarket > 0 ? `${stats.avgDaysOnMarket}d` : 'N/A'}
        </span>
      </div>

      {/* Properties Count */}
      <div className="flex items-center gap-2">
        <Home className="h-3.5 w-3.5 text-[#660D39] flex-shrink-0" />
        <span className="text-xs text-[#484247]">Props:</span>
        <span className="text-xs font-semibold text-[#660D39]">
          {stats.totalCount} ({stats.soldCount}S/{stats.activeCount}A)
        </span>
      </div>
    </div>
  );
}
