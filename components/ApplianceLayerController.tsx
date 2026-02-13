/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { useState, useEffect, useCallback, forwardRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { 
  DndContext, 
  DragEndEvent, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  closestCenter,
  DragOverlay,
  DragStartEvent
} from '@dnd-kit/core';
import { 
  SortableContext, 
  arrayMove, 
  verticalListSortingStrategy, 
  useSortable 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from "@/components/ui/progress";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import { createQuartileRenderer } from '@/utils/createQuartileRenderer';
import LayerLegend from './LayerController/LayerLegend';
import SimpleRenderer from "@arcgis/core/renderers/SimpleRenderer";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import { LAYER_GROUPS } from './layer-groups';
// Interfaces
export interface LayerState {
  layer: __esri.FeatureLayer | null;
  visible: boolean;
  loading: boolean;
  error?: string;
  group: string;
}
export interface LayerControllerProps {
  view: __esri.MapView;
  onLayerStatesChange?: (states: { [key: string]: LayerState }) => void;
  visible?: boolean;
}

export interface LayerControllerRef {
  layerStates: { [key: string]: LayerState };
  isInitialized: boolean;
  setVisibleLayers: (layers: string[]) => void;
  setLayerStates: (newStates: { [key: string]: LayerState }) => void;
  resetLayers: () => void;
}
interface DraggableLayerProps {
  id: string;
  title: string;
  description: string;
  isVisible: boolean;
  isLoading?: boolean;
  layer: __esri.FeatureLayer | null;
  onToggle: () => void;
  isDragOverlay?: boolean;
}
interface LoadingState {
  total: number;
  loaded: number;
  currentLayer: string;
}
// Switch Component
const Switch = ({ checked, onCheckedChange, disabled }: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => !disabled && onCheckedChange(!checked)}
    disabled={disabled}
    className={`
      relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent 
      transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 
      focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background 
      ${checked ? 'bg-green-500' : 'bg-gray-200'}
      ${disabled ? 'opacity-50 cursor-wait' : ''}
    `}
  >
    <span
      className={`
        pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 
        transition-transform duration-200 ease-in-out
        ${checked ? 'translate-x-4' : 'translate-x-0'}
        ${disabled ? 'animate-pulse' : ''}
      `}
    />
  </button>
);
// DraggableLayer Component  
const DraggableLayer: React.FC<DraggableLayerProps> = ({
  id,
  title,
  description,
  isVisible,
  isLoading = false,
  layer,
  onToggle,
  isDragOverlay = false
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled: isDragOverlay
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative space-y-2 border-b border-gray-100 pb-4 last:border-0"
    >
      <div className="flex items-center gap-2">
        <button
          {...listeners}
          {...attributes}
          className="touch-none px-0.5 py-1 hover:bg-gray-50 rounded cursor-grab active:cursor-grabbing"
        >
          <GripVertical size={16} className="text-gray-400 group-hover:text-gray-500" />
        </button>
        <div className="flex-1 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Switch
              checked={isVisible}
              onCheckedChange={onToggle}
              disabled={isLoading}
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-sm font-medium cursor-help">{title}</span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-500" />}
            {layer && <LayerLegend 
              layer={layer}
              isVisible={isVisible}
            />}
          </div>
        </div>
      </div>
    </div>
  );
};
// DraggableGroup Component
const DraggableGroup = ({ 
  id, 
  title, 
  isCollapsed, 
  onToggleCollapse, 
  children 
}: {
  id: string;
  title: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  children: React.ReactNode;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `group-${id}`,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="layer-group mb-4">
      <div className="flex items-center gap-2 mb-2">
        <button
          {...listeners}
          {...attributes}
          className="touch-none px-0.5 py-1 hover:bg-gray-50 rounded cursor-grab active:cursor-grabbing"
        >
          <GripVertical size={16} className="text-gray-400 hover:text-gray-500" />
        </button>
        <h3 
          className="flex-1 text-sm font-medium cursor-pointer flex items-center gap-2" 
          onClick={onToggleCollapse}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          {title}
        </h3>
      </div>
      {!isCollapsed && children}
    </div>
  );
};
// Main ApplianceLayerController Component
const ApplianceLayerController = forwardRef(({ view, onLayerStatesChange, visible = false }: LayerControllerProps, ref: React.Ref<LayerControllerRef>) => {
  const [layerStates, setLayerStates] = useState<{ [key: string]: LayerState }>({});
  const [isInitialized, setIsInitialized] = useState(false);
  const [visibleLayers, setVisibleLayers] = useState<string[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<{ [key: string]: boolean }>({
    'stores': true,
    'spending': true,
    'demographics': true,
    'store-expenditure': true
  });
  const [layerOrder, setLayerOrder] = useState<string[]>([]);
  const [groupOrder, setGroupOrder] = useState<string[]>(
    LAYER_GROUPS.map(group => group.id)
  );
  const [loadingState, setLoadingState] = useState<LoadingState>({
    total: 0,
    loaded: 0,
    currentLayer: ''
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor));
  useEffect(() => {
    const initializeLayers = async () => {
      if (!view || isInitialized) return;
      try {
        const totalLayers = LAYER_GROUPS.reduce((total, group) => 
          total + group.layers.length, 0
        );
        setLoadingState({
          total: totalLayers,
          loaded: 0,
          currentLayer: 'Initializing...'
        });
        const newLayerStates: { [key: string]: LayerState } = {};
        const newLayerOrder: string[] = [];
        for (const group of LAYER_GROUPS) {
          for (const layerConfig of group.layers) {
            setLoadingState((prev: LoadingState) => ({
              ...prev,
              currentLayer: layerConfig.title,
              loaded: prev.loaded + 1
            }));
            const layer = new FeatureLayer({
              url: layerConfig.url,
              title: layerConfig.title || undefined,
              outFields: ["*"],
              popupEnabled: true,
              visible: false,
              opacity: 0.7
            });
            if (layerConfig.id === 'lowes') {
              layer.renderer = new SimpleRenderer({
                symbol: new SimpleMarkerSymbol({
                  size: 8,
                  color: [0, 92, 230],
                  outline: {
                    color: [255, 255, 255],
                    width: 1
                  }
                })
              });
            } else if (layerConfig.id === 'home-depot') {
              layer.renderer = new SimpleRenderer({
                symbol: new SimpleMarkerSymbol({
                  size: 8,
                  color: [235, 81, 0],
                  outline: {
                    color: [255, 255, 255],
                    width: 1
                  }
                })
              });
            } else if (layerConfig.fields) {
              try {
                const fieldName = layerConfig.fields.count || layerConfig.fields.percent;
                if (fieldName) {
                  const renderer = await createQuartileRenderer({
                    layer,
                    field: fieldName
                  });
                  if (renderer) {
                    layer.renderer = renderer.renderer;
                  }
                }
              } catch (rendererError) {
                console.warn(`Renderer creation failed for ${layerConfig.title}:`, rendererError);
              }
            }
            view.map.add(layer);
            await layer.load();
            newLayerStates[layerConfig.id] = {
              layer,
              visible: false,
              loading: false,
              group: group.id
            };
            newLayerOrder.push(layerConfig.id);
          }
        }
        if (view) {
          setLayerStates(newLayerStates);
          setLayerOrder(newLayerOrder);
          setIsInitialized(true);
          onLayerStatesChange?.(newLayerStates);
        }
      } catch (error) {
        console.error('Error initializing layers:', error);
        if (view) setIsInitialized(false);
      }
    };
    initializeLayers();
    return () => {
      if (view) {
        Object.values(layerStates).forEach(state => {
          if (state.layer && view.map) {
            view.map.remove(state.layer);
          }
        });
      }
    };
  }, [view, isInitialized]);
  useEffect(() => {
    if (!view) return;
    const initialVisibleLayers = view.map.layers.toArray()
      .filter((layer: __esri.Layer) => layer.visible)
      .map((layer: __esri.Layer) => layer.id);
    setVisibleLayers(initialVisibleLayers);
  }, [view]);
  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev: { [key: string]: boolean }) => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };
  const toggleLayer = useCallback((layerId: string) => {
    setVisibleLayers((prev: string[]) => {
      const newVisibleLayers = prev.includes(layerId)
        ? prev.filter((id: string) => id !== layerId)
        : [...prev, layerId];
      const layer = layerStates[layerId]?.layer;
      if (layer) {
        layer.visible = newVisibleLayers.includes(layerId);
      }
      return newVisibleLayers;
    });
    setLayerStates((prev: { [key: string]: LayerState }) => {
      const currentState = prev[layerId];
      if (currentState && currentState.layer) {
        return {
          ...prev,
          [layerId]: {
            ...currentState,
            visible: !currentState.visible
          }
        };
      }
      return prev;
    });
  }, [layerStates]);
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    if (active.id !== over.id) {
      const activeId = active.id as string;
      const overId = over.id as string;
      // Handle group reordering
      if (activeId.startsWith('group-') && overId.startsWith('group-')) {
        setGroupOrder((items: string[]) => {
          const oldIndex = items.indexOf(activeId.replace('group-', ''));
          const newIndex = items.indexOf(overId.replace('group-', ''));
          return arrayMove(items, oldIndex, newIndex);
        });
      } 
      // Handle layer reordering within groups
      else {
        setLayerOrder((items: string[]) => {
          const oldIndex = items.indexOf(activeId);
          const newIndex = items.indexOf(overId);
          return arrayMove(items, oldIndex, newIndex);
        });
        // Update layer ordering in the map
        if (view && view.map) {
          const layer = layerStates[activeId]?.layer;
          const targetLayer = layerStates[overId]?.layer;
          if (layer && targetLayer) {
            const allLayers = view.map.layers.toArray();
            const newIndex = allLayers.indexOf(targetLayer);
            view.map.reorder(layer, newIndex);
          }
        }
      }
    }
    setActiveId(null);
  };
  const resetLayers = useCallback(() => {
    Object.entries(layerStates).forEach(([, state]) => {
      if (state.layer) {
        state.layer.visible = false;
      }
    });
    setVisibleLayers([]);
    setCollapsedGroups({
      'stores': true,
      'spending': true,
      'demographics': true,
      'store-expenditure': true
    });
  }, [layerStates]);
  React.useImperativeHandle(ref, () => ({
    layerStates,
    isInitialized,
    setVisibleLayers,
    setLayerStates: (newStates: { [key: string]: LayerState }) => {
      setLayerStates(newStates);
      onLayerStatesChange?.(newStates);
    },
    resetLayers
  }), [layerStates, isInitialized, setVisibleLayers, onLayerStatesChange, resetLayers]);
  if (!visible) {
    return null;
  }
  if (!isInitialized) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Loading Layers</h3>
            <Progress 
              value={(loadingState.loaded / loadingState.total) * 100} 
              className="w-full"
            />
            <div className="text-sm text-gray-500">
              <p>{loadingState.loaded} of {loadingState.total} layers loaded</p>
              <p className="text-xs mt-1">Currently loading: {loadingState.currentLayer}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="layer-control-card">
      <CardContent className="layer-control-content">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="space-y-6">
            <SortableContext 
              items={groupOrder.map(id => `group-${id}`)}
              strategy={verticalListSortingStrategy}
            >
              {groupOrder.map(groupId => {
                const group = LAYER_GROUPS.find(g => g.id === groupId);
                if (!group) return null;
                return (
                  <DraggableGroup
                    key={`group-${group.id}`}
                    id={group.id}
                    title={group.title}
                    isCollapsed={collapsedGroups[group.id]}
                    onToggleCollapse={() => toggleGroup(group.id)}
                  >
                    <SortableContext 
                      items={layerOrder.filter(id => 
                        group.layers.some(layer => layer.id === id)
                      )}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-4 pl-6">
                        {group.layers.map((layerConfig) => (
                          <DraggableLayer
                            key={layerConfig.id}
                            id={layerConfig.id}
                            title={layerConfig.title}
                            description={layerConfig.description}
                            isVisible={visibleLayers.includes(layerConfig.id)}
                            isLoading={layerStates[layerConfig.id]?.loading}
                            layer={layerStates[layerConfig.id]?.layer}
                            onToggle={() => toggleLayer(layerConfig.id)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DraggableGroup>
                );
              })}
            </SortableContext>
          </div>
          <DragOverlay>
            {activeId && activeId.startsWith('group-') && (
              <div className="bg-white shadow-lg rounded-lg p-4 border border-gray-200 opacity-80">
                <h3 className="text-sm font-medium">
                  {LAYER_GROUPS.find(g => `group-${g.id}` === activeId)?.title}
                </h3>
              </div>
            )}
            {activeId && !activeId.startsWith('group-') && (
              <DraggableLayer
                id={activeId}
                title={LAYER_GROUPS.flatMap(g => g.layers).find(l => l.id === activeId)?.title || ''}
                description={LAYER_GROUPS.flatMap(g => g.layers).find(l => l.id === activeId)?.description || ''}
                isVisible={visibleLayers.includes(activeId)}
                layer={layerStates[activeId]?.layer}
                onToggle={() => {}}
                isDragOverlay
              />
            )}
          </DragOverlay>
        </DndContext>
      </CardContent>
    </Card>
  );
});
ApplianceLayerController.displayName = 'ApplianceLayerController';
export default ApplianceLayerController;