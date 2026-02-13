/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef } from 'react';
import PopupTemplate from '@arcgis/core/PopupTemplate';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { CustomContent } from '@arcgis/core/popup/content';
import { PopupConfig } from '../../types/popup-config';
import { createRoot } from 'react-dom/client';
import { ZoomIn, BarChartBig, BarChart3 } from 'lucide-react';
import './popup-styles.css';
import * as reactiveUtils from '@arcgis/core/core/reactiveUtils';
import { getLayerConfigById } from '../../config/layers';
import { FIELD_ALIASES } from '../../utils/field-aliases';
import { FieldMappingHelper } from '../../utils/visualizations/field-mapping-helper';
import { determinePopupTitle, createStandardizedPopupTemplate, StandardizedPopupConfig } from '../../utils/popup-utils';
import Graphic from '@arcgis/core/Graphic';
import { BrandNameResolver } from '../../lib/analysis/utils/BrandNameResolver';
import { extractPropertyParams } from '../cma/utils/autoFilterUtils';
import type { PropertyParams } from '../cma/types';

interface CustomPopupManagerProps {
  mapView: __esri.MapView;
  layer: FeatureLayer;
  config?: {
    title?: string | ((feature: __esri.Graphic) => string);
    actions?: Array<{
      label: string;
      onClick: (feature: __esri.Graphic) => void;
    }>;
  };
  onPopupOpen?: (feature: __esri.Graphic) => void;
  onPopupClose?: () => void;
  onFeatureSelect?: (feature: __esri.Graphic) => void;
  zoomToFeature?: (feature: __esri.Graphic) => void;
  onPropertyCMA?: (propertyParams: PropertyParams) => void;
}

// Removed unused internal interfaces and imports

interface Metric { 
  label: string; 
  value: number; 
  color: string; 
  isPercent?: boolean; 
  percentage?: number; 
  statistics?: { 
    min: number; 
    max: number; 
    median: number; 
  }; 
}

