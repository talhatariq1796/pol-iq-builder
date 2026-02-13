/* eslint-disable no-self-assign */
import React, { useEffect, useRef } from 'react';
import Color from "@arcgis/core/Color";
import { StandardizedLegendData, LegendType, colorToRgba, getSymbolShape, getSymbolSize } from '@/types/legend';
import { LegendItem } from '@/components/MapLegend';
import { useMap } from '../MapContext';
import './LayerLegend.css';

// Define LayerLegendProps locally
interface LayerLegendProps {
  layer: __esri.Layer & { title?: string | null }; // Allow null for title
  isVisible: boolean;
}

const LayerLegend: React.FC<LayerLegendProps> = ({ layer, isVisible }) => {
  const { view } = useMap();
  const legendContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!view || !layer || !legendContainerRef.current || !isVisible) return;

    const updateLegend = () => {
      const featureLayer = view.map.findLayerById(layer.id) as __esri.FeatureLayer;
      if (!featureLayer || !featureLayer.renderer) return;

      const container = legendContainerRef.current;
      if (!container) return;

      // Clear existing legend content
      container.innerHTML = '';

      // Create legend items based on renderer
      const renderer = featureLayer.renderer;
      if (renderer.type === 'simple') {
        const simpleRenderer = renderer as __esri.SimpleRenderer;
        const symbol = simpleRenderer.symbol;
        if (symbol && symbol.color) {
          const legendItem = document.createElement('div');
          legendItem.className = 'legend-item theme-legend-item';
          legendItem.innerHTML = `
            <div class="legend-symbol theme-legend-symbol" style="background-color: ${symbol.color.toCss()}"></div>
            <div class="legend-label theme-legend-label">${layer.title || 'Layer'}</div>
          `;
          container.appendChild(legendItem);
        }
      } else if (renderer.type === 'unique-value') {
        const uniqueValueRenderer = renderer as __esri.UniqueValueRenderer;
        if (uniqueValueRenderer.uniqueValueInfos) {
          uniqueValueRenderer.uniqueValueInfos.forEach((info: __esri.UniqueValueInfo) => {
            if (info.symbol && info.symbol.color) {
              const legendItem = document.createElement('div');
              legendItem.className = 'legend-item theme-legend-item';
              legendItem.innerHTML = `
                <div class="legend-symbol theme-legend-symbol" style="background-color: ${info.symbol.color.toCss()}"></div>
                <div class="legend-label theme-legend-label">${info.label || info.value}</div>
              `;
              container.appendChild(legendItem);
            }
          });
        }
      } else if (renderer.type === 'class-breaks') {
        const classBreaksRenderer = renderer as __esri.ClassBreaksRenderer;
        if (classBreaksRenderer.classBreakInfos) {
          classBreaksRenderer.classBreakInfos.forEach((info: __esri.ClassBreakInfo) => {
            if (info.symbol && info.symbol.color) {
              const legendItem = document.createElement('div');
              legendItem.className = 'legend-item theme-legend-item';
              legendItem.innerHTML = `
                <div class="legend-symbol theme-legend-symbol" style="background-color: ${info.symbol.color.toCss()}"></div>
                <div class="legend-label theme-legend-label">${info.label || `${info.minValue} - ${info.maxValue}`}</div>
              `;
              container.appendChild(legendItem);
            }
          });
        }
      }
    };

    // Initial update
    updateLegend();

    // Watch for changes
    const rendererHandle = layer.watch('renderer', updateLegend);
    const visibilityHandle = layer.watch('visible', updateLegend);

    return () => {
      rendererHandle.remove();
      visibilityHandle.remove();
    };
  }, [view, layer, isVisible]);

  if (!layer || !isVisible) return null;

  return (
    <div className="layer-legend-card theme-legend-container">
      <div className="theme-legend-title">{layer.title || 'Legend'}</div>
      <div ref={legendContainerRef} className="layer-legend-container" />
    </div>
  );
};

export default LayerLegend;