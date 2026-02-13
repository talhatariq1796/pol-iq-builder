import { LegendItem } from '@/types/geospatial-chat-component';

/**
 * Extracts formatted legend data from a ClassBreaksRenderer
 * @param renderer The ClassBreaksRenderer to extract data from
 * @returns Array of LegendItems with label, color, and min/max values
 */
export function formatLegendDataFromRenderer(renderer: __esri.Renderer): LegendItem[] {
  if (!renderer) {
    console.warn('No renderer provided to formatLegendDataFromRenderer');
    return [];
  }

  const legendItems: LegendItem[] = [];
  
  try {
    // Handle ClassBreaksRenderer
    if (renderer.type === 'class-breaks') {
      const classBreaksRenderer = renderer as __esri.ClassBreaksRenderer;
      const breaks = classBreaksRenderer.classBreakInfos;
      
      if (breaks && breaks.length > 0) {
        breaks.forEach((breakInfo, index) => {
          // Handle both ArcGIS Color objects and direct array format
          let color = '#CCCCCC';
          let opacity = 1;
          
          if (breakInfo.symbol?.color) {
            if (Array.isArray(breakInfo.symbol.color)) {
              // Direct array format: [r, g, b, opacity]
              const [r, g, b, a] = breakInfo.symbol.color;
              color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
              opacity = a || 1;
            } else if (breakInfo.symbol.color.toHex) {
              // ArcGIS Color object
              color = breakInfo.symbol.color.toHex();
              opacity = breakInfo.symbol.color.a || 1;
            }
          }
          
          const minValue = index === 0 ? breakInfo.minValue : breaks[index - 1].maxValue;
          const maxValue = breakInfo.maxValue;
          
          legendItems.push({
            label: breakInfo.label || `${minValue} - ${maxValue}`,
            color: `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, ${opacity})`,
            minValue: minValue,
            maxValue: maxValue
          });
        });
      }
    } 
    // Handle SimpleRenderer
    else if (renderer.type === 'simple') {
      const simpleRenderer = renderer as __esri.SimpleRenderer;
      const color = simpleRenderer.symbol?.color?.toHex() || '#CCCCCC';
      
      legendItems.push({
        label: simpleRenderer.label || 'All features',
        color: color
      });
    }
    // Handle UniqueValueRenderer 
    else if (renderer.type === 'unique-value') {
      const uniqueValueRenderer = renderer as __esri.UniqueValueRenderer;
      const uniqueValues = uniqueValueRenderer.uniqueValueInfos;
      
      if (uniqueValues && uniqueValues.length > 0) {
        uniqueValues.forEach(valueInfo => {
          const color = valueInfo.symbol?.color?.toHex() || '#CCCCCC';
          
          legendItems.push({
            label: valueInfo.label || valueInfo.value?.toString() || 'Unknown',
            color: color
          });
        });
      }
    }
    else {
      console.warn(`Unsupported renderer type: ${renderer.type}`);
    }
  } catch (error) {
    console.error('Error formatting legend data from renderer:', error);
  }
  
  return legendItems;
} 