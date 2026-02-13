/* eslint-disable no-case-declarations */
/* eslint-disable @typescript-eslint/no-unused-expressions */
// src/components/map/enhancedPopupTemplate.tsx

import PopupTemplate from "@arcgis/core/PopupTemplate";
import MediaContent from "@arcgis/core/popup/content/MediaContent";
import TextContent from "@arcgis/core/popup/content/TextContent";
import CustomContent from "@arcgis/core/popup/content/CustomContent";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import Query from "@arcgis/core/rest/support/Query";
import { LayerConfig, IndexLayerConfig, PointLayerConfig, LayerGroup, LayerType } from '../../types/layers';
import { Chart as ChartJS, ChartConfiguration, ChartDataset } from 'chart.js/auto';
import { watch } from "@arcgis/core/core/reactiveUtils";

// Types
interface PopupData {
  layerId: string;
  layerName: string;
  values: Record<string, any>;
  type: LayerType;
  description: string | undefined;
  groupId: string;
  rendererField?: string;
  sortOrder?: number;
  stats?: {
    min: number;
    max: number;
    median: number;
    currentValue: number;
  };
}

interface ChartOptions {
  type: 'bar' | 'pie' | 'line' | 'doughnut';
  colors?: string[];
  layout?: Record<string, any>;
  title?: string;
  showLegend?: boolean;
}

interface TabConfig {
  id: string;
  title: string;
  content: 'chart' | 'table' | 'details' | 'related' | 'custom';
  chartOptions?: ChartOptions;
  relatedLayers?: string[];
  customRenderer?: (container: HTMLElement, data: PopupData[], feature: __esri.Graphic) => void;
}

interface EnhancedPopupConfig {
  title: string;
  titleField?: string;
  subtitle?: string;
  description?: string;
  tabs: TabConfig[];
  showRelatedLayers?: boolean;
  relatedLayerGroups?: string[];
  formatters?: Record<string, (value: any) => string>;
  actions?: Array<{
    type: "button";
    title: string;
    id: string;
    className: string;
    customAction?: (event: { target: any, graphic: __esri.Graphic }) => void;
  }>;
}

// Utilities and Constants
const DEFAULT_COLORS = [
  '#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f',
  '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab'
];

const FORMATTERS = {
  index: (value: number) => value.toFixed(1),
  number: (value: number) => Math.round(value).toLocaleString(),
  percent: (value: number) => `${value.toFixed(1)}%`,
  string: (value: string) => value,
  currency: (value: number) => `$${value.toLocaleString()}`,
  default: (value: any) => value?.toString() || 'N/A'
};

// Remove or comment out the PopupStyles constant
// const PopupStyles = `...`;

// Global variable to store the last clicked geometry for emergency recovery
let lastClickedGeometry: __esri.Geometry | null = null;

// Global emergency handler for geometry recovery
function handleEmergencyGeometryRequest() {
  console.log("Emergency geometry request received");
  if (lastClickedGeometry) {
    console.log("Responding with stored geometry from global cache");
    const emergencyEvent = new CustomEvent('openInfographics', {
      detail: {
        geometry: lastClickedGeometry,
        activeStep: 'report',
        emergency: true
      }
    });
    document.dispatchEvent(emergencyEvent);
  } else {
    console.warn("No geometry available to respond to emergency request");
  }
}

// Add the global listener once when module loads
document.addEventListener('requestGeometry', handleEmergencyGeometryRequest);

// At the top level, add this global function
function forceToReportStepDirectly() {
  console.log("🔥 DIRECT DOM MANIPULATION to force report step");
  
  try {
    // Create test geometry as a fallback
    const testGeometry = {
      type: "polygon",
      rings: [
        [
          [-122.68, 45.53],
          [-122.67, 45.53],
          [-122.67, 45.54],
          [-122.68, 45.54],
          [-122.68, 45.53]
        ]
      ],
      spatialReference: { wkid: 4326 }
    };
    
    // Use the test geometry as a fallback
    lastClickedGeometry = lastClickedGeometry || testGeometry as any;
    
    // Try to set geometry directly through global functions first
    if (typeof (window as any).__directlySetGeometry === 'function') {
      console.log("Setting test geometry through global function");
      try {
        (window as any).__directlySetGeometry(lastClickedGeometry);
      } catch (error) {
        console.error("Error using direct setter:", error);
      }
    }
    
    // 1. Try to click the report step button directly
    const reportButton = document.querySelector('[data-step="report"]');
    if (reportButton) {
      console.log("Clicking report button directly");
      (reportButton as HTMLButtonElement).click();
    }
    
    // 2. Try to make report content visible directly
    const reportContent = document.querySelector('[data-stepcontent="report"]');
    if (reportContent) {
      console.log("Making report content visible via DOM");
      (reportContent as HTMLElement).style.display = "block";
    }
    
    // 3. Try to hide other content
    const drawContent = document.querySelector('[data-stepcontent="draw"]');
    const bufferContent = document.querySelector('[data-stepcontent="buffer"]');
    
    if (drawContent) (drawContent as HTMLElement).style.display = "none";
    if (bufferContent) (bufferContent as HTMLElement).style.display = "none";
    
    // 4. Set the session storage flag
    window.sessionStorage.setItem('popupTriggeredNavigation', 'true');
    
    // 5. Force update of all button classes
    const allStepButtons = document.querySelectorAll('[data-step]');
    allStepButtons.forEach((button: Element) => {
      // Cast to HTMLButtonElement instead of HTMLElement
      const buttonElement = button as HTMLButtonElement;
      
      if (buttonElement.dataset.step === 'report') {
        buttonElement.className = buttonElement.className.replace('bg-gray-50', 'bg-blue-50');
        buttonElement.className = buttonElement.className.replace('text-gray-500', 'text-blue-700');
        buttonElement.disabled = false;
      } else {
        buttonElement.className = buttonElement.className.replace('bg-blue-50', 'bg-gray-50');
        buttonElement.className = buttonElement.className.replace('text-blue-700', 'text-gray-500');
        buttonElement.disabled = true;
      }
    });
    
    // 6. Direct DOM injection of geometry to a global variable
    (window as any).emergencyGeometry = lastClickedGeometry;
    
    console.log("Direct DOM manipulation complete");
    return true;
  } catch (error) {
    console.error("Error with direct DOM manipulation:", error);
    return false;
  }
}

