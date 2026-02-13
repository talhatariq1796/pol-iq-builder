import { AnalysisServiceRequest, AnalysisServiceResponse, JobStatusResponse, AnalysisResult } from '@/lib/analytics/types';
import { fetchDataForAnalysis, LayerDataResult } from './data-fetcher';
import { layers } from '../config/layers';
import { fetchColumnSchema } from '@/utils/schema';
import { validateRequest } from '@/utils/analysis-validator';
import { getRequestId } from '@/utils/request-id';

const API_BASE_URL = process.env.NEXT_PUBLIC_SHAP_MICROSERVICE_URL;
const API_KEY = process.env.NEXT_PUBLIC_SHAP_MICROSERVICE_API_KEY;

if (!API_BASE_URL) {
  throw new Error('NEXT_PUBLIC_SHAP_MICROSERVICE_URL environment variable is not set');
}

if (!API_KEY) {
  throw new Error('NEXT_PUBLIC_SHAP_MICROSERVICE_API_KEY environment variable is not set');
}

/**
 * Calls the backend analysis service.
 * This function now orchestrates a multi-step process:
 * 1. Load the project configuration.
 * 2. Fetch data from ArcGIS layers based on the initial query analysis.
 * 3. Send the fetched data to the microservice for advanced analysis.
 * 4. Poll for the job status until completion.
 * @param request The initial request from the client.
 * @returns The final analysis result from the microservice.
 */
export async function callAnalysisService(
  request: AnalysisServiceRequest & Partial<AnalysisResult>
): Promise<AnalysisServiceResponse> {
  try {
    // Validate API configuration
    if (!API_BASE_URL || !API_KEY) {
      throw new Error('Analysis service configuration is incomplete. Please check environment variables.');
    }

    // Load column schema once (cached)
    const schemaColumns = await fetchColumnSchema();

    // Validate the outgoing request early; throws with user-friendly message if bad
    validateRequest(request as any, schemaColumns);

    // Step 1: Construct Project Config from imported layers
    const projectConfig = {
      layers,
      groups: [],
      defaultVisibility: {},
      defaultCollapsed: {},
      globalSettings: {
        defaultOpacity: 0.8,
        maxVisibleLayers: 10,
        performanceMode: 'standard' as const
      }
    };

    // Step 2: Fetch data from ArcGIS layers using the new data-fetcher
    const analysisResultForFetcher: AnalysisResult = {
      // Provide default values for required fields of AnalysisResult
      queryType: 'unknown',
      entities: [],
      intent: 'unknown',
      confidence: 0,
      layers: [],
      timeframe: '',
      searchType: 'web',
      relevantLayers: [],
      explanation: '',
      ...request, // The request object from the chat interface, which contains the crucial details
    };
    
    const layerDataResults = await fetchDataForAnalysis({
      projectConfig,
      analysisResult: analysisResultForFetcher, 
    });

    const features = layerDataResults.flatMap(result => result.features);
    if (features.length === 0) {
      console.warn("[AnalysisService] No features were fetched from ArcGIS. Sending empty features array to microservice.");
    }
    
    // Step 3: Send fetched data to the microservice for analysis
    const analysisRequestPayload = {
      ...request,
      features: features.map(f => ({ // Ensure features are serialized correctly
        attributes: f.attributes,
        geometry: f.geometry?.toJSON() 
      })),
    };

    console.log('[AnalysisService] Submitting job to microservice with payload:', {
      query: analysisRequestPayload.query,
      analysis_type: analysisRequestPayload.analysis_type,
      feature_count: analysisRequestPayload.features.length,
      api_url: API_BASE_URL
    });

    try {
      const submitResponse = await fetch(`${API_BASE_URL}/analyze`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-API-KEY': API_KEY,
          'X-Request-ID': getRequestId(),
          'Accept': 'application/json'
        },
        body: JSON.stringify(analysisRequestPayload),
      });

      if (!submitResponse.ok) {
        const errorBody = await submitResponse.text();
        console.error('[AnalysisService] Microservice error response:', {
          status: submitResponse.status,
          statusText: submitResponse.statusText,
          body: errorBody
        });
        throw new Error(`Failed to submit analysis job: ${submitResponse.status} ${errorBody}`);
      }

      const responseData = await submitResponse.json();
      if (!responseData.job_id) {
        throw new Error('Invalid response from microservice: missing job_id');
      }

      console.log(`[AnalysisService] Job submitted successfully. Job ID: ${responseData.job_id}`);

      // Step 4: Poll for job status
      return await pollForJobStatus(responseData.job_id);
    } catch (error: unknown) {
      console.error('[AnalysisService] Network error during microservice request:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown network error';
      throw new Error(`Failed to connect to analysis service: ${errorMessage}`);
    }

  } catch (error) {
    console.error('[AnalysisService] Error during analysis orchestration:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    // Return an error structure that matches AnalysisServiceResponse
    return {
      summary: `Error in analysis: ${message}`,
      error: message,
      results: [],
      visualizationData: [],
      popupConfig: undefined,
    };
  }
}

/**
 * Polls the job status endpoint until the job is complete.
 * @param jobId The ID of the job to poll.
 * @returns The final job result.
 */
async function pollForJobStatus(jobId: string): Promise<AnalysisServiceResponse> {
  const MAX_POLL_ATTEMPTS = 60; // 60 attempts * 2 seconds = 2 minutes timeout
  const POLL_INTERVAL_MS = 2000;

  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));

    try {
      // Ensure API_KEY is defined before using it in headers
      if (!API_KEY) {
        throw new Error('API key is not configured');
      }

      const statusResponse = await fetch(`${API_BASE_URL}/job_status/${jobId}`, {
        headers: {
          'X-API-KEY': API_KEY,
          'Accept': 'application/json'
        }
      });

      if (!statusResponse.ok) {
        const errorBody = await statusResponse.text();
        console.warn(`[AnalysisService] Warning fetching job status: ${statusResponse.status}`, {
          statusText: statusResponse.statusText,
          body: errorBody
        });
        continue;
      }

      const result: JobStatusResponse = await statusResponse.json();
      console.log(`[AnalysisService] Polling job ${jobId}, status: ${result.status}`);

      if (result.status === 'completed') {
        if (!result.result) {
          throw new Error('Analysis completed but no result data received');
        }
        return result.result as AnalysisServiceResponse;
      }

      if (result.status === 'failed') {
        throw new Error(`Analysis job failed: ${result.error || 'Unknown error'}`);
      }
      
      // If status is 'processing' or 'pending', continue loop

    } catch (error) {
      console.error(`[AnalysisService] Error polling for job status:`, error);
      // Let the loop continue, maybe it's a transient network error
    }
  }

  throw new Error('Analysis job timed out after 2 minutes.');
}