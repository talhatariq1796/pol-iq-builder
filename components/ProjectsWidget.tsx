import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Folder, Save, Trash2, GripVertical, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from "@arcgis/core/Graphic";
import Polygon from "@arcgis/core/geometry/Polygon";
import Color from "@arcgis/core/Color";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import { watch } from '@arcgis/core/core/reactiveUtils';
import { layers } from '@/config/layers';
import type { Project, LayerVisibilityState } from '@/types/ProjectTypes';
import type { LayerConfig } from '@/types/layers';

// Type Definitions
interface ProjectsWidgetProps {
  view: __esri.MapView;
  layer: __esri.FeatureLayer;
  sketchLayer?: __esri.GraphicsLayer;
  layerController?: {
    toggleLayer: (layerId: string, visible: boolean) => void;
  };
  onClose: () => void;
}

interface SavedGeometry {
  rings: number[][][];
  spatialReference: __esri.SpatialReference;
}

interface EsriSymbol {
  type: string;
  color?: Color | number[];
  style?: string;
  outline?: {
    style?: string;
    color?: Color | number[];
    width?: number;
  };
}

interface SavedSymbol {
  type: string;
  color: number[];
  style?: string;
  outline?: {
    type: string;
    color: number[];
    width: number;
    style: string;
  };
}

interface SavedAttributes {
  type: string;
  isSelected: boolean;
  isDrawnGraphic: boolean;
  isAnalysisGraphic: boolean;
  [key: string]: any;
}

interface SavedGraphicState {
  geometry: SavedGeometry;
  symbol: SavedSymbol;
  attributes: SavedAttributes;
}

type FillStyle = "solid" | "backward-diagonal" | "cross" | "diagonal-cross" | 
                 "forward-diagonal" | "horizontal" | "none" | "vertical";
type LineStyle = "solid" | "none" | "dash" | "dash-dot" | "dot" | "long-dash" | 
                "long-dash-dot" | "long-dash-dot-dot" | "short-dash" | 
                "short-dash-dot" | "short-dash-dot-dot" | "short-dot";

// Helper Functions
const colorToArray = (color: Color | number[] | undefined): number[] => {
  if (!color) return [0, 0, 0, 255];
  if (Array.isArray(color)) return color;
  if (color instanceof Color) {
    return [color.r, color.g, color.b, color.a * 255];
  }
  return [0, 0, 0, 255];
};

const convertFillStyle = (style: string): FillStyle => {
  const styleMap: Record<string, FillStyle> = {
    'esriSFSSolid': 'solid',
    'esriSFSBackwardDiagonal': 'backward-diagonal',
    'esriSFSCross': 'cross',
    'esriSFSDiagonalCross': 'diagonal-cross',
    'esriSFSForwardDiagonal': 'forward-diagonal',
    'esriSFSHorizontal': 'horizontal',
    'esriSFSVertical': 'vertical',
    'esriSFSNull': 'none',
    'solid': 'solid',
    'none': 'none'
  };
  return styleMap[style] || 'solid';
};

const convertLineStyle = (style: string): LineStyle => {
  const styleMap: Record<string, LineStyle> = {
    'esriSLSSolid': 'solid',
    'esriSLSDash': 'dash',
    'esriSLSDashDot': 'dash-dot',
    'esriSLSDot': 'dot',
    'esriSLSLongDash': 'long-dash',
    'esriSLSLongDashDot': 'long-dash-dot',
    'esriSLSNull': 'none',
    'solid': 'solid',
    'dash': 'dash',
    'dot': 'dot',
    'none': 'none'
  };
  return styleMap[style] || 'solid';
};

const isPolygonGeometry = (geometry: any): geometry is SavedGeometry => {
  return Array.isArray(geometry?.rings) && 
         geometry?.spatialReference !== undefined;
};

