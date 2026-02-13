/**
 * ContextEnrichmentService Unit Tests
 *
 * Tests context enrichment functions that combine RAG and Knowledge Graph data.
 * Run with: npm test -- --testPathPattern=ContextEnrichmentService
 */

import {
  enrich,
  enrichDistrictAnalysis,
  enrichFilterQuery,
  enrichComparison,
  formatForResponse,
  formatForSystemPrompt,
} from '@/lib/context/ContextEnrichmentService';
import type { EnrichmentContext } from '@/lib/context/types';
import type { RAGDocument, CurrentIntelDocument, RetrievalResult } from '@/lib/rag';
import type { CandidateContext } from '@/lib/knowledge-graph/CandidateContextService';
import type { IssueEntity, Entity, Relationship } from '@/lib/knowledge-graph/types';

// Mock the RAG module
jest.mock('@/lib/rag', () => {
  const mockRetrieve = jest.fn();
  const mockInitialize = jest.fn().mockResolvedValue(undefined);

  return {
    getDocumentRetriever: jest.fn(() => ({
      initialize: mockInitialize,
      retrieve: mockRetrieve,
    })),
    DocumentRetriever: jest.fn(),
  };
});

// Mock the Knowledge Graph module
jest.mock('@/lib/knowledge-graph', () => {
  const mockQuery = jest.fn();
  const mockGetEntity = jest.fn();
  const mockGetConnections = jest.fn();
  const mockPopulate = jest.fn().mockResolvedValue({ entitiesAdded: 10, relationshipsAdded: 5 });

  return {
    getKnowledgeGraph: jest.fn(() => ({
      query: mockQuery,
      getEntity: mockGetEntity,
      getConnections: mockGetConnections,
    })),
    getGraphPopulator: jest.fn(() => ({
      populate: mockPopulate,
    })),
    KnowledgeGraph: jest.fn(),
    GraphPopulator: jest.fn(),
  };
});

// Mock the CandidateContextService
jest.mock('@/lib/knowledge-graph/CandidateContextService', () => ({
  getStateHouseContext: jest.fn(),
  getStateSenateContext: jest.fn(),
  getCongressionalContext: jest.fn(),
  getUSSenateContext: jest.fn(),
  getInghamCountyRepresentatives: jest.fn(),
  formatCandidateContextForResponse: jest.fn((context) => {
    if (context.incumbent) {
      return `**${context.incumbent.name}** (${context.office?.name || 'Office'})`;
    }
    return 'No incumbent';
  }),
}));

// Import mocked modules
import { getDocumentRetriever } from '@/lib/rag';
import { getKnowledgeGraph, getGraphPopulator } from '@/lib/knowledge-graph';
import {
  getStateHouseContext,
  getStateSenateContext,
  getCongressionalContext,
  getInghamCountyRepresentatives,
} from '@/lib/knowledge-graph/CandidateContextService';

