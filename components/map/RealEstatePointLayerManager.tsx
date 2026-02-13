import React, { useEffect, useRef, useState, useCallback } from 'react';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import GroupLayer from '@arcgis/core/layers/GroupLayer';
import Graphic from '@arcgis/core/Graphic';
import Point from '@arcgis/core/geometry/Point';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import UniqueValueRenderer from '@arcgis/core/renderers/UniqueValueRenderer';
import PopupTemplate from '@arcgis/core/PopupTemplate';
import { clusterManager, ClusterConfig } from '../../clustering/ClusterManager';
import type { GeospatialFeature } from '../../types/geospatial-ai-types';
import { getPropertyImageUrl } from '../../lib/utils/image-resolver';
import PropertyPopupManager from '../popup/PropertyPopupManager';

// Real estate property data structure
interface RealEstateProperty {
  centris_no: number;
  address: string;
  price: number | string;
  askedsold_price: number;
  st: 'AC' | 'SO' | string; // Active/Sold status
  bathrooms_number?: number;
  bedrooms_number?: number;
  municipalityborough?: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
  image_urls?: string[];
  has_image?: boolean;
  [key: string]: any;
}

interface RealEstatePointLayerManagerProps {
  mapView: __esri.MapView;
  properties: RealEstateProperty[];
  onPropertySelect?: (property: RealEstateProperty) => void;
  onClusterSelect?: (clusterId: string, properties: RealEstateProperty[]) => void;
  enableClustering?: boolean;
  clusterConfig?: Partial<ClusterConfig>;
}

// Hook return type for external access to layer state
interface RealEstateLayerState {
  activeLayer: FeatureLayer | null;
  soldLayer: FeatureLayer | null;
  propertyGroupLayer: GroupLayer | null;
  isLoading: boolean;
  clusteringEnabled: boolean;
  toggleClustering: () => void;
  toggleLayerVisibility: (layerType: 'active' | 'sold', visible: boolean) => void;
  clustersData: Map<string, RealEstateProperty[]>;
}

