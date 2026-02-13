import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Filter, X, ChevronDown, Plus } from 'lucide-react';
import FeatureFilter from '@arcgis/core/layers/support/FeatureFilter';
import { LAYER_GROUPS, getAllLayerFields, FilterField } from './cold-filter-fields';
import type { LayerState } from './types';

interface FilterWidgetProps {
  view: __esri.MapView;
  onClose: () => void;
  layerStates: { [key: string]: LayerState };
}

interface FilterState {
  field: string;
  operator: string;
  value: string | number;
}

interface FilterGroup {
  id: string;
  name: string;
  layer: __esri.FeatureLayer;
  filters: FilterState[];
  featureCount?: number;
}

const getFilterDescription = (filter: FilterState, fields: FilterField[]): string => {
  if (!filter.field || !filter.operator) return '';
  
  const fieldInfo = fields.find(f => f.value === filter.field);
  if (!fieldInfo) return '';
  
  const operatorText = {
    '=': 'equals',
    '<>': 'does not equal',
    '>': 'is greater than',
    '<': 'is less than',
    '>=': 'is greater than or equal to',
    '<=': 'is less than or equal to'
  }[filter.operator] || filter.operator;

  return filter.value 
    ? `finding areas where ${fieldInfo.label} ${operatorText} ${filter.value}`
    : '';
};

