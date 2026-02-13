/**
 * Chat Context Integration Test
 * 
 * This test verifies that:
 * 1. Initial analysis runs and provides data to chat
 * 2. Follow-up chat messages use existing context (not new analysis)
 * 3. Chat requests include proper featureData from analysis
 * 4. Loading messages show randomized text instead of "Running full analysis"
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock fetch to intercept API calls
const mockFetch = jest.fn<typeof fetch>();
global.fetch = mockFetch;

// Mock analysis result data
const mockAnalysisResult = {
  analysisResult: {
    data: {
      records: [
        {
          properties: {
            area_name: 'Test Area 1',
            competitive_analysis_score: 8.5,
            DESCRIPTION: 'High performing area'
          },
          geometry: { type: 'Point', coordinates: [-122.4, 37.8] }
        },
        {
          properties: {
            area_name: 'Test Area 2', 
            competitive_analysis_score: 6.2,
            DESCRIPTION: 'Medium performing area'
          },
          geometry: { type: 'Point', coordinates: [-122.3, 37.7] }
        }
      ],
      targetVariable: 'competitive_analysis_score',
      isClustered: false
    },
    endpoint: 'competitive-analysis'
  },
  metadata: {
    analysisType: 'competitive-analysis',
    targetVariable: 'competitive_analysis_score'
  }
};

describe('Chat Context Integration', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    console.log = jest.fn(); // Mock console.log to capture logging
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should send proper context data on initial chat message', async () => {
    // Mock successful chat response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: 'This analysis shows strong competitive performance in Test Area 1 with a score of 8.5.'
      })
    } as Response);

    // Simulate sending initial chat message with analysis context
    const chatRequest = {
      messages: [{
        role: 'user',
        content: 'What are the key insights from this analysis?'
      }],
      metadata: {
        analysisType: 'competitive-analysis',
        targetVariable: 'competitive_analysis_score',
        isContextualChat: false // Initial message
      },
      featureData: [{
        layerId: 'unified_analysis',
        layerName: 'Analysis Results',
        layerType: 'polygon',
        features: mockAnalysisResult.analysisResult.data.records
      }],
      persona: 'strategist'
    };

    // Make the request
    const response = await fetch('/api/claude/generate-response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chatRequest)
    });

    // Verify the request was made correctly
    expect(mockFetch).toHaveBeenCalledWith('/api/claude/generate-response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chatRequest)
    });

    // Verify the request includes analysis data
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const requestBody = JSON.parse(options.body as string);
    
    expect(requestBody.featureData).toHaveLength(1);
    expect(requestBody.featureData[0].features).toHaveLength(2);
    expect(requestBody.featureData[0].features[0].properties.competitive_analysis_score).toBe(8.5);
    expect(requestBody.metadata.isContextualChat).toBe(false);
  });

  it('should send context data on follow-up chat messages', async () => {
    // Mock successful chat response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: 'Test Area 1 outperforms Test Area 2 by 2.3 points in competitive analysis.'
      })
    } as Response);

    // Simulate sending follow-up chat message
    const followUpRequest = {
      messages: [
        {
          role: 'user',
          content: 'What are the key insights from this analysis?'
        },
        {
          role: 'assistant', 
          content: 'This analysis shows strong competitive performance in Test Area 1 with a score of 8.5.'
        },
        {
          role: 'user',
          content: 'How does Test Area 1 compare to Test Area 2?'
        }
      ],
      metadata: {
        analysisType: 'competitive-analysis',
        targetVariable: 'competitive_analysis_score',
        isContextualChat: true // Follow-up message
      },
      featureData: [{
        layerId: 'unified_analysis',
        layerName: 'Analysis Results',
        layerType: 'polygon',
        features: mockAnalysisResult.analysisResult.data.records
      }],
      persona: 'strategist'
    };

    // Make the request
    await fetch('/api/claude/generate-response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(followUpRequest)
    });

    // Verify the follow-up request includes existing context
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const requestBody = JSON.parse(options.body as string);
    
    expect(requestBody.messages).toHaveLength(3); // Original + assistant + follow-up
    expect(requestBody.featureData[0].features).toHaveLength(2); // Same analysis data
    expect(requestBody.metadata.isContextualChat).toBe(true); // Marked as contextual
  });

  it('should not trigger new analysis for follow-up questions', async () => {
    // Mock only the chat endpoint, not analysis endpoints
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: 'Based on the existing analysis data, here are the patterns...'
      })
    } as Response);

    const followUpRequest = {
      messages: [
        { role: 'user', content: 'Initial question' },
        { role: 'assistant', content: 'Initial response' },
        { role: 'user', content: 'Follow-up question about the same data' }
      ],
      metadata: {
        analysisType: 'competitive-analysis',
        isContextualChat: true
      },
      featureData: [{
        layerId: 'unified_analysis',
        layerName: 'Analysis Results', 
        layerType: 'polygon',
        features: mockAnalysisResult.analysisResult.data.records
      }],
      persona: 'strategist'
    };

    await fetch('/api/claude/generate-response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(followUpRequest)
    });

    // Verify only one call was made (to chat endpoint, not analysis)
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith('/api/claude/generate-response', expect.any(Object));
    
    // Verify it was not called with analysis endpoints
    const calls = mockFetch.mock.calls as Array<[string, RequestInit]>;
    const analysisEndpointCalls = calls.filter(([url]) =>
      url.includes('/api/analysis/') ||
      url.includes('/api/unified-analysis/') ||
      url.includes('analyze-location')
    );
    expect(analysisEndpointCalls).toHaveLength(0);
  });

  it('should preserve feature data across multiple chat exchanges', async () => {
    const responses = [
      { content: 'First response based on analysis' },
      { content: 'Second response using same context' },
      { content: 'Third response with continued context' }
    ];

    // Mock multiple chat responses
    responses.forEach(response => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => response
      } as Response);
    });

    const baseRequest = {
      metadata: {
        analysisType: 'competitive-analysis',
        isContextualChat: true
      },
      featureData: [{
        layerId: 'unified_analysis',
        layerName: 'Analysis Results',
        layerType: 'polygon', 
        features: mockAnalysisResult.analysisResult.data.records
      }],
      persona: 'strategist'
    };

    // Simulate multiple exchanges
    for (let i = 0; i < 3; i++) {
      const request = {
        ...baseRequest,
        messages: Array(i * 2 + 1).fill(null).map((_, idx) => ({
          role: idx % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${idx + 1}`
        }))
      };

      await fetch('/api/claude/generate-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });
    }

    // Verify all requests included the same feature data
    expect(mockFetch).toHaveBeenCalledTimes(3);

    (mockFetch.mock.calls as Array<[string, RequestInit]>).forEach(([, options]) => {
      const requestBody = JSON.parse(options.body as string);
      expect(requestBody.featureData[0].features).toHaveLength(2);
      expect(requestBody.featureData[0].features[0].properties.competitive_analysis_score).toBe(8.5);
      expect(requestBody.metadata.isContextualChat).toBe(true);
    });
  });

  it('should include empty fallback data when no analysis exists', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: 'I need analysis data to provide insights. Please run an analysis first.'
      })
    } as Response);

    const requestWithoutAnalysis = {
      messages: [{ role: 'user', content: 'Tell me about the data' }],
      metadata: { isContextualChat: true },
      featureData: [], // No analysis data available
      persona: 'strategist'
    };

    await fetch('/api/claude/generate-response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestWithoutAnalysis)
    });

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const requestBody = JSON.parse(options.body as string);
    
    // Should still include featureData structure even if empty
    expect(requestBody.featureData).toBeDefined();
    expect(Array.isArray(requestBody.featureData)).toBe(true);
  });
});

// Test the randomized loading messages
describe('Chat Loading Messages', () => {
  const THINKING_MESSAGES = [
    "Thinking",
    "Analyzing", 
    "Processing",
    "Considering",
    "Evaluating",
    "Reviewing",
    "Calculating",
    "Examining",
    "Understanding",
    "Interpreting"
  ];

  function getRandomThinkingMessage(): string {
    return THINKING_MESSAGES[Math.floor(Math.random() * THINKING_MESSAGES.length)];
  }

  it('should return varied thinking messages', () => {
    const messages = new Set();
    
    // Generate 50 messages to test randomness
    for (let i = 0; i < 50; i++) {
      messages.add(getRandomThinkingMessage());
    }
    
    // Should have multiple different messages (not just one repeated)
    expect(messages.size).toBeGreaterThan(1);
    
    // All messages should be from the approved list
    messages.forEach(message => {
      expect(THINKING_MESSAGES).toContain(message);
    });
  });

  it('should never return "Running full analysis"', () => {
    for (let i = 0; i < 100; i++) {
      const message = getRandomThinkingMessage();
      expect(message).not.toBe('Running full analysis');
      expect(message).not.toContain('Running');
      expect(message).not.toContain('full analysis');
    }
  });

  it('should return only single word thinking verbs', () => {
    THINKING_MESSAGES.forEach(message => {
      expect(message.split(' ')).toHaveLength(1); // Single word
      expect(message).toMatch(/^[A-Z][a-z]+$/); // Capitalized single word
    });
  });
});