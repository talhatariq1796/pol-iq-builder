// Map Constraints Configuration
// Auto-generated on 2025-09-30T00:01:51.355Z
// This file defines geographic constraints to prevent panning outside project area

export interface MapConstraintsConfig {
  geometry: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
    spatialReference: {
      wkid: number;
    };
  };
  minZoom?: number;
  maxZoom?: number;
  snapToZoom?: boolean;
  rotationEnabled?: boolean;
}

// Project extent with 10% buffer to prevent panning outside data area
export const MAP_CONSTRAINTS: MapConstraintsConfig = {
  geometry: {
    xmin: -13969553,
    ymin: 3635704,
    xmax: -12532913,
    ymax: 5450884,
    spatialReference: {
      wkid: 102100
    }
  },
  // No zoom restrictions - users can zoom in/out freely
  minZoom: undefined,
  maxZoom: undefined,
  snapToZoom: false,
  rotationEnabled: false // Typically disabled for data analysis applications
};

// Original data extent (without buffer) for reference
export const DATA_EXTENT = {
  xmin: -13849833,
  ymin: 3786969,
  xmax: -12652633,
  ymax: 5299619,
  spatialReference: {
    wkid: 102100
  }
};

// Helper function to apply constraints to a MapView
// Note: This only constrains panning boundaries, does not change initial map center
export function applyMapConstraints(view: __esri.MapView): void {
  if (!view) {
    console.warn('[MapConstraints] No MapView provided');
    return;
  }
  
  // Create proper Extent object for constraints
  const constraintExtent = {
    type: "extent" as const,
    xmin: MAP_CONSTRAINTS.geometry.xmin,
    ymin: MAP_CONSTRAINTS.geometry.ymin,
    xmax: MAP_CONSTRAINTS.geometry.xmax,
    ymax: MAP_CONSTRAINTS.geometry.ymax,
    spatialReference: MAP_CONSTRAINTS.geometry.spatialReference
  };
  
  view.constraints = {
    geometry: constraintExtent,
    minZoom: MAP_CONSTRAINTS.minZoom,
    maxZoom: MAP_CONSTRAINTS.maxZoom,
    snapToZoom: MAP_CONSTRAINTS.snapToZoom,
    rotationEnabled: MAP_CONSTRAINTS.rotationEnabled
  };
  
  console.log('[MapConstraints] Applied geographic constraints to MapView (panning boundaries only)', {
    extent: constraintExtent,
    rotationEnabled: MAP_CONSTRAINTS.rotationEnabled
  });
}

// Helper function to zoom to data extent
export function zoomToDataExtent(view: __esri.MapView, options?: any): Promise<any> {
  if (!view) {
    console.warn('[MapConstraints] No MapView provided');
    return Promise.resolve();
  }
  
  // Create proper Extent object for zoom
  const dataExtent = {
    type: "extent" as const,
    xmin: DATA_EXTENT.xmin,
    ymin: DATA_EXTENT.ymin,
    xmax: DATA_EXTENT.xmax,
    ymax: DATA_EXTENT.ymax,
    spatialReference: DATA_EXTENT.spatialReference
  };
  
  return view.goTo(dataExtent, {
    duration: 1000,
    easing: 'ease-in-out',
    ...options
  });
}