const RealEstatePointLayerManager = ({
  mapView,
  properties,
  onPropertySelect,
  onClusterSelect,
  enableClustering = true,
  clusterConfig = {}
}: RealEstatePointLayerManagerProps) => {
  const [activeLayer, setActiveLayer] = useState<__esri.FeatureLayer | null>(null);
  const [soldLayer, setSoldLayer] = useState<__esri.FeatureLayer | null>(null);
  const [propertyGroupLayer, setPropertyGroupLayer] = useState<__esri.GroupLayer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [clusteringEnabled, setClusteringEnabled] = useState(enableClustering);
  const clustersRef = useRef<Map<string, RealEstateProperty[]>>(new Map());

  // Default cluster configuration for real estate data
  const defaultClusterConfig: ClusterConfig = {
    strategy: 'adaptive',
    radius: 50, // 50 meters
    minPoints: 3,
    maxZoomLevel: 16,
    gridSize: 50,
    densityThreshold: 0.5,
    ...clusterConfig
  };

  // Create symbols for different property statuses
  const createPropertySymbols = () => {
    return {
      active: new SimpleMarkerSymbol({
        style: 'circle',
        color: [34, 197, 94, 0.8], // Green for active listings
        size: 8,
        outline: {
          color: [255, 255, 255, 0.9],
          width: 2
        }
      }),
      sold: new SimpleMarkerSymbol({
        style: 'circle',
        color: [239, 68, 68, 0.8], // Red for sold properties
        size: 8,
        outline: {
          color: [255, 255, 255, 0.9],
          width: 2
        }
      }),
      cluster: new SimpleMarkerSymbol({
        style: 'circle',
        color: [99, 102, 241, 0.9], // Blue for clusters
        size: 16,
        outline: {
          color: [255, 255, 255],
          width: 2
        }
      })
    };
  };

  // Create enhanced popup template with property image and standardized content
  const createPropertyPopupTemplate = (): PopupTemplate => {
    return new PopupTemplate({
      title: '{address}',
      content: [
        {
          type: 'custom',
          creator: (feature: any) => {
            const container = document.createElement('div');
            container.className = 'property-popup-container';
            container.style.cssText = 'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 320px;';
            
            const attrs = feature.graphic.attributes || {};
            const centrisNo = attrs.centris_no?.toString() || '';
            
            // Property image section
            if (centrisNo) {
              const imageUrl = getPropertyImageUrl(centrisNo, '/images/property-placeholder.jpg');
              const imageContainer = document.createElement('div');
              imageContainer.style.cssText = 'margin-bottom: 12px; border-radius: 8px; overflow: hidden; background: #f5f5f5;';
              
              const img = document.createElement('img');
              img.src = imageUrl;
              img.alt = `Property at ${attrs.address || 'Unknown Address'}`;
              img.style.cssText = 'width: 100%; height: 200px; object-fit: cover; display: block;';
              
              // Handle image load error
              img.onerror = () => {
                img.src = '/images/property-placeholder.jpg';
              };
              
              imageContainer.appendChild(img);
              container.appendChild(imageContainer);
            }
            
            // Property details section
            const detailsContainer = document.createElement('div');
            detailsContainer.style.cssText = 'display: grid; gap: 8px;';
            
            // Price (prominent display)
            if (attrs.price_display || attrs.askedsold_price) {
              const priceDiv = document.createElement('div');
              priceDiv.style.cssText = 'font-size: 18px; font-weight: 600; color: #059669; margin-bottom: 8px;';
              const price = attrs.price_display || (attrs.askedsold_price ? `$${attrs.askedsold_price.toLocaleString()}` : 'Price not available');
              priceDiv.textContent = price;
              detailsContainer.appendChild(priceDiv);
            }
            
            // Status badge
            if (attrs.status) {
              const statusDiv = document.createElement('div');
              const isActive = attrs.status === 'Active';
              statusDiv.style.cssText = `display: inline-block; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; margin-bottom: 8px; color: white; background-color: ${isActive ? '#059669' : '#dc2626'};`;
              statusDiv.textContent = attrs.status;
              detailsContainer.appendChild(statusDiv);
            }
            
            // Property features in a clean grid
            const featuresGrid = document.createElement('div');
            featuresGrid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; padding: 12px; background: #f8fafc; border-radius: 6px;';
            
            const features = [
              { label: 'Bedrooms', value: attrs.bedrooms_number },
              { label: 'Bathrooms', value: attrs.bathrooms_number },
              { label: 'Municipality', value: attrs.municipalityborough },
              { label: 'Postal Code', value: attrs.postal_code }
            ];
            
            features.forEach(feature => {
              if (feature.value) {
                const featureDiv = document.createElement('div');
                featureDiv.style.cssText = 'text-align: center;';
                
                const labelDiv = document.createElement('div');
                labelDiv.style.cssText = 'font-size: 11px; color: #6b7280; font-weight: 500;';
                labelDiv.textContent = feature.label;
                
                const valueDiv = document.createElement('div');
                valueDiv.style.cssText = 'font-size: 14px; color: #111827; font-weight: 600; margin-top: 2px;';
                valueDiv.textContent = feature.value.toString();
                
                featureDiv.appendChild(labelDiv);
                featureDiv.appendChild(valueDiv);
                featuresGrid.appendChild(featureDiv);
              }
            });
            
            detailsContainer.appendChild(featuresGrid);
            
            // Centris number (if available)
            if (centrisNo) {
              const centrisDiv = document.createElement('div');
              centrisDiv.style.cssText = 'font-size: 11px; color: #6b7280; text-align: center; padding-top: 8px; border-top: 1px solid #e5e7eb;';
              centrisDiv.textContent = `Centris #: ${centrisNo}`;
              detailsContainer.appendChild(centrisDiv);
            }
            
            container.appendChild(detailsContainer);
            return container;
          }
        }
      ],
      actions: [
        {
          title: 'View Details',
          id: 'view-details',
          className: 'esri-icon-review',
          type: 'button'
        },
        {
          title: 'Show Similar',
          id: 'show-similar',
          className: 'esri-icon-search',
          type: 'button'
        }
      ]
    });
  };

  // Convert properties to geospatial features
  const convertToGeospatialFeatures = (props: RealEstateProperty[]): GeospatialFeature[] => {
    return props
      .filter(prop => prop.latitude && prop.longitude)
      .map((prop, index) => ({
        id: prop.centris_no?.toString() || `property-${index}`,
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [prop.longitude!, prop.latitude!]
        },
        properties: {
          ...prop,
          price_display: typeof prop.price === 'number' ? 
            `$${prop.price.toLocaleString()}` : prop.price,
          status: prop.st === 'AC' ? 'Active' : prop.st === 'SO' ? 'Sold' : prop.st
        }
      }));
  };

  // Create graphics from properties
  const createGraphicsFromProperties = useCallback(async (
    props: RealEstateProperty[],
    status: 'AC' | 'SO'
  ): Promise<__esri.Graphic[]> => {
    const symbols = createPropertySymbols();
    const symbol = status === 'AC' ? symbols.active : symbols.sold;
    
    const filteredProps = props.filter(prop => prop.st === status && prop.latitude && prop.longitude);
    
    if (clusteringEnabled && filteredProps.length > 100) {
      // Use clustering for large datasets
      const features = convertToGeospatialFeatures(filteredProps);
      const viewExtent = mapView.extent;
      const clusters = await clusterManager.clusterFeatures(
        features,
        defaultClusterConfig,
        {
          zoom: mapView.zoom,
          extent: [viewExtent.xmin, viewExtent.ymin, viewExtent.xmax, viewExtent.ymax]
        }
      );
      
      // Store cluster data for later retrieval
      clusters.forEach(cluster => {
        clustersRef.current.set(cluster.id, cluster.features.map(f => f.properties as RealEstateProperty));
      });
      
      // Create cluster graphics
      return clusters.map(cluster => {
        const clusterSymbol = new SimpleMarkerSymbol({
          ...symbols.cluster,
          size: Math.min(Math.max(cluster.count * 2, 12), 32)
        });
        
        return new Graphic({
          geometry: new Point({
            longitude: cluster.centroid.x,
            latitude: cluster.centroid.y
          }),
          symbol: clusterSymbol,
          attributes: {
            cluster_id: cluster.id,
            count: cluster.count,
            status: status,
            is_cluster: true,
            avg_price: cluster.attributes?.price?.mean || 0,
            price_range: cluster.attributes?.price ?
              `$${Math.round(cluster.attributes.price.min).toLocaleString()} - $${Math.round(cluster.attributes.price.max).toLocaleString()}` : 'N/A'
          },
          popupTemplate: new PopupTemplate({
            title: `${status === 'AC' ? 'Active' : 'Sold'} Properties Cluster`,
            content: `
              <div class="cluster-popup">
                <p><strong>Properties:</strong> {count}</p>
                <p><strong>Average Price:</strong> $
                  {avg_price}
                </p>
                <p><strong>Price Range:</strong> {price_range}</p>
                <button class="expand-cluster-btn" data-cluster-id="{cluster_id}">View All Properties</button>
              </div>
            `,
            actions: [
              {
                title: 'Expand Cluster',
                id: 'expand-cluster',
                className: 'esri-icon-zoom-in-magnifying-glass',
                type: 'button'
              }
            ]
          })
        });
      });
    } else {
      // Create individual point graphics
      return filteredProps.map(prop => {
        return new Graphic({
          geometry: new Point({
            longitude: prop.longitude!,
            latitude: prop.latitude!
          }),
          symbol: symbol,
          attributes: {
            ...prop,
            price_display: typeof prop.price === 'number' ? 
              `$${prop.price.toLocaleString()}` : prop.price,
            status: status === 'AC' ? 'Active' : 'Sold',
            is_cluster: false
          },
          popupTemplate: createPropertyPopupTemplate()
        });
      });
    }
  }, [mapView, clusteringEnabled, defaultClusterConfig]);

  // Create feature layers
  const createRealEstateLayer = useCallback(async (
    status: 'AC' | 'SO',
    graphics: __esri.Graphic[]
  ): Promise<__esri.FeatureLayer> => {
    const symbols = createPropertySymbols();
    
    // Define fields for the feature layer
    const fields = [
      {
        name: 'OBJECTID',
        type: 'oid' as const,
        alias: 'Object ID'
      },
      {
        name: 'centris_no',
        type: 'integer' as const,
        alias: 'Centris Number'
      },
      {
        name: 'address',
        type: 'string' as const,
        alias: 'Address',
        length: 255
      },
      {
        name: 'price_display',
        type: 'string' as const,
        alias: 'Price',
        length: 50
      },
      {
        name: 'askedsold_price',
        type: 'double' as const,
        alias: 'Numeric Price'
      },
      {
        name: 'status',
        type: 'string' as const,
        alias: 'Status',
        length: 20
      },
      {
        name: 'bedrooms_number',
        type: 'integer' as const,
        alias: 'Bedrooms'
      },
      {
        name: 'bathrooms_number',
        type: 'integer' as const,
        alias: 'Bathrooms'
      },
      {
        name: 'municipalityborough',
        type: 'string' as const,
        alias: 'Municipality',
        length: 100
      },
      {
        name: 'postal_code',
        type: 'string' as const,
        alias: 'Postal Code',
        length: 10
      },
      {
        name: 'is_cluster',
        type: 'string' as const,
        alias: 'Is Cluster',
        length: 5
      },
      {
        name: 'cluster_id',
        type: 'string' as const,
        alias: 'Cluster ID',
        length: 50
      },
      {
        name: 'count',
        type: 'integer' as const,
        alias: 'Count'
      }
    ];

    // Create renderer based on clustering
    const renderer = new UniqueValueRenderer({
      field: 'is_cluster',
      uniqueValueInfos: [
        {
          value: 'true',
          symbol: symbols.cluster,
          label: 'Property Cluster'
        },
        {
          value: 'false',
          symbol: status === 'AC' ? symbols.active : symbols.sold,
          label: status === 'AC' ? 'Active Listing' : 'Sold Property'
        }
      ],
      defaultSymbol: symbols.active
    });

    const layer = new FeatureLayer({
      source: graphics,
      fields: fields,
      objectIdField: 'OBJECTID',
      geometryType: 'point',
      spatialReference: { wkid: 4326 },
      renderer: renderer,
      title: status === 'AC' ? 'Active Listings' : 'Sold Properties',
      id: status === 'AC' ? 'active-properties-layer' : 'sold-properties-layer',
      visible: true,
      popupEnabled: true
    });

    // TODO: Add proper click handler for cluster expansion and property selection
    // Currently handled by popup actions

    return layer;
  }, [onPropertySelect, onClusterSelect]);

  // Initialize layers when properties change
  useEffect(() => {
    const initializeLayers = async () => {
      if (!mapView || !properties.length) return;
      
      setIsLoading(true);
      
      try {
        console.log('🔄 Starting layer initialization...', {
          total_properties: properties.length,
          mapView_ready: !!mapView
        });
        
        // FIX 1: Explicit layer removal by ID
        const existingLayers = mapView.map.layers.filter(layer => 
          layer.id === 'real-estate-properties-group' || 
          layer.id === 'active-properties-layer' || 
          layer.id === 'sold-properties-layer'
        );
        
        if (existingLayers.length > 0) {
          console.log('🗑️ Removing existing layers:', existingLayers.map(l => l.id));
          existingLayers.forEach(layer => mapView.map.remove(layer));
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Remove existing property group layer (legacy approach)
        if (propertyGroupLayer) {
          mapView.map.remove(propertyGroupLayer);
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // Create graphics for active and sold properties
        const [activeGraphics, soldGraphics] = await Promise.all([
          createGraphicsFromProperties(properties, 'AC'),
          createGraphicsFromProperties(properties, 'SO')
        ]);
        
        console.log('📊 Layer graphics created:', {
          total_properties: properties.length,
          active_graphics: activeGraphics.length,
          sold_graphics: soldGraphics.length,
          active_properties: properties.filter(p => p.st === 'AC').length,
          sold_properties: properties.filter(p => p.st === 'SO').length
        });
        
        // FIX 2: Validate graphics arrays before layer creation
        if (activeGraphics.length === 0 && soldGraphics.length === 0) {
          console.warn('⚠️ No graphics to display - skipping layer creation');
          return;
        }
        
        // Create feature layers only for non-empty graphics arrays
        const layerPromises = [];
        let newActiveLayer: FeatureLayer | null = null;
        let newSoldLayer: FeatureLayer | null = null;
        
        if (activeGraphics.length > 0) {
          console.log('✅ Creating active properties layer with', activeGraphics.length, 'graphics');
          layerPromises.push(
            createRealEstateLayer('AC', activeGraphics).then(layer => {
              newActiveLayer = layer;
              return layer;
            })
          );
        } else {
          console.log('⚠️ Skipping active layer - no graphics');
        }
        
        if (soldGraphics.length > 0) {
          console.log('✅ Creating sold properties layer with', soldGraphics.length, 'graphics');
          layerPromises.push(
            createRealEstateLayer('SO', soldGraphics).then(layer => {
              newSoldLayer = layer;
              return layer;
            })
          );
        } else {
          console.log('⚠️ Skipping sold layer - no graphics');
        }
        
        // Wait for all layers to be created
        await Promise.all(layerPromises);
        
        // FIX 3: Create GroupLayer with proper layer ordering and visibility
        const layers: FeatureLayer[] = [];
        if (newSoldLayer) {
          (newSoldLayer as FeatureLayer).visible = true;
          layers.push(newSoldLayer as FeatureLayer);
          console.log('➕ Added sold layer to group');
        }
        if (newActiveLayer) {
          (newActiveLayer as FeatureLayer).visible = true;
          layers.push(newActiveLayer as FeatureLayer);
          console.log('➕ Added active layer to group');
        }
        
        if (layers.length === 0) {
          console.warn('⚠️ No layers to add to group');
          return;
        }
        
        const propertiesGroup = new GroupLayer({
          title: 'Properties',
          id: 'real-estate-properties-group',
          visible: true,
          visibilityMode: 'independent',
          layers: layers
        });
        
        console.log('🏗️ GroupLayer created:', {
          group_title: propertiesGroup.title,
          group_id: propertiesGroup.id,
          group_visible: propertiesGroup.visible,
          layers_count: propertiesGroup.layers.length,
          layers: propertiesGroup.layers.map(layer => ({
            title: layer.title,
            id: layer.id,
            type: layer.type,
            visible: layer.visible,
            graphics_count: (layer as any).source?.length || 'unknown'
          }))
        });
        
        // Add the group layer to the map
        mapView.map.add(propertiesGroup);
        console.log('🗺️ GroupLayer added to map');
        
        // FIX 4 & 5: Force visibility and refresh with multiple attempts
        setTimeout(() => {
          if (propertiesGroup) {
            propertiesGroup.visible = true;
            propertiesGroup.layers.forEach(layer => {
              layer.visible = true;
            });
            console.log('🔄 Forced layer visibility');
          }
        }, 50);
        
        // Debug: Log final map state
        setTimeout(() => {
          console.log('🔍 Final map layers state:');
          mapView.map.layers.forEach((layer, index) => {
            console.log(`Layer ${index}:`, {
              title: layer.title,
              type: layer.type,
              visible: layer.visible,
              id: layer.id,
              ...(layer.type === 'group' ? {
                children_count: (layer as any).layers?.length || 0,
                children: (layer as any).layers?.map((child: any) => ({
                  title: child.title,
                  visible: child.visible,
                  graphics: child.source?.length || 'unknown'
                })) || []
              } : {})
            });
          });
        }, 200);
        
        // Update state
        setActiveLayer(newActiveLayer);
        setSoldLayer(newSoldLayer);
        setPropertyGroupLayer(propertiesGroup);
        
        // FIX 4: Multiple refresh triggers with delays
        [100, 300, 500, 1000].forEach(delay => {
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('refresh-layer-list'));
            console.log(`🔄 Layer list refresh triggered (delay: ${delay}ms)`);
          }, delay);
        });
        
        console.log('✅ Layer initialization completed successfully');
        
      } catch (error) {
        console.error('❌ Error creating real estate layers:', error);
        console.error('Stack trace:', (error as Error).stack);
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeLayers();
  }, [mapView, properties, createGraphicsFromProperties, createRealEstateLayer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (propertyGroupLayer && mapView) {
        mapView.map.remove(propertyGroupLayer);
      }
    };
  }, [propertyGroupLayer, mapView]);

  // Toggle clustering
  const toggleClustering = useCallback(() => {
    setClusteringEnabled(!clusteringEnabled);
  }, [clusteringEnabled]);

  // Get layer visibility controls
  const toggleLayerVisibility = useCallback((layerType: 'active' | 'sold', visible: boolean) => {
    const layer = layerType === 'active' ? activeLayer : soldLayer;
    if (layer) {
      layer.visible = visible;
    }
  }, [activeLayer, soldLayer]);

  return (
    <>
      {/* Property Popup Managers */}
      {activeLayer && (
        <PropertyPopupManager
          mapView={mapView}
          layer={activeLayer}
          onPropertyZoom={(feature) => {
            // Enhanced zoom to property with animation
            if (feature.geometry?.type === 'point') {
              mapView.goTo({
                target: feature.geometry,
                zoom: 18
              }, { 
                duration: 1500,
                easing: 'ease-in-out'
              });
            }
          }}
          onPropertyCMA={(propertyParams) => {
            // Handle CMA button click - now receives PropertyParams directly
            console.log('[RealEstatePointLayerManager] CMA requested for property:', {
              centris_no: propertyParams.centrisNo,
              address: propertyParams.address,
              price: propertyParams.price
            });

            // Call parent CMA handler if provided - convert to RealEstateProperty format
            if (onPropertySelect) {
              onPropertySelect({
                centris_no: propertyParams.centrisNo || 0,
                address: propertyParams.address || '',
                price: propertyParams.price || 0,
                askedsold_price: propertyParams.price || 0
              } as RealEstateProperty);
            }

            // Dispatch custom event for other components to listen
            window.dispatchEvent(new CustomEvent('property-cma-requested', {
              detail: { property: propertyParams }
            }));
          }}
          onPopupOpen={(feature) => {
            const attrs = feature.attributes || {};
            console.log('[RealEstatePointLayerManager] Property popup opened:', attrs.address);
            
            if (onPropertySelect) {
              onPropertySelect(attrs as RealEstateProperty);
            }
          }}
        />
      )}
      
      {soldLayer && (
        <PropertyPopupManager
          mapView={mapView}
          layer={soldLayer}
          onPropertyZoom={(feature) => {
            // Enhanced zoom to property with animation
            if (feature.geometry?.type === 'point') {
              mapView.goTo({
                target: feature.geometry,
                zoom: 18
              }, { 
                duration: 1500,
                easing: 'ease-in-out'
              });
            }
          }}
          onPropertyCMA={(propertyParams) => {
            // Handle CMA button click for sold properties - now receives PropertyParams directly
            console.log('[RealEstatePointLayerManager] CMA requested for sold property:', {
              centris_no: propertyParams.centrisNo,
              address: propertyParams.address,
              price: propertyParams.price
            });

            // Call parent CMA handler if provided - convert to RealEstateProperty format
            if (onPropertySelect) {
              onPropertySelect({
                centris_no: propertyParams.centrisNo || 0,
                address: propertyParams.address || '',
                price: propertyParams.price || 0,
                askedsold_price: propertyParams.price || 0
              } as RealEstateProperty);
            }

            // Dispatch custom event for other components to listen
            window.dispatchEvent(new CustomEvent('property-cma-requested', {
              detail: { property: propertyParams }
            }));
          }}
          onPopupOpen={(feature) => {
            const attrs = feature.attributes || {};
            console.log('[RealEstatePointLayerManager] Sold property popup opened:', attrs.address);
            
            if (onPropertySelect) {
              onPropertySelect(attrs as RealEstateProperty);
            }
          }}
        />
      )}
    </>
  );
};

export default RealEstatePointLayerManager;
export type { RealEstateProperty, RealEstatePointLayerManagerProps };
