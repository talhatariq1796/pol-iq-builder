import { DEFAULT_FILL_ALPHA } from "./constants";
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
import { VisualizationOptions, BaseVisualization } from './base-visualization';
import type Graphic from '@arcgis/core/Graphic';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import ColorVariable from '@arcgis/core/renderers/visualVariables/ColorVariable';
import { isFinite } from 'lodash';
import { Extent } from '@arcgis/core/geometry';
import { StandardizedLegendData } from '@/types/legend';

interface CompositeData {
  features: Graphic[];
  layerName: string;
}

export class CompositeVisualization extends BaseVisualization<CompositeData> {
  protected renderer: __esri.Renderer;
  protected title: string;

  constructor() {
    super();
    this.title = "Composite Analysis";
    this.renderer = new SimpleRenderer({
      symbol: new SimpleFillSymbol({
        color: [0, 0, 0, 0],
        outline: {
          color: [128, 128, 128, 0.5],
          width: "0.5px"
        }
      }),
      visualVariables: [new ColorVariable({
        field: "compositeIndex",
        stops: [
          { value: 0, color: [255, 255, 255, 0.5] },
          { value: 50, color: [255, 170, 0, DEFAULT_FILL_ALPHA] },
          { value: 100, color: [255, 0, 0, 0.9] }
        ],
        legendOptions: {
          title: "Composite Index",
          showLegend: false
        }
      })]
    });
  }

  private validateInputData(data: CompositeData): void {
    console.log('=== Validating Composite Input Data ===');
    const startTime = performance.now();

    const validation = {
      hasFeatures: !!data.features?.length,
      featureCount: data.features?.length || 0,
      hasValidGeometries: 0,
      hasValidAttributes: 0,
      validationTimeMs: 0
    };

    if (!validation.hasFeatures) {
      throw new Error('No features provided for composite visualization');
    }

    // Validate each feature
    data.features.forEach((feature, index) => {
      if (feature.geometry?.type) {
        validation.hasValidGeometries++;
      }
      if (feature.attributes && Object.keys(feature.attributes).length > 0) {
        validation.hasValidAttributes++;
      }
    });

    validation.validationTimeMs = performance.now() - startTime;
    console.log('Input validation complete:', validation);

    if (validation.hasValidGeometries === 0) {
      throw new Error('No features have valid geometries');
    }
  }

  async create(
    data: CompositeData,
    options: VisualizationOptions = {}
  ): Promise<{ layer: FeatureLayer; extent: __esri.Extent }> {
    const startTime = performance.now();
    console.log('=== Composite Visualization Create ===');

    try {
      // Validate input data
      this.validateInputData(data);

      // Create feature layer
      console.log('=== Creating Feature Layer ===');
      const layerStartTime = performance.now();

      const layer = new FeatureLayer({
        title: options.title || this.title,
        source: data.features,
        renderer: this.renderer,
        opacity: options.opacity || 0.7,
        visible: options.visible ?? true,
        popupTemplate: {
          title: "{DESCRIPTION}",
          content: [
            {
              type: "fields",
              fieldInfos: [
                {
                  fieldName: "compositeIndex",
                  label: "Composite Score",
                  format: { digitSeparator: true, places: 2 }
                }
              ]
            }
          ]
        }
      });

      await layer.load();
      
      console.log('Layer created successfully:', {
        id: layer.id,
        title: layer.title,
        loaded: layer.loaded,
        geometryType: layer.geometryType,
        features: data.features.length,
        creationTimeMs: (performance.now() - layerStartTime).toFixed(2)
      });

      // Calculate extent from features
      console.log('=== Calculating Extent ===');
      const extentStartTime = performance.now();
      
      let xmin = Infinity;
      let ymin = Infinity;
      let xmax = -Infinity;
      let ymax = -Infinity;
      let hasValidExtent = false;

      data.features.forEach(feature => {
        if (feature.geometry?.extent) {
          const extent = feature.geometry.extent;
          if (isFinite(extent.xmin) && isFinite(extent.ymin) && 
              isFinite(extent.xmax) && isFinite(extent.ymax)) {
            xmin = Math.min(xmin, extent.xmin);
            ymin = Math.min(ymin, extent.ymin);
            xmax = Math.max(xmax, extent.xmax);
            ymax = Math.max(ymax, extent.ymax);
            hasValidExtent = true;
          }
        }
      });

      // Use let instead of const to allow reassignment
      let extent = hasValidExtent ? new Extent({
        xmin,
        ymin,
        xmax,
        ymax,
        spatialReference: { wkid: 102100 }
      }) : layer.fullExtent;

      // Only log extent information if it exists
      if (extent) {
        console.log('Extent calculated:', {
          xmin: extent.xmin.toFixed(2),
          ymin: extent.ymin.toFixed(2),
          xmax: extent.xmax.toFixed(2),
          ymax: extent.ymax.toFixed(2),
          calculationTimeMs: (performance.now() - extentStartTime).toFixed(2)
        });
      } else {
        console.warn('No valid extent available for composite visualization');
      }

      const totalTime = performance.now() - startTime;
      console.log('=== Composite Visualization Complete ===');
      console.log('Performance summary:', {
        totalTimeMs: totalTime.toFixed(2),
        validationTimeMs: (layerStartTime - startTime).toFixed(2),
        layerTimeMs: (extentStartTime - layerStartTime).toFixed(2),
        extentTimeMs: (performance.now() - extentStartTime).toFixed(2)
      });

      // Ensure we never return a null extent
      if (!extent) {
        // Create a default extent if none exists
        extent = new Extent({
          xmin: -20000000,
          ymin: -20000000,
          xmax: 20000000,
          ymax: 20000000,
          spatialReference: { wkid: 102100 }
        });
        console.warn('Using default extent because actual extent was null or undefined');
      }

      return { layer, extent };
    } catch (error) {
      console.error('Error creating composite visualization:', error);
      throw error;
    }
  }

  getRenderer(): __esri.Renderer {
    return this.renderer;
  }

  getLegendInfo(): StandardizedLegendData {
    return {
      title: "Composite Index",
      type: "class-breaks",
      description: "Composite visualization showing index values",
      items: [
        { value: 0, color: [255, 255, 255, 0.5], label: "Low" },
        { value: 50, color: [255, 170, 0, DEFAULT_FILL_ALPHA], label: "Medium" },
        { value: 100, color: [255, 0, 0, 0.9], label: "High" }
      ].map(stop => ({
        label: stop.label,
        color: `rgba(${stop.color.join(',')})`,
        shape: 'square',
        size: 16
      }))
    };
  }
}