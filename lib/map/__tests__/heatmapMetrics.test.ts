/**
 * Tests for Heatmap Metric Configuration
 *
 * Verifies that metric resolution and configuration work correctly.
 */

import {
  resolveHeatmapMetric,
  getMetricConfig,
  getAvailableMetrics,
  isValidMetric,
  DEFAULT_HEATMAP_METRIC,
  HEATMAP_METRIC_MAPPING,
  type HeatmapMetricName,
} from '../heatmapMetrics';
import type { H3Metric } from '@/components/political-analysis';

describe('heatmapMetrics', () => {
  describe('resolveHeatmapMetric', () => {
    it('should resolve canonical metric names', () => {
      expect(resolveHeatmapMetric('partisan_lean')).toBe('partisan_lean');
      expect(resolveHeatmapMetric('gotv_priority')).toBe('gotv_priority');
      expect(resolveHeatmapMetric('persuasion_opportunity')).toBe('persuasion_opportunity');
      expect(resolveHeatmapMetric('combined_score')).toBe('combined_score');
    });

    it('should resolve metric aliases', () => {
      expect(resolveHeatmapMetric('gotv')).toBe('gotv_priority');
      expect(resolveHeatmapMetric('persuasion')).toBe('persuasion_opportunity');
      expect(resolveHeatmapMetric('combined')).toBe('combined_score');
      expect(resolveHeatmapMetric('turnout')).toBe('gotv_priority');
      // swing_potential is a canonical metric, not an alias
      expect(resolveHeatmapMetric('swing_potential')).toBe('swing_potential');
    });

    it('should handle case-insensitive input', () => {
      expect(resolveHeatmapMetric('GOTV')).toBe('gotv_priority');
      expect(resolveHeatmapMetric('Partisan_Lean')).toBe('partisan_lean');
      expect(resolveHeatmapMetric('PERSUASION_OPPORTUNITY')).toBe('persuasion_opportunity');
    });

    it('should handle whitespace', () => {
      expect(resolveHeatmapMetric(' gotv ')).toBe('gotv_priority');
      expect(resolveHeatmapMetric('\tpartisan_lean\n')).toBe('partisan_lean');
    });

    it('should return default for invalid metrics', () => {
      expect(resolveHeatmapMetric('invalid')).toBe(DEFAULT_HEATMAP_METRIC);
      expect(resolveHeatmapMetric('unknown_metric')).toBe(DEFAULT_HEATMAP_METRIC);
      expect(resolveHeatmapMetric('')).toBe(DEFAULT_HEATMAP_METRIC);
    });

    it('should return default for undefined/null', () => {
      expect(resolveHeatmapMetric(undefined)).toBe(DEFAULT_HEATMAP_METRIC);
      expect(resolveHeatmapMetric()).toBe(DEFAULT_HEATMAP_METRIC);
    });
  });

  describe('getMetricConfig', () => {
    it('should return config for canonical metrics', () => {
      const config = getMetricConfig('gotv_priority');
      expect(config.canonical).toBe('gotv_priority');
      expect(config.label).toBe('GOTV Priority');
      expect(config.description).toContain('Get-out-the-vote');
    });

    it('should return config for aliases', () => {
      const config = getMetricConfig('gotv');
      expect(config.canonical).toBe('gotv_priority');
      expect(config.label).toBe('GOTV Priority');
    });

    it('should return config for invalid metrics (using default)', () => {
      const config = getMetricConfig('invalid');
      expect(config.canonical).toBe(DEFAULT_HEATMAP_METRIC);
    });
  });

  describe('getAvailableMetrics', () => {
    it('should return all available metrics', () => {
      const metrics = getAvailableMetrics();
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics.every(m => m.value && m.config)).toBe(true);
    });

    it('should return metrics with proper structure', () => {
      const metrics = getAvailableMetrics();
      metrics.forEach(({ value, config }) => {
        expect(typeof value).toBe('string');
        expect(config.canonical).toBe(value);
        expect(typeof config.label).toBe('string');
        expect(typeof config.description).toBe('string');
        expect(['diverging', 'sequential']).toContain(config.colorScheme);
      });
    });
  });

  describe('isValidMetric', () => {
    it('should return true for canonical metrics', () => {
      expect(isValidMetric('partisan_lean')).toBe(true);
      expect(isValidMetric('gotv_priority')).toBe(true);
      expect(isValidMetric('persuasion_opportunity')).toBe(true);
      expect(isValidMetric('combined_score')).toBe(true);
    });

    it('should return true for aliases', () => {
      expect(isValidMetric('gotv')).toBe(true);
      expect(isValidMetric('persuasion')).toBe(true);
      expect(isValidMetric('combined')).toBe(true);
      expect(isValidMetric('turnout')).toBe(true);
      expect(isValidMetric('swing_potential')).toBe(true);
    });

    it('should return false for invalid metrics', () => {
      expect(isValidMetric('invalid')).toBe(false);
      expect(isValidMetric('unknown')).toBe(false);
      expect(isValidMetric('')).toBe(false);
    });

    it('should handle case-insensitive validation', () => {
      expect(isValidMetric('GOTV')).toBe(true);
      expect(isValidMetric('Partisan_Lean')).toBe(true);
    });
  });

  describe('HEATMAP_METRIC_MAPPING', () => {
    it('should map all recognized names', () => {
      const recognizedNames: HeatmapMetricName[] = [
        'partisan_lean',
        'swing_potential',
        'gotv_priority',
        'gotv',
        'persuasion_opportunity',
        'persuasion',
        'combined_score',
        'combined',
        'turnout',
      ];

      recognizedNames.forEach(name => {
        expect(HEATMAP_METRIC_MAPPING[name]).toBeDefined();
      });
    });

    it('should map to valid H3Metric values', () => {
      // All canonical H3Metric values as defined in H3HeatmapLayer.tsx
      const validH3Metrics: H3Metric[] = [
        'partisan_lean',
        'swing_potential',
        'gotv_priority',
        'persuasion_opportunity',
        'combined_score',
      ];

      Object.values(HEATMAP_METRIC_MAPPING).forEach(value => {
        expect(validH3Metrics).toContain(value);
      });
    });
  });

  describe('Integration with current metric system', () => {
    // These tests verify the centralized config behavior
    // Note: swing_potential is now a distinct metric (not an alias for partisan_lean)

    const expectedMapping: Record<string, string> = {
      'partisan_lean': 'partisan_lean',
      'swing_potential': 'swing_potential', // Now a distinct metric
      'gotv_priority': 'gotv_priority',
      'gotv': 'gotv_priority',
      'persuasion_opportunity': 'persuasion_opportunity',
      'persuasion': 'persuasion_opportunity',
      'combined_score': 'combined_score',
      'combined': 'combined_score',
    };

    it('should resolve metrics correctly', () => {
      Object.entries(expectedMapping).forEach(([input, expected]) => {
        expect(resolveHeatmapMetric(input)).toBe(expected);
      });
    });

    it('should use same default as old code', () => {
      expect(DEFAULT_HEATMAP_METRIC).toBe('partisan_lean');
    });
  });
});
