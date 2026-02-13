import React, { 
  useEffect, 
  useRef, 
  memo, 
  useCallback, 
  useState,
  useMemo
} from 'react';
import { X, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import './widget-styles.css';
import type { LayerState } from '@/components/ResizableSidebar';
import { Root } from 'react-dom/client';
import { createProjectConfig } from '@/adapters/layerConfigAdapter';
import type { ProjectLayerConfig } from '@/types/layers';
import { LoadingModal } from '@/components/LoadingModal';

// ArcGIS Imports
import { whenOnce } from '@arcgis/core/core/reactiveUtils';
import LayerList from '@arcgis/core/widgets/LayerList';
import Search from '@arcgis/core/widgets/Search';
import Print from '@arcgis/core/widgets/Print';
import Bookmarks from '@arcgis/core/widgets/Bookmarks';
import Bookmark from '@arcgis/core/webmap/Bookmark';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Extent from '@arcgis/core/geometry/Extent';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Collection from '@arcgis/core/core/Collection';
import { colorToRgba, getSymbolShape, getSymbolSize } from '@/utils/symbol-utils';
import { StandardizedLegendData, LegendType } from '@/types/legend';
import { LegendItem } from '@/components/MapLegend';
import Legend from '@arcgis/core/widgets/Legend';

// Custom Imports
import ProjectsWidget from './ProjectsWidget';
import FilterWidget from './FilterWidget';
import IndexWidget from './IndexWidget';
import LayerController, { LayerControllerRef } from './LayerController/LayerController';

// UI Components
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

// Type Definitions
interface WidgetState {
  print: Print | null;
  search: __esri.widgetsSearch | null;
  bookmarks: Bookmarks | null;
  layerList: LayerList | null;
}

interface MapWidgetsProps {
  view: __esri.MapView;
  activeWidget: string | null;
  onClose: () => void;
  onLayerSelect: (layer: __esri.FeatureLayer) => void;
  onToggleWidget: (widgetName: string) => void;
  // legend?: __esri.Legend; // <<< Keep this commented or remove if definitely unused
  showLoading?: boolean;
  onLayerStatesChange: (states: { [key: string]: LayerState }) => void;
  visibleWidgets?: string[]; // Array of widget names that should be visible
  onCorrelationAnalysis: (layer: __esri.FeatureLayer, primaryField: string, comparisonField: string) => void;
}

// Define Canadian City Bookmarks Data (Alphabetical Order)
const CANADIAN_CITY_BOOKMARKS_DATA = [
  { name: "Brampton", extent: { xmin: -79.9, ymin: 43.6, xmax: -79.6, ymax: 43.8 } },
  { name: "Calgary", extent: { xmin: -114.3, ymin: 50.8, xmax: -113.8, ymax: 51.2 } },
  { name: "Edmonton", extent: { xmin: -113.7, ymin: 53.3, xmax: -113.2, ymax: 53.7 } },
  { name: "Hamilton", extent: { xmin: -80.0, ymin: 43.1, xmax: -79.7, ymax: 43.4 } },
  { name: "Mississauga", extent: { xmin: -79.8, ymin: 43.5, xmax: -79.5, ymax: 43.7 } },
  { name: "Montreal", extent: { xmin: -73.9, ymin: 45.4, xmax: -73.4, ymax: 45.7 } },
  { name: "Ottawa", extent: { xmin: -76.0, ymin: 45.1, xmax: -75.3, ymax: 45.5 } },
  { name: "Toronto", extent: { xmin: -79.6, ymin: 43.5, xmax: -79.1, ymax: 43.9 } },
  { name: "Vancouver", extent: { xmin: -123.3, ymin: 49.1, xmax: -122.9, ymax: 49.4 } },
  { name: "Winnipeg", extent: { xmin: -97.4, ymin: 49.7, xmax: -96.9, ymax: 50.0 } }
];

// +++ REMOVE LEGEND GENERATION LOGIC +++
// const getLegendDataForLayer = (layer: __esri.FeatureLayer): StandardizedLegendData | null => { ... };
// +++ END REMOVED LEGEND GENERATION LOGIC +++

// <<< Define Visualization type if not already present globally >>>
interface Visualization {
  getLegendInfo: () => StandardizedLegendData;
}

const MapWidgets: React.FC<MapWidgetsProps> = memo(function MapWidgets({ 
  view, 
  activeWidget, 
  onClose,
  onLayerSelect,
  onToggleWidget,
  // legend,
  showLoading = false,
  onLayerStatesChange,
  visibleWidgets = ['search', 'layerList', 'bookmarks', 'print'], // Added 'print' to default
  onCorrelationAnalysis
}: MapWidgetsProps) {
  console.log('[MapWidgets Render] Component rendering/re-rendering.'); // Log component render

  // Refs
  const widgetsRef = useRef<WidgetState>({
    print: null,
    search: null,
    bookmarks: null,
    layerList: null
  });
  
  const containersRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const isInitialized = useRef(false);
  const mountedRef = useRef(false);
  
  // React roots
  const layerControlRootRef = useRef<Root | null>(null);
  const projectsRootRef = useRef<Root | null>(null);
  const filterRootRef = useRef<Root | null>(null);
  const indexRootRef = useRef<Root | null>(null);
  
  // Layer management
  const sketchLayerRef = useRef<__esri.GraphicsLayer | null>(null);
  const layerControllerRef = useRef<LayerControllerRef | null>(null);
  
  // State
  const [layerConfig, setLayerConfig] = useState<ProjectLayerConfig | null>(null);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [initializationProgress, setInitializationProgress] = useState(0);
  const [containersReady, setContainersReady] = useState(false);
  const widgetCleanupHandles = useRef<Map<string, __esri.Handle[]>>(new Map());
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [legendData, setLegendData] = useState<StandardizedLegendData | null>(null);
  const [popoverAnchorEl, setPopoverAnchorEl] = useState<HTMLElement | null>(null);

  const layerListActionHandleRef = useRef<__esri.Handle | null>(null);

  // Initialize layer config
  useEffect(() => {
    try {
      const config = createProjectConfig();
      console.log('[MapWidgets] Created layer config:', {
        groupCount: config.groups.length,
        groups: config.groups.map(g => ({
          id: g.id,
          title: g.title,
          layerCount: g.layers?.length || 0,
          layerIds: g.layers?.map(l => l.id) || []
        })),
        totalLayers: config.groups.reduce((sum, g) => sum + (g.layers?.length || 0), 0)
      });
      setLayerConfig(config);
    } catch (error) {
      console.error('Error creating layer config:', error);
      setInitializationError('Failed to create layer configuration');
      setInitializationProgress(100);
    }
  }, []);

  // Create widget container - WRAP IN useCallback
  const createWidgetContainer = useCallback((type: string, color: string): HTMLDivElement => {
    const container = document.createElement('div');
    
    // Basic classes first
    container.className = 'widget-container esri-widget';
    
    // Add widget-specific ESRI classes
    switch(type) {
      case 'layerList':
        container.classList.add('esri-layer-list');
        break;
      case 'print':
        container.classList.add('esri-print');
        break;
      case 'search':
        container.classList.add('esri-search');
        break;
      case 'bookmarks':
        container.classList.add('esri-bookmarks');
        break;
      case 'filter':
        container.classList.add('esri-filter');
        break;
      case 'projects':
        container.classList.add('esri-projects');
        break;
      case 'index':
        container.classList.add('esri-index');
        break;
    }

    // Add our custom class last
    container.classList.add(`widget-${type}`);
    
    // Set other properties
    container.setAttribute('data-widget-type', type);
    container.style.setProperty('--widget-color', color);
    container.style.display = 'none';

    console.log(`Created widget container for ${type}:`, container.className);
    
    return container;
  }, []); // <-- Empty dependency array ensures stable reference

  // Render filter widget
  const renderFilterWidget = useCallback(() => {
    // This function now *returns* JSX for use in the portal
    return (
      <FilterWidget 
        view={view}
        onClose={onClose}
         layerStates={layerControllerRef.current?.layerStates || {}}
      />
    );
  }, [view, onClose]);

  // Render projects widget
  const renderProjectsWidget = useCallback(() => {
    const container = containersRef.current.get('projects');
    if (!container) return null; // Return null if container not ready
    
    if (!sketchLayerRef.current) {
      sketchLayerRef.current = new GraphicsLayer({
        title: "Sketch Layer",
        listMode: "hide"
      });
      view.map.add(sketchLayerRef.current);
    }

    const currentFeatureLayer = view.map.allLayers.find(layer => 
      layer.type === 'feature' && layer.visible
    ) as __esri.FeatureLayer;

    // This function now *returns* JSX for use in the portal
    return (
      <ProjectsWidget
        view={view}
        layer={currentFeatureLayer || view.map.allLayers.find(layer => layer.type === 'feature') as __esri.FeatureLayer}
        sketchLayer={sketchLayerRef.current}
        onClose={onClose}
        layerController={{
          toggleLayer: (layerId: string) => {
            layerControllerRef.current?.setVisibleLayers([layerId]);
          }
        }}
      />
    );
  }, [view, onClose]);

  // Main cleanup effect
  useEffect(() => {
    mountedRef.current = true;
    
    const widgets = { ...widgetsRef.current }; // Capture ref value
    const cleanupHandles = new Map(widgetCleanupHandles.current); // Capture cleanup handles
    const layerListHandle = layerListActionHandleRef.current; // Capture layer list handle

    return () => {
      mountedRef.current = false;

      // Cleanup roots
      if (layerControlRootRef.current) {
        layerControlRootRef.current.unmount();
        layerControlRootRef.current = null;
      }
      
      if (projectsRootRef.current) {
        projectsRootRef.current.unmount();
        projectsRootRef.current = null;
      }
      
      if (filterRootRef.current) {
        filterRootRef.current.unmount();
        filterRootRef.current = null;
      }
      
      if (indexRootRef.current) {
        indexRootRef.current.unmount();
        indexRootRef.current = null;
      }

      // Clean up sketch layer
      if (sketchLayerRef.current && view) {
        view.map.remove(sketchLayerRef.current);
        sketchLayerRef.current = null;
      }
      
      // +++ Clean up Watcher Handles +++
      cleanupHandles.forEach((handles: __esri.Handle[], layerId: string) => {
        console.log(`[MapWidgets Cleanup] Removing ${handles.length} watcher handles for layer ${layerId}`);
        handles.forEach((handle: __esri.Handle) => {
          try {
            handle.remove();
          } catch (removeError) {
            console.warn(`[MapWidgets Cleanup] Error removing handle for layer ${layerId}:`, removeError);
          }
        });
      });
      widgetCleanupHandles.current.clear();
      console.log('[MapWidgets Cleanup] Watcher handle cleanup complete.');
      // --- End Watcher Cleanup ---

      // Clean up layer list action handle
      if (layerListHandle) {
        layerListHandle.remove();
        layerListActionHandleRef.current = null;
      }

      // Clean up widgets
      Object.values(widgets).forEach(widget => {
        if (widget) {
          widget.destroy();
        }
      });
    };
  }, [view]);

  // Widget visibility effect - SIMPLIFIED
  useEffect(() => {
    console.log(`MAPWIDGETS_VISIBILITY: Effect running. activeWidget = ${activeWidget}, view exists = ${!!view}`);
    if (!view || !activeWidget) {
      // Hide and remove all containers
      containersRef.current.forEach((container, key) => {
        if (container) {
          container.style.display = 'none';
          if (container.parentElement) {
            view?.ui.remove(container);
          }
        }
      });
      console.log('MAPWIDGETS_VISIBILITY: No active widget or view, hiding/removing all.');
      return;
    }

    const currentContainer = containersRef.current.get(activeWidget);
    if (!currentContainer) {
      console.log(`MAPWIDGETS_VISIBILITY: No container found for activeWidget: ${activeWidget}`);
      return;
    }

    // Hide/remove others
    containersRef.current.forEach((container, key) => {
      if (container !== currentContainer) {
        container.style.display = 'none';
        if (container.parentElement) {
          view.ui.remove(container);
        }
      }
    });
    console.log(`MAPWIDGETS_VISIBILITY: Hiding other widgets, preparing to show ${activeWidget}`);
    
    // Show/add the active container
    currentContainer.style.display = 'block';
    if (!currentContainer.parentElement) {
      console.log(`MAPWIDGETS_VISIBILITY: Container for ${activeWidget} not in UI. Calling view.ui.add...`);
      try {
        view.ui.add({ component: currentContainer, position: "top-left", index: 1 });
        console.log(`MAPWIDGETS_VISIBILITY: view.ui.add for ${activeWidget} completed.`);
      } catch (error) {
        console.error(`MAPWIDGETS_VISIBILITY: Error during view.ui.add for ${activeWidget}:`, error);
      }
    } else {
      console.log(`MAPWIDGETS_VISIBILITY: Container for ${activeWidget} already in UI.`);
    }

    return () => {
      console.log(`MAPWIDGETS_VISIBILITY: Cleanup running. activeWidget = ${activeWidget}`);
      if (currentContainer && currentContainer.parentElement) {
        currentContainer.style.display = 'none';
        view.ui.remove(currentContainer);
      }
    };
  }, [activeWidget, view]);

  // Main Initialization Effect
  useEffect(() => {
    console.log("MAPWIDGETS_INIT: >>> EFFECT START <<<", { 
        viewExists: !!view, 
        containersReady, 
        isInitialized: isInitialized.current 
    }); // <<< ADD START LOG

    if (!view || !containersReady) {
      console.log('MAPWIDGETS_INIT: useEffect waiting for view or containers.');
        return;
      }
    console.log('MAPWIDGETS_INIT: useEffect started.');

    if (isInitialized.current) {
      console.log('MAPWIDGETS_INIT: Already initialized, skipping.');
          return;
        }

    let localIsInitialized = false;
    const localWidgetRefs: WidgetState = { print: null, search: null, bookmarks: null, layerList: null };
    let needsCleanup = false;
    console.log('MAPWIDGETS_INIT: Waiting for view.ready...');
    view.when(async () => {
      if (localIsInitialized) return; // Prevent re-entry
      console.log('MAPWIDGETS_INIT: View is ready. Initializing widgets...');
      localIsInitialized = true;
      needsCleanup = true; // Mark that cleanup is needed on unmount

      const containers = containersRef.current;
      const allowedWidgets = visibleWidgets || ['search', 'layerList', 'bookmarks']; // Ensure bookmarks is in default here too

      // --- Initialize Search Widget ---
      if (allowedWidgets.includes('search') && containers.has('search')) {
          try {
            console.log('MAPWIDGETS_INIT: Creating Search widget...');
            const searchWidget = new Search({ view, container: containers.get('search') });
            localWidgetRefs.search = searchWidget;
            console.log('MAPWIDGETS_INIT: Search widget created.');
          } catch (error) {
            console.error('MAPWIDGETS_INIT: Error creating Search widget:', error);
          }
      } else {
        console.log('MAPWIDGETS_INIT: Skipping Search widget.');
      }

      // --- Initialize Print Widget ---
      if (allowedWidgets.includes('print') && containers.has('print')) {
          try {
            console.log('MAPWIDGETS_INIT: Creating Print widget...');
            const printWidget = new Print({ 
              view, 
              container: containers.get('print'),
              // Add print service URL - this is a public Esri print service
              printServiceUrl: "https://utility.arcgisonline.com/arcgis/rest/services/Utilities/PrintingTools/GPServer/Export%20Web%20Map%20Task",
              // Add default template options
              templateOptions: {
                title: "Nesto Map Export",
                author: "Created with Nesto",
                copyright: "© Nesto",
                legendEnabled: true,
                scaleEnabled: true
              }
              // Default format is handled by the widget automatically
            });
            localWidgetRefs.print = printWidget;
            console.log('MAPWIDGETS_INIT: Print widget created.');
          } catch (error) {
            console.error('MAPWIDGETS_INIT: Error creating Print widget:', error);
          }
      } else {
          console.log('MAPWIDGETS_INIT: Skipping Print widget.');
        }

      // --- Initialize Bookmarks Widget ---
      if (allowedWidgets.includes('bookmarks') && containers.has('bookmarks')) {
          try {
            console.log('MAPWIDGETS_INIT: Creating Bookmarks widget...');
            const bookmarksWidget = new Bookmarks({ view, container: containers.get('bookmarks') });
            
            // Create Bookmark instances from Canadian city data
            const canadianBookmarksArray = CANADIAN_CITY_BOOKMARKS_DATA.map(b => new Bookmark({
              name: b.name,
              viewpoint: {
                targetGeometry: new Extent({
                  ...b.extent,
                  spatialReference: { wkid: 4326 }
                })
              }
            }));
            bookmarksWidget.bookmarks = new Collection(canadianBookmarksArray); // Assign a Collection
            localWidgetRefs.bookmarks = bookmarksWidget;
            console.log('MAPWIDGETS_INIT: Bookmarks widget created and populated with Canadian cities.');
          } catch (error) {
            console.error('MAPWIDGETS_INIT: Error creating Bookmarks widget:', error);
          }
      } else {
          console.log('MAPWIDGETS_INIT: Skipping Bookmarks widget.');
      }

      // --- React Portals (Filter, Projects, Index) ---
      const createAndRenderPortal = async (widgetId: string, Component: React.ReactNode) => {
          if (allowedWidgets.includes(widgetId) && containers.has(widgetId)) {
              const container = containers.get(widgetId)!;
              try {
                 console.log(`MAPWIDGETS_INIT: Creating React root and rendering portal for ${widgetId}...`);
                 // Use createRoot for React 18+
                 const { createRoot } = await import('react-dom/client');
                 const root = createRoot(container);
                 root.render(Component);
                 // Store the root for later unmounting
                 if (widgetId === 'filter') filterRootRef.current = root;
                 else if (widgetId === 'projects') projectsRootRef.current = root;
                 else if (widgetId === 'index') indexRootRef.current = root;
                 console.log(`MAPWIDGETS_INIT: Portal for ${widgetId} rendered.`);
              } catch (error) {
                 console.error(`MAPWIDGETS_INIT: Error creating/rendering portal for ${widgetId}:`, error);
              }
          } else {
             console.log(`MAPWIDGETS_INIT: Skipping portal for ${widgetId}.`);
          }
      };

      // Conditionally render portals based on allowedWidgets
      // Note: Ensure the components (FilterWidget, ProjectsWidget, IndexWidget) are correctly imported and props are passed
      // createAndRenderPortal('filter', <FilterWidget view={view} onClose={onClose} layerStates={layerControllerRef.current?.layerStates || {}} />);
      // createAndRenderPortal('projects', <ProjectsWidget /* pass necessary props */ view={view} onClose={onClose} layerController={{ toggleLayer: () => {} /* implement */ }} />);
      // createAndRenderPortal('index', <IndexWidget /* pass necessary props */ view={view} onClose={onClose} />);


      // Update main refs
      widgetsRef.current = localWidgetRefs;
        isInitialized.current = true;
      console.log('MAPWIDGETS_INIT: All widgets initialized.');

    }).catch(error => {
      if (error.name !== 'AbortError') { // Ignore AbortErrors from view destruction
        console.error('MAPWIDGETS_INIT: Error waiting for view.ready:', error);
      }
    });

    // Cleanup function for the useEffect hook
    return () => {
      console.log('[MapWidgets Cleanup - INITIALIZATION EFFECT] >>> CLEANUP START <<<');
      if (needsCleanup) {
        // Destroy widgets if they exist
        Object.values(widgetsRef.current).forEach(widget => {
          if (widget && !widget.destroyed) {
            try {
              widget.destroy();
            } catch (e) {
              console.warn('Error destroying widget:', e);
            }
          }
        });
        widgetsRef.current = { print: null, search: null, bookmarks: null, layerList: null }; // Clear widget refs
        console.log('[MapWidgets Cleanup - INITIALIZATION EFFECT] Widgets destroyed.');
      }
      isInitialized.current = false;
      console.log('[MapWidgets Cleanup - INITIALIZATION EFFECT] Cleanup complete.');
      
      // Cleanup action listener from its ref
      const currentLayerListHandle = layerListActionHandleRef.current;
      if (currentLayerListHandle) {
        currentLayerListHandle.remove();
        layerListActionHandleRef.current = null;
      }
    };
  }, [view, containersReady, visibleWidgets, createWidgetContainer, onClose]); // Dependencies

  // Render logic
  const layerControllerPortal = useMemo(() => {
    if (!containersReady || !view || !layerConfig) {
      return null;
    }
    const container = containersRef.current?.get('layerList'); 
    if (!container) return null;
    return createPortal(
      <LayerController
        ref={layerControllerRef}
        view={view}
        config={layerConfig}
        onLayerStatesChange={onLayerStatesChange}
        visible={activeWidget === 'layerList'} 
      />,
      container
    );
  }, [view, layerConfig, onLayerStatesChange, containersReady, activeWidget]); 

  // <<< ADD useEffect hook to create containers and set containersReady >>>
  useEffect(() => {
    if (!view || containersReady) return; // Only run once when view is ready and containers aren't

    console.log("MAPWIDGETS_CONTAINERS: Creating widget containers...");
    const allowedWidgets = visibleWidgets || ['search', 'layerList', 'bookmarks', 'print'];
    const createdContainers = new Map<string, HTMLDivElement>();

    allowedWidgets.forEach(widgetId => {
      // Determine color - default or map based on ID
      let color = '#ccc'; // Default color
      if (widgetId === 'search') color = '#4285f4';
      else if (widgetId === 'layerList') color = '#33a852';
      else if (widgetId === 'print') color = '#3269a8';
      // Add other widget colors if needed
      
      const container = createWidgetContainer(widgetId, color);
      createdContainers.set(widgetId, container);
    });

    containersRef.current = createdContainers; // Store the created containers
    setContainersReady(true); // Signal that containers are ready
    console.log("MAPWIDGETS_CONTAINERS: Containers created and ready flag set.", createdContainers);

    // No cleanup needed here as containers are managed by ArcGIS UI later

  }, [view, containersReady, visibleWidgets, createWidgetContainer]); // Dependencies

  if (!view) return null;

  return (
    <div className="map-widgets-container">
      <LoadingModal progress={initializationProgress} show={showLoading} />
      {showLoading && (
        <div className="loading-indicator">
          <span>Loading layers...</span>
        </div>
      )}
      {activeWidget && (
        <button
          onClick={onClose}
          className="widget-close-button"
          aria-label="Close widget"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      {layerControllerPortal}
      {/* Render widgets based on activeWidget state if needed, using portals or conditional rendering */}
      {/* Example for filter widget: */}
      {activeWidget === 'filter' && containersRef.current.get('filter') && createPortal(
        renderFilterWidget(), // Call the function that returns JSX
        containersRef.current.get('filter')!
      )}
      {/* Example for projects widget: */}
      {activeWidget === 'projects' && containersRef.current.get('projects') && createPortal(
        renderProjectsWidget(), // Assuming this returns JSX
        containersRef.current.get('projects')!
      )}
    </div>
  );
});

export default MapWidgets;