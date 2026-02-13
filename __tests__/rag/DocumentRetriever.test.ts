/**
 * DocumentRetriever Tests
 *
 * Tests RAG document retrieval and relevance scoring.
 * Run with: npm test -- --testPathPattern=DocumentRetriever
 */

import DocumentRetriever, {
  getDocumentRetriever,
  type RAGDocument,
  type CurrentIntelDocument,
  type DocumentIndex,
  type CurrentIntelIndex,
  type RetrievalResult,
} from '@/lib/rag/DocumentRetriever';

import { promises as fs } from 'fs';
import * as path from 'path';

// Mock fs
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
  },
}));

const mockFs = fs as jest.Mocked<typeof fs>;

function createMockDocumentIndex(): DocumentIndex {
  return {
    _metadata: {
      description: 'Test index',
      version: '1.0',
      created: '2024-01-01',
    },
    documents: [
      {
        id: 'doc-1',
        title: 'Methodology Guide',
        path: 'docs/methodology.md',
        category: 'methodology',
        description: 'How scores are calculated',
        keywords: ['methodology', 'score', 'calculation', 'gotv', 'persuasion'],
        use_when: ['user asks about methodology', 'user wants to understand scores'],
      },
      {
        id: 'doc-2',
        title: 'Data Sources',
        path: 'docs/sources.md',
        category: 'sources',
        description: 'Where data comes from',
        keywords: ['source', 'data', 'census', 'election', 'fec'],
        use_when: ['user asks about data sources', 'user questions data accuracy'],
      },
      {
        id: 'doc-3',
        title: 'Election History',
        path: 'docs/elections.md',
        category: 'reference',
        description: 'Historical election results',
        keywords: ['election', 'history', 'results', '2020', '2022', '2024'],
        use_when: ['user asks about past elections', 'user wants historical data'],
      },
    ],
    data_files: [
      {
        id: 'df-1',
        citation_key: '[ELECTIONS]',
        description: 'Election results data',
        source: 'Michigan SOS',
        use_for: 'vote totals and turnout',
      },
      {
        id: 'df-2',
        citation_key: '[CENSUS]',
        description: 'Demographic data',
        source: 'US Census ACS',
        use_for: 'population and demographics',
      },
    ],
  };
}

function createMockIntelIndex(): CurrentIntelIndex {
  const now = new Date();
  const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
  const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

  return {
    _metadata: {
      description: 'Current intelligence',
      version: '1.0',
      last_updated: now.toISOString(),
      update_frequency: 'daily',
      notes: 'Test data',
    },
    sources: [
      {
        id: 'src-1',
        name: 'Michigan SOS',
        type: 'official',
        url: 'https://michigan.gov/sos',
        reliability: 'high',
        bias_rating: 'neutral',
        update_frequency: 'as-needed',
      },
    ],
    documents: [
      {
        id: 'intel-1',
        path: 'data/rag/current-intel/polls/latest-poll.md',
        type: 'poll',
        title: 'Latest State House Poll',
        source: 'Michigan SOS',
        published: past.toISOString(),
        expires: future.toISOString(),
        relevance: ['state house', 'polling'],
        jurisdictions: ['Ingham County', 'East Lansing'],
        keywords: ['poll', 'survey', 'state house', 'district 73'],
        priority: 1,
      },
      {
        id: 'intel-2',
        path: 'data/rag/current-intel/news/local-news.md',
        type: 'news',
        title: 'Local Campaign News',
        source: 'Lansing State Journal',
        published: past.toISOString(),
        expires: future.toISOString(),
        relevance: ['campaign', 'local'],
        jurisdictions: ['Lansing'],
        keywords: ['campaign', 'election', 'local'],
        priority: 2,
      },
      {
        id: 'intel-3',
        path: 'data/rag/current-intel/upcoming/2026-races.md',
        type: 'upcoming',
        title: '2026 Races Preview',
        source: 'Analysis',
        published: past.toISOString(),
        expires: future.toISOString(),
        relevance: ['2026', 'upcoming', 'preview'],
        jurisdictions: ['Ingham County'],
        keywords: ['2026', 'upcoming', 'races', 'preview'],
        priority: 1,
      },
    ],
    citation_keys: {
      '[POLL]': { description: 'Polling data', color_scheme: 'blue' },
      '[NEWS]': { description: 'News articles', color_scheme: 'gray' },
      '[UPCOMING]': { description: 'Upcoming elections', color_scheme: 'green' },
    },
  };
}

