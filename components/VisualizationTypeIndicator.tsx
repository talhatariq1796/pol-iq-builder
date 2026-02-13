import React from 'react';
import { VisualizationType } from '../config/dynamic-layers';

interface VisualizationTypeIndicatorProps {
  visualizationType: VisualizationType;
  className?: string;
}

/**
 * Component to display the current visualization type in the UI
 */
const VisualizationTypeIndicator: React.FC<VisualizationTypeIndicatorProps> = ({ 
  visualizationType, 
  className = '' 
}) => {
  // Map visualization types to display names and icons
  const typeInfo: Partial<Record<VisualizationType, { name: string; icon: string }>> = {
    [VisualizationType.CHOROPLETH]: { name: 'Choropleth', icon: '🗺️' },
    [VisualizationType.HEATMAP]: { name: 'Heatmap', icon: '🔥' },
    [VisualizationType.SCATTER]: { name: 'Scatter', icon: '📍' },
    [VisualizationType.CLUSTER]: { name: 'Cluster', icon: '🔮' },
    [VisualizationType.CATEGORICAL]: { name: 'Categorical', icon: '🏷️' },
    [VisualizationType.TRENDS]: { name: 'Trends', icon: '📈' },
    [VisualizationType.CORRELATION]: { name: 'Correlation', icon: '🔄' },
    [VisualizationType.JOINT_HIGH]: { name: 'Joint High', icon: '🔝' },
    [VisualizationType.PROPORTIONAL_SYMBOL]: { name: 'Proportional Symbol', icon: '⭕' },
    [VisualizationType.COMPARISON]: { name: 'Comparison', icon: '⚖️' },
    [VisualizationType.TOP_N]: { name: 'Top N', icon: '🏆' },
    [VisualizationType.HEXBIN]: { name: 'Hexbin', icon: '🔷' },
    [VisualizationType.BIVARIATE]: { name: 'Bivariate', icon: '🎨' },
    [VisualizationType.BUFFER]: { name: 'Buffer', icon: '⚪' },
    [VisualizationType.HOTSPOT]: { name: 'Hotspot', icon: '🔴' },
    [VisualizationType.NETWORK]: { name: 'Network', icon: '🕸️' },
    [VisualizationType.MULTIVARIATE]: { name: 'Multivariate', icon: '📊' },
    [VisualizationType.CROSS_GEOGRAPHY_CORRELATION]: { name: 'Cross Geography Correlation', icon: '🌐' },
    [VisualizationType.DENSITY]: { name: 'Density', icon: '📊' },
    [VisualizationType.TIME_SERIES]: { name: 'Time Series', icon: '⏱️' },
    [VisualizationType.PROXIMITY]: { name: 'Proximity', icon: '📏' },
    [VisualizationType.FLOW]: { name: 'Flow', icon: '➡️' },
    [VisualizationType.COMPOSITE]: { name: 'Composite', icon: '🔄' },
    [VisualizationType.OVERLAY]: { name: 'Overlay', icon: '📑' },
    [VisualizationType.AGGREGATION]: { name: 'Aggregation', icon: '📊' },
    [VisualizationType.SINGLE_LAYER]: { name: 'Single Layer', icon: '📍' },
    [VisualizationType.POINT_LAYER]: { name: 'Point Layer', icon: '📌' }
  };

  const { name, icon } = typeInfo[visualizationType] || { name: 'Unknown', icon: '❓' };

  return (
    <div className={`visualization-type-indicator ${className}`}>
      <span className="visualization-type-icon">{icon}</span>
      <span className="visualization-type-name">{name}</span>
      <style dangerouslySetInnerHTML={{ __html: `
        .visualization-type-indicator {
          display: inline-flex;
          align-items: center;
          padding: 4px 8px;
          border-radius: 4px;
          background-color: #f0f0f0;
          border: 1px solid #ddd;
          font-size: 14px;
        }
        .visualization-type-icon {
          margin-right: 6px;
          font-size: 18px;
        }
        .visualization-type-name {
          font-weight: 500;
        }
      ` }} />
    </div>
  );
};

export default VisualizationTypeIndicator; 