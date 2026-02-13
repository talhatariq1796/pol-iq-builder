import React from 'react';
import { ChartElement } from '@/types/popup-config';

interface PopupChartProps extends ChartElement {
  feature: __esri.Graphic;
}

/**
 * Renders a chart visualization of feature attributes
 */
const PopupChart: React.FC<PopupChartProps> = ({ 
  feature, 
  chartType, 
  title, 
  fields, 
  labelField,
  height = 200,
  width = 'auto',
  colors
}) => {
  // Extract data from feature attributes for the specified fields
  const getData = () => {
    if (!feature || !feature.attributes) {
      return [];
    }

    return fields.map(field => ({
      name: field,
      value: feature.attributes[field] || 0
    }));
  };

  // Get chart data from feature attributes
  const data = getData();

  // Simple implementation without an actual chart library
  // In a real implementation, you would use a library like Recharts, Chart.js, etc.
  return (
    <div className="popup-chart" style={{ height: typeof height === 'number' ? `${height}px` : height }}>
      <h3 className="chart-title text-xs font-medium mb-2">{title || 'Chart'}</h3>
      
      {data.length === 0 ? (
        <div className="chart-no-data text-gray-400 text-xs">No data available</div>
      ) : (
        <div className="chart-placeholder bg-gray-100 p-4 rounded-md">
          <div className="text-xs text-gray-500 mb-2">Chart Type: {chartType}</div>
          <div className="grid grid-cols-2 gap-2">
            {data.map((item, index) => (
              <div key={index} className="text-xs">
                <span className="font-medium">{item.name}:</span> {item.value}
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-400 mt-3">
            Note: This is a placeholder. In a real implementation, a {chartType} chart would be rendered here.
          </div>
        </div>
      )}
    </div>
  );
};

export default PopupChart; 