describe('DocumentRetriever', () => {
  let retriever: DocumentRetriever;

  beforeEach(() => {
    jest.clearAllMocks();
    retriever = new DocumentRetriever('/test/path');

    // Setup default mock responses
    mockFs.readFile.mockImplementation(async (filePath: any) => {
      const pathStr = typeof filePath === 'string' ? filePath : filePath.toString();

      if (pathStr.includes('document-index.json')) {
        return JSON.stringify(createMockDocumentIndex());
      }
      if (pathStr.includes('intel-index.json')) {
        return JSON.stringify(createMockIntelIndex());
      }
      if (pathStr.includes('methodology.md')) {
        return '# Methodology\n\nThis is the methodology document content.';
      }
      if (pathStr.includes('sources.md')) {
        return '# Data Sources\n\nInformation about data sources.';
      }
      if (pathStr.includes('elections.md')) {
        return '# Election History\n\nHistorical election data.';
      }
      if (pathStr.includes('latest-poll.md')) {
        return '---\ntitle: Poll\n---\n\nPoll results content.';
      }
      if (pathStr.includes('local-news.md')) {
        return '# Local News\n\nNews content.';
      }
      if (pathStr.includes('2026-races.md')) {
        return '# 2026 Races\n\nUpcoming races preview.';
      }

      throw new Error(`File not found: ${pathStr}`);
    });
  });

  // ========================================
  // Initialization Tests
  // ========================================
  describe('initialization', () => {
    test('initializes with base path', () => {
      const r = new DocumentRetriever('/custom/path');
      expect(r).toBeDefined();
    });

    test('initializes successfully', async () => {
      await retriever.initialize();
      // Should not throw
    });

    test('handles missing document index', async () => {
      mockFs.readFile.mockImplementation(async (filePath: any) => {
        const pathStr = typeof filePath === 'string' ? filePath : filePath.toString();
        if (pathStr.includes('document-index.json')) {
          throw new Error('File not found');
        }
        if (pathStr.includes('intel-index.json')) {
          return JSON.stringify(createMockIntelIndex());
        }
        return '# Content';
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await retriever.initialize();

      // Should create fallback empty index
      const results = await retriever.retrieve('test query');
      expect(results.documents).toEqual([]);

      consoleSpy.mockRestore();
    });

    test('handles missing intel index', async () => {
      mockFs.readFile.mockImplementation(async (filePath: any) => {
        const pathStr = typeof filePath === 'string' ? filePath : filePath.toString();
        if (pathStr.includes('intel-index.json')) {
          throw new Error('File not found');
        }
        if (pathStr.includes('document-index.json')) {
          return JSON.stringify(createMockDocumentIndex());
        }
        return '# Content';
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await retriever.initialize();

      // Should work without intel
      const results = await retriever.retrieve('methodology');
      expect(results.documents.length).toBeGreaterThan(0);

      consoleSpy.mockRestore();
    });
  });

  // ========================================
  // Find Relevant Documents Tests
  // ========================================
  describe('findRelevantDocuments', () => {
    beforeEach(async () => {
      await retriever.initialize();
    });

    test('finds documents by keyword match', () => {
      const docs = retriever.findRelevantDocuments('methodology score');

      expect(docs.length).toBeGreaterThan(0);
      expect(docs[0].id).toBe('doc-1');
    });

    test('finds documents by title match', () => {
      const docs = retriever.findRelevantDocuments('methodology guide');

      expect(docs.length).toBeGreaterThan(0);
      expect(docs[0].title).toBe('Methodology Guide');
    });

    test('finds documents by use_when match', () => {
      const docs = retriever.findRelevantDocuments('understand scores');

      expect(docs.length).toBeGreaterThan(0);
    });

    test('limits results to maxDocs', () => {
      const docs = retriever.findRelevantDocuments('election data source methodology', 1);

      expect(docs.length).toBe(1);
    });

    test('returns empty for no matches', () => {
      const docs = retriever.findRelevantDocuments('xyznonexistent123');

      expect(docs).toEqual([]);
    });

    test('ranks by relevance score', () => {
      const docs = retriever.findRelevantDocuments('election history results');

      // doc-3 should rank highest for this query
      expect(docs[0].id).toBe('doc-3');
    });

    test('handles empty query', () => {
      const docs = retriever.findRelevantDocuments('');

      expect(docs).toEqual([]);
    });
  });

  // ========================================
  // Find Relevant Citations Tests
  // ========================================
  describe('findRelevantCitations', () => {
    beforeEach(async () => {
      await retriever.initialize();
    });

    test('finds citations by description match', () => {
      const citations = retriever.findRelevantCitations('election results');

      expect(citations.length).toBeGreaterThan(0);
      expect(citations[0].citation_key).toBe('[ELECTIONS]');
    });

    test('finds citations by use_for match', () => {
      const citations = retriever.findRelevantCitations('population demographics');

      expect(citations.length).toBeGreaterThan(0);
      expect(citations.some(c => c.citation_key === '[CENSUS]')).toBe(true);
    });

    test('returns empty for no matches', () => {
      const citations = retriever.findRelevantCitations('xyznonexistent');

      expect(citations).toEqual([]);
    });
  });

  // ========================================
  // Find Relevant Current Intel Tests
  // ========================================
  describe('findRelevantCurrentIntel', () => {
    beforeEach(async () => {
      await retriever.initialize();
    });

    test('finds intel by keyword match', () => {
      const intel = retriever.findRelevantCurrentIntel('poll survey');

      expect(intel.length).toBeGreaterThan(0);
      expect(intel[0].type).toBe('poll');
    });

    test('finds intel by relevance tags', () => {
      const intel = retriever.findRelevantCurrentIntel('state house');

      expect(intel.length).toBeGreaterThan(0);
    });

    test('filters by jurisdiction', () => {
      const intel = retriever.findRelevantCurrentIntel('election', 'East Lansing');

      // Should boost East Lansing intel
      expect(intel.length).toBeGreaterThan(0);
    });

    test('limits results to maxDocs', () => {
      const intel = retriever.findRelevantCurrentIntel('election poll news', undefined, 1);

      expect(intel.length).toBe(1);
    });

    test('boosts upcoming intel for future queries', () => {
      const intel = retriever.findRelevantCurrentIntel('2026 upcoming races');

      expect(intel.length).toBeGreaterThan(0);
      expect(intel[0].type).toBe('upcoming');
    });

    test('excludes expired documents', async () => {
      // Create intel with expired document
      const expiredIndex = createMockIntelIndex();
      const pastDate = new Date(Date.now() - 1000).toISOString();
      expiredIndex.documents[0].expires = pastDate;

      mockFs.readFile.mockImplementation(async (filePath: any) => {
        const pathStr = typeof filePath === 'string' ? filePath : filePath.toString();
        if (pathStr.includes('intel-index.json')) {
          return JSON.stringify(expiredIndex);
        }
        if (pathStr.includes('document-index.json')) {
          return JSON.stringify(createMockDocumentIndex());
        }
        return '# Content';
      });

      const newRetriever = new DocumentRetriever('/test');
      await newRetriever.initialize();

      const intel = newRetriever.findRelevantCurrentIntel('poll survey');

      // Should not include expired poll
      expect(intel.every(i => i.id !== 'intel-1')).toBe(true);
    });
  });

  // ========================================
  // Load Document Content Tests
  // ========================================
  describe('loadDocumentContent', () => {
    beforeEach(async () => {
      await retriever.initialize();
    });

    test('loads document content', async () => {
      const doc: RAGDocument = {
        id: 'doc-1',
        title: 'Test',
        path: 'docs/methodology.md',
        category: 'methodology',
        description: 'Test',
        keywords: [],
        use_when: [],
      };

      const content = await retriever.loadDocumentContent(doc);

      expect(content).toContain('Methodology');
    });

    test('caches loaded content', async () => {
      const doc: RAGDocument = {
        id: 'doc-1',
        title: 'Test',
        path: 'docs/methodology.md',
        category: 'methodology',
        description: 'Test',
        keywords: [],
        use_when: [],
      };

      await retriever.loadDocumentContent(doc);
      const callsBefore = mockFs.readFile.mock.calls.length;

      await retriever.loadDocumentContent(doc);
      const callsAfter = mockFs.readFile.mock.calls.length;

      // Should use cache, not read again
      expect(callsAfter).toBe(callsBefore);
    });

    test('handles load error gracefully', async () => {
      const doc: RAGDocument = {
        id: 'missing',
        title: 'Missing',
        path: 'docs/nonexistent.md',
        category: 'reference',
        description: 'Missing doc',
        keywords: [],
        use_when: [],
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const content = await retriever.loadDocumentContent(doc);

      expect(content).toContain('could not be loaded');
      consoleSpy.mockRestore();
    });
  });

  // ========================================
  // Load Current Intel Content Tests
  // ========================================
  describe('loadCurrentIntelContent', () => {
    beforeEach(async () => {
      await retriever.initialize();
    });

    test('loads intel content', async () => {
      const intel: CurrentIntelDocument = {
        id: 'intel-1',
        path: 'data/rag/current-intel/polls/latest-poll.md',
        type: 'poll',
        title: 'Test Poll',
        source: 'Test',
        published: new Date().toISOString(),
        expires: new Date(Date.now() + 86400000).toISOString(),
        relevance: [],
        jurisdictions: [],
        keywords: [],
        priority: 1,
      };

      const content = await retriever.loadCurrentIntelContent(intel);

      expect(content).toContain('Poll results');
    });

    test('strips YAML frontmatter', async () => {
      const intel: CurrentIntelDocument = {
        id: 'intel-1',
        path: 'data/rag/current-intel/polls/latest-poll.md',
        type: 'poll',
        title: 'Test Poll',
        source: 'Test',
        published: new Date().toISOString(),
        expires: new Date(Date.now() + 86400000).toISOString(),
        relevance: [],
        jurisdictions: [],
        keywords: [],
        priority: 1,
      };

      const content = await retriever.loadCurrentIntelContent(intel);

      expect(content).not.toContain('---');
    });

    test('caches loaded intel', async () => {
      const intel: CurrentIntelDocument = {
        id: 'intel-cached',
        path: 'data/rag/current-intel/polls/latest-poll.md',
        type: 'poll',
        title: 'Test',
        source: 'Test',
        published: new Date().toISOString(),
        expires: new Date(Date.now() + 86400000).toISOString(),
        relevance: [],
        jurisdictions: [],
        keywords: [],
        priority: 1,
      };

      await retriever.loadCurrentIntelContent(intel);
      const callsBefore = mockFs.readFile.mock.calls.length;

      await retriever.loadCurrentIntelContent(intel);
      const callsAfter = mockFs.readFile.mock.calls.length;

      expect(callsAfter).toBe(callsBefore);
    });
  });

  // ========================================
  // Retrieve Tests
  // ========================================
  describe('retrieve', () => {
    test('retrieves documents and context', async () => {
      const result = await retriever.retrieve('methodology score calculation');

      expect(result.documents.length).toBeGreaterThan(0);
      expect(result.context).toBeDefined();
    });

    test('includes citations in result', async () => {
      const result = await retriever.retrieve('election results turnout');

      expect(result.citations.length).toBeGreaterThan(0);
    });

    test('includes current intel in result', async () => {
      const result = await retriever.retrieve('poll survey');

      expect(result.currentIntel.length).toBeGreaterThan(0);
    });

    test('respects maxDocs option', async () => {
      const result = await retriever.retrieve('election data methodology', {
        maxDocs: 1,
      });

      expect(result.documents.length).toBeLessThanOrEqual(1);
    });

    test('respects maxIntel option', async () => {
      const result = await retriever.retrieve('poll news upcoming', {
        maxIntel: 1,
      });

      expect(result.currentIntel.length).toBeLessThanOrEqual(1);
    });

    test('filters by jurisdiction', async () => {
      const result = await retriever.retrieve('election', {
        jurisdiction: 'East Lansing',
      });

      expect(result).toBeDefined();
    });

    test('formats context with document content', async () => {
      const result = await retriever.retrieve('methodology');

      expect(result.context).toContain('Methodology');
    });

    test('includes current intel section in context', async () => {
      const result = await retriever.retrieve('poll survey');

      expect(result.context).toContain('Current Intelligence');
    });

    test('includes data sources section in context', async () => {
      const result = await retriever.retrieve('election turnout');

      expect(result.context).toContain('Available Data Sources');
    });
  });

  // ========================================
  // Citation Keys Tests
  // ========================================
  describe('getCitationKeys and getAllCitationKeys', () => {
    beforeEach(async () => {
      await retriever.initialize();
    });

    test('getCitationKeys returns data file keys', () => {
      const keys = retriever.getCitationKeys();

      expect(keys).toContain('[ELECTIONS]');
      expect(keys).toContain('[CENSUS]');
    });

    test('getAllCitationKeys includes intel keys', () => {
      const keys = retriever.getAllCitationKeys();

      expect(keys).toContain('[ELECTIONS]');
      expect(keys).toContain('[POLL]');
      expect(keys).toContain('[NEWS]');
    });
  });

  // ========================================
  // Format For System Prompt Tests
  // ========================================
  describe('formatForSystemPrompt', () => {
    beforeEach(async () => {
      await retriever.initialize();
    });

    test('formats retrieval result for system prompt', async () => {
      const result = await retriever.retrieve('methodology');
      const formatted = retriever.formatForSystemPrompt(result);

      expect(formatted).toContain('Reference Documentation');
      expect(formatted).toContain('Citation Instructions');
    });

    test('includes data source citations', async () => {
      const result = await retriever.retrieve('election');
      const formatted = retriever.formatForSystemPrompt(result);

      expect(formatted).toContain('Data Sources');
    });

    test('includes intel citations', async () => {
      const result = await retriever.retrieve('poll');
      const formatted = retriever.formatForSystemPrompt(result);

      expect(formatted).toContain('Current Intelligence');
    });

    test('returns empty for no context', () => {
      const result: RetrievalResult = {
        documents: [],
        citations: [],
        currentIntel: [],
        context: '',
      };

      const formatted = retriever.formatForSystemPrompt(result);

      expect(formatted).toBe('');
    });
  });

  // ========================================
  // Singleton Tests
  // ========================================
  describe('getDocumentRetriever singleton', () => {
    test('returns same instance', () => {
      const instance1 = getDocumentRetriever();
      const instance2 = getDocumentRetriever();

      expect(instance1).toBe(instance2);
    });

    test('returns DocumentRetriever instance', () => {
      const instance = getDocumentRetriever();

      expect(instance).toBeInstanceOf(DocumentRetriever);
    });
  });

  // ========================================
  // Edge Cases
  // ========================================
  describe('edge cases', () => {
    test('handles query before initialization', async () => {
      const newRetriever = new DocumentRetriever('/test');

      // Should auto-initialize
      const result = await newRetriever.retrieve('test query');

      expect(result).toBeDefined();
    });

    test('handles very long queries', async () => {
      await retriever.initialize();

      const longQuery = 'methodology '.repeat(100);
      const docs = retriever.findRelevantDocuments(longQuery);

      expect(docs).toBeDefined();
    });

    test('handles special characters in query', async () => {
      await retriever.initialize();

      const docs = retriever.findRelevantDocuments("methodology's & (score)");

      expect(docs).toBeDefined();
    });
  });
});