const CustomPopupManager: React.FC<CustomPopupManagerProps> = ({
  mapView,
  layer,
  config,
  onPopupOpen,
  onPopupClose,
  onFeatureSelect,
  zoomToFeature,
  onPropertyCMA
}) => {
  const clickHandleRef = useRef<__esri.Handle | null>(null);
  const intervalRef = useRef<number | null>(null);
  // Removed unused refs
  const observerRef = useRef<MutationObserver | null>(null);
  const viewRef = useRef<__esri.MapView | null>(null);
  const featureLayerRef = useRef<__esri.FeatureLayer | null>(null);
  const initializedRef = useRef<boolean>(false);
  const visibilityHandleRef = useRef<__esri.Handle | null>(null);
  // Removed unused Handles state
  const popupRef = useRef<HTMLDivElement>(null);

  // **NEW: Apply standardized popup template (same as AI analysis layers)**
  const applyStandardizedPopup = (featureLayer: __esri.FeatureLayer) => {
    if (!featureLayer) return;

    try {
      console.log('[CustomPopupManager] Applying standardized popup to layer:', featureLayer.title);
      
      // Check if this is a point layer (location layer)
      const isPointLayer = featureLayer.geometryType === 'point';
      const isLocationLayer = featureLayer.title?.toLowerCase().includes('locations') || 
                             featureLayer.title?.toLowerCase().includes('points');
      
      if (isPointLayer || isLocationLayer) {
        console.log('[CustomPopupManager] 📍 Configuring simplified popup for point/location layer');
        
        // For point layers, include property-specific fields for enhanced display
        const pointFields: string[] = [];
        const availableFieldNames = featureLayer.fields?.map(f => f.name) || [];
        
        console.log('[CustomPopupManager] 🔍 Available fields for point layer:', availableFieldNames);
        
        // Priority fields for property points
        const propertyFields = [
          'address', 'ADDRESS', 'ADDR', 
          'price_display', 'price', 'askedsold_price',
          'status', 'STATUS',
          'bedrooms_number', 'bathrooms_number',
          'municipalityborough', 'postal_code',
          'centris_no'
        ];
        
        // Add available property fields in priority order
        propertyFields.forEach(fieldName => {
          if (availableFieldNames.includes(fieldName)) {
            pointFields.push(fieldName);
          }
        });
        
        // Fall back to address-related fields if no property fields found
        if (pointFields.length === 0) {
          const addressFields = featureLayer.fields
            ?.filter(field => {
              const fieldName = field.name.toLowerCase();
              const fieldAlias = (field.alias || '').toLowerCase();
              
              return (fieldName.includes('address') || fieldAlias.includes('address') ||
                     fieldName.includes('addr') || fieldAlias.includes('addr')) &&
                     !['OBJECTID', 'FID', 'Shape__Area', 'Shape__Length'].includes(field.name);
            })
            .map(field => field.name) || [];
          
          pointFields.push(...addressFields);
        }

        const config: StandardizedPopupConfig = {
          titleFields: ['address', 'ADDRESS', 'name', 'NAME'], // Prioritize address for properties
          barChartFields: [], // No bar chart for point layers
          listFields: pointFields, // Property-specific fields
          visualizationType: 'point-location'
        };
        
        const popupTemplate = createStandardizedPopupTemplate(config);
        featureLayer.popupTemplate = popupTemplate;
        
        console.log('[CustomPopupManager] ✅ Applied enhanced popup for point layer', {
          pointFields,
          availableFields: featureLayer.fields?.map(f => f.name)
        });
      } else {
        // Regular behavior for polygon/other layers
        console.log('[CustomPopupManager] Configuring standard popup with value bars');
        
        // Get numeric fields for bar chart display - prioritize analysis score fields
        const allNumericFields = featureLayer.fields
          ?.filter(field => 
            ['double', 'single', 'integer', 'small-integer'].includes(field.type) &&
            !['OBJECTID', 'FID', 'Shape__Area', 'Shape__Length'].includes(field.name)
          ) || [];

        // For analysis layers, prioritize primary score fields and avoid showing multiple scores
        const isAnalysisLayer = featureLayer.title?.includes('AnalysisEngine') || 
                               (featureLayer as any).__isAnalysisLayer === true;
        
        let barChartFields: string[] = [];
        
        if (isAnalysisLayer) {
          // For analysis layers, only show the primary score field to avoid confusion
          const scoreFields = ['strategic_analysis_score', 'strategic_score', 'strategic_value_score', 'target_value', 'value', 'score'];
          const primaryScoreField = scoreFields.find(field => 
            allNumericFields.some(f => f.name === field)
          );
          
          if (primaryScoreField) {
            barChartFields = [primaryScoreField];
            console.log('[CustomPopupManager] 🎯 Analysis layer: showing only primary score field:', primaryScoreField);
          } else {
            // Fallback: show first numeric field only
            barChartFields = allNumericFields.slice(0, 1).map(f => f.name);
          }
        } else {
          // For non-analysis layers, show multiple fields as before
          barChartFields = allNumericFields.map(field => field.name).slice(0, 5);
        }

        // Get all other fields for list display
        const listFields = featureLayer.fields
          ?.filter(field => 
            !['OBJECTID', 'FID', 'Shape__Area', 'Shape__Length'].includes(field.name) &&
            !barChartFields.includes(field.name)
          )
          .map(field => field.name)
          .slice(0, 8) || []; // Limit to 8 additional fields

        const config: StandardizedPopupConfig = {
          titleFields: ['DESCRIPTION', 'ID', 'FSA_ID', 'NAME', 'OBJECTID'],
          barChartFields,
          listFields,
          visualizationType: 'custom-popup-manager'
        };

        const popupTemplate = createStandardizedPopupTemplate(config);
        featureLayer.popupTemplate = popupTemplate;
        
        console.log('[CustomPopupManager] ✅ Applied standard popup with value bars');
      }
    } catch (error) {
      console.error('[CustomPopupManager] ❌ Error applying standardized popup:', error);
      // Layer will use default popup behavior
    }
  };

  // Main initialization effect
  useEffect(() => {
    if (!mapView || !layer) {
      console.warn('[CustomPopupManager] Missing mapView or layer');
      return;
    }

    if (initializedRef.current) {
      return;
    }

    // Wait for map to be ready
    if (!mapView.map) {
      console.warn('[CustomPopupManager] Map not initialized');
      return;
    }

    initializedRef.current = true;
    viewRef.current = mapView;
    
    if (layer.type === 'feature') {
      featureLayerRef.current = layer as __esri.FeatureLayer;
      
      // **UPDATED: Apply standardized popup template but disable default popup behavior**
      applyStandardizedPopup(featureLayerRef.current);
      
      // Ensure this layer doesn't trigger default ESRI popups
      featureLayerRef.current.popupEnabled = false;
      
      // Initialize popup monitoring if it exists
      if (mapView.popup) {
        // Ensure default popup stays disabled
        mapView.popup.autoCloseEnabled = false;
        mapView.popup.dockEnabled = false;
        mapView.popup.visible = false;
        mapView.popup.actions = [];

        // Set up popup event handlers using reactiveUtils.watch
        const popupWatchHandle = reactiveUtils.watch(
          () => mapView.popup?.visible,
          (newValue) => {
          if (newValue && mapView.popup?.selectedFeature) {
            onPopupOpen?.(mapView.popup.selectedFeature);
          } else {
            onPopupClose?.();
          }
          }
        );

        // Store the watch handle for cleanup
        clickHandleRef.current = popupWatchHandle;
      }

      // Watch layer visibility
      const visibilityHandle = reactiveUtils.watch(
        () => featureLayerRef.current?.visible ?? false,
        () => {
          // Layer visibility changed
        }
      );

      // Store the visibility watch handle for cleanup
      visibilityHandleRef.current = visibilityHandle;

      // Setup popup observer
      const popupRemoverObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type !== 'childList' || !mutation.addedNodes.length) {
            return;
          }

          mutation.addedNodes.forEach((node) => {
            if (!(node instanceof HTMLElement)) {
              return;
            }

            const isPopupElement = popupClassNames.some(className => 
              node.className && node.className.includes(className)
            );

            if (isPopupElement && !hasProtectedParentClass(node)) {
              if (featureLayerRef.current && viewRef.current) {
                const popup = viewRef.current.popup;
                if (popup && popup.visible && popup.selectedFeature) {
                  if (!node.classList.contains('custom-handled')) {
                    node.classList.add('custom-handled');
                    onPopupOpen?.(popup.selectedFeature);
                  }
                }
              }
            }
          });
        });
      });

      const viewRoot = document.querySelector('.esri-view-root');
      if (viewRoot) {
        popupRemoverObserver.observe(viewRoot, {
          childList: true,
          subtree: true
        });
      }

      observerRef.current = popupRemoverObserver;
    }

      // Cleanup function
      return () => {
      if (clickHandleRef.current) {
        clickHandleRef.current.remove();
        clickHandleRef.current = null;
      }
      if (visibilityHandleRef.current) {
        visibilityHandleRef.current.remove();
        visibilityHandleRef.current = null;
        }
        if (observerRef.current) {
          observerRef.current.disconnect();
        }
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        viewRef.current = null;
        featureLayerRef.current = null;
      initializedRef.current = false;
      };
  }, [mapView, layer, config, onPopupOpen, onPopupClose, onFeatureSelect, zoomToFeature, onPropertyCMA]);

  // 2. Disable popup functionality globally to prevent default ESRI popups
  useEffect(() => {
    if (mapView.popup) {
      mapView.popup.autoCloseEnabled = false; 
      mapView.popup.dockEnabled = false;
      mapView.popup.visible = false;
      mapView.popup.actions = [];
      
      // 3. Completely disable the default popup to prevent double popups
      mapView.popup.open = function() {
        console.log('[CustomPopupManager] Blocked default ESRI popup - using custom popups instead');
        return null;
      };
      
      // Simple way to prevent popup features being set
      try {
        mapView.popup.features = [];
      } catch (e) {
        console.log('[CustomPopupManager] Popup features already disabled');
      }
    }
  }, [mapView]);
  
  // 4. Disable native popups on ALL feature layers - custom managers will handle them
  useEffect(() => {
    if (mapView.map) {
      mapView.map.allLayers.forEach(layer => {
        if (layer.type === 'feature') {
          // Disable default popup on ALL layers - PropertyPopupManager will handle property layers
          // and CustomPopupManager will handle analysis layers
          (layer as __esri.FeatureLayer).popupEnabled = false;
          console.log('[CustomPopupManager] Disabled default popup for layer:', layer.title || layer.id);
        }
      });
      
      // Also watch for new layers being added
      const layerWatcher = mapView.map.allLayers.on('change', (event) => {
        event.added.forEach(layer => {
          if (layer.type === 'feature') {
            (layer as __esri.FeatureLayer).popupEnabled = false;
            console.log('[CustomPopupManager] Disabled default popup for new layer:', layer.title || layer.id);
          }
        });
      });
      
      return () => {
        layerWatcher.remove();
      };
    }
  }, [mapView]);
  // Removed unused visibility effect
  
  // Define classes that should be protected (never modified)
  const protectedClassNames = [
    'layer', 
    'widget', 
    'esri-ui', 
    'esri-component',
    'list',
    'toggle',
    'legend',
    'search',
    'panel',
    'menu',
    'item',
    'button',
    'control'
  ];
  
  // Define classes that are specifically for popups we want to handle
  const popupClassNames = [
    'esri-popup',
    'esri-popup__main-container',
    'esri-popup__content',
    'esri-popup__footer',
    'esri-popup__header'
  ];
  
  // Helper function to check if an element has a protected parent
  const hasProtectedParentClass = (element: Element): boolean => {
    let current = element;
    // Check up to 10 levels of parents to avoid infinite loops
    for (let i = 0; i < 10; i++) {
      if (!current || current === document.body) return false;
      
      // Check if this element has any protected class
      for (const className of protectedClassNames) {
        if (current.className && current.className.includes(className)) {
          console.log(`Protected parent found: ${current.className}`);
          return true;
        }
      }
      
      if (!current.parentElement) return false;
      current = current.parentElement;
    }
    return false;
  };
  
  // Add padding to the top of the map to prevent popup from being cut off
  const currentPadding = mapView.padding || { top: 0, right: 0, bottom: 0, left: 0 };
  const topPadding = typeof currentPadding.top === 'number' ? currentPadding.top : 0;
  const rightPadding = typeof currentPadding.right === 'number' ? currentPadding.right : 0;
  const popupWidth = 320; // Width of the custom popup
  const paddingBuffer = 15; // Space between popup and edge/other UI
  
  mapView.padding = {
    ...currentPadding,
    top: Math.max(topPadding, 15), // Reset top padding, docking handles overlap
    right: Math.max(rightPadding, popupWidth + paddingBuffer) // Add right padding for docked popup
  };
  
  // Track clicks on the map which may open popups
  const clickHandler = mapView.on('click', (event: __esri.ViewClickEvent) => {
    // Remove any existing popups first
    const existingPopups = document.querySelectorAll('.custom-popup');
    existingPopups.forEach(el => {
      // Check if the element is still in the DOM before trying to remove it
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });

    // Perform explicit hit test to find features
    mapView.hitTest(event).then(response => {
      // Find the first graphic hit from the layer this manager is responsible for
      const graphicResult = response.results.find(result =>
        result.type === "graphic" &&
        result.graphic &&
        result.graphic.layer &&
        result.graphic.layer.id === layer.id
      ) as __esri.GraphicHit | undefined;

      if (graphicResult) {
        const hitFeature = graphicResult.graphic;
        const targetLayer = hitFeature.layer as FeatureLayer;

        if (targetLayer && hitFeature.attributes) {
          const objectIdField = targetLayer.objectIdField;
          const objectId = hitFeature.attributes[objectIdField];

          // If we have an objectId, query the layer to ensure we have all attributes
          if (objectId !== undefined) {
            targetLayer.queryFeatures({
              objectIds: [objectId],
              outFields: ["*"], // Crucially, get all fields
              returnGeometry: true
            }).then(queryResponse => {
              if (queryResponse.features.length > 0) {
                const fullFeature = queryResponse.features[0];
                
                // Check if this is a property layer - if so, skip to let PropertyPopupManager handle it
                const isPropertyLayer = targetLayer.id?.includes('active-properties') || 
                                       targetLayer.id?.includes('sold-properties') ||
                                       targetLayer.id?.includes('real-estate-properties') ||
                                       targetLayer.id?.includes('properties') || 
                                       targetLayer.id?.includes('property') ||
                                       targetLayer.title?.toLowerCase().includes('property') ||
                                       targetLayer.title?.toLowerCase().includes('listing') ||
                                       targetLayer.title?.toLowerCase().includes('real estate');
                
                if (isPropertyLayer) {
                  console.log('[CustomPopupManager] 🏠 Skipping property layer popup - PropertyPopupManager will handle:', targetLayer.title || targetLayer.id);
                  return; // Let PropertyPopupManager handle this
                }
                
                // 🔍 DEBUG: Log attribute comparison with specific field checks
                const attrs = fullFeature.attributes || {};
                console.log('[CustomPopupManager] 🔍 Popup Attribute Debug:', {
                  hitFeatureAttrs: Object.keys(hitFeature.attributes || {}),
                  fullFeatureAttrs: Object.keys(fullFeature.attributes || {}),
                  hitFeatureValues: hitFeature.attributes,
                  fullFeatureValues: fullFeature.attributes,
                  areEqual: JSON.stringify(hitFeature.attributes) === JSON.stringify(fullFeature.attributes),
                  // Specific field checks for point layers
                  hasName: 'name' in attrs,
                  hasNAME: 'NAME' in attrs,
                  hasAddress: 'address' in attrs,
                  hasADDRESS: 'ADDRESS' in attrs,
                  nameValue: attrs.name,
                  NAMEValue: attrs.NAME,
                  addressValue: attrs.address,
                  ADDRESSValue: attrs.ADDRESS
                });
                
                createCustomPopup(fullFeature);
              }
            }).catch(queryError => {
              console.error('[CustomPopupManager] Failed to query for full feature:', queryError);
              
              // Check if this is a property layer - if so, skip to let PropertyPopupManager handle it
              const isPropertyLayer = targetLayer.id?.includes('active-properties') || 
                                     targetLayer.id?.includes('sold-properties') ||
                                     targetLayer.id?.includes('real-estate-properties') ||
                                     targetLayer.id?.includes('properties') || 
                                     targetLayer.id?.includes('property') ||
                                     targetLayer.title?.toLowerCase().includes('property') ||
                                     targetLayer.title?.toLowerCase().includes('listing') ||
                                     targetLayer.title?.toLowerCase().includes('real estate');
              
              if (isPropertyLayer) {
                console.log('[CustomPopupManager] 🏠 Fallback: Skipping property layer popup - PropertyPopupManager will handle:', targetLayer.title || targetLayer.id);
                return; // Let PropertyPopupManager handle this
              }
              
              // 🔍 DEBUG: Log fallback scenario
              console.log('[CustomPopupManager] 🔍 Using fallback feature attributes:', {
                attributes: hitFeature.attributes,
                hasAttributes: !!hitFeature.attributes,
                attributeCount: hitFeature.attributes ? Object.keys(hitFeature.attributes).length : 0
              });
              
              // Fallback to the original hit feature if the query fails for some reason
              createCustomPopup(hitFeature);
            });
          } else {
            // Check if this is a property layer - if so, skip to let PropertyPopupManager handle it
            const isPropertyLayer = targetLayer.id?.includes('active-properties') || 
                                   targetLayer.id?.includes('sold-properties') ||
                                   targetLayer.id?.includes('real-estate-properties') ||
                                   targetLayer.id?.includes('properties') || 
                                   targetLayer.id?.includes('property') ||
                                   targetLayer.title?.toLowerCase().includes('property') ||
                                   targetLayer.title?.toLowerCase().includes('listing') ||
                                   targetLayer.title?.toLowerCase().includes('real estate');
            
            if (isPropertyLayer) {
              console.log('[CustomPopupManager] 🏠 No ObjectId: Skipping property layer popup - PropertyPopupManager will handle:', targetLayer.title || targetLayer.id);
              return; // Let PropertyPopupManager handle this
            }
            
            // If there's no objectId for some reason, just use the hit feature
            createCustomPopup(hitFeature);
          }
        }
      }
    }).catch(error => {
      console.error('[CustomPopupManager] Error in hit test:', error);
    });
  });
  
  // Function to create a custom popup for a feature
  const createCustomPopup = (feature: __esri.Graphic) => {
    // Create the popup container
    const popupContainer = document.createElement('div');
    popupContainer.className = 'custom-popup theme-popup-container';
    
    // Create the popup header
    const popupHeader = document.createElement('div');
    popupHeader.className = 'theme-popup-title';
    popupHeader.style.display = 'flex';
    popupHeader.style.justifyContent = 'space-between';
    popupHeader.style.alignItems = 'center';
    
    // Create title
    const title = document.createElement('h3');
    title.style.margin = '0';
    
    // Determine title from feature attributes, prioritizing DESCRIPTION field
    let titleText = 'Feature Information';
    if (feature.attributes) {
      const attributes = feature.attributes;
      

      

      
      // Use standardized title determination logic
      titleText = determinePopupTitle(attributes);
    }
    title.textContent = titleText.toString().trim();
    
    // Create close button
    const closeButton = document.createElement('button');
    closeButton.className = 'theme-popup-close';
    closeButton.innerHTML = '&times;';
    // Close button handler: remove popup and cleanup listener
    closeButton.onclick = () => {
      // Safely remove popup if still attached
      if (popupContainer.parentNode === mapView.container && mapView.container) {
        mapView.container.removeChild(popupContainer);
      }
      // Remove outside click listener
      document.removeEventListener('click', handleOutsideClick);
      if (onPopupClose) {
        onPopupClose();
      }
    };
    
    // Add title and close button to header
    popupHeader.appendChild(title);
    popupHeader.appendChild(closeButton);
    
    // Create popup content
    const popupContent = document.createElement('div');
    popupContent.className = 'theme-popup-content';
    popupContent.style.maxHeight = '400px';
    popupContent.style.overflow = 'auto';
    
    // Create chart container
    const chartContainer = document.createElement('div');
    chartContainer.className = 'theme-popup-chart';
    // Hide chart until data is loaded to avoid blank overlay
    chartContainer.style.display = 'none';
    chartContainer.style.marginBottom = '16px';
    
    // Add action buttons
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'theme-popup-actions';
    
    // Create Zoom to button (green, with icon)
    const zoomButton = document.createElement('button');
    zoomButton.className = 'theme-popup-button';
    zoomButton.innerHTML = '';
    const zoomIconNode = document.createElement('span');
    const zoomRoot = createRoot(zoomIconNode);
    zoomRoot.render(<ZoomIn size={16} />);
    zoomIconNode.style.marginRight = '4px';
    zoomButton.appendChild(zoomIconNode);
    zoomButton.appendChild(document.createTextNode('Zoom to'));
    
    zoomButton.onclick = () => {
      // Check if the feature has a geometry
      if (feature.geometry) {
        // For points, center on the point and zoom in
        if (feature.geometry.type === 'point') {
          mapView.goTo({
            target: feature.geometry,
            zoom: 12
          }, { duration: 1000, easing: 'ease-in-out' }).then(() => {
            // Add flash effect for point features
            if (feature.geometry) {
              addFlashEffect(mapView, feature.geometry, 'point');
            }
          });
        } 
        // For polygons and polylines, go to the extent
        else {
          if (feature.geometry.extent) {
            mapView.goTo(feature.geometry.extent.expand(1.5), { duration: 1000, easing: 'ease-in-out' }).then(() => {
              // Add flash effect for polygon features
              if (feature.geometry) {
                addFlashEffect(mapView, feature.geometry, 'polygon');
              }
            });
          }
        }
      }
      
      // If there's a custom zoom action defined in config, also call that
      if (config?.actions) {
        const zoomAction = config.actions.find(a => a.label === 'Zoom to');
        if (zoomAction) {
          zoomAction.onClick(feature);
        }
      }
    };
    
    // Check if this is a point layer to determine whether to show infographics button
    // IMPORTANT: Exclude analysis layers from point layer treatment - they need bar charts
    const isAnalysisLayerCheck = layer.id?.startsWith('analysis-layer-') || layer.title?.includes('AnalysisEngine');
    const isPointLayer = feature.geometry?.type === 'point' && !isAnalysisLayerCheck;
    const isLocationLayer = (layer.title?.toLowerCase().includes('locations') ||
                           layer.title?.toLowerCase().includes('points')) && !isAnalysisLayerCheck;
    const shouldShowInfographicsButton = !(isPointLayer || isLocationLayer);
    
    console.log('[CustomPopupManager] 📍 Popup button decision:', {
      isPointLayer,
      isLocationLayer, 
      shouldShowInfographicsButton,
      layerTitle: layer.title,
      geometryType: feature.geometry?.type
    });
    
    let infoButton: HTMLButtonElement | null = null;
    
    // Only create Infographics button for non-point layers
    if (shouldShowInfographicsButton) {
      console.log('[CustomPopupManager] Creating infographics button for non-point layer');
      
      infoButton = document.createElement('button');
      infoButton.className = 'theme-popup-button';
      infoButton.innerHTML = '';
      const infoIconNode = document.createElement('span');
      const infoRoot = createRoot(infoIconNode);
      infoRoot.render(<BarChartBig size={16} />);
      infoIconNode.style.marginRight = '4px';
      infoButton.appendChild(infoIconNode);
      infoButton.appendChild(document.createTextNode('Infographics'));
      
      infoButton.onclick = () => {
        console.log('[CustomPopupManager] Infographics button clicked!');
        const geometry = feature.geometry; // Get geometry first
        console.log('[CustomPopupManager] Geometry object:', geometry);

        if (geometry) {
          console.log('[CustomPopupManager] Geometry type:', geometry.type);
          
          // Store geometry in localStorage for InfographicsTab to pick up
          const geometryData = {
            type: geometry.type,
            rings: geometry.type === 'polygon' ? (geometry as __esri.Polygon).rings : undefined,
            x: geometry.type === 'point' ? (geometry as __esri.Point).x : undefined,
            y: geometry.type === 'point' ? (geometry as __esri.Point).y : undefined,
            spatialReference: geometry.spatialReference.toJSON()
          };
          
          console.log('[CustomPopupManager] Geometry data to store:', geometryData);
          localStorage.setItem('emergencyGeometry', JSON.stringify(geometryData));
          console.log('[CustomPopupManager] Stored geometry in localStorage');
          
          // Verify storage worked
          const stored = localStorage.getItem('emergencyGeometry');
          console.log('[CustomPopupManager] Verification - stored data exists:', !!stored);
        }

        // 1. Dispatch event (Re-enabled)
        const infographicsEvent = new CustomEvent('openInfographics', {
          detail: { geometry: geometry }, // Pass geometry
          bubbles: true,
          composed: true
        });
        document.dispatchEvent(infographicsEvent);
        
        // 3. Call original configured action if exists
        if (config?.actions) {
          const infoAction = config.actions.find(a => a.label === 'Infographics');
          if (infoAction) {
            infoAction.onClick(feature); 
          }
        }
      };
    } else {
      console.log('[CustomPopupManager] 📍 Skipping infographics button for point/location layer');
    }
    
    // Check if this is a property/real estate layer to show CMA button
    const isPropertyLayer = layer.title?.toLowerCase().includes('property') || 
                            layer.title?.toLowerCase().includes('real estate') ||
                            layer.title?.toLowerCase().includes('listing') ||
                            (feature.attributes && (feature.attributes.address || feature.attributes.ADDRESS || 
                             feature.attributes.price || feature.attributes.askedsold_price ||
                             feature.attributes.centris_no));

    let cmaButton: HTMLButtonElement | null = null;
    
    // Create CMA button for property layers
    if (isPropertyLayer && onPropertyCMA) {
      console.log('[CustomPopupManager] Creating CMA button for property layer');
      
      cmaButton = document.createElement('button');
      cmaButton.className = 'theme-popup-button';
      cmaButton.innerHTML = '';
      const cmaIconNode = document.createElement('span');
      const cmaRoot = createRoot(cmaIconNode);
      cmaRoot.render(<BarChart3 size={16} />);
      cmaIconNode.style.marginRight = '4px';
      cmaButton.appendChild(cmaIconNode);
      cmaButton.appendChild(document.createTextNode('CMA Report'));
      
      cmaButton.onclick = () => {
        console.log('[CustomPopupManager] CMA button clicked for property:', feature.attributes);
        if (onPropertyCMA) {
          // Extract PropertyParams from Graphic - single extraction at click point
          const propertyParams = extractPropertyParams(feature);
          console.log('[CustomPopupManager] ✅ Extracted PropertyParams:', {
            centrisNo: propertyParams.centrisNo,
            address: propertyParams.address,
            price: propertyParams.price
          });
          onPropertyCMA(propertyParams);
        }
      };
    }

    // Add buttons to actions container
    actionsContainer.appendChild(zoomButton);
    if (cmaButton) {
      actionsContainer.appendChild(cmaButton);
    }
    if (infoButton) {
      actionsContainer.appendChild(infoButton);
    }
    
    // Add buttons and chart container to content: buttons first, then chart
    // Center and justify buttons
    actionsContainer.style.justifyContent = 'center';
    actionsContainer.style.alignItems = 'center';
    popupContent.appendChild(actionsContainer);
    popupContent.appendChild(chartContainer);
    
    // For point/location layers, show simple field content instead of bar chart
    if (isPointLayer || isLocationLayer) {
      console.log('[CustomPopupManager] 📍 Creating simple content for point/location layer');
      
      // Create simple content container for point layers
      const fieldContainer = document.createElement('div');
      fieldContainer.className = 'popup-field-container';
      fieldContainer.style.padding = '12px 0';
      
      // Show address field if available
      const attrs = feature.attributes || {};
      if (attrs.address) {
        const addressDiv = document.createElement('div');
        addressDiv.style.fontSize = '14px';
        addressDiv.style.color = 'var(--theme-text-secondary)';
        addressDiv.style.marginBottom = '8px';
        addressDiv.innerHTML = `<strong>Address:</strong> ${attrs.address}`;
        fieldContainer.appendChild(addressDiv);
      }
      
      // Show any additional relevant fields for points
      const relevantFields = ['locality', 'region', 'postcode'];
      relevantFields.forEach(fieldName => {
        if (attrs[fieldName]) {
          const fieldDiv = document.createElement('div');
          fieldDiv.style.fontSize = '12px';
          fieldDiv.style.color = 'var(--theme-text-secondary)';
          fieldDiv.style.marginBottom = '4px';
          fieldDiv.innerHTML = `<strong>${fieldName}:</strong> ${attrs[fieldName]}`;
          fieldContainer.appendChild(fieldDiv);
        }
      });
      
      popupContent.appendChild(fieldContainer);
      
      // Hide the chart container since we're showing simple content
      chartContainer.style.display = 'none';
    } else {
      // For polygon layers, generate bar chart as usual
      generateBarChart(feature, chartContainer, mapView);
    }
    
    // ----------------- SHAP FEATURE IMPORTANCE (optional) -----------------
  const shapLayer = layer as FeatureLayer & { shapFeatureImportance?: Array<{ feature: string; importance: number }> };
  const shapImportanceData = shapLayer.shapFeatureImportance;
    if (shapImportanceData && shapImportanceData.length > 0) {
      const shapContainer = document.createElement('div');
      shapContainer.style.marginTop = '12px';

      const shapHeader = document.createElement('h4');
      shapHeader.textContent = 'Top Model Drivers';
      shapHeader.style.margin = '0 0 6px 0';
      shapHeader.style.fontSize = '12px';
      shapHeader.style.fontWeight = 'bold';
      shapContainer.appendChild(shapHeader);

      const topItems = [...shapImportanceData]
        .sort((a, b) => Math.abs(b.importance) - Math.abs(a.importance))
        .slice(0, 5);
      const maxVal = Math.max(...topItems.map(i => Math.abs(i.importance)));

      topItems.forEach(item => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '6px';
        row.style.marginBottom = '4px';

        const label = document.createElement('span');
        label.textContent = FieldMappingHelper.getFriendlyFieldName(item.feature);
        label.style.fontSize = '11px';
        label.style.minWidth = '80px';
        row.appendChild(label);

        const barBg = document.createElement('div');
        barBg.style.flex = '1';
        barBg.style.height = '6px';
        barBg.style.background = 'var(--theme-bg-tertiary)';
        barBg.style.borderRadius = '3px';
        barBg.style.position = 'relative';

        const barFill = document.createElement('div');
        barFill.style.width = `${(Math.abs(item.importance) / (maxVal || 1)) * 100}%`;
        barFill.style.height = '100%';
        barFill.style.background = 'var(--firefly-18)';
        barFill.style.borderRadius = '3px';
        barBg.appendChild(barFill);

        row.appendChild(barBg);
        shapContainer.appendChild(row);
      });

      popupContent.appendChild(shapContainer);
    }
    // ----------------------------------------------------------------------
    
    // Add header and content to container
    popupContainer.appendChild(popupHeader);
    popupContainer.appendChild(popupContent);
    
    // Position the popup on screen
    // Convert map point to screen point
    // const screenPoint = mapView.toScreen(location);
    
    // Position popup slightly above the click point
    popupContainer.style.position = 'absolute';
    // Dock to top-right corner
    popupContainer.style.top = `${paddingBuffer}px`;
    popupContainer.style.right = `${paddingBuffer + (popupWidth / 2) + paddingBuffer}px`; // Shift left by half-width + buffer (15 + 160 + 15 = 190px)
    // Remove left positioning
    // popupContainer.style.left = 'auto'; 
    popupContainer.style.width = `${popupWidth}px`; // Use variable
    popupContainer.style.backgroundColor = 'white';
    // Use CSS-defined border-radius and box-shadow instead of inline styles
    // popupContainer.style.borderRadius = '8px';
    // popupContainer.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.15)';
    popupContainer.style.zIndex = '1000';
    
    // Add the popup to the map view container instead of the document body
    // document.body.appendChild(popupContainer); 
    if (mapView.container) {
        mapView.container.appendChild(popupContainer);
    } else {
      //  console.error("[CustomPopupManager] MapView container not found!");
        return; // Don't proceed if container is missing
    }

    // Add a click event listener to close the popup when clicking outside
    const handleOutsideClick = (e: MouseEvent) => {
      if (!popupContainer.contains(e.target as Node) && e.target !== popupContainer) {
        // Safely remove popup if still attached
        // if (popupContainer.parentNode === document.body) { // Old check
        //  document.body.removeChild(popupContainer);
        // }
        if (popupContainer.parentNode === mapView.container && mapView.container) { // New check
          mapView.container.removeChild(popupContainer);
        }
        // Cleanup listener
        document.removeEventListener('click', handleOutsideClick);
        if (onPopupClose) {
          onPopupClose();
        }
      }
    };

    // Delay adding the event listener to prevent immediate closing
    setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
    }, 10);
    
    // console.log('[CustomPopupManager] Custom popup created and added to DOM');
    
    // Notify about popup open via callback
    if (onPopupOpen) {
      onPopupOpen(feature);
    }
  };
  
  clickHandleRef.current = clickHandler;

  // Removed debug monitoring and repair logic to prevent loading loops

  // Setup event listeners for custom events
  const zoomToFeatureHandler = (e: Event) => {
    const customEvent = e as CustomEvent<__esri.Graphic>;
    if (customEvent.detail && zoomToFeature) {
      zoomToFeature(customEvent.detail);
    }
  };

  // Add event listeners
  window.addEventListener('zoom-to-feature', zoomToFeatureHandler);
  // NOTE: show-infographics handler removed - now handled directly in popup button
  
  // No local alias for view needed

  const resizeObserver = new ResizeObserver(() => {
    // Placeholder for future responsive adjustments
  });

  const popupNode = popupRef.current;
  if (popupNode) {
    resizeObserver.observe(popupNode);
  }
  
  return null;
};

