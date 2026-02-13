import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Renderer from '@arcgis/core/renderers/Renderer';
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import Extent from '@arcgis/core/geometry/Extent';
import { BaseVisualization, VisualizationOptions } from './base-visualization';
import { buffer, union, planarArea } from '@arcgis/core/geometry/geometryEngine';
import Color from '@arcgis/core/Color';
import Graphic from '@arcgis/core/Graphic';
import { isFinite } from 'lodash';
import SpatialReference from '@arcgis/core/geometry/SpatialReference';
import { StandardizedLegendData } from '@/types/legend';

export interface BufferData {
  sourceFeatures: __esri.Graphic[];
  distance: number;
  units: 'meters' | 'kilometers' | 'miles';
  dissolve?: boolean;
  features: __esri.Graphic[];
  layerName: string;
}

export class BufferVisualization extends BaseVisualization<BufferData> {
  protected renderer: Renderer;
  protected title: string;

  constructor() {
    super();
    this.renderer = new SimpleRenderer({
      symbol: new SimpleFillSymbol({
        color: new Color([65, 174, 118, 0.4]),
        outline: {
          color: [39, 121, 77, 0.8],
          width: 1
        }
      })
    });
    this.title = 'Buffer Zones';
  }

  private validateInputData(data: BufferData): void {
    console.log('=== Validating Buffer Input Data ===');
    const startTime = performance.now();

    const validation = {
      hasFeatures: !!data.sourceFeatures?.length,
      featureCount: data.sourceFeatures?.length || 0,
      hasDistance: typeof data.distance === 'number' && isFinite(data.distance),
      distance: data.distance,
      hasValidUnits: ['meters', 'kilometers', 'miles'].includes(data.units),
      units: data.units,
      dissolve: data.dissolve ?? true,
      validationTimeMs: 0
    };

    console.log('Input validation:', validation);

    if (!validation.hasFeatures) {
      throw new Error('No source features provided for buffer visualization');
    }

    if (!validation.hasDistance) {
      throw new Error('Invalid buffer distance provided');
    }

    if (!validation.hasValidUnits) {
      throw new Error(`Invalid units provided: ${data.units}. Must be one of: meters, kilometers, miles`);
    }

    validation.validationTimeMs = performance.now() - startTime;
    console.log('Input validation complete:', {
      validationTimeMs: validation.validationTimeMs.toFixed(2)
    });
  }

  private validateSourceFeatures(features: __esri.Graphic[]): void {
    console.log('=== Validating Source Features ===');
    const startTime = performance.now();

    const validation = {
      total: features.length,
      validGeometry: 0,
      validAttributes: 0,
      invalidGeometry: [] as number[],
      invalidAttributes: [] as number[],
      spatialReferences: new Set<number>(),
      geometryTypes: new Set<string>(),
      validationTimeMs: 0
    };

    features.forEach((feature, index) => {
      // Validate geometry
      if (feature.geometry) {
        validation.validGeometry++;
        validation.geometryTypes.add(feature.geometry.type);
        if (feature.geometry.spatialReference?.wkid) {
          validation.spatialReferences.add(feature.geometry.spatialReference.wkid);
        }
      } else {
        validation.invalidGeometry.push(index);
      }

      // Validate attributes
      if (feature.attributes && Object.keys(feature.attributes).length > 0) {
        validation.validAttributes++;
      } else {
        validation.invalidAttributes.push(index);
      }
    });

    console.log('Feature validation results:', {
      ...validation,
      geometryTypes: Array.from(validation.geometryTypes),
      spatialReferences: Array.from(validation.spatialReferences),
      validationTimeMs: (performance.now() - startTime).toFixed(2)
    });

    if (validation.validGeometry === 0) {
      throw new Error('No features have valid geometries');
    }

    if (validation.spatialReferences.size > 1) {
      console.warn('Multiple spatial references detected:', Array.from(validation.spatialReferences));
    }
  }

