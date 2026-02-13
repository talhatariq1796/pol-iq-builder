/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ProcessedAnalysisData, VisualizationResult, VisualizationRendererStrategy, VisualizationType } from './types';
import { ConfigurationManager } from './ConfigurationManager';
import { getQuintileColorScheme, calculateEqualCountQuintiles } from './utils/QuintileUtils';

// Import specialized renderers
import { ChoroplethRenderer } from './strategies/renderers/ChoroplethRenderer';
import { ClusterRenderer } from './strategies/renderers/ClusterRenderer';
import { CompetitiveRenderer } from './strategies/renderers/CompetitiveRenderer';
import { CategoricalRenderer } from './strategies/renderers/CategoricalRenderer';
import { HeatmapRenderer } from './strategies/renderers/HeatmapRenderer';
import { GraduatedSymbolRenderer } from './strategies/renderers/GraduatedSymbolRenderer';
import { BivariateRenderer } from './strategies/renderers/BivariateRenderer';
import { GeometryDetector } from './utils/GeometryDetector';

// Import enhanced effects system
import { EffectsManager, EffectsManagerConfig } from './strategies/renderers/effects/EffectsManager';

// Import ArcGIS types
import type MapView from '@arcgis/core/views/MapView';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';

/**
 * Enhanced VisualizationRenderer - Creates dynamic visualizations using specialized renderers
 * 
 * Now uses the Strategy pattern with specialized renderers for each visualization type,
 * providing enhanced rendering capabilities tailored to specific analysis requirements.
 */
export class VisualizationRenderer {
  private configManager: ConfigurationManager;
  private renderers: Map<string, VisualizationRendererStrategy>;
  private effectsManager: EffectsManager | null = null;
  private mapView: MapView | null = null;

  constructor(configManager: ConfigurationManager) {
    this.configManager = configManager;
    this.renderers = new Map();
    this.initializeRenderers();
    this.initializeEffectsManager();
  }

  /**
   * Initialize the map view and effects system
   */
  async initializeMapView(mapView: MapView): Promise<void> {
    this.mapView = mapView;
    
    if (this.effectsManager) {
      try {
        await this.effectsManager.initialize(mapView);
        console.log('[VisualizationRenderer] Effects system initialized successfully');
      } catch (error) {
        console.error('[VisualizationRenderer] Failed to initialize effects system:', error);
      }
    }
  }

  /**
   * Initialize the effects management system
   */
  private initializeEffectsManager(): void {
    const effectsConfig: Partial<EffectsManagerConfig> = {
      enabled: true,
      performance: 'auto',
      fireflies: {
        enabled: true,
        intensity: 0.8,
        color: '#FFD700'
      },
      gradients: true,
      hover: {
        enabled: true,
        scale: 1.2,
        glow: {
          enabled: true,
          color: 'transparent',
          size: 2,
          intensity: 0.8
        },
        ripple: {
          enabled: true,
          color: 'transparent',
          maxRadius: 20,
          duration: 1000,
          opacity: 0.6
        }
      },
      ambient: {
        enabled: true,
        density: 0.4,
        opacity: 0.6
      },
      coordinateEffects: true
    };
    
    this.effectsManager = new EffectsManager(effectsConfig);
  }