// Function to apply custom popup templates to all feature layers
const applyCustomPopupTemplates = (view: __esri.MapView, config?: PopupConfig) => {
  if (!view || !view.map) return;
  
  view.map.allLayers.forEach(layer => {
    if (layer.type === 'feature') {
      const featureLayer = layer as __esri.FeatureLayer;
    //  console.log(`[CustomPopupManager] Configuring custom popup for layer: ${featureLayer.title}`);
      
      // Use the provided config title or generate a default one
      const title = config?.title ? 
        (typeof config.title === 'function' ? 
          '{expression/titleExpression}' : 
          config.title) :
        '{expression/defaultTitle}';
        
      // Create a custom popup template with bar chart and action buttons
      const popupTemplate = new PopupTemplate({
        title: title,
        outFields: ["*"],
        expressionInfos: [
          {
            name: "defaultTitle",
            title: "Default Title",
            expression: "IIf(HasKey($feature, 'DESCRIPTION'), $feature.DESCRIPTION, IIf(HasKey($feature, 'NAME'), $feature.NAME, 'Feature ' + $feature.OBJECTID))"
          },
          {
            name: "titleExpression",
            title: "Custom Title",
            expression: "IIf(HasKey($feature, 'DESCRIPTION'), $feature.DESCRIPTION, IIf(HasKey($feature, 'NAME'), $feature.NAME, 'Feature ' + $feature.OBJECTID))"
          }
        ],
        content: [
          new CustomContent({
            outFields: ["*"],
            creator: (event?: { graphic?: __esri.Graphic }) => {
              // Create container element
              const container = document.createElement("div");
              container.className = "custom-popup-container";
              
              // Create chart container
              const chartContainer = document.createElement("div");
              chartContainer.className = "popup-chart-container";
              
              // Create action buttons container
              const actionsContainer = document.createElement("div");
              actionsContainer.className = "popup-actions";
              
              // Create zoom button
              const zoomButton = document.createElement("button");
              zoomButton.textContent = "Zoom to";
              zoomButton.className = "popup-action-button";
              zoomButton.style.backgroundColor = "var(--theme-accent-secondary)";
              zoomButton.style.color = "white";
              
              // Create infographics button
              const infoButton = document.createElement("button");
              infoButton.textContent = "Infographics";
              infoButton.className = "popup-action-button";
              infoButton.style.backgroundColor = "var(--theme-accent-primary)";
              infoButton.style.color = "white";
              
              // Get the graphic from the event if available
              const graphic = event?.graphic;
              
              // Add event listeners to buttons
              zoomButton.addEventListener("click", () => {
                if (config?.actions && config.actions.length > 0 && graphic) {
                  const zoomAction = config.actions.find(a => a.label === 'Zoom to');
                  if (zoomAction) {
                    zoomAction.onClick(graphic);
                  }
                }
              });
              
              infoButton.addEventListener("click", () => {
                if (config?.actions && config.actions.length > 1 && graphic) {
                  const infoAction = config.actions.find(a => a.label === 'Infographics');
                  if (infoAction) {
                    infoAction.onClick(graphic);
                  }
                }
              });
              
              // Add buttons to actions container
              actionsContainer.appendChild(zoomButton);
              actionsContainer.appendChild(infoButton);
              
              // Add chart container to main container
              container.appendChild(chartContainer);
              
              // Add actions container to main container
              container.appendChild(actionsContainer);
              
              // Generate the chart for the current feature
              if (graphic) {
                generateBarChart(graphic, chartContainer, view);
              }
              
              return container;
            }
          })
        ]
      });
      
      featureLayer.popupTemplate = popupTemplate;
      featureLayer.popupEnabled = true;
    }
  });
};

