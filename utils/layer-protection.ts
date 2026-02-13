// Global layer protection system during theme switches

interface LayerProtectionSystem {
  isActive: boolean;
  originalRemove?: (layer: __esri.Layer) => __esri.Layer | null | undefined;
  originalRemoveMany?: (layers: __esri.Layer[]) => __esri.Layer[];
  originalRemoveAll?: () => __esri.Layer[];
}

const layerProtection: LayerProtectionSystem = {
  isActive: false
};

export const activateLayerProtection = (mapView: __esri.MapView) => {
  if (!mapView?.map || layerProtection.isActive) return;
  
  console.log('🛡️ [LAYER PROTECTION] Activating layer protection');
  
  layerProtection.isActive = true;
  
  // Store original methods
  layerProtection.originalRemove = mapView.map.remove;
  layerProtection.originalRemoveMany = mapView.map.removeMany;
  layerProtection.originalRemoveAll = mapView.map.removeAll;
  
  // Override remove method
  mapView.map.remove = function(layer: any) {
    const isThemeSwitch = document.documentElement.hasAttribute('data-theme-switching') || 
                         (window as any).__themeTransitioning === true;
    
    if (isThemeSwitch) {
      console.log('🛡️ [LAYER PROTECTION] Blocked layer removal during theme switch:', {
        layerId: layer?.id,
        layerTitle: layer?.title,
        layerType: layer?.type
      });
      return layer; // Return layer unchanged
    }
    
    console.log('✅ [LAYER PROTECTION] Allowing layer removal (not theme switch):', layer?.id);
    return layerProtection.originalRemove!.call(this, layer);
  };
  
  // Override removeMany method
  mapView.map.removeMany = function(layers: any) {
    const isThemeSwitch = document.documentElement.hasAttribute('data-theme-switching') || 
                         (window as any).__themeTransitioning === true;
    
    if (isThemeSwitch) {
      console.log('🛡️ [LAYER PROTECTION] Blocked removeMany during theme switch, layers:', 
        Array.isArray(layers) ? layers.map(l => l?.id) : 'unknown');
      return layers; // Return layers unchanged
    }
    
    console.log('✅ [LAYER PROTECTION] Allowing removeMany (not theme switch)');
    return layerProtection.originalRemoveMany!.call(this, layers);
  };
  
  // Override removeAll method
  mapView.map.removeAll = function() {
    const isThemeSwitch = document.documentElement.hasAttribute('data-theme-switching') || 
                         (window as any).__themeTransitioning === true;
    
    if (isThemeSwitch) {
      console.log('🛡️ [LAYER PROTECTION] Blocked removeAll during theme switch');
      return []; // Return empty array to match expected return type
    }
    
    console.log('✅ [LAYER PROTECTION] Allowing removeAll (not theme switch)');
    return layerProtection.originalRemoveAll!.call(this);
  };
};

export const deactivateLayerProtection = (mapView: __esri.MapView) => {
  if (!mapView?.map || !layerProtection.isActive) return;
  
  console.log('🛡️ [LAYER PROTECTION] Deactivating layer protection');
  
  // Restore original methods
  if (layerProtection.originalRemove) {
    mapView.map.remove = layerProtection.originalRemove;
  }
  if (layerProtection.originalRemoveMany) {
    mapView.map.removeMany = layerProtection.originalRemoveMany;
  }
  if (layerProtection.originalRemoveAll) {
    mapView.map.removeAll = layerProtection.originalRemoveAll;
  }
  
  layerProtection.isActive = false;
  layerProtection.originalRemove = undefined;
  layerProtection.originalRemoveMany = undefined;
  layerProtection.originalRemoveAll = undefined;
};