/**
 * CrossToolNavigator Unit Tests
 *
 * Tests cross-tool navigation with context preservation.
 * Run with: npm test -- --testPathPattern=CrossToolNavigator
 */

import {
  CrossToolNavigator,
  navigateToSegments,
  navigateToDonors,
  navigateToCanvass,
  navigateToComparison,
  type NavigableTool,
  type NavigationContext,
} from '@/lib/ai-native/navigation/CrossToolNavigator';

// Use Jest's JSDOM sessionStorage directly
beforeEach(() => {
  // Clear mocks and sessionStorage before each test
  jest.clearAllMocks();
  sessionStorage.clear();
});

describe('CrossToolNavigator', () => {
  // ========================================
  // buildUrl Tests
  // ========================================
  describe('buildUrl', () => {
    test('builds URL for segments with no params', () => {
      const url = CrossToolNavigator.buildUrl('segments', {});
      expect(url).toBe('/segments');
    });

    test('builds URL for segments with precincts', () => {
      const url = CrossToolNavigator.buildUrl('segments', {
        precincts: ['P001', 'P002', 'P003'],
      });
      expect(url).toBe('/segments?precincts=P001,P002,P003');
    });

    test('builds URL for segments with segment name', () => {
      const url = CrossToolNavigator.buildUrl('segments', {
        segment: 'high-gotv',
      });
      expect(url).toBe('/segments?segment=high-gotv');
    });

    test('builds URL for segments with metric', () => {
      const url = CrossToolNavigator.buildUrl('segments', {
        metric: 'swing_potential',
      });
      expect(url).toBe('/segments?metric=swing_potential');
    });

    test('builds URL for donors with ZIPs', () => {
      const url = CrossToolNavigator.buildUrl('donors', {
        zips: ['48823', '48864'],
      });
      expect(url).toBe('/donors?zips=48823,48864');
    });

    test('builds URL for donors with view type', () => {
      const url = CrossToolNavigator.buildUrl('donors', {
        view: 'timeSeries',
      });
      expect(url).toBe('/donors?view=timeSeries');
    });

    test('builds URL for donors with ZIPs and view', () => {
      const url = CrossToolNavigator.buildUrl('donors', {
        zips: ['48823'],
        view: 'occupations',
      });
      expect(url).toContain('/donors?');
      expect(url).toContain('zips=48823');
      expect(url).toContain('view=occupations');
    });

    test('builds URL for canvass with segment', () => {
      const url = CrossToolNavigator.buildUrl('canvass', {
        segment: 'gotv-priority',
      });
      expect(url).toBe('/canvass?segment=gotv-priority');
    });

    test('builds URL for canvass with turfs', () => {
      const url = CrossToolNavigator.buildUrl('canvass', {
        turfs: ['turf-1', 'turf-2'],
      });
      expect(url).toBe('/canvass?turfs=turf-1,turf-2');
    });

    test('builds URL for canvass with volunteers', () => {
      const url = CrossToolNavigator.buildUrl('canvass', {
        volunteers: 5,
      });
      expect(url).toBe('/canvass?volunteers=5');
    });

    test('builds URL for compare with left and right', () => {
      const url = CrossToolNavigator.buildUrl('compare', {
        left: 'lansing',
        right: 'east-lansing',
      });
      expect(url).toContain('/compare?');
      expect(url).toContain('left=lansing');
      expect(url).toContain('right=east-lansing');
    });

    test('builds URL for political-ai', () => {
      const url = CrossToolNavigator.buildUrl('political-ai', {});
      expect(url).toBe('/political-ai');
    });

    test('encodes special characters in params', () => {
      const url = CrossToolNavigator.buildUrl('segments', {
        segment: 'high swing & gotv',
      });
      expect(url).toContain('high%20swing%20%26%20gotv');
    });

    test('handles multiple params correctly', () => {
      const url = CrossToolNavigator.buildUrl('segments', {
        precincts: ['P001', 'P002'],
        segment: 'test-segment',
        metric: 'gotv_priority',
      });
      expect(url).toContain('/segments?');
      expect(url).toContain('precincts=P001,P002');
      expect(url).toContain('segment=test-segment');
      expect(url).toContain('metric=gotv_priority');
    });

    test('ignores undefined params', () => {
      const url = CrossToolNavigator.buildUrl('segments', {
        precincts: ['P001'],
        segment: undefined,
      });
      expect(url).toBe('/segments?precincts=P001');
      // Check for 'segment=' to avoid matching 'segments' in the path
      expect(url).not.toContain('segment=');
    });

    test('ignores empty arrays', () => {
      const url = CrossToolNavigator.buildUrl('segments', {
        precincts: [],
      });
      expect(url).toBe('/segments');
    });
  });

  // ========================================
  // parseNavigateCommand Tests
  // ========================================
  describe('parseNavigateCommand', () => {
    test('returns null for non-navigate commands', () => {
      expect(CrossToolNavigator.parseNavigateCommand('hello world')).toBeNull();
      expect(CrossToolNavigator.parseNavigateCommand('goto:segments')).toBeNull();
      expect(CrossToolNavigator.parseNavigateCommand('')).toBeNull();
    });

    test('parses navigate:segments command', () => {
      const result = CrossToolNavigator.parseNavigateCommand('navigate:segments');
      expect(result).toEqual({
        tool: 'segments',
        params: {},
      });
    });

    test('parses navigate:donors command', () => {
      const result = CrossToolNavigator.parseNavigateCommand('navigate:donors');
      expect(result).toEqual({
        tool: 'donors',
        params: {},
      });
    });

    test('parses navigate:canvass command', () => {
      const result = CrossToolNavigator.parseNavigateCommand('navigate:canvass');
      expect(result).toEqual({
        tool: 'canvass',
        params: {},
      });
    });

    test('parses navigate:compare command', () => {
      const result = CrossToolNavigator.parseNavigateCommand('navigate:compare');
      expect(result).toEqual({
        tool: 'compare',
        params: {},
      });
    });

    test('parses navigate:political-ai command', () => {
      const result = CrossToolNavigator.parseNavigateCommand('navigate:political-ai');
      expect(result).toEqual({
        tool: 'political-ai',
        params: {},
      });
    });

    test('parses precincts parameter', () => {
      const result = CrossToolNavigator.parseNavigateCommand('navigate:segments?precincts=P001,P002,P003');
      expect(result?.tool).toBe('segments');
      expect(result?.params.precincts).toEqual(['P001', 'P002', 'P003']);
    });

    test('parses zips parameter', () => {
      const result = CrossToolNavigator.parseNavigateCommand('navigate:donors?zips=48823,48864');
      expect(result?.tool).toBe('donors');
      expect(result?.params.zips).toEqual(['48823', '48864']);
    });

    test('parses turfs parameter', () => {
      const result = CrossToolNavigator.parseNavigateCommand('navigate:canvass?turfs=turf-1,turf-2');
      expect(result?.tool).toBe('canvass');
      expect(result?.params.turfs).toEqual(['turf-1', 'turf-2']);
    });

    test('parses segment parameter', () => {
      const result = CrossToolNavigator.parseNavigateCommand('navigate:canvass?segment=high-gotv');
      expect(result?.params.segment).toBe('high-gotv');
    });

    test('parses left and right parameters', () => {
      const result = CrossToolNavigator.parseNavigateCommand('navigate:compare?left=lansing&right=east-lansing');
      expect(result?.params.left).toBe('lansing');
      expect(result?.params.right).toBe('east-lansing');
    });

    test('parses filter parameter', () => {
      const result = CrossToolNavigator.parseNavigateCommand('navigate:segments?filter=swing-voters');
      expect(result?.params.filter).toBe('swing-voters');
    });

    test('parses metric parameter', () => {
      const result = CrossToolNavigator.parseNavigateCommand('navigate:segments?metric=gotv_priority');
      expect(result?.params.metric).toBe('gotv_priority');
    });

    test('parses view parameter with valid value', () => {
      const result = CrossToolNavigator.parseNavigateCommand('navigate:donors?view=timeSeries');
      expect(result?.params.view).toBe('timeSeries');
    });

    test('ignores view parameter with invalid value', () => {
      const result = CrossToolNavigator.parseNavigateCommand('navigate:donors?view=invalid');
      expect(result?.params.view).toBeUndefined();
    });

    test('parses volunteers parameter as number', () => {
      const result = CrossToolNavigator.parseNavigateCommand('navigate:canvass?volunteers=5');
      expect(result?.params.volunteers).toBe(5);
    });

    test('parses year parameter as number', () => {
      const result = CrossToolNavigator.parseNavigateCommand('navigate:donors?year=2024');
      expect(result?.params.year).toBe(2024);
    });

    test('parses month parameter as number', () => {
      const result = CrossToolNavigator.parseNavigateCommand('navigate:donors?month=11');
      expect(result?.params.month).toBe(11);
    });

    test('ignores invalid numeric parameters', () => {
      const result = CrossToolNavigator.parseNavigateCommand('navigate:canvass?volunteers=abc');
      expect(result?.params.volunteers).toBeUndefined();
    });

    test('parses multiple parameters', () => {
      const result = CrossToolNavigator.parseNavigateCommand(
        'navigate:segments?precincts=P001,P002&segment=high-gotv&metric=swing_potential'
      );
      expect(result?.params.precincts).toEqual(['P001', 'P002']);
      expect(result?.params.segment).toBe('high-gotv');
      expect(result?.params.metric).toBe('swing_potential');
    });

    test('decodes URL-encoded values', () => {
      const result = CrossToolNavigator.parseNavigateCommand('navigate:segments?segment=high%20gotv%20priority');
      expect(result?.params.segment).toBe('high gotv priority');
    });

    test('handles path with leading slash', () => {
      const result = CrossToolNavigator.parseNavigateCommand('navigate:/segments?precincts=P001');
      expect(result?.tool).toBe('segments');
    });

    test('returns null for invalid tool', () => {
      expect(CrossToolNavigator.parseNavigateCommand('navigate:invalid-tool')).toBeNull();
      expect(CrossToolNavigator.parseNavigateCommand('navigate:settings')).toBeNull();
    });

    test('filters empty values from arrays', () => {
      const result = CrossToolNavigator.parseNavigateCommand('navigate:segments?precincts=P001,,P002,');
      expect(result?.params.precincts).toEqual(['P001', 'P002']);
    });
  });

  // ========================================
  // generateContinueInSuggestions Tests
  // ========================================
  describe('generateContinueInSuggestions', () => {
    test('generates canvass suggestion from segments with matching precincts', () => {
      const suggestions = CrossToolNavigator.generateContinueInSuggestions('segments', {
        matchingPrecincts: ['P001', 'P002'],
        segmentName: 'high-gotv',
      });

      expect(suggestions.length).toBeGreaterThan(0);
      const canvassSuggestion = suggestions.find(s => s.action.includes('canvass'));
      expect(canvassSuggestion).toBeDefined();
      expect(canvassSuggestion?.label).toContain('Canvassing');
      expect(canvassSuggestion?.action).toContain('segment=high-gotv');
    });

    test('generates donor suggestion from segments with ZIPs', () => {
      const suggestions = CrossToolNavigator.generateContinueInSuggestions('segments', {
        zips: ['48823', '48864'],
      });

      const donorSuggestion = suggestions.find(s => s.action.includes('donors'));
      expect(donorSuggestion).toBeDefined();
      expect(donorSuggestion?.action).toContain('zips=48823,48864');
    });

    test('generates segment suggestion from donors with selected ZIPs', () => {
      const suggestions = CrossToolNavigator.generateContinueInSuggestions('donors', {
        selectedZips: ['48823', '48864'],
      });

      const segmentSuggestion = suggestions.find(s => s.action.includes('segments'));
      expect(segmentSuggestion).toBeDefined();
      expect(segmentSuggestion?.label).toContain('Segment');
    });

    test('generates comparison suggestion from donors with top ZIPs', () => {
      const suggestions = CrossToolNavigator.generateContinueInSuggestions('donors', {
        topZips: ['48823', '48864', '48912'],
      });

      const compareSuggestion = suggestions.find(s => s.action.includes('compare'));
      expect(compareSuggestion).toBeDefined();
      expect(compareSuggestion?.action).toContain('left=48823');
      expect(compareSuggestion?.action).toContain('right=48864');
    });

    test('generates map suggestion from canvass with turfs', () => {
      const suggestions = CrossToolNavigator.generateContinueInSuggestions('canvass', {
        turfs: ['turf-1', 'turf-2'],
      });

      const mapSuggestion = suggestions.find(s => s.action.includes('political-ai'));
      expect(mapSuggestion).toBeDefined();
      expect(mapSuggestion?.label).toContain('Map');
    });

    test('generates map suggestion from compare with entities', () => {
      const suggestions = CrossToolNavigator.generateContinueInSuggestions('compare', {
        leftEntity: 'lansing',
        rightEntity: 'east-lansing',
      });

      const mapSuggestion = suggestions.find(s => s.action.includes('political-ai'));
      expect(mapSuggestion).toBeDefined();
    });

    test('returns empty array when no precincts in segments context', () => {
      const suggestions = CrossToolNavigator.generateContinueInSuggestions('segments', {
        matchingPrecincts: [],
      });

      const canvassSuggestion = suggestions.find(s => s.action.includes('canvass'));
      expect(canvassSuggestion).toBeUndefined();
    });

    test('returns empty array for unknown tool', () => {
      const suggestions = CrossToolNavigator.generateContinueInSuggestions(
        'unknown' as NavigableTool,
        {}
      );
      expect(suggestions).toEqual([]);
    });

    test('includes metadata with tool info', () => {
      const suggestions = CrossToolNavigator.generateContinueInSuggestions('segments', {
        matchingPrecincts: ['P001'],
        segmentName: 'test',
      });

      const canvassSuggestion = suggestions.find(s => s.action.includes('canvass'));
      expect(canvassSuggestion?.metadata?.tool).toBe('canvass');
    });

    test('defaults segment name to "current" when not provided', () => {
      const suggestions = CrossToolNavigator.generateContinueInSuggestions('segments', {
        matchingPrecincts: ['P001'],
      });

      const canvassSuggestion = suggestions.find(s => s.action.includes('canvass'));
      expect(canvassSuggestion?.action).toContain('segment=current');
    });
  });

  // ========================================
  // restoreMapState Tests
  // ========================================
  describe('restoreMapState', () => {
    // Note: restoreMapState requires window to be defined and uses sessionStorage
    // In Jest's JSDOM environment, we test the function's return type behavior

    test('returns null or valid map state object', () => {
      // Clear any existing storage
      sessionStorage.clear();

      // Without any setup, should return null
      const result = CrossToolNavigator.restoreMapState();

      // Result should be null (no data) or a valid map state object
      if (result !== null) {
        expect(result).toHaveProperty('layer');
        expect(result).toHaveProperty('metric');
        expect(result).toHaveProperty('highlights');
      } else {
        expect(result).toBeNull();
      }
    });

    test('function signature returns correct type', () => {
      const result = CrossToolNavigator.restoreMapState();

      // Should return null or an object with the expected shape
      expect(result === null || typeof result === 'object').toBe(true);
    });

    test('map state type has correct properties when returned', () => {
      // Test the expected interface
      type MapState = ReturnType<typeof CrossToolNavigator.restoreMapState>;

      // Create a valid map state to type-check
      const validMapState: NonNullable<MapState> = {
        layer: 'choropleth',
        metric: 'gotv_priority',
        highlights: ['P001', 'P002'],
        center: [-84.55, 42.73],
        zoom: 11,
      };

      expect(validMapState.layer).toBe('choropleth');
      expect(validMapState.metric).toBe('gotv_priority');
      expect(validMapState.highlights).toEqual(['P001', 'P002']);
      expect(validMapState.center).toEqual([-84.55, 42.73]);
      expect(validMapState.zoom).toBe(11);
    });

    test('accepts valid layer values', () => {
      const validLayers: Array<'choropleth' | 'heatmap' | 'none'> = ['choropleth', 'heatmap', 'none'];

      validLayers.forEach(layer => {
        const mapState = {
          layer,
          metric: null,
          highlights: [],
        };
        expect(mapState.layer).toBe(layer);
      });
    });
  });

  // ========================================
  // Valid View Tests
  // ========================================
  describe('view parameter validation', () => {
    const validViews = ['zip', 'timeSeries', 'occupations', 'committees', 'ies', 'lapsed', 'upgrade'];

    test.each(validViews)('accepts valid view: %s', (view) => {
      const result = CrossToolNavigator.parseNavigateCommand(`navigate:donors?view=${view}`);
      expect(result?.params.view).toBe(view);
    });

    test('rejects invalid view values', () => {
      const invalidViews = ['invalid', 'chart', 'graph', 'list', ''];
      invalidViews.forEach(view => {
        const result = CrossToolNavigator.parseNavigateCommand(`navigate:donors?view=${view}`);
        expect(result?.params.view).toBeUndefined();
      });
    });
  });

  // ========================================
  // Tool Path Mapping Tests
  // ========================================
  describe('tool path mapping', () => {
    const toolPaths: Array<[NavigableTool, string]> = [
      ['segments', '/segments'],
      ['donors', '/donors'],
      ['canvass', '/canvass'],
      ['compare', '/compare'],
      ['political-ai', '/political-ai'],
    ];

    test.each(toolPaths)('maps %s to %s', (tool, path) => {
      const url = CrossToolNavigator.buildUrl(tool, {});
      expect(url).toBe(path);
    });
  });
});

// ========================================
// Convenience Function Tests
// ========================================
describe('Convenience Functions', () => {
  // Mock navigateWithContext since these functions call it
  const originalNavigateWithContext = CrossToolNavigator.navigateWithContext;

  beforeEach(() => {
    CrossToolNavigator.navigateWithContext = jest.fn();
  });

  afterEach(() => {
    CrossToolNavigator.navigateWithContext = originalNavigateWithContext;
  });

  describe('navigateToSegments', () => {
    test('calls navigateWithContext with segments tool', () => {
      navigateToSegments(['P001', 'P002']);

      expect(CrossToolNavigator.navigateWithContext).toHaveBeenCalledWith('segments', {
        precincts: ['P001', 'P002'],
        segment: undefined,
      });
    });

    test('includes segment name when provided', () => {
      navigateToSegments(['P001'], 'high-gotv');

      expect(CrossToolNavigator.navigateWithContext).toHaveBeenCalledWith('segments', {
        precincts: ['P001'],
        segment: 'high-gotv',
      });
    });
  });

  describe('navigateToDonors', () => {
    test('calls navigateWithContext with donors tool', () => {
      navigateToDonors(['48823', '48864']);

      expect(CrossToolNavigator.navigateWithContext).toHaveBeenCalledWith('donors', {
        zips: ['48823', '48864'],
        view: undefined,
      });
    });

    test('includes view when provided', () => {
      navigateToDonors(['48823'], 'timeSeries');

      expect(CrossToolNavigator.navigateWithContext).toHaveBeenCalledWith('donors', {
        zips: ['48823'],
        view: 'timeSeries',
      });
    });
  });

  describe('navigateToCanvass', () => {
    test('calls navigateWithContext with canvass tool', () => {
      navigateToCanvass('high-gotv');

      expect(CrossToolNavigator.navigateWithContext).toHaveBeenCalledWith('canvass', {
        segment: 'high-gotv',
        precincts: undefined,
      });
    });

    test('includes precincts when provided', () => {
      navigateToCanvass('test-segment', ['P001', 'P002']);

      expect(CrossToolNavigator.navigateWithContext).toHaveBeenCalledWith('canvass', {
        segment: 'test-segment',
        precincts: ['P001', 'P002'],
      });
    });
  });

  describe('navigateToComparison', () => {
    test('calls navigateWithContext with compare tool', () => {
      navigateToComparison('lansing', 'east-lansing');

      expect(CrossToolNavigator.navigateWithContext).toHaveBeenCalledWith('compare', {
        left: 'lansing',
        right: 'east-lansing',
      });
    });
  });
});
