'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Target, FileText, TrendingUp, Check } from 'lucide-react';

interface DepthIndicatorProps {
  depth: number; // 0-100
  className?: string;
  onMilestoneUnlock?: (milestone: { threshold: number; label: string; unlocked: string }) => void;
}

const DEPTH_MILESTONES = [
  {
    threshold: 30,
    label: 'Save Segments',
    icon: Target,
    unlocked: 'segment saving',
    description: 'Save your exploration as a reusable segment'
  },
  {
    threshold: 60,
    label: 'Comparisons',
    icon: TrendingUp,
    unlocked: 'comparison analysis',
    description: 'Compare precincts side-by-side'
  },
  {
    threshold: 80,
    label: 'Full Reports',
    icon: FileText,
    unlocked: 'report generation',
    description: 'Generate comprehensive analysis reports'
  },
];

export function DepthIndicator({ depth, className = '', onMilestoneUnlock }: DepthIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [recentlyUnlocked, setRecentlyUnlocked] = useState<number | null>(null);
  const previousDepthRef = useRef(depth);

  const depthLabel = depth < 30 ? 'Exploring' :
                     depth < 60 ? 'Analyzing' :
                     depth < 80 ? 'Deep Analysis' : 'Expert Mode';

  // Find next milestone
  const nextMilestone = DEPTH_MILESTONES.find(m => depth < m.threshold);

  // Find unlocked milestones
  const unlockedMilestones = DEPTH_MILESTONES.filter(m => depth >= m.threshold);

  // Detect milestone crossings
  useEffect(() => {
    const prevDepth = previousDepthRef.current;

    for (const milestone of DEPTH_MILESTONES) {
      if (prevDepth < milestone.threshold && depth >= milestone.threshold) {
        // Milestone just unlocked
        setRecentlyUnlocked(milestone.threshold);
        onMilestoneUnlock?.(milestone);

        // Clear the animation after 2 seconds
        setTimeout(() => setRecentlyUnlocked(null), 2000);
        break;
      }
    }

    previousDepthRef.current = depth;
  }, [depth, onMilestoneUnlock]);

  return (
    <div
      className={`relative flex items-center gap-3 ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Progress bar with animation */}
      <div className="flex items-center gap-2">
        <Sparkles className={`w-3.5 h-3.5 text-[#33a852] ${recentlyUnlocked ? 'animate-pulse' : ''}`} />
        <div className="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r from-[#33a852] to-[#2d9944] transition-all duration-500 ${
              recentlyUnlocked ? 'animate-pulse' : ''
            }`}
            style={{ width: `${Math.min(depth, 100)}%` }}
          />
        </div>
      </div>

      {/* Label */}
      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
        {depthLabel}
      </span>

      {/* Unlocked milestone badges */}
      {unlockedMilestones.length > 0 && (
        <div className="hidden sm:flex items-center gap-1">
          {unlockedMilestones.map((milestone) => {
            const isRecent = recentlyUnlocked === milestone.threshold;
            return (
              <div
                key={milestone.threshold}
                className={`w-4 h-4 rounded-full bg-[#33a852] flex items-center justify-center ${
                  isRecent ? 'animate-bounce' : ''
                }`}
                title={`${milestone.label} unlocked`}
              >
                <Check className="w-2.5 h-2.5 text-white" />
              </div>
            );
          })}
        </div>
      )}


      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            Exploration Depth: {Math.round(depth)}%
          </div>
          <div className="space-y-2">
            {DEPTH_MILESTONES.map((milestone) => {
              const Icon = milestone.icon;
              const isUnlocked = depth >= milestone.threshold;
              return (
                <div
                  key={milestone.threshold}
                  className={`flex items-start gap-2 text-xs ${
                    isUnlocked ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'
                  }`}
                >
                  <div className={`mt-0.5 ${isUnlocked ? 'text-[#33a852]' : ''}`}>
                    {isUnlocked ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <span className="font-medium">{milestone.label}</span>
                    <span className="text-gray-400 ml-1">({milestone.threshold}%)</span>
                    <p className="text-gray-500 dark:text-gray-400">{milestone.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
