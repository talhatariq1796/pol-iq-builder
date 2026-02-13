import { DEFAULT_FILL_ALPHA } from "./constants";
import { BaseVisualization, BaseVisualizationData, VisualizationOptions, VisualizationResult } from './base-visualization';
import { PopupConfiguration } from '@/types/popup-config';
import { createPopupTemplateFromConfig, createDefaultPopupConfig } from '@/utils/popup-utils';
import ClassBreaksRenderer from '@arcgis/core/renderers/ClassBreaksRenderer';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Graphic from '@arcgis/core/Graphic';
import Field from '@arcgis/core/layers/support/Field';
import { StandardizedLegendData, LegendType } from '@/types/legend';
import { FieldMappingHelper } from './field-mapping-helper';

type FieldType = "string" | "oid" | "small-integer" | "integer" | "single" | "double" | "long" | "date" | "big-integer" | "date-only" | "time-only" | "timestamp-offset" | "geometry" | "blob" | "raster" | "guid" | "global-id" | "xml";

interface RankingData extends BaseVisualizationData {
  features: Array<{
    geometry: any;
    attributes: Record<string, any>;
  }>;
  layerName: string;
  rendererField: string;
  layerConfig: {
    name: string;
    fields: Array<{
      name: string;
      type: FieldType;
    }>;
  };
}

export class RankingVisualization extends BaseVisualization<RankingData> {
  protected renderer: ClassBreaksRenderer | null = null;
  protected data: RankingData | null = null;
  protected options: VisualizationOptions = {};

  getLegendInfo(): StandardizedLegendData {
    if (!this.data) {
      return {
        title: 'Top Areas',
        type: 'simple' as LegendType,
        items: []
      };
    }

    // Use standardized field mapping for legend title
    const friendlyFieldName = FieldMappingHelper.getFriendlyFieldName(this.data.rendererField);
    
    return {
      title: `Top ${friendlyFieldName} Areas`,
      type: 'simple' as LegendType,
      items: [
        {
          label: `High ${friendlyFieldName}`,
          color: '#33a852'
        }
      ]
    };
  }

  public async create(
    data: RankingData,
    options: VisualizationOptions & { popupConfig?: PopupConfiguration } = {}
  ): Promise<VisualizationResult> {
    try {
      console.log('[RankingViz Create] Starting ranking visualization', {
        featureCount: data.features?.length,
        rendererField: data.rendererField,
        layerName: data.layerName
      });

      // Store input data and options
      this.data = data;
      this.options = options;

      // Convert features to Graphics
      const graphics = data.features.map(feature => {
        return new Graphic({
          geometry: feature.geometry,
          attributes: feature.attributes
        });
      });

      // Create feature layer
      const layer = new FeatureLayer({
        source: graphics,
        title: data.layerName,
        objectIdField: 'OBJECTID',
        fields: data.layerConfig.fields.map(field => new Field({
          name: field.name,
          type: field.type,
          alias: field.name
        }))
      });

      // Create renderer for top N features
      this.renderer = new ClassBreaksRenderer({
        field: data.rendererField,
        defaultSymbol: new SimpleFillSymbol({
          color: [200, 200, 200, 0.5],
          outline: {
            color: [128, 128, 128, 0.5],
            width: 0.5
          }
        }),
        classBreakInfos: [
          {
            minValue: -Infinity,
            maxValue: Infinity,
            symbol: new SimpleFillSymbol({
              color: [51, 168, 82, DEFAULT_FILL_ALPHA], // #33a852 with 0.7 opacity
              outline: {
                color: [41, 134, 66, 1], // Slightly darker outline
                width: 1
              }
            })
          }
        ]
      });

      // Apply renderer to layer
      layer.renderer = this.renderer;

      // Add popup template if config is provided
      if (options.popupConfig) {
        layer.popupTemplate = createPopupTemplateFromConfig(options.popupConfig);
      }

      // Calculate extent from features
      const extent = this.calculateExtent(graphics);

      return {
        layer,
        extent,
        legendInfo: this.getLegendInfo(),
        shouldZoom: true
      };
    } catch (error) {
      console.error('[RankingViz Create] Error creating ranking visualization:', error);
      throw error;
    }
  }
} 