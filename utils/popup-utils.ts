import PopupTemplate from '@arcgis/core/PopupTemplate';
import { PopupConfiguration, ContentElement, FieldsElement, FieldInfo } from '@/types/popup-config';
import Graphic from '@arcgis/core/Graphic';
import { PopupField, PopupConfig } from '../types/popup-config';
import Collection from '@arcgis/core/core/Collection';
import { FieldMappingHelper } from './visualizations/field-mapping-helper';
import { CustomContent } from '@arcgis/core/popup/content';

/**
 * Standardized popup configuration for all visualizations
 */
export interface StandardizedPopupConfig {
  /** Title field priority order */
  titleFields: string[];
  /** Fields to display in bar chart format */
  barChartFields: string[];
  /** Fields to display in simple list format */
  listFields: string[];
  /** Visualization type for custom handling */
  visualizationType?: string;
}

/**
 * Determines the best title for a popup based on available fields
 * Priority: DESCRIPTION > ID > FSA_ID > NAME > OBJECTID
 */
export function determinePopupTitle(attributes: { [key: string]: any }): string {
  // Check for lowercase 'name' first (for point layers like H&R Block)
  if (attributes.name !== undefined && attributes.name !== null && attributes.name.toString().trim()) {
    return attributes.name.toString().trim();
  }
  
  const titleFields = ['DESCRIPTION', 'ID', 'FSA_ID', 'NAME', 'OBJECTID'];
  
  for (const field of titleFields) {
    const value = attributes[field];
    if (value !== undefined && value !== null && value.toString().trim()) {
      // For ID fields, use as-is (zip code/geographic identifier)
      if (field === 'ID' || field === 'FSA_ID' || field === 'DESCRIPTION') {
        return value.toString().trim();
      }
      // For other fields, add context
      return field === 'OBJECTID' ? `Feature ${value}` : value.toString().trim();
    }
  }
  
  // Case-insensitive fallback search
  const keys = Object.keys(attributes);
  for (const priority of ['description', 'id', 'name']) {
    const key = keys.find(k => k.toLowerCase() === priority);
    if (key && attributes[key] && attributes[key].toString().trim()) {
      return attributes[key].toString().trim();
    }
  }
  
  return 'Feature Information';
}

/**
 * Creates a standardized popup template with proper title expressions and field content
 */
export function createStandardizedPopupTemplate(config: StandardizedPopupConfig): PopupTemplate {
  // Create title expression based on visualization type
  let titleExpression: string;
  
  if (config.visualizationType === 'point-location') {
    // For point/location layers, prioritize lowercase 'name' field first (for H&R Block), then uppercase NAME
    titleExpression = `
      IIf(
        HasKey($feature, 'name') && !IsEmpty($feature.name),
        $feature.name,
        IIf(
          HasKey($feature, 'NAME') && !IsEmpty($feature.NAME),
          $feature.NAME,
          IIf(
            HasKey($feature, 'DESCRIPTION') && !IsEmpty($feature.DESCRIPTION),
            $feature.DESCRIPTION,
            'Location'
          )
        )
      )
    `;
  } else {
    // For other layers, prioritize DESCRIPTION and ID fields
    titleExpression = `
      IIf(
        HasKey($feature, 'DESCRIPTION') && !IsEmpty($feature.DESCRIPTION),
        $feature.DESCRIPTION,
        IIf(
          HasKey($feature, 'ID') && !IsEmpty($feature.ID),
          $feature.ID,
          IIf(
            HasKey($feature, 'NAME') && !IsEmpty($feature.NAME),
            $feature.NAME,
            'Feature ' + $feature.OBJECTID
          )
        )
      )
    `;
  }

  // Create field info objects with proper formatting
  const fieldInfos: FieldInfo[] = [];
  
  // Add bar chart fields if available
  if (config.barChartFields && config.barChartFields.length > 0) {
    config.barChartFields.slice(0, 5).forEach(field => {
      const friendlyName = FieldMappingHelper.getFriendlyFieldName(field);
      fieldInfos.push({
        fieldName: field,
        label: friendlyName,
        visible: true,
        format: {
          digitSeparator: true,
          places: 2
        }
      });
    });
  }
  
  // Add list fields if available
  if (config.listFields && config.listFields.length > 0) {
    config.listFields.forEach(field => {
      const friendlyName = FieldMappingHelper.getFriendlyFieldName(field);
      fieldInfos.push({
        fieldName: field,
        label: friendlyName,
        visible: true,
        format: {
          digitSeparator: true,
          places: 2
        }
      });
    });
  }

  // If no specific fields provided, add default fields
  if (fieldInfos.length === 0) {
    // Add common demographic and brand fields
    const defaultFields = ['RANK', 'mp30034a_b', 'mp30029a_b', 'mp30034a_b_p', 'mp30029a_b_p'];
    defaultFields.forEach(field => {
      const friendlyName = FieldMappingHelper.getFriendlyFieldName(field);
      fieldInfos.push({
        fieldName: field,
        label: friendlyName,
        visible: true,
        format: {
          digitSeparator: true,
          places: 2
        }
      });
    });
  }

  return new PopupTemplate({
    title: titleExpression,
    outFields: ["*"],
    content: [
      {
        type: 'fields',
        fieldInfos: fieldInfos
      }
    ]
  });
}

