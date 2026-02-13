// services/arcgis-service-manager.ts
// ArcGIS Service Discovery and Management

import { ArcGISService, ServiceDerivedLayer, ArcGISField } from '@/types/project-config';

export interface ArcGISServiceInfo {
  name: string;
  serviceDescription: string;
  serviceItemId: string;
  hasVersionedData: boolean;
  maxRecordCount: number;
  supportedQueryFormats: string[];
  layers: ArcGISLayerInfo[];
  tables: ArcGISTableInfo[];
  spatialReference: {
    wkid: number;
    latestWkid?: number;
  };
  initialExtent: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
    spatialReference: { wkid: number };
  };
  fullExtent: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
    spatialReference: { wkid: number };
  };
  units: string;
}

export interface ArcGISLayerInfo {
  id: number;
  name: string;
  type: string;
  description?: string;
  geometryType?: string;
  minScale?: number;
  maxScale?: number;
  defaultVisibility?: boolean;
  extent?: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
    spatialReference: { wkid: number };
  };
  fields?: ArcGISField[];
  capabilities?: string;
}

export interface ArcGISTableInfo {
  id: number;
  name: string;
  type: string;
  description?: string;
}

export class ArcGISServiceManager {
  
  /**
   * Discover all layers from an ArcGIS FeatureServer
   * Example: https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Vetements_layers/FeatureServer
   */
  async discoverService(baseUrl: string): Promise<ArcGISServiceInfo> {
    const serviceUrl = `${baseUrl}?f=json`;
    
    try {
      console.log(`🔍 Discovering ArcGIS service: ${baseUrl}`);
      console.log(`🔍 Full URL: ${serviceUrl}`);
      
      const response = await fetch(serviceUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        // Add CORS mode
        mode: 'cors',
      });
      
      console.log(`📡 Response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Response error: ${errorText}`);
        throw new Error(`Failed to fetch service info: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const responseText = await response.text();
      console.log(`📄 Response text length: ${responseText.length}`);
      console.log(`📄 Response preview: ${responseText.substring(0, 200)}...`);
      
      const serviceInfo: any = JSON.parse(responseText);
      
      // Check if the response is an ArcGIS error
      if (serviceInfo.error) {
        console.error(`❌ ArcGIS service returned error:`, serviceInfo.error);
        throw new Error(`ArcGIS Service Error: ${serviceInfo.error.message || serviceInfo.error.details || 'Unknown service error'}`);
      }
      
      // Check if this is a valid service response
      if (!serviceInfo.layers && !serviceInfo.name) {
        console.error(`❌ Invalid service response:`, serviceInfo);
        throw new Error('Invalid service response: No layers or service name found');
      }
      
      console.log(`✅ Discovered service with ${serviceInfo.layers?.length || 0} layers`);
      console.log(`📊 Service info:`, {
        name: serviceInfo.name,
        layerCount: serviceInfo.layers?.length,
        hasError: 'error' in serviceInfo
      });
      
      return serviceInfo as ArcGISServiceInfo;
    } catch (error) {
      console.error('❌ Error discovering ArcGIS service:', error);
      throw new Error(`Failed to discover service: ${error}`);
    }
  }

  /**
   * Get detailed information about a specific layer
   */
  async getLayerInfo(baseUrl: string, layerId: number): Promise<ArcGISLayerInfo> {
    const layerUrl = `${baseUrl}/${layerId}?f=json`;
    
    try {
      const response = await fetch(layerUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch layer info: ${response.status} ${response.statusText}`);
      }
      
