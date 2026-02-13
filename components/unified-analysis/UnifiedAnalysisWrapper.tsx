/* eslint-disable @typescript-eslint/no-unused-vars */
// UnifiedAnalysisWrapper.tsx
// A wrapper around the existing AnalysisEngine that adds unified workflow capabilities
// without breaking existing functionality

// AnalysisEngine will be dynamically imported to avoid Fast Refresh issues
import { 
  AnalysisOptions, 
  AnalysisResult,
  ProcessedAnalysisData,
  VisualizationResult 
} from '@/lib/analysis/types';
import { ClusterConfig } from '@/lib/clustering/types';
import { FieldFilterConfig } from '@/components/filtering/types';

export interface UnifiedAnalysisRequest {
  // Area selection from UnifiedAreaSelector
  geometry?: __esri.Geometry;
  geometryMethod?: 'draw' | 'search' | 'service-area' | 'project-area';
  
  // NEW: Spatial filtering context
  view?: __esri.MapView;           // Need view for spatial queries
  dataSourceLayerId?: string;      // Layer ID for spatial queries
  spatialFilterIds?: string[];     // Area IDs from spatial selection
  
  // Analysis type selection
  analysisType: 'query' | 'infographic' | 'comprehensive' | 'cma';
  
  // Query-specific options
  query?: string;
  endpoint?: string;
  
  // Infographic-specific options
  infographicType?: 'strategic' | 'competitive' | 'demographic';
  
  // Common options
  exportFormat?: 'pdf' | 'csv' | 'json';
  includeChat?: boolean;
  
  // Clustering options
  clusterConfig?: ClusterConfig;
  
  // Field filtering options (Phase 2)
  fieldFilters?: FieldFilterConfig;
  
  // Visualization customization options (Phase 3)
  visualizationConfig?: any;
  
  // Performance optimization options (Phase 4)
  performanceConfig?: any;
  
  // Persona selection
  persona?: string;

  // Analysis options (drilldown, viewMode, etc.)
  analysisOptions?: {
    drilldownKey?: string;
    viewMode?: 'aggregate' | 'detail';
    [key: string]: any;
  };
}

export interface UnifiedAnalysisResponse {
  // Original analysis result
  analysisResult: AnalysisResult;
  
  // Additional unified workflow metadata
  metadata: {
    geometry?: __esri.Geometry;
    analysisType: string;
    query?: string;
    timestamp: Date;
    processingTime: number;
  };
  
  // Export options
  exportOptions: {
    formats: string[];
    exportReady: boolean;
  };
}

/**
 * UnifiedAnalysisWrapper
 * Wraps the existing AnalysisEngine to provide unified workflow capabilities
 * while maintaining backward compatibility
 */
export class UnifiedAnalysisWrapper {
  private analysisEngine: any = null;
  private currentRequest: UnifiedAnalysisRequest | null = null;
  
  constructor() {
    // AnalysisEngine will be loaded dynamically
  }

  private async getAnalysisEngine() {
    if (!this.analysisEngine) {
      const { AnalysisEngine } = await import('@/lib/analysis/AnalysisEngine');
      this.analysisEngine = AnalysisEngine.getInstance();
    }
    return this.analysisEngine;
  }
  