/**
 * Generate a bar chart using the same styling as CustomPopupManager
 */
function generateStandardizedBarChart(
  feature: __esri.Graphic, 
  container: HTMLElement, 
  config: StandardizedPopupConfig
) {
  // Define bar colors (same as CustomPopupManager)
  const colors = [
    '#33a852', '#4285f4', '#fbbc05', '#ea4335', 
    '#5f6bfb', '#28b5f5', '#8e44ad', '#16a085',
    '#f39c12', '#2c3e50', '#7f8c8d', '#e74c3c'
  ];

  // Clear the container
  container.innerHTML = "";
  
  const attrs = feature.attributes || {};
  
  // Get numeric fields for bar chart display
  const barChartFields = config.barChartFields.filter(field => 
    attrs[field] !== undefined && 
    attrs[field] !== null &&
    typeof attrs[field] === 'number'
  );

  if (barChartFields.length > 0) {
    // Create metrics array
    interface Metric { label: string; value: number; color: string; }
    const metrics: Metric[] = [];

    barChartFields.forEach((field, index) => {
      const value = attrs[field];
      const friendlyName = FieldMappingHelper.getFriendlyFieldName(field);
      
      metrics.push({
        label: friendlyName,
        value: value,
        color: colors[index % colors.length]
      });
    });

    // Render each metric as a bar row (exact same styling as CustomPopupManager)
    metrics.forEach(metric => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.marginBottom = '8px';
      row.style.padding = '6px 8px';
      row.style.background = '#f8f9fa';
      row.style.borderRadius = '6px';

      // Label
      const label = document.createElement('div');
      label.textContent = metric.label;
      label.style.width = '120px';
      label.style.textAlign = 'right';
      label.style.fontSize = '12px';
      label.style.fontWeight = '500';
      label.style.whiteSpace = 'normal';
      label.style.wordBreak = 'break-word';

      // Bar wrapper
      const barWrapper = document.createElement('div');
      barWrapper.style.flex = '1';
      barWrapper.style.height = '18px';
      barWrapper.style.backgroundColor = '#e9ecef';
      barWrapper.style.borderRadius = '9px';
      barWrapper.style.margin = '0 12px';

      const barFill = document.createElement('div');
      // Calculate width percentage (same logic as CustomPopupManager)
      let widthPercent = 0;
      if (metric.value <= 1) {
        widthPercent = Math.min(Math.abs(metric.value) * 100, 100);
      } else {
        // Estimate scale based on value magnitude
        widthPercent = Math.min((metric.value / 100) * 100, 100);
      }
      barFill.style.width = `${Math.max(widthPercent, 5)}%`;
      barFill.style.height = '100%';
      barFill.style.backgroundColor = metric.color;
      barFill.style.borderRadius = '9px';

      // Value text
      const valueText = document.createElement('div');
      valueText.textContent = metric.value.toLocaleString(undefined, { maximumFractionDigits: 3 });
      valueText.style.minWidth = '60px';
      valueText.style.textAlign = 'right';
      valueText.style.fontSize = '12px';
      valueText.style.fontWeight = '600';
      valueText.style.color = '#495057';

      barWrapper.appendChild(barFill);
      row.appendChild(label);
      row.appendChild(barWrapper);
      row.appendChild(valueText);
      container.appendChild(row);
    });
  }

  // Show the container
  container.style.display = 'block';
}

