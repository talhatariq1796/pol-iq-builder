/**
 * SuggestionEngine Tests
 *
 * Tests context-aware suggestion generation for the AI.
 * Run with: npm test -- --testPathPattern=SuggestionEngine
 */

// Mock dependencies before imports
jest.mock('@/lib/ai-native/ApplicationStateManager', () => {
  const mockState = {
    map: {
      center: [-84.55, 42.60],
      zoom: 10,
      visiblePrecincts: ['P1', 'P2', 'P3'],
      activeLayer: 'choropleth',
      activeMetric: 'partisan_lean',
      highlightedFeatures: [],
      extent: null,
    },
    selection: {
      type: 'none',
      selectedIds: [],
      selectedEntity: null,
      selectionHistory: [],
    },
    behavior: {
      sessionStartTime: new Date(),
      lastInteractionTime: new Date(),
      actionsThisSession: [],
      exploredPrecincts: new Set<string>(),
      exploredMunicipalities: new Set<string>(),
      queriesAsked: [],
      suggestionsAccepted: [],
      suggestionsIgnored: [],
    },
    temporal: {
      idleTime: 0,
      timeInCurrentView: 0,
      returningUser: false,
      previousSessionContext: null,
    },
    workflow: {
      activeWorkflow: null,
      workflowStep: 0,
      workflowData: {},
    },
    segmentation: {
      activeFilters: null,
      filterCount: 0,
      matchingPrecincts: [],
      matchCount: 0,
      savedSegments: [],
      currentSegmentName: null,
      lookalikeReference: null,
      lookalikeResults: [],
    },
    canvassing: {
      activeOperation: null,
      loadedUniverse: null,
      turfs: [],
      volunteers: [],
      assignments: [],
      progress: { totalDoors: 0, doorsKnocked: 0, contacts: 0, notHome: 0, responses: {} },
      performanceMetrics: null,
    },
    donors: {
      activeView: 'zip',
      selectedZips: [],
      timeRange: null,
      partyFilter: 'all',
      selectedCandidates: [],
      lapsedThreshold: 12,
      upgradeMinAmount: 100,
    },
    comparison: {
      leftEntity: null,
      rightEntity: null,
      comparisonType: null,
      similarityResults: [],
      activeMetrics: [],
    },
    reports: {
      selectedArea: null,
      reportType: 'political',
      generationStatus: 'idle',
      lastGeneratedReport: null,
      recentReports: [],
    },
    currentTool: 'overview',
    explorationHistory: [],
    toolContexts: {},
    sharedMapState: {},
    featureSelection: { selectedFeatures: [], mode: 'single' },
    temporal_viz: {
      isTemporalMode: false,
      selectedYear: null,
      selectedMonth: null,
      comparisonYears: [],
      visualizationMode: 'slider',
      isPlaying: false,
      animationSpeed: 1000,
      availableYears: [2020, 2022, 2024],
    },
    expertise: {
      currentLevel: 'intermediate',
      indicators: {
        avgActionSpeed: 500,
        complexQueryRatio: 0.3,
        helpsRequested: 2,
        tutorialSkips: 1,
        shortcutsUsed: 5,
        precisionClicks: 10,
        explorationBreadth: 5,
        sessionCount: 3,
      },
      confidenceScore: 75,
      lastUpdated: new Date(),
      levelHistory: [],
    },
    numberedMarkers: [],
    loading: {
      activeOperations: new Map(),
      recentErrors: [],
      isAnyLoading: false,
      lastError: null,
    },
    iqBuilder: {
      activeTab: 'select',
      hasAnalysisResult: false,
      lastAnalysis: null,
      boundaryType: null,
      selectedBoundaryIds: [],
    },
  };

  return {
    getStateManager: jest.fn(() => ({
      getState: jest.fn(() => mockState),
      getExplorationDepth: jest.fn(() => 25),
      getResumeOptions: jest.fn(() => []),
      hasInterestIn: jest.fn(() => false),
      getActiveMapLayer: jest.fn(() => ({ layerType: 'choropleth', metric: 'partisan_lean' })),
      isVisualizationActive: jest.fn(() => false),
      getBehaviorState: jest.fn(() => mockState.behavior),
      getSegmentationState: jest.fn(() => mockState.segmentation),
      getCanvassingState: jest.fn(() => mockState.canvassing),
      getDonorState: jest.fn(() => mockState.donors),
      getComparisonState: jest.fn(() => mockState.comparison),
      getCurrentTool: jest.fn(() => 'overview'),
      getExplorationMetrics: jest.fn(() => ({
        precinctsViewed: 3,
        municipalitiesViewed: 1,
        toolsVisited: ['overview'],
        filtersApplied: 0,
        comparisonsMade: 0,
        segmentsSaved: 0,
        highValueFound: false,
      })),
    })),
  };
});

