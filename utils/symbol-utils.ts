import Color from '@arcgis/core/Color';
import { LegendType } from '@/types/legend';

export const colorToRgba = (color: Color): string => {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a !== undefined ? color.a : 1})`;
};

export const getSymbolShape = (symbol: __esri.SimpleMarkerSymbol | __esri.SimpleLineSymbol | __esri.SimpleFillSymbol): 'circle' | 'square' | undefined => {
  if (!symbol) return undefined;
  
  if ('style' in symbol) {
    switch (symbol.style) {
      case 'circle':
      case 'square':
        return symbol.style;
      default:
        return 'circle'; // Default to circle for other marker styles
    }
  }
  
  return 'square'; // Default to square for fill symbols
};

export const getSymbolSize = (symbol: __esri.SimpleMarkerSymbol | __esri.SimpleLineSymbol | __esri.SimpleFillSymbol): number => {
  if (!symbol) return 16;
  
  if ('size' in symbol) {
    return symbol.size;
  }
  
  return 16;
}; 