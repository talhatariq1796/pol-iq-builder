/**
 * ChartAnimations
 *
 * Animation utilities and components for chart visualizations.
 * Includes entry/exit animations, loading skeletons, number counters, and transitions.
 */

'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';

// ============================================================================
// Animation Configuration
// ============================================================================

export const ANIMATION_DURATIONS = {
  fast: 200,
  normal: 400,
  slow: 800,
  chart: 1000,
} as const;

export const ANIMATION_EASINGS = {
  easeOut: [0.16, 1, 0.3, 1],
  easeInOut: [0.4, 0, 0.2, 1],
  spring: { type: 'spring', stiffness: 300, damping: 30 },
  bounce: { type: 'spring', stiffness: 400, damping: 10 },
} as const;

// ============================================================================
// Panel Entry/Exit Animations
// ============================================================================

export const panelVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: 20,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -10,
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 1, 1],
    },
  },
};

export const expandVariants: Variants = {
  collapsed: {
    width: 48,
    transition: {
      duration: 0.3,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  expanded: {
    width: 'auto',
    transition: {
      duration: 0.3,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

export const contentVariants: Variants = {
  hidden: {
    opacity: 0,
    height: 0,
    transition: {
      duration: 0.2,
    },
  },
  visible: {
    opacity: 1,
    height: 'auto',
    transition: {
      duration: 0.3,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

// ============================================================================
// Animated Panel Wrapper
// ============================================================================

interface AnimatedPanelProps {
  children: React.ReactNode;
  isVisible: boolean;
  isCollapsed?: boolean;
  className?: string;
}

export function AnimatedPanel({
  children,
  isVisible,
  isCollapsed = false,
  className = '',
}: AnimatedPanelProps) {
  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          variants={panelVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Loading Skeleton Animation
// ============================================================================

interface ChartSkeletonProps {
  type?: 'bar' | 'line' | 'pie' | 'area' | 'scatter';
  height?: number;
  className?: string;
}

export function ChartSkeleton({
  type = 'bar',
  height = 300,
  className = '',
}: ChartSkeletonProps) {
  const bars = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => ({
      height: 30 + Math.random() * 60,
      delay: i * 0.05,
    }));
  }, []);

  const renderSkeleton = () => {
    switch (type) {
      case 'bar':
        return (
          <div className="flex items-end justify-around h-full px-4 pb-8">
            {bars.map((bar, i) => (
              <motion.div
                key={i}
                className="w-8 bg-gradient-to-t from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-t"
                initial={{ height: 0 }}
                animate={{
                  height: `${bar.height}%`,
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  height: { duration: 0.5, delay: bar.delay },
                  opacity: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
                }}
              />
            ))}
          </div>
        );

      case 'line':
      case 'area':
        return (
          <div className="relative h-full px-4 pb-8">
            <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
              <motion.path
                d="M 0 150 Q 50 100 100 120 T 200 80 T 300 100 T 400 60"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-gray-300 dark:text-gray-600"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{
                  pathLength: 1,
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  pathLength: { duration: 1, ease: 'easeInOut' },
                  opacity: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
                }}
              />
              {type === 'area' && (
                <motion.path
                  d="M 0 150 Q 50 100 100 120 T 200 80 T 300 100 T 400 60 L 400 200 L 0 200 Z"
                  fill="currentColor"
                  className="text-gray-200 dark:text-gray-700"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0.3, 0.5, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
            </svg>
          </div>
        );

      case 'pie':
        return (
          <div className="flex items-center justify-center h-full">
            <motion.div
              className="w-40 h-40 rounded-full border-8 border-gray-200 dark:border-gray-700"
              animate={{
                rotate: 360,
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                rotate: { duration: 2, repeat: Infinity, ease: 'linear' },
                opacity: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
              }}
              style={{
                background: `conic-gradient(
                  from 0deg,
                  rgb(209 213 219) 0deg 120deg,
                  rgb(156 163 175) 120deg 220deg,
                  rgb(107 114 128) 220deg 360deg
                )`,
              }}
            />
          </div>
        );

      case 'scatter':
        return (
          <div className="relative h-full px-4 pb-8">
            {Array.from({ length: 12 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600"
                style={{
                  left: `${10 + Math.random() * 80}%`,
                  top: `${10 + Math.random() * 70}%`,
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{
                  scale: 1,
                  opacity: [0.4, 0.8, 0.4],
                }}
                transition={{
                  scale: { duration: 0.3, delay: i * 0.05 },
                  opacity: { duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.1 },
                }}
              />
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className={`relative bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden ${className}`}
      style={{ height }}
    >
      {/* Axis lines */}
      <div className="absolute left-8 top-4 bottom-8 w-px bg-gray-200 dark:bg-gray-700" />
      <div className="absolute left-8 right-4 bottom-8 h-px bg-gray-200 dark:bg-gray-700" />

      {renderSkeleton()}

      {/* Shimmer overlay */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent dark:via-white/5"
        initial={{ x: '-100%' }}
        animate={{ x: '100%' }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
    </div>
  );
}

// ============================================================================
// Number Counter Animation
// ============================================================================

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  format?: (value: number) => string;
  className?: string;
  prefix?: string;
  suffix?: string;
}

export function AnimatedNumber({
  value,
  duration = 1000,
  format = (v) => Math.round(v).toLocaleString(),
  className = '',
  prefix = '',
  suffix = '',
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const previousValue = useRef(0);
  const animationRef = useRef<number>();

  useEffect(() => {
    const startValue = previousValue.current;
    const endValue = value;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentValue = startValue + (endValue - startValue) * easeOut;

      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        previousValue.current = endValue;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration]);

  return (
    <span className={className}>
      {prefix}
      {format(displayValue)}
      {suffix}
    </span>
  );
}

// ============================================================================
// Data Point Hover Effect Wrapper
// ============================================================================

interface HoverEffectProps {
  children: React.ReactNode;
  isActive?: boolean;
  scale?: number;
  className?: string;
}

export function DataPointHoverEffect({
  children,
  isActive = false,
  scale = 1.1,
  className = '',
}: HoverEffectProps) {
  return (
    <motion.div
      className={className}
      whileHover={{ scale }}
      animate={isActive ? { scale, filter: 'brightness(1.1)' } : { scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      {children}
    </motion.div>
  );
}

// ============================================================================
// Chart Type Transition Wrapper
// ============================================================================

interface ChartTransitionProps {
  children: React.ReactNode;
  chartType: string;
  className?: string;
}

export function ChartTransition({
  children,
  chartType,
  className = '',
}: ChartTransitionProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={chartType}
        className={className}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{
          duration: 0.3,
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// ============================================================================
// Staggered List Animation
// ============================================================================

interface StaggeredListProps {
  children: React.ReactNode[];
  staggerDelay?: number;
  className?: string;
}

export function StaggeredList({
  children,
  staggerDelay = 0.05,
  className = '',
}: StaggeredListProps) {
  return (
    <div className={className}>
      {React.Children.map(children, (child: React.ReactNode, index: number) => (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.3,
            delay: index * staggerDelay,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}

// ============================================================================
// Pulse Animation for Emphasis
// ============================================================================

interface PulseProps {
  children: React.ReactNode;
  isActive?: boolean;
  color?: string;
  className?: string;
}

export function PulseEffect({
  children,
  isActive = true,
  color = 'rgba(59, 130, 246, 0.5)',
  className = '',
}: PulseProps) {
  if (!isActive) return <>{children}</>;

  return (
    <div className={`relative ${className}`}>
      {children}
      <motion.div
        className="absolute inset-0 rounded-lg pointer-events-none"
        style={{ boxShadow: `0 0 0 0 ${color}` }}
        animate={{
          boxShadow: [
            `0 0 0 0 ${color}`,
            `0 0 0 8px transparent`,
          ],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeOut',
        }}
      />
    </div>
  );
}

// ============================================================================
// Tooltip Animation
// ============================================================================

interface AnimatedTooltipProps {
  children: React.ReactNode;
  isVisible: boolean;
  className?: string;
}

export function AnimatedTooltip({
  children,
  isVisible,
  className = '',
}: AnimatedTooltipProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className={className}
          initial={{ opacity: 0, y: 5, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 5, scale: 0.95 }}
          transition={{
            duration: 0.15,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Recharts Animation Props Helper
// ============================================================================

export interface RechartsAnimationProps {
  isAnimationActive: boolean;
  animationDuration: number;
  animationEasing: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear';
  animationBegin: number;
}

export function getRechartsAnimationProps(
  animate: boolean = true,
  duration: number = ANIMATION_DURATIONS.chart,
  delay: number = 0
): RechartsAnimationProps {
  return {
    isAnimationActive: animate,
    animationDuration: duration,
    animationEasing: 'ease-out',
    animationBegin: delay,
  };
}

// ============================================================================
// Export All
// ============================================================================

export default {
  AnimatedPanel,
  ChartSkeleton,
  AnimatedNumber,
  DataPointHoverEffect,
  ChartTransition,
  StaggeredList,
  PulseEffect,
  AnimatedTooltip,
  getRechartsAnimationProps,
  ANIMATION_DURATIONS,
  ANIMATION_EASINGS,
  panelVariants,
  expandVariants,
  contentVariants,
};