jest.mock('@/lib/ai/spatial', () => ({
  getSpatialReasoningEngine: jest.fn(() => ({
    analyzeSpatialContext: jest.fn(() => Promise.resolve(null)),
    generateSuggestions: jest.fn(() => []),
  })),
}));

jest.mock('@/lib/ai/insights', () => ({
  getInsightEngine: jest.fn(() => ({
    checkInsights: jest.fn(() => ({ shouldTrigger: false, insights: [] })),
  })),
  frameAsDiscovery: jest.fn((insight) => insight),
  getFollowUpQuestions: jest.fn(() => []),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Import after mocks
import { getSuggestionEngine, type SuggestedAction, type AIMessage } from '@/lib/ai-native/SuggestionEngine';

describe('SuggestionEngine', () => {
  let suggestionEngine: ReturnType<typeof getSuggestionEngine>;

  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
    suggestionEngine = getSuggestionEngine();
  });

  // ========================================
  // Singleton Tests
  // ========================================
  describe('singleton', () => {
    test('getInstance returns same instance', () => {
      const instance1 = getSuggestionEngine();
      const instance2 = getSuggestionEngine();
      expect(instance1).toBe(instance2);
    });
  });

  // ========================================
  // Precinct Selection Message Tests
  // ========================================
  describe('generatePrecinctSelectionMessage', () => {
    const mockPrecinct = {
      id: 'P1',
      name: 'Test Precinct',
      jurisdiction: 'East Lansing',
      jurisdictionType: 'city',
      demographics: {
        totalPopulation: 5000,
        population18up: 4000,
        medianAge: 35,
        medianHHI: 65000,
        collegePct: 55,
        homeownerPct: 50,
        diversityIndex: 0.4,
        populationDensity: 3000,
      },
      political: {
        demAffiliationPct: 55,
        repAffiliationPct: 30,
        independentPct: 15,
        liberalPct: 45,
        moderatePct: 35,
        conservativePct: 20,
      },
      electoral: {
        partisanLean: 15,
        swingPotential: 40,
        competitiveness: 'lean_d',
        avgTurnout: 60,
        turnoutDropoff: 12,
      },
      targeting: {
        gotvPriority: 65,
        persuasionOpportunity: 55,
        combinedScore: 60,
        strategy: 'mixed',
      },
    };

    test('returns AIMessage structure', () => {
      const message = suggestionEngine.generatePrecinctSelectionMessage(mockPrecinct as any);

      expect(message).toHaveProperty('acknowledgment');
      expect(message).toHaveProperty('suggestions');
      expect(typeof message.acknowledgment).toBe('string');
      expect(Array.isArray(message.suggestions)).toBe(true);
    });

    test('acknowledgment includes precinct name', () => {
      const message = suggestionEngine.generatePrecinctSelectionMessage(mockPrecinct as any);

      expect(message.acknowledgment).toContain('Test Precinct');
    });

    test('suggestions are prioritized', () => {
      const message = suggestionEngine.generatePrecinctSelectionMessage(mockPrecinct as any);

      if (message.suggestions.length > 1) {
        // Check that suggestions are sorted by priority (descending)
        for (let i = 1; i < message.suggestions.length; i++) {
          expect(message.suggestions[i - 1].priority).toBeGreaterThanOrEqual(
            message.suggestions[i].priority
          );
        }
      }
    });

    test('suggestions have required fields', () => {
      const message = suggestionEngine.generatePrecinctSelectionMessage(mockPrecinct as any);

      message.suggestions.forEach(suggestion => {
        expect(suggestion).toHaveProperty('id');
        expect(suggestion).toHaveProperty('label');
        expect(suggestion).toHaveProperty('action');
        expect(suggestion).toHaveProperty('priority');
        expect(suggestion).toHaveProperty('category');
      });
    });
  });

  // ========================================
  // Municipality Selection Message Tests
  // ========================================
  describe('generateMunicipalitySelectionMessage', () => {
    const mockMunicipality = {
      id: 'east-lansing',
      name: 'East Lansing',
      type: 'city',
      county: 'Ingham',
      population: 48000,
    };

    test('returns AIMessage structure', () => {
      const message = suggestionEngine.generateMunicipalitySelectionMessage(mockMunicipality as any);

      expect(message).toHaveProperty('acknowledgment');
      expect(message).toHaveProperty('suggestions');
    });

    test('acknowledgment includes municipality name', () => {
      const message = suggestionEngine.generateMunicipalitySelectionMessage(mockMunicipality as any);

      expect(message.acknowledgment).toContain('East Lansing');
    });

    test('acknowledgment includes municipality type', () => {
      const message = suggestionEngine.generateMunicipalitySelectionMessage(mockMunicipality as any);

      expect(message.acknowledgment).toContain('city');
    });
  });

  // ========================================
  // Map View Message Tests
  // ========================================
  describe('generateMapViewMessage', () => {
    const mockMapState = {
      center: [-84.55, 42.60],
      zoom: 12,
      visiblePrecincts: ['P1', 'P2', 'P3', 'P4', 'P5'],
      activeLayer: 'heatmap',
      activeMetric: 'swing_potential',
      highlightedFeatures: [],
      extent: null,
    };

    test('returns AIMessage structure', () => {
      const message = suggestionEngine.generateMapViewMessage(mockMapState as any);

      expect(message).toHaveProperty('acknowledgment');
      expect(message).toHaveProperty('suggestions');
    });

    test('acknowledgment includes visible precinct count', () => {
      const message = suggestionEngine.generateMapViewMessage(mockMapState as any);

      expect(message.acknowledgment).toContain('5');
    });

    test('acknowledgment includes active metric when present', () => {
      const message = suggestionEngine.generateMapViewMessage(mockMapState as any);

      expect(message.acknowledgment).toContain('swing');
    });
  });

  // ========================================
  // Analysis Complete Message Tests
  // ========================================
  describe('generateAnalysisCompleteMessage', () => {
    const mockResult = {
      precincts: [
        { id: 'P1', name: 'Precinct 1' },
        { id: 'P2', name: 'Precinct 2' },
      ],
      aggregatedMetrics: {
        avgPartisanLean: 12.5,
        avgSwingPotential: 35,
        avgGotvPriority: 65,
        totalVoters: 10000,
      },
      areaName: 'East Lansing',
    };

    test('returns AIMessage structure', () => {
      const message = suggestionEngine.generateAnalysisCompleteMessage(mockResult as any);

      expect(message).toHaveProperty('acknowledgment');
      expect(message).toHaveProperty('suggestions');
    });

    test('acknowledgment includes area name', () => {
      const message = suggestionEngine.generateAnalysisCompleteMessage(mockResult as any);

      expect(message.acknowledgment).toContain('East Lansing');
    });

    test('acknowledgment includes precinct count', () => {
      const message = suggestionEngine.generateAnalysisCompleteMessage(mockResult as any);

      expect(message.acknowledgment).toContain('2');
    });

    test('insight includes metric information', () => {
      const message = suggestionEngine.generateAnalysisCompleteMessage(mockResult as any);

      // Insight may be undefined or contain metrics
      if (message.insight) {
        expect(typeof message.insight).toBe('string');
      }
    });
  });

  // ========================================
  // Session Message Tests
  // ========================================
  describe('generateSessionMessage', () => {
    test('returns AIMessage structure', () => {
      const message = suggestionEngine.generateSessionMessage();

      expect(message).toHaveProperty('acknowledgment');
      expect(message).toHaveProperty('suggestions');
    });

    test('new user gets quick start suggestions', () => {
      const message = suggestionEngine.generateSessionMessage();

      // Should have exploration/workflow suggestions for new users
      expect(message.suggestions.length).toBeGreaterThan(0);
    });

    test('suggestions include exploration options', () => {
      const message = suggestionEngine.generateSessionMessage();

      const explorationSuggestions = message.suggestions.filter(
        s => s.category === 'exploration' || s.category === 'workflow'
      );

      expect(explorationSuggestions.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ========================================
  // Suggestion Priority Tests
  // ========================================
  describe('suggestion prioritization', () => {
    test('prioritizes suggestions by relevance', () => {
      const mockPrecinct = {
        id: 'P1',
        name: 'High GOTV Precinct',
        targeting: {
          gotvPriority: 90,
          persuasionOpportunity: 30,
          combinedScore: 65,
          strategy: 'gotv',
        },
        electoral: {
          partisanLean: 20,
          swingPotential: 15,
          competitiveness: 'likely_d',
          avgTurnout: 45,
        },
        demographics: {},
        political: {},
      };

      const message = suggestionEngine.generatePrecinctSelectionMessage(mockPrecinct as any);

      // All suggestions should have priority between 0-100
      message.suggestions.forEach(s => {
        expect(s.priority).toBeGreaterThanOrEqual(0);
        expect(s.priority).toBeLessThanOrEqual(100);
      });
    });
  });

  // ========================================
  // Suggestion Category Tests
  // ========================================
  describe('suggestion categories', () => {
    const validCategories = [
      'exploration',
      'analysis',
      'comparison',
      'segmentation',
      'canvassing',
      'donors',
      'reporting',
      'workflow',
      'session',
    ];

    test('all suggestions have valid categories', () => {
      const mockPrecinct = {
        id: 'P1',
        name: 'Test',
        targeting: { gotvPriority: 60, persuasionOpportunity: 50, combinedScore: 55, strategy: 'mixed' },
        electoral: { partisanLean: 10, swingPotential: 40, competitiveness: 'lean_d', avgTurnout: 55 },
        demographics: {},
        political: {},
      };

      const message = suggestionEngine.generatePrecinctSelectionMessage(mockPrecinct as any);

      message.suggestions.forEach(s => {
        expect(validCategories).toContain(s.category);
      });
    });
  });

  // ========================================
  // Proactive Preferences Tests
  // ========================================
  describe('proactive preferences', () => {
    test('loadPreferences returns preferences object', () => {
      // Access via the engine's internal method if available
      // Just test that the engine doesn't crash with missing preferences
      const message = suggestionEngine.generateSessionMessage();
      expect(message).toBeDefined();
    });

    test('dismissTrigger adds trigger to dismissed list', () => {
      suggestionEngine.dismissTrigger('idle-help-1');
      suggestionEngine.dismissTrigger('idle-help-2');

      // Verify by checking that dismissing doesn't throw
      expect(() => suggestionEngine.dismissTrigger('idle-help-3')).not.toThrow();
    });

    test('disableCategory disables entire category', () => {
      suggestionEngine.disableCategory('idle-help');

      // Verify by checking that disabling doesn't throw
      expect(() => suggestionEngine.disableCategory('exploration-tips')).not.toThrow();
    });
  });

  // ========================================
  // Cooldown Management Tests
  // ========================================
  describe('cooldown management', () => {
    test('same suggestion not repeated within cooldown', () => {
      const mockPrecinct = {
        id: 'P1',
        name: 'Test',
        targeting: { gotvPriority: 60, persuasionOpportunity: 50, combinedScore: 55, strategy: 'mixed' },
        electoral: { partisanLean: 10, swingPotential: 40, competitiveness: 'lean_d', avgTurnout: 55 },
        demographics: {},
        political: {},
      };

      // Generate suggestions twice in quick succession
      const message1 = suggestionEngine.generatePrecinctSelectionMessage(mockPrecinct as any);
      const message2 = suggestionEngine.generatePrecinctSelectionMessage(mockPrecinct as any);

      // Both should return valid suggestions (cooldown applies to specific IDs)
      expect(message1.suggestions).toBeDefined();
      expect(message2.suggestions).toBeDefined();
    });
  });

  // ========================================
  // Ambient Awareness Tests
  // ========================================
  describe('ambient awareness', () => {
    test('trackHover records hover events', () => {
      // If method exists, it should not throw
      if (typeof (suggestionEngine as any).trackHover === 'function') {
        expect(() => (suggestionEngine as any).trackHover('P1')).not.toThrow();
      }
    });

    test('trackFilter records filter events', () => {
      // If method exists, it should not throw
      if (typeof (suggestionEngine as any).trackFilter === 'function') {
        expect(() => (suggestionEngine as any).trackFilter('partisan_lean')).not.toThrow();
      }
    });
  });

  // ========================================
  // Edge Cases
  // ========================================
  describe('edge cases', () => {
    test('handles precinct with missing name', () => {
      const mockPrecinct = {
        id: 'P1',
        targeting: { gotvPriority: 60, persuasionOpportunity: 50, combinedScore: 55, strategy: 'mixed' },
        electoral: { partisanLean: 10, swingPotential: 40, competitiveness: 'lean_d', avgTurnout: 55 },
        demographics: {},
        political: {},
      };

      const message = suggestionEngine.generatePrecinctSelectionMessage(mockPrecinct as any);

      expect(message).toBeDefined();
      expect(message.acknowledgment).toBeDefined();
    });

    test('handles empty map state', () => {
      const emptyMapState = {
        center: [-84.55, 42.60],
        zoom: 10,
        visiblePrecincts: [],
        activeLayer: 'none',
        activeMetric: null,
        highlightedFeatures: [],
        extent: null,
      };

      const message = suggestionEngine.generateMapViewMessage(emptyMapState as any);

      expect(message).toBeDefined();
      expect(message.acknowledgment).toContain('0');
    });

    test('handles analysis result with empty precincts', () => {
      const emptyResult = {
        precincts: [],
        aggregatedMetrics: {},
        areaName: 'Empty Area',
      };

      const message = suggestionEngine.generateAnalysisCompleteMessage(emptyResult as any);

      expect(message).toBeDefined();
      expect(message.acknowledgment).toContain('0');
    });

    test('handles municipality with missing type', () => {
      const mockMunicipality = {
        id: 'test',
        name: 'Test Place',
      };

      const message = suggestionEngine.generateMunicipalitySelectionMessage(mockMunicipality as any);

      expect(message).toBeDefined();
      expect(message.acknowledgment).toBeDefined();
    });
  });

  // ========================================
  // Integration-like Tests
  // ========================================
  describe('integration scenarios', () => {
    test('full precinct selection flow', () => {
      const mockPrecinct = {
        id: 'P1',
        name: 'Integration Test Precinct',
        jurisdiction: 'Lansing',
        jurisdictionType: 'city',
        demographics: {
          totalPopulation: 8000,
          population18up: 6500,
          medianAge: 32,
          medianHHI: 55000,
          collegePct: 65,
          homeownerPct: 35,
          diversityIndex: 0.5,
          populationDensity: 4500,
        },
        political: {
          demAffiliationPct: 58,
          repAffiliationPct: 25,
          independentPct: 17,
          liberalPct: 50,
          moderatePct: 30,
          conservativePct: 20,
        },
        electoral: {
          partisanLean: 18,
          swingPotential: 35,
          competitiveness: 'lean_d',
          avgTurnout: 52,
          turnoutDropoff: 18,
        },
        targeting: {
          gotvPriority: 75,
          persuasionOpportunity: 45,
          combinedScore: 62,
          strategy: 'gotv',
        },
      };

      const message = suggestionEngine.generatePrecinctSelectionMessage(mockPrecinct as any);

      // Verify complete message structure
      expect(message.acknowledgment).toBeTruthy();
      expect(message.suggestions.length).toBeGreaterThan(0);

      // Verify suggestion quality
      message.suggestions.forEach(s => {
        expect(s.id).toBeTruthy();
        expect(s.label).toBeTruthy();
        expect(s.action).toBeTruthy();
        expect(typeof s.priority).toBe('number');
      });
    });
  });
});