export default function FilterWidget({ view, onClose, layerStates }: FilterWidgetProps) {
  const [filterGroups, setFilterGroups] = useState<FilterGroup[]>([]);
  const [visibleLayers, setVisibleLayers] = useState<__esri.FeatureLayer[]>([]);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const filterHandles = useRef<{ [key: string]: __esri.Handle }>({});
  const fields = getAllLayerFields();

  // Update visible layers based on layerStates
  useEffect(() => {
    const updateVisibleLayers = () => {
      console.log('LAYER_GROUPS:', LAYER_GROUPS);
      console.log('layerStates:', layerStates);

      // Detailed inspection of each layer state
      Object.entries(layerStates).forEach(([key, state]) => {
        console.log(`Layer ${key}:`, {
          visible: state.visible,
          hasLayer: !!state.layer,
          layerType: state.layer?.type,
          layerId: state.layer?.id,
          layerTitle: state.layer?.title
        });
      });

      const visibleLayersFromStates = Object.entries(layerStates)
        .filter(([_, state]) => {
          const hasLayer = !!state.layer;
          // Debug version - only check for layer presence, ignore visibility
          console.log(`Filtering ${state.layer?.id}: hasLayer=${hasLayer}`);
          return hasLayer;
        })
        .map(([_, state]) => state.layer as __esri.FeatureLayer);
      
      console.log('Pre-filter visible layers:', visibleLayersFromStates);
      
      // Filter layers by matching titles instead of IDs
      const filteredLayers = visibleLayersFromStates.filter(layer => {
        const isInGroup = LAYER_GROUPS.some(group => 
          group.layers.some(l => l.title === layer.title)
        );
        console.log(`Layer ${layer.title} (${layer.id}): ${isInGroup ? 'included' : 'excluded'}`);
        return isInGroup;
      });

      console.log('Final visible layers:', filteredLayers);
      setVisibleLayers(filteredLayers);
    };

    updateVisibleLayers();
  }, [layerStates]);

  const addFilterGroup = useCallback((layer: __esri.FeatureLayer) => {
    console.log('Adding filter group for layer:', layer);
    const defaultField = fields[0]?.value || '';
    
    const newGroup: FilterGroup = {
      id: `filter-${Date.now()}`,
      name: layer.title || 'Unnamed Layer',
      layer: layer,
      filters: [{
        field: defaultField,
        operator: '=',
        value: ''
      }]
    };
    
    setFilterGroups((prev: FilterGroup[]) => [...prev, newGroup]);
    setExpandedGroupId(newGroup.id);
  }, [fields]);

  const addFilter = useCallback((groupId: string) => {
    setFilterGroups((prev: FilterGroup[]) => prev.map(group => {
      if (group.id === groupId) {
        const defaultField = fields[0]?.value || '';
        
        return {
          ...group,
          filters: [...group.filters, {
            field: defaultField,
            operator: '=',
            value: ''
          }]
        };
      }
      return group;
    }));
  }, [fields]);

  const updateFilter = useCallback((
    groupId: string,
    filterIndex: number,
    field: keyof FilterState,
    value: string | number
  ) => {
    setFilterGroups((prev: FilterGroup[]) => prev.map(group => {
      if (group.id === groupId) {
        const newFilters = [...group.filters];
        newFilters[filterIndex] = {
          ...newFilters[filterIndex],
          [field]: value
        };
        return { ...group, filters: newFilters };
      }
      return group;
    }));
  }, []);

  const removeFilter = useCallback((groupId: string, filterIndex: number) => {
    setFilterGroups((prev: FilterGroup[]) => prev.map(group => {
      if (group.id === groupId) {
        const newFilters = group.filters.filter((_, i) => i !== filterIndex);
        return { ...group, filters: newFilters };
      }
      return group;
    }));
  }, []);

  const removeFilterGroup = useCallback((groupId: string) => {
    setFilterGroups((prev: FilterGroup[]) => prev.filter(group => group.id !== groupId));
  }, []);

  const applyFilters = useCallback(async (group: FilterGroup) => {
    console.log('Applying filters for group:', group);
    try {
      const layerView = await view.whenLayerView(group.layer);
      if (!layerView || !('filter' in layerView)) {
        console.log('No valid layer view found');
        return;
      }

                const whereClause = group.filters
        .map(filter => {
          if (!filter.value) return '';

          const numericValue = Number(filter.value);
          if (isNaN(numericValue)) return '';

          // Enclose field names in quotes for SQL compatibility
          return `"${filter.field}" ${filter.operator} ${numericValue}`;
        })
        .filter(Boolean)
        .join(' AND ');

      console.log('Generated where clause:', whereClause);

      const featureLayerView = layerView as __esri.FeatureLayerView;
      
      if (whereClause) {
        try {
          // Test query
          const testQuery = group.layer.createQuery();
          testQuery.where = whereClause;
          const testResult = await group.layer.queryFeatureCount(testQuery);
          console.log('Feature count:', testResult);

          // Apply filter
          const filter = new FeatureFilter({
            where: whereClause
          });

          featureLayerView.filter = filter;

          // Update feature count
          setFilterGroups((prev: FilterGroup[]) => prev.map(fg => 
            fg.id === group.id ? { ...fg, featureCount: testResult } : fg
          ));
        } catch (e) {
          console.error('Error applying filter:', e);
          featureLayerView.filter = new FeatureFilter();
        }
      } else {
        featureLayerView.filter = new FeatureFilter();
        setFilterGroups((prev: FilterGroup[]) => prev.map(fg => 
          fg.id === group.id ? { ...fg, featureCount: undefined } : fg
        ));
      }
    } catch (error) {
      console.error('Error in applyFilters:', error);
    }
  }, [view]);

  // Cleanup filters on unmount
  useEffect(() => {
    const currentHandles = { ...filterHandles.current };

    return () => {
      Object.values(currentHandles).forEach(handle => handle.remove());
      
      view.map.allLayers.forEach(async (layer) => {
        if (layer.type === 'feature') {
          try {
            const layerView = await view.whenLayerView(layer);
            if (layerView && 'filter' in layerView) {
              (layerView as __esri.FeatureLayerView).filter = new FeatureFilter();
            }
          } catch (error) {
            console.error('Error cleaning up filter:', error);
          }
        }
      });
    };
  }, [view]);

  return (
    <div className="p-4 space-y-4 max-w-2xl">
      <div className="flex justify-between items-center">
        <div className="w-full">
          <select 
            className="w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#33a852] focus:border-transparent rounded-md"
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              const layer = visibleLayers.find(l => l.id === e.target.value);
              if (layer) addFilterGroup(layer);
            }}
            value=""
          >
            <option value="">Add Layer Filter</option>
            {visibleLayers.map(layer => (
              <option key={layer.id} value={layer.id}>
                {layer.title || 'Unnamed Layer'}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {filterGroups.map(group => (
          <div key={group.id} className="border rounded-lg bg-white shadow-sm">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center">
                <Filter className="w-4 h-4 text-[#33a852] mr-2" />
                <span className="font-medium">{group.name}</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => removeFilterGroup(group.id)}
                  className="p-1 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
                <button
                  onClick={() => setExpandedGroupId(
                    expandedGroupId === group.id ? null : group.id
                  )}
                  className="p-1 hover:bg-gray-100 rounded-full"
                >
                  <ChevronDown 
                    className={`w-4 h-4 text-gray-500 transform transition-transform ${
                      expandedGroupId === group.id ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              </div>
            </div>

            {expandedGroupId === group.id && (
              <div className="p-4 space-y-4">
                {group.filters.map((filter, index) => {
                  const description = getFilterDescription(filter, fields);

                  return (
                    <div key={index} className="grid grid-cols-1 gap-3 p-4 bg-gray-50 rounded-lg">
                      {description && (
                        <div className="space-y-1">
                          <div className="text-sm text-gray-600 italic">
                            {description}
                          </div>
                          {group.featureCount !== undefined && (
                            <div className="text-sm font-medium text-gray-700">
                              {group.featureCount.toLocaleString()} features shown
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="flex flex-col space-y-2">
                        <label className="text-sm text-gray-600">Field</label>
                        <select
                          value={filter.field}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateFilter(group.id, index, 'field', e.target.value)}
                          className="w-full pl-3 pr-10 py-2 text-sm border border-gray-300 rounded-md"
                        >
                          {fields.map(field => (
                            <option key={`${field.layerId}-${field.value}`} value={field.value}>
                              {field.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col space-y-2">
                        <label className="text-sm text-gray-600">Operator</label>
                        <select
                          value={filter.operator}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateFilter(group.id, index, 'operator', e.target.value)}
                          className="w-full pl-3 pr-10 py-2 text-sm border border-gray-300 rounded-md"
                        >
                          <option value="=">Equal to (=)</option>
                          <option value="<>">Not equal to (≠)</option>
                          <option value=">">Greater than (&gt;)</option>
                          <option value="<">Less than (&lt;)</option>
                          <option value=">=">Greater than or equal to (≥)</option>
                          <option value="<=">Less than or equal to (≤)</option>
                        </select>
                      </div>

                      <div className="flex flex-col space-y-2">
                        <label className="text-sm text-gray-600">Value</label>
                        <div className="flex space-x-2">
                          <input
                            type="number"
                            value={filter.value}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateFilter(group.id, index, 'value', e.target.value)}
                            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md"
                            placeholder="Enter numeric value"
                            step="any"
                          />
                          <button
                            onClick={() => removeFilter(group.id, index)}
                            className="p-2 hover:bg-gray-100 rounded-full"
                            title="Remove filter"
                          >
                            <X className="w-4 h-4 text-gray-500" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="flex justify-between pt-2">
                  <button
                    onClick={() => addFilter(group.id)}
                    className="flex items-center px-3 py-2 text-sm text-[#33a852] hover:bg-gray-50 rounded-md"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Condition
</button>

<button
  onClick={() => applyFilters(group)}
  className="px-4 py-2 text-sm text-white bg-[#33a852] rounded-md hover:bg-[#2d964a]"
>
  Apply Filters
</button>
</div>
</div>
)}
</div>
))}
</div>
</div>
);
}
