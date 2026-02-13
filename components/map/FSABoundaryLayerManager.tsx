import React, { useEffect, useState, useCallback } from 'react';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
import PopupTemplate from '@arcgis/core/PopupTemplate';
import Query from '@arcgis/core/rest/support/Query';
import * as geometryEngine from '@arcgis/core/geometry/geometryEngine';
import Polygon from '@arcgis/core/geometry/Polygon';
import type { RealEstateProperty } from './RealEstatePointLayerManager';

interface FSABoundaryLayerManagerProps {
  mapView: __esri.MapView;
  onAreaSelect?: (fsaCode: string, boundaryGeometry: __esri.Polygon, properties: any[]) => void;
  onSpatialAnalysis?: (selectedProperties: RealEstateProperty[], aggregatedMetrics: any) => void;
  realEstateProperties?: RealEstateProperty[];
  visible?: boolean;
}

interface FSAMetrics {
  totalProperties: number;
  activeListings: number;
  soldProperties: number;
  averagePrice: number;
  medianPrice: number;
  priceRange: { min: number; max: number };
  averageDaysOnMarket?: number;
  propertyTypes: Record<string, number>;
  municipalities: Record<string, number>;
}

const FSABoundaryLayerManager = ({
  mapView,
  onAreaSelect,
  onSpatialAnalysis,
  realEstateProperties = [],
  visible = true
}: FSABoundaryLayerManagerProps) => {
  const [fsaLayer, setFsaLayer] = useState<__esri.FeatureLayer | null>(null);
  const [selectedFSAs, setSelectedFSAs] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [spatialMetrics, setSpatialMetrics] = useState<Record<string, FSAMetrics>>({});

  // FSA boundary service URL
  const FSA_SERVICE_URL = 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_BH_QC_layers/FeatureServer/7';

  // Create FSA boundary symbol
  const createFSASymbol = () => {
    return new SimpleFillSymbol({
      color: [51, 153, 255, 0.1], // Light blue fill with transparency
      outline: new SimpleLineSymbol({
        color: [51, 153, 255, 0.8], // Solid blue outline
        width: 2,
        style: 'solid'
      })
    });
  };

  // Create selected FSA symbol
  const createSelectedFSASymbol = () => {
    return new SimpleFillSymbol({
      color: [255, 165, 0, 0.2], // Orange fill with transparency
      outline: new SimpleLineSymbol({
        color: [255, 165, 0, 1], // Solid orange outline
        width: 3,
        style: 'solid'
      })
    });
  };

  // Create popup template for FSA boundaries
  const createFSAPopupTemplate = (): PopupTemplate => {
    return new PopupTemplate({
      title: 'FSA: {CFSAUID}',
      content: [
        {
          type: 'fields',
          fieldInfos: [
            {
              fieldName: 'CFSAUID',
              label: 'FSA Code'
            },
            {
              fieldName: 'PRNAME',
              label: 'Province'
            },
            {
              fieldName: 'total_properties',
              label: 'Total Properties'
            },
            {
              fieldName: 'active_listings',
              label: 'Active Listings'
            },
            {
              fieldName: 'sold_properties',
              label: 'Sold Properties'
            },
            {
              fieldName: 'avg_price_display',
              label: 'Average Price'
            },
            {
              fieldName: 'median_price_display',
              label: 'Median Price'
            }
          ]
        }
      ],
      actions: [
        {
          type: 'button' as const,
          title: 'Select Area',
          id: 'select-fsa',
          className: 'esri-icon-cursor'
        },
        {
          type: 'button' as const,
          title: 'Analyze Properties',
          id: 'analyze-properties',
          className: 'esri-icon-analysis'
        },
        {
          type: 'button' as const,
          title: 'Generate Report',
          id: 'generate-report',
          className: 'esri-icon-documentation'
        }
      ]
    });
  };

  // Perform spatial analysis on properties within FSA
  const performSpatialAnalysis = useCallback(async (
    fsaGeometry: __esri.Polygon,
    fsaCode: string
  ): Promise<FSAMetrics> => {
    if (!realEstateProperties.length) {
      return {
        totalProperties: 0,
        activeListings: 0,
        soldProperties: 0,
        averagePrice: 0,
        medianPrice: 0,
        priceRange: { min: 0, max: 0 },
        propertyTypes: {},
        municipalities: {}
      };
    }

    // Filter properties within the FSA boundary
    const propertiesInFSA = realEstateProperties.filter(property => {
      if (!property.latitude || !property.longitude) return false;
      
      try {
        const point = {
          type: 'point',
          longitude: property.longitude,
          latitude: property.latitude,
          spatialReference: { wkid: 4326 }
        } as __esri.Point;
        
        return geometryEngine.intersects(point, fsaGeometry);
      } catch (error) {
        console.warn('Error checking point intersection:', error);
        return false;
      }
    });

    if (propertiesInFSA.length === 0) {
      return {
        totalProperties: 0,
        activeListings: 0,
        soldProperties: 0,
        averagePrice: 0,
        medianPrice: 0,
        priceRange: { min: 0, max: 0 },
        propertyTypes: {},
        municipalities: {}
      };
    }

    // Calculate metrics
    const activeListings = propertiesInFSA.filter(p => p.st === 'AC').length;
    const soldProperties = propertiesInFSA.filter(p => p.st === 'SO').length;
    
    // Price analysis
    const prices = propertiesInFSA
      .map(p => p.askedsold_price || 0)
      .filter(price => price > 0)
      .sort((a, b) => a - b);
    
    const averagePrice = prices.length > 0 ? prices.reduce((sum, price) => sum + price, 0) / prices.length : 0;
    const medianPrice = prices.length > 0 ? 
      prices.length % 2 === 0 ? 
        (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2 :
        prices[Math.floor(prices.length / 2)] : 0;
    
    const priceRange = {
      min: prices.length > 0 ? prices[0] : 0,
      max: prices.length > 0 ? prices[prices.length - 1] : 0
    };

    // Property type distribution
    const propertyTypes: Record<string, number> = {};
    propertiesInFSA.forEach(property => {
      const type = property.pt || 'Unknown';
      propertyTypes[type] = (propertyTypes[type] || 0) + 1;
    });

    // Municipality distribution
    const municipalities: Record<string, number> = {};
    propertiesInFSA.forEach(property => {
      const municipality = property.municipalityborough || 'Unknown';
      municipalities[municipality] = (municipalities[municipality] || 0) + 1;
    });

    const metrics: FSAMetrics = {
      totalProperties: propertiesInFSA.length,
      activeListings,
      soldProperties,
      averagePrice,
      medianPrice,
      priceRange,
      propertyTypes,
      municipalities
    };

    // Store metrics for this FSA
    setSpatialMetrics((prev: any) => ({ ...prev, [fsaCode]: metrics }));

    // Trigger spatial analysis callback
    if (onSpatialAnalysis) {
      onSpatialAnalysis(propertiesInFSA, metrics);
    }

    return metrics;
  }, [realEstateProperties, onSpatialAnalysis]);

  // Create FSA boundary layer
  const createFSALayer = useCallback((): __esri.FeatureLayer => {
    const renderer = new SimpleRenderer({
      symbol: createFSASymbol()
    });

    const layer = new FeatureLayer({
      url: FSA_SERVICE_URL,
      title: 'FSA Boundaries',
      visible: visible,
      renderer: renderer,
      popupTemplate: createFSAPopupTemplate(),
      outFields: ['*'],
      definitionExpression: "PRNAME IN ('Quebec', 'Ontario')" // Focus on Quebec and Ontario
    });

    // Add click handler for FSA selection
    layer.on('layerview-create', () => {
      mapView.on('click', async (event) => {
        try {
          const response = await mapView.hitTest(event, {
            include: [layer]
          });

          if (response.results.length > 0) {
            const graphic = (response.results[0] as any).graphic;
            const fsaCode = graphic.attributes.CFSAUID;
            const geometry = graphic.geometry as __esri.Polygon;

            // Perform spatial analysis
            const metrics = await performSpatialAnalysis(geometry, fsaCode);

            // Update graphic attributes with calculated metrics
            graphic.attributes = {
              ...graphic.attributes,
              total_properties: metrics.totalProperties,
              active_listings: metrics.activeListings,
              sold_properties: metrics.soldProperties,
              avg_price_display: `$${Math.round(metrics.averagePrice).toLocaleString()}`,
              median_price_display: `$${Math.round(metrics.medianPrice).toLocaleString()}`
            };

            // Toggle selection
            if (selectedFSAs.has(fsaCode)) {
              setSelectedFSAs((prev: any) => {
                const newSet = new Set(prev);
                newSet.delete(fsaCode);
                return newSet;
              });
              graphic.symbol = createFSASymbol();
            } else {
              setSelectedFSAs((prev: any) => new Set(prev).add(fsaCode));
              graphic.symbol = createSelectedFSASymbol();
            }

            // Trigger area selection callback
            if (onAreaSelect) {
              onAreaSelect(fsaCode, geometry, realEstateProperties.filter(p => {
                if (!p.latitude || !p.longitude) return false;
                const point = {
                  type: 'point',
                  longitude: p.longitude,
                  latitude: p.latitude,
                  spatialReference: { wkid: 4326 }
                } as __esri.Point;
                try {
                  return geometryEngine.intersects(point, geometry);
                } catch {
                  return false;
                }
              }));
            }
          }
        } catch (error) {
          console.error('Error handling FSA click:', error);
        }
      });
    });

    return layer;
  }, [mapView, visible, selectedFSAs, performSpatialAnalysis, onAreaSelect, realEstateProperties]);

  // Initialize FSA layer
  useEffect(() => {
    if (!mapView) return;

    setIsLoading(true);
    
    try {
      // Remove existing layer
      if (fsaLayer) {
        mapView.map.remove(fsaLayer);
      }

      // Create new FSA layer
      const newFSALayer = createFSALayer();
      mapView.map.add(newFSALayer);
      setFsaLayer(newFSALayer);

    } catch (error) {
      console.error('Error creating FSA layer:', error);
    } finally {
      setIsLoading(false);
    }
  }, [mapView, createFSALayer]);

  // Update layer visibility
  useEffect(() => {
    if (fsaLayer) {
      fsaLayer.visible = visible;
    }
  }, [fsaLayer, visible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (fsaLayer && mapView) {
        mapView.map.remove(fsaLayer);
      }
    };
  }, [fsaLayer, mapView]);

  // Query properties within selected FSAs
  const getPropertiesInSelectedFSAs = useCallback(async () => {
    if (!fsaLayer || selectedFSAs.size === 0) return [];

    try {
      const query = new Query({
        where: `CFSAUID IN ('${Array.from(selectedFSAs).join("', '")}')`,
        returnGeometry: true,
        outFields: ['*']
      });

      const results = await fsaLayer.queryFeatures(query);
      const allProperties: RealEstateProperty[] = [];

      for (const feature of results.features) {
        const geometry = feature.geometry as __esri.Polygon;
        const propertiesInFSA = realEstateProperties.filter(property => {
          if (!property.latitude || !property.longitude) return false;
          
          const point = {
            type: 'point',
            longitude: property.longitude,
            latitude: property.latitude,
            spatialReference: { wkid: 4326 }
          } as __esri.Point;
          
          try {
            return geometryEngine.intersects(point, geometry);
          } catch {
            return false;
          }
        });

        allProperties.push(...propertiesInFSA);
      }

      return allProperties;
    } catch (error) {
      console.error('Error querying properties in selected FSAs:', error);
      return [];
    }
  }, [fsaLayer, selectedFSAs, realEstateProperties]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedFSAs(new Set());
    if (fsaLayer) {
      // Reset all graphics to default symbol  
      // Note: FeatureLayer doesn't have graphics collection, this should use renderer instead
      console.log('FSA selection cleared');
    }
  }, [fsaLayer]);

  // Generate aggregated report for selected areas
  const generateAggregatedReport = useCallback(async () => {
    if (selectedFSAs.size === 0) return null;

    const allSelectedMetrics = Array.from(selectedFSAs)
      .map(fsaCode => spatialMetrics[fsaCode])
      .filter(Boolean);

    if (allSelectedMetrics.length === 0) return null;

    const aggregated = {
      totalFSAs: selectedFSAs.size,
      totalProperties: allSelectedMetrics.reduce((sum, m) => sum + m.totalProperties, 0),
      totalActiveListings: allSelectedMetrics.reduce((sum, m) => sum + m.activeListings, 0),
      totalSoldProperties: allSelectedMetrics.reduce((sum, m) => sum + m.soldProperties, 0),
      averagePrice: allSelectedMetrics.reduce((sum, m) => sum + m.averagePrice, 0) / allSelectedMetrics.length,
      medianPrice: allSelectedMetrics.reduce((sum, m) => sum + m.medianPrice, 0) / allSelectedMetrics.length,
      priceRange: {
        min: Math.min(...allSelectedMetrics.map(m => m.priceRange.min)),
        max: Math.max(...allSelectedMetrics.map(m => m.priceRange.max))
      }
    };

    return aggregated;
  }, [selectedFSAs, spatialMetrics]);

  return {
    fsaLayer,
    selectedFSAs,
    isLoading,
    spatialMetrics,
    clearSelection,
    getPropertiesInSelectedFSAs,
    generateAggregatedReport
  };
};

export default FSABoundaryLayerManager;
export type { FSABoundaryLayerManagerProps, FSAMetrics };
