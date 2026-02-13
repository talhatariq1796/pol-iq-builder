import React, { useEffect, useRef, useState } from 'react';
import LayerList from '@arcgis/core/widgets/LayerList';
import Expand from '@arcgis/core/widgets/Expand';
import Collection from '@arcgis/core/core/Collection';
import ListItem from '@arcgis/core/widgets/LayerList/ListItem';
import { Filter } from 'lucide-react';
import { createRoot } from 'react-dom/client';

interface EnhancedLayerListWidgetProps {
  mapView: __esri.MapView;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  onLayerVisibilityChange?: (layerId: string, visible: boolean) => void;
  onLayerReorder?: (layers: string[]) => void;
  activeFilters?: Record<string, boolean>; // Track which layers have active filters
}

const EnhancedLayerListWidget: React.FC<EnhancedLayerListWidgetProps> = ({
  mapView,
  position = 'top-right',
  onLayerVisibilityChange,
  onLayerReorder,
  activeFilters = {}
}) => {
  const layerListRef = useRef<__esri.LayerList | null>(null);
  const expandRef = useRef<__esri.Expand | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Note: Layer actions moved to direct UI controls in layer content

  // Create layer list item content with custom styling
  const createListItemContent = (item: ListItem): HTMLDivElement => {
    const container = document.createElement('div');
    container.className = 'custom-layer-item';

    const layer = item.layer;
    const isRealEstateLayer = layer?.title?.includes('Active') || 
                             layer?.title?.includes('Sold') ||
                             layer?.title?.includes('FSA Boundaries');
    const isPropertiesGroup = layer?.title === 'Properties' || layer?.type === 'group';
    const isGroupLayer = layer?.type === 'group';
    
    // Debug logging
    console.log('Creating content for layer:', {
      title: layer?.title,
      type: layer?.type,
      isPropertiesGroup,
      isGroupLayer
    });

    // Layer title with custom styling and controls
    const title = document.createElement('div');
    title.className = 'layer-title';
    title.style.display = 'flex';
    title.style.justifyContent = 'space-between';
    title.style.alignItems = 'center';
    title.style.width = '100%';
    
    const titleText = document.createElement('span');
    titleText.className = `layer-name${isRealEstateLayer ? ' real-estate-layer' : ''}${isGroupLayer ? ' group-layer' : ''}`;
    titleText.textContent = layer?.title || 'Untitled Layer';
    title.appendChild(titleText);
    
    // Add filter icon for property layers
    if (isRealEstateLayer && !isGroupLayer && (layer?.title?.includes('Active') || layer?.title?.includes('Sold'))) {
      const controlsContainer = document.createElement('div');
      controlsContainer.className = 'layer-controls';
      controlsContainer.style.display = 'flex';
      controlsContainer.style.alignItems = 'center';
      controlsContainer.style.gap = '6px';
      controlsContainer.style.marginLeft = '8px';
      
      // Filter icon button - using React component
      const filterIconContainer = document.createElement('div');
      const hasActiveFilter = activeFilters[layer?.title || ''] || activeFilters[layer?.id || ''] || false;
      
      // Create the React Filter component and render it
      const FilterIcon: React.FC = () => (
        <Filter 
          size={14} 
          className={`filter-icon ${hasActiveFilter ? 'active' : ''}`}
          style={{
            color: hasActiveFilter ? '#2563eb' : '#666',
            transition: 'color 0.2s ease'
          }}
        />
      );
      
      // Create React root and render the icon
      const root = createRoot(filterIconContainer);
      root.render(<FilterIcon />);
      
      const filterButton = document.createElement('button');
      filterButton.className = `layer-control-btn filter-btn ${hasActiveFilter ? 'active' : ''}`;
      filterButton.title = hasActiveFilter ? 'Edit Property Filters (Active)' : 'Filter Properties';
      filterButton.appendChild(filterIconContainer);
      
      // Enhanced styling for the button
      filterButton.style.cssText = `
        background: ${hasActiveFilter ? '#e0f2fe' : 'none'};
        border: 1px solid ${hasActiveFilter ? '#2563eb' : '#ccc'};
        cursor: pointer;
        padding: 4px 6px;
        border-radius: 4px;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 24px;
        height: 24px;
        position: relative;
      `;
      
      // Add active indicator for filtered layers
      if (hasActiveFilter) {
        const indicator = document.createElement('div');
        indicator.style.cssText = `
          position: absolute;
          top: -2px;
          right: -2px;
          width: 6px;
          height: 6px;
          background: #2563eb;
          border-radius: 50%;
          border: 1px solid white;
        `;
        filterButton.appendChild(indicator);
      }
      
      filterButton.addEventListener('mouseenter', () => {
        filterButton.style.backgroundColor = hasActiveFilter ? '#bfdbfe' : '#f0f0f0';
        filterButton.style.borderColor = hasActiveFilter ? '#1d4ed8' : '#999';
        filterButton.style.transform = 'scale(1.05)';
      });
      
      filterButton.addEventListener('mouseleave', () => {
        filterButton.style.backgroundColor = hasActiveFilter ? '#e0f2fe' : 'transparent';
        filterButton.style.borderColor = hasActiveFilter ? '#2563eb' : '#ccc';
        filterButton.style.transform = 'scale(1)';
      });
      
      filterButton.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('Filter button clicked for layer:', layer?.title);
        
        // Add subtle click animation
        filterButton.style.transform = 'scale(0.95)';
        setTimeout(() => {
          filterButton.style.transform = 'scale(1)';
        }, 100);
        
        window.dispatchEvent(new CustomEvent('open-price-filter', {
          detail: { layerId: layer?.id, layerTitle: layer?.title }
        }));
      });
      
      controlsContainer.appendChild(filterButton);
      title.appendChild(controlsContainer);
    }

    // Layer statistics for real estate layers
    if (isRealEstateLayer && !isGroupLayer) {
      const stats = document.createElement('div');
      stats.className = 'layer-stats';
      
      if (layer?.title?.includes('Active')) {
        stats.innerHTML = `
          <div class="stat-item">
            <span class="stat-icon" style="width: 12px; height: 12px; border-radius: 50%; background-color: rgb(34, 197, 94); display: inline-block; margin-right: 4px;"></span>
            <span class="stat-text">Active Listings</span>
          </div>
          <div class="stat-count" id="active-count">Loading...</div>
        `;
      } else if (layer?.title?.includes('Sold')) {
        stats.innerHTML = `
          <div class="stat-item">
            <span class="stat-icon" style="width: 12px; height: 12px; border-radius: 50%; background-color: rgb(239, 68, 68); display: inline-block; margin-right: 4px;"></span>
            <span class="stat-text">Sold Properties</span>
          </div>
          <div class="stat-count" id="sold-count">Loading...</div>
        `;
      } else if (layer?.title?.includes('FSA Boundaries')) {
        stats.innerHTML = `
          <div class="stat-item">
            <span class="stat-icon">📍</span>
            <span class="stat-text">Postal Areas</span>
          </div>
          <div class="stat-count" id="fsa-count">Loading...</div>
        `;
      }
      
      container.appendChild(stats);
    }

    // Layer opacity slider (not for group layers)
    const opacityContainer = document.createElement('div');
    opacityContainer.className = 'opacity-container';
    
    if (!isGroupLayer) {
    opacityContainer.innerHTML = `
      <label class="opacity-label">Opacity:</label>
      <input type="range" class="opacity-slider" min="0" max="1" step="0.1" value="${layer?.opacity || 1}">
      <span class="opacity-value">${Math.round((layer?.opacity || 1) * 100)}%</span>
    `;

    const opacitySlider = opacityContainer.querySelector('.opacity-slider') as HTMLInputElement;
    const opacityValue = opacityContainer.querySelector('.opacity-value') as HTMLSpanElement;
    
      opacitySlider.addEventListener('input', (event) => {
        const target = event.target as HTMLInputElement;
        const opacity = parseFloat(target.value);
        if (layer) layer.opacity = opacity;
        opacityValue.textContent = `${Math.round(opacity * 100)}%`;
      });

      container.appendChild(opacityContainer);
    }

    container.appendChild(title);

    return container;
  };

  // Handle layer list actions
  const handleLayerAction = async (event: any) => {
    const { action, item } = event;
    const layer = item.layer;

    switch (action.id) {
      case 'toggle-clustering':
        // Dispatch custom event for clustering toggle
        window.dispatchEvent(new CustomEvent('toggle-clustering', {
          detail: { layerId: layer?.id, layerTitle: layer.title }
        }));
        break;

      case 'filter-price':
        // Open property filter dialog for layer
        window.dispatchEvent(new CustomEvent('open-price-filter', {
          detail: { layerId: layer?.id, layerTitle: layer.title }
        }));
        break;

      case 'show-stats':
        // Show layer statistics dialog
        window.dispatchEvent(new CustomEvent('show-layer-stats', {
          detail: { layerId: layer?.id, layerTitle: layer.title }
        }));
        break;

      case 'multi-select':
        // Enable multi-selection mode for FSA boundaries
        window.dispatchEvent(new CustomEvent('enable-multi-select', {
          detail: { layerId: layer?.id }
        }));
        break;

      case 'clear-selection':
        // Clear FSA selection
        window.dispatchEvent(new CustomEvent('clear-fsa-selection', {
          detail: { layerId: layer?.id }
        }));
        break;

      case 'generate-report':
        // Generate area report
        window.dispatchEvent(new CustomEvent('generate-area-report', {
          detail: { layerId: layer?.id }
        }));
        break;

      case 'layer-info':
        // Show layer information
        console.log('Layer Information:', {
          title: layer.title,
          type: layer?.type,
          url: (layer as any).url,
          visible: layer?.visible,
          opacity: layer?.opacity
        });
        break;

      case 'zoom-to-layer':
        // Zoom to layer extent
        try {
          await mapView.goTo(layer?.fullExtent);
        } catch (error) {
          console.error('Error zooming to layer:', error);
        }
        break;

      default:
        console.log('Unknown action:', action.id);
    }
  };

  // Update layer counts
  const updateLayerCounts = async () => {
    try {
      mapView.map.layers.forEach(async (layer) => {
        if (layer?.type === 'feature') {
          const featureLayer = layer as __esri.FeatureLayer;
          
          try {
            const query = featureLayer.createQuery();
            query.where = '1=1';
            const result = await featureLayer.queryFeatureCount(query);
            
            // Update count in the UI
            let countElement: HTMLElement | null = null;
            
            if (layer?.title?.includes('Active')) {
              countElement = document.getElementById('active-count');
            } else if (layer?.title?.includes('Sold')) {
              countElement = document.getElementById('sold-count');
            } else if (layer?.title?.includes('FSA Boundaries')) {
              countElement = document.getElementById('fsa-count');
            }
            
            if (countElement) {
              countElement.textContent = result.toLocaleString();
            }
          } catch (error) {
            console.warn(`Could not query count for layer: ${layer.title}`, error);
          }
        }
      });
    } catch (error) {
      console.error('Error updating layer counts:', error);
    }
  };

  // Initialize layer list widget
  useEffect(() => {
    if (!mapView || isInitialized) return;

    const initializeLayerList = async () => {
      try {
        // Create layer list widget
        const layerList = new LayerList({
          view: mapView,
          listItemCreatedFunction: (event) => {
            const item = event.item;
            
            // Debug logging
            console.log('LayerList item created:', {
              title: item.layer?.title,
              type: item.layer?.type,
              visible: item.layer?.visible,
              isGroup: item.layer?.type === 'group'
            });
            
            // Note: Actions replaced with direct UI controls in layer content

            // Set custom content
            const customContent = createListItemContent(item);
            item.panel = {
              content: customContent,
              className: 'custom-layer-panel'
            };

            // Watch for visibility changes
            item.watch('visible', (visible: boolean) => {
              if (onLayerVisibilityChange) {
                onLayerVisibilityChange(item.layer?.id, visible);
              }
            });
          },
          // Custom drag and drop for reordering
          dragEnabled: true
        });

        // Handle layer actions
        layerList.on('trigger-action', handleLayerAction);

        // Create expandable container
        const expand = new Expand({
          view: mapView,
          content: layerList,
          expandIcon: 'layers',
          expandTooltip: 'Layer List',
          group: 'top-right'
        });

        // Add to map view
        mapView.ui.add(expand, position);
        
        layerListRef.current = layerList;
        expandRef.current = expand;
        setIsInitialized(true);

        // Initial count update
        setTimeout(updateLayerCounts, 1000);

        // Watch for layer changes and refresh the layer list
        mapView.map.layers.on('change', () => {
          console.log('Map layers changed, refreshing layer list');
          // Force refresh by triggering a view change
          setTimeout(updateLayerCounts, 500);
        });
        
        // Listen for custom refresh events
        const handleRefreshLayerList = () => {
          console.log('Custom refresh layer list event received');
          // Force refresh by updating the view
          setTimeout(updateLayerCounts, 200);
        };
        
        window.addEventListener('refresh-layer-list', handleRefreshLayerList);
        
        // Cleanup event listener
        const cleanup = () => {
          window.removeEventListener('refresh-layer-list', handleRefreshLayerList);
        };
        
        // Store cleanup function
        (expand as any).cleanup = cleanup;

      } catch (error) {
        console.error('Error initializing layer list:', error);
      }
    };

    initializeLayerList();
  }, [mapView, isInitialized, position]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (expandRef.current && mapView) {
        mapView.ui.remove(expandRef.current);
        // Call custom cleanup if it exists
        if ((expandRef.current as any).cleanup) {
          (expandRef.current as any).cleanup();
        }
      }
    };
  }, [mapView]);

  return null; // Widget is added directly to the map view
};