export default function ProjectsWidget({ 
  view, 
  layer, 
  sketchLayer: initialSketchLayer, 
  layerController, 
  onClose 
}: ProjectsWidgetProps) {
  // State
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [newProjectName, setNewProjectName] = useState('');
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  // Refs
  const layerControllerRef = useRef<any>(null);
  const sketchLayerRef = useRef<__esri.GraphicsLayer | null>(null);

  // Initialize refs
  useEffect(() => {
    if (!layerController && !layerControllerRef.current) {
      layerControllerRef.current = null;
    } else if (layerController) {
      layerControllerRef.current = layerController;
    }
    
    if (initialSketchLayer) {
      sketchLayerRef.current = initialSketchLayer;
    }
  }, [view, layerController, initialSketchLayer]);

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects();
  }, []);

  // Conversion Functions
  const convertGraphicToSavedState = useCallback((graphic: __esri.Graphic): SavedGraphicState => {
    const symbol = graphic.symbol as EsriSymbol;
    if (!graphic.geometry) {
      throw new Error('Graphic has no geometry');
    }
    const geometry = graphic.geometry.toJSON();

    if (!isPolygonGeometry(geometry)) {
      throw new Error('Invalid geometry type');
    }

    return {
      geometry: geometry,
      symbol: {
        type: symbol.type,
        color: colorToArray(symbol.color as (Color | number[])),
        style: symbol.style,
        outline: symbol.outline ? {
          type: 'esriSLS',
          color: colorToArray(symbol.outline.color as (Color | number[])),
          width: symbol.outline.width || 1,
          style: symbol.outline.style || 'solid'
        } : undefined
      },
      attributes: {
        type: graphic.attributes?.type || 'generic',
        isSelected: Boolean(graphic.attributes?.isSelected),
        isDrawnGraphic: Boolean(graphic.attributes?.isDrawnGraphic),
        isAnalysisGraphic: Boolean(graphic.attributes?.isAnalysisGraphic),
        ...graphic.attributes
      }
    };
  }, []);

  const createGraphicFromSaved = useCallback((graphicState: SavedGraphicState): __esri.Graphic => {
    if (!view?.spatialReference) {
      throw new Error('View or spatial reference not available');
    }

    const geometry = new Polygon({
      rings: graphicState.geometry.rings,
      spatialReference: view.spatialReference
    });

    const symbol = new SimpleFillSymbol({
      style: convertFillStyle(graphicState.symbol.style || 'solid'),
      color: [...graphicState.symbol.color.slice(0, 3), 0.3],
      outline: {
        style: convertLineStyle(graphicState.symbol.outline?.style || 'solid'),
        color: graphicState.symbol.outline?.color || [0, 0, 0],
        width: graphicState.symbol.outline?.width || 1
      }
    });

    return new Graphic({
      geometry,
      symbol,
      attributes: { 
        ...graphicState.attributes, 
        isLoadedGraphic: true,
        loadTime: Date.now()
      },
      visible: true
    });
  }, [view?.spatialReference]);

  // State Management Functions
  const fetchProjects = async () => {
    try {
      if (!supabase) {
        console.warn('Supabase not configured - project storage unavailable');
        return;
      }
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', 'demouser')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentMapState = useCallback(() => {
    return {
      center: [view.center.longitude, view.center.latitude],
      zoom: view.zoom,
      rotation: view.rotation
    };
  }, [view]);

  const getCurrentLayerState = (): LayerVisibilityState => {
    const layerState: LayerVisibilityState = {};
    
    view.map.allLayers.forEach(layer => {
      if (layer.title) {
        const configMatch = Object.values(layers).find(config => 
          config.fields.some(field => field.label === layer.title)
        );
        
        if (configMatch) {
          const field = configMatch.fields.find(f => f.label === layer.title);
          if (field) {
            const layerId = `${configMatch.id}-${field.name}`;
            layerState[layerId] = layer.visible ? 'visible' : 'hidden';
          }
        } else {
          const layerId = `base-${layer.title.toLowerCase().replace(/\s+/g, '_')}`;
          layerState[layerId] = layer.visible ? 'visible' : 'hidden';
        }
      }
    });

    return layerState;
  };

  const getCurrentGraphics = useCallback(() => {
    if (!view) return [];

    const allGraphics: __esri.Graphic[] = [];
    
    const graphicsLayers = view.map.layers.toArray()
      .filter((layer): layer is __esri.GraphicsLayer => 
        layer.type === 'graphics' &&
        'graphics' in layer &&
        layer.title !== "Selection Preview"
      );

    graphicsLayers.forEach(layer => {
      const layerGraphics = layer.graphics.toArray().filter(graphic => {
        const isUtilityGraphic = graphic.attributes?.isCursor || 
                                graphic.attributes?.isPreview ||
                                graphic.attributes?.isHandle ||
                                graphic.attributes?.isTooltip ||
                                graphic.attributes?.isMeasurement ||
                                graphic.attributes?.isVertex;

        return !isUtilityGraphic && graphic.geometry && isPolygonGeometry(graphic.geometry.toJSON());
      });

      allGraphics.push(...layerGraphics);
    });

    if (sketchLayerRef.current) {
      const sketchGraphics = sketchLayerRef.current.graphics.toArray().filter(graphic => {
        const isUtilityGraphic = graphic.attributes?.isCursor ||
                                graphic.attributes?.isPreview ||
                                graphic.attributes?.isHandle ||
                                graphic.attributes?.isVertex;

        return !isUtilityGraphic && graphic.geometry && isPolygonGeometry(graphic.geometry.toJSON());
      });

      allGraphics.push(...sketchGraphics);
    }

    return allGraphics.map(graphic => {
      try {
        return convertGraphicToSavedState(graphic);
      } catch (error) {
        console.error('Error converting graphic:', error);
        return null;
      }
    }).filter((state): state is SavedGraphicState => state !== null);
  }, [view, convertGraphicToSavedState]);

  const loadProject = async (project: Project) => {
    try {
      await view.goTo({
        center: project.map_state.center,
        zoom: project.map_state.zoom,
        rotation: project.map_state.rotation
      });

      if (!sketchLayerRef.current) {
        sketchLayerRef.current = new GraphicsLayer({
          title: "Sketch Layer",
          visible: true,
          opacity: 1,
          listMode: "show"
        });
      }

      const sketchLayer = sketchLayerRef.current;
      if (!sketchLayer) {
        console.error('Failed to initialize sketch layer');
        return;
      }

      // Remove all existing layers EXCEPT the sketch layer and base layers
      const layersToRemove = view.map.layers.filter(layer => 
        layer !== sketchLayer && 
        !layer.title?.toLowerCase().includes('base')
      );
      layersToRemove.forEach(layer => view.map.remove(layer));

      // Make sure sketchLayer is in the map and on top
      if (!view.map.layers.includes(sketchLayer)) {
        view.map.add(sketchLayer);
      }

      view.map.reorder(sketchLayer, view.map.layers.length - 1);

      sketchLayer.visible = true;
      sketchLayer.opacity = 1;

      if (project.layer_state) {
        await view.when();
        
        for (const layerId in project.layer_state) {
          const [configId, fieldValue] = layerId.split('-');
          if (configId === 'base') continue;
          const shouldBeVisible = project.layer_state[layerId] === 'visible';
          if (layerControllerRef.current) {
            layerControllerRef.current.toggleLayer(layerId, shouldBeVisible);
          }
        }
      }

      sketchLayer.graphics.removeAll();

      if (project.graphics?.length) {
        for (const rawGraphicState of project.graphics) {
          try {
            const graphicState = rawGraphicState as unknown as SavedGraphicState;
            const graphic = createGraphicFromSaved(graphicState);
            
            sketchLayer.graphics.add(graphic);
            
            const graphicId = `graphic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            Object.defineProperty(graphic, 'id', {
              value: graphicId,
              writable: false
            });

            watch(
              () => graphic.visible,
              (visible: boolean) => {
                if (!visible) {
                  graphic.visible = true;
                }
              }
            );
          } catch (error) {
            console.error('Error reconstructing graphic:', error);
          }
        }

        if (sketchLayer.graphics.length > 0) {
          const graphicsArray = sketchLayer.graphics.toArray();
          const extent = graphicsArray.reduce((ext: __esri.Extent | null, g: __esri.Graphic) => {
            if (!g.geometry) return ext;
            const graphicExtent = g.geometry.extent;
            if (!graphicExtent) return ext;
            return ext ? ext.union(graphicExtent) : graphicExtent;
          }, null);

          if (extent) {
            await view.goTo(extent.expand(1.2));
          }
        }
      }

    } catch (error) {
      console.error('Error loading project:', error);
    }
  };

  const saveProject = async (name: string) => {
    try {
      const projectData = {
        name,
        map_state: getCurrentMapState(),
        layer_state: getCurrentLayerState(),
        graphics: getCurrentGraphics(),
        user_id: 'demouser'
      };

      if (!supabase) {
        console.warn('Supabase not configured - cannot save project');
        return;
      }
      const { data, error } = await supabase
        .from('projects')
        .insert([projectData])
        .select()
        .single();

      if (error) throw error;
      
      setProjects((prev: any) => [data, ...prev]);
      setShowNewProjectDialog(false);
      setNewProjectName('');
    } catch (error) {
      console.error('Error saving project:', error);
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
      if (!supabase) {
        console.warn('Supabase not configured - cannot delete project');
        return;
      }
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;
      setProjects((prev: any) => prev.filter((p: any) => p.id !== projectId));
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  const toggleProjectExpand = (projectId: string) => {
    setExpandedProjectId((current: any) => current === projectId ? null : projectId);
  };

  return (
    <div className="p-4">
      <div className="space-y-2">
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setShowNewProjectDialog(true)}
            className="flex items-center px-3 py-2 text-white rounded-md"
            style={{ backgroundColor: '#a83269' }}
          >
            <Save className="w-4 h-4 mr-2" />
            Save
          </button>
        </div>

        {showNewProjectDialog && (
          <div className="group relative rounded-lg bg-white shadow-sm border mb-4">
            <div className="p-4">
              <input
                type="text"
                value={newProjectName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewProjectName(e.target.value)}
                placeholder="Project name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#a83269] focus:border-transparent mb-3"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowNewProjectDialog(false)}
                  className="px-3 py-2 text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => saveProject(newProjectName)}
                  className="px-3 py-2 text-white rounded-md"
                  style={{ backgroundColor: '#a83269' }}
                  disabled={!newProjectName.trim()}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-4 text-gray-600">Loading...</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-4 text-gray-600">No saved projects</div>
        ) : (
          projects.map(project => (
            <div
              key={project.id}
              className="group relative rounded-lg bg-white shadow-sm border"
            >
              <div className="flex items-center justify-between px-4 py-2">
                <div className="flex items-center cursor-grab active:cursor-grabbing">
                  <GripVertical className="w-4 h-4 text-gray-400 mr-2 group-hover:text-gray-500" />
                  <span className="font-medium">{project.name}</span>
                </div>
                <div className="flex items-center">
                  <button
                    onClick={() => loadProject(project)}
                    className="px-2 py-1 text-sm text-[#a83269] hover:bg-gray-50 rounded-md"
                  >
                    Open
                  </button>
                  <button
                    onClick={() => deleteProject(project.id)}
                    className="p-1 hover:bg-gray-50 rounded-full ml-1"
                  >
                    <Trash2 className="w-5 h-5 text-gray-500" />
                  </button>
                  <button 
                    className="p-1 hover:bg-gray-50 rounded-full"
                    onClick={() => toggleProjectExpand(project.id)}
                  >
                    <ChevronDown 
                      className={`w-5 h-5 text-gray-500 transition-transform ${
                        expandedProjectId === project.id ? 'transform rotate-180' : ''
                      }`}
                    />
                  </button>
                </div>
              </div>
              {expandedProjectId === project.id && (
                <div className="px-4 py-2 border-t border-gray-100">
                  <div className="text-sm text-gray-600">
                    <div>Created: {new Date(project.created_at).toLocaleDateString()}</div>
                    <div>Last modified: {new Date(project.updated_at).toLocaleDateString()}</div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}