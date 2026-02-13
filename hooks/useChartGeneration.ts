/**
 * React Hook for Chart Generation
 *
 * Provides easy-to-use chart generation functionality for CMA reports.
 * Handles Chart.js initialization, data preparation, and image generation.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { ChartGenerator } from '@/lib/charts/ChartGenerator';
import { prepareChartData } from '@/lib/charts/prepareChartData';
import { DemographicDataService, DemographicData } from '@/lib/services/DemographicDataService';
import type { CMAProperty, CMAStats } from '@/components/cma/types';

export interface UseChartGenerationReturn {
  chartImages: Record<string, string> | null;
  isGenerating: boolean;
  error: Error | null;
  generateCharts: (properties: CMAProperty[], stats: CMAStats) => Promise<void>;
}

/**
 * Hook for generating CMA report charts
 */
export function useChartGeneration(): UseChartGenerationReturn {
  const [chartImages, setChartImages] = useState<Record<string, string> | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const generatorRef = useRef<ChartGenerator | null>(null);

  // Initialize generator once
  if (!generatorRef.current && typeof window !== 'undefined') {
    generatorRef.current = new ChartGenerator();
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (generatorRef.current) {
        generatorRef.current.destroy();
      }
    };
  }, []);

  const generateCharts = useCallback(async (
    properties: CMAProperty[],
    stats: CMAStats
  ) => {
    if (typeof window === 'undefined') {
      setError(new Error('Chart generation must run in browser'));
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      console.log('[useChartGeneration] Starting chart generation...');

      if (!generatorRef.current) {
        throw new Error('Chart generator not initialized');
      }

      // Load demographic data for area-level charts (Page 4)
      // This is optional and should never block chart generation
      let demographicData: DemographicData | null = null;
      try {
        console.log('[useChartGeneration] Loading demographic data...');
        const demographicService = DemographicDataService.getInstance();
        demographicData = await demographicService.loadDemographicData();
        
        if (demographicData) {
          console.log('[useChartGeneration] Demographic data loaded:', {
            population: demographicData.ECYPTAPOP,
            medianIncome: demographicData.ECYHNIMED
          });
        } else {
          console.warn('[useChartGeneration] No demographic data available - demographic charts will be empty');
        }
      } catch (demoError) {
        console.warn('[useChartGeneration] Failed to load demographic data (non-blocking):', demoError);
        // Continue without demographic data
      }

      // Prepare chart data from CMA properties, stats, and demographic data
      const chartData = prepareChartData(properties, stats, demographicData || undefined);

      // Generate all charts
      const images = await generatorRef.current.generateAllCharts(chartData);

      console.log('[useChartGeneration] Chart generation complete:', Object.keys(images));

      setChartImages(images);
    } catch (err) {
      console.error('[useChartGeneration] Chart generation failed:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return {
    chartImages,
    isGenerating,
    error,
    generateCharts,
  };
}