// Popup Template Builder Class
class EnhancedPopupTemplateBuilder {
  private config: EnhancedPopupConfig;
  private layerGroups: LayerGroup[];
  private layerConfig: LayerConfig;
  private cssInjected = false;
  private data: PopupData[] = [];
  private view: __esri.MapView;
  private layerStates: { [key: string]: { layer: __esri.FeatureLayer | null } };
  private static readonly LAYER_STATES_SYMBOL = Symbol.for('layerStates');

  constructor(
    layerConfig: LayerConfig,
    layerGroups: LayerGroup[],
    view: __esri.MapView,
    layerStates: { [key: string]: { layer: __esri.FeatureLayer | null } }
  ) {
    console.log('EnhancedPopupTemplateBuilder constructor called with:', {
      layerConfig: layerConfig.id,
      layerStatesPresent: !!layerStates,
      layerStatesCount: layerStates ? Object.keys(layerStates).length : 0,
      layerStateKeys: layerStates ? Object.keys(layerStates) : []
    });

    this.config = createDefaultPopupConfig(layerConfig, layerGroups);
    this.layerConfig = layerConfig;
    this.layerGroups = layerGroups;
    this.view = view;
    this.layerStates = layerStates;

    // Store layerStates in view for later access
    if (layerStates && Object.keys(layerStates).length > 0) {
      // Store in a more persistent way using a Symbol
      (view as any)[EnhancedPopupTemplateBuilder.LAYER_STATES_SYMBOL] = layerStates;
      console.log('Stored layerStates in view:', {
        layerStatesCount: Object.keys(layerStates).length,
        layerStateKeys: Object.keys(layerStates)
      });
    }
  }

  // Comment out the injectCSS method
  /*
  private injectCSS(): void {
    if (this.cssInjected) return;
    
    const style = document.createElement('style');
    style.textContent = PopupStyles;
    document.head.appendChild(style);
    this.cssInjected = true;
  }
  */

  private getTabsForData(data: PopupData[]): TabConfig[] {
    // If no data, return empty array
    if (!data || data.length === 0) {
      return [];
    }

    // Get the group ID from the first data item (they should all be from the same group)
    const groupId = data[0].groupId;
    
    // Find the matching group
    const matchingGroup = this.layerGroups.find(group => {
      // Check if the layer belongs to the main group
      if (group.id === groupId) return true;
      
      // Check if the layer belongs to any subgroups
      if (group.subGroups) {
        return group.subGroups.some(subGroup => 
          subGroup && subGroup.layers?.some(layer => layer.id === data[0].layerId)
        );
      }
      
      return false;
    });

    if (!matchingGroup) {
      console.warn(`No matching group found for groupId: ${groupId}`);
      return [];
    }

    // Special handling for Google Trends group and its subgroups
    if (matchingGroup.id === 'google-trends-group') {
      return [{
        id: 'google-trends-tab',
        title: 'Google Trends',
          content: 'chart',
          chartOptions: {
          type: 'bar',
          title: 'Google Trends Analysis',
          showLegend: false,
          colors: DEFAULT_COLORS
        }
      }];
    }

    // For other groups, return the standard tab configuration
    return [{
      id: `tab-${matchingGroup.id}`,
      title: matchingGroup.title || 'Data',
      content: 'chart',
      chartOptions: {
        type: data.length > 1 ? 'bar' : 'pie',
        title: matchingGroup.title || '',
            showLegend: true,
            colors: DEFAULT_COLORS
          },
      relatedLayers: matchingGroup.layers?.map(layer => layer.id) || []
    }];
  }

