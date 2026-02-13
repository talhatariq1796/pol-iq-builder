// src/components/LayerController/createPopupTemplate.tsx

import PopupTemplate from "@arcgis/core/PopupTemplate";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import Query from "@arcgis/core/rest/support/Query";
import { Chart as ChartJS, ChartConfiguration, ChartData, ChartTypeRegistry, ChartDataset } from 'chart.js/auto';
import type { LayerConfig, IndexLayerConfig, LayerGroup, LayerType } from '../../types/layers';
import { getLayerConfigById } from '../../config/layers';

interface PopupData {
  layerId: string;
  label: string;
  values: Record<string, any>;
  type: LayerType | 'unknown';
  description: string | undefined;
  groupId: string;
}

interface PopupVisualization {
  type: 'chart' | 'table';
  options?: {
    chartType?: 'bar' | 'line' | 'pie';
    colors?: string[];
    layout?: Record<string, any>;
  };
}

interface PopupConfig {
  title: string;
  visualizations: PopupVisualization[];
  relatedGroups?: string[];
  formatters?: Record<string, (value: any) => string>;
}

interface Field {
  label: string;
  type: string;
  name: string;
}

const defaultFormatters = {
  index: (value: number | null | undefined) => {
    if (value === null || value === undefined) return 'N/A';
    return `${value.toFixed(1)}%`;
  },
  number: (value: number | null | undefined) => {
    if (value === null || value === undefined) return 'N/A';
    return Math.round(value).toLocaleString();
  },
  string: (value: string | null | undefined) => value || 'N/A',
  default: (value: any) => value?.toString() || 'N/A'
};

const defaultChartColors = [
  '#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f',
  '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab'
];

class PopupTemplateBuilder {
  private config: PopupConfig;
  private layerGroups: LayerGroup[];
  private layerConfig: LayerConfig;

  constructor(config: PopupConfig, layerGroups: LayerGroup[], layerConfig: LayerConfig) {
    this.config = config;
    this.layerGroups = layerGroups;
    this.layerConfig = layerConfig;
  }

  private async queryRelatedLayers(
    geometry: __esri.Geometry, 
    attributes: any
  ): Promise<PopupData[]> {
    console.log('DEBUG: Querying Related Layers');
    console.log('DEBUG: Geometry:', geometry);
    console.log('DEBUG: Attributes:', attributes);
    console.log('DEBUG: Current Layer Config:', this.layerConfig);
    console.log('DEBUG: Layer Groups:', this.layerGroups);
  
    // Fallback group identification
    const fallbackGroupId = this.layerGroups && this.layerGroups.length > 0 
      ? this.layerGroups[0].id 
      : 'default';
  
    // Fallback to using the current layer's attributes if no related data found
    const currentLayerData: PopupData = {
      layerId: this.layerConfig.id,
      label: this.layerConfig?.name || 'Unknown Layer',
      values: attributes || {},
      type: this.layerConfig?.type || 'unknown',
      description: this.layerConfig?.description || '',
      groupId: this.layerGroups?.find(group => 
        group.layers?.some(layer => layer.id === this.layerConfig?.id)
      )?.id || fallbackGroupId
    };
  
    // Defensive checks
    if (!this.layerGroups || this.layerGroups.length === 0) {
      console.warn('DEBUG: No layer groups available');
      return [currentLayerData];
    }
  
    // If geometry is not valid or geometry type is not supported, return current layer data
    if (!geometry || !geometry.type) {
      console.warn('DEBUG: Invalid or missing geometry');
      return [currentLayerData];
    }
  
    const relatedGroups = this.config.relatedGroups || 
      this.layerGroups.map(group => group.id);
  
    const query = new Query({
      geometry,
      outFields: ["*"],
      returnGeometry: false,
      spatialRelationship: "intersects",
      where: "1=1"
    });
  
    const queryPromises = this.layerGroups
      .filter(group => relatedGroups.includes(group.id))
      .flatMap(group => 
        (group.layers || []).map(async (layer): Promise<PopupData | null> => {

          
          try {
            if (!layer) {
              return null;
            }
  
            if (layer.id === this.layerConfig?.id) {
              return currentLayerData;
            }
  
            const featureLayer = new FeatureLayer({ url: layer.url });
            const result = await featureLayer.queryFeatures(query);
            
            if (result.features.length === 0) {
              return null;
            }
  
            const feature = result.features[0];
            return {
              layerId: layer.id,
              label: layer.name || 'Unknown Layer',
              values: feature.attributes || {},
              type: layer.type || 'unknown',
              description: layer.description || '',
              groupId: group.id
            };
          } catch (error) {
            return null;
          }
        })
      );
  
    const results = await Promise.all(queryPromises);
    const filteredResults = results.filter((result): result is PopupData => result !== null);
    
    // If no related data found, return current layer data
    return filteredResults.length > 0 ? filteredResults : [currentLayerData];
  }

