import React, { useEffect, useRef, useCallback } from 'react';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import PopupTemplate from '@arcgis/core/PopupTemplate';
import { CustomContent } from '@arcgis/core/popup/content';
import Graphic from '@arcgis/core/Graphic';
import PropertyPopupContent from './PropertyPopupContent';
import { createRoot } from 'react-dom/client';
import * as reactiveUtils from '@arcgis/core/core/reactiveUtils';
import type { PropertyParams } from '@/components/cma/types';

interface PropertyPopupManagerProps {
  mapView: __esri.MapView;
  layer: FeatureLayer;
  onPropertyZoom?: (feature: Graphic) => void;
  onPropertyCMA?: (propertyParams: PropertyParams) => void; // Changed: Now receives extracted params
  onPopupOpen?: (feature: Graphic) => void;
  onPopupClose?: () => void;
}

const PropertyPopupManager: React.FC<PropertyPopupManagerProps> = ({
  mapView,
  layer,
  onPropertyZoom,
  onPropertyCMA,
  onPopupOpen,
  onPopupClose
}) => {
  const clickHandleRef = useRef<__esri.Handle | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<any>(null);

  // Default zoom behavior
  const handleZoom = useCallback((feature: Graphic) => {
    if (onPropertyZoom) {
      onPropertyZoom(feature);
      return;
    }

    // Default zoom behavior
    if (feature.geometry) {
      if (feature.geometry.type === 'point') {
        mapView.goTo({
          target: feature.geometry,
          zoom: 18 // Close zoom for properties
        }, { 
          duration: 1000,
          easing: 'ease-in-out'
        });
      } else {
        mapView.goTo(feature.geometry, { 
          duration: 1000,
          easing: 'ease-in-out'
        });
      }
    }
  }, [mapView, onPropertyZoom]);

  // CMA button handler - now receives PropertyParams from PropertyPopupContent
  const handleCMA = useCallback((propertyParams: PropertyParams) => {
    if (onPropertyCMA) {
      console.log('[PropertyPopupManager] CMA requested - passing PropertyParams:', {
        centrisNo: propertyParams.centrisNo,
        address: propertyParams.address
      });
      onPropertyCMA(propertyParams);
      return;
    }

    // Default CMA behavior - can be extended
    console.log('[PropertyPopupManager] CMA requested (no handler):', {
      address: propertyParams.address,
      centris_no: propertyParams.centrisNo
    });

    alert(`CMA Report requested for: ${propertyParams.address}${propertyParams.centrisNo ? ` (Centris #${propertyParams.centrisNo})` : ''}`);
  }, [onPropertyCMA]);

  // Close popup handler
  const handleClose = useCallback(() => {
    if (containerRef.current && containerRef.current.parentNode) {
      containerRef.current.parentNode.removeChild(containerRef.current);
    }
    if (rootRef.current) {
      rootRef.current.unmount();
      rootRef.current = null;
    }
    containerRef.current = null;
    
    if (onPopupClose) {
      onPopupClose();
    }
  }, [onPopupClose]);

  // Create custom popup content
  const createPropertyPopup = useCallback((feature: Graphic, screenPoint: __esri.ScreenPoint) => {
    // Clean up existing popup
    handleClose();

    // Create popup container - position fixed to top-right
    const container = document.createElement('div');
    container.className = 'custom-property-popup';
    const popupWidth = 340;
    const rightOffset = 20;
    const topOffset = 20;
    
    container.style.cssText = `
      position: absolute;
      top: ${topOffset}px;
      right: ${rightOffset}px;
      width: ${popupWidth}px;
      z-index: 2000;
      pointer-events: auto;
      max-height: calc(100vh - 40px);
      overflow-y: auto;
    `;

    // Create React root and render PropertyPopupContent
    const root = createRoot(container);
    root.render(
      <PropertyPopupContent
        feature={feature}
        onClose={handleClose}
        onZoom={handleZoom}
        onCMA={handleCMA}
      />
    );

    // Add to map container
    if (mapView.container) {
      mapView.container.appendChild(container);
      containerRef.current = container;
      rootRef.current = root;

      // Add click outside handler
      const handleClickOutside = (e: MouseEvent) => {
        if (!container.contains(e.target as Node)) {
          handleClose();
          document.removeEventListener('click', handleClickOutside);
        }
      };

      // Delay to prevent immediate closure
      setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 100);

      // Notify parent
      if (onPopupOpen) {
        onPopupOpen(feature);
      }
    }
  }, [mapView, handleClose, handleZoom, handleCMA, onPopupOpen]);

  // Set up layer popup template and click handling
  useEffect(() => {
    if (!mapView || !layer) {
      console.log('[PropertyPopupManager] Missing mapView or layer:', { hasMapView: !!mapView, hasLayer: !!layer });
      return;
    }

    console.log('[PropertyPopupManager] Setting up property popup for layer:', {
      layerId: layer.id,
      layerTitle: layer.title,
      layerType: layer.type
    });

    // Create custom popup template
    const popupTemplate = new PopupTemplate({
      title: '{address}',
      content: [
        new CustomContent({
          outFields: ['*'],
          creator: (event?: { graphic?: Graphic }) => {
            // This won't be used since we're handling clicks manually,
            // but it's required for the popup template
            const div = document.createElement('div');
            div.innerHTML = 'Loading property details...';
            return div;
          }
        })
      ]
    });

    // Apply popup template to layer - but disable default ESRI popup
    layer.popupTemplate = popupTemplate;
    layer.popupEnabled = false; // Disable default ESRI popup to prevent double popups

    console.log('[PropertyPopupManager] Applied popup template to layer:', layer.id);

    // Handle layer clicks manually
    const clickHandle = mapView.on('click', async (event) => {
      try {
        // Hit test to find features
        const response = await mapView.hitTest(event);
        
        console.log('[PropertyPopupManager] Click event hit test results:', {
          resultsCount: response.results.length,
          layerId: layer.id,
          layerTitle: layer.title,
          eventCoords: `${event.x}, ${event.y}`,
          results: response.results.map(r => ({
            type: r.type,
            layerId: r.type === 'graphic' ? (r as any).graphic?.layer?.id : 'unknown',
            layerTitle: r.type === 'graphic' ? (r as any).graphic?.layer?.title : 'unknown'
          }))
        });
        
        // Find graphic from our property layer - check both ID and title
        const graphicResult = response.results.find(result =>
          result.type === "graphic" &&
          result.graphic &&
          result.graphic.layer &&
          (result.graphic.layer.id === layer.id || 
           (layer.id === 'active_properties_layer' && result.graphic.layer.id === 'active_properties_layer') ||
           (layer.id === 'sold_properties_layer' && result.graphic.layer.id === 'sold_properties_layer'))
        ) as __esri.GraphicHit | undefined;

        console.log('[PropertyPopupManager] Graphic result for property layer:', {
          hasResult: !!graphicResult,
          targetLayerId: layer.id,
          graphicLayerId: graphicResult?.graphic?.layer?.id,
          graphicLayerTitle: graphicResult?.graphic?.layer?.title,
          attributes: graphicResult?.graphic?.attributes ? Object.keys(graphicResult.graphic.attributes) : []
        });

        if (graphicResult) {
          // Convert map point to screen point
          const screenPoint = mapView.toScreen(event.mapPoint);
          
          console.log('[PropertyPopupManager] Creating property popup at screen point:', {
            x: screenPoint?.x || 0,
            y: screenPoint?.y || 0,
            propertyAddress: graphicResult.graphic.attributes?.address
          });
          
          // Create our custom popup if screenPoint is valid
          if (screenPoint) {
            createPropertyPopup(graphicResult.graphic, screenPoint);
          }
        }
      } catch (error) {
        console.error('[PropertyPopupManager] Error handling click:', error);
      }
    });

    clickHandleRef.current = clickHandle;

    console.log('[PropertyPopupManager] Click handler registered for layer:', layer.id);

    return () => {
      console.log('[PropertyPopupManager] Cleaning up for layer:', layer.id);
      if (clickHandleRef.current) {
        clickHandleRef.current.remove();
        clickHandleRef.current = null;
      }
      handleClose();
    };
  }, [mapView, layer, createPropertyPopup, handleClose]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      handleClose();
    };
  }, [handleClose]);

  return null; // This component doesn't render anything directly
};

export default PropertyPopupManager;
export type { PropertyPopupManagerProps };