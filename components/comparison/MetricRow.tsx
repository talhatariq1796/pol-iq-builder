'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricRowProps {
  metricName: string;
  leftValue: number;
  rightValue: number;
  difference: number;
  percentDiff: number;
  isSignificant: boolean;
  direction: 'left-higher' | 'right-higher' | 'equal';
  formatType: 'number' | 'currency' | 'percent' | 'points';
}

export function MetricRow({
  metricName,
  leftValue,
  rightValue,
  difference,
  percentDiff,
  isSignificant,
  direction,
  formatType,
}: MetricRowProps) {
  // Format value based on type
  const formatValue = (value: number): string => {
    switch (formatType) {
      case 'currency':
        return `$${value.toLocaleString()}`;
      case 'percent':
        return `${value.toFixed(1)}%`;
      case 'points':
        return `${value > 0 ? '+' : ''}${value.toFixed(1)}`;
      case 'number':
      default:
        return value.toLocaleString();
    }
  };

  // Format difference
  const formatDifference = (): string => {
    if (direction === 'equal') return '≈ 0';
    const sign = difference > 0 ? '+' : '';
    return `${sign}${formatValue(Math.abs(difference))}`;
  };

  // Get direction icon
  const DirectionIcon = () => {
    if (direction === 'equal') return <Minus className="h-3 w-3 text-gray-400" />;
    if (direction === 'left-higher')
      return <TrendingUp className="h-3 w-3 text-blue-600 dark:text-blue-400" />;
    return <TrendingDown className="h-3 w-3 text-red-600 dark:text-red-400" />;
  };

  // Get color for difference badge
  const getDifferenceBadgeColor = (): string => {
    if (!isSignificant) return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    if (direction === 'left-higher')
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    if (direction === 'right-higher')
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
  };

  // Calculate bar widths for 0-100 scores
  const isScore = leftValue <= 100 && rightValue <= 100 && leftValue >= 0 && rightValue >= 0;

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
      {/* Left Value */}
      <div className="text-right">
        <span className="font-semibold text-sm">{formatValue(leftValue)}</span>
        {isScore && (
          <div className="mt-1 h-1 bg-blue-200 dark:bg-blue-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 dark:bg-blue-400 rounded-full"
              style={{ width: `${leftValue}%` }}
            />
          </div>
        )}
      </div>

      {/* Metric Name & Difference */}
      <div className="flex flex-col items-center min-w-[140px] px-2">
        <span className="text-xs text-muted-foreground text-center mb-1">{metricName}</span>
        <div className="flex items-center gap-1">
          <DirectionIcon />
          <Badge
            variant="outline"
            className={`text-xs font-mono px-1.5 py-0 ${getDifferenceBadgeColor()}`}
          >
            {formatDifference()}
          </Badge>
        </div>
        {isSignificant && (
          <span className="text-xs text-orange-600 dark:text-orange-400 font-medium mt-0.5">
            {Math.abs(percentDiff).toFixed(0)}% diff
          </span>
        )}
      </div>

      {/* Right Value */}
      <div className="text-left">
        <span className="font-semibold text-sm">{formatValue(rightValue)}</span>
        {isScore && (
          <div className="mt-1 h-1 bg-red-200 dark:bg-red-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-600 dark:bg-red-400 rounded-full"
              style={{ width: `${rightValue}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