  private extractValues(attributes: any, layer: LayerConfig): Record<string, any> {
    const mortgageLayerIds = ['applications', 'conversions', 'conversionRate'];
    if (mortgageLayerIds.includes(layer.id)) {
      const rendererField = layer.rendererField;

      if (!rendererField) {
        return {}; // Return empty if no rendererField is defined
      }

      const fieldConfig = layer.fields?.find(f => f.name === rendererField);
      const value = attributes[rendererField];

      const formatter = (val: unknown) => {
        if (val === null || val === undefined) return 'N/A';
        const numVal = typeof val === 'number' ? val : Number(val);
        if (isNaN(numVal)) return 'N/A';
        
        if (layer.type === 'percentage') {
          return `${numVal.toFixed(1)}%`;
        }
        
        return numVal.toLocaleString(undefined, { maximumFractionDigits: 0 });
      };

      const displayName = fieldConfig?.label || layer.name;

      return {
        [displayName]: formatter(value)
      };
    }
    if (layer.type === 'index') {
      const indexLayer = layer as IndexLayerConfig;
      const field = indexLayer.rendererField || 'value';
      const fieldConfig = indexLayer.fields?.find(f => f.name === field);
      const value = attributes[field];
      
      // Check if this is a count field using metadata
      const isCountField = layer.metadata?.valueType === 'count';
      
      const formatter = isCountField ? 
        (val: unknown) => {
          if (val === null || val === undefined) return 'N/A';
          const numVal = typeof val === 'number' ? val : Number(val);
          return isNaN(numVal) ? 'N/A' : Math.round(numVal).toLocaleString();
        } : 
        (val: unknown) => {
          if (val === null || val === undefined) return 'N/A';
          const numVal = typeof val === 'number' ? val : Number(val);
          return isNaN(numVal) ? 'N/A' : fieldConfig?.label?.includes('$') ? 
            `$${Math.round(numVal).toLocaleString()}` :
            `${numVal.toFixed(1)}`;
        };
      
      return {
        [layer.name]: formatter(value)
      };
    }

    return (layer.fields as Field[]).reduce<Record<string, any>>((acc, field) => {
      const value = (attributes as Record<string, unknown>)[field.name];
      const isDemographicPercentage = layer.id === 'chinese' ||
                                    field.label?.includes('%') ||
                                    layer.description?.toLowerCase().includes('population') ||
                                    layer.description?.toLowerCase().includes('demographic');
      
      const formatter = isDemographicPercentage ?
        (val: unknown) => {
          if (val === null || val === undefined) return 'N/A';
          const numVal = typeof val === 'number' ? val : Number(val);
          return isNaN(numVal) ? 'N/A' : `${numVal.toFixed(1)}%`;
        } :
        (val: unknown) => {
          if (val === null || val === undefined) return 'N/A';
          const numVal = typeof val === 'number' ? val : Number(val);
          return isNaN(numVal) ? 'N/A' : field.label?.includes('$') ?
            `$${Math.round(numVal).toLocaleString()}` :
            `${numVal.toFixed(1)}`;
        };
      
      acc[field.label] = formatter(value);
      return acc;
    }, {} as Record<string, any>);
  }

  private createVisualization(
    container: HTMLElement,
    data: PopupData[],
    visualization: PopupVisualization
  ): void {
    if (visualization.type === 'chart') {
      this.createChart(container, data, visualization.options);
    } else {
      this.createTable(container, data);
    }
  }