/**
 * Creates standardized popup content with title and bar chart matching existing popup styling
 */
export function createStandardizedPopupContent(
  graphic: __esri.Graphic, 
  config: StandardizedPopupConfig
): HTMLElement {
  // Create the main popup container with existing styling
  const popupContainer = document.createElement('div');
  popupContainer.className = 'custom-popup';
  
  // Create the popup header (matching existing green header style)
  const popupHeader = document.createElement('div');
  popupHeader.style.display = 'flex';
  popupHeader.style.justifyContent = 'space-between';
  popupHeader.style.alignItems = 'center';
  popupHeader.style.padding = '12px 16px';
  popupHeader.style.borderBottom = '1px solid rgba(0,0,0,0.05)';
  popupHeader.style.backgroundColor = '#33a852';
  popupHeader.style.color = 'white';
  popupHeader.style.borderTopLeftRadius = '8px';
  popupHeader.style.borderTopRightRadius = '8px';
  
  // Create title with existing styling
  const title = document.createElement('h3');
  title.style.margin = '0';
  title.style.fontSize = '12px';
  title.style.fontWeight = 'bold';
  title.style.color = 'white';
  
  const attributes = graphic.attributes || {};
  const titleText = determinePopupTitle(attributes);
  title.textContent = titleText;
  popupHeader.appendChild(title);

  // Create popup content with existing padding
  const popupContent = document.createElement('div');
  popupContent.style.padding = '16px';
  popupContent.style.maxHeight = '400px';
  popupContent.style.overflow = 'auto';

  // Create bar chart section for numeric fields
  const barChartFields = config.barChartFields.filter(field => 
    attributes[field] !== undefined && 
    attributes[field] !== null &&
    typeof attributes[field] === 'number'
  );

  if (barChartFields.length > 0) {
    // Create chart container with existing styling
    const chartContainer = document.createElement('div');
    chartContainer.style.display = 'block';
    chartContainer.style.marginBottom = '16px';

    // Create bar chart using existing generateBarChart styling patterns
    const maxValue = Math.max(...barChartFields.map(field => Math.abs(attributes[field])));
    const colors = ['#33a852', '#4285f4', '#fbbc05', '#ea4335', '#5f6bfb', '#28b5f5'];

    barChartFields.forEach((field, index) => {
      const value = attributes[field];
      const friendlyName = FieldMappingHelper.getFriendlyFieldName(field);
      
      // Create bar row matching existing popup bar chart style
      const barRow = document.createElement('div');
      barRow.style.display = 'flex';
      barRow.style.alignItems = 'center';
      barRow.style.marginBottom = '8px';
      barRow.style.padding = '6px 8px';
      barRow.style.background = '#f8f9fa';
      barRow.style.borderRadius = '6px';

      // Field label (matching existing style)
      const label = document.createElement('div');
      label.textContent = friendlyName;
      label.style.width = '120px';
      label.style.textAlign = 'right';
      label.style.fontSize = '12px';
      label.style.fontWeight = '500';
      label.style.whiteSpace = 'normal';
      label.style.wordBreak = 'break-word';

      // Bar wrapper (matching existing style)
      const barWrapper = document.createElement('div');
      barWrapper.style.flex = '1';
      barWrapper.style.height = '18px';
      barWrapper.style.backgroundColor = '#e9ecef';
      barWrapper.style.borderRadius = '9px';
      barWrapper.style.margin = '0 12px';

      // Bar fill (matching existing style)
      const barFill = document.createElement('div');
      const percentage = maxValue > 0 ? Math.min((Math.abs(value) / maxValue) * 100, 100) : 0;
      barFill.style.width = `${Math.max(percentage, 5)}%`;
      barFill.style.height = '100%';
      barFill.style.backgroundColor = colors[index % colors.length];
      barFill.style.borderRadius = '9px';

      // Value text (matching existing style)
      const valueText = document.createElement('div');
      valueText.textContent = formatValue(value);
      valueText.style.minWidth = '60px';
      valueText.style.textAlign = 'right';
      valueText.style.fontSize = '12px';
      valueText.style.fontWeight = '600';
      valueText.style.color = '#495057';

      barWrapper.appendChild(barFill);
      barRow.appendChild(label);
      barRow.appendChild(barWrapper);
      barRow.appendChild(valueText);
      chartContainer.appendChild(barRow);
    });

    popupContent.appendChild(chartContainer);
  }

  // Create list section for other fields (if any)
  const listFields = config.listFields.filter(field => 
    attributes[field] !== undefined && 
    attributes[field] !== null &&
    !barChartFields.includes(field)
  );

  if (listFields.length > 0) {
    const listSection = document.createElement('div');
    listSection.style.marginTop = '12px';
    listSection.style.borderTop = '1px solid #eee';
    listSection.style.paddingTop = '12px';

    listFields.forEach(field => {
      const value = attributes[field];
      const friendlyName = FieldMappingHelper.getFriendlyFieldName(field);
      
      const listRow = document.createElement('div');
      listRow.style.display = 'flex';
      listRow.style.justifyContent = 'space-between';
      listRow.style.padding = '4px 0';
      listRow.style.fontSize = '12px';

      const fieldLabel = document.createElement('span');
      fieldLabel.textContent = friendlyName;
      fieldLabel.style.fontWeight = '500';
      fieldLabel.style.color = '#555';

      const fieldValue = document.createElement('span');
      fieldValue.textContent = formatValue(value);
      fieldValue.style.color = '#333';
      fieldValue.style.fontWeight = '600';

      listRow.appendChild(fieldLabel);
      listRow.appendChild(fieldValue);
      listSection.appendChild(listRow);
    });

    popupContent.appendChild(listSection);
  }

  // Assemble the complete popup
  const container = document.createElement('div');
  container.appendChild(popupHeader);
  container.appendChild(popupContent);

  return container;
}

