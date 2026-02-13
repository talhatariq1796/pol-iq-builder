import React from 'react';
import { cn } from '@/lib/utils';
import TernaryPlot from './TernaryPlot';
import { LegendType, DualVariableComponent } from '@/types/legend';

export interface LegendItem {
  label: string;
  color: string;
  outlineColor?: string;
  shape?: 'circle' | 'square';
  size?: number;
  isHeader?: boolean;
}

export interface MapLegendProps {
  title?: string;
  items?: LegendItem[];
  visible?: boolean;
  className?: string;
  type?: LegendType;
  ternaryData?: Array<{
    values: [number, number, number];
    label?: string;
    color?: string;
  }>;
  labels?: [string, string, string];
  components?: DualVariableComponent[];
}

const MapLegend: React.FC<MapLegendProps> = ({ 
  title, 
  items, 
  visible = true,
  className,
  type = 'standard',
  ternaryData,
  labels,
  components
}) => {
  if (!visible) {
    return null;
  }

  // Handle ternary plot legend
  if (type === 'ternary-plot' && ternaryData && labels) {
    return (
      <div 
        className={cn(
          "absolute bottom-5 left-56 z-50",
          className
        )}
      >
        <TernaryPlot
          data={ternaryData}
          labels={labels}
          title={title}
          width={280}
          height={280}
        />
      </div>
    );
  }

  // Handle dual-variable legend
  if (type === 'dual-variable' && components && components.length > 0) {
    return (
      <div 
        className={cn(
          "absolute bottom-5 left-56 bg-white p-3 rounded-lg shadow-lg z-50",
          "max-w-[280px] max-h-[350px] overflow-auto",
          className
        )}
      >
        {title && (
          <h3 className="text-sm font-semibold mb-3 text-gray-800 text-center">
            {title}
          </h3>
        )}
        <div className="space-y-4">
          {components.map((component, componentIndex) => (
            <div key={componentIndex}>
              <h4 className="text-xs font-medium mb-2 text-gray-700 border-b border-gray-200 pb-1">
                {component.title}
              </h4>
              <div className="space-y-1.5">
                {component.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="flex items-center gap-2">
                    {component.type === 'size' ? (
                      // Size legend items - show varying circle sizes
                      <div 
                        className="flex-shrink-0 rounded-full border border-gray-300"
                        style={{
                          width: item.size || 16,
                          height: item.size || 16,
                          backgroundColor: 'white',
                        }}
                      />
                    ) : (
                      // Color legend items - show color swatches
                      <div 
                        className="flex-shrink-0"
                        style={{
                          width: 16,
                          height: 16,
                          backgroundColor: item.color,
                          borderRadius: item.shape === 'circle' ? '50%' : '2px',
                          border: item.outlineColor ? `1px solid ${item.outlineColor}` : '1px solid #e5e7eb'
                        }}
                      />
                    )}
                    <span className="text-xs text-gray-700 leading-tight">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Handle all other legend types (standard, multivariate, class-breaks, unique-value, etc.)
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div 
      className={cn(
        "absolute bottom-5 left-56 bg-white p-3 rounded-lg shadow-lg z-50",
        "max-w-[250px] max-h-[300px] overflow-auto",
        className
      )}
    >
      {title && (
        <h3 className="text-sm font-semibold mb-2 text-gray-800">
          {title}
        </h3>
      )}
      <div className="space-y-2">
        {items.map((item, index) => {
          // Handle header items
          if (item.isHeader) {
            return (
              <div 
                key={index} 
                className={cn(
                  "font-bold text-xs text-gray-800 text-center",
                  "border-b border-gray-200 pb-1",
                  index > 0 ? "mt-3 mb-1" : "mt-1 mb-1"
                )}
              >
                {item.label}
              </div>
            );
          }
          
          // Handle normal legend items
          return (
            <div 
              key={index} 
              className="flex items-center gap-2"
            >
              <div 
                className="flex-shrink-0"
                style={{
                  width: item.size || 16,
                  height: item.size || 16,
                  backgroundColor: item.color,
                  borderRadius: item.shape === 'circle' ? '50%' : '2px',
                  border: item.outlineColor ? `1px solid ${item.outlineColor}` : 'none'
                }}
              />
              <span className="text-xs text-gray-700">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MapLegend;