  /**
   * Create visualization using appropriate specialized renderer
   */
  createVisualization(data: ProcessedAnalysisData, endpoint: string): VisualizationResult {
    try {
      console.log(`[VisualizationRenderer] Creating visualization for ${endpoint} with ${data.records.length} records`);
      
      // DEBUG: For comparative analysis, log received ZIP codes
      if (endpoint === '/comparative-analysis' && data.records.length > 0) {
        const zipCodes = data.records.map(r => r.area_name).slice(0, 20);
        console.log(`🔍 [VisualizationRenderer] DEBUGGING: ZIP codes received for visualization:`, zipCodes);
      }
      console.log(`[VisualizationRenderer] Data type: ${data.type}, target variable: ${data.targetVariable}`);
      console.log(`[VisualizationRenderer] Is clustered data:`, data.isClustered);
      console.log(`[VisualizationRenderer] Sample record:`, data.records[0] ? {
        area_id: data.records[0].area_id,
        area_name: data.records[0].area_name,
        value: data.records[0].value,
        hasProperties: !!data.records[0].properties,
        propertyKeys: data.records[0].properties ? Object.keys(data.records[0].properties).slice(0, 5) : [],
        isCluster: data.records[0].properties?.is_cluster,
  clusterZipCodes: (data.records[0].properties as any)?.zip_codes?.length
      } : 'No records');
      
      // Get endpoint configuration
      const endpointConfig = this.configManager.getEndpointConfig(endpoint);
      if (!endpointConfig) {
        throw new Error(`No configuration found for endpoint: ${endpoint}`);
      }

      // Determine visualization type
      const visualizationType = this.determineVisualizationType(data, endpointConfig.defaultVisualization);
      
      // Get appropriate renderer
      const renderer = this.getRendererForType(visualizationType);
      
      // Create visualization configuration
      const visualizationConfig = this.createVisualizationConfig(data, endpointConfig, visualizationType);
      
      // Check for direct rendering (bypasses complex chain)
      // CRITICAL: Always skip direct rendering for clustered data to ensure ClusterRenderer is used
      // CRITICAL: Never use direct rendering for clustered data - always use cluster renderer
      console.log(`[VisualizationRenderer] 🔍 Direct rendering condition check:`, {
        hasRenderer: !!data.renderer,
        hasLegend: !!data.legend,
        isClustered: !!data.isClustered,
        rendererType: (data.renderer as any)?.type,
        legendTitle: (data.legend as any)?.title,
        legendItems: (data.legend as any)?.items?.length,
        willUseDirect: !!(data.renderer && data.legend && !data.isClustered)
      });
      
      if (data.renderer && data.legend && !data.isClustered) {
        console.log(`[VisualizationRenderer] 🎯 Using DIRECT RENDERING from processor`);
        // Diagnostics: verify renderer.field exists and is numeric in records
        try {
          const rf = (data.renderer as any)?.field;
          if (rf) {
            const totals = data.records.length;
            let missingTop = 0, missingProps = 0, nonNumeric = 0;
            const samples: any[] = [];
            for (let i = 0; i < Math.min(25, totals); i++) {
              const r: any = data.records[i];
              const top = (r as any)?.[rf];
              const prop = (r as any)?.properties?.[rf];
              const hasTop = top !== undefined;
              const hasProp = prop !== undefined;
              const val = hasTop ? top : prop;
              const isNum = typeof val === 'number' && !isNaN(val);
              if (!hasTop) missingTop++;
              if (!hasProp) missingProps++;
              if (!isNum) nonNumeric++;
              if (samples.length < 3 && (!hasTop || !isNum)) {
                samples.push({ area: r?.area_name, value: r?.value, top, prop, typeofTop: typeof top, typeofProp: typeof prop });
              }
            }
            console.log(`[VisualizationRenderer] 🔎 Renderer field check`, { field: rf, totals, missingTop, missingProps, nonNumeric, samples });
            // Safe fallback: if most records lack numeric rf but targetVariable/value are valid, switch field to targetVariable or 'value'
            if (totals > 0 && (nonNumeric > totals * 0.6)) {
              const fallbackField = data.targetVariable || 'value';
              const testVal = (data.records[0] as any)?.[fallbackField] ?? (data.records[0] as any)?.properties?.[fallbackField];
              if (typeof testVal === 'number' && !isNaN(testVal)) {
                const cloned = { ...(data.renderer as any), field: fallbackField };
                console.warn(`[VisualizationRenderer] ⚠️ Switching renderer.field from "${rf}" to "${fallbackField}" due to invalid/missing values`);
                const result = {
                  type: visualizationType,
                  config: visualizationConfig,
                  renderer: cloned,
                  popupTemplate: this.createMinimalPopupTemplate(),
                  legend: (data.legend as any) as unknown as import('./types').LegendConfig,
                  extent: data.extent || null,
                  shouldZoom: data.shouldZoom || false
                };
                return result;
              }
            }
          }
        } catch (diagErr) {
          console.warn('[VisualizationRenderer] Renderer field diagnostics failed:', diagErr);
        }

        const result = {
          type: visualizationType,
          config: visualizationConfig,
          renderer: data.renderer as any,
          popupTemplate: this.createMinimalPopupTemplate(),
          legend: (data.legend as any) as unknown as import('./types').LegendConfig,
          extent: data.extent || null,
          shouldZoom: data.shouldZoom || false
        };
        console.log(`[VisualizationRenderer] Direct renderer result:`, {
          type: result?.type,
          hasRenderer: !!result?.renderer,
          rendererType: (result?.renderer as any)?.type,
          hasPopupTemplate: !!result?.popupTemplate,
          hasLegend: !!result?.legend,
          legendItems: (result?.legend as any)?.items?.length
        });
        return result;
      }
      
      // For clustered data, always use the full rendering pipeline
      if (data.isClustered) {
        console.log(`[VisualizationRenderer] 🎯 Clustered data detected - using full rendering pipeline`);
        console.log(`[VisualizationRenderer] 🎯 Cluster details:`, {
          clusterCount: data.clusters?.length || 0,
          sampledClusterIds: data.records.slice(0, 3).map(r => ({ area: r.area_name, clusterId: r.cluster_id }))
        });
      } else {
        console.log(`[VisualizationRenderer] 🚨 Direct rendering FAILED - missing renderer or legend:`, {
          missingRenderer: !data.renderer,
          missingLegend: !data.legend,
          processorType: data.type,
          endpoint: endpoint
        });
      }
      
      // Fallback to complex rendering chain
      console.log(`[VisualizationRenderer] About to call renderer.render() for type: ${visualizationType}`);
      const result = renderer.render(data, visualizationConfig);
      console.log(`[VisualizationRenderer] Renderer returned:`, {
        type: result?.type,
        hasRenderer: !!result?.renderer,
        rendererType: (result?.renderer as any)?.type,
        hasPopupTemplate: !!result?.popupTemplate,
        hasLegend: !!result?.legend
      });
      
      console.log(`[VisualizationRenderer] Successfully created ${visualizationType} visualization`);
      return result;
      
    } catch (error) {
      console.error(`[VisualizationRenderer] Error creating visualization for ${endpoint}:`, error);
      
      // Return fallback visualization
      return this.createFallbackVisualization(data, endpoint);
    }
  }

  /**
   * Apply effects to a layer after it's been added to the map
   * This should be called by the map integration code after layer creation
   */
  async applyVisualizationEffects(layer: FeatureLayer, visualizationResult: VisualizationResult): Promise<void> {
    if (!this.effectsManager || !this.mapView || !visualizationResult._pendingEffects) {
      return;
    }
    
    try {
      console.log('[VisualizationRenderer] Applying effects to layer:', layer.title);
      await this.effectsManager.applyEffectsToLayer(layer, visualizationResult);
      
      // Clear pending effects after application
      delete visualizationResult._pendingEffects;
      
    } catch (error) {
      console.error('[VisualizationRenderer] Error applying effects to layer:', error);
    }
  }

  /**
   * Clear all visual effects
   */
  clearEffects(): void {
    if (this.effectsManager) {
      this.effectsManager.clearEffects();
    }
  }

  /**
   * Update effects configuration
   */
  updateEffectsConfig(newConfig: Partial<EffectsManagerConfig>): void {
    if (this.effectsManager) {
      this.effectsManager.updateConfig(newConfig);
    }
  }

  /**
   * Get effects performance statistics
   */
  getEffectsStats(): any {
    return this.effectsManager?.getPerformanceStats() || null;
  }