  private createChart(
    container: HTMLElement,
    data: PopupData[],
    options?: PopupVisualization['options']
  ): void {
    const chartContainer = document.createElement('div');
    chartContainer.style.cssText = 'height: 200px; width: 100%; margin-bottom: 1rem;';
    
    const canvas = document.createElement('canvas');
    chartContainer.appendChild(canvas);

    // Extract values and determine if they are percentages
    const values = data.map(d => {
      const value = Object.values(d.values)[0];
      // If the value is a string with a % sign, parse it
      if (typeof value === 'string' && value.includes('%')) {
        return parseFloat(value.replace('%', ''));
      }
      // If the value is a string with a $ sign, parse it
      if (typeof value === 'string' && value.includes('$')) {
        return parseFloat(value.replace(/[$,]/g, ''));
      }
      return typeof value === 'number' ? value : Number(value);
    });

    // Determine if we're dealing with percentages
    const isPercentage = data.some(d => {
      const value = Object.values(d.values)[0];
      return typeof value === 'string' && value.includes('%');
    });

    const chartConfig: ChartConfiguration = {
      type: options?.chartType || 'bar',
      data: {
        labels: data.map(d => {
          if (d.layerId === 'applications') return 'Applications';
          if (d.layerId === 'conversions') return 'Conversions';
          if (d.layerId === 'conversionRate') return 'Conversion Rate';
          return d.label;
        }),
        datasets: [{
          type: options?.chartType || 'bar',
          label: isPercentage ? 'Percentage' : 'Values',
          data: values,
          backgroundColor: options?.colors || defaultChartColors,
          borderColor: options?.colors || defaultChartColors,
          borderWidth: 1
        } as ChartDataset]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => isPercentage ? `${value}%` : value
            }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.parsed.y;
                return isPercentage ? `${value.toFixed(1)}%` : value.toLocaleString();
              }
            }
          }
        },
        ...options?.layout
      }
    };

    new ChartJS(canvas, chartConfig);
    container.appendChild(chartContainer);
  }

  private createTable(container: HTMLElement, data: PopupData[]): void {
    const table = document.createElement('table');
    table.className = 'w-full text-xs';
    
    const rows = data.map(item => {
      const valueRows = Object.entries(item.values)
        .map(([key, value]) => `
          <tr>
            <td class="py-1 pl-2">${key}</td>
            <td class="py-1 pr-2 text-right">${value}</td>
          </tr>
        `).join('');

      return `
        <tbody>
          <tr>
            <th colspan="2" class="text-left py-2 font-medium">${item.label}</th>
          </tr>
          ${valueRows}
        </tbody>
      `;
    }).join('');

    table.innerHTML = rows;
    container.appendChild(table);
  }

  build(): PopupTemplate {
    return new PopupTemplate({
      title: this.config.title,
      outFields: ["*"],
      content: [{
        type: "custom",
        creator: async (event: { graphic: __esri.Graphic }) => {
          const container = document.createElement("div");
          container.className = "popup-content p-4";

          try {
            const geometry = event.graphic.geometry;
            if (!geometry) {
              // If there's no related data, just use the current layer's data.
              const currentLayerData = this.extractValues(event.graphic.attributes, this.layerConfig);
              this.createVisualization(container, [{
                layerId: this.layerConfig.id,
                label: this.layerConfig.name,
                values: currentLayerData,
                type: this.layerConfig.type || 'unknown',
                description: this.layerConfig.description,
                groupId: '' // Group doesn't matter for single layer view
              }], this.config.visualizations[0]);
              return container;
            }
            const data = await this.queryRelatedLayers(
              geometry,
              event.graphic.attributes
            );

            if (data.length === 0) {
              throw new Error("No data found");
            }

            // Process the data to ensure proper formatting
            const processedData = data.map(item => {
              const itemLayerConfig = getLayerConfigById(item.layerId);
              if (!itemLayerConfig) {
                console.warn(`Could not find config for layerId: ${item.layerId}`);
                return item;
              }
              return {
                ...item,
                values: this.extractValues(item.values, itemLayerConfig)
              };
            });

            // Create visualizations based on config
            this.config.visualizations.forEach(viz => {
              this.createVisualization(container, processedData, viz);
            });

            return container;
          } catch (error) {
            console.error('Error in popup template:', error);
            container.innerHTML = `
              <div class="text-red-500">
                Error loading popup content. Please try again.
              </div>
            `;
            return container;
          }
        }
      }]
    });
  }
}

export const createPopupTemplate = (
  layerConfig: LayerConfig,
  layerGroups: LayerGroup[],
  popupConfig?: Partial<PopupConfig>
): PopupTemplate => {
  const defaultConfig: PopupConfig = {
    title: layerConfig.name,
    visualizations: [
      { type: layerConfig.type === 'index' ? 'chart' : 'table' }
    ],
    formatters: defaultFormatters
  };

  const builder = new PopupTemplateBuilder(
    { ...defaultConfig, ...popupConfig },
    layerGroups,
    layerConfig
  );

  return builder.build();
};