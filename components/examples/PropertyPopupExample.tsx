import React, { useRef, useEffect } from 'react';
import MapView from '@arcgis/core/views/MapView';
import Map from '@arcgis/core/Map';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import RealEstatePointLayerManager, { RealEstateProperty } from '../map/RealEstatePointLayerManager';
import { useRealEstateLayerState } from '../../hooks/useRealEstateLayerState';

/**
 * Example component demonstrating enhanced property popup functionality
 */
const PropertyPopupExample: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapView = useRef<MapView | null>(null);

  // Sample property data
  const sampleProperties: RealEstateProperty[] = [
    {
      centris_no: 10001562,
      address: "123 Main Street, Montreal, QC",
      price: 450000,
      askedsold_price: 450000,
      st: 'AC',
      bedrooms_number: 3,
      bathrooms_number: 2,
      municipalityborough: 'Montreal',
      postal_code: 'H1A 1A1',
      latitude: 45.5017,
      longitude: -73.5673,
      property_type: 'Condo',
      year_built: 2015,
      living_area: 1200,
      lot_size: '0.1 acres'
    },
    {
      centris_no: 10001563,
      address: "456 Oak Avenue, Laval, QC",
      price: 650000,
      askedsold_price: 650000,
      st: 'SO',
      bedrooms_number: 4,
      bathrooms_number: 3,
      municipalityborough: 'Laval',
      postal_code: 'H7A 2B2',
      latitude: 45.5708,
      longitude: -73.7009,
      property_type: 'House',
      year_built: 2010,
      living_area: 1800,
      lot_size: '0.25 acres'
    }
  ];

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapView.current) return;

    const map = new Map({
      basemap: 'streets-navigation-vector'
    });

    const view = new MapView({
      container: mapRef.current,
      map: map,
      center: [-73.5673, 45.5017], // Montreal
      zoom: 10
    });

    mapView.current = view;

    return () => {
      if (mapView.current) {
        mapView.current.destroy();
        mapView.current = null;
      }
    };
  }, []);

  // Handle property selection
  const handlePropertySelect = (property: RealEstateProperty) => {
    console.log('Property selected:', property);
    // Handle property selection logic here
  };

  // Handle cluster selection
  const handleClusterSelect = (clusterId: string, properties: RealEstateProperty[]) => {
    console.log('Cluster selected:', clusterId, properties);
    // Handle cluster selection logic here
  };

  // Get layer state for external control
  const layerState = useRealEstateLayerState(mapView.current || undefined);

  return (
    <div style={{ width: '100%', height: '600px', position: 'relative' }}>
      {/* Map Container */}
      <div 
        ref={mapRef} 
        style={{ 
          width: '100%', 
          height: '100%',
          borderRadius: '8px',
          overflow: 'hidden'
        }} 
      />

      {/* Control Panel */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        background: 'white',
        padding: '16px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        minWidth: '200px'
      }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>
          Property Layers
        </h4>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={layerState.activeLayer?.visible || false}
              onChange={(e) => layerState.toggleLayerVisibility('active', e.target.checked)}
            />
            Active Listings ({sampleProperties.filter(p => p.st === 'AC').length})
          </label>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={layerState.soldLayer?.visible || false}
              onChange={(e) => layerState.toggleLayerVisibility('sold', e.target.checked)}
            />
            Sold Properties ({sampleProperties.filter(p => p.st === 'SO').length})
          </label>

          <button
            onClick={layerState.toggleClustering}
            style={{
              padding: '6px 12px',
              background: layerState.clusteringEnabled ? '#059669' : '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer',
              marginTop: '8px'
            }}
          >
            {layerState.clusteringEnabled ? 'Disable' : 'Enable'} Clustering
          </button>
        </div>

        {layerState.isLoading && (
          <div style={{ 
            marginTop: '12px', 
            fontSize: '12px', 
            color: '#6b7280',
            textAlign: 'center'
          }}>
            Loading properties...
          </div>
        )}
      </div>

      {/* Instructions */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        background: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: '12px',
        borderRadius: '6px',
        fontSize: '12px',
        maxWidth: '300px'
      }}>
        <strong>Instructions:</strong>
        <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px' }}>
          <li>Click on property markers to view enhanced popups</li>
          <li>Property popups show images, details, and action buttons</li>
          <li>Use "Zoom to Property" to navigate to a property</li>
          <li>Use "CMA Report" to request comparative market analysis</li>
        </ul>
      </div>

      {/* Real Estate Layer Manager */}
      {mapView.current && (
        <RealEstatePointLayerManager
          mapView={mapView.current}
          properties={sampleProperties}
          onPropertySelect={handlePropertySelect}
          onClusterSelect={handleClusterSelect}
          enableClustering={true}
          clusterConfig={{
            radius: 50,
            minPoints: 2,
            maxZoomLevel: 16
          }}
        />
      )}
    </div>
  );
};

export default PropertyPopupExample;