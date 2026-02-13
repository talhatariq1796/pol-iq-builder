import React, { useEffect, useRef } from 'react';
import FeatureTable from '@arcgis/core/widgets/FeatureTable';
import { X } from 'lucide-react';

interface ExtendedFeatureTable extends __esri.FeatureTable {
  grid: {
    selectedRows: { objectId: number; [key: string]: any; }[];
  };
}

interface FeatureTableProps {
  view: __esri.MapView;
  layer: __esri.FeatureLayer;
  onClose: () => void;
}

const FeatureTableComponent: React.FC<FeatureTableProps> = ({
  view,
  layer,
  onClose
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<ExtendedFeatureTable | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let timeoutId: NodeJS.Timeout;

    const initFeatureTable = async () => {
      if (!containerRef.current || !view || !layer) return;
      
      // Check if layer is loaded and visible
      if (layer.destroyed || !layer.visible || !layer.loaded) {
        if (tableRef.current) {
          tableRef.current.destroy();
          tableRef.current = null;
        }
        return;
      }

      try {
        // Destroy existing table if it exists
        if (tableRef.current) {
          tableRef.current.destroy();
          tableRef.current = null;
        }

        // Clear any existing content and wait for cleanup
        if (containerRef.current) {
          while (containerRef.current.firstChild) {
            containerRef.current.removeChild(containerRef.current.firstChild);
          }
        }

        // Important: Wait for cleanup
        await new Promise(resolve => {
          timeoutId = setTimeout(resolve, 50);
        });

        // Check if still mounted and layer is still visible
        if (!mountedRef.current || !containerRef.current || !layer.visible) return;

        // Create new feature table
        const featureTable = new FeatureTable({
          container: containerRef.current,
          view,
          layer,
          multiSortEnabled: true,
          highlightEnabled: true,
          visibleElements: {
            header: true,
            menu: true,
            menuItems: {
              clearSelection: true,
              refreshData: true,
              toggleColumns: true,
              zoomToSelection: true
            },
            selectionColumn: true,
            columnMenus: true
          }
        }) as ExtendedFeatureTable;

        // Wait for table to load
        await featureTable.when();
        
        if (!mountedRef.current || !layer.visible) {
          featureTable.destroy();
          return;
        }

        tableRef.current = featureTable;
      } catch (error) {
        if (mountedRef.current) {
          console.error("Error initializing feature table:", error);
        }
      }
    };

    // Initialize table
    initFeatureTable();

    // Add visibility change handler
    const visibilityWatcher = layer.watch('visible', () => {
      if (!layer.visible && tableRef.current) {
        tableRef.current.destroy();
        tableRef.current = null;
      } else if (layer.visible) {
        initFeatureTable();
      }
    });

    return () => {
      mountedRef.current = false;
      clearTimeout(timeoutId);
      if (tableRef.current) {
        tableRef.current.destroy();
        tableRef.current = null;
      }
      if (visibilityWatcher) {
        visibilityWatcher.remove();
      }
    };
  }, [view, layer]);

  const sidebarWidth = view.padding?.right || 600;

  return (
    <div className="fixed bottom-0 bg-white shadow-lg border-t-2 border-gray-200 z-50"
      style={{
        left: '64px',
        right: `${sidebarWidth}px`
      }}
    >
      <div className="h-14 px-4 border-b border-gray-200 flex items-center justify-between bg-white">
        <div className="flex items-center space-x-2">
          <h3 className="font-medium text-[#33a852]">
            {layer?.title || 'Feature Table'}
          </h3>
          {layer?.loaded && (
            <span className="text-sm text-gray-500">
              ({layer.geometryType})
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-md text-gray-600 hover:text-[#33a852] transition-colors"
          aria-label="Close feature table"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div
        ref={containerRef}
        style={{
          height: '40vh',
          width: '100%',
          position: 'relative'
        }}
        className="feature-table-container bg-white"
      />
    </div>
  );
};

export default React.memo(FeatureTableComponent);