  private async queryRelatedLayers(geometry: __esri.Geometry, attributes: any): Promise<PopupData[]> {
    if (!this.layerGroups?.length) {
      console.warn('DEBUG: No layer groups available');
      return [];
    }

    console.log('DEBUG: Layer Groups:', this.layerGroups);
    console.log('DEBUG: Current layer config:', this.layerConfig);
    console.log('DEBUG: Available layer states:', Object.keys(this.layerStates));
    console.log('DEBUG: Popup query attributes:', attributes);

    const query = new Query({
      geometry,
      outFields: ["*"],
      returnGeometry: false,
      spatialRelationship: "intersects",
      where: "1=1"
    });

    try {
      // Determine which group the current layer belongs to
      const currentGroup = this.layerGroups.find(group => {
        if (group.subGroups) {
          return group.subGroups.some(subGroup => 
            subGroup && subGroup.layers?.some(layer => layer.id === this.layerConfig.id)
          );
        }
        return group.layers?.some(layer => layer.id === this.layerConfig.id);
      });

      if (!currentGroup) {
        console.warn(`No matching group found for layer ${this.layerConfig.id}`);
        return [];
      }

      // Special handling for Google Trends group
      if (currentGroup.id === 'google-trends-group') {
        // Get all Google Trends layers from all subgroups
        const googleTrendsLayers = currentGroup.subGroups?.flatMap(subGroup => 
          subGroup.layers || []
        ) || [];

        console.log('DEBUG: Google Trends layers to query:', googleTrendsLayers.map(l => l.id));
        
        // Get the current value directly from the attributes
        // This is important - the attributes passed in are from the clicked feature
        // and already contain the normalized Google Trends values
        
        // Determine region (ON or BC) from clicked layer
        const region = this.layerConfig.id.endsWith('ON') ? 'ON' : 'BC';
        const regionLayers = googleTrendsLayers.filter(layer => layer.id.endsWith(region));
        
        console.log(`DEBUG: Found ${regionLayers.length} layers for ${region} region`);
        
        const popupDataArray: PopupData[] = [];
        
        // For each layer in the same region, get the value directly from the attributes
        for (const layer of regionLayers) {
          const value = attributes[layer.id];
          
          console.log(`DEBUG: Direct attribute access for ${layer.id}:`, {
            value,
            isNull: value === null,
            isUndefined: value === undefined,
            isNaN: isNaN(value),
            layerName: layer.name,
            allAttributes: Object.keys(attributes)
          });
          
          // Always include a value even if no data - use 0 instead of null/undefined
          // This ensures no-data areas are displayed the same as the 0-x category
          const finalValue = value !== null && value !== undefined && !isNaN(value) ? value : 0;
          
          const popupData: PopupData = {
            layerId: layer.id,
            layerName: layer.name,
            values: { ...attributes }, // Include all attributes to get CSDNAME, etc.
            type: layer.type,
            description: layer.description,
            groupId: currentGroup.id,
            rendererField: layer.id,
            stats: {
              min: 0,
              max: 100,
              median: 50,
              currentValue: finalValue
            }
          };
          
          console.log(`DEBUG: Adding popup data for ${layer.id}:`, popupData);
          popupDataArray.push(popupData);
        }
        
        console.log('DEBUG: Final Google Trends popup data array:', popupDataArray);
        return popupDataArray;
      }

      // Only query layers from the same group as the current layer
      const queryPromises = (() => {
        if (currentGroup.subGroups) {
          // For groups with subgroups, query only layers from the same subgroup
          const currentSubGroup = currentGroup.subGroups.find(subGroup => 
            subGroup && subGroup.layers?.some(layer => layer.id === this.layerConfig.id)
          );
          
          if (!currentSubGroup) {
            console.warn(`No matching subgroup found for layer ${this.layerConfig.id}`);
            return [];
          }

          return (currentSubGroup.layers || []).map(async (layer): Promise<PopupData | null> => {
            try {
              // Get the existing layer from layerStates
              const existingLayer = this.layerStates[layer.id]?.layer;
              if (!existingLayer) {
                console.warn(`No existing layer found for ${layer.id}`);
                return null;
              }

              console.log(`DEBUG: Querying layer: ${layer.name} (${layer.url})`);
              
              // Get the current feature's value
              const result = await existingLayer.queryFeatures(query);
              
              // Get statistics for the entire dataset
              const statsQuery = new Query({
                where: "1=1",
                outFields: ["*"],
                returnGeometry: false
              });
              
              const statsResult = await existingLayer.queryFeatures(statsQuery);

              // Determine the correct value field based on layer type
              let valueField: string | undefined;
              if (layer.type === 'index') {
                valueField = (layer as IndexLayerConfig).rendererField;
              } else {
                // For non-index layers, find the first numeric field that's not an ID or geometry field
                const availableFields = Object.entries(statsResult.features[0]?.attributes || {});
                valueField = availableFields.find(([key, value]) => 
                  typeof value === 'number' && 
                  !key.toLowerCase().includes('id') && 
                  !key.toLowerCase().includes('objectid') &&
                  !key.toLowerCase().includes('shape') &&
                  !key.toLowerCase().includes('area') &&
                  !key.toLowerCase().includes('length')
                )?.[0];
              }

              if (!valueField) {
                console.warn(`No suitable value field found for layer ${layer.name}`);
                return null;
              }

              const values = statsResult.features
                .map(f => f.attributes[valueField])
                .filter(v => v !== null && v !== undefined && !isNaN(v));
              
              if (values.length === 0) {
                console.warn(`No valid values found for layer ${layer.name} using field ${valueField}`);
                return null;
              }

              // Calculate statistics
              const min = Math.min(...values);
              const max = Math.max(...values);
              const median = values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
              const currentValue = result.features[0]?.attributes[valueField] || 0;

              if (result.features.length === 0) {
                console.log(`DEBUG: No features found for ${layer.name}`);
                return null;
              }

              return {
                layerId: layer.id,
                layerName: layer.name,
                values: result.features[0].attributes,
                type: layer.type,
                description: layer.description,
                groupId: currentGroup.id,
                rendererField: layer.type === 'index' 
                  ? (layer as IndexLayerConfig).rendererField 
                  : undefined,
                stats: {
                  min,
                  max,
                  median,
                  currentValue
                }
              } as PopupData;
            } catch (error) {
              console.error(`Error querying layer ${layer.name}:`, error);
              return null;
            }
          });
        } else {
          // For regular groups
          return (currentGroup.layers || []).map(async (layer): Promise<PopupData | null> => {
            try {
              // Get the existing layer from layerStates
              const existingLayer = this.layerStates[layer.id]?.layer;
              if (!existingLayer) {
                console.warn(`No existing layer found for ${layer.id}`);
                return null;
              }

              console.log(`DEBUG: Querying layer: ${layer.name} (${layer.url})`);
              
              // Get the current feature's value
              const result = await existingLayer.queryFeatures(query);
              
              // Get statistics for the entire dataset
              const statsQuery = new Query({
                where: "1=1",
                outFields: ["*"],
                returnGeometry: false
              });
              
              const statsResult = await existingLayer.queryFeatures(statsQuery);

              // Determine the correct value field based on layer type
              let valueField: string | undefined;
              if (layer.type === 'index') {
                valueField = (layer as IndexLayerConfig).rendererField;
              } else {
                // For non-index layers, find the first numeric field that's not an ID or geometry field
                const availableFields = Object.entries(statsResult.features[0]?.attributes || {});
                valueField = availableFields.find(([key, value]) => 
                  typeof value === 'number' && 
                  !key.toLowerCase().includes('id') && 
                  !key.toLowerCase().includes('objectid') &&
                  !key.toLowerCase().includes('shape') &&
                  !key.toLowerCase().includes('area') &&
                  !key.toLowerCase().includes('length')
                )?.[0];
              }

              if (!valueField) {
                console.warn(`No suitable value field found for layer ${layer.name}`);
                return null;
              }

              const values = statsResult.features
                .map(f => f.attributes[valueField])
                .filter(v => v !== null && v !== undefined && !isNaN(v));
              
              if (values.length === 0) {
                console.warn(`No valid values found for layer ${layer.name} using field ${valueField}`);
                return null;
              }

              // Calculate statistics
              const min = Math.min(...values);
              const max = Math.max(...values);
              const median = values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
              const currentValue = result.features[0]?.attributes[valueField] || 0;

              if (result.features.length === 0) {
                console.log(`DEBUG: No features found for ${layer.name}`);
                return null;
              }

              return {
                layerId: layer.id,
                layerName: layer.name,
                values: result.features[0].attributes,
                type: layer.type,
                description: layer.description,
                groupId: currentGroup.id,
                rendererField: layer.type === 'index' 
                  ? (layer as IndexLayerConfig).rendererField 
                  : undefined,
                stats: {
                  min,
                  max,
                  median,
                  currentValue
                }
              } as PopupData;
            } catch (error) {
              console.error(`Error querying layer ${layer.name}:`, error);
              return null;
            }
          });
        }
      })();

      const results = await Promise.all(queryPromises);
      const filteredResults = results.filter((result): result is PopupData => result !== null);
      console.log('DEBUG: Final query results:', filteredResults);
      return filteredResults;
    } catch (error) {
      console.error('DEBUG: Error in queryRelatedLayers:', error);
      return [];
    }
  }

