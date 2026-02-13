import React, { useState, useEffect } from 'react';
import { getQueryService } from '../utils/services/query-service';
import { QueryEnhancementDisplay } from './QueryEnhancementDisplay';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { layers } from '@/config/layers';
import { ErrorBoundary } from './ErrorBoundary';
import { upload } from '@vercel/blob/client';

interface QueryInterfaceProps {
  onResultsFound: (results: any) => void;
}

const QueryInterfaceInner: React.FC<QueryInterfaceProps> = ({
  onResultsFound
}) => {
  console.log('QueryInterfaceInner initialized', {
    timestamp: new Date().toISOString(),
    componentId: 'QueryInterfaceInner'
  });
  
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optimization, setOptimization] = useState<any>(null);
  const [layerSelection, setLayerSelection] = useState<any>(null);
  const [resultEnhancements, setResultEnhancements] = useState<any>(null);

  useEffect(() => {
    console.log('QueryInterface environment check', {
      timestamp: new Date().toISOString(),
      environmentCheck: {
        hasAnthropicKey: !!process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY,
        nodeEnv: process.env.NODE_ENV,
        blobStoreUrl: process.env.NEXT_PUBLIC_BLOB_STORE_URL
      }
    });
  }, []);

  // Add global error handler
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Global error caught:', {
        error: event.error,
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        timestamp: new Date().toISOString()
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', {
        reason: event.reason,
        promise: event.promise,
        timestamp: new Date().toISOString()
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('=== handleSubmit START ===', {
      timestamp: new Date().toISOString(),
      query,
      loading
    });
    
    setLoading(true);
    setError(null);
    setOptimization(null);
    setLayerSelection(null);
    setResultEnhancements(null);

    try {
      // Step 1: Execute query
      console.warn('Step 1: Starting query execution', {
        timestamp: new Date().toISOString(),
        query
      });
      const queryService = getQueryService();
      console.warn('QueryService instance obtained', {
        timestamp: new Date().toISOString(),
        serviceInstance: !!queryService
      });
      
      const queryConfig = {
        layerConfig: layers['default'],
        sqlQuery: query
      };

      console.warn('Executing query with config:', {
        timestamp: new Date().toISOString(),
        layerConfig: layers['default']?.name,
        sqlQuery: query
      });

      const queryResult = await queryService.executeQuery(queryConfig);
      console.warn('Query execution complete', {
        timestamp: new Date().toISOString(),
        hasFeatures: !!queryResult.featureSet?.features?.length,
        featureCount: queryResult.featureSet?.features?.length
      });
      
      if (!queryResult.featureSet?.features?.length) {
        throw new Error('No features found for the query');
      }

      // Step 2: Prepare feature data for upload
      console.warn('Step 2: Preparing feature data for upload', {
        timestamp: new Date().toISOString(),
        hasFeatures: !!queryResult.featureSet?.features,
        featureCount: queryResult.featureSet?.features?.length,
        sampleFeature: queryResult.featureSet?.features?.[0] ? {
          hasGeometry: !!queryResult.featureSet.features[0].geometry,
          geometryType: queryResult.featureSet.features[0].geometry?.type,
          attributeCount: Object.keys(queryResult.featureSet.features[0].attributes || {}).length,
          sampleAttributes: Object.keys(queryResult.featureSet.features[0].attributes || {}).slice(0, 3)
        } : null
      });

      // Import optimization utility
      const { optimizeAnalysisFeatures } = await import('../utils/feature-optimization');
      
      // Optimize feature data for analysis
      const optimizedFeatureData = await optimizeAnalysisFeatures(
        queryResult.featureSet.features.map(feature => ({
          geometry: feature.geometry,
          attributes: feature.attributes
        })),
        layers['default'],
        {
          query,
          analysisType: 'general-query',
          additionalContext: {
            layerName: layers['default']?.name,
            layerType: layers['default']?.type || 'feature',
            performanceOptimized: true,
            skipSizeCheck: queryResult.featureSet.features.length < 1000
          }
        }
      );

      // Log the optimized feature data
      console.warn('Processing optimized feature set:', {
        timestamp: new Date().toISOString(),
        originalFeatureCount: queryResult.featureSet.features.length,
        optimizedFeatureCount: optimizedFeatureData.totalFeatures,
        dataSize: JSON.stringify(optimizedFeatureData).length,
        query,
        layerConfigName: layers['default']?.name
      });

      // Step 3: Upload to blob storage
      console.warn('Step 3: Starting blob upload', {
        timestamp: new Date().toISOString(),
        fileName: `query-${Date.now()}.json`,
        dataSize: JSON.stringify(optimizedFeatureData).length,
        featureCount: optimizedFeatureData.totalFeatures,
        query,
        layerConfigName: layers['default']?.name
      });

      // Create a File object from the blob
      const blob = new Blob([JSON.stringify(optimizedFeatureData)], { 
        type: 'application/json' 
      });

      const file = new File([blob], `query-${Date.now()}.json`, { 
        type: 'application/json'
      });

      try {
        // Upload using client method with proper configuration
        const { url: blobUrl, pathname } = await upload(file.name, file, {
          access: 'public',
          handleUploadUrl: '/api/blob/upload',
          clientPayload: JSON.stringify({
            timestamp: new Date().toISOString(),
            fileSize: file.size,
            fileName: file.name,
            query: query,
            featureCount: optimizedFeatureData.totalFeatures
          })
        });

        console.warn('Step 4: Blob upload successful', {
          url: blobUrl,
          pathname,
          urlLength: blobUrl.length,
          pathnameLength: pathname.length,
          timestamp: new Date().toISOString()
        });

        // Step 5: Call Claude API with FormData
        console.warn('Step 5: Preparing analysis request', {
          timestamp: new Date().toISOString(),
          blobPathLength: pathname.length,
          queryLength: query.length,
          blobPath: pathname
        });

        const formData = new FormData();
        formData.append('blobPath', pathname);
        formData.append('query', query);

        console.warn('Sending analysis request to Claude API');
        const claudeResponse = await fetch('/api/claude/generate-response', {
          method: 'POST',
          body: formData,
        });

        console.warn('Claude API response received', {
          timestamp: new Date().toISOString(),
          status: claudeResponse.status,
          ok: claudeResponse.ok,
          headers: Object.fromEntries(claudeResponse.headers.entries())
        });

        let errorText;
        try {
          errorText = await claudeResponse.text();
        } catch (e) {
          errorText = 'Failed to read error response';
        }

        if (!claudeResponse.ok) {
          console.error('Claude API error:', {
            timestamp: new Date().toISOString(),
            status: claudeResponse.status,
            statusText: claudeResponse.statusText,
            errorText,
            headers: Object.fromEntries(claudeResponse.headers.entries())
          });

          let errorMessage;
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.error || errorJson.details || 'Unknown error';
          } catch (e) {
            errorMessage = errorText;
          }

          throw new Error(`Analysis failed (${claudeResponse.status}): ${errorMessage}`);
        }

        let result;
        try {
          result = JSON.parse(errorText);
        } catch (e) {
          console.error('Failed to parse Claude API response:', e);
          throw new Error('Invalid response from analysis service');
        }

        console.warn('Step 6: Processing Claude API response');

        // Update UI with results
        if (result.content) {
          setResultEnhancements({ analysis: result.content });
          console.warn('Step 7: Analysis complete and results displayed', {
            timestamp: new Date().toISOString(),
            analysisLength: result.content.length
          });
        } else {
          throw new Error('No analysis content in response');
        }

        onResultsFound(queryResult.featureSet);

      } catch (error: unknown) {
        console.error('Blob upload or analysis error:', {
          error,
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
        throw new Error(`Failed to process query: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          type="text"
          value={query}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
          placeholder="Enter your query..."
          className="flex-1"
        />
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Searching
            </>
          ) : (
            'Search'
          )}
        </Button>
      </form>

      {error && (
        <div className="text-red-500">
          {error}
        </div>
      )}

      <QueryEnhancementDisplay
        optimization={optimization}
        layerSelection={layerSelection}
        resultEnhancements={resultEnhancements}
      />
    </div>
  );
};

export const QueryInterface: React.FC<QueryInterfaceProps> = (props) => {
  return (
    // @ts-ignore
    <ErrorBoundary>
      <QueryInterfaceInner {...props} />
    </ErrorBoundary>
  );
}; 