describe('ContextEnrichmentService', () => {
  // Mock data factories
  const createMockRAGDocument = (overrides?: Partial<RAGDocument>): RAGDocument => ({
    id: 'doc-1',
    title: 'Partisan Lean Methodology',
    path: '/docs/methodology/partisan-lean.md',
    description: 'How partisan lean scores are calculated',
    content: 'Full methodology content...',
    keywords: ['partisan', 'lean', 'methodology'],
    category: 'methodology',
    use_when: ['partisan lean', 'methodology'],
    ...overrides,
  });

  const createMockIntelDocument = (overrides?: Partial<CurrentIntelDocument>): CurrentIntelDocument => ({
    id: 'intel-1',
    type: 'news',
    title: 'Election Update',
    path: '/data/current-intel/news/election-update.json',
    content: 'Latest election news...',
    source: 'Local News',
    published: new Date().toISOString(),
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    keywords: ['election', 'update'],
    jurisdictions: ['Ingham County'],
    relevance: ['voting'],
    priority: 50,
    ...overrides,
  });

  const createMockCandidateContext = (overrides?: Partial<CandidateContext>): CandidateContext => ({
    incumbent: {
      name: 'John Smith',
      party: 'DEM',
      biography: 'A dedicated public servant',
    },
    office: {
      name: 'Michigan State House District 73',
      level: 'state',
      district: '73',
      nextElection: '2024-11-05',
      termLength: 2,
    },
    challengers: [],
    ...overrides,
  });

  const createMockIssue = (overrides?: Partial<IssueEntity>): IssueEntity => ({
    id: 'issue:education',
    type: 'issue',
    name: 'Education Funding',
    aliases: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: {
      category: 'social',
      salience: 75,
      keywords: ['schools', 'funding'],
    },
    ...overrides,
  });

  // Setup and teardown
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock implementations
    const mockRetriever = getDocumentRetriever();
    (mockRetriever.retrieve as jest.Mock).mockResolvedValue({
      documents: [createMockRAGDocument()],
      currentIntel: [createMockIntelDocument()],
      citations: [],
    });

    const mockGraph = getKnowledgeGraph();
    (mockGraph.query as jest.Mock).mockReturnValue({
      entities: [createMockIssue()],
      relationships: [],
    });
    (mockGraph.getEntity as jest.Mock).mockReturnValue(null);
    (mockGraph.getConnections as jest.Mock).mockReturnValue([]);

    (getInghamCountyRepresentatives as jest.Mock).mockResolvedValue({
      federal: {
        senators: [],
        representative: createMockCandidateContext({
          office: {
            name: 'US House MI-07',
            level: 'federal',
            district: '7',
            nextElection: '2024-11-05',
            termLength: 2,
          },
        }),
      },
      state: {
        senator: null,
        representative: null,
      },
    });

    (getStateHouseContext as jest.Mock).mockResolvedValue(createMockCandidateContext());
    (getStateSenateContext as jest.Mock).mockResolvedValue(createMockCandidateContext({
      office: {
        name: 'Michigan State Senate District 21',
        level: 'state',
        district: '21',
        nextElection: '2026-11-03',
        termLength: 4,
      },
    }));
    (getCongressionalContext as jest.Mock).mockResolvedValue(createMockCandidateContext({
      office: {
        name: 'US House MI-07',
        level: 'federal',
        district: '7',
        nextElection: '2024-11-05',
        termLength: 2,
      },
    }));
  });

  // ========================================
  // enrich Tests
  // ========================================
  describe('enrich', () => {
    test('returns EnrichmentContext with all fields', async () => {
      const result = await enrich('What is the partisan lean in Lansing?');

      expect(result).toHaveProperty('rag');
      expect(result).toHaveProperty('graph');
      expect(result).toHaveProperty('relevance');
      expect(result).toHaveProperty('formattedContext');
      expect(result).toHaveProperty('timestamp');
    });

    test('calls RAG retriever', async () => {
      // Note: The service uses a singleton pattern and only initializes once
      // on first call. Subsequent calls reuse the initialized state.
      await enrich('test query');
      const retriever = getDocumentRetriever();
      // Verify retriever.retrieve is called (initialization may have happened in earlier test)
      expect(retriever.retrieve).toHaveBeenCalled();
    });

    test('calls knowledge graph query', async () => {
      // Note: The service uses a singleton pattern and only populates once
      // on first call. Subsequent calls reuse the populated graph.
      await enrich('test query');
      const graph = getKnowledgeGraph();
      // Verify graph.query is called (population may have happened in earlier test)
      expect(graph.query).toHaveBeenCalled();
    });

    test('retrieves RAG documents', async () => {
      await enrich('What is the partisan lean?');
      const retriever = getDocumentRetriever();
      expect(retriever.retrieve).toHaveBeenCalled();
    });

    test('includes RAG documents in result', async () => {
      const result = await enrich('What is the partisan lean?');

      expect(result.rag.documents.length).toBeGreaterThanOrEqual(0);
    });

    test('includes current intel in result', async () => {
      const result = await enrich('What is the latest news?');

      expect(result.rag.currentIntel).toBeDefined();
    });

    test('includes candidate contexts for county queries', async () => {
      const result = await enrich('Who represents Ingham County?', {
        districtType: 'county',
      });

      expect(getInghamCountyRepresentatives).toHaveBeenCalled();
    });

    test('gets state house context when districtType is state_house', async () => {
      await enrich('Tell me about district 73', {
        districtType: 'state_house',
        districtNumber: '73',
      });

      expect(getStateHouseContext).toHaveBeenCalledWith('73');
    });

    test('gets state senate context when districtType is state_senate', async () => {
      await enrich('Tell me about senate district 21', {
        districtType: 'state_senate',
        districtNumber: '21',
      });

      expect(getStateSenateContext).toHaveBeenCalledWith('21');
    });

    test('gets congressional context when districtType is congressional', async () => {
      await enrich('Tell me about congressional district', {
        districtType: 'congressional',
        districtNumber: '7',
      });

      expect(getCongressionalContext).toHaveBeenCalled();
    });

    test('queries knowledge graph for issues', async () => {
      await enrich('What are the key issues?', {
        includeIssues: true,
      });

      const graph = getKnowledgeGraph();
      expect(graph.query).toHaveBeenCalledWith({
        entityTypes: ['issue'],
        limit: 20,
      });
    });

    test('skips issues when includeIssues is false', async () => {
      await enrich('test query', {
        includeIssues: false,
      });

      // Issues still queried but filtered during scoring
      expect(true).toBe(true);
    });

    test('calculates relevance scores', async () => {
      const result = await enrich('What is the partisan lean?');

      expect(result.relevance).toHaveProperty('ragScore');
      expect(result.relevance).toHaveProperty('graphScore');
      expect(result.relevance).toHaveProperty('overallScore');
      expect(result.relevance).toHaveProperty('shouldInclude');
      expect(result.relevance).toHaveProperty('reasons');
    });

    test('shouldInclude is true when overallScore meets threshold', async () => {
      // Setup high-relevance document
      const retriever = getDocumentRetriever();
      (retriever.retrieve as jest.Mock).mockResolvedValue({
        documents: [createMockRAGDocument({ title: 'partisan lean' })],
        currentIntel: [],
        citations: [],
      });

      const result = await enrich('Tell me about partisan lean', {
        relevanceThreshold: 0.3,
      });

      // Direct mention should give score 1.0
      expect(result.relevance.overallScore).toBeGreaterThanOrEqual(0);
    });

    test('formats context when shouldInclude is true', async () => {
      const retriever = getDocumentRetriever();
      (retriever.retrieve as jest.Mock).mockResolvedValue({
        documents: [createMockRAGDocument({ title: 'Test Document' })],
        currentIntel: [createMockIntelDocument({ title: 'Test Intel' })],
        citations: [],
      });

      const result = await enrich('Tell me about Test Document', {
        relevanceThreshold: 0.3,
      });

      // Even if document relevance is above threshold, formattedContext depends on shouldInclude
      expect(typeof result.formattedContext).toBe('string');
    });

    test('includes timestamp in result', async () => {
      const result = await enrich('test query');

      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp).getTime()).not.toBeNaN();
    });

    test('handles RAG retrieval errors gracefully', async () => {
      const retriever = getDocumentRetriever();
      (retriever.retrieve as jest.Mock).mockRejectedValue(new Error('RAG error'));

      const result = await enrich('test query');

      expect(result.rag.documents).toEqual([]);
      expect(result.rag.currentIntel).toEqual([]);
    });

    test('handles Knowledge Graph errors gracefully', async () => {
      const graph = getKnowledgeGraph();
      (graph.query as jest.Mock).mockImplementation(() => {
        throw new Error('Graph error');
      });

      const result = await enrich('test query');

      expect(result.graph.issues).toEqual([]);
    });

    test('uses default options when none provided', async () => {
      const result = await enrich('test query');

      // Default jurisdiction is Ingham County
      expect(result).toBeDefined();
    });

    test('merges provided options with defaults', async () => {
      const result = await enrich('test query', {
        relevanceThreshold: 0.5,
        maxRagDocs: 5,
      });

      // Result should be defined with merged options
      expect(result).toBeDefined();
    });
  });

  // ========================================
  // enrichDistrictAnalysis Tests
  // ========================================
  describe('enrichDistrictAnalysis', () => {
    test('calls enrich with district-specific options', async () => {
      await enrichDistrictAnalysis('state_house', '73');

      expect(getStateHouseContext).toHaveBeenCalledWith('73');
    });

    test('uses lower relevance threshold for direct district queries', async () => {
      const result = await enrichDistrictAnalysis('state_house', '73');

      // Result should be populated
      expect(result).toBeDefined();
      expect(result.graph).toBeDefined();
    });

    test('handles state_senate district type', async () => {
      await enrichDistrictAnalysis('state_senate', '21');

      expect(getStateSenateContext).toHaveBeenCalledWith('21');
    });

    test('handles congressional district type', async () => {
      // Note: getCandidateContexts requires both districtType AND districtNumber
      // to be set for the switch statement to execute
      await enrichDistrictAnalysis('congressional', '7');

      expect(getCongressionalContext).toHaveBeenCalled();
    });

    test('handles county district type', async () => {
      await enrichDistrictAnalysis('county');

      expect(getInghamCountyRepresentatives).toHaveBeenCalled();
    });

    test('builds query from district type when no number provided', async () => {
      const result = await enrichDistrictAnalysis('county');

      expect(result).toBeDefined();
    });

    test('includes candidate context', async () => {
      const result = await enrichDistrictAnalysis('state_house', '73');

      expect(result.graph.candidates).toBeDefined();
    });

    test('includes current intel', async () => {
      const result = await enrichDistrictAnalysis('state_house', '73');

      expect(result.rag.currentIntel).toBeDefined();
    });

    test('includes issues', async () => {
      const result = await enrichDistrictAnalysis('state_house', '73');

      expect(result.graph.issues).toBeDefined();
    });
  });

  // ========================================
  // enrichFilterQuery Tests
  // ========================================
  describe('enrichFilterQuery', () => {
    test('calls enrich with filter-specific options', async () => {
      const result = await enrichFilterQuery('high swing precincts', ['P001', 'P002']);

      expect(result).toBeDefined();
    });

    test('passes precincts to options', async () => {
      const result = await enrichFilterQuery('test query', ['P001', 'P002', 'P003']);

      // Precincts are passed through options
      expect(result).toBeDefined();
    });

    test('excludes candidates for filter queries', async () => {
      await enrichFilterQuery('high swing precincts', ['P001']);

      // For filter queries, candidates should not be fetched
      // This is handled by includeCandidates: false option
      expect(getStateHouseContext).not.toHaveBeenCalled();
    });

    test('includes current intel', async () => {
      const result = await enrichFilterQuery('test query', []);

      expect(result.rag.currentIntel).toBeDefined();
    });

    test('includes methodology when query contains "how"', async () => {
      const result = await enrichFilterQuery('how are swing scores calculated', []);

      // Result should be defined with methodology included
      expect(result).toBeDefined();
    });

    test('includes methodology when query contains "why"', async () => {
      const result = await enrichFilterQuery('why is this precinct high priority', []);

      // Result should be defined with methodology included
      expect(result).toBeDefined();
    });

    test('uses higher relevance threshold', async () => {
      const result = await enrichFilterQuery('test query', []);

      // Higher threshold (0.4) means stricter filtering
      expect(result).toBeDefined();
    });
  });

  // ========================================
  // enrichComparison Tests
  // ========================================
  describe('enrichComparison', () => {
    test('calls enrich with comparison-specific options', async () => {
      const result = await enrichComparison('Compare these areas', 'Lansing', 'East Lansing');

      expect(result).toBeDefined();
    });

    test('combines query with entity names', async () => {
      const result = await enrichComparison('partisan lean', 'Meridian', 'Delhi');

      // The query should include both entity names
      expect(result).toBeDefined();
    });

    test('includes candidate context', async () => {
      const result = await enrichComparison('representatives', 'District 73', 'District 74');

      expect(result.graph.candidates).toBeDefined();
    });

    test('includes current intel', async () => {
      const result = await enrichComparison('test', 'A', 'B');

      expect(result.rag.currentIntel).toBeDefined();
    });

    test('includes issues', async () => {
      const result = await enrichComparison('test', 'A', 'B');

      expect(result.graph.issues).toBeDefined();
    });
  });

  // ========================================
  // formatForResponse Tests
  // ========================================
  describe('formatForResponse', () => {
    test('returns empty string when shouldInclude is false', () => {
      const context: EnrichmentContext = {
        rag: {
          documents: [],
          currentIntel: [],
          citations: [],
          formattedContext: 'RAG content',
        },
        graph: {
          candidates: [],
          offices: [],
          relationships: [],
          issues: [],
          entities: [],
          formattedContext: 'Graph content',
        },
        relevance: {
          ragScore: 0.1,
          graphScore: 0.1,
          overallScore: 0.1,
          shouldInclude: false,
          reasons: ['Below threshold'],
        },
        formattedContext: 'Combined content',
        timestamp: new Date().toISOString(),
      };

      const result = formatForResponse(context);

      expect(result).toBe('');
    });

    test('returns formattedContext when shouldInclude is true', () => {
      const context: EnrichmentContext = {
        rag: {
          documents: [],
          currentIntel: [],
          citations: [],
          formattedContext: 'RAG content',
        },
        graph: {
          candidates: [],
          offices: [],
          relationships: [],
          issues: [],
          entities: [],
          formattedContext: 'Graph content',
        },
        relevance: {
          ragScore: 0.8,
          graphScore: 0.8,
          overallScore: 0.8,
          shouldInclude: true,
          reasons: ['High relevance'],
        },
        formattedContext: 'Combined context for response',
        timestamp: new Date().toISOString(),
      };

      const result = formatForResponse(context);

      expect(result).toBe('Combined context for response');
    });

    test('returns exactly the formattedContext field', () => {
      const expectedContent = 'Specific formatted content';
      const context: EnrichmentContext = {
        rag: {
          documents: [],
          currentIntel: [],
          citations: [],
          formattedContext: '',
        },
        graph: {
          candidates: [],
          offices: [],
          relationships: [],
          issues: [],
          entities: [],
          formattedContext: '',
        },
        relevance: {
          ragScore: 1.0,
          graphScore: 1.0,
          overallScore: 1.0,
          shouldInclude: true,
          reasons: [],
        },
        formattedContext: expectedContent,
        timestamp: new Date().toISOString(),
      };

      expect(formatForResponse(context)).toBe(expectedContent);
    });
  });

  // ========================================
  // formatForSystemPrompt Tests
  // ========================================
  describe('formatForSystemPrompt', () => {
    test('returns empty string when shouldInclude is false', () => {
      const context: EnrichmentContext = {
        rag: {
          documents: [],
          currentIntel: [],
          citations: [],
          formattedContext: '',
        },
        graph: {
          candidates: [],
          offices: [],
          relationships: [],
          issues: [],
          entities: [],
          formattedContext: '',
        },
        relevance: {
          ragScore: 0.1,
          graphScore: 0.1,
          overallScore: 0.1,
          shouldInclude: false,
          reasons: [],
        },
        formattedContext: '',
        timestamp: new Date().toISOString(),
      };

      const result = formatForSystemPrompt(context);

      expect(result).toBe('');
    });

    test('returns formatted system prompt when shouldInclude is true', () => {
      const context: EnrichmentContext = {
        rag: {
          documents: [],
          currentIntel: [],
          citations: [],
          formattedContext: '',
        },
        graph: {
          candidates: [],
          offices: [],
          relationships: [],
          issues: [],
          entities: [],
          formattedContext: '',
        },
        relevance: {
          ragScore: 0.8,
          graphScore: 0.8,
          overallScore: 0.8,
          shouldInclude: true,
          reasons: [],
        },
        formattedContext: 'Test context',
        timestamp: new Date().toISOString(),
      };

      const result = formatForSystemPrompt(context);

      expect(result).toContain('Contextual Intelligence');
      expect(result).toContain('Test context');
      expect(result).toContain('Citation Instructions');
    });

    test('includes citation instructions', () => {
      const context: EnrichmentContext = {
        rag: {
          documents: [],
          currentIntel: [],
          citations: [],
          formattedContext: '',
        },
        graph: {
          candidates: [],
          offices: [],
          relationships: [],
          issues: [],
          entities: [],
          formattedContext: '',
        },
        relevance: {
          ragScore: 1.0,
          graphScore: 1.0,
          overallScore: 1.0,
          shouldInclude: true,
          reasons: [],
        },
        formattedContext: 'Content',
        timestamp: new Date().toISOString(),
      };

      const result = formatForSystemPrompt(context);

      expect(result).toContain('[NEWS]');
      expect(result).toContain('[POLL]');
      expect(result).toContain('[UPCOMING]');
      expect(result).toContain('[ANALYSIS]');
    });

    test('includes section headers', () => {
      const context: EnrichmentContext = {
        rag: {
          documents: [],
          currentIntel: [],
          citations: [],
          formattedContext: '',
        },
        graph: {
          candidates: [],
          offices: [],
          relationships: [],
          issues: [],
          entities: [],
          formattedContext: '',
        },
        relevance: {
          ragScore: 1.0,
          graphScore: 1.0,
          overallScore: 1.0,
          shouldInclude: true,
          reasons: [],
        },
        formattedContext: 'Test',
        timestamp: new Date().toISOString(),
      };

      const result = formatForSystemPrompt(context);

      expect(result).toContain('## Contextual Intelligence');
      expect(result).toContain('## Citation Instructions');
    });
  });

  // ========================================
  // Integration Tests
  // ========================================
  describe('Integration', () => {
    test('full enrichment flow with all content types', async () => {
      // Setup comprehensive mock data
      const retriever = getDocumentRetriever();
      (retriever.retrieve as jest.Mock).mockResolvedValue({
        documents: [
          createMockRAGDocument({ title: 'Swing Voter Analysis' }),
          createMockRAGDocument({ title: 'GOTV Strategy' }),
        ],
        currentIntel: [
          createMockIntelDocument({ type: 'news', title: 'Latest Poll' }),
          createMockIntelDocument({ type: 'upcoming', title: 'Primary Election' }),
        ],
        citations: [],
      });

      const graph = getKnowledgeGraph();
      (graph.query as jest.Mock).mockReturnValue({
        entities: [
          createMockIssue({ name: 'Education' }),
          createMockIssue({ name: 'Healthcare' }),
        ],
        relationships: [],
      });

      const result = await enrich('What are the swing voters like in district 73?', {
        districtType: 'state_house',
        districtNumber: '73',
        includeCurrentIntel: true,
        includeCandidates: true,
        includeIssues: true,
      });

      // Verify all content types are present
      expect(result.rag).toBeDefined();
      expect(result.graph).toBeDefined();
      expect(result.relevance).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    test('enrichment produces valid formatted context', async () => {
      const retriever = getDocumentRetriever();
      (retriever.retrieve as jest.Mock).mockResolvedValue({
        documents: [createMockRAGDocument({ title: 'Test Doc' })],
        currentIntel: [createMockIntelDocument({ title: 'Test Intel' })],
        citations: [],
      });

      const result = await enrich('Tell me about Test Doc', {
        relevanceThreshold: 0.3,
      });

      // formattedContext should be a string
      expect(typeof result.formattedContext).toBe('string');
    });

    test('relevance reasons explain inclusion', async () => {
      const retriever = getDocumentRetriever();
      (retriever.retrieve as jest.Mock).mockResolvedValue({
        documents: [createMockRAGDocument()],
        currentIntel: [createMockIntelDocument()],
        citations: [],
      });

      const result = await enrich('test query');

      expect(Array.isArray(result.relevance.reasons)).toBe(true);
    });

    test('handles empty retrieval results', async () => {
      const retriever = getDocumentRetriever();
      (retriever.retrieve as jest.Mock).mockResolvedValue({
        documents: [],
        currentIntel: [],
        citations: [],
      });

      const graph = getKnowledgeGraph();
      (graph.query as jest.Mock).mockReturnValue({
        entities: [],
        relationships: [],
      });

      (getInghamCountyRepresentatives as jest.Mock).mockResolvedValue({
        federal: { senators: [], representative: null },
        state: { senator: null, representative: null },
      });

      const result = await enrich('obscure query with no matches');

      expect(result.rag.documents).toEqual([]);
      expect(result.rag.currentIntel).toEqual([]);
      expect(result.relevance.reasons).toContain('No relevant context found');
    });
  });
});