  /**
   * Process a unified analysis request
   * Routes to appropriate analysis method based on request type
   */
  async processUnifiedRequest(request: UnifiedAnalysisRequest): Promise<UnifiedAnalysisResponse> {
    const startTime = Date.now();
    this.currentRequest = request;
    
    console.log('[UnifiedAnalysisWrapper] Processing request:', {
      analysisType: request.analysisType,
      hasGeometry: !!request.geometry,
      query: request.query?.substring(0, 50)
    });
    
    let analysisResult: AnalysisResult;
    
    try {
      // Route based on analysis type
      switch (request.analysisType) {
        case 'query':
          analysisResult = await this.processQueryAnalysis(request);
          break;
          
        case 'infographic':
          analysisResult = await this.processInfographicAnalysis(request);
          break;
          
        case 'comprehensive':
          analysisResult = await this.processComprehensiveAnalysis(request);
          break;

        case 'cma':
          analysisResult = await this.processCMAAnalysis(request);
          break;
          
        default:
          throw new Error(`Unknown analysis type: ${request.analysisType}`);
      }
      
      // Prepare unified response
      const response: UnifiedAnalysisResponse = {
        analysisResult,
        metadata: {
          geometry: request.geometry,
          analysisType: request.analysisType,
          query: request.query,
          timestamp: new Date(),
          processingTime: Date.now() - startTime
        },
        exportOptions: {
          formats: this.getAvailableExportFormats(analysisResult),
          exportReady: true
        }
      };
      
      console.log('[UnifiedAnalysisWrapper] Request completed:', {
        processingTime: response.metadata.processingTime,
        hasResults: !!analysisResult.data
      });
      
      return response;
      
    } catch (error) {
      console.error('[UnifiedAnalysisWrapper] Error processing request:', error);
      throw error;
    }
  }
  
  /**
   * Process query-based analysis
   * Uses existing AnalysisEngine.analyze method
   */
  /**
   * Helper method to get spatial filter IDs from geometry selection
   */
  private async getSpatialFilterIds(request: UnifiedAnalysisRequest): Promise<string[] | undefined> {
    // If spatial filter IDs are already provided, use them
    if (request.spatialFilterIds) {
      console.log(`[UnifiedAnalysisWrapper] Using pre-computed spatial filter IDs: ${request.spatialFilterIds.length} features`);
      return request.spatialFilterIds;
    }
    
    // Fallback: Only attempt spatial filtering if we have all required parameters
    if (!request.geometry || !request.view || !request.dataSourceLayerId) {
      console.log('[UnifiedAnalysisWrapper] Spatial filter skipped - missing required parameters:', {
        hasGeometry: !!request.geometry,
        hasView: !!request.view,
        hasDataSourceLayerId: !!request.dataSourceLayerId
      });
      return undefined;
    }

    console.log('[UnifiedAnalysisWrapper] Fallback: Computing spatial filter IDs (should have been done in workflow)');

    try {
      console.log('[UnifiedAnalysisWrapper] Applying spatial filter with geometry:', {
        geometryType: request.geometry.type,
        geometryMethod: request.geometryMethod,
        layerId: request.dataSourceLayerId
      });
      
      // Import SpatialFilterService
      const { SpatialFilterService } = await import('@/lib/spatial/SpatialFilterService');
      
      // Determine spatial relationship based on geometry method
      // All buffer types (radius, drive-time, walk-time) should use 'intersects'
      // Only drawn polygons should use 'contains'
      const spatialRelationship = (request.geometry.type === 'point' || 
                                   request.geometryMethod === 'service-area')
        ? 'intersects'  // Points and all buffer types use intersects
        : 'contains';   // Only drawn polygons use contains (stricter)
      
      const spatialFilterIds = await SpatialFilterService.queryFeaturesByGeometry(
        request.view,
        request.geometry,
        request.dataSourceLayerId,
        { spatialRelationship }
      );
      
      console.log(`[UnifiedAnalysisWrapper] Fallback spatial filter found ${spatialFilterIds.length} features:`, spatialFilterIds.slice(0, 10));
      
      // If no features found in selection, diagnose the issue
      if (spatialFilterIds.length === 0) {
        console.warn('[UnifiedAnalysisWrapper] No features found in selected area - diagnosing...');
        
        // Log geometry details for debugging
        console.log('[UnifiedAnalysisWrapper] Buffer geometry details:', {
          type: request.geometry.type,
          extent: request.geometry.extent ? {
            xmin: request.geometry.extent.xmin,
            ymin: request.geometry.extent.ymin,
            xmax: request.geometry.extent.xmax,
            ymax: request.geometry.extent.ymax
          } : null,
          spatialReference: {
            wkid: request.geometry.spatialReference?.wkid
          },
          center: request.geometry.extent?.center ? {
            x: request.geometry.extent.center.x,
            y: request.geometry.extent.center.y
          } : null
        });
        
        // For service areas, this might be expected if buffer is outside data coverage
        // But we should still try to continue with some spatial awareness
        console.warn('[UnifiedAnalysisWrapper] Continuing without spatial filter - buffer may be outside data coverage');
        return undefined;
      }

      return spatialFilterIds;
    } catch (error) {
      console.warn('[UnifiedAnalysisWrapper] Fallback spatial filter failed:', error);
      return undefined;
    }
  }