      const layerInfo: ArcGISLayerInfo = await response.json();
      return layerInfo;
    } catch (error) {
      console.error(`❌ Error getting layer ${layerId} info:`, error);
      throw error;
    }
  }

  /**
   * Convert ArcGIS service discovery into our service configuration
   */
  async createServiceConfiguration(
    baseUrl: string, 
    options: {
      id?: string;
      name?: string;
      description?: string;
      defaultGroup?: string;
      excludeLayerIds?: number[];
      includeOnlyLayerIds?: number[];
    } = {}
  ): Promise<ArcGISService> {
    
    const serviceInfo = await this.discoverService(baseUrl);
    
    // Extract service ID from URL if not provided
    const serviceId = options.id || this.extractServiceId(baseUrl);
    
    const service: ArcGISService = {
      id: serviceId,
      name: options.name || serviceInfo.name || `Service ${serviceId}`,
      description: options.description || serviceInfo.serviceDescription,
      baseUrl: baseUrl,
      serviceType: 'FeatureServer',
      metadata: {
        serviceItemId: serviceInfo.serviceItemId,
        maxRecordCount: serviceInfo.maxRecordCount,
        hasVersionedData: serviceInfo.hasVersionedData,
        spatialReference: serviceInfo.spatialReference?.wkid,
        extent: serviceInfo.fullExtent ? {
          xmin: serviceInfo.fullExtent.xmin,
          ymin: serviceInfo.fullExtent.ymin,
          xmax: serviceInfo.fullExtent.xmax,
          ymax: serviceInfo.fullExtent.ymax
        } : undefined
      },
      authentication: {
        type: 'none'
      },
      layerDiscovery: {
        autoDiscover: true,
        lastDiscovered: new Date().toISOString(),
        layerCount: serviceInfo.layers?.length || 0,
        excludeLayerIds: options.excludeLayerIds,
        includeOnlyLayerIds: options.includeOnlyLayerIds
      },
      bulkSettings: {
        defaultGroup: options.defaultGroup,
        defaultStatus: 'active',
        defaultOpacity: 0.8,
        applyToAll: true
      }
    };

    return service;
  }

  /**
   * Generate layer configurations from a service
   */
  async generateLayersFromService(
    service: ArcGISService,
    options: {
      groupPrefix?: string;
      namePrefix?: string;
      autoGenerateGroups?: boolean;
    } = {}
  ): Promise<ServiceDerivedLayer[]> {
    
    const serviceInfo = await this.discoverService(service.baseUrl);
    const layers: ServiceDerivedLayer[] = [];

    if (!serviceInfo.layers) {
      console.warn('⚠️ No layers found in service');
      return layers;
    }

    for (const layerInfo of serviceInfo.layers) {
      // Skip excluded layers
      if (service.layerDiscovery.excludeLayerIds?.includes(layerInfo.id)) {
        continue;
      }

      // Only include specified layers if includeOnlyLayerIds is set
      if (service.layerDiscovery.includeOnlyLayerIds && 
          !service.layerDiscovery.includeOnlyLayerIds.includes(layerInfo.id)) {
        continue;
      }

      // Get detailed layer information
      let detailedLayerInfo: ArcGISLayerInfo;
      try {
        detailedLayerInfo = await this.getLayerInfo(service.baseUrl, layerInfo.id);
      } catch (error) {
        console.warn(`⚠️ Could not get detailed info for layer ${layerInfo.id}, using basic info`);
        detailedLayerInfo = layerInfo;
      }

      const layerId = `${service.id}_layer_${layerInfo.id}`;
      
      const serviceLayer: ServiceDerivedLayer = {
        id: layerId,
        name: options.namePrefix ? `${options.namePrefix} ${layerInfo.name}` : layerInfo.name,
        type: this.mapArcGISTypeToLayerType(layerInfo.type),
        url: `${service.baseUrl}/${layerInfo.id}`,
        group: this.determineLayerGroup(layerInfo, service, options),
        description: layerInfo.description || detailedLayerInfo.description || '',
        status: service.bulkSettings.defaultStatus || 'active',
        fields: this.convertArcGISFields(detailedLayerInfo.fields || []),
        metadata: {
          source: 'arcgis_service',
          serviceId: service.id,
          layerIndex: layerInfo.id,
          geometryType: detailedLayerInfo.geometryType,
          capabilities: detailedLayerInfo.capabilities?.split(',') || [],
          scales: {
            min: detailedLayerInfo.minScale,
            max: detailedLayerInfo.maxScale
          },
          defaultVisibility: detailedLayerInfo.defaultVisibility
        },
        usage: {
          queryFrequency: 0,
          lastUsed: new Date().toISOString(),
          popularCombinations: []
        },
        serviceId: service.id,
        serviceLayerId: layerInfo.id,
        derivedFrom: {
          serviceUrl: service.baseUrl,
          layerIndex: layerInfo.id,
          autoGenerated: true,
          lastSynced: new Date().toISOString()
        },
        serviceMetadata: {
          name: layerInfo.name,
          description: layerInfo.description,
          geometryType: detailedLayerInfo.geometryType,
          fields: detailedLayerInfo.fields,
          capabilities: detailedLayerInfo.capabilities?.split(',') || []
        }
      };

      layers.push(serviceLayer);
    }

    console.log(`✅ Generated ${layers.length} layers from service ${service.id}`);
    return layers;
  }

  /**
   * Sync existing service-derived layers with the service
   */
  async syncServiceLayers(
    service: ArcGISService, 
    existingLayers: ServiceDerivedLayer[]
  ): Promise<{
    updated: ServiceDerivedLayer[];
    added: ServiceDerivedLayer[];
    removed: string[];
    errors: Array<{ layerId: string; error: string }>;
  }> {
    
    const result = {
      updated: [] as ServiceDerivedLayer[],
      added: [] as ServiceDerivedLayer[],
      removed: [] as string[],
      errors: [] as Array<{ layerId: string; error: string }>
    };

    try {
      // Get current service state
      const currentLayers = await this.generateLayersFromService(service);
      const existingLayerMap = new Map(existingLayers.map(l => [l.serviceLayerId, l]));
      const currentLayerMap = new Map(currentLayers.map(l => [l.serviceLayerId, l]));

      // Find added layers (in current but not in existing)
      for (const [layerId, layer] of currentLayerMap) {
        if (!existingLayerMap.has(layerId)) {
          result.added.push(layer);
        }
      }

      // Find removed layers (in existing but not in current)
      for (const [layerId, layer] of existingLayerMap) {
        if (!currentLayerMap.has(layerId)) {
          result.removed.push(layer.id);
        }
      }

      // Find updated layers (compare metadata)
      for (const [layerId, currentLayer] of currentLayerMap) {
        const existingLayer = existingLayerMap.get(layerId);
        if (existingLayer && this.hasLayerChanged(existingLayer, currentLayer)) {
          // Update the existing layer with new service metadata
          const updatedLayer = {
            ...existingLayer,
            name: currentLayer.name, // Update name from service
            serviceMetadata: currentLayer.serviceMetadata,
            derivedFrom: {
              ...existingLayer.derivedFrom,
              lastSynced: new Date().toISOString()
            }
          };
          result.updated.push(updatedLayer);
        }
      }

      console.log(`🔄 Sync complete: ${result.added.length} added, ${result.updated.length} updated, ${result.removed.length} removed`);

    } catch (error) {
      result.errors.push({
        layerId: 'service',
        error: `Failed to sync service: ${error}`
      });
    }

    return result;
  }

  /**
   * Bulk operations on service-derived layers
   */
  async bulkUpdateLayers(
    serviceId: string,
    layers: ServiceDerivedLayer[],
    updates: {
      group?: string;
      status?: 'active' | 'inactive' | 'deprecated';
      opacity?: number;
      metadata?: Record<string, any>;
    }
  ): Promise<ServiceDerivedLayer[]> {
    
    const serviceLayers = layers.filter(l => l.serviceId === serviceId);
    
    return serviceLayers.map(layer => ({
      ...layer,
      ...(updates.group && { group: updates.group }),
      ...(updates.status && { status: updates.status }),
      ...(updates.metadata && { 
        metadata: { ...layer.metadata, ...updates.metadata }
      })
    }));
  }

  // Helper methods
  private extractServiceId(baseUrl: string): string {
    const match = baseUrl.match(/\/([^\/]+)\/FeatureServer/);
    return match ? match[1] : `service_${Date.now()}`;
  }

  private mapArcGISTypeToLayerType(arcgisType: string): string {
    const typeMap: Record<string, string> = {
      'Feature Layer': 'feature',
      'Table': 'table',
      'Raster Layer': 'raster',
      'Group Layer': 'group'
    };
    return typeMap[arcgisType] || 'feature';
  }

  private determineLayerGroup(
    layerInfo: ArcGISLayerInfo, 
    service: ArcGISService, 
    options: { groupPrefix?: string; autoGenerateGroups?: boolean }
  ): string {
    
    if (service.bulkSettings.defaultGroup) {
      return service.bulkSettings.defaultGroup;
    }

    if (options.autoGenerateGroups) {
      // Try to group by common prefixes or patterns in layer names
      const name = layerInfo.name.toLowerCase();
      
      if (name.includes('population') || name.includes('demographic')) {
        return 'demographics-group';
      }
      if (name.includes('income') || name.includes('wealth') || name.includes('disposable')) {
        return 'income-group';
      }
      if (name.includes('housing') || name.includes('household')) {
        return 'housing-group';
      }
      if (name.includes('spending') || name.includes('bought') || name.includes('spent')) {
        return 'spending-group';
      }
      if (name.includes('sport') || name.includes('athletic') || name.includes('shoes')) {
        return 'sports-group';
      }
    }

    return options.groupPrefix ? `${options.groupPrefix}-group` : 'service-layers';
  }

  private convertArcGISFields(arcgisFields: ArcGISField[]): any[] {
    return arcgisFields.map(field => ({
      name: field.name,
      alias: field.alias || field.name,
      type: field.type,
      length: field.length,
      nullable: field.nullable,
      editable: field.editable
    }));
  }

  private hasLayerChanged(existing: ServiceDerivedLayer, current: ServiceDerivedLayer): boolean {
    // Compare key metadata to detect changes
    return (
      existing.name !== current.name ||
      existing.serviceMetadata?.description !== current.serviceMetadata?.description ||
      JSON.stringify(existing.serviceMetadata?.fields) !== JSON.stringify(current.serviceMetadata?.fields)
    );
  }
}

export const arcgisServiceManager = new ArcGISServiceManager(); 