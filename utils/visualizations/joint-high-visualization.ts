import { DEFAULT_FILL_ALPHA } from "./constants";
/**
 * JointHighVisualization class implements visualization for areas high in multiple metrics
 */
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import ClassBreaksRenderer from '@arcgis/core/renderers/ClassBreaksRenderer';
import Color from '@arcgis/core/Color';
import Graphic from '@arcgis/core/Graphic';
import { FeatureCollection } from 'geojson';
import { MultiLayerAnalysis } from '../multi-layer-analyzer';
import { BaseVisualization, BaseVisualizationData, VisualizationOptions, VisualizationResult } from './base-visualization';
import { StandardizedLegendData } from '@/types/legend';

export interface JointHighData extends BaseVisualizationData {
  features: any[];
  metrics?: string[];
  analysis?: any;
  rendererField?: string;
}

export class JointHighVisualization extends BaseVisualization<JointHighData> {
  constructor() {
    super();
  }

  async create(data: JointHighData, options: VisualizationOptions = {}): Promise<VisualizationResult> {
    this.data = data;
    const features = data.features;
    const metrics = data.metrics || (data.analysis?.relevantFields || []);
    const rendererField = data.rendererField || 'combined_score';

    if (!features || !features.length) {
      console.error('[JointHighVisualization] No features provided');
      return { layer: null, extent: null };
    }

    // Create feature collection from features
    const featureCollection: FeatureCollection = {
      type: 'FeatureCollection',
      features: features
    };

    // Ensure we have at least two metrics
    let visualizationMetrics = [...metrics];
    if (visualizationMetrics.length < 2) {
      const sampleFeature = features[0];
      if (sampleFeature && sampleFeature.properties) {
        const possibleMetrics = Object.keys(sampleFeature.properties)
          .filter(key => typeof sampleFeature.properties[key] === 'number');
        if (possibleMetrics.length >= 2) {
          visualizationMetrics = possibleMetrics.slice(0, 2);
        }
      }
    }

    // Normalize metrics for comparison
    const normalizedData = MultiLayerAnalysis.normalizeMetrics(
      featureCollection,
      visualizationMetrics
    );

    // === Ensure combined_score exists for every feature (treat missing values as 0) ===
    normalizedData.features.forEach((f: any) => {
      visualizationMetrics.forEach((m: string) => {
        if (f.properties[`${m}_normalized`] === undefined || f.properties[`${m}_normalized`] === null) {
          f.properties[`${m}_normalized`] = 0;
        }
      });
      const values = visualizationMetrics.map((m: string) => f.properties[`${m}_normalized`] ?? 0);
      const mean = values.reduce((sum: number, v: number) => sum + v, 0) / values.length;
      f.properties[rendererField] = mean;
    });

    // === DEBUG: Log combined_score distribution ===
    const combinedValues = normalizedData.features
      .map((f: any) => f.properties?.[rendererField])
      .filter((v: number) => typeof v === 'number');
    const minCombined = combinedValues.length ? Math.min(...combinedValues) : null;
    const maxCombined = combinedValues.length ? Math.max(...combinedValues) : null;
    console.log('[JointHighVisualization] combined_score stats', {
      count: combinedValues.length,
      min: minCombined,
      max: maxCombined
    });

    // === Build data-driven quartile breaks ===
    // Sort positive scores (>0) for quantile calculation – zeros/NaN treated as no-data
    const positiveScores = combinedValues.filter((v: number) => v > 0 && !isNaN(v));
    const sortedScores = positiveScores.slice().sort((a, b) => a - b);
    const getQuantile = (p: number) => {
      const idx = (sortedScores.length - 1) * p;
      const lower = Math.floor(idx);
      const upper = Math.ceil(idx);
      if (lower === upper) return sortedScores[lower];
      return sortedScores[lower] + (sortedScores[upper] - sortedScores[lower]) * (idx - lower);
    };

    const q1 = sortedScores.length ? getQuantile(0.25) : 0;
    const q2 = sortedScores.length ? getQuantile(0.5) : 0;
    const q3 = sortedScores.length ? getQuantile(0.75) : 0;

    const minPositive = sortedScores[0] ?? 0;

    console.log('[JointHighVisualization] quartile breaks', { q1, q2, q3 });

    // Create graphics from features
    const graphics = normalizedData.features.map((feature: any, i: number) => {
      return new Graphic({
        geometry: feature.geometry,
        attributes: {
          ...feature.properties,
          // Ensure renderer field is numeric
          [rendererField]: Number(feature.properties[rendererField]),
          OBJECTID: i + 1
        }
      });
    });

    const alpha = 0.6; // desired fill opacity
    const outlineSym = new SimpleLineSymbol({ color: new Color([0, 0, 0, 0]), width: 0 }); // No border

    // Create renderer for combined score
    this.renderer = new ClassBreaksRenderer({
      field: rendererField,
      defaultSymbol: new SimpleFillSymbol({
        color: new Color([220, 220, 220, alpha]),
        outline: outlineSym
      }),
      defaultLabel: 'No Data',
      classBreakInfos: [
        {
          // Zero-score polygons keep default symbol; first coloured class starts at minPositive
          minValue: minPositive,
          maxValue: q1,
          symbol: new SimpleFillSymbol({
            color: new Color([215, 25, 28, alpha]), // red (lowest quartile)
            outline: outlineSym
          })
        },
        {
          minValue: q1,
          maxValue: q2,
          symbol: new SimpleFillSymbol({
            color: new Color([244, 109, 67, alpha]), // orange-red (second quartile)
            outline: outlineSym
          })
        },
        {
          minValue: q2,
          maxValue: q3,
          symbol: new SimpleFillSymbol({
            color: new Color([253, 174, 97, alpha]), // yellow-orange (third quartile)
            outline: outlineSym
          })
        },
        {
          minValue: q3,
          maxValue: maxCombined,
          symbol: new SimpleFillSymbol({
            color: new Color([35, 139, 69, alpha]), // green (highest quartile)
            outline: outlineSym
          })
        }
      ]
    });

    // Create feature layer
    this.layer = new FeatureLayer({
      source: graphics,
      renderer: this.renderer,
      title: 'Joint High Areas',
      popupTemplate: {
        title: 'Joint High Score',
        content: `Combined score: {${rendererField}}<br/>${visualizationMetrics[0]}: {${visualizationMetrics[0]}}<br/>${visualizationMetrics[1]}: {${visualizationMetrics[1]}}`
      },
      fields: [
        { name: rendererField, alias: 'Combined Score', type: 'double' },
        { name: 'OBJECTID', alias: 'OBJECTID', type: 'oid' }
      ],
      objectIdField: 'OBJECTID',
      geometryType: 'polygon',
      popupEnabled: true
    });

    // Extent calculation (placeholder: null)
    this.extent = null;

    return {
      layer: this.layer,
      extent: this.extent,
      renderer: this.renderer,
      legendInfo: this.getLegendInfo()
    };
  }

