// services/claude-service.ts
import {
  AIAnalysisRequest,
  AIAnalysisResult,
  AIAnalysisError,
  AIServiceConfig,
  Visualization,
  SQLConversionResult
} from '../types/geospatial-ai-types';
import type { LayerConfig } from '@/types/layers';
import { upload } from '@vercel/blob/client';

export interface ClaudeServiceOptions {
  maxRetries?: number;
  timeout?: number;
  model?: string;
}

export interface ClaudeService {
  analyze(request: AIAnalysisRequest): Promise<AIAnalysisResult>;
  convertToSQL(question: string, context?: any): Promise<SQLConversionResult>;
  enhanceQuery(query: string, context: any): Promise<AIAnalysisResult>;
}

/**
 * ClaudeAIAnalysisService is used as an enhancement/fallback for query classification in the new flow.
 * The analyze method can be used for query classification enhancement, and accepts a context parameter for future contextual chat.
 */
export class ClaudeAIAnalysisService implements ClaudeService {
  private apiKey: string;
  private baseUrl: string;
  private maxRetries: number;
  private timeout: number;
  private model: string;
  private learningState: Map<string, any>;

  constructor(
    apiKey: string = process.env.NEXT_PUBLIC_CLAUDE_API_KEY || '',
    options: ClaudeServiceOptions = {}
  ) {
    console.log('=== ClaudeAIAnalysisService constructor START ===');
    try {
      if (!apiKey) {
        console.warn('No API key provided to ClaudeAIAnalysisService');
      }
      this.apiKey = apiKey;
      this.baseUrl = 'https://api.anthropic.com/v1/messages';
      this.maxRetries = options.maxRetries || 3;
      this.timeout = options.timeout || 30000;
      this.model = options.model || 'claude-3-5-sonnet-20241022';
      this.learningState = new Map();
      console.log('ClaudeAIAnalysisService initialized successfully');
    } catch (error) {
      console.error('Error initializing ClaudeAIAnalysisService:', error);
      throw error;
    }
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private getFieldsFromLayers(layers: Record<string, LayerConfig>): string {
    return Object.values(layers)
      .flatMap(layer => layer.fields)
      .map(field => `- ${field.name}: ${field.type} (${field.label})`)
      .join('\n');
  }

  private getSQLSystemPrompt(layers: Record<string, LayerConfig>): string {
    return `You are a SQL query generator for ArcGIS Feature Services. 
Convert natural language questions into SQL WHERE clauses.

Available fields:
${this.getFieldsFromLayers(layers)}

Rules:
1. Return ONLY the WHERE clause
2. Use valid ArcGIS SQL syntax
3. Properly handle string comparisons with single quotes
4. Do not include SELECT, FROM, ORDER BY, GROUP BY, or LIMIT
5. Use explicit AND/OR operators
6. Ensure proper escaping of strings`;
  }

  /**
   * Analyze a query for enhanced classification (fallback/enhancement).
   * @param request - AIAnalysisRequest (prompt, context, etc.)
   * @returns AIAnalysisResult
   */
  async analyze(request: AIAnalysisRequest): Promise<AIAnalysisResult> {
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < this.maxRetries) {
      try {
        // Upload request data to blob storage
        const { url: requestUrl } = await upload('analysis-request.json', JSON.stringify({
          request,
          timestamp: new Date().toISOString()
        }), {
          access: 'public',
          handleUploadUrl: '/api/blob/upload'
        });

        // Upload learning state for context
        const { url: learningStateUrl } = await upload('learning-state.json', JSON.stringify({
          state: Array.from(this.learningState.entries()),
          timestamp: new Date().toISOString()
        }), {
          access: 'public',
          handleUploadUrl: '/api/blob/upload'
        });

        const response = await this.fetchWithTimeout(
          this.baseUrl,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': this.apiKey,
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: this.model,
              messages: [{
                role: 'user',
                content: JSON.stringify({
                  requestUrl,
                  learningStateUrl,
                  ...request
                })
              }]
            })
          },
          this.timeout
        );