  /**
   * Destroy effects manager and cleanup resources
   */
  destroy(): void {
    if (this.effectsManager) {
      this.effectsManager.destroy();
      this.effectsManager = null;
    }
    this.mapView = null;
  }

  /**
   * Get available visualization types
   */
  getAvailableVisualizationTypes(): string[] {
    return Array.from(this.renderers.keys());
  }

  /**
   * Check if a renderer exists for a visualization type
   */
  hasRendererForType(type: VisualizationType): boolean {
    return this.renderers.has(type) || this.renderers.has('default');
  }

  /**
   * Update visualization with new data or configuration
   */
  updateVisualization(
    currentVisualization: VisualizationResult, 
    newData: ProcessedAnalysisData, 
    endpoint: string
  ): VisualizationResult {
    try {
      // Use same visualization type as current
      const renderer = this.getRendererForType(currentVisualization.type);
      
      // Update configuration while preserving user customizations
      const updatedConfig = {
        ...currentVisualization.config,
        // Refresh data-dependent properties
        valueField: this.determineValueField(newData),
        labelField: this.determineLabelField(newData)
      };
      
      return renderer.render(newData, updatedConfig);
      
    } catch (error) {
      console.error(`[VisualizationRenderer] Error updating visualization:`, error);
      
      // Fall back to creating new visualization
      return this.createVisualization(newData, endpoint);
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private initializeRenderers(): void {
    // Register specialized renderers
    this.renderers.set('choropleth', new ChoroplethRenderer());
    this.renderers.set('cluster', new ClusterRenderer());
    this.renderers.set('multi-symbol', new CompetitiveRenderer());
    this.renderers.set('competitive', new CompetitiveRenderer());
    this.renderers.set('categorical', new CategoricalRenderer());
    this.renderers.set('heatmap', new HeatmapRenderer());
    this.renderers.set('graduated-symbols', new GraduatedSymbolRenderer());
    this.renderers.set('bivariate', new BivariateRenderer());
    
    // Register additional renderers for other visualization types
    // this.renderers.set('symbol', new SymbolRenderer());
    // this.renderers.set('network', new NetworkRenderer());
    // this.renderers.set('risk-gradient', new RiskGradientRenderer());
    
    // Default renderer for unspecified types
    this.renderers.set('default', new DefaultVisualizationRenderer());
    
    console.log(`[VisualizationRenderer] Initialized ${this.renderers.size} specialized renderers`);
  }

  private determineVisualizationType(data: ProcessedAnalysisData, defaultType: VisualizationType): VisualizationType {
    // Use data characteristics to optimize visualization type selection
    
    // For clustered data (new approach: ZIP codes with cluster assignments), always use cluster renderer
    if (data.isClustered) {
      console.log('[VisualizationRenderer] 🎯 Using CLUSTER renderer for clustered data (ZIP codes with cluster assignments)');
      console.log('[VisualizationRenderer] 🎯 Clustered data details:', {
        dataType: data.type,
        recordCount: data.records?.length,
        isClustered: data.isClustered
      });
      return 'cluster';
    }
    
    // For cluster analysis, always use cluster renderer (legacy spatial clustering)
    if (data.type === 'spatial_clustering' || data.clusterAnalysis) {
      console.log('[VisualizationRenderer] 🎯 Using CLUSTER renderer for spatial clustering');
      return 'cluster';
    }
    
    // HEAT MAP VISUALIZATION DETECTION
    // Check if data is suitable for density/activity heat mapping
    if (this.isHeatmapSuitable(data)) {
      console.log('[VisualizationRenderer] 🎯 Using HEATMAP renderer for density analysis');
      return 'heatmap';
    }
    
    // BIVARIATE VISUALIZATION DETECTION
    // Check if data has strong bivariate characteristics for comparative analysis
    if (this.isBivariateSuitable(data)) {
      console.log('[VisualizationRenderer] 🎯 Using BIVARIATE renderer for comparative analysis');
      return 'bivariate';
    }
    
    // GRADUATED SYMBOLS DETECTION
    // Check if data has multi-variable characteristics suitable for graduated symbols
    if (this.isGraduatedSymbolsSuitable(data)) {
      console.log('[VisualizationRenderer] 🎯 Using GRADUATED-SYMBOLS renderer for multi-variable data');
      return 'graduated-symbols';
    }
    
    // CATEGORICAL VISUALIZATION DETECTION
    // Check if data has strong categorical characteristics for market health, trends, etc.
    if (this.isCategoricalData(data)) {
      console.log('[VisualizationRenderer] 🎯 Using CATEGORICAL renderer for categorical data');
      return 'categorical';
    }
    
    // For competitive analysis, use choropleth renderer (same as strategic analysis)
    if (data.type === 'competitive_analysis' || data.competitiveAnalysis) {
      console.log('[VisualizationRenderer] 🎯 Using CHOROPLETH renderer for competitive analysis (same as strategic)');
      return 'choropleth';
    }
    
    // For strategic analysis, use choropleth renderer
    if (data.type === 'strategic_analysis') {
      console.log('[VisualizationRenderer] 🎯 Using CHOROPLETH renderer for strategic analysis');
      return 'choropleth';
    }
    
    // For demographic analysis, use choropleth renderer (same as strategic analysis)
    if (data.type === 'demographic_analysis') {
      console.log('[VisualizationRenderer] 🎯 Using CHOROPLETH renderer for demographic analysis (same as strategic)');
      console.log('[VisualizationRenderer] 🎯 Demographic analysis details:', {
        dataType: data.type,
        recordCount: data.records?.length,
        isClustered: data.isClustered,
        shouldHaveUsedClusterRenderer: !!data.isClustered
      });
      return 'choropleth';
    }
    
    // For categorical data with few unique values, consider categorical renderer
    if (this.isCategoricalData(data)) {
      return 'categorical';
    }
    
    // For continuous numeric data, use choropleth by default
    if (this.isContinuousData(data)) {
      return 'choropleth';
    }
    
    // Fall back to configured default
    return defaultType;
  }

  private getRendererForType(type: VisualizationType): VisualizationRendererStrategy {
    console.log(`[VisualizationRenderer] 🎯 Getting renderer for type: ${type}`);
    
    // Try to get specific renderer for type
    const renderer = this.renderers.get(type);
    if (renderer && renderer.supportsType(type)) {
      console.log(`[VisualizationRenderer] ✅ Found specific renderer for ${type}:`, renderer.constructor.name);
      return renderer;
    }
    
    // Fall back to default renderer
    console.log(`[VisualizationRenderer] ⚠️ Using default renderer for ${type}`);
    return this.renderers.get('default')!;
  }

  private createVisualizationConfig(
    data: ProcessedAnalysisData, 
    endpointConfig: any, 
    visualizationType: VisualizationType
  ): any {
    // Get visualization-specific configuration
    const vizConfig = this.configManager.getVisualizationConfig(endpointConfig.id);
    
    // Use enhanced geometry detection from GeometryDetector utility
    const geometryDetectionResult = GeometryDetector.determineRenderingStrategy(data);
    const geometryType = geometryDetectionResult.geometryType;
    
    return {
      // Base configuration
      colorScheme: this.determineColorScheme(data, visualizationType),
      opacity: 0.8,
      strokeWidth: 1,
      
      // Data field mappings
      valueField: this.determineValueField(data),
      labelField: this.determineLabelField(data),
      popupFields: this.determinePopupFields(data),
      
      // Classification settings
      classificationMethod: this.determineClassificationMethod(data, visualizationType),
      
      // Geometry information for renderer selection
      geometryType: geometryType,
      
      // Visualization-specific settings
      ...this.getTypeSpecificConfig(visualizationType),
      
      // Override with any configured settings
      ...vizConfig,
      
      // Performance optimizations
      maxRecords: vizConfig?.performance?.maxRecords || 10000
    };
  }

  private detectGeometryType(data: ProcessedAnalysisData): 'point' | 'polygon' | 'line' | 'unknown' {
    if (!data.records || data.records.length === 0) {
      console.log('[VisualizationRenderer] 🔍 detectGeometryType: No records found, returning unknown');
      return 'unknown';
    }
    
    console.log('[VisualizationRenderer] 🔍 detectGeometryType: Analyzing', data.records.length, 'records for geometry type');
    
    // ENHANCED PROPERTY DATA DETECTION: Check if this is property/business point data
    const isPropertyData = this.isPropertyPointData(data);
    if (isPropertyData) {
      console.log('[VisualizationRenderer] 🎯 detectGeometryType: Detected PROPERTY DATA - forcing POINT geometry for business/property locations');
      return 'point';
    }

    // Check for ZIP code or area-based analysis (should use polygons)
    const isAreaAnalysis = this.isAreaBasedAnalysis(data);
    if (isAreaAnalysis) {
      console.log('[VisualizationRenderer] 🎯 detectGeometryType: Detected AREA ANALYSIS - using POLYGON geometry for geographic regions');
      return 'polygon';
    }
    
    // Check first few records for explicit geometry type
    for (let i = 0; i < Math.min(5, data.records.length); i++) {
      const record = data.records[i];
      console.log(`[VisualizationRenderer] 🔍 detectGeometryType: Record ${i} (${record.area_name}):`, {
        hasProperties: !!record.properties,
        hasGeometry: !!(record.properties as any)?.geometry,
        geometryType: (record.properties as any)?.geometry?.type,
        hasCoordinates: !!record.coordinates,
        coordinatesType: Array.isArray(record.coordinates) ? 'array' : typeof record.coordinates,
        hasActualGeometry: !!record.geometry,
        actualGeometryType: (record.geometry as any)?.type
      });
      
      // Check in properties for geometry info
      const geometry = (record.properties as any)?.geometry;
      if (geometry?.type) {
        console.log(`[VisualizationRenderer] 🔍 detectGeometryType: Found geometry.type = ${geometry.type} in properties`);
        switch ((geometry.type as string).toLowerCase()) {
          case 'point':
          case 'multipoint':
            console.log('[VisualizationRenderer] 🔍 detectGeometryType: Returning POINT based on properties.geometry.type');
            return 'point';
          case 'polygon':
          case 'multipolygon':
            console.log('[VisualizationRenderer] 🔍 detectGeometryType: Returning POLYGON based on properties.geometry.type');
            return 'polygon';
          case 'linestring':
          case 'multilinestring':
            console.log('[VisualizationRenderer] 🔍 detectGeometryType: Returning LINE based on properties.geometry.type');
            return 'line';
        }
      }
      
      // Check actual geometry field
      if ((record.geometry as any)?.type) {
        console.log(`[VisualizationRenderer] 🔍 detectGeometryType: Found geometry.type = ${(record.geometry as any).type} in main geometry field`);
        switch (((record.geometry as any).type as string).toLowerCase()) {
          case 'point':
          case 'multipoint':
            console.log('[VisualizationRenderer] 🔍 detectGeometryType: Returning POINT based on main geometry.type');
            return 'point';
          case 'polygon':
          case 'multipolygon':
            console.log('[VisualizationRenderer] 🔍 detectGeometryType: Returning POLYGON based on main geometry.type');
            return 'polygon';
          case 'linestring':
          case 'multilinestring':
            console.log('[VisualizationRenderer] 🔍 detectGeometryType: Returning LINE based on main geometry.type');
            return 'line';
        }
      }
      
      // If no explicit geometry, infer from coordinates
      if (record.coordinates && Array.isArray(record.coordinates)) {
        console.log('[VisualizationRenderer] 🔍 detectGeometryType: Found coordinates array, inferring POINT');
        // Simple coordinates array suggests point data
        return 'point';
      }
    }
    
    // Default to polygon for geographic analysis
    console.log('[VisualizationRenderer] 🔍 detectGeometryType: No geometry info found, defaulting to POLYGON');
    return 'polygon';
  }

  /**
   * Detect if this is property/business point data that should be rendered as points
   */
  private isPropertyPointData(data: ProcessedAnalysisData): boolean {
    if (!data.records || data.records.length === 0) return false;

    // Check for property/business indicators in field names
    const sampleRecord = data.records[0];
    const allKeys = [
      ...Object.keys(sampleRecord),
      ...Object.keys(sampleRecord.properties || {})
    ].map(key => key.toLowerCase());

    // Property/business indicators
    const propertyIndicators = [
      'store', 'business', 'company', 'shop', 'retail', 'location',
      'address', 'property', 'building', 'establishment', 'venue',
      'franchise', 'branch', 'outlet', 'site', 'facility'
    ];

    const hasPropertyIndicators = propertyIndicators.some(indicator =>
      allKeys.some(key => key.includes(indicator))
    );

    // Check if area names look like business names vs geographic areas
    const areaNames = data.records.slice(0, 10).map(r => r.area_name?.toLowerCase() || '');
    const businessNamePattern = /(store|shop|#\d+|inc\.|ltd\.|llc|corp|restaurant|cafe|center|plaza)/;
    const hasBusinessNames = areaNames.some(name => businessNamePattern.test(name));

    // Check for coordinates that suggest individual locations vs area centroids
    const hasPointCoordinates = data.records.some(record => 
      record.coordinates && 
      Array.isArray(record.coordinates) && 
      record.coordinates.length === 2 &&
      !record.area_name?.match(/^\d{5}$/) // Not a ZIP code
    );

    console.log('[VisualizationRenderer] 🔍 isPropertyPointData analysis:', {
      hasPropertyIndicators,
      hasBusinessNames,
      hasPointCoordinates,
      sampleAreaNames: areaNames.slice(0, 3),
      result: hasPropertyIndicators || hasBusinessNames || hasPointCoordinates
    });

    return hasPropertyIndicators || hasBusinessNames || hasPointCoordinates;
  }

  /**
   * Detect if this is area-based analysis (ZIP codes, census tracts, etc.) that should use polygons
   */
  private isAreaBasedAnalysis(data: ProcessedAnalysisData): boolean {
    if (!data.records || data.records.length === 0) return false;

    // Check if area names are ZIP codes, census tracts, or geographic regions
    const areaNames = data.records.slice(0, 10).map(r => r.area_name || '');
    
    // ZIP code pattern
    const isZipCodes = areaNames.some(name => /^\d{5}(-\d{4})?$/.test(name)) || false;
    
    // Census tract pattern
    const isCensusTracts = areaNames.some(name => /tract|census|block|fsa/i.test(name)) || false;
    
    // Geographic region patterns
    const isGeographicRegions = areaNames.some(name => 
      /county|district|city|town|region|area|zone|neighborhood/i.test(name)
    ) || false;

    // Check for clustered data (ZIP codes with cluster assignments)
    const isClusteredZipData = (data.isClustered && 
      areaNames.some(name => /^\d{5}(-\d{4})?$/.test(name))) || false;

    console.log('[VisualizationRenderer] 🔍 isAreaBasedAnalysis analysis:', {
      isZipCodes,
      isCensusTracts,
      isGeographicRegions,
      isClusteredZipData,
      sampleAreaNames: areaNames.slice(0, 3),
      result: isZipCodes || isCensusTracts || isGeographicRegions || isClusteredZipData
    });

    return isZipCodes || isCensusTracts || isGeographicRegions || isClusteredZipData;
  }

  private determineColorScheme(data: ProcessedAnalysisData, type: VisualizationType): string {
    switch (type) {
      case 'cluster':
        return 'categorical';
      case 'multi-symbol':
      case 'competitive':
        return 'competitive';
      case 'risk-gradient':
        return 'red-to-green';
      case 'choropleth':
      default:
        return this.isPositiveMetric(data) ? 'green-to-red' : 'blue-to-red';
    }
  }

  private determineValueField(data: ProcessedAnalysisData): string {
    // For all analysis types that have a targetVariable, use it instead of 'value'
    // This ensures choropleth renderers use the correct field for all analysis types
    if (data.targetVariable) {
      console.log(`[VisualizationRenderer] Using targetVariable for ${data.type}: ${data.targetVariable}`);
      return data.targetVariable;
    }
    
    // Fallback to 'value' for legacy data or unspecified types
    return 'value';
  }

  private determineLabelField(data: ProcessedAnalysisData): string {
    // Primary label field is 'area_name'
    return 'area_name';
  }

  private determinePopupFields(data: ProcessedAnalysisData): string[] {
    const baseFields = ['area_name', 'value', 'rank', 'category'];
    
    if (data.records.length === 0) return baseFields;
    
    // Add important property fields
    const sampleRecord = data.records[0];
    const propertyKeys = Object.keys(sampleRecord.properties || {});
    
    const importantFields = propertyKeys
      .filter(key => 
        !key.includes('_raw') && 
        !key.includes('_internal') && 
        typeof sampleRecord.properties[key] !== 'object'
      )
      .slice(0, 5); // Limit to 5 additional fields
    
    return [...baseFields, ...importantFields];
  }

  private determineClassificationMethod(data: ProcessedAnalysisData, type: VisualizationType): string {
    // Use type-specific classification methods
    switch (type) {
      case 'cluster':
        return 'categorical';
      case 'multi-symbol':
        return 'graduated';
      case 'choropleth':
      default:
        return this.hasOutliers(data) ? 'quantile' : 'natural-breaks';
    }
  }

  private getTypeSpecificConfig(type: VisualizationType): any {
    const configs: Record<string, any> = {
      'choropleth': {
        symbolSize: undefined
      },
      'cluster': {
        symbolSize: 12,
        strokeWidth: 1.5
      },
      'multi-symbol': {
        symbolSize: 16,
        strokeWidth: 1
      },
      'competitive': {
        symbolSize: 16,
        strokeWidth: 1
      },
      'symbol': {
        symbolSize: 10
      },
      'heatmap': {
        opacity: 0.6,
        blurRadius: 15
      },
      'categorical': {
        strokeWidth: 1
      },
      'network': {
        nodeSize: 8,
        linkWidth: 2
      },
      'bivariate': {
        opacity: 0.7
      },
      'graduated-symbols': {
        symbolSize: 14
      },
      'risk-gradient': {
        opacity: 0.8,
        strokeWidth: 0.5
      }
    };
    
    return configs[type] || {};
  }

  private createFallbackVisualization(data: ProcessedAnalysisData, endpoint: string): VisualizationResult {
    // Create minimal valid visualization when specialized rendering fails
    const defaultRenderer = this.renderers.get('default')!;
    
    const fallbackConfig: any = {
      colorScheme: 'blue-to-red',
      opacity: 0.7,
      strokeWidth: 1,
      valueField: 'value',
      labelField: 'area_name',
      popupFields: ['area_name', 'value'],
      classificationMethod: 'equal-interval' as const
    };
    
    try {
      return defaultRenderer.render(data, fallbackConfig);
    } catch (error) {
      console.error(`[VisualizationRenderer] Fallback rendering also failed:`, error);
      
      // Return absolute minimal visualization
      return {
        type: 'choropleth',
        config: fallbackConfig,
        renderer: this.createMinimalRenderer(),
        popupTemplate: this.createMinimalPopupTemplate(),
        legend: this.createMinimalLegend(data)
      };
    }
  }

  private createMinimalRenderer(): any {
    return {
      type: 'simple',
      symbol: {
        type: 'simple-fill',
        color: [100, 150, 200, 0.5],
        outline: {
          color: 'transparent',
          width: 1
        }
      }
    };
  }

  private createMinimalPopupTemplate(): any {
    // Import standardized popup utils
    const { createStandardizedPopupTemplate } = require('@/utils/popup-utils');
    
    // Create standardized popup with bar chart and proper title
    const config = {
      titleFields: ['DESCRIPTION', 'ID', 'FSA_ID', 'NAME', 'OBJECTID'],
      barChartFields: ['mp30034a_b', 'mp30029a_b', 'strategic_value_score', 'value'],
      listFields: ['RANK', 'mp30034a_b_p', 'mp30029a_b_p'],
      visualizationType: 'unified-analysis'
    };
    
    return createStandardizedPopupTemplate(config);
  }

  private createMinimalLegend(data: ProcessedAnalysisData): any {
    // Use working legend creation from StrategicAnalysisProcessor
    const values = data.records.map(r => r.value).filter(v => !isNaN(v) && typeof v === 'number').sort((a, b) => a - b);
    
    if (values.length === 0) {
      return {
        title: data.targetVariable || 'Analysis Result',
        items: [],
        position: 'bottom-right'
      };
    }
    
    // Calculate quartile breaks like StrategicAnalysisProcessor
    const min = values[0];
    const max = values[values.length - 1];
    const q1 = values[Math.floor(values.length * 0.25)];
    const q2 = values[Math.floor(values.length * 0.5)];
    const q3 = values[Math.floor(values.length * 0.75)];
    const quartileBreaks = [min, q1, q2, q3, max];
    
    // Use strategic colors with 0.6 opacity like working code
    const strategicColors = [
      'rgba(215, 48, 39, 0.6)',   // #d73027 - Red (lowest)
      'rgba(253, 174, 97, 0.6)',  // #fdae61 - Orange  
      'rgba(166, 217, 106, 0.6)', // #a6d96a - Light Green
      'rgba(26, 152, 80, 0.6)'    // #1a9850 - Dark Green (highest)
    ];
    
    const legendItems = [];
    for (let i = 0; i < quartileBreaks.length - 1; i++) {
      const label = i === 0 
        ? `< ${quartileBreaks[i + 1].toFixed(1)}`
        : i === quartileBreaks.length - 2
        ? `> ${quartileBreaks[i].toFixed(1)}`
        : `${quartileBreaks[i].toFixed(1)} - ${quartileBreaks[i + 1].toFixed(1)}`;
        
      legendItems.push({
        label: label,
        color: strategicColors[i],
        minValue: quartileBreaks[i],
        maxValue: quartileBreaks[i + 1]
      });
    }
    
    return {
      title: data.targetVariable || 'Strategic Value Score',
      items: legendItems,
      position: 'bottom-right'
    };
  }

  // ============================================================================
  // DATA ANALYSIS UTILITIES
  // ============================================================================

  private isCategoricalData(data: ProcessedAnalysisData): boolean {
    if (data.records.length === 0) return false;
    
    const uniqueValues = new Set(data.records.map(r => r.value));
    return uniqueValues.size <= 10 && data.records.length > uniqueValues.size * 3;
  }

  private isContinuousData(data: ProcessedAnalysisData): boolean {
    if (data.records.length === 0) return false;
    
    const values = data.records.map(r => r.value).filter(v => typeof v === 'number' && !isNaN(v));
    const uniqueValues = new Set(values);
    
    return uniqueValues.size > 10 || uniqueValues.size === values.length;
  }

  private hasOutliers(data: ProcessedAnalysisData): boolean {
    const values = data.records.map(r => r.value).filter(v => typeof v === 'number' && !isNaN(v));
    
    if (values.length < 4) return false;
    
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    return values.some(v => v < lowerBound || v > upperBound);
  }

  private isPositiveMetric(data: ProcessedAnalysisData): boolean {
    // Determine if higher values are "better" based on target variable name
    const targetVar = data.targetVariable?.toLowerCase() || '';
    
    const positiveIndicators = [
      'performance', 'score', 'rating', 'quality', 'satisfaction',
      'success', 'efficiency', 'productivity', 'growth'
    ];
    
    const negativeIndicators = [
      'risk', 'error', 'failure', 'cost', 'problem', 'issue'
    ];
    
    const hasPositive = positiveIndicators.some(indicator => targetVar.includes(indicator));
    const hasNegative = negativeIndicators.some(indicator => targetVar.includes(indicator));
    
    return hasPositive && !hasNegative;
  }

  /**
   * Check if data is suitable for heat map visualization
   */
  private isHeatmapSuitable(data: ProcessedAnalysisData): boolean {
    if (!data.records || data.records.length < 10) { // Need sufficient points for heat map
      return false;
    }
    
    const firstRecord = data.records[0];
    if (!firstRecord.properties) {
      return false;
    }
    
    // Check for heat map intensity fields
    const heatmapFields = [
      'rental_demand',           // Rental demand intensity
      'market_activity',         // Market activity density
      'transaction_volume',      // Transaction density
      'property_density',        // Property concentration
      'foot_traffic',            // Activity density
      'population_density',      // Population density
      'risk_level',              // Risk concentration
      'liquidity_index'          // Market liquidity
    ];
    
    // Check if any heat map fields exist with good numeric distribution
    for (const field of heatmapFields) {
      if (field in firstRecord.properties) {
        const values = data.records.map(r => Number(r.properties[field]) || 0);
        const maxValue = Math.max(...values);
        const range = maxValue - Math.min(...values);
        
        if (range > 0 && maxValue > 0) {
          // Check if records have coordinate data (required for heat maps)
          const coordCount = data.records.filter(r => 
            r.coordinates && Array.isArray(r.coordinates) && 
            r.coordinates.length >= 2 && 
            r.coordinates[0] !== 0 && r.coordinates[1] !== 0
          ).length;
          
          if (coordCount / data.records.length >= 0.5) { // 50% have coordinates
            console.log(`[VisualizationRenderer] Found heat map field: ${field} with ${coordCount}/${data.records.length} coordinate points`);
            return true;
          }
        }
      }
    }
    
    return false;
  }
  
  /**
   * Check if data is suitable for bivariate visualization
   */
  private isBivariateSuitable(data: ProcessedAnalysisData): boolean {
    if (!data.records || data.records.length < 5) {
      return false;
    }
    
    // Check for comparative/bivariate analysis indicators
    const dataType = data.type || '';
    if (!dataType.includes('comparative') && !dataType.includes('cma') && !dataType.includes('comparison')) {
      return false;
    }
    
    const firstRecord = data.records[0];
    if (!firstRecord.properties) {
      return false;
    }
    
    // Look for bivariate variable pairs
    const bivariatePatterns = [
      ['price_level', 'market_strength'],        // CMA analysis
      ['price_comparison', 'market_position'],   // Market comparison
      ['property_price', 'income_level'],        // Affordability
      ['roi_potential', 'risk_level'],           // Investment analysis
      ['performance_score', 'stability_index']   // Performance vs stability
    ];
    
    for (const [xField, yField] of bivariatePatterns) {
      if (xField in firstRecord.properties && yField in firstRecord.properties) {
        // Verify both fields have good numeric distribution
        const xValues = data.records.map(r => Number(r.properties[xField]) || 0);
        const yValues = data.records.map(r => Number(r.properties[yField]) || 0);
        
        const xRange = Math.max(...xValues) - Math.min(...xValues);
        const yRange = Math.max(...yValues) - Math.min(...yValues);
        
        if (xRange > 0 && yRange > 0) {
          console.log(`[VisualizationRenderer] Found bivariate pair: ${xField} vs ${yField}`);
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Check if data is suitable for graduated symbols visualization
   */
  private isGraduatedSymbolsSuitable(data: ProcessedAnalysisData): boolean {
    if (!data.records || data.records.length === 0) {
      return false;
    }
    
    const firstRecord = data.records[0];
    if (!firstRecord.properties) {
      return false;
    }
    
    // Count available visual variables for multi-dimensional encoding
    let variableCount = 0;
    
    // Size variable candidates
    const sizeFields = ['price_confidence', 'growth_potential', 'roi_potential', 'confidence_score'];
    const sizeField = sizeFields.find(field => field in firstRecord.properties);
    if (sizeField) variableCount++;
    
    // Color variable candidates  
    const colorFields = ['risk_level', 'market_category', 'investment_timing', 'risk_assessment'];
    const colorField = colorFields.find(field => field in firstRecord.properties);
    if (colorField) variableCount++;
    
    // Opacity variable candidates
    const opacityFields = ['data_quality', 'certainty_score', 'reliability_index'];
    const opacityField = opacityFields.find(field => field in firstRecord.properties);
    if (opacityField) variableCount++;
    
    // Need at least 2 visual variables for graduated symbols to be worthwhile
    if (variableCount >= 2) {
      console.log(`[VisualizationRenderer] Found ${variableCount} visual variables for graduated symbols`);
      return true;
    }
    
    return false;
  }
}

/**
 * Default visualization renderer - handles basic rendering when no specialized renderer is available
 * Now uses proper quintile classification with equal feature distribution
 */
class DefaultVisualizationRenderer implements VisualizationRendererStrategy {
  supportsType(type: VisualizationType): boolean {
    return true; // Supports all types as fallback
  }

  render(data: ProcessedAnalysisData, config: any): VisualizationResult {
    console.log('[DefaultVisualizationRenderer] Using quintile-based rendering for bivariate endpoints');
    
    // Create quintile-based choropleth-style visualization
    const values = data.records.map(r => r.value).filter(v => !isNaN(v));
    
    if (values.length === 0) {
      throw new Error('No valid numeric data available for visualization');
    }

    // Calculate proper quintiles with equal feature distribution
    const quintileResult = calculateEqualCountQuintiles(values);
    const quintileBreaks = quintileResult.quintiles;
    
    const classBreakInfos = [];
    const colors = getQuintileColorScheme(); // Use standardized quintile colors
    
    // Create class breaks using quintile boundaries
    for (let i = 0; i < quintileBreaks.length - 1; i++) {
      const minValue = i === 0 ? Math.min(...values) : quintileBreaks[i];
      const maxValue = quintileBreaks[i + 1];
      
      classBreakInfos.push({
        minValue,
        maxValue,
        symbol: {
          type: 'simple-fill',
          color: colors[i],
          outline: {
            color: 'transparent',
            width: config.strokeWidth || 0.5
          }
        },
        label: `${minValue.toFixed(1)} - ${maxValue.toFixed(1)}`
      });
    }

    const renderer = {
      type: 'class-breaks',
      field: config.valueField || 'value',
      classBreakInfos,
      defaultSymbol: {
        type: 'simple-fill',
        color: [200, 200, 200, 0.3],
        outline: {
          color: '#CCCCCC',
          width: 0.5
        }
      }
    };

    const popupTemplate = {
      title: '{' + (config.labelField || 'area_name') + '}',
      content: [
        {
          type: 'fields',
          fieldInfos: [
            { fieldName: config.labelField || 'area_name', label: 'Area' },
            { fieldName: config.valueField || 'value', label: 'Value' }
          ]
        }
      ]
    };

    const legend = {
      title: data.targetVariable || 'Analysis Result',
      items: classBreakInfos.map(item => ({
        label: item.label,
        color: item.symbol.color,
        value: item.minValue
      })),
      position: 'bottom-right'
    };

    return {
      type: 'choropleth',
      config,
      renderer,
      popupTemplate,
      legend
    };
  }

  // ============================================================================
  // EFFECTS INTEGRATION METHODS
  // ============================================================================

  /**
   * Check if effects should be applied to this visualization
   */
  private shouldApplyEffects(result: VisualizationResult): boolean {
    if (!result.renderer || typeof result.renderer !== 'object') {
      return false;
    }
    
    // Check for effect flags in renderer
    const renderer = result.renderer as any;
    return !!(renderer._fireflyMode || renderer._visualEffects || renderer._dualVariable || result._enhancedEffects);
  }

  /**
   * Extract effect flags from renderer for later processing
   */
  private extractRendererFlags(renderer: any): any {
    if (!renderer || typeof renderer !== 'object') {
      return {};
    }
    
    return {
      fireflyMode: renderer._fireflyMode || false,
      visualEffects: renderer._visualEffects || {},
      dualVariable: renderer._dualVariable || false,
      useCentroids: renderer._useCentroids || false,
      enhancedEffects: renderer._enhancedEffects || {}
    };
  }

  /**
   * Check if data has strong categorical characteristics suitable for categorical rendering
   */
  private hasCategoricalData(data: ProcessedAnalysisData): boolean {
    if (!data.records || data.records.length === 0) {
      return false;
    }
    
    // Define categorical field candidates with priority
    const categoricalFields = [
      'market_health',                    // Market health categories
      'market_trend_direction',           // Trend directions  
      'price_stability',                  // Price stability levels
      'supply_demand_balance',            // Supply/demand categories
      'rental_market_strength',           // Rental market categories
      'yield_classification',             // Yield categories
      'tenant_market_profile',            // Tenant categories
      'investment_viability',             // Investment categories
      'prediction_reliability',           // Reliability categories
      'price_prediction_outlook',         // Prediction outlook
      'investment_timing',                // Timing categories
      'risk_assessment',                  // Risk categories
      'valuation_reliability',            // Valuation categories
      'competitive_position',             // Competitive categories
      'market_comparison_strength',       // Comparison categories
      'pricing_strategy_recommendation'   // Strategy categories
    ];
    
    // Check for categorical fields in the data
    for (const field of categoricalFields) {
      const categoricalScore = this.evaluateCategoricalField(data, field);
      if (categoricalScore >= 0.7) { // 70% threshold for categorical suitability
        console.log(`[VisualizationRenderer] 🎯 Found strong categorical field: ${field} (score: ${categoricalScore.toFixed(2)})`);
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Evaluate how suitable a field is for categorical visualization (0-1 score)
   */
  private evaluateCategoricalField(data: ProcessedAnalysisData, field: string): number {
    if (!data.records || data.records.length === 0) {
      return 0;
    }
    
    const firstRecord = data.records[0];
    if (!firstRecord.properties || !(field in firstRecord.properties)) {
      return 0;
    }
    
    // Collect all values for this field
    const values = data.records
      .map(record => record.properties[field])
      .filter(value => value !== null && value !== undefined);
    
    if (values.length === 0) {
      return 0;
    }
    
    // Check if values are primarily strings
    const stringValues = values.filter(value => typeof value === 'string' && value.length > 0);
    const stringRatio = stringValues.length / values.length;
    
    if (stringRatio < 0.8) { // At least 80% string values
      return 0;
    }
    
    // Check diversity of categories
    const uniqueValues = new Set(stringValues);
    const uniqueRatio = uniqueValues.size / stringValues.length;
    
    // Optimal categorical data has:
    // - Multiple categories (2-10 unique values)  
    // - Good diversity (not all same value)
    // - Reasonable number of categories (not too many)
    
    let score = 0;
    
    // Category count score (2-8 categories is optimal)
    const categoryCount = uniqueValues.size;
    if (categoryCount >= 2 && categoryCount <= 8) {
      score += 0.4; // 40% for good category count
    } else if (categoryCount > 8 && categoryCount <= 12) {
      score += 0.2; // 20% for acceptable category count
    }
    
    // Diversity score (categories should be well distributed)
    if (uniqueRatio >= 0.1) { // At least 10% diversity
      score += 0.3; // 30% for good diversity
    }
    
    // String quality score
    if (stringRatio >= 0.9) { // 90%+ string values
      score += 0.3; // 30% for high string quality
    } else if (stringRatio >= 0.8) {
      score += 0.2; // 20% for acceptable string quality
    }
    
    return Math.min(score, 1.0); // Cap at 1.0
  }

} 