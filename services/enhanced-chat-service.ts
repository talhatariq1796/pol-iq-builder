/**
 * Enhanced Chat Service with Multi-Endpoint Support
 * 
 * Extends the existing chat service to support dynamic fetching of additional
 * endpoint data when users ask cross-endpoint questions.
 */

import { multiEndpointDetector, type EndpointContext } from '@/lib/chat/multi-endpoint-detector';
import { multiEndpointFetcher, type EndpointDataRequest } from '@/lib/chat/multi-endpoint-fetcher';
import { sendChatMessage as baseSendChatMessage } from './chat-service';

export interface EnhancedChatRequest {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  metadata: {
    query: string;
    analysisType?: string;
    relevantLayers?: string[];
    spatialFilterIds?: string[];
    filterType?: string;
    rankingContext?: unknown;
    isClustered?: boolean;
    targetVariable?: string;
    endpoint?: string;
    isContextualChat?: boolean;
    // New multi-endpoint fields
    enableMultiEndpoint?: boolean;
    conversationHistory?: string[];
  };
  featureData: Array<{
    layerId: string;
    layerName: string;
    layerType: string;
    features: any[];
    metadata?: any;
  }>;
  persona?: string;
  analysisResult?: any; // Primary analysis result for context
}

export interface EnhancedChatResponse {
  content: string;
  multiEndpointContext?: {
    additionalDataFetched: boolean;
    endpointsFetched: string[];
    fetchTime: number;
    reasoning: string;
  };
  suggestions?: Array<{
    question: string;
    endpoint: string;
    reason: string;
  }>;
}

/**
 * Enhanced chat message function with multi-endpoint support
 */
export async function sendEnhancedChatMessage(
  request: EnhancedChatRequest,
  options?: { signal?: AbortSignal }
): Promise<EnhancedChatResponse> {
  const startTime = performance.now();
  
  // Extract current query and analysis context
  const currentQuery = request.metadata.query;
  const currentEndpoint = request.metadata.endpoint || '';
  const conversationHistory = request.metadata.conversationHistory || [];

  console.log(`[EnhancedChatService] Processing query: "${currentQuery}" from endpoint: ${currentEndpoint}`);

  // Step 1: Detect if additional endpoints are needed
  const detectionResult = multiEndpointDetector.detectRequiredEndpoints(
    currentQuery,
    currentEndpoint,
    conversationHistory
  );

  console.log(`[EnhancedChatService] Endpoint detection: ${detectionResult.reasoning}`);

  let multiEndpointContext: EnhancedChatResponse['multiEndpointContext'] = {
    additionalDataFetched: false,
    endpointsFetched: [],
    fetchTime: 0,
    reasoning: detectionResult.reasoning
  };

  // Step 2: Fetch additional data if needed and enabled
  let enhancedFeatureData = request.featureData;
  
  if (detectionResult.shouldFetch && 
      request.metadata.enableMultiEndpoint !== false && // Default to enabled
      detectionResult.additionalEndpoints.length > 0) {

    try {
      // Build data requests for detected endpoints
      const dataRequests: EndpointDataRequest[] = detectionResult.additionalEndpoints
        .filter(ep => ep.priority === 'high') // Only auto-fetch high-priority endpoints
        .map(ep => ({
          endpoint: ep.endpoint,
          geography: {
            spatialFilterIds: request.metadata.spatialFilterIds,
            filterType: request.metadata.filterType,
            zipCodes: extractZipCodesFromFeatureData(request.featureData)
          },
          query: currentQuery,
          reason: ep.reason
        }));

      if (dataRequests.length > 0) {
        console.log(`[EnhancedChatService] Fetching additional data from ${dataRequests.length} endpoints`);

        const fetchResult = await multiEndpointFetcher.fetchAdditionalEndpointData(
          dataRequests,
          request.analysisResult
        );

        if (fetchResult.success) {
          // Convert fetched data to feature data format
          const additionalFeatureData = multiEndpointFetcher.convertToFeatureData(fetchResult);
          
          // Merge with existing feature data (remove primary analysis to avoid duplication)
          enhancedFeatureData = [
            ...request.featureData, // Keep original data
            ...additionalFeatureData.filter(f => !f.metadata?.isPrimary) // Add only additional data
          ];

          multiEndpointContext = {
            additionalDataFetched: true,
            endpointsFetched: fetchResult.additionalData
              .filter(d => d.success)
              .map(d => d.endpoint),
            fetchTime: fetchResult.totalFetchTime,
            reasoning: `Successfully fetched data from ${fetchResult.additionalData.filter(d => d.success).length} additional endpoints`
          };

          console.log(`[EnhancedChatService] Enhanced feature data with ${enhancedFeatureData.length} layers`);
        } else {
          console.warn(`[EnhancedChatService] Multi-endpoint fetch failed:`, fetchResult.errors);
          multiEndpointContext.reasoning += ` (fetch failed: ${fetchResult.errors.join(', ')})`;
        }
      }
    } catch (error) {
      console.error('[EnhancedChatService] Multi-endpoint fetch error:', error);
      multiEndpointContext.reasoning += ` (error: ${error instanceof Error ? error.message : 'unknown'})`;
    }
  }

  // Step 3: Enhanced metadata for multi-endpoint context
  const enhancedMetadata = {
    ...request.metadata,
    // Add context about available data layers
    availableLayers: enhancedFeatureData.map(f => ({
      layerId: f.layerId,
      layerName: f.layerName,
      endpoint: f.metadata?.endpoint,
      recordCount: f.features.length
    })),
    multiEndpointContext: multiEndpointContext.additionalDataFetched ? {
      additionalEndpoints: detectionResult.additionalEndpoints.map(e => e.endpoint),
      fetchedEndpoints: multiEndpointContext.endpointsFetched,
      reasoning: detectionResult.reasoning
    } : undefined
  };

  // Step 4: Call the base chat service with enhanced data
  const enhancedRequest = {
    ...request,
    metadata: enhancedMetadata,
    featureData: enhancedFeatureData,
    persona: request.persona || 'default' // Ensure persona is defined for ChatRequest
  };

  const response = await baseSendChatMessage(enhancedRequest, options);

  // Step 5: Generate cross-endpoint suggestions
  const suggestions = multiEndpointDetector.generateCrossEndpointSuggestions(
    currentEndpoint,
    extractTopAreasFromFeatureData(request.featureData)
  );

  const totalProcessingTime = performance.now() - startTime;
  console.log(`[EnhancedChatService] Total processing time: ${totalProcessingTime.toFixed(1)}ms`);

  return {
    content: response.content,
    multiEndpointContext,
    suggestions: suggestions.length > 0 ? suggestions : undefined
  };
}