/**
 * Formats a value for display in popups
 */
export function formatValue(value: any): string {
  if (typeof value === 'number') {
    // Handle percentages
    if (value >= 0 && value <= 1) {
      return `${(value * 100).toFixed(1)}%`;
    }
    // Handle large numbers
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    // Handle decimals
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  
  if (typeof value === 'string') {
    return value;
  }
  
  return String(value);
}

/**
 * Converts our custom popup configuration to an ArcGIS PopupTemplate
 */
export function createPopupTemplateFromConfig(config: PopupConfiguration): __esri.PopupTemplate {
  const template = new PopupTemplate({
    title: config.titleExpression || '{DESCRIPTION}',
    outFields: ['*'] // Return all fields
  });

  // Convert our custom content elements to ArcGIS popup content
  const contentItems: any[] = [];
  
  config.content.forEach(element => {
    const contentItem = convertContentElementToArcGIS(element);
    if (contentItem) {
      contentItems.push(contentItem);
    }
  });

  template.content = contentItems;

  // Add custom class for styling
  template.overwriteActions = true;

  // Create actions as a Collection instead of an array
  const actionItems = [
    {
      id: "zoom-to",
      title: "Zoom To",
      className: "esri-icon-zoom-in-magnifying-glass"
    },
    {
      id: "show-infographics",
      title: "Infographics",
      className: "esri-icon-chart"
    }
  ];

  // Add "View Properties" action for aggregate views that support drilldown
  // This will be conditionally shown based on feature attributes
  actionItems.push({
    id: "view-properties",
    title: "View Properties",
    className: "esri-icon-collection"
  });

  // Create a proper Collection for the actions
  template.actions = new Collection(actionItems);

  return template;
}

/**
 * Converts a single content element to an ArcGIS popup content item
 */
function convertContentElementToArcGIS(element: ContentElement): any {
  // Use type assertion to ensure the element is treated as having a type property
  const elementWithType = element as { type: string };
  
  switch (elementWithType.type) {
    case 'fields':
      return createFieldsContent(element as FieldsElement);
    
    case 'arcade':
      return {
        type: 'text',
        text: `{expression/custom-expression-${Math.random().toString(36).substring(2, 9)}}`
      };
    
    case 'chart':
      return createChartContent(element);
    
    case 'text':
      return {
        type: 'text',
        text: (element as any).text
      };
    
    case 'table':
      return createTableContent(element);
    
    default:
      console.warn(`Unsupported content element type: ${elementWithType.type}`);
      return null;
  }
}

/**
 * Creates a fields content item from our fields element
 */
function createFieldsContent(element: FieldsElement): any {
  return {
    type: 'fields',
    fieldInfos: element.fieldInfos.map(convertFieldInfo)
  };
}

/**
 * Converts our field info to ArcGIS field info
 */
function convertFieldInfo(fieldInfo: FieldInfo): any {
  const result: any = {
    fieldName: fieldInfo.fieldName,
    label: FieldMappingHelper.getFriendlyFieldName(fieldInfo.label || fieldInfo.fieldName),
    visible: fieldInfo.visible !== false
  };

  if (fieldInfo.format) {
    // Create format object with allowed properties
    result.format = {
      // Provide default values for required properties
      digitSeparator: fieldInfo.format.digitSeparator || false,
      places: fieldInfo.format.places || 0
    };

    // Add dateFormat if present
    if (fieldInfo.format.dateFormat) {
      result.format.dateFormat = fieldInfo.format.dateFormat;
    }

    // Add any custom properties via type assertion
    const formatAny = fieldInfo.format as any;
    if (formatAny.prefix) {
      result.format.prefix = formatAny.prefix;
    }

    if (formatAny.suffix) {
      result.format.suffix = formatAny.suffix;
    }
  }

  return result;
}

/**
 * Creates a chart content item
 */
function createChartContent(element: any): any {
  return {
    type: 'media',
    mediaInfos: [
      {
        title: element.title || 'Chart',
        type: convertChartType(element.chartType),
        value: {
          fields: element.fields,
          normalizeField: null,
          tooltipField: element.labelField
        }
      }
    ]
  };
}

/**
 * Converts our chart type to ArcGIS chart type
 */
function convertChartType(chartType: string): string {
  switch (chartType) {
    case 'bar': return 'column-chart';
    case 'line': return 'line-chart';
    case 'pie': return 'pie-chart';
    case 'donut': return 'pie-chart'; // ArcGIS doesn't have a specific donut type
    default: return 'column-chart';
  }
}

/**
 * Creates a table content item
 */
function createTableContent(element: any): any {
  return {
    type: 'fields',
    fieldInfos: element.fields.map((field: any) => ({
      fieldName: field.name,
      label: field.label || field.name,
      visible: true
    }))
  };
}

/**
 * Creates a custom content wrapper with our styling
 */
export function createCustomStyledContent(content: any): any {
  return {
    type: 'custom',
    outFields: ['*'],
    creator: (graphic: __esri.Graphic) => {
      const div = document.createElement('div');
      div.className = 'custom-popup-container';
      
      // Add header
      const header = document.createElement('div');
      header.className = 'custom-popup-header';
      
      const title = document.createElement('h2');
      title.className = 'custom-popup-title';
      title.textContent = graphic.attributes.DESCRIPTION || graphic.attributes.NAME || graphic.attributes.FEDENAME || 
                         graphic.attributes.CSDNAME || `Feature ${graphic.attributes.OBJECTID}`;
      
      header.appendChild(title);
      div.appendChild(header);
      
      // Add content
      const contentDiv = document.createElement('div');
      contentDiv.className = 'custom-popup-content';
      
      // Render content (simplistic version, would be more complex in real implementation)
      if (Array.isArray(content)) {
        content.forEach(item => {
          if (item.type === 'fields') {
            // Render fields
            const fieldList = document.createElement('div');
            fieldList.className = 'field-list';
            
            item.fieldInfos.forEach((field: any) => {
              if (!field.visible) return;
              
              const fieldItem = document.createElement('div');
              fieldItem.className = 'field-item';
              
              const label = document.createElement('div');
              label.className = 'field-label';
              label.textContent = field.label || field.fieldName;
              
              const value = document.createElement('div');
              value.className = 'field-value';
              value.textContent = graphic.attributes[field.fieldName] || 'N/A';
              
              fieldItem.appendChild(label);
              fieldItem.appendChild(value);
              fieldList.appendChild(fieldItem);
            });
            
            contentDiv.appendChild(fieldList);
          }
        });
      }
      
      div.appendChild(contentDiv);
      
      // Add buttons
      const actions = document.createElement('div');
      actions.className = 'custom-popup-actions';
      
      // Zoom button
      const zoomButton = document.createElement('button');
      zoomButton.className = 'custom-popup-button custom-popup-button-primary';
      zoomButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 10C15 12.21 13.21 14 11 14C8.79 14 7 12.21 7 10C7 7.79 8.79 6 11 6C13.21 6 15 7.79 15 10Z" stroke="currentColor" stroke-width="2"/><path d="M14 13L18 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Zoom to';
      zoomButton.addEventListener('click', () => {
        // Dispatch custom event for map view to handle
        window.dispatchEvent(new CustomEvent('zoom-to-feature', { 
          detail: { featureId: graphic.attributes.OBJECTID } 
        }));
      });
      
      // Infographics button
      const infoButton = document.createElement('button');
      infoButton.className = 'custom-popup-button custom-popup-button-secondary';
      infoButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 21H3V3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M7 14L12 9L17 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Infographics';
      infoButton.addEventListener('click', () => {
        console.log('[Infographics Button] Button clicked!');
        
        try {
          const geometry = graphic.geometry;
          console.log('[Infographics Button] Geometry object:', geometry);
          
          if (!geometry) {
            console.error('[Infographics Button] No geometry found');
            return;
          }

          console.log('[Infographics Button] Geometry type:', geometry.type);

          const geometryData = {
            type: geometry.type,
            rings: geometry.type === 'polygon' ? (geometry as __esri.Polygon).rings : undefined,
            x: geometry.type === 'point' ? (geometry as __esri.Point).x : undefined,
            y: geometry.type === 'point' ? (geometry as __esri.Point).y : undefined,
            spatialReference: geometry.spatialReference.toJSON()
          };
          
          console.log('[Infographics Button] Geometry data to store:', geometryData);
          
          localStorage.setItem('emergencyGeometry', JSON.stringify(geometryData));
          console.log('[Infographics Button] Stored geometry in localStorage');
          
          // Verify storage worked
          const stored = localStorage.getItem('emergencyGeometry');
          console.log('[Infographics Button] Verification - stored data exists:', !!stored);
          
          // Add a small delay to ensure localStorage is written before opening panel
          setTimeout(() => {
            document.dispatchEvent(new CustomEvent('openInfographics'));
            console.log('[Infographics Button] Event dispatched');
          }, 50);
          
        } catch (error) {
          console.error('[Infographics Button] Error:', error);
        }
      });
      
      actions.appendChild(zoomButton);
      actions.appendChild(infoButton);
      div.appendChild(actions);
      
      return div;
    }
  };
}

/**
 * Creates a default popup configuration for a layer
 * @param layer - The ArcGIS FeatureLayer
 * @returns A PopupConfiguration object
 */
export function createDefaultPopupConfig(layer: __esri.FeatureLayer): PopupConfiguration {
  // Use the helper to create friendly names for all fields
  const fieldInfos: FieldInfo[] = layer.fields
    .filter(field => !['objectid', 'shape__area', 'shape__length'].includes(field.name.toLowerCase()))
    .map(field => ({
      fieldName: field.name,
      label: FieldMappingHelper.getFriendlyFieldName(field.name, layer.id), // Use the helper
      visible: true,
      format: getFormatForField(field)
    }));

  // Prioritize DESCRIPTION for the title, then the first string field, then OBJECTID
  const titleField = layer.fields.find(f => f.name.toUpperCase() === 'DESCRIPTION')?.name ||
                   layer.fields.find(f => f.type === 'string' && f.name.toLowerCase() !== 'objectid')?.name ||
                   'OBJECTID';

  return {
    titleExpression: `{${titleField}}`,
    content: [
      {
        type: 'fields',
        fieldInfos
      }
    ]
  };
}

/**
 * Gets format configuration for a field based on its type
 */
function getFormatForField(field: __esri.Field): any {
  const type = field.type.toLowerCase();
  
  if (type.includes('double') || type.includes('float')) {
    return {
      digitSeparator: true,
      places: 2
    };
  }
  
  if (type.includes('int')) {
    return {
      digitSeparator: true,
      places: 0
    };
  }
  
  if (type.includes('date')) {
    return {
      dateFormat: 'short-date'
    };
  }
  
  return null;
}

/**
 * Utility function to create a simple popup config for a layer
 */
export function createSimplePopupConfigForLayer(
  layer: __esri.FeatureLayer, 
  titleField: string = 'NAME'
): PopupConfiguration {
  if (!layer.loaded) {
    console.warn('Layer not loaded, creating default popup config');
    return {
      titleExpression: `Feature {OBJECTID}`,
      content: [
        {
          type: 'fields',
          fieldInfos: [],
          displayType: 'list'
        }
      ]
    };
  }

  // Get fields from the layer
  const fields = layer.fields || [];
  
  // Create field infos
  const fieldInfos: FieldInfo[] = fields.map(field => ({
    fieldName: field.name,
    label: FieldMappingHelper.getFriendlyFieldName(field.name) || field.alias || field.name,
    visible: true,
    format: {
      digitSeparator: /^(number|double|float|integer)$/i.test(field.type),
      places: /^(number|double|float)$/i.test(field.type) ? 2 : 0,
      dateFormat: /^date/i.test(field.type) ? 'short-date' : undefined
    }
  }));

  // Create title expression based on title field - prioritize DESCRIPTION
  let titleExpression = `Feature {OBJECTID}`;
  if (fields.some(f => f.name.toUpperCase() === 'DESCRIPTION')) {
    titleExpression = `{DESCRIPTION}`;
  } else if (fields.some(f => f.name === titleField)) {
    titleExpression = `{${titleField}}`;
  }

  return {
    titleExpression,
    content: [
      {
        type: 'fields',
        fieldInfos,
        displayType: 'list'
      }
    ]
  };
}

/**
 * Get popup fields for a feature based on the popup configuration
 * @param feature Feature to get fields for
 * @param config Popup configuration
 * @returns Array of popup fields
 */
export const getPopupFields = (feature: Graphic, config: PopupConfig): PopupField[] => {


  // If config has a getFields function, use it
  if (config.getFields) {
    return config.getFields(feature);
  }
  
  // Determine the fields array - either directly or by calling the function
  let fieldsArray: PopupField[] = [];
  if (typeof config.fields === 'function') {
    // Call the function, passing the layer from the feature
    fieldsArray = config.fields(feature.layer as __esri.FeatureLayer);
  } else if (Array.isArray(config.fields)) {
    // Use the array directly
    fieldsArray = config.fields;
  }

  // Filter visible fields from the determined array
  if (fieldsArray.length > 0) {
    return fieldsArray.filter(field => field.visible !== false);
  }
  
  // If no fields are configured, try to generate them from feature attributes
  const attributes = feature.attributes || {};
  const fields: PopupField[] = [];
  
  // Skip these common system fields
  const skipFields = [
    'OBJECTID', 'FID', 'Shape', 'Shape_Length', 
    'Shape_Area', 'SHAPE', 'Shape.STArea()', 
    'Shape.STLength()', 'GlobalID'
  ];
  
  // Log what we're using as fallback
  console.log('[getPopupFields] Creating fields from attributes, found:', Object.keys(attributes).length, 'attributes');
  
  Object.keys(attributes).forEach(key => {
    if (!skipFields.includes(key) && 
        !skipFields.includes(key.toUpperCase()) &&
        !key.startsWith('Shape__') &&
        !key.startsWith('SHAPE__')) {
      
      fields.push({
        fieldName: key,
        label: formatFieldName(key),
        decimals: typeof attributes[key] === 'number' ? 2 : undefined
      });
    }
  });
  
  console.log('[getPopupFields] Generated', fields.length, 'fields from attributes');
  return fields;
};

/**
 * Format a field name to be more human-readable
 * @param fieldName Field name to format
 * @returns Formatted field name
 */
export const formatFieldName = (fieldName: string): string => {
  if (!fieldName) return '';
  
  // Replace underscores with spaces
  let formatted = fieldName.replace(/_/g, ' ');
  
  // Convert camelCase to Title Case
  formatted = formatted.replace(/([A-Z])/g, ' $1');
  
  // Capitalize first letter of each word
  formatted = formatted.replace(/\b\w/g, (c) => c.toUpperCase());
  
  return formatted.trim();
};

 