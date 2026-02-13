import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

interface UseVisualizationFactoryResult {
  factory: any | null;
  error: Error | null;
}

export function useVisualizationFactory(): UseVisualizationFactoryResult {
  const [factory, setFactory] = useState<any | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function initFactory() {
      try {
        const { EnhancedVisualizationFactory } = await import('../utils/enhanced-visualization-factory');
        const instance = new EnhancedVisualizationFactory();
        setFactory(instance);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to create visualization factory'));
      }
    }
    
    if (typeof window !== 'undefined') {
      initFactory();
    }
  }, []);

  return { factory, error };
} 