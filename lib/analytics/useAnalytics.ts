import { useState } from 'react';
import { AnalysisResult } from './types';

export const useAnalytics = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeQuery = async (query: string, schema: any): Promise<AnalysisResult> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, schema }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Analysis API request failed: ${errorText}`);
      }

      const result = await response.json();
      return result;
    } catch (e: any) {
      setError(e.message);
      // Return a consistent error shape
      return {
        queryType: 'unknown',
        error: e.message,
        explanation: 'An unexpected error occurred while analyzing the query.',
        suggestions: [],
        entities: [],
        intent: 'unknown',
        confidence: 0,
        layers: [],
        timeframe: '',
        searchType: 'web',
        relevantLayers: [],
      };
    } finally {
      setLoading(false);
    }
  };

  return { analyzeQuery, loading, error };
}; 