        if (!response.ok) {
          throw new AIAnalysisError(
            `API request failed: ${response.statusText}`,
            'API_ERROR',
            response.status
          );
        }

        const result = await response.json();
        
        // Update learning state with successful analysis
        this.updateLearningState(request, result);
        
        return result;
      } catch (error) {
        lastError = error as Error;
        attempt++;
        
        if (attempt === this.maxRetries) {
          throw new AIAnalysisError(
            `Failed after ${this.maxRetries} attempts: ${lastError.message}`,
            'MAX_RETRIES_EXCEEDED'
          );
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    throw lastError;
  }

  async convertToSQL(question: string, context?: any): Promise<SQLConversionResult> {
    try {
      // Upload context to blob storage
      const { url: contextUrl } = await upload('sql-context.json', JSON.stringify({
        context,
        timestamp: new Date().toISOString()
      }), {
        access: 'public',
        handleUploadUrl: '/api/blob/upload'
      });

      const response = await this.fetchWithTimeout(
        this.baseUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: this.model,
            messages: [{
              role: 'user',
              content: JSON.stringify({
                question,
                contextUrl
              })
            }]
          })
        },
        this.timeout
      );

      if (!response.ok) {
        throw new AIAnalysisError(
          `SQL conversion failed: ${response.statusText}`,
          'SQL_CONVERSION_ERROR',
          response.status
        );
      }

      return await response.json();
    } catch (error) {
      throw new AIAnalysisError(
        `SQL conversion error: ${(error as Error).message}`,
        'SQL_CONVERSION_ERROR'
      );
    }
  }

  async enhanceQuery(query: string, context: any): Promise<AIAnalysisResult> {
    try {
      // Upload query context to blob storage
      const { url: contextUrl } = await upload('query-context.json', JSON.stringify({
        query,
        context,
        timestamp: new Date().toISOString()
      }), {
        access: 'public',
        handleUploadUrl: '/api/blob/upload'
      });

      const response = await this.fetchWithTimeout(
        this.baseUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: this.model,
            messages: [{
              role: 'user',
              content: JSON.stringify({
                query,
                contextUrl
              })
            }]
          })
        },
        this.timeout
      );

      if (!response.ok) {
        throw new AIAnalysisError(
          `Query enhancement failed: ${response.statusText}`,
          'QUERY_ENHANCEMENT_ERROR',
          response.status
        );
      }

      const result = await response.json();
      
      // Update learning state with enhanced query
      this.updateLearningState({ type: 'query_enhancement', query }, result);
      
      return result;
    } catch (error) {
      throw new AIAnalysisError(
        `Query enhancement error: ${(error as Error).message}`,
        'QUERY_ENHANCEMENT_ERROR'
      );
    }
  }

  private updateLearningState(input: any, result: any): void {
    const key = this.getLearningStateKey(input);
    const currentValue = this.learningState.get(key) || { count: 0, patterns: [] };
    
    this.learningState.set(key, {
      count: currentValue.count + 1,
      patterns: [...currentValue.patterns, { input, result, timestamp: new Date().toISOString() }],
      lastUpdated: new Date().toISOString()
    });
  }

  private getLearningStateKey(input: any): string {
    if ('type' in input) {
      return `${input.type}-${input.query || 'unknown'}`;
    }
    return `analysis-${JSON.stringify(input).slice(0, 50)}`;
  }
}

export const createClaudeService = (
  apiKey?: string,
  options?: ClaudeServiceOptions
): ClaudeService => {
  return new ClaudeAIAnalysisService(apiKey, options);
};

// DOCUMENTATION:
// - ClaudeAIAnalysisService is used as an enhancement/fallback for query classification in the new flow.
// - The analyze method can be used for query classification enhancement, and accepts a context parameter for future contextual chat.