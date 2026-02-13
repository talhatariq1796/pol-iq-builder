import { DEFAULT_FILL_ALPHA } from "./constants";
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import { VisualizationOptions, BaseVisualization, BaseVisualizationData, VisualizationResult } from './base-visualization';
import Color from '@arcgis/core/Color';
import { isFinite } from 'lodash';
import SpatialReference from '@arcgis/core/geometry/SpatialReference';
import Extent from '@arcgis/core/geometry/Extent';
import { StandardizedLegendData } from '@/types/legend';

interface ClusterData extends BaseVisualizationData {
  clusterRadius: number;
  minPoints: number;
}

export class ClusterVisualization extends BaseVisualization<ClusterData> {
  protected renderer: SimpleRenderer;
  private title: string;

  constructor() {
    super();
    this.renderer = new SimpleRenderer({
      symbol: new SimpleMarkerSymbol({
        size: 24,
        color: new Color([0, 116, 217, 0.8]),
        outline: {
          color: [255, 255, 255],
          width: 1
        }
      })
    });
    this.title = 'Point Clusters';
  }

  private validateInputData(data: ClusterData): void {
    const validation = {
      hasValidRadius: typeof data.clusterRadius === 'number' && isFinite(data.clusterRadius) && data.clusterRadius > 0,
      radius: data.clusterRadius,
      hasValidMinPoints: typeof data.minPoints === 'number' && isFinite(data.minPoints) && data.minPoints > 0,
      minPoints: data.minPoints
    };

    if (!validation.hasValidRadius) {
      throw new Error('Invalid cluster radius provided');
    }

    if (!validation.hasValidMinPoints) {
      throw new Error('Invalid minimum points value provided');
    }
  }

  protected async initializeLayer(data: ClusterData, options: VisualizationOptions = {}): Promise<void> {
    // Set the renderer before calling base class's initializeLayer
    // this.renderer = this.renderer; // Removed self-assignment

    // Create the layer with cluster configuration
    this.layer = new FeatureLayer({
      source: data.features.map(feature => this.mapFeature(feature)),
      title: options.title || "Cluster Analysis",
      opacity: options.opacity ?? 0.7,
      visible: options.visible ?? true,
      renderer: this.renderer,
      featureReduction: {
        type: "cluster",
        clusterRadius: data.clusterRadius,
        clusterMinSize: "24px",
        clusterMaxSize: "60px",
        labelingInfo: [{
          deconflictionStrategy: "none",
          labelExpressionInfo: {
            expression: "Text($feature.cluster_count, '#,###')"
          },
          symbol: {
            type: "text",
            color: "white",
            font: {
              weight: "bold",
              family: "Noto Sans",
              size: "12px"
            }
          },
          labelPlacement: "center-center",
        }]
      }
    });

    // Calculate extent using base class's method
    await this.calculateExtent(data.features);
  }

  async create(data: ClusterData, options: VisualizationOptions = {}): Promise<VisualizationResult> {
    // Validate input data
    this.validateData(data);
    this.validateInputData(data);

    // Initialize layer using overridden initializeLayer method
    await this.initializeLayer(data, options);

    return {
      layer: this.layer!,
      extent: this.extent!,
      renderer: this.renderer,
      legendInfo: this.getLegendInfo()
    };
  }

  getLegendInfo(): StandardizedLegendData {
    const symbol = this.renderer.symbol as SimpleMarkerSymbol;
    return {
      title: this.title,
      type: "simple",
      description: `Point clusters with ${this.data?.minPoints || 2}+ points within ${this.data?.clusterRadius || 50}km radius`,
      items: [{
        label: 'Cluster',
        color: `rgba(${symbol.color.toRgba().join(',')})`,
        shape: 'circle',
        size: symbol.size
      }]
    };
  }
}