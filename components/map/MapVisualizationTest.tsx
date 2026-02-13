import React, { useState, useEffect } from 'react';
import RealEstateMapContainer, { RealEstateProperty } from './RealEstateMapContainer';
import { FSAMetrics } from './FSABoundaryLayerManager';

interface MapVisualizationTestProps {
  dataSource?: 'sample' | 'real';
}

const MapVisualizationTest: React.FC<MapVisualizationTestProps> = ({
  dataSource = 'sample'
}) => {
  const [properties, setProperties] = useState<RealEstateProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState<RealEstateProperty | null>(null);
  const [analysisData, setAnalysisData] = useState<any>(null);

  // Load sample data for testing
  const loadSampleData = (): RealEstateProperty[] => {
    // Generate sample properties around Montreal area
    const sampleProperties: RealEstateProperty[] = [
      {
        centris_no: 24450668,
        address: "206 Av. Adams, Pointe-Claire",
        price: "$950,000",
        askedsold_price: 950000,
        st: "AC",
        bathrooms_number: 3,
        bedrooms_number: 4,
        municipalityborough: "Pointe-Claire",
        postal_code: "H9R 5Y6",
        latitude: 45.4543,
        longitude: -73.8067,
        has_image: true
      },
      {
        centris_no: 13747059,
        address: "212 Av. Adams, Pointe-Claire",
        price: 1025000,
        askedsold_price: 1025000,
        st: "SO",
        bathrooms_number: 2,
        bedrooms_number: 3,
        municipalityborough: "Pointe-Claire",
        postal_code: "H9R 5Y6",
        latitude: 45.4545,
        longitude: -73.8065,
        has_image: false
      },
      {
        centris_no: 25123456,
        address: "123 Rue Sainte-Catherine, Montreal",
        price: "$750,000",
        askedsold_price: 750000,
        st: "AC",
        bathrooms_number: 2,
        bedrooms_number: 2,
        municipalityborough: "Montreal",
        postal_code: "H3H 1N1",
        latitude: 45.4945,
        longitude: -73.5848,
        has_image: true
      },
      {
        centris_no: 25789012,
        address: "456 Boulevard Saint-Laurent, Montreal",
        price: "$1,200,000",
        askedsold_price: 1200000,
        st: "AC",
        bathrooms_number: 3,
        bedrooms_number: 4,
        municipalityborough: "Montreal",
        postal_code: "H2X 2T6",
        latitude: 45.5088,
        longitude: -73.5695,
        has_image: true
      },
      {
        centris_no: 24987654,
        address: "789 Rue Crescent, Montreal",
        price: 890000,
        askedsold_price: 890000,
        st: "SO",
        bathrooms_number: 2,
        bedrooms_number: 3,
        municipalityborough: "Montreal",
        postal_code: "H3G 2B5",
        latitude: 45.5017,
        longitude: -73.5719,
        has_image: false
      }
    ];

    // Generate additional random properties for clustering demo
    const additionalProperties: RealEstateProperty[] = [];
    for (let i = 0; i < 50; i++) {
      const randomLat = 45.4 + Math.random() * 0.2; // Montreal area
      const randomLng = -73.9 + Math.random() * 0.6;
      const isActive = Math.random() > 0.3; // 70% active, 30% sold
      const price = Math.floor(300000 + Math.random() * 1500000);
      
      additionalProperties.push({
        centris_no: 20000000 + i,
        address: `${Math.floor(Math.random() * 9999)} Test Street ${i}`,
        price: isActive ? `$${price.toLocaleString()}` : price,
        askedsold_price: price,
        st: isActive ? "AC" : "SO",
        bathrooms_number: Math.floor(1 + Math.random() * 3),
        bedrooms_number: Math.floor(1 + Math.random() * 5),
        municipalityborough: Math.random() > 0.5 ? "Montreal" : "Laval",
        postal_code: `H${Math.floor(1 + Math.random() * 9)}${String.fromCharCode(65 + Math.floor(Math.random() * 26))} ${Math.floor(1 + Math.random() * 9)}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${Math.floor(Math.random() * 10)}`,
        latitude: randomLat,
        longitude: randomLng,
        has_image: Math.random() > 0.4
      });
    }

    return [...sampleProperties, ...additionalProperties];
  };

  // Load real data from JSON files
  const loadRealData = async (): Promise<RealEstateProperty[]> => {
    try {
      // Try to load from the data/real-estate folder
      const response = await fetch('/data/real-estate/properties.geojson');
      if (response.ok) {
        const geojsonData = await response.json();
        const features = geojsonData.features || [];
        
        // Transform GeoJSON features to properties
        return features.map((feature: any, index: number) => {
          const props = feature.properties;
          const coords = feature.geometry?.coordinates || [];
          
          return {
            ...props,
            // Extract coordinates from GeoJSON
            latitude: coords[1] || (45.4 + Math.random() * 0.2),
            longitude: coords[0] || (-73.9 + Math.random() * 0.6),
            // Map common field names
            centris_no: props.id || props.centris_no || index + 1,
            st: props.status || props.st || 'AC'
          };
        });
      } else {
        console.warn('Could not load real data, using sample data');
        return loadSampleData();
      }
    } catch (error) {
      console.warn('Error loading real data, using sample data:', error);
      return loadSampleData();
    }
  };

  // Initialize data
  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      try {
        const data = dataSource === 'real' ? await loadRealData() : loadSampleData();
        setProperties(data);
      } catch (error) {
        console.error('Error initializing data:', error);
        // Fallback to sample data
        setProperties(loadSampleData());
      } finally {
        setLoading(false);
      }
    };

    initializeData();
  }, [dataSource]);

  // Handle property selection
  const handlePropertySelect = (property: RealEstateProperty) => {
    setSelectedProperty(property);
    console.log('Selected property:', property);
  };

  // Handle area analysis
  const handleAreaAnalysis = (fsaCode: string, fsaProperties: RealEstateProperty[], metrics: FSAMetrics) => {
    console.log('Area analysis:', { fsaCode, propertiesCount: fsaProperties.length, metrics });
  };

  // Handle multi-target analysis
  const handleMultiTargetAnalysis = (data: any) => {
    setAnalysisData(data);
    console.log('Multi-target analysis data:', data);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading real estate data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Real Estate Map Visualization</h2>
          <p className="text-gray-600">
            {properties.length.toLocaleString()} properties | 
            {properties.filter(p => p.st === 'AC').length} active | 
            {properties.filter(p => p.st === 'SO').length} sold
          </p>
        </div>
        
        <div className="flex space-x-2">
          <button
            className={`px-4 py-2 rounded ${dataSource === 'sample' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            onClick={() => window.location.reload()}
          >
            Sample Data
          </button>
          <button
            className={`px-4 py-2 rounded ${dataSource === 'real' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            onClick={() => window.location.reload()}
          >
            Real Data
          </button>
        </div>
      </div>

      {/* Map */}
      <RealEstateMapContainer
        properties={properties}
        height={600}
        basemap="streets-navigation-vector"
        center={[-73.567256, 45.501689]} // Montreal
        zoom={10}
        onPropertySelect={handlePropertySelect}
        onAreaAnalysis={handleAreaAnalysis}
        onMultiTargetAnalysis={handleMultiTargetAnalysis}
        enableClustering={true}
        showFSABoundaries={true}
      />

      {/* Info panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Selected Property Info */}
        {selectedProperty && (
          <div className="bg-white p-4 rounded-lg shadow border">
            <h3 className="text-lg font-semibold mb-2">Selected Property</h3>
            <div className="space-y-2 text-sm">
              <p><strong>Address:</strong> {selectedProperty.address}</p>
              <p><strong>Price:</strong> {typeof selectedProperty.price === 'string' ? selectedProperty.price : `$${selectedProperty.price?.toLocaleString()}`}</p>
              <p><strong>Status:</strong> 
                <span className={`ml-1 px-2 py-1 rounded text-xs ${selectedProperty.st === 'AC' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {selectedProperty.st === 'AC' ? 'Active' : 'Sold'}
                </span>
              </p>
              <p><strong>Bedrooms:</strong> {selectedProperty.bedrooms_number || 'N/A'}</p>
              <p><strong>Bathrooms:</strong> {selectedProperty.bathrooms_number || 'N/A'}</p>
              <p><strong>Municipality:</strong> {selectedProperty.municipalityborough || 'N/A'}</p>
              <p><strong>Postal Code:</strong> {selectedProperty.postal_code || 'N/A'}</p>
            </div>
          </div>
        )}

        {/* Analysis Data */}
        {analysisData && (
          <div className="bg-white p-4 rounded-lg shadow border">
            <h3 className="text-lg font-semibold mb-2">Analysis Results</h3>
            <div className="space-y-2 text-sm">
              <p><strong>Type:</strong> {analysisData.type}</p>
              {analysisData.properties && (
                <p><strong>Properties:</strong> {analysisData.properties.length}</p>
              )}
              {analysisData.metrics && (
                <div className="mt-2">
                  <p><strong>Average Price:</strong> ${Math.round(analysisData.metrics.averagePrice || 0).toLocaleString()}</p>
                  <p><strong>Active Listings:</strong> {analysisData.metrics.activeListings || 0}</p>
                  <p><strong>Sold Properties:</strong> {analysisData.metrics.soldProperties || 0}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Map Features</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Green markers:</strong> Active listings (ST="AC")</li>
          <li>• <strong>Red markers:</strong> Sold properties (ST="SO")</li>
          <li>• <strong>Blue clusters:</strong> Grouped properties (when zoomed out)</li>
          <li>• <strong>FSA boundaries:</strong> Click to select postal areas and view aggregated metrics</li>
          <li>• <strong>Layer list:</strong> Toggle layers, adjust opacity, and access additional features</li>
          <li>• <strong>Clustering:</strong> Automatically adapts based on zoom level and point density</li>
        </ul>
      </div>
    </div>
  );
};

export default MapVisualizationTest;
export type { MapVisualizationTestProps };
