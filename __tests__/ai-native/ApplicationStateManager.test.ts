/**
 * ApplicationStateManager Unit Tests
 *
 * Tests for central state tracking enabling AI context awareness.
 * The ApplicationStateManager uses an event dispatch pattern for state updates.
 */

import { getStateManager } from '@/lib/ai-native/ApplicationStateManager';

// Mock localStorage - use interface to avoid circular reference type error
interface LocalStorageMock {
  store: Record<string, string>;
  getItem: jest.Mock<string | null, [string]>;
  setItem: jest.Mock<void, [string, string]>;
  removeItem: jest.Mock<void, [string]>;
  clear: jest.Mock<void, []>;
}

const localStorageMock: LocalStorageMock = {
  store: {} as Record<string, string>,
  getItem: jest.fn((key: string): string | null => localStorageMock.store[key] || null),
  setItem: jest.fn((key: string, value: string): void => {
    localStorageMock.store[key] = value;
  }),
  removeItem: jest.fn((key: string): void => {
    delete localStorageMock.store[key];
  }),
  clear: jest.fn((): void => {
    localStorageMock.store = {};
  }),
};

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock window for event listeners
const windowMock = {
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

Object.defineProperty(global, 'window', { value: windowMock, writable: true });

// Get the type of the state manager
type StateManager = ReturnType<typeof getStateManager>;

describe('ApplicationStateManager', () => {
  let stateManager: StateManager;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.store = {};
    // Get fresh instance and reset it
    stateManager = getStateManager();
    stateManager.reset();
  });

  describe('singleton', () => {
    test('getInstance returns same instance', () => {
      const instance1 = getStateManager();
      const instance2 = getStateManager();
      expect(instance1).toBe(instance2);
    });
  });

  describe('state access', () => {
    test('getState returns full application state', () => {
      const state = stateManager.getState();
      expect(state).toHaveProperty('map');
      expect(state).toHaveProperty('selection');
      expect(state).toHaveProperty('workflow');
      expect(state).toHaveProperty('behavior');
    });

    test('getMapState returns map state', () => {
      const mapState = stateManager.getMapState();
      expect(mapState).toHaveProperty('center');
      expect(mapState).toHaveProperty('zoom');
      expect(mapState).toHaveProperty('activeLayer');
    });

    test('getSelectionState returns selection state', () => {
      const selectionState = stateManager.getSelectionState();
      expect(selectionState).toHaveProperty('type');
      expect(selectionState).toHaveProperty('selectedIds');
      expect(selectionState).toHaveProperty('selectionHistory');
    });

    test('getWorkflowState returns workflow state', () => {
      const workflowState = stateManager.getWorkflowState();
      expect(workflowState).toHaveProperty('activeWorkflow');
      expect(workflowState).toHaveProperty('workflowStep');
      expect(workflowState).toHaveProperty('workflowData');
    });

    test('getBehaviorState returns behavior state', () => {
      const behaviorState = stateManager.getBehaviorState();
      expect(behaviorState).toHaveProperty('sessionStartTime');
      expect(behaviorState).toHaveProperty('actionsThisSession');
      expect(behaviorState).toHaveProperty('queriesAsked');
    });

    test('getSegmentationState returns segmentation state', () => {
      const segmentationState = stateManager.getSegmentationState();
      expect(segmentationState).toHaveProperty('activeFilters');
      expect(segmentationState).toHaveProperty('matchingPrecincts');
      expect(segmentationState).toHaveProperty('savedSegments');
    });

    test('getCanvassingState returns canvassing state', () => {
      const canvassingState = stateManager.getCanvassingState();
      expect(canvassingState).toHaveProperty('activeOperation');
      expect(canvassingState).toHaveProperty('turfs');
      expect(canvassingState).toHaveProperty('progress');
    });

    test('getDonorState returns donor state', () => {
      const donorState = stateManager.getDonorState();
      expect(donorState).toHaveProperty('activeView');
      expect(donorState).toHaveProperty('selectedZips');
      expect(donorState).toHaveProperty('partyFilter');
    });

    test('getComparisonState returns comparison state', () => {
      const comparisonState = stateManager.getComparisonState();
      expect(comparisonState).toHaveProperty('leftEntity');
      expect(comparisonState).toHaveProperty('rightEntity');
      expect(comparisonState).toHaveProperty('similarityResults');
    });
  });

  describe('map state updates via dispatch', () => {
    test('MAP_MOVED updates map properties', () => {
      stateManager.dispatch({
        type: 'MAP_MOVED',
        payload: {
          center: [-84.55, 42.73],
          zoom: 12,
          extent: { xmin: -85, ymin: 42, xmax: -84, ymax: 43 },
          visiblePrecincts: ['P1', 'P2'],
        },
        timestamp: new Date(),
      });

      const mapState = stateManager.getMapState();
      expect(mapState.center).toEqual([-84.55, 42.73]);
      expect(mapState.zoom).toBe(12);
      expect(mapState.visiblePrecincts).toEqual(['P1', 'P2']);
    });

    test('MAP_LAYER_CHANGED updates active layer', () => {
      stateManager.dispatch({
        type: 'MAP_LAYER_CHANGED',
        payload: { layer: 'heatmap' },
        timestamp: new Date(),
      });

      const mapState = stateManager.getMapState();
      expect(mapState.activeLayer).toBe('heatmap');
    });

    test('MAP_METRIC_CHANGED updates active metric', () => {
      stateManager.dispatch({
        type: 'MAP_METRIC_CHANGED',
        payload: { metric: 'swing_potential' },
        timestamp: new Date(),
      });

      const mapState = stateManager.getMapState();
      expect(mapState.activeMetric).toBe('swing_potential');
    });
  });

  describe('selection state updates via dispatch', () => {
    test('PRECINCT_SELECTED updates selection state', () => {
      const mockPrecinct = {
        id: 'P001',
        precinctName: 'Lansing City Precinct 1',
        partisanLean: -12.5,
      };

      stateManager.dispatch({
        type: 'PRECINCT_SELECTED',
        payload: {
          precinctId: 'P001',
          precinctName: 'Lansing City Precinct 1',
          precinct: mockPrecinct,
          metrics: { partisanLean: -12.5 },
        },
        timestamp: new Date(),
      });

      const selectionState = stateManager.getSelectionState();
      expect(selectionState.type).toBe('precinct');
      expect(selectionState.selectedIds).toContain('P001');
      expect(selectionState.selectionHistory.length).toBeGreaterThan(0);
    });

    test('MUNICIPALITY_SELECTED updates selection state', () => {
      stateManager.dispatch({
        type: 'MUNICIPALITY_SELECTED',
        payload: {
          municipalityId: 'east-lansing',
          municipalityName: 'East Lansing',
          municipality: { id: 'east-lansing', name: 'East Lansing' },
        },
        timestamp: new Date(),
      });

      const selectionState = stateManager.getSelectionState();
      expect(selectionState.type).toBe('municipality');
      expect(selectionState.selectedIds).toContain('east-lansing');
    });

    test('PRECINCT_DESELECTED resets selection state', () => {
      // First select
      stateManager.dispatch({
        type: 'PRECINCT_SELECTED',
        payload: {
          precinctId: 'P001',
          precinctName: 'Test',
          precinct: { id: 'P001' },
        },
        timestamp: new Date(),
      });

      // Then deselect
      stateManager.dispatch({
        type: 'PRECINCT_DESELECTED',
        payload: {},
        timestamp: new Date(),
      });

      const selectionState = stateManager.getSelectionState();
      expect(selectionState.type).toBe('none');
      expect(selectionState.selectedIds).toHaveLength(0);
    });
  });

  describe('workflow state via dispatch', () => {
    test('WORKFLOW_STARTED sets active workflow', () => {
      stateManager.dispatch({
        type: 'WORKFLOW_STARTED',
        payload: { workflowId: 'gotv_targeting' },
        timestamp: new Date(),
      });

      const workflowState = stateManager.getWorkflowState();
      expect(workflowState.activeWorkflow).toBe('gotv_targeting');
      expect(workflowState.workflowStep).toBe(0);
    });

    test('WORKFLOW_STEP_CHANGED increments step', () => {
      stateManager.dispatch({
        type: 'WORKFLOW_STARTED',
        payload: { workflowId: 'swing_detection' },
        timestamp: new Date(),
      });

      stateManager.dispatch({
        type: 'WORKFLOW_STEP_CHANGED',
        payload: { step: 1 },
        timestamp: new Date(),
      });

      const workflowState = stateManager.getWorkflowState();
      expect(workflowState.workflowStep).toBe(1);
    });

    test('WORKFLOW_COMPLETED clears workflow state', () => {
      stateManager.dispatch({
        type: 'WORKFLOW_STARTED',
        payload: { workflowId: 'test_workflow' },
        timestamp: new Date(),
      });

      stateManager.dispatch({
        type: 'WORKFLOW_COMPLETED',
        payload: {},
        timestamp: new Date(),
      });

      const workflowState = stateManager.getWorkflowState();
      expect(workflowState.activeWorkflow).toBeNull();
      expect(workflowState.workflowStep).toBe(0);
    });
  });

  describe('behavior tracking via dispatch', () => {
    test('dispatch adds action to history', () => {
      stateManager.dispatch({
        type: 'PRECINCT_SELECTED',
        payload: {
          precinctId: 'P001',
          precinctName: 'Test',
          precinct: { id: 'P001' },
        },
        timestamp: new Date(),
      });

      const behaviorState = stateManager.getBehaviorState();
      expect(behaviorState.actionsThisSession.length).toBeGreaterThan(0);
      expect(behaviorState.actionsThisSession[0].type).toBe('PRECINCT_SELECTED');
    });

    test('USER_QUERY_SUBMITTED adds query to history', () => {
      stateManager.dispatch({
        type: 'USER_QUERY_SUBMITTED',
        payload: { query: 'Show swing precincts' },
        timestamp: new Date(),
      });

      const behaviorState = stateManager.getBehaviorState();
      expect(behaviorState.queriesAsked).toContain('Show swing precincts');
    });

    test('SUGGESTION_ACCEPTED adds to accepted list', () => {
      stateManager.dispatch({
        type: 'SUGGESTION_ACCEPTED',
        payload: { suggestionId: 'suggest-1' },
        timestamp: new Date(),
      });

      const behaviorState = stateManager.getBehaviorState();
      expect(behaviorState.suggestionsAccepted).toContain('suggest-1');
    });

    test('SUGGESTION_IGNORED adds to ignored list', () => {
      stateManager.dispatch({
        type: 'SUGGESTION_IGNORED',
        payload: { suggestionId: 'suggest-2' },
        timestamp: new Date(),
      });

      const behaviorState = stateManager.getBehaviorState();
      expect(behaviorState.suggestionsIgnored).toContain('suggest-2');
    });

    test('PRECINCT_SELECTED adds to explored set', () => {
      stateManager.dispatch({
        type: 'PRECINCT_SELECTED',
        payload: {
          precinctId: 'P001',
          precinctName: 'Test',
          precinct: { id: 'P001' },
        },
        timestamp: new Date(),
      });

      const behaviorState = stateManager.getBehaviorState();
      expect(behaviorState.exploredPrecincts.has('P001')).toBe(true);
    });
  });

  describe('event listeners', () => {
    test('subscribe adds listener and returns unsubscribe function', () => {
      const listener = jest.fn();
      const unsubscribe = stateManager.subscribe(listener);

      stateManager.dispatch({
        type: 'MAP_MOVED',
        payload: { center: [-84.55, 42.73], zoom: 10 },
        timestamp: new Date(),
      });

      expect(listener).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');
    });

    test('unsubscribe removes listener', () => {
      const listener = jest.fn();
      const unsubscribe = stateManager.subscribe(listener);

      unsubscribe();

      stateManager.dispatch({
        type: 'MAP_MOVED',
        payload: { center: [-84.55, 42.73], zoom: 10 },
        timestamp: new Date(),
      });

      // Listener should only have been called once (from any setup), not from dispatch after unsubscribe
      listener.mockClear();

      stateManager.dispatch({
        type: 'MAP_MOVED',
        payload: { center: [-84.55, 42.73], zoom: 10 },
        timestamp: new Date(),
      });

      expect(listener).not.toHaveBeenCalled();
    });

    test('dispatch notifies all listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      stateManager.subscribe(listener1);
      stateManager.subscribe(listener2);

      stateManager.dispatch({
        type: 'MAP_LAYER_CHANGED',
        payload: { layer: 'heatmap' },
        timestamp: new Date(),
      });

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });

  describe('segmentation state via dispatch', () => {
    test('SEGMENT_FILTER_CHANGED updates filters', () => {
      const filters = {
        partisanLean: { min: -20, max: 0 },
        swingPotential: { min: 60, max: 100 },
      };

      stateManager.dispatch({
        type: 'SEGMENT_FILTER_CHANGED',
        payload: {
          filters,
          filterCount: 2,
          matchingPrecincts: ['P001', 'P002', 'P003'],
          matchCount: 3,
        },
        timestamp: new Date(),
      });

      const segmentationState = stateManager.getSegmentationState();
      expect(segmentationState.activeFilters).toEqual(filters);
      expect(segmentationState.filterCount).toBe(2);
      expect(segmentationState.matchCount).toBe(3);
    });

    test('SEGMENT_SAVED updates segment name', () => {
      stateManager.dispatch({
        type: 'SEGMENT_SAVED',
        payload: { name: 'High Priority Swing' },
        timestamp: new Date(),
      });

      const segmentationState = stateManager.getSegmentationState();
      expect(segmentationState.currentSegmentName).toBe('High Priority Swing');
    });
  });

  describe('canvassing state', () => {
    test('updateCanvassingState updates canvassing operation', () => {
      stateManager.updateCanvassingState({
        activeOperation: {
          id: 'op1',
          name: 'GOTV Push',
          createdAt: new Date(),
          status: 'active',
        },
      });

      const canvassingState = stateManager.getCanvassingState();
      expect(canvassingState.activeOperation?.name).toBe('GOTV Push');
      expect(canvassingState.activeOperation?.status).toBe('active');
    });

    test('updateCanvassingState updates progress', () => {
      stateManager.updateCanvassingState({
        progress: {
          totalDoors: 1000,
          doorsKnocked: 250,
          contacts: 100,
          notHome: 150,
          responses: { yes: 60, no: 30, undecided: 10 },
        },
      });

      const canvassingState = stateManager.getCanvassingState();
      expect(canvassingState.progress.doorsKnocked).toBe(250);
      expect(canvassingState.progress.contacts).toBe(100);
    });
  });

  describe('donor state via dispatch', () => {
    test('DONOR_VIEW_CHANGED updates donor view', () => {
      stateManager.dispatch({
        type: 'DONOR_VIEW_CHANGED',
        payload: { view: 'timeSeries' },
        timestamp: new Date(),
      });

      const donorState = stateManager.getDonorState();
      expect(donorState.activeView).toBe('timeSeries');
    });
  });

  describe('comparison state via dispatch', () => {
    test('COMPARISON_STARTED sets entities', () => {
      const leftEntity = {
        type: 'precinct' as const,
        id: 'P001',
        name: 'Lansing Precinct 1',
        data: { id: 'P001' },
      };
      const rightEntity = {
        type: 'precinct' as const,
        id: 'P002',
        name: 'Lansing Precinct 2',
        data: { id: 'P002' },
      };

      stateManager.dispatch({
        type: 'COMPARISON_STARTED',
        payload: { leftEntity, rightEntity },
        timestamp: new Date(),
      });

      const comparisonState = stateManager.getComparisonState();
      expect(comparisonState.leftEntity?.id).toBe('P001');
      expect(comparisonState.rightEntity?.id).toBe('P002');
    });

    test('COMPARISON_COMPLETED stores results', () => {
      const results = [
        { entityId: 'P003', entityName: 'Test', score: 0.85, matchedFactors: ['turnout'] },
      ];

      stateManager.dispatch({
        type: 'COMPARISON_COMPLETED',
        payload: { results },
        timestamp: new Date(),
      });

      const comparisonState = stateManager.getComparisonState();
      expect(comparisonState.similarityResults).toHaveLength(1);
      expect(comparisonState.similarityResults[0].score).toBe(0.85);
    });
  });

  describe('session management', () => {
    test('clearSession removes from localStorage', () => {
      stateManager.clearSession();
      expect(localStorageMock.removeItem).toHaveBeenCalled();
    });
  });

  describe('exploration depth', () => {
    test('getExplorationDepth returns numeric value', () => {
      const depth = stateManager.getExplorationDepth();
      expect(typeof depth).toBe('number');
      expect(depth).toBeGreaterThanOrEqual(0);
    });

    test('exploration depth increases with actions', () => {
      const initialDepth = stateManager.getExplorationDepth();

      // Simulate exploration
      stateManager.dispatch({
        type: 'PRECINCT_SELECTED',
        payload: {
          precinctId: 'P001',
          precinctName: 'Test',
          precinct: { id: 'P001' },
        },
        timestamp: new Date(),
      });

      stateManager.dispatch({
        type: 'PRECINCT_SELECTED',
        payload: {
          precinctId: 'P002',
          precinctName: 'Test 2',
          precinct: { id: 'P002' },
        },
        timestamp: new Date(),
      });

      const finalDepth = stateManager.getExplorationDepth();
      expect(finalDepth).toBeGreaterThanOrEqual(initialDepth);
    });
  });

  describe('tool context', () => {
    test('getCurrentTool returns current tool', () => {
      const tool = stateManager.getCurrentTool();
      expect(tool).toBeDefined();
    });

    test('setCurrentTool updates tool', () => {
      stateManager.setCurrentTool('segments');
      expect(stateManager.getCurrentTool()).toBe('segments');
    });

    test('getToolContexts returns tool-specific contexts', () => {
      const contexts = stateManager.getToolContexts();
      expect(contexts).toHaveProperty('segments');
      expect(contexts).toHaveProperty('donors');
      expect(contexts).toHaveProperty('canvass');
      expect(contexts).toHaveProperty('compare');
    });
  });

  describe('resume options', () => {
    test('getResumeOptions returns array', () => {
      const options = stateManager.getResumeOptions();
      expect(Array.isArray(options)).toBe(true);
    });
  });

  describe('context for AI', () => {
    test('getContextForAI returns context string', () => {
      const context = stateManager.getContextForAI();
      expect(typeof context).toBe('string');
    });

    test('getContextSummary returns summary string', () => {
      const summary = stateManager.getContextSummary();
      expect(typeof summary).toBe('string');
    });
  });

  describe('exploration metrics', () => {
    test('getExplorationMetrics returns metrics object', () => {
      const metrics = stateManager.getExplorationMetrics();
      expect(metrics).toHaveProperty('precinctsViewed');
      // Note: actual implementation uses different property names
      expect(metrics).toHaveProperty('toolsVisited');
      expect(metrics).toHaveProperty('filtersApplied');
    });

    test('getExplorationSummary returns summary string', () => {
      const summary = stateManager.getExplorationSummary();
      expect(typeof summary).toBe('string');
    });
  });

  describe('temporal state', () => {
    test('getTemporalState returns temporal visualization state', () => {
      const temporal = stateManager.getTemporalState();
      expect(temporal).toHaveProperty('isTemporalMode');
      expect(temporal).toHaveProperty('selectedYear');
      expect(temporal).toHaveProperty('availableYears');
    });

    test('enableTemporalMode enables temporal mode', () => {
      stateManager.enableTemporalMode(2024);
      const temporal = stateManager.getTemporalState();
      expect(temporal.isTemporalMode).toBe(true);
      expect(temporal.selectedYear).toBe(2024);
    });

    test('disableTemporalMode disables temporal mode', () => {
      stateManager.enableTemporalMode(2024);
      stateManager.disableTemporalMode();
      const temporal = stateManager.getTemporalState();
      expect(temporal.isTemporalMode).toBe(false);
    });
  });

  describe('loading state', () => {
    test('getLoadingState returns loading state', () => {
      const loading = stateManager.getLoadingState();
      // Actual property names in implementation
      expect(loading).toHaveProperty('isAnyLoading');
      expect(loading).toHaveProperty('activeOperations');
    });

    test('startLoading sets loading state', () => {
      stateManager.startLoading('op1', 'Test Operation');
      expect(stateManager.isLoading()).toBe(true);
      expect(stateManager.isOperationLoading('op1')).toBe(true);
    });

    test('loadingSuccess clears operation', () => {
      stateManager.startLoading('op1', 'Test Operation');
      stateManager.loadingSuccess('op1');
      expect(stateManager.isOperationLoading('op1')).toBe(false);
    });

    test('loadingError records error', () => {
      stateManager.startLoading('op1', 'Test Operation');
      stateManager.loadingError('op1', 'Something went wrong');
      const loading = stateManager.getLoadingState();
      expect(loading.lastError).toBeDefined();
    });
  });

  describe('feature selection', () => {
    test('selectFeature updates feature selection state', () => {
      const feature = {
        id: 'P001',
        name: 'Test Precinct',
        featureType: 'precinct' as const,
        metrics: { partisanLean: -5 },
      };

      stateManager.selectFeature(feature);

      const featureState = stateManager.getFeatureSelectionState();
      expect(featureState.currentFeature?.id).toBe('P001');
    });

    test('deselectFeature clears feature selection', () => {
      const feature = {
        id: 'P001',
        name: 'Test Precinct',
        featureType: 'precinct' as const,
        metrics: { partisanLean: -5 },
      };

      stateManager.selectFeature(feature);
      stateManager.deselectFeature();

      expect(stateManager.getCurrentFeature()).toBeNull();
    });

    test('getRecentFeatures returns feature history', () => {
      const features = stateManager.getRecentFeatures(5);
      expect(Array.isArray(features)).toBe(true);
    });
  });

  describe('shared map state', () => {
    test('getSharedMapState returns shared map state', () => {
      const mapState = stateManager.getSharedMapState();
      expect(mapState).toHaveProperty('layer');
      expect(mapState).toHaveProperty('metric');
      expect(mapState).toHaveProperty('highlights');
    });

    test('updateSharedMapState updates shared state', () => {
      stateManager.updateSharedMapState({
        layer: 'heatmap',
        metric: 'swing_potential',
      });

      const mapState = stateManager.getSharedMapState();
      expect(mapState.layer).toBe('heatmap');
      expect(mapState.metric).toBe('swing_potential');
    });
  });

  describe('reset', () => {
    test('reset clears all state', () => {
      // Add some state
      stateManager.dispatch({
        type: 'PRECINCT_SELECTED',
        payload: {
          precinctId: 'P001',
          precinctName: 'Test',
          precinct: { id: 'P001' },
        },
        timestamp: new Date(),
      });

      stateManager.reset();

      const selectionState = stateManager.getSelectionState();
      expect(selectionState.type).toBe('none');
      expect(selectionState.selectedIds).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    test('handles empty precinct selection gracefully', () => {
      stateManager.dispatch({
        type: 'PRECINCT_SELECTED',
        payload: {
          precinctId: '',
          precinctName: '',
          precinct: null,
        },
        timestamp: new Date(),
      });

      // Should not throw
      const selectionState = stateManager.getSelectionState();
      expect(selectionState).toBeDefined();
    });

    test('handles multiple rapid dispatches', () => {
      for (let i = 0; i < 100; i++) {
        stateManager.dispatch({
          type: 'MAP_MOVED',
          payload: { center: [-84.55, 42.73 + i * 0.001], zoom: 10 },
          timestamp: new Date(),
        });
      }

      const behaviorState = stateManager.getBehaviorState();
      expect(behaviorState.actionsThisSession.length).toBe(100);
    });

    test('listener errors do not break other listeners', () => {
      const errorListener = jest.fn(() => {
        throw new Error('Test error');
      });
      const goodListener = jest.fn();

      stateManager.subscribe(errorListener);
      stateManager.subscribe(goodListener);

      // Should not throw despite errorListener
      stateManager.dispatch({
        type: 'MAP_MOVED',
        payload: { center: [-84.55, 42.73], zoom: 10 },
        timestamp: new Date(),
      });

      expect(goodListener).toHaveBeenCalled();
    });
  });
});
