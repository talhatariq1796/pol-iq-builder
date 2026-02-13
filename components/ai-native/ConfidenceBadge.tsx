'use client';

/**
 * ConfidenceBadge - Visual indicator of data confidence level
 * Phase 14 Enhanced Implementation
 *
 * Displays confidence level with emoji, optional tooltip, and styling.
 */

import React, { useState } from 'react';
import type { ConfidenceLevel, ConfidenceMetadata } from '@/lib/ai/confidence';
import { CONFIDENCE_INDICATORS } from '@/lib/ai/confidence';

interface ConfidenceBadgeProps {
  level: ConfidenceLevel;
  confidence?: ConfidenceMetadata;
  showLabel?: boolean;
  showScore?: boolean;
  showTooltip?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ConfidenceBadge({
  level,
  confidence,
  showLabel = false,
  showScore = false,
  showTooltip = true,
  size = 'md',
  className = '',
}: ConfidenceBadgeProps) {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const indicator = CONFIDENCE_INDICATORS[level];

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const emojiSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 relative ${className}`}
      onMouseEnter={() => setIsTooltipVisible(true)}
      onMouseLeave={() => setIsTooltipVisible(false)}
    >
      {/* Emoji indicator */}
      <span className={emojiSizes[size]} title={indicator.label}>
        {indicator.emoji}
      </span>

      {/* Optional label */}
      {showLabel && (
        <span
          className={`${sizeClasses[size]} font-medium`}
          style={{ color: indicator.color }}
        >
          {indicator.label}
        </span>
      )}

      {/* Optional score */}
      {showScore && confidence && (
        <span className={`${sizeClasses[size]} text-slate-500`}>
          ({confidence.score}/100)
        </span>
      )}

      {/* Tooltip */}
      {showTooltip && isTooltipVisible && confidence && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 z-50">
          <div className="bg-slate-900 text-white text-xs rounded-lg p-3 shadow-lg">
            <div className="font-semibold mb-1" style={{ color: indicator.color }}>
              {indicator.label} ({confidence.score}/100)
            </div>
            <p className="text-slate-300 mb-2">{indicator.description}</p>
            {confidence.explanation && (
              <p className="text-slate-400 text-xs">{confidence.explanation}</p>
            )}
            {confidence.range && (
              <p className="text-slate-400 text-xs mt-1">
                Range: {confidence.range.low.toFixed(1)} to{' '}
                {confidence.range.high.toFixed(1)}
                {confidence.range.unit ? ` ${confidence.range.unit}` : ''}
              </p>
            )}
            {confidence.methodology && (
              <a
                href={confidence.methodology}
                className="text-blue-400 hover:text-blue-300 text-xs mt-1 block"
              >
                View methodology →
              </a>
            )}
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
          </div>
        </div>
      )}
    </span>
  );
}

/**
 * ConfidenceBar - Visual progress bar showing confidence
 */
interface ConfidenceBarProps {
  score: number;
  level: ConfidenceLevel;
  showLabel?: boolean;
  height?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ConfidenceBar({
  score,
  level,
  showLabel = true,
  height = 'md',
  className = '',
}: ConfidenceBarProps) {
  const indicator = CONFIDENCE_INDICATORS[level];

  const heightClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-slate-500">{indicator.label}</span>
          <span className="text-xs font-medium" style={{ color: indicator.color }}>
            {score}/100
          </span>
        </div>
      )}
      <div className={`w-full bg-slate-200 rounded-full ${heightClasses[height]}`}>
        <div
          className={`${heightClasses[height]} rounded-full transition-all duration-300`}
          style={{
            width: `${score}%`,
            backgroundColor: indicator.color,
          }}
        />
      </div>
    </div>
  );
}

/**
 * ConfidenceSummary - Full confidence summary card
 */
interface ConfidenceSummaryProps {
  confidence: ConfidenceMetadata;
  title?: string;
  compact?: boolean;
  className?: string;
}

export function ConfidenceSummary({
  confidence,
  title,
  compact = false,
  className = '',
}: ConfidenceSummaryProps) {
  const indicator = CONFIDENCE_INDICATORS[confidence.level];

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <ConfidenceBadge level={confidence.level} showTooltip={false} />
        <span className="text-sm text-slate-600">{confidence.explanation}</span>
      </div>
    );
  }

  return (
    <div
      className={`bg-white border rounded-lg p-4 ${className}`}
      style={{ borderColor: `${indicator.color}40` }}
    >
      {title && (
        <h4 className="text-sm font-semibold text-slate-700 mb-2">{title}</h4>
      )}

      <div className="flex items-center gap-3 mb-3">
        <ConfidenceBadge
          level={confidence.level}
          confidence={confidence}
          showLabel
          showScore
          showTooltip={false}
          size="lg"
        />
      </div>

      <ConfidenceBar
        score={confidence.score}
        level={confidence.level}
        showLabel={false}
        height="sm"
      />

      <p className="text-sm text-slate-600 mt-3">{confidence.explanation}</p>

      {confidence.range && (
        <div className="mt-2 text-xs text-slate-500">
          Confidence interval: {confidence.range.low.toFixed(1)} to{' '}
          {confidence.range.high.toFixed(1)}
          {confidence.range.unit ? ` ${confidence.range.unit}` : ''}
        </div>
      )}

      {/* Factors breakdown */}
      {confidence.factors && Object.keys(confidence.factors).length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="text-xs font-medium text-slate-500 mb-2">
            Confidence factors:
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {confidence.factors.sampleSize !== undefined && (
              <div className="text-slate-600">
                Sample size: {confidence.factors.sampleSize}
              </div>
            )}
            {confidence.factors.dataRecency !== undefined && (
              <div className="text-slate-600">
                Data age: {confidence.factors.dataRecency} years
              </div>
            )}
            {confidence.factors.sourceReliability !== undefined && (
              <div className="text-slate-600">
                Source reliability:{' '}
                {Math.round(confidence.factors.sourceReliability * 100)}%
              </div>
            )}
            {confidence.factors.dataCompleteness !== undefined && (
              <div className="text-slate-600">
                Completeness:{' '}
                {Math.round(confidence.factors.dataCompleteness * 100)}%
              </div>
            )}
            {confidence.factors.redistrictingStatus && (
              <div className="text-slate-600">
                Boundaries: {confidence.factors.redistrictingStatus}
              </div>
            )}
          </div>
        </div>
      )}

      {confidence.methodology && (
        <a
          href={confidence.methodology}
          className="block mt-3 text-xs text-blue-600 hover:text-blue-700"
        >
          View detailed methodology →
        </a>
      )}
    </div>
  );
}

export default ConfidenceBadge;
