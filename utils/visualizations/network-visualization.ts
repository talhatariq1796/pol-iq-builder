import { DEFAULT_FILL_ALPHA } from "./constants";
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Renderer from '@arcgis/core/renderers/Renderer';
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import Extent from '@arcgis/core/geometry/Extent';
import { BaseVisualization, BaseVisualizationData, VisualizationOptions, VisualizationResult } from './base-visualization';
import Color from '@arcgis/core/Color';
import { isFinite } from 'lodash';
import SpatialReference from '@arcgis/core/geometry/SpatialReference';
import Polyline from '@arcgis/core/geometry/Polyline';
import { StandardizedLegendData } from '@/types/legend';

export interface NetworkData extends BaseVisualizationData {
  routes: __esri.Graphic[];
  stops?: __esri.Graphic[];
  routeAttributes?: {
    [key: string]: string | number;
  }[];
}

export class NetworkVisualization extends BaseVisualization<NetworkData> {
  protected renderer: Renderer;
  protected title: string = 'Network Routes';

  constructor() {
    super();
    this.renderer = new SimpleRenderer({
      symbol: new SimpleLineSymbol({
        color: new Color([0, 122, 194, 0.8]),
        width: 3,
        style: 'solid'
      })
    });
  }

  private validateInputData(data: NetworkData): void {
    console.log('=== Validating Network Input Data ===');
    const startTime = performance.now();

    const validation = {
      hasRoutes: !!data.routes?.length,
      routeCount: data.routes?.length || 0,
      hasStops: !!data.stops?.length,
      stopCount: data.stops?.length || 0,
      hasRouteAttributes: !!data.routeAttributes?.length,
      routeAttributeCount: data.routeAttributes?.length || 0,
      validationTimeMs: 0
    };

    console.log('Input validation:', validation);

    if (!validation.hasRoutes) {
      throw new Error('No routes provided for network visualization');
    }

    if (validation.hasRouteAttributes && validation.routeAttributeCount !== validation.routeCount) {
      console.warn('Route attributes count does not match route count:', {
        routes: validation.routeCount,
        attributes: validation.routeAttributeCount
      });
    }

    validation.validationTimeMs = performance.now() - startTime;
    console.log('Input validation complete:', {
      validationTimeMs: validation.validationTimeMs.toFixed(2)
    });
  }

  private validateRoutes(routes: __esri.Graphic[]): void {
    console.log('=== Validating Routes ===');
    const startTime = performance.now();

    const validation = {
      total: routes.length,
      validGeometry: 0,
      validAttributes: 0,
      invalidGeometry: [] as number[],
      invalidAttributes: [] as number[],
      spatialReferences: new Set<number>(),
      geometryTypes: new Set<string>(),
      validationTimeMs: 0
    };

    routes.forEach((route, index) => {
      // Validate geometry
      if (route.geometry) {
        validation.validGeometry++;
        validation.geometryTypes.add(route.geometry.type);
        if (route.geometry.spatialReference?.wkid) {
          validation.spatialReferences.add(route.geometry.spatialReference.wkid);
        }
      } else {
        validation.invalidGeometry.push(index);
      }

      // Validate attributes
      if (route.attributes && Object.keys(route.attributes).length > 0) {
        validation.validAttributes++;
      } else {
        validation.invalidAttributes.push(index);
      }
    });

    console.log('Route validation results:', {
      ...validation,
      geometryTypes: Array.from(validation.geometryTypes),
      spatialReferences: Array.from(validation.spatialReferences),
      validationTimeMs: (performance.now() - startTime).toFixed(2)
    });

    if (validation.validGeometry === 0) {
      throw new Error('No routes have valid geometries');
    }

    if (validation.spatialReferences.size > 1) {
      console.warn('Multiple spatial references detected:', Array.from(validation.spatialReferences));
    }
  }

  private validateStops(stops: __esri.Graphic[]): void {
    console.log('=== Validating Stops ===');
    const startTime = performance.now();

    const validation = {
      total: stops.length,
      validGeometry: 0,
      validAttributes: 0,
      invalidGeometry: [] as number[],
      invalidAttributes: [] as number[],
      spatialReferences: new Set<number>(),
      geometryTypes: new Set<string>(),
      validationTimeMs: 0
    };

    stops.forEach((stop, index) => {
      // Validate geometry
      if (stop.geometry) {
        validation.validGeometry++;
        validation.geometryTypes.add(stop.geometry.type);
        if (stop.geometry.spatialReference?.wkid) {
          validation.spatialReferences.add(stop.geometry.spatialReference.wkid);
        }
      } else {
        validation.invalidGeometry.push(index);
      }

      // Validate attributes
      if (stop.attributes && Object.keys(stop.attributes).length > 0) {
        validation.validAttributes++;
      } else {
        validation.invalidAttributes.push(index);
      }
    });

    console.log('Stop validation results:', {
      ...validation,
      geometryTypes: Array.from(validation.geometryTypes),
      spatialReferences: Array.from(validation.spatialReferences),
      validationTimeMs: (performance.now() - startTime).toFixed(2)
    });

    if (validation.validGeometry === 0) {
      console.warn('No stops have valid geometries');
    }

    if (validation.spatialReferences.size > 1) {
      console.warn('Multiple spatial references detected:', Array.from(validation.spatialReferences));
    }
  }

  async create(data: NetworkData, options?: VisualizationOptions): Promise<VisualizationResult> {
    // Validate input data
    this.validateData(data);

    // Process features with field mapping
    const processedRoutes = data.routes.map(route => this.mapFeature(route));
    const processedStops = data.stops?.map(stop => this.mapFeature(stop));

    // Create features with route attributes
    const features = processedRoutes.map((route, index) => ({
      geometry: route.geometry,
      attributes: {
        OBJECTID: index + 1,
        ...(data.routeAttributes?.[index] || {}),
        ...route.attributes
      }
    }));

    // Initialize layer with processed features
    await this.initializeLayer({
      ...data,
      features
    }, {
      ...options,
      opacity: options?.opacity || 0.8
    });

    if (!this.layer || !this.extent) {
      throw new Error('Layer or extent not initialized');
    }

    return {
      layer: this.layer,
      extent: this.extent,
      renderer: this.renderer,
      legendInfo: this.getLegendInfo()
    };
  }

  getRenderer(): Renderer {
    return this.renderer;
  }

  getLegendInfo(): StandardizedLegendData {
    return {
      title: this.title,
      type: "class-breaks",
      description: "Network analysis showing connections",
      items: [{
        label: 'Network',
        color: 'rgba(0, 116, 217, DEFAULT_FILL_ALPHA)',
        shape: 'square',
        size: 16
      }]
    };
  }
} 