/**
 * Extract ZIP codes from feature data for geographic context
 */
function extractZipCodesFromFeatureData(featureData: any[]): string[] {
  const zipCodes = new Set<string>();
  
  for (const layer of featureData) {
    for (const feature of layer.features || []) {
      const props = feature.properties || feature;
      
      // Look for common ZIP code fields
      const zipFields = ['ZIP_CODE', 'ZIPCODE', 'zip_code', 'zip', 'ZIP', 'GEOID', 'area_id'];
      for (const field of zipFields) {
        const value = props[field];
        if (value && typeof value === 'string' && /^\d{5}$/.test(value)) {
          zipCodes.add(value);
        }
      }
    }
  }
  
  return Array.from(zipCodes).slice(0, 50); // Limit to 50 ZIP codes to avoid huge requests
}

/**
 * Extract top performing areas from feature data
 */
function extractTopAreasFromFeatureData(featureData: any[]): string[] {
  const areas = new Set<string>();
  
  for (const layer of featureData) {
    for (const feature of layer.features || []) {
      const props = feature.properties || feature;
      
      // Look for area name fields
      const nameFields = ['area_name', 'AREA_NAME', 'name', 'NAME', 'city', 'CITY', 'location'];
      for (const field of nameFields) {
        const value = props[field];
        if (value && typeof value === 'string') {
          areas.add(value);
          if (areas.size >= 5) break; // Limit to top 5 areas
        }
      }
    }
  }
  
  return Array.from(areas);
}

/**
 * Backward compatibility function - enhanced version of the original
 */
export async function sendChatMessage(
  requestPayload: any,
  options?: { signal?: AbortSignal }
): Promise<{ content: string }> {
  // Convert legacy request to enhanced format
  const enhancedRequest: EnhancedChatRequest = {
    messages: requestPayload.messages || [],
    metadata: {
      ...requestPayload.metadata,
      enableMultiEndpoint: true, // Enable by default
      conversationHistory: requestPayload.messages
        ?.filter((m: any) => m.role === 'user')
        ?.map((m: any) => m.content) || []
    },
    featureData: requestPayload.featureData || [],
    persona: requestPayload.persona,
    analysisResult: requestPayload.analysisResult
  };

  const response = await sendEnhancedChatMessage(enhancedRequest, options);
  
  // Return in legacy format
  return {
    content: response.content
  };
}