  getLegendInfo(): StandardizedLegendData {
    // Helper to convert color arrays to CSS rgba strings
    const rgba = (arr: number[]) => `rgba(${arr[0]},${arr[1]},${arr[2]},${arr[3]})`;

    return {
      title: 'Joint High Areas',
      type: 'class-breaks',
      items: [
        { label: 'No Data', color: rgba([220, 220, 220, 0.6]) },
        { label: 'Low', color: rgba([215, 25, 28, 0.6]) },
        { label: 'Below Avg', color: rgba([244, 109, 67, 0.6]) },
        { label: 'Above Avg', color: rgba([253, 174, 97, 0.6]) },
        { label: 'High', color: rgba([35, 139, 69, 0.6]) }
      ]
    };
  }

  protected processMicroserviceResponse(response: any): JointHighData {
    const inputRecords = (response?.inputRecords || response?.records || response?.data || []);
    const features = inputRecords.map((record: any, index: number) => ({
      attributes: {
        ...record,
        ID: record.ID,
        OBJECTID: index + 1
      }
    }));
    return {
      features,
      metrics: Object.keys(inputRecords[0] || {}).filter(k => typeof inputRecords[0][k] === 'number' && k !== 'ID'),
      layerName: 'Joint High Analysis',
      rendererField: 'combined_score',
      analysis: {},
    };
  }
}
