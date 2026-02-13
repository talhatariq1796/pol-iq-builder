/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';

const MapLayerDebugger = () => {
  const [layers, setLayers] = useState<__esri.Layer[]>([]);
  const [selectedLayer, setSelectedLayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  // Get map view from the window (assuming it's accessible)
  const getMapView = () => {
    // This approach assumes mapView is accessible from the window
    // You'll need to adjust this based on how your app makes the map view available
    return (window as any).mapView || (window as any).__mapView || (document.querySelector('.esri-view') as any)?.view;
  };

  // Refresh the layer list
  const refreshLayers = () => {
    setLoading(true);
    const mapView = getMapView();
    
    if (!mapView || !mapView.map) {
      setMessage('Map view not found');
      setLoading(false);
      return;
    }
    
    const layerList = mapView.map.layers.toArray();
    setLayers(layerList);
    setLoading(false);
    setMessage(`Found ${layerList.length} layers`);
  };

  // Fix layer visibility
  const fixLayer = (layer: __esri.Layer) => {
    if (!layer) return;
    
    // Make layer visible
    layer.visible = true;
    layer.opacity = 1.0;
    
    // Remove scale constraints
    if ((layer as any).minScale !== undefined) (layer as any).minScale = 0;
    if ((layer as any).maxScale !== undefined) (layer as any).maxScale = 0;
    
    // Set list mode to show
    if (layer.listMode !== undefined) layer.listMode = "show";
    
    // Bring to front
    const mapView = getMapView();
    if (mapView && mapView.map) {
      mapView.map.reorder(layer, mapView.map.layers.length - 1);
    }
    
    setMessage(`Layer ${layer.id} fixed. Now visible with opacity 1.0`);
  };

  // Force redraw
  const forceRedraw = () => {
    const mapView = getMapView();
    if (!mapView) return;
    
    // Store current state
    const currentCenter = mapView.center.clone();
    const currentZoom = mapView.zoom;
    
    // Force redraw
    mapView.goTo({
      target: currentCenter,
      zoom: currentZoom - 0.1
    }, { duration: 100 }).then(() => {
      setTimeout(() => {
        mapView.goTo({
          target: currentCenter,
          zoom: currentZoom
        }, { duration: 100 });
        setMessage('Map redraw completed');
      }, 300);
    });
  };

  // Initialize
  useEffect(() => {
    refreshLayers();
    
    // Set up polling to check for new layers
    const intervalId = setInterval(refreshLayers, 5000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white border rounded-lg shadow-lg p-4 w-80 max-h-96 overflow-auto">
      <h3 className="text-lg font-semibold mb-2">Map Layer Debugger</h3>
      
      <div className="mb-4">
        <button 
          className="bg-blue-500 text-white px-3 py-1 rounded text-sm mr-2"
          onClick={refreshLayers}
        >
          Refresh Layers
        </button>
        <button 
          className="bg-green-500 text-white px-3 py-1 rounded text-sm"
          onClick={forceRedraw}
        >
          Force Redraw
        </button>
      </div>
      
      {message && (
        <div className="text-xs mb-2 p-2 bg-gray-100 rounded">{message}</div>
      )}
      
      {loading ? (
        <p className="text-sm text-gray-500">Loading layers...</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">{layers.length} layers found</p>
          
          {layers.map((layer) => (
            <div 
              key={layer.id} 
              className="border rounded p-2 text-xs"
            >
              <div className="flex justify-between items-center">
                <span className={`font-medium ${layer.visible ? 'text-green-600' : 'text-red-600'}`}>
                  {layer.title || layer.id || 'Unnamed Layer'}
                </span>
                <div className="space-x-1">
                  <button
                    className="bg-blue-100 hover:bg-blue-200 px-2 py-0.5 rounded"
                    onClick={() => fixLayer(layer)}
                  >
                    Fix
                  </button>
                  <button
                    className={`${layer.visible ? 'bg-red-100 hover:bg-red-200' : 'bg-green-100 hover:bg-green-200'} px-2 py-0.5 rounded`}
                    onClick={() => {
                      layer.visible = !layer.visible;
                      setMessage(`Layer ${layer.id} ${layer.visible ? 'shown' : 'hidden'}`);
                      refreshLayers();
                    }}
                  >
                    {layer.visible ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
              
              <div className="mt-1 text-gray-500">
                <div>Type: {layer.type}</div>
                <div>Opacity: {layer.opacity}</div>
                {(layer as any).geometryType && <div>Geometry: {(layer as any).geometryType}</div>}
              </div>
              
              <div className="mt-1">
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.1" 
                  value={layer.opacity}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    layer.opacity = parseFloat(e.target.value);
                    refreshLayers();
                  }}
                  className="w-full"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MapLayerDebugger;