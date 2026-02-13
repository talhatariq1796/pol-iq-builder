import React, { useEffect, useRef, useCallback } from 'react';
import FeatureTable from '@arcgis/core/widgets/FeatureTable';
import Collection from '@arcgis/core/core/Collection';
import Color from '@arcgis/core/Color';
import Graphic from '@arcgis/core/Graphic';

interface ExtendedFeatureTable extends FeatureTable {
  highlightIds: Collection<number>;
  filterByFunction: ((feature: any) => boolean) | null;
}

interface ExtendedMapView extends __esri.MapView {
  highlight: (features: Graphic[]) => IHandle;
}

interface FeatureTableProps {
  view: __esri.MapView;
  layer: __esri.FeatureLayer;
  onClose: () => void;
  containerHeight?: string;
}

interface IHandle {
  remove: () => void;
}

const FeatureTableComponentImpl: React.FC<FeatureTableProps> = ({
  view,
  layer,
  onClose,
  containerHeight = '50vh'
}) => {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const featureTableRef = useRef<ExtendedFeatureTable | null>(null);
  const highlightHandleRef = useRef<IHandle | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const cleanup = useCallback(() => {
    if (featureTableRef.current) {
      featureTableRef.current.destroy();
      featureTableRef.current = null;
    }
    if (highlightHandleRef.current) {
      highlightHandleRef.current.remove();
      highlightHandleRef.current = null;
    }
  }, []);

  const handleSearch = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const searchValue = event.target.value.trim();
    if (!featureTableRef.current) return;
  
    try {
      if (searchValue) {
        const query = layer.createQuery();
        const fields = layer.fields
          .filter(field => field.type === 'string')
          .map(field => field.name);
        
        if (fields.length > 0) {
          const conditions = fields
            .map(field => `UPPER(${field}) LIKE '%${searchValue.toUpperCase()}%'`);
          query.where = conditions.join(' OR ');
        }
  
        const queryResults = await layer.queryFeatures(query);
        const objectIds = queryResults.features.map(feature => feature.attributes[layer.objectIdField]);
        
        if (objectIds.length > 0) {
          layer.definitionExpression = `${layer.objectIdField} IN (${objectIds.join(',')})`;
        } else {
          layer.definitionExpression = '1=2'; // No results
        }
      } else {
        layer.definitionExpression = '';
      }
      
      await featureTableRef.current.refresh();
    } catch (error) {
      console.error("Error filtering features:", error);
      layer.definitionExpression = '';
      await featureTableRef.current.refresh();
    }
  };

  useEffect(() => {
    if (!tableContainerRef.current || !view || !layer) return;

    const featureTableContainer = document.createElement('div');
    featureTableContainer.style.flex = '1';
    featureTableContainer.style.overflow = 'auto';
    featureTableContainer.style.backgroundColor = 'white';
    tableContainerRef.current.appendChild(featureTableContainer);

    const createFeatureTable = async () => {
      try {
        await layer.load();

        const featureTable = new FeatureTable({
          view,
          layer,
          container: featureTableContainer,
          highlightEnabled: true,
          multiSortEnabled: true,
          visibleElements: {
            header: true,
            menu: true,
            menuItems: {
              clearSelection: true,
              refreshData: true,
              toggleColumns: true,
              selectedRecordsShowAllToggle: true,
              zoomToSelection: true
            }
          }
        });

        featureTableRef.current = featureTable as ExtendedFeatureTable;

        if (headerRef.current) {
          const exportBtn = headerRef.current.querySelector('.export-btn');
          if (exportBtn) {
            exportBtn.addEventListener('click', async () => {
              try {
                const query = layer.createQuery();
                query.where = "1=1";
                query.outFields = ["*"];
                const results = await layer.queryFeatures(query);
                if (!results.features.length) return;

                const fields = Object.keys(results.features[0].attributes);
                const csv = [
                  fields.join(','),
                  ...results.features.map(f => 
                    fields.map(field => {
                      const value = f.attributes[field];
                      return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
                    }).join(',')
                  )
                ].join('\n');

                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${layer.title || 'export'}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              } catch (error) {
                console.error("Error exporting data:", error);
              }
            });
          }

          const closeBtn = headerRef.current.querySelector('.close-btn');
          if (closeBtn) {
            closeBtn.addEventListener('click', () => {
              cleanup();
              onClose();
            });
          }
        }

        featureTable.on("selection-change" as any, (event: any) => {
          // Use MPIQ green variation instead of ArcGIS cyan
          view.highlightOptions = {
            color: new Color([51, 168, 82, 1]),  // MPIQ green #33a852
            haloOpacity: 0.9,
            fillOpacity: 0.25
          };

          const features = event.selected.map((item: any) => item.feature);
          if (features.length > 0) {
            view.goTo(features);
            (view as ExtendedMapView).highlight(features);
          }
        });

        await featureTable.when();
        featureTable.refresh();

      } catch (error) {
        console.error("Error creating feature table:", error);
      }
    };

    createFeatureTable();
    return cleanup;
  }, [view, layer, cleanup, onClose]);

  return (
    <div 
      ref={tableContainerRef}
      className="feature-table-content"
      style={{
        height: containerHeight,
        width: 'calc(100% - 512px)',
        backgroundColor: 'white',
        position: 'fixed',
        bottom: 0,
        left: '64px',
        right: '448px',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 99,
        boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.1)',
        borderTop: '2px solid #e5e7eb'
      }}
    >
      <div 
        ref={headerRef}
        className="feature-table-custom-header"
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'white',
          height: '56px',
          position: 'sticky',
          top: 0,
          zIndex: 100
        }}
      >
        <div className="feature-table-header-content" style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <div className="feature-table-search" style={{ flex: 1, maxWidth: '300px' }}>
            <input
              ref={searchInputRef}
              type="text"
              placeholder={`Search ${layer.title || 'features'}...`}
              className="feature-table-search-input"
              onChange={handleSearch}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #e5e7eb',
                borderRadius: '4px',
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>
          <div className="feature-table-actions" style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <button className="feature-table-btn export-btn">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px', marginRight: '4px' }}>
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export
            </button>
            <button className="feature-table-btn close-btn">×</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeatureTableComponentImpl;