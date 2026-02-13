/**
 * MapCommandBridge Unit Tests
 *
 * Tests map command execution, state management, and command parsing.
 * Run with: npm test -- --testPathPattern=MapCommandBridge
 */

import {
  MapCommandBridge,
  MapState,
  MapEvent,
  ArcGISMapView,
} from '@/lib/ai-native/MapCommandBridge';
import type { MapCommand, MapCommandType } from '@/lib/ai-native/types';

// Mock ArcGIS MapView
const createMockMapView = (): ArcGISMapView => ({
  goTo: jest.fn().mockResolvedValue(undefined),
  center: { longitude: -84.555, latitude: 42.732 },
  zoom: 10,
  extent: {},
  graphics: {
    removeAll: jest.fn(),
    add: jest.fn(),
  },
  map: {
    layers: {
      find: jest.fn(),
      forEach: jest.fn(),
    },
    findLayerById: jest.fn(),
  },
});

describe('MapCommandBridge', () => {
  let bridge: MapCommandBridge;
  let mockMapView: ArcGISMapView;

  beforeEach(() => {
    // Reset singleton for each test by accessing private instance
    (MapCommandBridge as any).instance = undefined;
    bridge = MapCommandBridge.getInstance();
    mockMapView = createMockMapView();
  });

  afterEach(() => {
    bridge.clearMapView();
  });

  // ===========================================================================
  // Singleton Pattern
  // ===========================================================================

  describe('Singleton Pattern', () => {
    test('getInstance returns same instance', () => {
      const instance1 = MapCommandBridge.getInstance();
      const instance2 = MapCommandBridge.getInstance();
      expect(instance1).toBe(instance2);
    });

    test('getInstance accepts config on first call', () => {
      (MapCommandBridge as any).instance = undefined;
      const bridge = MapCommandBridge.getInstance({
        defaultZoom: 15,
        animationDuration: 500,
      });
      const state = bridge.getState();
      expect(state.zoom).toBe(15);
    });
  });

  // ===========================================================================
  // MapView Registration
  // ===========================================================================

  describe('MapView Registration', () => {
    test('isReady returns false without map view', () => {
      expect(bridge.isReady()).toBe(false);
    });

    test('isReady returns true after setting map view', () => {
      bridge.setMapView(mockMapView);
      expect(bridge.isReady()).toBe(true);
    });

    test('clearMapView removes map view', () => {
      bridge.setMapView(mockMapView);
      expect(bridge.isReady()).toBe(true);

      bridge.clearMapView();
      expect(bridge.isReady()).toBe(false);
    });

    test('setMapView syncs state from view', () => {
      mockMapView.center = { longitude: -84.5, latitude: 42.7 };
      mockMapView.zoom = 12;

      bridge.setMapView(mockMapView);
      const state = bridge.getState();

      expect(state.center[0]).toBeCloseTo(-84.5, 1);
      expect(state.center[1]).toBeCloseTo(42.7, 1);
      expect(state.zoom).toBe(12);
    });
  });

  // ===========================================================================
  // Command Execution
  // ===========================================================================

  describe('Command Execution', () => {
    beforeEach(() => {
      bridge.setMapView(mockMapView);
    });

    describe('zoom command', () => {
      test('executes zoom with specified level', async () => {
        await bridge.executeCommand({ type: 'zoom', zoom: 15 });

        expect(mockMapView.goTo).toHaveBeenCalledWith(
          { zoom: 15 },
          expect.any(Object)
        );
      });

      test('increments zoom by 1 if not specified', async () => {
        const initialZoom = bridge.getState().zoom;
        await bridge.executeCommand({ type: 'zoom' });

        expect(mockMapView.goTo).toHaveBeenCalledWith(
          { zoom: initialZoom + 1 },
          expect.any(Object)
        );
      });
    });

    describe('pan command', () => {
      test('pans to specified center', async () => {
        await bridge.executeCommand({
          type: 'pan',
          center: [-84.5, 42.8],
        });

        expect(mockMapView.goTo).toHaveBeenCalledWith(
          { center: [-84.5, 42.8] },
          expect.any(Object)
        );
      });

      test('does nothing without center', async () => {
        await bridge.executeCommand({ type: 'pan' });

        expect(mockMapView.goTo).not.toHaveBeenCalled();
      });
    });

    describe('flyTo command', () => {
      test('flies to specified center and zoom', async () => {
        await bridge.executeCommand({
          type: 'flyTo',
          center: [-84.5, 42.7],
          zoom: 14,
        });

        expect(mockMapView.goTo).toHaveBeenCalledWith(
          { center: [-84.5, 42.7], zoom: 14 },
          expect.any(Object)
        );
      });

      test('flies to jurisdiction by name', async () => {
        await bridge.executeCommand({
          type: 'flyTo',
          target: 'Lansing',
        });

        expect(mockMapView.goTo).toHaveBeenCalledWith(
          expect.objectContaining({
            center: [-84.5555, 42.7325],
          }),
          expect.any(Object)
        );
      });

      test('flies to East Lansing by name', async () => {
        await bridge.executeCommand({
          type: 'flyTo',
          target: 'East Lansing',
        });

        expect(mockMapView.goTo).toHaveBeenCalledWith(
          expect.objectContaining({
            center: [-84.4839, 42.7369],
          }),
          expect.any(Object)
        );
      });

      test('uses bounds if provided', async () => {
        await bridge.executeCommand({
          type: 'flyTo',
          bounds: [-84.8, 42.5, -84.3, 42.9],
        });

        // Center should be calculated from bounds
        expect(mockMapView.goTo).toHaveBeenCalledWith(
          expect.objectContaining({
            center: [-84.55, 42.7],
          }),
          expect.any(Object)
        );
      });

      test('uses default center if no target specified', async () => {
        await bridge.executeCommand({ type: 'flyTo' });

        expect(mockMapView.goTo).toHaveBeenCalledWith(
          expect.objectContaining({
            center: [-84.555, 42.732],
          }),
          expect.any(Object)
        );
      });
    });

    describe('highlight command', () => {
      test('highlights single target', async () => {
        const eventHandler = jest.fn();
        bridge.on('state-changed', eventHandler);

        await bridge.executeCommand({
          type: 'highlight',
          target: 'precinct-1',
        });

        expect(eventHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'state-changed',
            data: expect.objectContaining({
              highlightedFeatures: ['precinct-1'],
            }),
          })
        );
      });

      test('highlights multiple targets', async () => {
        const eventHandler = jest.fn();
        bridge.on('state-changed', eventHandler);

        await bridge.executeCommand({
          type: 'highlight',
          target: ['precinct-1', 'precinct-2', 'precinct-3'],
        });

        expect(eventHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              highlightedFeatures: ['precinct-1', 'precinct-2', 'precinct-3'],
            }),
          })
        );
      });

      test('limits highlighted features', async () => {
        const manyTargets = Array.from({ length: 150 }, (_, i) => `precinct-${i}`);

        await bridge.executeCommand({
          type: 'highlight',
          target: manyTargets,
        });

        const highlighted = bridge.getHighlightedFeatures();
        expect(highlighted.length).toBeLessThanOrEqual(100);
      });

      test('includes style in event', async () => {
        const eventHandler = jest.fn();
        bridge.on('state-changed', eventHandler);

        await bridge.executeCommand({
          type: 'highlight',
          target: 'precinct-1',
          style: { fillColor: '#ff0000' },
        });

        expect(eventHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              style: { fillColor: '#ff0000' },
            }),
          })
        );
      });
    });

    describe('clearHighlight command', () => {
      test('clears highlighted features', async () => {
        await bridge.executeCommand({
          type: 'highlight',
          target: ['precinct-1', 'precinct-2'],
        });
        expect(bridge.getHighlightedFeatures().length).toBe(2);

        await bridge.executeCommand({ type: 'clearHighlight' });
        expect(bridge.getHighlightedFeatures().length).toBe(0);
      });

      test('removes all graphics from map', async () => {
        await bridge.executeCommand({
          type: 'highlight',
          target: 'precinct-1',
        });

        await bridge.executeCommand({ type: 'clearHighlight' });

        expect(mockMapView.graphics.removeAll).toHaveBeenCalled();
      });
    });

    describe('filter command', () => {
      test('applies filter', async () => {
        const eventHandler = jest.fn();
        bridge.on('state-changed', eventHandler);

        await bridge.executeCommand({
          type: 'filter',
          metric: 'swing_potential',
          data: { min: 50, max: 100 },
        });

        expect(eventHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              filters: { swing_potential: { min: 50, max: 100 } },
            }),
          })
        );
      });
    });

    describe('clearFilter command', () => {
      test('clears specific filter', async () => {
        await bridge.executeCommand({
          type: 'filter',
          metric: 'swing_potential',
          data: { min: 50 },
        });
        await bridge.executeCommand({
          type: 'filter',
          metric: 'gotv_priority',
          data: { min: 70 },
        });

        const eventHandler = jest.fn();
        bridge.on('state-changed', eventHandler);

        await bridge.executeCommand({
          type: 'clearFilter',
          metric: 'swing_potential',
        });

        expect(eventHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              filters: { gotv_priority: { min: 70 } },
            }),
          })
        );
      });

      test('clears all filters without metric', async () => {
        await bridge.executeCommand({
          type: 'filter',
          metric: 'swing_potential',
          data: { min: 50 },
        });

        const eventHandler = jest.fn();
        bridge.on('state-changed', eventHandler);

        await bridge.executeCommand({ type: 'clearFilter' });

        expect(eventHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              filters: {},
            }),
          })
        );
      });
    });

    describe('showLayer command', () => {
      test('adds layer to visible set', async () => {
        const eventHandler = jest.fn();
        bridge.on('state-changed', eventHandler);

        await bridge.executeCommand({
          type: 'showLayer',
          layer: 'precincts',
        });

        expect(eventHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              visibleLayers: ['precincts'],
            }),
          })
        );
      });
    });

    describe('hideLayer command', () => {
      test('removes layer from visible set', async () => {
        await bridge.executeCommand({
          type: 'showLayer',
          layer: 'precincts',
        });
        await bridge.executeCommand({
          type: 'showLayer',
          layer: 'h3',
        });

        const eventHandler = jest.fn();
        bridge.on('state-changed', eventHandler);

        await bridge.executeCommand({
          type: 'hideLayer',
          layer: 'precincts',
        });

        expect(eventHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              visibleLayers: ['h3'],
            }),
          })
        );
      });
    });

    describe('showHeatmap command', () => {
      test('emits heatmap state change', async () => {
        const eventHandler = jest.fn();
        bridge.on('state-changed', eventHandler);

        await bridge.executeCommand({
          type: 'showHeatmap',
          metric: 'swing_potential',
          layer: 'precincts',
          style: { colorScheme: 'blue' },
        });

        expect(eventHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              heatmap: {
                metric: 'swing_potential',
                layer: 'precincts',
                style: { colorScheme: 'blue' },
              },
            }),
          })
        );
      });
    });

    describe('showChoropleth command', () => {
      test('emits choropleth state change', async () => {
        const eventHandler = jest.fn();
        bridge.on('state-changed', eventHandler);

        await bridge.executeCommand({
          type: 'showChoropleth',
          metric: 'partisan_lean',
          layer: 'precincts',
        });

        expect(eventHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              choropleth: {
                metric: 'partisan_lean',
                layer: 'precincts',
                style: undefined,
              },
            }),
          })
        );
      });
    });

    describe('clear command', () => {
      test('resets map to default state', async () => {
        // Set some state
        await bridge.executeCommand({
          type: 'highlight',
          target: 'precinct-1',
        });
        await bridge.executeCommand({
          type: 'filter',
          metric: 'swing',
          data: { min: 50 },
        });

        await bridge.executeCommand({ type: 'clear' });

        expect(bridge.getHighlightedFeatures().length).toBe(0);
        const state = bridge.getState();
        expect(state.center).toEqual([-84.555, 42.732]);
        expect(state.zoom).toBe(10);
      });
    });
  });

  // ===========================================================================
  // Command Queue
  // ===========================================================================

  describe('Command Queue', () => {
    beforeEach(() => {
      bridge.setMapView(mockMapView);
    });

    test('executeCommands processes multiple commands', async () => {
      await bridge.executeCommands([
        { type: 'zoom', zoom: 12 },
        { type: 'highlight', target: 'precinct-1' },
        { type: 'showHeatmap', metric: 'swing' },
      ]);

      expect(mockMapView.goTo).toHaveBeenCalled();
      expect(bridge.getHighlightedFeatures()).toContain('precinct-1');
    });

    test('commands execute in order', async () => {
      const executionOrder: string[] = [];
      const originalGoTo = mockMapView.goTo;

      mockMapView.goTo = jest.fn().mockImplementation(async (target) => {
        executionOrder.push(target.zoom ? `zoom-${target.zoom}` : 'other');
        return originalGoTo(target);
      });

      await bridge.executeCommands([
        { type: 'zoom', zoom: 12 },
        { type: 'zoom', zoom: 14 },
        { type: 'zoom', zoom: 16 },
      ]);

      expect(executionOrder).toEqual(['zoom-12', 'zoom-14', 'zoom-16']);
    });

    test('emits command-executed for each command', async () => {
      const eventHandler = jest.fn();
      bridge.on('command-executed', eventHandler);

      await bridge.executeCommands([
        { type: 'zoom', zoom: 12 },
        { type: 'zoom', zoom: 14 },
      ]);

      expect(eventHandler).toHaveBeenCalledTimes(2);
    });
  });

  // ===========================================================================
  // State Management
  // ===========================================================================

  describe('State Management', () => {
    test('getState returns copy of state', () => {
      const state1 = bridge.getState();
      const state2 = bridge.getState();

      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2);
    });

    test('getHighlightedFeatures returns copy', async () => {
      bridge.setMapView(mockMapView);
      await bridge.executeCommand({
        type: 'highlight',
        target: ['p1', 'p2'],
      });

      const features1 = bridge.getHighlightedFeatures();
      const features2 = bridge.getHighlightedFeatures();

      expect(features1).toEqual(features2);
      expect(features1).not.toBe(features2);
    });

    test('isHighlighted checks feature status', async () => {
      bridge.setMapView(mockMapView);
      await bridge.executeCommand({
        type: 'highlight',
        target: ['precinct-1', 'precinct-2'],
      });

      expect(bridge.isHighlighted('precinct-1')).toBe(true);
      expect(bridge.isHighlighted('precinct-2')).toBe(true);
      expect(bridge.isHighlighted('precinct-3')).toBe(false);
    });
  });

  // ===========================================================================
  // Event Handling
  // ===========================================================================

  describe('Event Handling', () => {
    beforeEach(() => {
      bridge.setMapView(mockMapView);
    });

    test('on subscribes to events', async () => {
      const handler = jest.fn();
      bridge.on('command-executed', handler);

      await bridge.executeCommand({ type: 'zoom', zoom: 12 });

      expect(handler).toHaveBeenCalled();
    });

    test('on returns unsubscribe function', async () => {
      const handler = jest.fn();
      const unsubscribe = bridge.on('command-executed', handler);

      await bridge.executeCommand({ type: 'zoom', zoom: 12 });
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();

      await bridge.executeCommand({ type: 'zoom', zoom: 14 });
      expect(handler).toHaveBeenCalledTimes(1); // Still 1
    });

    test('multiple handlers receive events', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      bridge.on('command-executed', handler1);
      bridge.on('command-executed', handler2);

      await bridge.executeCommand({ type: 'zoom', zoom: 12 });

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    test('error events include error details', async () => {
      const errorHandler = jest.fn();
      bridge.on('error', errorHandler);

      // Force an error by making goTo reject
      mockMapView.goTo = jest.fn().mockRejectedValue(new Error('Map error'));

      await bridge.executeCommand({ type: 'zoom', zoom: 12 });

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          error: expect.any(Error),
        })
      );
    });
  });

  // ===========================================================================
  // Static Factory Methods
  // ===========================================================================

  describe('Static Factory Methods', () => {
    describe('createFlyToJurisdiction', () => {
      test('creates flyTo command for known jurisdiction', () => {
        const cmd = MapCommandBridge.createFlyToJurisdiction('Lansing');

        expect(cmd.type).toBe('flyTo');
        expect(cmd.target).toBe('Lansing');
        expect(cmd.center).toEqual([-84.5555, 42.7325]);
        expect(cmd.animation).toBe(true);
      });

      test('uses default center for unknown jurisdiction', () => {
        const cmd = MapCommandBridge.createFlyToJurisdiction('Unknown City');

        expect(cmd.type).toBe('flyTo');
        expect(cmd.center).toEqual([-84.555, 42.732]);
      });

      test('accepts custom zoom level', () => {
        const cmd = MapCommandBridge.createFlyToJurisdiction('Lansing', 15);

        expect(cmd.zoom).toBe(15);
      });
    });

    describe('createHighlightPrecincts', () => {
      test('creates highlight command with precincts', () => {
        const cmd = MapCommandBridge.createHighlightPrecincts([
          'precinct-1',
          'precinct-2',
        ]);

        expect(cmd.type).toBe('highlight');
        expect(cmd.target).toEqual(['precinct-1', 'precinct-2']);
      });

      test('includes default style', () => {
        const cmd = MapCommandBridge.createHighlightPrecincts(['p1']);

        expect(cmd.style).toBeDefined();
        expect(cmd.style?.fillColor).toBe('#3b82f6');
        expect(cmd.style?.strokeColor).toBe('#1d4ed8');
      });

      test('accepts custom style', () => {
        const cmd = MapCommandBridge.createHighlightPrecincts(['p1'], {
          fillColor: '#ff0000',
        });

        expect(cmd.style?.fillColor).toBe('#ff0000');
      });
    });

    describe('createHeatmapCommand', () => {
      test('creates heatmap command with metric', () => {
        const cmd = MapCommandBridge.createHeatmapCommand('swing_potential');

        expect(cmd.type).toBe('showHeatmap');
        expect(cmd.metric).toBe('swing_potential');
        expect(cmd.layer).toBe('precincts');
      });

      test('accepts custom layer and color scheme', () => {
        const cmd = MapCommandBridge.createHeatmapCommand('gotv', 'h3', 'red');

        expect(cmd.layer).toBe('h3');
        expect(cmd.style?.colorScheme).toBe('red');
      });
    });

    describe('createChoroplethCommand', () => {
      test('creates choropleth command with metric', () => {
        const cmd = MapCommandBridge.createChoroplethCommand('partisan_lean');

        expect(cmd.type).toBe('showChoropleth');
        expect(cmd.metric).toBe('partisan_lean');
      });

      test('uses sequential scale by default', () => {
        const cmd = MapCommandBridge.createChoroplethCommand('turnout');

        expect(cmd.style?.colorScale).toBe('sequential');
      });

      test('uses diverging scale when specified', () => {
        const cmd = MapCommandBridge.createChoroplethCommand(
          'partisan_lean',
          'precincts',
          true
        );

        expect(cmd.style?.colorScale).toBe('diverging');
      });
    });

    describe('getInghamCountyBounds', () => {
      test('returns Ingham County bounds', () => {
        const bounds = MapCommandBridge.getInghamCountyBounds();

        expect(bounds).toHaveLength(4);
        expect(bounds[0]).toBeLessThan(bounds[2]); // west < east
        expect(bounds[1]).toBeLessThan(bounds[3]); // south < north
      });
    });
  });

  // ===========================================================================
  // Command Parsing
  // ===========================================================================

  describe('Command Parsing', () => {
    describe('parseCommandsFromResponse', () => {
      test('parses flyTo command', () => {
        const response = 'Looking at [MAP:flyTo Lansing] for analysis.';
        const commands = MapCommandBridge.parseCommandsFromResponse(response);

        expect(commands).toHaveLength(1);
        expect(commands[0].type).toBe('flyTo');
        expect(commands[0].target).toBe('Lansing');
      });

      test('parses highlight command with IDs', () => {
        const response = '[MAP:highlight p1,p2,p3]';
        const commands = MapCommandBridge.parseCommandsFromResponse(response);

        expect(commands).toHaveLength(1);
        expect(commands[0].type).toBe('highlight');
        expect(commands[0].target).toEqual(['p1', 'p2', 'p3']);
      });

      test('parses heatmap command', () => {
        const response = 'Showing [MAP:heatmap swing_potential] visualization.';
        const commands = MapCommandBridge.parseCommandsFromResponse(response);

        expect(commands).toHaveLength(1);
        expect(commands[0].type).toBe('showHeatmap');
        expect(commands[0].metric).toBe('swing_potential');
      });

      test('parses clear command', () => {
        const response = '[MAP:clear]';
        const commands = MapCommandBridge.parseCommandsFromResponse(response);

        expect(commands).toHaveLength(1);
        expect(commands[0].type).toBe('clear');
      });

      test('parses zoom command with level', () => {
        const response = '[MAP:zoom 15]';
        const commands = MapCommandBridge.parseCommandsFromResponse(response);

        expect(commands).toHaveLength(1);
        expect(commands[0].type).toBe('zoom');
        expect(commands[0].zoom).toBe(15);
      });

      test('parses multiple commands', () => {
        const response =
          'First [MAP:flyTo East Lansing], then [MAP:heatmap gotv_priority].';
        const commands = MapCommandBridge.parseCommandsFromResponse(response);

        expect(commands).toHaveLength(2);
        expect(commands[0].type).toBe('flyTo');
        expect(commands[1].type).toBe('showHeatmap');
      });

      test('returns empty array for no commands', () => {
        const response = 'No map commands here.';
        const commands = MapCommandBridge.parseCommandsFromResponse(response);

        expect(commands).toEqual([]);
      });

      test('ignores unknown command types', () => {
        const response = '[MAP:unknownCommand params]';
        const commands = MapCommandBridge.parseCommandsFromResponse(response);

        expect(commands).toEqual([]);
      });
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('Edge Cases', () => {
    test('commands do nothing without map view', async () => {
      // Don't set map view
      await bridge.executeCommand({ type: 'zoom', zoom: 15 });

      // Should not throw and not call goTo
      expect(mockMapView.goTo).not.toHaveBeenCalled();
    });

    test('handles unknown command type gracefully', async () => {
      bridge.setMapView(mockMapView);

      // Should log warning but not throw
      await expect(
        bridge.executeCommand({ type: 'unknownType' as MapCommandType })
      ).resolves.not.toThrow();
    });

    test('handles animation option', async () => {
      bridge.setMapView(mockMapView);

      await bridge.executeCommand({
        type: 'flyTo',
        center: [-84.5, 42.7],
        animation: false,
      });

      expect(mockMapView.goTo).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ duration: 0 })
      );
    });

    test('empty target array creates empty highlight', async () => {
      bridge.setMapView(mockMapView);

      await bridge.executeCommand({
        type: 'highlight',
        target: [],
      });

      expect(bridge.getHighlightedFeatures()).toEqual([]);
    });
  });
});
