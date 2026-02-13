import type { GeospatialFeature } from '../types/geospatial-ai-types';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Graphic from '@arcgis/core/Graphic';
import { LayerConfig } from '../types/layers';
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import ColorVariable from '@arcgis/core/renderers/visualVariables/ColorVariable';
import PopupTemplate from '@arcgis/core/PopupTemplate';
import Polygon from '@arcgis/core/geometry/Polygon';
import Point from '@arcgis/core/geometry/Point';

export class CompositeLayerBuilder {
  static create(features: GeospatialFeature[], layerConfigs: LayerConfig[]): __esri.FeatureLayer {
    try {
      if (!features?.length) {
        console.warn('No features provided to composite layer builder');
        return new FeatureLayer({
          source: [],
          title: layerConfigs[0]?.name || "Results",
          objectIdField: "OBJECTID",
          geometryType: "polygon",
          spatialReference: { wkid: 102100 },
          fields: [{
            name: "OBJECTID",
            type: "oid",
            alias: "OBJECTID"
          }]
        });
      }

      const compositeFeatures = features
        .map(baseFeature => {
          try {
            // Create appropriate geometry based on type
            let geometry: __esri.Geometry;
            
            if (baseFeature.geometry.type.toLowerCase() === 'polygon') {
              geometry = new Polygon({
                rings: baseFeature.geometry.coordinates as number[][][],
                spatialReference: { wkid: 102100 }
              });
            } else if (baseFeature.geometry.type.toLowerCase() === 'point') {
              const coords = baseFeature.geometry.coordinates as number[];
              geometry = new Point({
                x: coords[0],
                y: coords[1],
                spatialReference: { wkid: 102100 }
              });
            } else {
              console.warn('Unsupported geometry type:', baseFeature.geometry.type);
              return null;
            }

            // Create the graphic with proper geometry
            return new Graphic({
              geometry,
              attributes: {
                OBJECTID: baseFeature.id,
                ...baseFeature.properties
              }
            });
          } catch (error) {
            console.warn('Error processing feature:', error);
            return null;
          }
        })
        .filter(Boolean) as __esri.Graphic[];

      return new FeatureLayer({
        source: compositeFeatures,
        title: layerConfigs[0]?.name || "Results",
        objectIdField: "OBJECTID",
        geometryType: features[0].geometry.type.toLowerCase() as "point" | "multipoint" | "polyline" | "polygon",
        spatialReference: { wkid: 102100 },
        fields: [{
          name: "OBJECTID",
          type: "oid",
          alias: "OBJECTID"
        }],
        popupTemplate: this.createPopupTemplate(),
        renderer: this.createRenderer()
      });
    } catch (error) {
      console.error('Error in layer creation:', error);
      throw error;
    }
  }

  private static createPopupTemplate(): __esri.PopupTemplate {
    return new PopupTemplate({
      title: "{DESCRIPTION}",
      content: [{
        type: "fields",
        fieldInfos: [{
          fieldName: "compositeValue",
          label: "Activity Index",
          format: {
            places: 2,
            digitSeparator: true
          }
        }]
      } as __esri.FieldsContent]
    });
  }

  private static createRenderer(): __esri.SimpleRenderer {
    return new SimpleRenderer({
      symbol: new SimpleFillSymbol({
        color: [0, 255, 0, 0.5],
        outline: {
          color: [0, 0, 0, 0.2],
          width: 0.5
        }
      }),
      visualVariables: [
        new ColorVariable({
          field: "compositeValue",
          stops: [
            { value: 0, color: [255, 255, 255, 0.5] },
            { value: 0.5, color: [255, 255, 0, 0.5] },
            { value: 1, color: [0, 255, 0, 0.5] }
          ]
        })
      ]
    });
  }
}