// Function to generate a bar chart showing all visible layers in the layer list widget
const generateBarChart = (
  feature: __esri.Graphic, 
  container: HTMLElement, 
  view: __esri.MapView
) => {
  // Define Firefly bar colors using CSS custom properties
  const colors = [
    'var(--firefly-11)', 'var(--firefly-8)', 'var(--firefly-15)', 'var(--firefly-1)', 
    'var(--firefly-5)', 'var(--firefly-10)', 'var(--firefly-6)', 'var(--firefly-13)',
    'var(--firefly-18)', 'var(--firefly-20)', 'var(--firefly-19)', 'var(--firefly-2)'
  ];
  
  // Removed unused helper functions and interfaces

  // Clear the container
  container.innerHTML = "";
  
  // Special case for AI visualization layers and analysis layers
  const isAiVisualizationLayer = feature.layer &&
    (typeof feature.layer.id === 'string' &&
     (feature.layer.id.startsWith('viz_') || feature.layer.id.includes('correlation')));

  const isAnalysisLayer = feature.layer &&
    (typeof feature.layer.id === 'string' &&
     feature.layer.id.startsWith('analysis-layer-'));

  console.log('[CustomPopupManager] 🔍 Layer type check:', {
    layerId: feature.layer?.id,
    layerTitle: feature.layer?.title,
    isAnalysisLayer,
    isAiVisualizationLayer,
    startsWithAnalysis: typeof feature.layer?.id === 'string' && feature.layer.id.startsWith('analysis-layer-')
  });

  if (isAnalysisLayer) {
    // Handle unified analysis layers with proper bar chart
    const attrs = feature.attributes || {};
    
    // Initialize BrandNameResolver to handle brand field detection
    const brandResolver = new BrandNameResolver(FIELD_ALIASES);
    const brandFields = brandResolver.detectBrandFields(attrs);
    const isBrandAnalysis = brandFields.length > 0 || attrs.brand_difference_score !== undefined;
    
    // 🔍 DEBUG: Log all attributes for analysis layer popup
    console.log('[CustomPopupManager] 🔍 Analysis Layer Popup Debug:', {
      layerId: feature.layer?.id,
      hasAttributes: !!attrs,
      attributeKeys: Object.keys(attrs),
      attributeValues: attrs,
  nonZeroValues: Object.entries(attrs).filter(([, value]) => typeof value === 'number' && value !== 0),
  allNumericValues: Object.entries(attrs).filter(([, value]) => typeof value === 'number'),
      brandFields: brandFields.map(bf => ({ field: bf.fieldName, brand: (bf as any).brandName, value: bf.value })),
      isBrandAnalysis: isBrandAnalysis
    });
    
  const metrics: Metric[] = [];
    
  // Prefer the renderer's active field when available
  let rendererField: string | undefined;
  const layerRendererUnknown = (feature.layer as __esri.FeatureLayer).renderer as unknown;
  if (layerRendererUnknown && typeof layerRendererUnknown === 'object' && 'field' in (layerRendererUnknown as Record<string, unknown>)) {
    rendererField = (layerRendererUnknown as { field?: string }).field;
  }

  // Find the main score field - prefer renderer.field, then known analysis-specific score fields
    const scoreFields = [
      'strategic_analysis_score',      // Strategic analysis (preferred)
      'strategic_score',               // Strategic analysis (alternative)
      'brand_difference_score',        // Brand difference analysis
      'strategic_value_score',         // Strategic analysis
      'competitive_advantage_score',   // Competitive analysis
      'demographic_opportunity_score', // Demographic analysis
      'demographic_score',             // Demographic analysis (alternative)
      'customer_profile_score',        // Customer profile analysis
      'trend_strength_score',          // Trend analysis
      'outlier_detection_score',       // Outlier detection
      'correlation_strength_score',    // Correlation analysis
      'segment_profiling_score',       // Segment profiling
      'feature_interaction_score',     // Feature interaction
      'brand_analysis_score',          // Brand analysis
      'market_sizing_score',           // Market sizing
      'real_estate_analysis_score',    // Real estate analysis
      'anomaly_detection_score',       // Anomaly detection
      'predictive_modeling_score',     // Predictive modeling
      'risk_adjusted_score',           // Risk analysis
      'expansion_opportunity_score',   // Competitive expansion
      'cluster_performance_score',     // Cluster analysis
      'comparison_score',              // Comparative analysis
      'trend_strength',                // Trend data (alternative)
      'scenario_analysis_score',       // Scenario analysis
      'value'                          // Generic fallback (should rarely be used)
    ];
    let mainScoreField: string | null = null;
    let mainScoreValue: number = 0;

    // 1) Try renderer.field first if it's numeric on the feature
    if (rendererField && typeof attrs[rendererField] === 'number') {
      mainScoreField = rendererField;
      mainScoreValue = attrs[rendererField];
    } else {
      // 2) Fall back to known score fields order
      for (const field of scoreFields) {
        if (typeof attrs[field] === 'number') {
          mainScoreField = field;
          mainScoreValue = attrs[field];
          break;
        }
      }
    }
    
    if (mainScoreField && mainScoreValue >= 0) {
      // Get all features from the layer to calculate statistics
      const layer = feature.layer as __esri.FeatureLayer;
      if (layer.source) {
        const sourceUnknown = layer.source as unknown;
        let allFeatures: Array<{ attributes?: Record<string, unknown> }> = [];
        if (sourceUnknown && typeof sourceUnknown === 'object' && 'items' in (sourceUnknown as Record<string, unknown>)) {
          allFeatures = (sourceUnknown as { items?: Array<{ attributes?: Record<string, unknown> }> }).items ?? [];
        }
        const allValues = allFeatures
          .map((f) => {
            const v = f.attributes?.[(mainScoreField as string)];
            return typeof v === 'number' ? v : NaN;
          })
          .filter((v) => typeof v === 'number');
        const maxValue = Math.max(...allValues);
        const minValue = Math.min(...allValues);
        const sortedValues = [...allValues].sort((a, b) => a - b);
        const medianValue = sortedValues.length > 0 ? sortedValues[Math.floor(sortedValues.length / 2)] : 0;
        
        metrics.push({
          label: FieldMappingHelper.getFriendlyFieldName(mainScoreField),
          value: mainScoreValue,
          color: 'var(--theme-accent-primary)',
          isPercent: false,
          statistics: {
            min: minValue,
            max: maxValue,
            median: medianValue
          }
        });
      }
    }
    
    // Add contributing fields, excluding unwanted system fields and main score fields
    const excludedFields = [
      'OBJECTID', 'value', 'rank', 'ID', 'DESCRIPTION', 'area_name',
      // Exclude all main score fields to prevent duplicates
      'strategic_analysis_score', 'strategic_score', 'brand_difference_score',
      'strategic_value_score', 'competitive_advantage_score',
      'demographic_opportunity_score', 'demographic_score', 'customer_profile_score',
      'trend_strength_score', 'outlier_detection_score', 'correlation_strength_score',
      'segment_profiling_score', 'feature_interaction_score', 'brand_analysis_score',
      'market_sizing_score', 'real_estate_analysis_score', 'anomaly_detection_score',
      'predictive_modeling_score', 'risk_adjusted_score', 'expansion_opportunity_score',
      'cluster_performance_score', 'comparison_score', 'trend_strength', 'scenario_analysis_score'
    ];
    
    // Fields from other unrelated projects that should be excluded
    const excludedProjectFields = [
      'footwear_sales', 'athletic_shoes', 'running_shoes', 'basketball_shoes'
    ];
    
    // Add brand fields first if this is a brand analysis
    if (isBrandAnalysis && brandFields.length > 0) {
      brandFields.forEach(brandField => {
        if (brandField.fieldName !== mainScoreField && brandField.value !== 0) {
          metrics.push({
            label: FieldMappingHelper.getFriendlyFieldName(brandField.fieldName) || `${(brandField as any).brandName} Market Share`,
            value: brandField.value,
            color: 'var(--firefly-8)', // Blue for brand metrics
            isPercent: true
          });
        }
      });
    }
    
    // Get all available numeric fields that could be contributing factors
    const brandFieldNames = brandFields.map(bf => bf.fieldName);
    Object.keys(attrs).forEach(key => {
      if (key !== mainScoreField && 
          !excludedFields.includes(key) && 
          !excludedProjectFields.includes(key) && 
          !brandFieldNames.includes(key) && // Skip brand fields as we handled them above
          typeof attrs[key] === 'number' && 
          attrs[key] !== 0) { // Show fields with non-zero values (including negative for brand differences)
        
        // Determine color based on field type (no hardcoded brand colors)
        let color = 'var(--theme-text-muted)'; // Default gray
        if (key.includes('score')) {
          color = 'var(--firefly-8)'; // Blue for scores
        } else if (key.includes('population') || key.includes('income')) {
          color = 'var(--firefly-13)'; // Green for demographics
        } else if (key.includes('market') || key.includes('gap')) {
          color = 'var(--firefly-19)'; // Orange for market metrics
        }
        
        metrics.push({
          label: FieldMappingHelper.getFriendlyFieldName(key),
          value: attrs[key],
          color: color
        });
      }
    });
    
    // Render metrics
    if (metrics.length > 0) {
      const chartTitle = document.createElement('h4');
      chartTitle.textContent = 'Analysis Metrics';
      chartTitle.style.fontSize = '14px';
      chartTitle.style.fontWeight = 'bold';
      chartTitle.style.margin = '0 0 12px 0';
      chartTitle.style.color = 'var(--theme-text-primary)';
      container.appendChild(chartTitle);
      
      metrics.forEach(metric => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.marginBottom = '8px';
        row.style.padding = '4px 0';
        
        // Label
        const label = document.createElement('div');
        label.textContent = metric.label;
        label.style.width = '140px';
        label.style.fontSize = '12px';
        label.style.fontWeight = '500';
        label.style.color = 'var(--theme-text-primary)';
        label.style.flexShrink = '0';
        
        // Bar wrapper
        const barWrapper = document.createElement('div');
        barWrapper.style.flex = '1';
        barWrapper.style.height = '18px';
        barWrapper.style.backgroundColor = 'var(--theme-bg-tertiary)';
        barWrapper.style.borderRadius = '9px';
        barWrapper.style.margin = '0 8px';
        barWrapper.style.position = 'relative';
        
        const barFill = document.createElement('div');
        let widthPercent = 0;
        if (metric.statistics) {
          // Use relative position within the range for bar width
          const range = metric.statistics.max - metric.statistics.min;
          if (range > 0) {
            widthPercent = Math.max(((metric.value - metric.statistics.min) / range) * 100, 5);
          } else {
            widthPercent = 50; // Default width if no range
          }
        } else if (metric.isPercent || metric.value <= 1) {
          widthPercent = Math.min(Math.abs(metric.value) * 100, 100);
        } else {
          widthPercent = Math.min((metric.value / 100) * 100, 100);
        }
        
        barFill.style.width = `${widthPercent}%`;
        barFill.style.height = '100%';
        barFill.style.backgroundColor = metric.color;
        barFill.style.borderRadius = '9px';
        
        // Value text
        const valueText = document.createElement('div');
        valueText.textContent = metric.value.toLocaleString(undefined, { maximumFractionDigits: 1 });
        valueText.style.minWidth = '80px';
        valueText.style.textAlign = 'right';
        valueText.style.fontSize = '12px';
        valueText.style.fontWeight = '600';
        valueText.style.color = 'var(--theme-text-primary)';
        
        barWrapper.appendChild(barFill);
        row.appendChild(label);
        row.appendChild(barWrapper);
        row.appendChild(valueText);
        container.appendChild(row);
      });
      
      // Add statistics summary if we have main score statistics
      const mainMetric = metrics.find(m => m.statistics);
      if (mainMetric && mainMetric.statistics) {
        const statsContainer = document.createElement('div');
        statsContainer.style.marginTop = '12px';
        statsContainer.style.padding = '8px';
        statsContainer.style.backgroundColor = 'var(--theme-bg-secondary)';
        statsContainer.style.borderRadius = '4px';
        statsContainer.style.borderLeft = '3px solid var(--theme-accent-primary)';
        
        const statsTitle = document.createElement('div');
        statsTitle.textContent = 'All Areas';
        statsTitle.style.fontSize = '11px';
        statsTitle.style.fontWeight = 'bold';
        statsTitle.style.color = 'var(--theme-text-primary)';
        statsTitle.style.marginBottom = '4px';
        
        const statsText = document.createElement('div');
        statsText.innerHTML = `
          <div style="font-size: 10px; color: var(--theme-text-secondary); line-height: 1.4;">
            <div>Median: <strong style="color: var(--theme-text-primary);">${mainMetric.statistics.median.toFixed(1)}</strong></div>
            <div>Range: <strong style="color: var(--theme-text-primary);">${mainMetric.statistics.min.toFixed(1)} - ${mainMetric.statistics.max.toFixed(1)}</strong></div>
          </div>
        `;
        
        statsContainer.appendChild(statsTitle);
        statsContainer.appendChild(statsText);
        container.appendChild(statsContainer);
      }
      
      // Show chart
      container.style.display = 'block';
    }

    // Add action buttons for aggregate views that support drilldown
    const isAggregateView = (feature.layer as any)?.metadata?.viewMode === 'aggregate' ||
                           attrs.area_id || attrs.ID;

    console.log('[CustomPopupManager] 🔍 Drilldown button check:', {
      isAggregateView,
      layerMetadata: (feature.layer as any)?.metadata,
      hasAreaId: !!attrs.area_id,
      hasID: !!attrs.ID,
      ID: attrs.ID,
      area_id: attrs.area_id,
      allAttrs: Object.keys(attrs)
    });

    if (isAggregateView) {
      const actionsContainer = document.createElement('div');
      actionsContainer.className = 'theme-popup-actions';
      actionsContainer.style.marginTop = '16px';
      actionsContainer.style.display = 'flex';
      actionsContainer.style.gap = '8px';
      actionsContainer.style.justifyContent = 'center';

      // Create "View Properties" button
      const viewPropertiesButton = document.createElement('button');
      viewPropertiesButton.className = 'theme-popup-button';
      viewPropertiesButton.textContent = '🏘️ View Properties';
      viewPropertiesButton.style.fontSize = '13px';
      viewPropertiesButton.style.padding = '8px 16px';

      viewPropertiesButton.onclick = () => {
        console.log('[CustomPopupManager] 🔍 View Properties clicked:', {
          featureID: attrs.ID || attrs.area_id,
          layerMetadata: (feature.layer as any)?.metadata
        });

        const fsaCode = attrs.ID || attrs.area_id;
        if (fsaCode) {
          // Dispatch drilldown event
          const drilldownEvent = new CustomEvent('analysis-drilldown', {
            detail: {
              drilldownKey: fsaCode,
              viewMode: 'detail',
              analysisType: 'strategic'
            },
            bubbles: true,
            composed: true
          });
          window.dispatchEvent(drilldownEvent);

          // Close popup
          if (view && view.popup) {
            view.popup.close();
          }
        }
      };

      actionsContainer.appendChild(viewPropertiesButton);
      container.appendChild(actionsContainer);
    }

    return;
  }

  if (isAiVisualizationLayer) {
    // Prepare metrics for correlation visualization pop-up
    const attrs = feature.attributes || {};

    // Helper to push metric definition safely
    const metrics: Metric[] = [];

    // 1) Correlation score (if available)
    if (typeof attrs.correlation_score === 'number') {
      metrics.push({ label: 'Correlation Score', value: Math.abs(attrs.correlation_score), color: 'var(--firefly-10)', isPercent: true });
    }

    // Retrieve friendly names for the underlying fields, if stored on the layer
  const layerWithFields = feature.layer as FeatureLayer & { primaryField?: string; comparisonField?: string };
  const rawPrimaryField = layerWithFields?.primaryField || 'primary_value';
  const rawComparisonField = layerWithFields?.comparisonField || 'comparison_value';

    // 2) Primary metric
    if (typeof attrs[rawPrimaryField] === 'number') {
      metrics.push({
        label: FieldMappingHelper.getFriendlyFieldName(rawPrimaryField),
        value: attrs[rawPrimaryField],
        color: 'var(--firefly-8)'
      });
    }

    // 3) Comparison metric
    if (typeof attrs[rawComparisonField] === 'number') {
      metrics.push({
        label: FieldMappingHelper.getFriendlyFieldName(rawComparisonField),
        value: attrs[rawComparisonField],
        color: 'var(--firefly-13)'
      });
    }

    // Render each metric as a bar row
    metrics.forEach(metric => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.marginBottom = '8px';
      row.style.padding = '6px 8px';
      row.style.background = 'var(--theme-bg-secondary)';
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
      barWrapper.style.backgroundColor = 'var(--theme-bg-tertiary)';
      barWrapper.style.borderRadius = '9px';
      barWrapper.style.margin = '0 12px';

      const barFill = document.createElement('div');
      let widthPercent = 0;
      if (metric.isPercent || metric.value <= 1) {
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
      valueText.style.color = 'var(--theme-text-primary)';

      barWrapper.appendChild(barFill);
      row.appendChild(label);
      row.appendChild(barWrapper);
      row.appendChild(valueText);
      container.appendChild(row);
    });

    // Show now
    container.style.display = 'block';
    return;
  }

  // Get visible feature layers
  const visibleLayers = view.map.allLayers
    .filter(layer => layer.type === 'feature' && layer.visible && layer.listMode !== 'hide')
    .toArray() as __esri.FeatureLayer[];
  if (visibleLayers.length === 0) {
    container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--theme-text-muted);">No visible layers to display</div>';
    return;
  }

  // Asynchronously fetch distribution stats and render bars
  (async () => {
    // Clear previous content
    container.innerHTML = '';
    // Show chart once ready
    container.style.display = 'block';
    try {
      type LayerStat = { id: string; name: string; value: number; min: number; max: number; median: number; color: string };
      const stats: LayerStat[] = await Promise.all(
        visibleLayers.map(async (layer, idx) => {
          // Get the application's layer configuration to access custom properties
          const layerConfig = getLayerConfigById(layer.id);

          // Find a numeric field (exclude the object ID field)
          const oidField = layer.objectIdField;
          
          // Prefer the actual renderer.field when present, then config, then first numeric (safe access)
          let activeRendererField: string | undefined;
          const layerRendererUnknown = layer.renderer as unknown;
          if (layerRendererUnknown && typeof layerRendererUnknown === 'object' && 'field' in (layerRendererUnknown as Record<string, unknown>)) {
            activeRendererField = (layerRendererUnknown as { field?: string }).field;
          }
          const configRendererField: string | undefined = layerConfig?.rendererField;
          let numericFieldInfo = activeRendererField
            ? layer.fields?.find(f => f.name === activeRendererField)
            : undefined;

          if (!numericFieldInfo && configRendererField) {
            numericFieldInfo = layer.fields?.find(f => f.name === configRendererField);
          }

          if (!numericFieldInfo) {
            numericFieldInfo = layer.fields?.find(f =>
              ['small-integer','integer','single','double'].includes(f.type) &&
              f.name !== oidField
            );
          }
          
          if (!numericFieldInfo || !numericFieldInfo.name) {
            return { id: layer.id, name: layer.title || `Layer ${idx+1}`, value: NaN, min: NaN, max: NaN, median: NaN, color: colors[idx % colors.length] };
          }

          const numericField = numericFieldInfo.name;
          const labelText = FieldMappingHelper.getFriendlyFieldName(numericField);
          
          // Query all feature values for numericField to get stats
          const q = layer.createQuery();
          q.where = '1=1';
          q.outFields = [numericField];
          q.returnGeometry = false;
          const result = await layer.queryFeatures(q);
          const values = result.features
            .map(f => f.attributes[numericField])
            .filter(v => typeof v === 'number') as number[];
          const sorted = [...values].sort((a, b) => a - b);
          const min = sorted[0] ?? 0;
          const max = sorted[sorted.length - 1] ?? 0;
          const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
          
          // Determine this feature's value using a spatial query on its geometry
          let featureValue = NaN;
          if (feature.geometry) {
            const qVal = layer.createQuery();
            qVal.geometry = feature.geometry;
            qVal.spatialRelationship = 'intersects';
            qVal.outFields = [numericField];
            qVal.returnGeometry = false;
            const valResult = await layer.queryFeatures(qVal);
            if (valResult.features.length > 0) {
              const v = valResult.features[0].attributes[numericField];
              if (typeof v === 'number') {
                featureValue = v;
              }
            }
          }
          return { id: layer.id, name: labelText, value: featureValue, min, max, median, color: colors[idx % colors.length] };
        })
      );
      // Separate selected layer first
      const selId = feature.layer?.id;
      const selStat = stats.find(s => s.id === selId);
      const otherStats = stats.filter(s => s.id !== selId).sort((a, b) => (b.value - b.min) - (a.value - a.min));
      const finalStats = selStat ? [selStat, ...otherStats] : otherStats;
      finalStats.forEach(stat => {
        let displayName = stat.name;
        if (stat.id === 'applications') {
          displayName = 'Applications';
        } else if (stat.id === 'conversions') {
          displayName = 'Conversions';
        } else if (stat.id === 'conversionRate') {
          displayName = 'Conversion Rate';
        }
        
        const barContainer = document.createElement('div');
        barContainer.style.display = 'flex';
        barContainer.style.alignItems = 'center';
        barContainer.style.marginBottom = '8px';
        // Tooltip with formatted values
        barContainer.title = `${stat.name}\nValue: ${stat.value.toLocaleString()}\nRange: ${stat.min.toLocaleString()} – ${stat.max.toLocaleString()}\nMedian: ${stat.median.toLocaleString()}`;
        // Label
        const label = document.createElement('div');
        label.textContent = displayName;
        label.style.fontSize = '12px';
        label.style.width = '120px';
        label.style.whiteSpace = 'normal';
        label.style.wordBreak = 'break-word';
        // Bar wrapper and bar
        const barWrapper = document.createElement('div');
        barWrapper.style.flex = '1';
        barWrapper.style.height = '20px';
        barWrapper.style.backgroundColor = 'var(--theme-bg-tertiary)';
        barWrapper.style.borderRadius = '4px';
        barWrapper.style.margin = '0 8px';
        const bar = document.createElement('div');
        bar.className = 'theme-popup-chart-bar';
        const range = stat.max - stat.min;
        const percent = range > 0 ? ((stat.value - stat.min) / range) * 100 : 0;
        bar.style.width = `${percent}%`;
        // Append
        barWrapper.appendChild(bar);
        barContainer.appendChild(label);
        barContainer.appendChild(barWrapper);
        container.appendChild(barContainer);
      });
    } catch (err) {
      console.error('Error generating chart data:', err);
      container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--theme-text-muted);">Error loading data</div>';
    }
  })();
};