  private createTabs(container: HTMLElement, tabs: TabConfig[]): void {
    console.log('DEBUG: Creating tabs:', tabs);
    
    // If there's only one tab, create a simpler layout without tab navigation
    if (tabs.length === 1) {
      const contentContainer = document.createElement('div');
      contentContainer.className = 'popup-content-container single-tab';
      
      const tab = tabs[0];
      const content = document.createElement('div');
      content.id = tab.id;
      content.className = 'popup-tab-content active';
      
      const groupData = this.getDataForGroup(tab.id.replace('tab-', ''));
      console.log(`DEBUG: Data for tab ${tab.id}:`, groupData);
      
      this.createTabContent(content, tab, groupData);
      contentContainer.appendChild(content);
      
      container.appendChild(contentContainer);
      return;
    }
    
    // Original multi-tab layout
    const wrapper = document.createElement('div');
    wrapper.className = 'popup-tabs-wrapper';
    
    const leftArrow = document.createElement('button');
    leftArrow.className = 'popup-tab-arrow left';
    leftArrow.innerHTML = '←';
    
    const rightArrow = document.createElement('button');
    rightArrow.className = 'popup-tab-arrow right';
    rightArrow.innerHTML = '→';
    
    const tabsNav = document.createElement('div');
    tabsNav.className = 'popup-tabs';
    
    const contentContainer = document.createElement('div');
    contentContainer.className = 'popup-content-container';

    // Create all tabs first
    tabs.forEach((tab, index) => {
      console.log(`DEBUG: Creating tab ${tab.id}`);
      
      const button = document.createElement('button');
      button.className = `popup-tab-button ${index === 0 ? 'active' : ''}`;
      button.textContent = tab.title;
      tabsNav.appendChild(button);

      const content = document.createElement('div');
      content.id = tab.id;
      content.className = `popup-tab-content ${index === 0 ? 'active' : ''}`;
      
      const groupData = this.getDataForGroup(tab.id.replace('tab-', ''));
      console.log(`DEBUG: Data for tab ${tab.id}:`, groupData);
      
      this.createTabContent(content, tab, groupData);
      contentContainer.appendChild(content);
      
      button.addEventListener('click', () => {
        // Remove active class from all buttons and contents
        tabsNav.querySelectorAll('.popup-tab-button').forEach(btn => 
          btn.classList.remove('active')
        );
        contentContainer.querySelectorAll('.popup-tab-content').forEach(content => 
          content.classList.remove('active')
        );
        
        // Add active class to clicked button and corresponding content
        button.classList.add('active');
        content.classList.add('active');
      });
    });

    // Add scroll buttons functionality
    leftArrow.onclick = () => {
      tabsNav.scrollBy({ left: -100, behavior: 'smooth' });
    };
    rightArrow.onclick = () => {
      tabsNav.scrollBy({ left: 100, behavior: 'smooth' });
    };
    
    // Update scroll buttons visibility
    const updateArrows = () => {
      const hasScroll = tabsNav.scrollWidth > tabsNav.clientWidth;
      const atStart = tabsNav.scrollLeft <= 0;
      const atEnd = tabsNav.scrollLeft >= (tabsNav.scrollWidth - tabsNav.clientWidth);

      leftArrow.classList.toggle('visible', hasScroll && !atStart);
      rightArrow.classList.toggle('visible', hasScroll && !atEnd);
    };
    
    // Add scroll event listener
    tabsNav.addEventListener('scroll', updateArrows);
    window.addEventListener('resize', updateArrows);
    
    wrapper.appendChild(leftArrow);
    wrapper.appendChild(tabsNav);
    wrapper.appendChild(rightArrow);
    
    container.appendChild(wrapper);
    container.appendChild(contentContainer);
    
    // Initial arrow state after a short delay to ensure content is rendered
    setTimeout(updateArrows, 100);
  }

