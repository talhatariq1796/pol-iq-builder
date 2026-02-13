import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import Legend from "@arcgis/core/widgets/Legend";
import { createQuartileRenderer } from '@/utils/createQuartileRenderer';
import Field from "@arcgis/core/layers/support/Field";

interface FieldConfig {
  field: string;
  label: string;
}

export class ApplianceIndexLayerController {
  private static instance: ApplianceIndexLayerController;
  private view: __esri.MapView;
  private legend: __esri.Legend;
  private currentLayer: __esri.FeatureLayer | null = null;
  private legendObserver: MutationObserver | null = null;

  private constructor(view: __esri.MapView, legend: __esri.Legend) {
    if (!view) throw new Error('MapView is required');
    if (!legend) throw new Error('Legend is required');
    
    this.view = view;
    this.legend = legend;
    this.initializeLegendStyles();
    this.setupLegendObserver();
  }

  private setupLegendObserver(): void {
    this.legendObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
              if (node.classList.contains('esri-legend') && !this.currentLayer) {
                node.style.display = 'none';
                node.style.visibility = 'hidden';
                if (node.parentNode) {
                  node.parentNode.removeChild(node);
                }
              }
            }
          });
        }
      });
    });

    this.legendObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  private initializeLegendStyles(): void {
    const styleId = 'appliance-legend-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        /* Hide empty legends */
        .esri-legend:not(:has(.esri-legend__layer)):not(:has(.esri-legend__service)) {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
        }
        
        /* Show populated legends */
        .esri-legend {
          border-radius: 8px !important;
          background-color: white !important;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
        }
        
        /* Hide the "No legend" message specifically */
        .esri-legend__message {
          display: none !important;
        }
        
        .esri-legend__service {
          padding: 12px !important;
        }
        
        .esri-legend__layer-cell--symbols {
          display: flex !important;
          align-items: center !important;
          padding: 4px 0 !important;
        }
        
        .esri-legend__layer-cell:first-child {
          padding-right: 12px !important;
          min-width: 40px !important;
        }
        
        .esri-legend__symbol {
          display: block !important;
          min-width: 12px !important;
          width: 12px !important;
          height: 12px !important;
          border-radius: 50% !important;
          flex-shrink: 0 !important;
        }
        
        .esri-legend__layer-caption {
          display: none !important;
        }
        
        .esri-legend--card__section-header {
          display: none !important;
        }
      `;
      document.head.appendChild(style);
    }
  }

  static getInstance(view: __esri.MapView, legend: __esri.Legend): ApplianceIndexLayerController {
    if (!ApplianceIndexLayerController.instance) {
      ApplianceIndexLayerController.instance = new ApplianceIndexLayerController(view, legend);
    }
    return ApplianceIndexLayerController.instance;
  }

  private async setupLegend(layer: __esri.FeatureLayer): Promise<void> {
    this.clearLegend();
    
    this.legend = new Legend({
      view: this.view,
      layerInfos: [{
        layer: layer,
        title: "Appliance Index"
      }]
    });

    this.view.ui.add(this.legend, 'bottom-right');
  }

  private clearLegend(): void {
    // Remove from UI
    const existingLegend = this.view.ui.find('legend');
    if (existingLegend) {
      this.view.ui.remove(existingLegend);
    }

    // Destroy the current legend widget
    if (this.legend) {
      this.legend.destroy();
    }

    // Aggressively cleanup any remaining legend elements
    const legendElements = document.querySelectorAll('.esri-legend');
    legendElements.forEach(element => {
      if (element instanceof HTMLElement) {
        // First try to hide it
        element.style.display = 'none';
        element.style.visibility = 'hidden';
        element.innerHTML = '';
        
        // Then try to remove it
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        } else {
          element.remove();
        }
      }
    });

    // Also cleanup parent containers
    const components = document.querySelectorAll('.esri-component');
    components.forEach(component => {
      if (component instanceof HTMLElement) {
        const legendWithin = component.querySelector('.esri-legend');
        if (legendWithin) {
          component.style.display = 'none';
          component.style.visibility = 'hidden';
          if (component.parentNode) {
            component.parentNode.removeChild(component);
          } else {
            component.remove();
          }
        }
      }
    });
  }

  async setLayer(
    features: __esri.Graphic[],
    fields: FieldConfig[],
    title: string,
    description: string,
    fieldLabels: { [key: string]: string }
  ): Promise<void> {
    try {
      if (this.currentLayer) {
        this.clearLayer();
      }

      const validFeatures = features.filter(f => f.geometry && f.attributes);
      if (validFeatures.length === 0) {
        throw new Error("No valid features provided");
      }

      // Get geometry type from first feature
      if (!validFeatures.length || !validFeatures[0]?.geometry) {
        throw new Error("No valid features found");
      }

      const geometryType = validFeatures[0].geometry.type as "point" | "multipoint" | "polyline" | "polygon" | "multipatch";

      const layerFields = [
        new Field({
          name: "OBJECTID",
          alias: "OBJECTID",
          type: "oid"
        }),
        new Field({
          name: "DESCRIPTION",
          alias: "Description",
          type: "string"
        }),
        new Field({
          name: "compositeIndex",
          alias: "Appliance Index",
          type: "double"
        }),
        ...fields.map(field => new Field({
          name: field.field,
          alias: field.label,
          type: "double"
        }))
      ];

      const layer = new FeatureLayer({
        source: validFeatures,
        title: title,
        objectIdField: "OBJECTID",
        geometryType: geometryType,
        spatialReference: this.view.spatialReference,
        fields: layerFields,
        outFields: ["*"],
        popupTemplate: {
          title: "{DESCRIPTION}",
          content: [
            {
              type: "fields",
              fieldInfos: [
                {
                  fieldName: "compositeIndex",
                  label: "Appliance Index",
                  format: {
                    digitSeparator: true,
                    places: 2
                  }
                },
                ...fields.map(field => ({
                  fieldName: field.field,
                  label: fieldLabels[field.field],
                  format: {
                    digitSeparator: true,
                    places: 2
                  }
                }))
              ]
            }
          ]
        }
      });

      await layer.load();
      
      const renderer = await createQuartileRenderer({
        layer,
        field: "compositeIndex"
      });
      if (renderer) {
        layer.renderer = renderer.renderer;
      }

      await this.view.map.add(layer);
      this.currentLayer = layer;
      await this.setupLegend(layer);

    } catch (error) {
      console.error('Error in setLayer:', error);
      throw error;
    }
  }

  clearLayer(): void {
    if (this.currentLayer) {
      this.view.map.remove(this.currentLayer);
      this.currentLayer = null;
    }
    this.clearLegend();
  }

  getCurrentLayer(): __esri.FeatureLayer | null {
    return this.currentLayer;
  }

  destroy(): void {
    if (this.legendObserver) {
      this.legendObserver.disconnect();
      this.legendObserver = null;
    }
    this.clearLayer();
  }
}

export default ApplianceIndexLayerController;