  private async processQueryAnalysis(request: UnifiedAnalysisRequest): Promise<AnalysisResult> {
    if (!request.query) {
      throw new Error('Query is required for query analysis');
    }
    
    // Don't use spatial filter for project-area selection
    const spatialFilterIds = request.geometryMethod === 'project-area' 
      ? undefined 
      : (request.spatialFilterIds || await this.getSpatialFilterIds(request));
    
    const options: AnalysisOptions = {
      // Remove explicit endpoint to allow intelligent classification like original UI
      clusterConfig: request.clusterConfig,
      fieldFilters: request.fieldFilters,         // Phase 2: Pass field filters
      visualizationConfig: request.visualizationConfig, // Phase 3: Pass visualization config
      performanceConfig: request.performanceConfig, // Phase 4: Pass performance config
      spatialFilterIds,                          // Pass feature IDs (undefined for project-area)
      spatialFilterGeometry: request.geometry,   // Pass geometry for reference
      spatialFilterMethod: request.geometryMethod, // Track how it was selected
      persona: request.persona,                   // Pass the selected persona
      // Pass drilldown options directly (they're already in AnalysisOptions type)
      viewMode: request.analysisOptions?.viewMode,
      drilldownKey: request.analysisOptions?.drilldownKey,
      // Add analysisScope when project-area is selected
      ...(request.geometryMethod === 'project-area' ? { analysisScope: 'project' } : {})
    };
    
    const analysisEngine = await this.getAnalysisEngine();
    return await analysisEngine.executeAnalysis(request.query, options);
  }
  
  /**
   * Process infographic-based analysis
   * Focuses on score-based visualizations
   */
  private async processInfographicAnalysis(request: UnifiedAnalysisRequest): Promise<AnalysisResult> {
    // Don't use spatial filter for project-area selection
    const spatialFilterIds = request.geometryMethod === 'project-area' 
      ? undefined 
      : (request.spatialFilterIds || await this.getSpatialFilterIds(request));
    
    const query = `Generate ${request.infographicType || 'strategic'} analysis`;
    const options: AnalysisOptions = {
      // Remove explicit endpoint to allow intelligent classification like original UI
      visualizationType: 'scorecard', // Focus on scorecard visualization for infographics
      fieldFilters: request.fieldFilters,         // Phase 2: Pass field filters
      visualizationConfig: request.visualizationConfig, // Phase 3: Pass visualization config
      performanceConfig: request.performanceConfig, // Phase 4: Pass performance config
      spatialFilterIds,                          // Pass feature IDs (undefined for project-area)
      spatialFilterGeometry: request.geometry,   // Pass geometry for reference
      spatialFilterMethod: request.geometryMethod, // Track how it was selected
      persona: request.persona,                   // Pass the selected persona
      // Add analysisScope when project-area is selected
      ...(request.geometryMethod === 'project-area' ? { analysisScope: 'project' } : {})
    };
    
    const analysisEngine = await this.getAnalysisEngine();
    return await analysisEngine.executeAnalysis(query, options);
  }
  
