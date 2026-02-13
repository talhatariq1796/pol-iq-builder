import Graphic from '@arcgis/core/Graphic';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Polygon from '@arcgis/core/geometry/Polygon';
import Point from '@arcgis/core/geometry/Point';

// Helper function to convert GeoJSON geometry to ArcGIS geometry
function convertToArcGISGeometry(geometry: any): __esri.Geometry | null {
  if (!geometry) return null;

  const geometryType = geometry.type.toUpperCase();
  const spatialReference = geometry.spatialReference || { wkid: 4326 };

  try {
    if (geometryType === 'POLYGON') {
      // Use rings if available, otherwise use coordinates
      const rings = geometry.rings || geometry.coordinates;
      if (!rings || !Array.isArray(rings)) {
        console.warn('[MapHighlightManager] Invalid polygon rings:', rings);
        return null;
      }
      return new Polygon({
        rings: rings,
        spatialReference: spatialReference
      });
    }

    if (geometryType === 'POINT') {
      const coords = geometry.coordinates;
      if (!coords || !Array.isArray(coords) || coords.length < 2) {
        console.warn('[MapHighlightManager] Invalid point coordinates:', coords);
        return null;
      }
      return new Point({
        x: coords[0],
        y: coords[1],
        spatialReference: spatialReference
      });
    }

    console.warn('[MapHighlightManager] Unsupported geometry type:', geometryType);
    return null;
  } catch (error) {
    console.error('[MapHighlightManager] Error converting geometry:', error);
    return null;
  }
}

export const createHighlights = (
  currentMapView: __esri.MapView,
  features: any[]
) => {
  if (!features.length || !currentMapView) {
   /* console.log('[MapHighlightManager] Skipping highlight creation:', {
      hasFeatures: features.length > 0,
      hasMapView: !!currentMapView,
    });*/
    return;
  }

 // console.log('[MapHighlightManager] Starting highlight creation');

  try {
    const existingHighlightLayer = currentMapView.map.layers.find(
      (layer) => layer.title === 'Highlighted FSAs'
    );
    if (existingHighlightLayer) {
      currentMapView.map.remove(existingHighlightLayer);
    }

    const highlightLayer = new GraphicsLayer({
      title: 'Highlighted FSAs',
      listMode: 'hide',
      elevationInfo: {
        mode: 'on-the-ground',
      },
      opacity: 1,
      blendMode: 'normal'
    });
    // Disable popups for the highlight layer
    (highlightLayer as any).popupEnabled = false;

    currentMapView.map.add(highlightLayer);

    features.forEach((feature: any) => {
      if (feature.geometry) {
        // Convert GeoJSON geometry to ArcGIS geometry
        const arcgisGeometry = convertToArcGISGeometry(feature.geometry);
        if (!arcgisGeometry) {
          console.warn('[MapHighlightManager] Failed to convert geometry for feature:', feature.properties?.FSA_ID);
          return;
        }

        const shapValues = feature.properties?.shap_values || {};
        const hasShapValues = Object.keys(shapValues).length > 0;
        if (!hasShapValues) {
          // Skip features with no SHAP attribution so the highlight layer only emphasizes relevant areas
          return;
        }

        const totalShapValue = Object.values(shapValues).reduce(
          (sum: number, val: any) => sum + Math.abs(Number(val) || 0),
          0
        );
        const intensity = Math.min(1, (totalShapValue || 0) / 10);
        const color: [number, number, number, number] = [51, 168, 82, intensity * 0.4];

        const highlightGraphic = new Graphic({
          geometry: arcgisGeometry,
          symbol: {
            type: 'simple-fill',
            color: color,
            outline: {
              color: [51, 168, 82, 1],
              width: 2,
              style: 'solid',
            },
          },
          attributes: {
            ...feature.properties,
            shap_values: shapValues,
          },
          popupTemplate: null,
        });
        highlightLayer.add(highlightGraphic);
      }
    });

    if (highlightLayer.graphics.length > 0) {
      let extent: __esri.Extent | null = null;
      highlightLayer.graphics.forEach((graphic: __esri.Graphic) => {
        if (graphic.geometry?.extent) {
          const graphicExtent = graphic.geometry.extent;
          if (!extent) {
            extent = graphicExtent.clone();
          } else {
            extent.union(graphicExtent);
          }
        }
      });

      if (extent) {
        currentMapView.goTo({
          target: extent,
          padding: { top: 50, bottom: 50, left: 50, right: 50 },
        });
      }
    }
  } catch (error) {
    console.error('[MapHighlightManager] Error creating highlights:', error);
  }
}; 