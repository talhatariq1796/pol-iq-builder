/**
 * useToolUrlParams Utility Tests
 *
 * Tests URL parameter building and validation utilities.
 * Run with: npm test -- --testPathPattern=useToolUrlParams
 */

import {
  buildQueryString,
  hasUrlParams,
  type ToolUrlParams,
} from '@/lib/ai-native/hooks/useToolUrlParams';

describe('useToolUrlParams Utilities', () => {
  // ========================================
  // buildQueryString Tests
  // ========================================
  describe('buildQueryString', () => {
    test('returns empty string for empty params', () => {
      expect(buildQueryString({})).toBe('');
    });

    test('builds query string with single string param', () => {
      expect(buildQueryString({ segment: 'high-gotv' })).toBe('?segment=high-gotv');
    });

    test('builds query string with single array param', () => {
      expect(buildQueryString({ precincts: ['P001', 'P002'] })).toBe('?precincts=P001,P002');
    });

    test('builds query string with multiple params', () => {
      const result = buildQueryString({
        precincts: ['P001', 'P002'],
        segment: 'test',
        metric: 'gotv_priority',
      });
      expect(result).toContain('?');
      expect(result).toContain('precincts=P001,P002');
      expect(result).toContain('segment=test');
      expect(result).toContain('metric=gotv_priority');
    });

    test('URL-encodes string values', () => {
      expect(buildQueryString({ segment: 'high gotv priority' })).toBe('?segment=high%20gotv%20priority');
    });

    test('URL-encodes special characters', () => {
      expect(buildQueryString({ segment: 'test&value' })).toBe('?segment=test%26value');
    });

    test('ignores undefined values', () => {
      expect(buildQueryString({ segment: undefined })).toBe('');
    });

    test('ignores null values', () => {
      expect(buildQueryString({ segment: null as unknown as string })).toBe('');
    });

    test('ignores empty arrays', () => {
      expect(buildQueryString({ precincts: [] })).toBe('');
    });

    test('handles mixed defined and undefined values', () => {
      const result = buildQueryString({
        segment: 'test',
        precincts: undefined,
        metric: 'gotv_priority',
      });
      expect(result).toContain('segment=test');
      expect(result).toContain('metric=gotv_priority');
      expect(result).not.toContain('precincts');
    });

    test('handles numeric values', () => {
      expect(buildQueryString({ volunteers: 5 })).toBe('?volunteers=5');
    });

    test('handles year parameter', () => {
      expect(buildQueryString({ year: 2024 })).toBe('?year=2024');
    });

    test('handles month parameter', () => {
      expect(buildQueryString({ month: 11 })).toBe('?month=11');
    });

    test('handles view parameter', () => {
      expect(buildQueryString({ view: 'timeSeries' })).toBe('?view=timeSeries');
    });

    test('handles left and right comparison params', () => {
      const result = buildQueryString({
        left: 'lansing',
        right: 'east-lansing',
      });
      expect(result).toContain('left=lansing');
      expect(result).toContain('right=east-lansing');
    });

    test('handles zips parameter', () => {
      expect(buildQueryString({ zips: ['48823', '48864'] })).toBe('?zips=48823,48864');
    });

    test('handles turfs parameter', () => {
      expect(buildQueryString({ turfs: ['turf-1', 'turf-2'] })).toBe('?turfs=turf-1,turf-2');
    });

    test('handles filter parameter', () => {
      expect(buildQueryString({ filter: 'swing-voters' })).toBe('?filter=swing-voters');
    });

    test('joins array values with commas without encoding', () => {
      // Arrays should be comma-joined without URL encoding the commas
      const result = buildQueryString({ precincts: ['P001', 'P002', 'P003'] });
      expect(result).toBe('?precincts=P001,P002,P003');
      expect(result).not.toContain('%2C'); // No encoded commas
    });

    test('handles single-item arrays', () => {
      expect(buildQueryString({ precincts: ['P001'] })).toBe('?precincts=P001');
    });

    test('handles all ToolUrlParams fields', () => {
      const fullParams: ToolUrlParams = {
        precincts: ['P001'],
        segment: 'test-segment',
        zips: ['48823'],
        left: 'lansing',
        right: 'east-lansing',
        filter: 'swing',
        metric: 'gotv_priority',
        view: 'timeSeries',
        turfs: ['turf-1'],
        volunteers: 5,
        year: 2024,
        month: 11,
      };
      const result = buildQueryString(fullParams);

      expect(result).toContain('precincts=P001');
      expect(result).toContain('segment=test-segment');
      expect(result).toContain('zips=48823');
      expect(result).toContain('left=lansing');
      expect(result).toContain('right=east-lansing');
      expect(result).toContain('filter=swing');
      expect(result).toContain('metric=gotv_priority');
      expect(result).toContain('view=timeSeries');
      expect(result).toContain('turfs=turf-1');
      expect(result).toContain('volunteers=5');
      expect(result).toContain('year=2024');
      expect(result).toContain('month=11');
    });
  });

  // ========================================
  // hasUrlParams Tests
  // ========================================
  describe('hasUrlParams', () => {
    test('returns false for empty params object', () => {
      expect(hasUrlParams({})).toBe(false);
    });

    test('returns true for params with precincts', () => {
      expect(hasUrlParams({ precincts: ['P001'] })).toBe(true);
    });

    test('returns true for params with segment', () => {
      expect(hasUrlParams({ segment: 'test' })).toBe(true);
    });

    test('returns true for params with zips', () => {
      expect(hasUrlParams({ zips: ['48823'] })).toBe(true);
    });

    test('returns true for params with left', () => {
      expect(hasUrlParams({ left: 'lansing' })).toBe(true);
    });

    test('returns true for params with right', () => {
      expect(hasUrlParams({ right: 'east-lansing' })).toBe(true);
    });

    test('returns true for params with filter', () => {
      expect(hasUrlParams({ filter: 'swing' })).toBe(true);
    });

    test('returns true for params with metric', () => {
      expect(hasUrlParams({ metric: 'gotv_priority' })).toBe(true);
    });

    test('returns true for params with view', () => {
      expect(hasUrlParams({ view: 'timeSeries' })).toBe(true);
    });

    test('returns true for params with turfs', () => {
      expect(hasUrlParams({ turfs: ['turf-1'] })).toBe(true);
    });

    test('returns true for params with volunteers', () => {
      expect(hasUrlParams({ volunteers: 5 })).toBe(true);
    });

    test('returns true for params with year', () => {
      expect(hasUrlParams({ year: 2024 })).toBe(true);
    });

    test('returns true for params with month', () => {
      expect(hasUrlParams({ month: 11 })).toBe(true);
    });

    test('returns true for params with multiple fields', () => {
      expect(hasUrlParams({
        precincts: ['P001'],
        segment: 'test',
        metric: 'gotv_priority',
      })).toBe(true);
    });

    // Note: hasUrlParams only checks if object has keys, not if values are valid
    test('returns true even for empty array values', () => {
      expect(hasUrlParams({ precincts: [] })).toBe(true);
    });

    test('returns true even for undefined values', () => {
      expect(hasUrlParams({ segment: undefined })).toBe(true);
    });
  });

  // ========================================
  // ToolUrlParams Type Tests
  // ========================================
  describe('ToolUrlParams Type Coverage', () => {
    test('accepts all valid view types', () => {
      const validViews: ToolUrlParams['view'][] = [
        'zip',
        'timeSeries',
        'occupations',
        'committees',
        'ies',
        'lapsed',
        'upgrade',
      ];

      validViews.forEach(view => {
        const params: ToolUrlParams = { view };
        expect(hasUrlParams(params)).toBe(true);
      });
    });

    test('handles precincts array correctly', () => {
      const params: ToolUrlParams = {
        precincts: ['EL-P1', 'EL-P2', 'L-P3'],
      };
      const result = buildQueryString(params);
      expect(result).toBe('?precincts=EL-P1,EL-P2,L-P3');
    });

    test('handles ZIPs with mixed formats', () => {
      const params: ToolUrlParams = {
        zips: ['48823', '48864-1234'],
      };
      const result = buildQueryString(params);
      expect(result).toBe('?zips=48823,48864-1234');
    });

    test('handles comparison entities with special names', () => {
      const params: ToolUrlParams = {
        left: 'east-lansing',
        right: 'delhi-charter-township',
      };
      const result = buildQueryString(params);
      expect(result).toContain('left=east-lansing');
      expect(result).toContain('right=delhi-charter-township');
    });
  });

  // ========================================
  // Edge Cases
  // ========================================
  describe('Edge Cases', () => {
    test('handles very long precinct arrays', () => {
      const precincts = Array.from({ length: 50 }, (_, i) => `P${String(i).padStart(3, '0')}`);
      const result = buildQueryString({ precincts });
      expect(result).toContain('precincts=P000');
      expect(result).toContain('P049');
    });

    test('handles segment names with unicode', () => {
      const result = buildQueryString({ segment: 'café-voters' });
      expect(result).toContain('caf%C3%A9-voters');
    });

    test('handles segment names with quotes', () => {
      const result = buildQueryString({ segment: '"high priority"' });
      expect(result).toContain('%22high%20priority%22');
    });

    test('handles zero values for numeric params', () => {
      expect(buildQueryString({ volunteers: 0 })).toBe('?volunteers=0');
      expect(buildQueryString({ year: 0 })).toBe('?year=0');
      expect(buildQueryString({ month: 0 })).toBe('?month=0');
    });

    test('handles boolean-like string values', () => {
      expect(buildQueryString({ segment: 'true' })).toBe('?segment=true');
      expect(buildQueryString({ segment: 'false' })).toBe('?segment=false');
    });

    test('handles empty string values', () => {
      // Empty strings should still be included
      expect(buildQueryString({ segment: '' })).toBe('?segment=');
    });
  });

  // ========================================
  // Query String Parsing Roundtrip
  // ========================================
  describe('Query String Roundtrip', () => {
    test('buildQueryString output can be parsed by URLSearchParams', () => {
      const params: ToolUrlParams = {
        precincts: ['P001', 'P002'],
        segment: 'high-gotv',
        metric: 'swing_potential',
      };

      const queryString = buildQueryString(params);
      const parsed = new URLSearchParams(queryString.substring(1)); // Remove leading ?

      expect(parsed.get('precincts')).toBe('P001,P002');
      expect(parsed.get('segment')).toBe('high-gotv');
      expect(parsed.get('metric')).toBe('swing_potential');
    });

    test('encoded values are properly decoded by URLSearchParams', () => {
      const params: ToolUrlParams = {
        segment: 'high gotv & swing',
      };

      const queryString = buildQueryString(params);
      const parsed = new URLSearchParams(queryString.substring(1));

      expect(parsed.get('segment')).toBe('high gotv & swing');
    });
  });
});
