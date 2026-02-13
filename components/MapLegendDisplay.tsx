import React from 'react';
import { StandardizedLegendData } from '@/types/legend';
import { LegendItem as LegendItemType } from '@/components/MapLegend';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MapLegendDisplayProps {
  legends: { [layerId: string]: StandardizedLegendData };
}

const LegendItem: React.FC<{ item: LegendItemType }> = ({ item }) => {
  const symbolStyle: React.CSSProperties = {
    backgroundColor: item.color,
    width: `${item.size || 12}px`,
    height: `${item.size || 12}px`,
    borderRadius: item.shape === 'circle' ? '50%' : '2px', // Square corners unless circle
    display: 'inline-block',
    marginRight: '8px',
    verticalAlign: 'middle',
    border: item.outlineColor ? `1px solid ${item.outlineColor}` : '1px solid rgba(0,0,0,0.1)', // Basic border
  };

  return (
    <div className="flex items-center mb-1 last:mb-0">
      <span style={symbolStyle}></span>
      <span className="text-xs text-muted-foreground truncate" title={item.label}>
        {item.label}
      </span>
    </div>
  );
};

const MapLegendDisplay: React.FC<MapLegendDisplayProps> = ({ legends }) => {
  const activeLegendEntries = Object.entries(legends)
    .filter(([, legendData]) => legendData && (
      (legendData.items && legendData.items.length > 0) ||
      (legendData.components && legendData.components.length > 0)
    ));

  if (activeLegendEntries.length === 0) {
    return null; // Don't render anything if there are no active legends
  }

  return (
    <div 
      className="absolute bottom-4 left-56 z-10 max-w-xs w-full" 
      style={{ pointerEvents: 'all' }} // Ensure interaction
    >
      <ScrollArea className="max-h-60"> {/* Limit height and make scrollable */}
        <div className="space-y-2">
          {activeLegendEntries.map(([layerId, legendData]) => (
            <Card key={layerId} className="bg-white shadow-md overflow-hidden">
              <CardHeader className="p-2 border-b border-border">
                <CardTitle className="text-sm font-medium truncate" title={legendData.title}>
                  {legendData.title}
                </CardTitle>
                {/* Optional: Add description if needed */}
                {/* {legendData.description && (
                  <p className="text-xs text-muted-foreground mt-1 truncate" title={legendData.description}>
                    {legendData.description}
                  </p>
                )} */}
              </CardHeader>
              <CardContent className="p-2">
                {legendData.type === 'dual-variable' && legendData.components ? (
                  // Render dual-variable legend
                  <div className="space-y-3">
                    {legendData.components.map((component, compIndex) => (
                      <div key={compIndex}>
                        <h5 className="text-xs font-medium text-muted-foreground mb-1 border-b pb-1">
                          {component.title}
                        </h5>
                        <div className="space-y-1">
                          {component.items.map((item, itemIndex) => (
                            <div key={itemIndex} className="flex items-center">
                              {component.type === 'size' ? (
                                <div 
                                  className="rounded-full border border-gray-300 mr-2"
                                  style={{
                                    width: item.size || 12,
                                    height: item.size || 12,
                                    backgroundColor: 'white',
                                  }}
                                />
                              ) : (
                                <div 
                                  className="mr-2 border"
                                  style={{
                                    width: 12,
                                    height: 12,
                                    backgroundColor: item.color,
                                    borderRadius: item.shape === 'circle' ? '50%' : '2px',
                                    borderColor: item.outlineColor || 'rgba(0,0,0,0.1)'
                                  }}
                                />
                              )}
                              <span className="text-xs text-muted-foreground truncate" title={item.label}>
                                {item.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : legendData.items ? (
                  // Render standard legend
                  legendData.items.map((item, index) => (
                    <LegendItem key={index} item={item} />
                  ))
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default MapLegendDisplay; 