  /**
   * Process comprehensive analysis
   * Runs multiple endpoints and combines results
   */
  private async processComprehensiveAnalysis(request: UnifiedAnalysisRequest): Promise<AnalysisResult> {
    // Don't use spatial filter for project-area selection
    const spatialFilterIds = request.geometryMethod === 'project-area' 
      ? undefined 
      : (request.spatialFilterIds || await this.getSpatialFilterIds(request));
    
    // Use multi-endpoint capabilities of AnalysisEngine
    const query = 'Comprehensive area analysis';
    const options: AnalysisOptions = {
      // Remove explicit endpoint to allow intelligent classification like original UI
      fieldFilters: request.fieldFilters,         // Phase 2: Pass field filters
      visualizationConfig: request.visualizationConfig, // Phase 3: Pass visualization config
      performanceConfig: request.performanceConfig, // Phase 4: Pass performance config
      spatialFilterIds,                          // Pass feature IDs (undefined for project-area)
      spatialFilterGeometry: request.geometry,   // Pass geometry for reference
      spatialFilterMethod: request.geometryMethod, // Track how it was selected
      persona: request.persona,                   // Pass the selected persona
      // Add analysisScope when project-area is selected
      ...(request.geometryMethod === 'project-area' ? { analysisScope: 'project' } : {})
    };
    
    const analysisEngine = await this.getAnalysisEngine();
    return await analysisEngine.executeAnalysis(query, options);
  }

  /**
   * Process CMA (Comparative Market Analysis) analysis
   * Focuses on property comparison and market insights
   */
  private async processCMAAnalysis(request: UnifiedAnalysisRequest): Promise<AnalysisResult> {
    // Don't use spatial filter for project-area selection
    const spatialFilterIds = request.geometryMethod === 'project-area'
      ? undefined
      : (request.spatialFilterIds || await this.getSpatialFilterIds(request));
    
    // Use CMA-specific query and endpoint
    const query = 'Generate comparative market analysis for real estate properties';
    const options: AnalysisOptions = {
      endpoint: '/comparative-market-analysis', // Force CMA endpoint
      visualizationType: 'map', // Use map visualization for property locations
      fieldFilters: request.fieldFilters,
      visualizationConfig: request.visualizationConfig,
      performanceConfig: request.performanceConfig,
      spatialFilterIds,
      spatialFilterGeometry: request.geometry,
      spatialFilterMethod: request.geometryMethod,
      geometry: request.geometry, // Pass geometry for CMA buffer analysis
      filters: request.fieldFilters, // Pass any additional filters
      ...(request.geometryMethod === 'project-area' ? { analysisScope: 'project' } : {})
    };
    
    const analysisEngine = await this.getAnalysisEngine();
    return await analysisEngine.executeAnalysis(query, options);
  }
  
  /**
   * Get available export formats based on analysis result
   */
  private getAvailableExportFormats(result: AnalysisResult): string[] {
    const formats = ['json']; // Always available
    
    if (result.visualization) {
      formats.push('pdf', 'png');
    }
    
    if (result.data?.records?.length > 0) {
      formats.push('csv', 'geojson');
    }
    
    return formats;
  }
  
  /**
   * Export analysis results in specified format
   */
  async exportResults(format: string): Promise<Blob> {
    if (!this.currentRequest) {
      throw new Error('No analysis results to export');
    }
    
    // Implementation would handle different export formats
    // This is a placeholder
    const data = JSON.stringify(this.currentRequest);
    return new Blob([data], { type: 'application/json' });
  }
  
  /**
   * Get current analysis state
   */
  async getCurrentState() {
    const analysisEngine = await this.getAnalysisEngine();
    return analysisEngine.getState();
  }
  
  /**
   * Subscribe to analysis state changes
   */
  async subscribe(callback: (state: any) => void) {
    const analysisEngine = await this.getAnalysisEngine();
    return analysisEngine.subscribe(callback);
  }
}