  private getDataForGroup(groupId: string): PopupData[] {
    if (groupId === 'google-trends-tab') {
      // Get the region from the current layer's ID (ON or BC)
      const region = this.layerConfig.id.endsWith('ON') ? 'ON' : 'BC';
      
      // Filter data to only include layers from the same region
      return this.data.filter(item => 
        item.groupId === 'google-trends-group' && 
        item.layerId.endsWith(region)
      );
    }
    
    return this.data.filter(item => item.groupId === groupId);
  }

  private createTabContent(container: HTMLElement, tab: TabConfig, data: PopupData[]): void {
    console.log(`Creating content for tab ${tab.id} with data:`, data);

    if (data.length === 0) {
      container.innerHTML = '<div class="popup-no-data">No data available for this group</div>';
      return;
    }

    // Special handling for Google Trends tab
    if (tab.id === 'google-trends-tab') {
      this.createGoogleTrendsContent(container, data);
      return;
    }

    // Special handling for Voting Results tab
    if (tab.id === 'tab-voting-group') {
      this.createVotingResultsContent(container, data);
      return;
    }

    // Default handling for other tabs
    const chartSection = document.createElement('div');
    chartSection.className = 'chart-container';
    chartSection.style.height = '300px';
    
    const canvas = document.createElement('canvas');
    chartSection.appendChild(canvas);
    container.appendChild(chartSection);
    
    // Create chart data with statistics
    const chartData = data.map(d => {
      const valueField = d.type === 'index' ? d.rendererField : 
        Object.entries(d.values).find(([key, value]) => 
          typeof value === 'number' && 
          !key.toLowerCase().includes('id') && 
          !key.toLowerCase().includes('objectid') &&
          !key.toLowerCase().includes('shape') &&
          !key.toLowerCase().includes('area') &&
          !key.toLowerCase().includes('length')
        )?.[0] || 'value';

      // Handle no data values and normalize values for Google Trends layers
      const currentValue = d.stats?.currentValue === null || d.stats?.currentValue === undefined || isNaN(d.stats?.currentValue) ? 0 : d.stats.currentValue;
      const min = d.stats?.min === null || d.stats?.min === undefined || isNaN(d.stats?.min) ? 0 : d.stats.min;
      const max = d.stats?.max === null || d.stats?.max === undefined || isNaN(d.stats?.max) ? 0 : d.stats.max;
      const median = d.stats?.median === null || d.stats?.median === undefined || isNaN(d.stats?.median) ? 0 : d.stats.median;

      // Check if this is a Google Trends layer
      const isGoogleTrendsLayer = d.groupId === 'google-trends-group';

      // Normalize values for Google Trends layers
      const normalizedCurrentValue = isGoogleTrendsLayer ? 
        (max > 0 ? (currentValue / max) * 100 : 0) : currentValue;
      const normalizedMin = isGoogleTrendsLayer ? 
        (max > 0 ? (min / max) * 100 : 0) : min;
      const normalizedMax = isGoogleTrendsLayer ? 100 : max;
      const normalizedMedian = isGoogleTrendsLayer ? 
        (max > 0 ? (median / max) * 100 : 0) : median;

      return {
        label: d.layerName,
        currentValue: normalizedCurrentValue,
        min: normalizedMin,
        max: normalizedMax,
        median: normalizedMedian,
        valueField,
        isGoogleTrendsLayer
      };
    });

    // Sort data by current value (highest first)
    chartData.sort((a, b) => b.currentValue - a.currentValue);

    // Create the chart
    new ChartJS(canvas, {
      type: 'bar',
      data: {
        labels: chartData.map(d => d.label),
        datasets: [{
          data: chartData.map(d => d.currentValue),
            backgroundColor: chartData.map((_, index) => 
            DEFAULT_COLORS[index % DEFAULT_COLORS.length]
            ),
          borderColor: '#ffffff',
          borderWidth: 1
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top'
          },
          title: {
            display: true,
            text: tab.chartOptions?.title || tab.title,
            font: {
              size: 14
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const data = chartData[context.dataIndex];
                const currentValue = data.currentValue.toFixed(2);
                const min = data.min.toFixed(2);
                const max = data.max.toFixed(2);
                const median = data.median.toFixed(2);
                const unit = data.isGoogleTrendsLayer ? '%' : '';
                return [
                  `Current Value: ${currentValue}${unit}`,
                  `Dataset Range: ${min}${unit} - ${max}${unit}`,
                  `Median: ${median}${unit}`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: chartData.some(d => d.isGoogleTrendsLayer) ? 'Normalized Value (%)' : 'Value'
            }
          }
        }
      }
    });
  }

  private createVotingResultsContent(container: HTMLElement, data: PopupData[]): void {
    // Create chart section
    const chartSection = document.createElement('div');
    chartSection.className = 'chart-container';
    chartSection.style.height = '200px';
    container.appendChild(chartSection);

    const canvas = document.createElement('canvas');
    chartSection.appendChild(canvas);

    // Extract voting data
    const votingData = data[0]?.values || {};
    const candidates = Object.entries(votingData)
      .filter(([key]) => key.startsWith('Candidate_'))
      .map(([key, value]) => ({
        name: value as string,
        party: votingData[`Party_${key.split('_')[1]}`] as string,
        votes: votingData[`Votes_${key.split('_')[1]}`] as number
      }))
      .sort((a, b) => b.votes - a.votes);

    // Create pie chart
    new ChartJS(canvas, {
      type: 'pie',
      data: {
        labels: candidates.map(c => `${c.name} (${c.party})`),
        datasets: [{
          data: candidates.map(c => c.votes),
          backgroundColor: candidates.map((_, index) => 
            DEFAULT_COLORS[index % DEFAULT_COLORS.length]
          ),
          borderColor: '#ffffff',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              boxWidth: 12,
              font: {
                size: 11
              }
            }
          },
          title: {
            display: true,
            text: 'Vote Distribution',
            font: {
              size: 14
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const candidate = candidates[context.dataIndex];
                const percentage = ((candidate.votes / candidates.reduce((sum, c) => sum + c.votes, 0)) * 100).toFixed(1);
                return `${candidate.name} (${candidate.party}): ${candidate.votes.toLocaleString()} votes (${percentage}%)`;
              }
            }
          }
        }
      }
    });