// Helper function to add flash effect to features
const addFlashEffect = (mapView: __esri.MapView, geometry: __esri.Geometry, geometryType: string) => {
  try {
    import('@arcgis/core/Graphic').then(({ default: Graphic }) => {
      import('@arcgis/core/symbols/SimpleFillSymbol').then(({ default: SimpleFillSymbol }) => {
        import('@arcgis/core/symbols/SimpleMarkerSymbol').then(({ default: SimpleMarkerSymbol }) => {
          let flashGraphic: __esri.Graphic;
          
          if (geometryType === 'point') {
            // Flash effect for points
            flashGraphic = new Graphic({
              geometry: geometry,
              symbol: new SimpleMarkerSymbol({
                color: [255, 255, 255, 0.9],
                size: 20,
                outline: {
                  color: [255, 255, 255, 1],
                  width: 4
                }
              })
            });
          } else {
            // Flash effect for polygons
            flashGraphic = new Graphic({
              geometry: geometry,
              symbol: new SimpleFillSymbol({
                color: [255, 255, 255, 0.8],
                outline: {
                  color: [255, 255, 255, 1],
                  width: 4
                }
              })
            });
          }
          
          mapView.graphics.add(flashGraphic);
          
          // Create pulsing effect
          let opacity = 0.8;
          let size = geometryType === 'point' ? 20 : undefined;
          let fadeOut = false;
          
          const pulseInterval = setInterval(() => {
            if (!fadeOut) {
              opacity -= 0.15;
              if (geometryType === 'point' && size) size += 2;
              if (opacity <= 0.2) fadeOut = true;
            } else {
              opacity += 0.15;
              if (geometryType === 'point' && size) size -= 2;
              if (opacity >= 0.8) fadeOut = false;
            }
            
            if (geometryType === 'point') {
              flashGraphic.symbol = new SimpleMarkerSymbol({
                color: [255, 255, 255, opacity],
                size: size || 20,
                outline: {
                  color: [255, 255, 255, 1],
                  width: 4
                }
              });
            } else {
              flashGraphic.symbol = new SimpleFillSymbol({
                color: [255, 255, 255, opacity],
                outline: {
                  color: [255, 255, 255, 1],
                  width: 4
                }
              });
            }
          }, 200);
          
          // Remove flash after animation
          setTimeout(() => {
            clearInterval(pulseInterval);
            mapView.graphics.remove(flashGraphic);
          }, 3000);
        });
      });
    });
  } catch (error) {
    console.error('[CustomPopupManager] Flash effect failed:', error);
  }
};

export default CustomPopupManager;
export { applyCustomPopupTemplates };