// CSS styles for custom layer list (to be added to your CSS file)
export const layerListStyles = `
.custom-layer-item {
  padding: 8px;
  border-bottom: 1px solid #e0e0e0;
}

.layer-title {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.layer-name {
  font-weight: 500;
  font-size: 14px;
}

.real-estate-layer {
  color: #2563eb;
  font-weight: 600;
}

.group-layer {
  color: #1e40af;
  font-weight: 700;
  font-size: 15px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding-left: 4px;
}

.layer-stats {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding: 4px 8px;
  background-color: #f8f9fa;
  border-radius: 4px;
  font-size: 12px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.stat-icon {
  font-size: 12px;
  flex-shrink: 0;
}

.stat-text {
  color: #6b7280;
}

.stat-count {
  font-weight: 600;
  color: #374151;
}

.opacity-container {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.opacity-label {
  color: #6b7280;
  font-size: 11px;
}

.opacity-slider {
  flex: 1;
  height: 4px;
  background: #e5e7eb;
  border-radius: 2px;
  outline: none;
}

.opacity-slider::-webkit-slider-thumb {
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #2563eb;
  cursor: pointer;
}

.opacity-value {
  font-size: 10px;
  color: #6b7280;
  min-width: 30px;
  text-align: right;
}

.custom-layer-panel {
  max-width: 280px;
}

.layer-control-btn {
  transition: all 0.2s ease;
}

.layer-control-btn:hover {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.layer-control-btn.active {
  background-color: #e0f2fe !important;
  border-color: #2563eb !important;
}

.filter-icon.active {
  color: #2563eb !important;
  filter: drop-shadow(0 0 2px rgba(37, 99, 235, 0.3));
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .layer-controls {
    gap: 4px !important;
  }
  
  .layer-control-btn {
    min-width: 20px !important;
    height: 20px !important;
    padding: 2px 4px !important;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .layer-control-btn {
    border-width: 2px;
  }
  
  .layer-control-btn.active {
    border-width: 3px;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .layer-control-btn,
  .filter-icon {
    transition: none !important;
  }
}
`;

export default EnhancedLayerListWidget;
export type { EnhancedLayerListWidgetProps };