    // Create table section
    const tableSection = document.createElement('div');
    tableSection.className = 'voting-table-container';
    tableSection.style.marginTop = '16px';
    container.appendChild(tableSection);

    const table = document.createElement('table');
    table.className = 'voting-results-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Candidate</th>
          <th>Party</th>
          <th>Votes</th>
          <th>Percentage</th>
        </tr>
      </thead>
      <tbody>
        ${candidates.map(candidate => {
          const percentage = ((candidate.votes / candidates.reduce((sum, c) => sum + c.votes, 0)) * 100).toFixed(1);
          return `
            <tr>
              <td>${candidate.name}</td>
              <td>${candidate.party}</td>
              <td>${candidate.votes.toLocaleString()}</td>
              <td>${percentage}%</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    `;
    tableSection.appendChild(table);

    // Add table styles
    const style = document.createElement('style');
    style.textContent = `
      .voting-results-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
        background: white;
        border-radius: 4px;
        overflow: hidden;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }

      .voting-results-table th,
      .voting-results-table td {
        padding: 8px 12px;
        text-align: left;
        border-bottom: 1px solid #e5e7eb;
      }

      .voting-results-table th {
        background-color: #f8fafc;
        font-weight: 600;
        color: #374151;
      }

      .voting-results-table tr:last-child td {
        border-bottom: none;
      }

      .voting-results-table tr:hover {
        background-color: #f8fafc;
      }

      .voting-table-container {
        max-height: 200px;
        overflow-y: auto;
      }
    `;
    container.appendChild(style);
  }

  private createGoogleTrendsContent(container: HTMLElement, data: PopupData[]): void {
    console.log('DEBUG: createGoogleTrendsContent received data:', data.map(d => ({
      layerName: d.layerName,
      layerId: d.layerId,
      values: d.values,
      rendererField: d.rendererField,
      stats: d.stats,
      rawValue: d.values[d.layerId] // Use d.layerId to access the value
    })));

    // Identify the currently active/clicked layer
    const activeLayerId = this.layerConfig.id;
    console.log('DEBUG: Active layer ID:', activeLayerId);

    // Create header section
    const headerSection = document.createElement('div');
    headerSection.className = 'google-trends-header';
    headerSection.style.marginBottom = '16px';
    
    // Extract area name from the first data item if available
    let areaName = "Selected Area";
    let hasData = true;

    if (data.length > 0) {
      // Try to find the CSDNAME in data attributes
      const firstItem = data[0];
      if (firstItem.values && firstItem.values.CSDNAME) {
        areaName = firstItem.values.CSDNAME;
      } else if (firstItem.values && firstItem.values.CDNAME) {
        areaName = firstItem.values.CDNAME;
      } else if (firstItem.values && firstItem.values.CSD_NAME) {
        areaName = firstItem.values.CSD_NAME;
      }
      
      // Check if the clicked area has data
      const activeLayerData = data.find(d => d.layerId === activeLayerId);
      const rawValue = activeLayerData?.values[activeLayerId];
      hasData = rawValue !== null && rawValue !== undefined && !isNaN(rawValue) && rawValue > 0;
      
      console.log('DEBUG: Area name extraction:', {
        areaName,
        hasData,
        rawValue,
        availableFields: Object.keys(firstItem.values || {})
      });
    }
    
    // Determine region (ON or BC)
    const region = activeLayerId.endsWith('ON') ? 'Ontario' : 'British Columbia';
    
    // Get active layer name
    const activeLayerData = data.find(d => d.layerId === activeLayerId);
    const activeLayerName = activeLayerData ? activeLayerData.layerName : "Selected Topic";
    
    // Add special note if the area has no data
    const noDataText = hasData ? '' : '<p style="font-size: 14px; margin: 4px 0; color: #e53e3e;"><strong>This area has little to no search data and appears in the lowest category on the map.</strong></p>';
    
    headerSection.innerHTML = `
      <h3 style="font-size: 16px; margin: 0 0 8px 0; color: #333;">Google Trends: ${region}</h3>
      <p style="font-size: 14px; margin: 0 0 4px 0; color: #555;">Location: <strong>${areaName}</strong></p>
      <p style="font-size: 14px; margin: 0; color: #555;">Showing search interest for <strong>${activeLayerName}</strong> and other topics in this area.</p>
      ${noDataText}
      <p style="font-size: 12px; margin: 4px 0 0 0; color: #777;">Values represent search interest on a scale of 0-100, relative to the highest point for the region.</p>
      <p style="font-size: 12px; margin: 4px 0 0 0; color: #777;">Date Range: Past 30 Days</p>
    `;
    
    container.appendChild(headerSection);

    // Create chart section with a fixed height but no scroll
    const chartSection = document.createElement('div');
    chartSection.className = 'chart-container';
    chartSection.style.height = '300px'; 
    chartSection.style.overflow = 'visible'; // Explicitly set overflow to visible
    container.appendChild(chartSection);

    const canvas = document.createElement('canvas');
    chartSection.appendChild(canvas);

    // Process the data - always treating no-data as 0
    const trendData = data
      .filter(d => d.values !== undefined && d.layerId !== undefined)
      .map(d => {
        // Get the value directly from the feature attributes using the layer ID
        // Make sure no-data is treated as 0
        const rawValue = d.values[d.layerId];
        const value = rawValue !== null && rawValue !== undefined && !isNaN(rawValue) ? rawValue : 0;
        
        console.log('DEBUG: Processing trend data for layer:', {
          layerName: d.layerName,
          layerId: d.layerId,
          rendererField: d.rendererField,
          rawValue: rawValue,
          normalizedValue: value
        });
        
        return {
          label: d.layerName,
          value: value,
          min: 0,
          max: 100,
          layerId: d.layerId
        };
      });

    // Sort data: active layer first, then remaining by descending value
    const sortedTrendData = trendData.sort((a, b) => {
      // Active layer always comes first
      if (a.layerId === activeLayerId) return -1;
      if (b.layerId === activeLayerId) return 1;
      // Otherwise sort by value (descending)
      return b.value - a.value;
    });

    console.log('DEBUG: Sorted trend data for chart:', sortedTrendData);

    // Create horizontal bar chart
    new ChartJS(canvas, {
      type: 'bar',
      data: {
        labels: sortedTrendData.map(d => d.label),
        datasets: [
          {
            label: 'Interest Index',
            data: sortedTrendData.map(d => d.value),
            backgroundColor: sortedTrendData.map((d, index) => 
              d.layerId === activeLayerId 
                ? '#33a852' // Highlight active layer with green
                : DEFAULT_COLORS[index % DEFAULT_COLORS.length]
            ),
            borderColor: sortedTrendData.map((d, index) => 
              d.layerId === activeLayerId 
                ? '#33a852' // Highlight active layer with green
                : DEFAULT_COLORS[index % DEFAULT_COLORS.length]
            ),
            borderWidth: 1,
            barThickness: 20
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: 'Google Trends Search Interest',
            font: {
              size: 14
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const data = sortedTrendData[context.dataIndex];
                return [
                  `Index Value: ${data.value.toFixed(0)}`,
                  `Range: 0-100`,
                  data.layerId === activeLayerId ? '(Current layer)' : ''
                ].filter(Boolean);
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: 'Interest Index (0-100)',
              font: {
                size: 12
              }
            },
            ticks: {
              font: {
                size: 11
              }
            }
          },
          y: {
            ticks: {
              font: {
                size: 11
              },
              maxRotation: 0,
              autoSkip: false,
              callback: function(tickValue: string | number, index: number, ticks: any[]) {
                // Get the label from the data array using the index
                const label = sortedTrendData[index]?.label || '';
                // Split long labels into multiple lines
                const words = label.split(' ');
                const lines = [];
                let currentLine = words[0];
                
                for (let i = 1; i < words.length; i++) {
                  const testLine = currentLine + ' ' + words[i];
                  if (testLine.length > 20) { // Adjust this number to control line length
                    lines.push(currentLine);
                    currentLine = words[i];
                  } else {
                    currentLine = testLine;
                  }
                }
                lines.push(currentLine);
                
                return lines;
              }
            },
            afterFit: function(scaleInstance) {
              // Add padding to the scale to accommodate wrapped labels
              scaleInstance.paddingBottom = 20;
            }
          }
        }
      }
    });

    // Update or remove the note at the bottom about no data areas
    const noteSection = document.createElement('div');
    noteSection.className = 'google-trends-note';
    noteSection.style.marginTop = '12px';
    noteSection.style.fontSize = '12px';
    noteSection.style.color = '#666';
    noteSection.innerHTML = '<p style="margin: 0;">Note: Areas with little to no search interest (0 value) appear in the lowest category (red) on the map.</p>';
    container.appendChild(noteSection);
  }

  private formatValue(value: any): string {
    if (value === undefined || value === null) return 'N/A';
    return typeof value === 'number' ? value.toFixed(1) : value.toString();
  }

  private getLayerStates(): { [key: string]: { layer: __esri.FeatureLayer | null } } | null {
    // First try to get from class instance
    if (this.layerStates && Object.keys(this.layerStates).length > 0) {
      return this.layerStates;
    }

    // Then try to get from view using Symbol
    const layerStates = (this.view as any)[EnhancedPopupTemplateBuilder.LAYER_STATES_SYMBOL];
    if (layerStates && Object.keys(layerStates).length > 0) {
      return layerStates;
    }

    // Finally, try to get from the map's layers
    const mapLayers = this.view.map.allLayers.toArray();
    const featureLayers = mapLayers.filter(layer => layer.type === 'feature') as __esri.FeatureLayer[];
    
    if (featureLayers.length > 0) {
      const reconstructedLayerStates: { [key: string]: { layer: __esri.FeatureLayer | null } } = {};
      featureLayers.forEach(layer => {
        reconstructedLayerStates[layer.id] = { layer };
      });
      return reconstructedLayerStates;
    }

    return null;
  }

  public buildPopupTemplate(): PopupTemplate {
    // Create the popup template
    const template = new PopupTemplate({
      title: this.config.titleField ? `{${this.config.titleField}}` : this.config.title,
      content: [
        {
          type: "custom",
          creator: (event: any) => {
            const container = document.createElement("div");
            container.className = "enhanced-popup-container";
            
            // Store the clicked geometry for emergency recovery
            if (event.graphic?.geometry) {
              lastClickedGeometry = event.graphic.geometry;
            }

            // Create tabs
            this.createTabs(container, this.config.tabs);

            // Set up popup event handlers using watch
            const popupWatchHandle = watch(
              () => this.view.popup?.visible,
              (newValue: boolean | undefined) => {
                if (newValue && this.view.popup?.selectedFeature) {
                  // Handle popup open
                  const feature = this.view.popup.selectedFeature;
                  if (feature) {
                    // Trigger any necessary actions when popup opens
                    this.handlePopupOpen(feature);
      }
                } else {
                  // Handle popup close
                  this.handlePopupClose();
                }
              }
            );

            // Store the watch handle for cleanup
            (container as any).__popupWatchHandle = popupWatchHandle;

            // Add cleanup function
            container.addEventListener('remove', () => {
              if ((container as any).__popupWatchHandle) {
                (container as any).__popupWatchHandle.remove();
                (container as any).__popupWatchHandle = null;
              }
            });

            return container;
          }
        }
      ],
      actions: this.config.actions?.map(action => ({
        type: "button" as const,
        id: action.id,
        title: action.title,
        className: action.className
      }))
    });

    return template;
  }

  private handlePopupOpen(feature: __esri.Graphic): void {
    // Handle popup open event
    console.log('Popup opened for feature:', feature);
  }

  private handlePopupClose(): void {
    // Handle popup close event
    console.log('Popup closed');
  }
}

// Remove all project-specific popup config functions and replace with a generic one
function createDefaultPopupConfig(layerConfig: LayerConfig, layerGroups: LayerGroup[]): EnhancedPopupConfig {
  // Check if this is a Google Trends layer
  const isGoogleTrendsLayer = layerGroups.some(group => 
    group.id === 'google-trends-group' && 
    (group.layers?.some(l => l.id === layerConfig.id) || 
     group.subGroups?.some(subGroup => 
       subGroup && subGroup.layers?.some(l => l.id === layerConfig.id)
     ))
  );

  if (isGoogleTrendsLayer) {
    return {
      title: "{CSDNAME}",
      titleField: "CSDNAME",
      tabs: [{
        id: 'google-trends-tab',
        title: 'Google Trends',
        content: 'chart',
        chartOptions: {
          type: 'bar',
          title: 'Google Trends Analysis',
          showLegend: false,
          colors: DEFAULT_COLORS
        }
      }],
      actions: [
        {
          type: "button",
          title: "Zoom to Feature",
          id: "zoom-to-feature",
          className: "esri-icon-zoom-in-magnifying-glass"
        },
        {
          type: "button",
          title: "Generate Infographics",
          id: "generate-infographics",
          className: "esri-icon-barchart"
        }
      ]
    };
  }

  // Create tabs dynamically from layer groups for non-Google Trends layers
  const tabs = layerGroups.map(group => ({
    id: group.id,
    title: group.title,
    content: 'chart' as const,
    chartOptions: {
      type: 'bar' as const,
      title: `${group.title} Comparison`,
      showLegend: true,
      colors: DEFAULT_COLORS
    }
  }));

  return {
    title: layerConfig.type === 'point' ? "{CONAME}" : "{ID}",
    titleField: layerConfig.type === 'point' ? 'CONAME' : 'ID',
    tabs,
    actions: [
      {
        type: "button",
        title: "Zoom to Feature",
        id: "zoom-to-feature",
        className: "esri-icon-zoom-in-magnifying-glass"
      },
      {
        type: "button",
        title: "Generate Infographics",
        id: "generate-infographics",
        className: "esri-icon-barchart"
      }
    ]
  };
}

/**
 * Main function to create enhanced popup templates for any layer
 */
export function createEnhancedPopupTemplate(
  layerConfig: LayerConfig,
  layerGroups: LayerGroup[],
  view: __esri.MapView,
  layerStates: { [key: string]: { layer: __esri.FeatureLayer | null } }
): PopupTemplate {
  console.log('createEnhancedPopupTemplate called with:', {
    layerConfigId: layerConfig.id,
    layerGroupsCount: layerGroups.length,
    layerStatesPresent: !!layerStates,
    layerStatesCount: layerStates ? Object.keys(layerStates).length : 0,
    layerStateKeys: layerStates ? Object.keys(layerStates) : []
  });

  // Special handling for point layers
  if (layerConfig.type === 'point') {
    return new PopupTemplate({
      title: "{CONAME}",
      outFields: ["CONAME", "ADDR"], // Only show specific fields, exclude ESRI_PID
      content: [
        {
          type: "fields",
          fieldInfos: [
            {
              fieldName: "CONAME",
              label: "Company Name",
              visible: true
            },
            {
              fieldName: "ADDR",
              label: "Address",
              visible: true
            }
          ]
        }
      ]
    });
  }

  // Get appropriate popup configuration for non-point layers
  const popupConfig = createDefaultPopupConfig(layerConfig, layerGroups);
  
  // Build and return the popup template
  const builder = new EnhancedPopupTemplateBuilder(
    layerConfig,
    layerGroups,
    view,
    layerStates
  );
  
  return builder.buildPopupTemplate();
}