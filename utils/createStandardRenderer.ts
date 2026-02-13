import Color from "@arcgis/core/Color";
import ClassBreaksRenderer from "@arcgis/core/renderers/ClassBreaksRenderer";
import ClassBreakInfo from "@arcgis/core/renderers/support/ClassBreakInfo";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";

function getValueExpression(fieldType: string): string {
  switch (fieldType) {
    case 'ev_percentage':
      return `
        var total = IIf(IsEmpty($feature["sum_USER_Grand_Total"]), 0, Number($feature["sum_USER_Grand_Total"]));
        if (total == 0) { return 0; }
        
        var ev = IIf(IsEmpty($feature["sum_USER_Battery Electric"]), 0, Number($feature["sum_USER_Battery Electric"]));
        var plugin = IIf(IsEmpty($feature["sum_USER_Plug-in Hybrid"]), 0, Number($feature["sum_USER_Plug-in Hybrid"]));
        
        return (ev + plugin) / total * 100;
      `;

    case 'hybrid_percentage':
      return `
        var total = IIf(IsEmpty($feature["sum_USER_Grand_Total"]), 0, Number($feature["sum_USER_Grand_Total"]));
        if (total == 0) { return 0; }
        
        var hybrid = IIf(IsEmpty($feature["sum_USER_Hybrid_Gasoline"]), 0, Number($feature["sum_USER_Hybrid_Gasoline"]));
        var plugin = IIf(IsEmpty($feature["sum_USER_Plug-in Hybrid"]), 0, Number($feature["sum_USER_Plug-in Hybrid"]));
        
        return (hybrid + plugin) / total * 100;
      `;

    case 'total_vehicles':
      return `
        var total = IIf(IsEmpty($feature["sum_USER_Grand_Total"]), 0, Number($feature["sum_USER_Grand_Total"]));
        if (total > 50000) { return 50000; }  // Cap at 50000 to handle high values
        return total;
      `;

    default:
      return '0';
  }
}

function getRendererConfig(fieldType: string) {
  const colorStops = [
    [239, 59, 44, 0.6],   // red with 0.6 opacity
    [255, 127, 0, 0.6],   // orange with 0.6 opacity
    [158, 215, 152, 0.6], // light green with 0.6 opacity
    [49, 163, 84, 0.6]    // green with 0.6 opacity
  ];

  switch (fieldType) {
    case 'total_vehicles':
      return {
        breaks: [5000, 15000, 30000, 50000],  // Adjusted for full range
        colors: colorStops
      };
    
    case 'ev_percentage':
    case 'hybrid_percentage':
      return {
        breaks: [2, 5, 10, 15],
        colors: colorStops
      };
    
    default:
      throw new Error(`Unsupported field type: ${fieldType}`);
  }
}

const createStandardRenderer = async (layer: __esri.FeatureLayer, fieldType: string): Promise<__esri.ClassBreaksRenderer> => {
  try {
    const config = getRendererConfig(fieldType);
    const expression = getValueExpression(fieldType);
    
    const renderer = new ClassBreaksRenderer({
      valueExpression: expression,
      defaultSymbol: new SimpleFillSymbol({
        color: new Color([200, 200, 200, 0.25]),
        outline: { 
          color: new Color([128, 128, 128, 0.5]), 
          width: 0.5 
        }
      }),
      defaultLabel: fieldType === 'total_vehicles' ? "< 5,000" : "No Data",
      classBreakInfos: config.breaks.map((break_, i) => {
        return new ClassBreakInfo({
          minValue: i === 0 ? 0 : config.breaks[i - 1],
          maxValue: break_,
          symbol: new SimpleFillSymbol({
            color: new Color(config.colors[i]),
            outline: { 
              color: new Color([128, 128, 128, 0.5]), 
              width: 0.5 
            }
          }),
          label: i === config.breaks.length - 1
            ? `${(i === 0 ? 0 : config.breaks[i - 1]).toLocaleString()}+${fieldType.includes('percentage') ? '%' : ''}`
            : `${i === 0 ? '0' : config.breaks[i - 1].toLocaleString()} - ${break_.toLocaleString()}${fieldType.includes('percentage') ? '%' : ''}`
        });
      })
    });

    return renderer;

  } catch (error) {
    console.error('Error in createStandardRenderer:', error);
    throw error;
  }
};

export { createStandardRenderer, getValueExpression };