  async create(data: BufferData, options?: VisualizationOptions): Promise<{
    layer: FeatureLayer;
    extent: Extent;
  }> {
    const startTime = performance.now();
    console.log('=== Buffer Visualization Create ===');

    // Validate input data
    this.validateInputData(data);
    this.validateSourceFeatures(data.sourceFeatures);

    // Create buffer for each feature
    console.log('=== Creating Buffers ===');
    const bufferStartTime = performance.now();
    const bufferGeometries = data.sourceFeatures.map((feature, index) => {
      try {
        // Cast the geometry to any to bypass type checking for the buffer function
        // This is necessary because the ArcGIS API has complex geometry type requirements
        const geometry = feature.geometry as any;
        const bufferGeom = buffer(geometry, data.distance, data.units) as __esri.Polygon;
        if (!bufferGeom) {
          console.warn(`Failed to create buffer for feature ${index}`);
          return null;
        }
        return bufferGeom;
      } catch (error) {
        console.error(`Error creating buffer for feature ${index}:`, error);
        return null;
      }
    }).filter((geom): geom is __esri.Polygon => geom !== null);

    console.log('Buffer creation results:', {
      total: data.sourceFeatures.length,
      successful: bufferGeometries.length,
      failed: data.sourceFeatures.length - bufferGeometries.length,
      processingTimeMs: (performance.now() - bufferStartTime).toFixed(2)
    });

    if (bufferGeometries.length === 0) {
      throw new Error('Failed to create any valid buffer geometries');
    }

    // Create features array
    console.log('=== Creating Features ===');
    const featureStartTime = performance.now();
    let features: __esri.Graphic[];
    
    if (data.dissolve) {
      // Dissolve overlapping buffers into a single polygon
      console.log('Dissolving overlapping buffers...');
      const dissolvedGeometry = union(bufferGeometries) as __esri.Polygon;
      if (!dissolvedGeometry) {
        throw new Error('Failed to dissolve buffer geometries');
      }
      features = [new Graphic({
        geometry: dissolvedGeometry,
        attributes: {
          OBJECTID: 1,
          distance: data.distance,
          units: data.units,
          count: data.sourceFeatures.length,
          area: planarArea(dissolvedGeometry, "square-meters")
        }
      })];
    } else {
      // Keep individual buffer zones
      features = bufferGeometries.map((geometry, index) => new Graphic({
        geometry,
        attributes: {
          OBJECTID: index + 1,
          distance: data.distance,
          units: data.units,
          sourceId: data.sourceFeatures[index].attributes?.OBJECTID || index,
          area: planarArea(geometry, "square-meters")
        }
      }));
    }

    console.log('Features created:', {
      count: features.length,
      processingTimeMs: (performance.now() - featureStartTime).toFixed(2)
    });

    // Create feature layer
    console.log('=== Creating Feature Layer ===');
    const layerStartTime = performance.now();

    const layer = new FeatureLayer({
      title: options?.title || this.title,
      source: features,
      renderer: this.renderer,
      spatialReference: new SpatialReference({ wkid: 102100 }),
    });

    try {
      await layer.load();
      
      console.log('Layer created successfully:', {
        id: layer.id,
        title: layer.title,
        loaded: layer.loaded,
        geometryType: layer.geometryType,
        features: features.length,
        spatialReference: layer.spatialReference?.wkid,
        creationTimeMs: (performance.now() - layerStartTime).toFixed(2)
      });

      // Calculate extent from all buffer features
      console.log('=== Calculating Extent ===');
      const extentStartTime = performance.now();
      
      let xmin = Infinity;
      let ymin = Infinity;
      let xmax = -Infinity;
      let ymax = -Infinity;
      let hasValidExtent = false;

      features.forEach(feature => {
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

      // Change to let to allow reassignment
      let extent = hasValidExtent ? new Extent({
        xmin,
        ymin,
        xmax,
        ymax,
        spatialReference: { wkid: 102100 }
      }) : layer.fullExtent;

      // Add padding for better visualization if extent exists
      if (extent) {
        extent.expand(1.1);
      
        console.log('Extent calculated:', {
          xmin: extent.xmin.toFixed(2),
          ymin: extent.ymin.toFixed(2),
          xmax: extent.xmax.toFixed(2),
          ymax: extent.ymax.toFixed(2),
          width: (extent.xmax - extent.xmin).toFixed(2),
          height: (extent.ymax - extent.ymin).toFixed(2),
          spatialReference: extent.spatialReference.wkid,
          calculationTimeMs: (performance.now() - extentStartTime).toFixed(2)
        });
      } else {
        console.warn('No valid extent available for buffer visualization');
      }

      const totalTime = performance.now() - startTime;
      console.log('=== Buffer Visualization Complete ===');
      console.log('Performance summary:', {
        totalTimeMs: totalTime.toFixed(2),
        validationTimeMs: (bufferStartTime - startTime).toFixed(2),
        bufferTimeMs: (featureStartTime - bufferStartTime).toFixed(2),
        featureTimeMs: (layerStartTime - featureStartTime).toFixed(2),
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
    } catch (err) {
      console.error('Error creating layer:', err);
      const error = err as Error;
      throw new Error(`Failed to create buffer layer: ${error.message}`);
    }
  }

  getRenderer(): Renderer {
    return this.renderer;
  }

  getLegendInfo(): StandardizedLegendData {
    const symbol = (this.renderer as SimpleRenderer).symbol as SimpleFillSymbol;
    return {
      title: this.title,
      type: 'simple',
      description: '',
      items: [{
        label: 'Buffer Zone',
        color: `rgba(${symbol.color.toRgba().join(',')})`,
        shape: 'square',
        size: 16
      }]
    };
  }
} 