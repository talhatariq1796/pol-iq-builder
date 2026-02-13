import { ConversationMemory, MemoryMessage } from './ConversationMemory';

interface GeospatialContext {
  lastAnalyzedRegions: string[];
  lastUsedLayers: string[];
  lastVisualizationType?: string;
  lastExtent?: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
    spatialReference?: {
      wkid: number;
    };
  };
}

export class GeospatialConversationMemory extends ConversationMemory {
  private geospatialContext: GeospatialContext = {
    lastAnalyzedRegions: [],
    lastUsedLayers: []
  };
  
  /**
   * Add a geospatial query with location and layer context
   */
  public addGeospatialQuery(
    query: string, 
    regions: string[] = [], 
    layers: string[] = [],
    visualizationType?: string,
    extent?: GeospatialContext['lastExtent']
  ): void {
    // Store the spatial context
    this.geospatialContext.lastAnalyzedRegions = regions;
    this.geospatialContext.lastUsedLayers = layers;
    
    if (visualizationType) {
      this.geospatialContext.lastVisualizationType = visualizationType;
    }
    
    if (extent) {
      this.geospatialContext.lastExtent = extent;
    }
    
    // Add to regular messages
    this.addMessage({
      role: 'user',
      content: query
    });
  }
  
  /**
   * Add a system message with analysis results
   */
  public addAnalysisResult(result: {
    layerNames: string[];
    regionNames?: string[];
    queryType: string;
    confidenceScore?: number;
  }): void {
    const content = `[SYSTEM] Analyzed query and found relevance to layers: ${result.layerNames.join(', ')}. 
    Query type identified as: ${result.queryType}${result.confidenceScore ? ` with confidence ${result.confidenceScore}` : ''}. 
    ${result.regionNames?.length ? `Regions referenced: ${result.regionNames.join(', ')}.` : ''}`;
    
    this.addMessage({
      role: 'system',
      content
    });
  }
  
  /**
   * Get enhanced context with spatial awareness
   */
  public getGeospatialContext(): string {
    const baseContext = this.getFormattedContext();
    const { lastAnalyzedRegions, lastUsedLayers, lastVisualizationType } = this.geospatialContext;
    
    let enhancedContext = baseContext;
    
    // Add spatial context if available
    if (lastAnalyzedRegions.length || lastUsedLayers.length) {
      enhancedContext += '\n\n[GEOSPATIAL CONTEXT]';
      
      if (lastAnalyzedRegions.length) {
        enhancedContext += `\nRecently analyzed regions: ${lastAnalyzedRegions.join(', ')}`;
      }
      
      if (lastUsedLayers.length) {
        enhancedContext += `\nRecently used data layers: ${lastUsedLayers.join(', ')}`;
      }
      
      if (lastVisualizationType) {
        enhancedContext += `\nLast visualization type: ${lastVisualizationType}`;
      }
    }
    
    return enhancedContext;
  }
  
  /**
   * Export the enhanced memory state including geospatial context
   */
  public export(): { 
    messages: MemoryMessage[]; 
    summaries: any[]; 
    geospatialContext: GeospatialContext;
  } {
    const baseExport = super.export();
    return {
      ...baseExport,
      geospatialContext: this.geospatialContext
    };
  }
  
  /**
   * Import a previously exported memory state with geospatial context
   */
  public import(data: { 
    messages: MemoryMessage[]; 
    summaries: any[]; 
    geospatialContext?: GeospatialContext;
  }): void {
    super.import(data);
    if (data.geospatialContext) {
      this.geospatialContext = data.geospatialContext;
    }
  }
} 