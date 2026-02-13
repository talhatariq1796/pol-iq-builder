/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Pencil, ChevronRight, X } from 'lucide-react';
import * as geometryEngine from "@arcgis/core/geometry/geometryEngine";
import Graphic from "@arcgis/core/Graphic";
import * as projection from "@arcgis/core/geometry/projection";
import SpatialReference from "@arcgis/core/geometry/SpatialReference";
import Point from "@arcgis/core/geometry/Point";
import Polygon from "@arcgis/core/geometry/Polygon";
import Draw from "@arcgis/core/views/draw/Draw";
import Color from "@arcgis/core/Color";
import FeatureFilter from "@arcgis/core/layers/support/FeatureFilter";
import FeatureEffect from "@arcgis/core/layers/support/FeatureEffect";
import { SimpleMarkerSymbol, SimpleLineSymbol, SimpleFillSymbol } from "@arcgis/core/symbols";
import Popup from "@arcgis/core/widgets/Popup";

// Constants for drawing
const SNAP_TOLERANCE = 20; // pixels
const VERTICES_SYMBOL = {
  type: "simple-marker",
  style: "circle",
  color: [255, 0, 0],
  size: "8px"
} as __esri.SimpleMarkerSymbolProperties;

const LINE_SYMBOL = {
  type: "simple-line",
  color: [255, 0, 0],
  width: 2,
  style: "solid"
} as __esri.SimpleLineSymbolProperties;

const TEMP_LINE_SYMBOL = {
  type: "simple-line",
  color: [255, 0, 0],
  width: 2,
  style: "dash"
} as __esri.SimpleLineSymbolProperties;

interface AnalysisWidgetProps {
  view?: __esri.MapView | null;
  onClose: () => void;
  onGeometryCreated: (geometry: __esri.Geometry) => void;
  reportTemplates?: string[];
}

const AnalysisWidget: React.FC<AnalysisWidgetProps> = ({ 
  view, 
  onClose, 
  onGeometryCreated,
  reportTemplates = ["NBH", "Custom1", "Custom2"]
}) => {
  const [activeTab, setActiveTab] = useState('1');
  const [drawMode, setDrawMode] = useState<'point' | 'polygon' | null>(null);
  const [bufferType, setBufferType] = useState<'radius' | 'drivetime'>('radius');
  const [bufferValue, setBufferValue] = useState('1');
  const [bufferUnit, setBufferUnit] = useState<'kilometers' | 'minutes'>('kilometers');
  const [selectedTemplate, setSelectedTemplate] = useState(reportTemplates[0]);
  const [geometry, setGeometry] = useState<__esri.Geometry | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const drawRef = useRef<__esri.Draw | null>(null);
  const cursorGraphicRef = useRef<__esri.Graphic | null>(null);
  const clickHandlerRef = useRef<IHandle | null>(null);
  const pointerMoveHandlerRef = useRef<IHandle | null>(null);
  const drawActionRef = useRef<__esri.PolygonDrawAction | null>(null);

  const disableMapInteractions = useCallback(() => {
    if (!view) return;
    
    // Disable popup
    if (view.popup) {
      if (typeof view.popup.close === 'function') {
        view.popup.close();
      } else {
        view.popup.visible = false;
      }
    }
    
    // Disable highlighting
    view.highlightOptions = {
      color: new Color([0, 0, 0, 0]),
      haloOpacity: 0
    };
  
    // Disable feature layer interactions
    view.layerViews.forEach((layerView) => {
      if ((layerView as any).layer.type === "feature") {
        const featureLayerView = layerView as __esri.FeatureLayerView;
        
        const filter = new FeatureFilter({
          where: "1=0"
        });
  
        const effect = new FeatureEffect({
          filter: filter,
          excludedEffect: "opacity(30%)",
          includedEffect: "opacity(100%)"
        });
  
        featureLayerView.featureEffect = effect;
      }
    });
  }, [view]);
  
  const enableMapInteractions = useCallback(() => {
    if (!view) return;
    
    // Restore highlight options
    view.highlightOptions = {
      color: new Color([0, 0, 0, 0.25]),
      haloOpacity: 0.75
    };
  
    // Re-enable feature layer interactions
    view.layerViews.forEach((layerView) => {
      if ((layerView as any).layer.type === "feature") {
        const featureLayerView = layerView as __esri.FeatureLayerView;
        
        const filter = new FeatureFilter({
          where: "1=1"
        });
  
        const effect = new FeatureEffect({
          filter: filter,
          excludedEffect: "opacity(100%)",
          includedEffect: "opacity(100%)"
        });
  
        featureLayerView.featureEffect = effect;
      }
    });
  }, [view]);

  const zoomToGeometry = useCallback((geometry: __esri.Geometry) => {
    if (!view || !geometry) return;

    const extent = geometry.extent;
    if (extent) {
      view.goTo({
        target: extent.expand(1.5),
        duration: 1000,
        easing: "ease-out"
      });
    }
  }, [view]);

  const handleGeometryCreated = useCallback((geometry: __esri.Geometry) => {
    if (!geometry) return;
    
    // Cast geometry to the appropriate type based on its type
    let geometryUnion: __esri.GeometryUnion;
    switch (geometry.type) {
      case "point":
        geometryUnion = geometry as __esri.Point;
        break;
      case "polygon":
        geometryUnion = geometry as __esri.Polygon;
        break;
      case "polyline":
        geometryUnion = geometry as __esri.Polyline;
        break;
      case "extent":
        geometryUnion = geometry as __esri.Extent;
        break;
      case "multipoint":
        geometryUnion = geometry as __esri.Multipoint;
        break;
      default:
        console.warn("Unsupported geometry type:", geometry.type);
        return;
    }
    
    setGeometry(geometryUnion as __esri.GeometryUnion);
    onGeometryCreated?.(geometryUnion as __esri.GeometryUnion);
  }, [onGeometryCreated]);

  const cleanupDrawing = useCallback(() => {
    if (clickHandlerRef.current) {
      clickHandlerRef.current.remove();
      clickHandlerRef.current = null;
    }
    if (pointerMoveHandlerRef.current) {
      pointerMoveHandlerRef.current.remove();
      pointerMoveHandlerRef.current = null;
    }
    if (cursorGraphicRef.current && view?.graphics) {
      view.graphics.remove(cursorGraphicRef.current);
      cursorGraphicRef.current = null;
    }
    if (drawActionRef.current) {
      drawActionRef.current.complete();
      drawActionRef.current = null;
    }
    if (view?.container) {
      view.container.style.cursor = 'default';
    }
    enableMapInteractions();
    setIsDrawing(false);
    setDrawMode(null);
  }, [view, enableMapInteractions]);

  useEffect(() => {
    if (view && !drawRef.current) {
      drawRef.current = new Draw({
        view: view
      });
    }

    return () => {
      cleanupDrawing();
      if (view?.graphics) {
        view.graphics.removeAll();
      }
    };
  }, [view, cleanupDrawing]);

  const handleDrawButtonClick = useCallback((mode: 'point' | 'polygon') => {
    if (!view) {
      console.warn('View is null in handleDrawButtonClick');
      return;
    }

    let isFinishingDrawing = false;

    cleanupDrawing();
    view.graphics.removeAll();
    disableMapInteractions();
    
    setDrawMode(mode);
    setIsDrawing(true);

    if (mode === 'point') {
      if (view.container) {
        view.container.style.cursor = 'crosshair';
      }

      // Create cursor graphic for visual feedback
      cursorGraphicRef.current = new Graphic({
        geometry: view.center,
        symbol: new SimpleMarkerSymbol({
          style: "circle",
          color: [255, 0, 0, 0.5],
          size: "12px",
          outline: {
            color: [255, 0, 0],
            width: 2
          }
        })
      });
      view.graphics.add(cursorGraphicRef.current);

      // Update cursor graphic on mouse move
      pointerMoveHandlerRef.current = view.on('pointer-move', (event) => {
        const mapPoint = view.toMap(event);
        if (mapPoint && cursorGraphicRef.current) {
          cursorGraphicRef.current.geometry = mapPoint;
        }
      });

      // Handle click to place point
      clickHandlerRef.current = view.on('click', (event) => {
        const mapPoint = event.mapPoint;
        
        const pointGraphic = new Graphic({
          geometry: mapPoint,
          symbol: new SimpleMarkerSymbol({
            style: "circle",
            color: [255, 0, 0],
            size: "12px",
            outline: {
              color: [255, 0, 0],
              width: 2
            }
          })
        });

        requestAnimationFrame(() => {
          view.graphics.removeAll();
          view.graphics.add(pointGraphic);
          setGeometry(mapPoint);
          setActiveTab('2');
          
          setTimeout(() => {
            zoomToGeometry(mapPoint);
          }, 100);
        });

        cleanupDrawing();
      });
    } else if (mode === 'polygon') {
      if (view.container) {
        view.container.style.cursor = 'crosshair';
      }

      const draw = drawRef.current;
      if (!draw) {
        console.warn('Draw instance is null');
        return;
      }

      const action = draw.create("polygon", { 
        mode: "click"
      });

      drawActionRef.current = action as __esri.PolygonDrawAction;

      const vertices: number[][] = [];
      const verticesGraphics: __esri.Graphic[] = [];
      
      const linesGraphic = new Graphic({
        symbol: new SimpleLineSymbol({
          color: [255, 0, 0],
          width: 2
        })
      });
      
      const tempLineGraphic = new Graphic({
        symbol: new SimpleLineSymbol({
          color: [255, 0, 0, 0.5],
          width: 2,
          style: "dash"
        })
      });

      view.graphics.addMany([linesGraphic, tempLineGraphic]);

      const isNearStart = (point: number[] | any): boolean => {
        if (!Array.isArray(point) || point.length < 2 || vertices.length < 3) {
          return false;
        }

        try {
          const startVertex = new Point({
            x: vertices[0][0],
            y: vertices[0][1],
            spatialReference: view.spatialReference
          });
          const startScreen = view.toScreen(startVertex);
          if (!startScreen) return false;

          const currentVertex = new Point({
            x: point[0],
            y: point[1],
            spatialReference: view.spatialReference
          });
          const currentScreen = view.toScreen(currentVertex);
          if (!currentScreen) return false;

          const distance = Math.sqrt(
            Math.pow(startScreen.x - currentScreen.x, 2) + 
            Math.pow(startScreen.y - currentScreen.y, 2)
          );
          
          return distance <= SNAP_TOLERANCE;
        } catch (error) {
          console.error('Error in isNearStart:', error);
          return false;
        }
      };

      const updateLines = () => {
        if (vertices.length >= 2) {
          linesGraphic.geometry = {
            type: "polyline",
            paths: [vertices],
            spatialReference: view.spatialReference
          } as __esri.Polyline;
        }
      };

      const finishDrawing = () => {
        if (isFinishingDrawing || vertices.length < 3) return;
        isFinishingDrawing = true;

        try {
          const polygon = new Polygon({
            rings: [vertices],
            spatialReference: view.spatialReference
          });

          const finalGraphic = new Graphic({
            geometry: polygon,
            symbol: new SimpleFillSymbol({
              color: [255, 0, 0, 0.2],
              outline: {
                color: [255, 0, 0],
                width: 2
              }
            })
          });

          view.graphics.removeAll();
          view.graphics.add(finalGraphic);
          setGeometry(polygon);
          setActiveTab('3');
          
          setTimeout(() => {
            zoomToGeometry(polygon);
          }, 100);

          if (drawActionRef.current) {
            drawActionRef.current.complete();
            drawActionRef.current = null;
          }
        } catch (error) {
          console.error('Error finishing drawing:', error);
        } finally {
          isFinishingDrawing = false;
          cleanupDrawing();
        }
      };

      action.on("vertex-add", (event: any) => {
        if (!event?.vertices?.length) return;

        const point = event.vertices[event.vertices.length - 1];
        if (!Array.isArray(point) || point.length < 2) return;
        
        if (vertices.length >= 2 && isNearStart(point)) {
          vertices.push(vertices[0]);
          finishDrawing();
          return;
        }

        vertices.push(point);

        const vertexGraphic = new Graphic({
          geometry: new Point({
            x: point[0],
            y: point[1],
            spatialReference: view.spatialReference
          }),
          symbol: new SimpleMarkerSymbol({
            style: "circle",
            color: [255, 0, 0],
            size: "8px"
          })
        });

        verticesGraphics.push(vertexGraphic);
        view.graphics.add(vertexGraphic);

        updateLines();
      });

      action.on("cursor-update", (event: any) => {
        if (!event || !Array.isArray(event.coordinates) || event.coordinates.length < 2) {
          return;
        }

        if (vertices.length >= 1) {
          tempLineGraphic.geometry = {
            type: "polyline",
            paths: [[
              vertices[vertices.length - 1],
              event.coordinates
            ]],
            spatialReference: view.spatialReference
          } as __esri.Polyline;

          if (vertices.length >= 2 && isNearStart(event.coordinates)) {
            tempLineGraphic.geometry = {
              type: "polyline",
              paths: [[
                vertices[vertices.length - 1],
                vertices[0]
              ]],
              spatialReference: view.spatialReference
            } as __esri.Polyline;
          }
        }
      });

      action.on("draw-complete", finishDrawing);
    }
  }, [view, cleanupDrawing, disableMapInteractions, zoomToGeometry]);

  const createBuffer = useCallback(async () => {
    if (!geometry || !view) return;

    if (bufferType === 'radius') {
      const bufferGeometry = geometryEngine.buffer(
        geometry as __esri.GeometryUnion,
        Number(bufferValue) * 1000, // Always use kilometers
        'meters'
      ) as __esri.Polygon;

      const bufferGraphic = new Graphic({
        geometry: bufferGeometry,
        symbol: new SimpleFillSymbol({
          color: [255, 0, 0, 0.2],
          outline: {
            color: [255, 0, 0],
            width: 2
          }
        })
      });

      if (geometry.type === "point") {
        const pointGraphic = new Graphic({
          geometry: geometry,
          symbol: new SimpleMarkerSymbol({
            style: "circle",
            color: [255, 0, 0],
            size: "12px",
            outline: {
              color: [255, 0, 0],
              width: 2
            }
          })
        });

        requestAnimationFrame(() => {
          view.graphics.removeAll();
          view.graphics.addMany([bufferGraphic, pointGraphic]);
          setGeometry(bufferGeometry);
          setActiveTab('3');
          
          setTimeout(() => {
            zoomToGeometry(bufferGeometry);
          }, 100);
        });
      } else {
        requestAnimationFrame(() => {
          view.graphics.removeAll();
          view.graphics.add(bufferGraphic);
          setGeometry(bufferGeometry);
          setActiveTab('3');
          
          setTimeout(() => {
            zoomToGeometry(bufferGeometry);
          }, 100);
        });
      }
    }
  }, [geometry, bufferType, bufferValue, bufferUnit, view, zoomToGeometry]);

  const generateReport = useCallback(async () => {
    if (!geometry) return;

    try {
      let finalGeometry = geometry;
      
      if (geometry.spatialReference.wkid !== 4326) {
        await projection.load();
        const wgs84SR = new SpatialReference({ wkid: 4326 });
        finalGeometry = projection.project(geometry as __esri.GeometryUnion, wgs84SR) as __esri.Geometry;
      }

      onGeometryCreated(finalGeometry);
    } catch (error) {
      console.error('Error processing geometry:', error);
    }
  }, [geometry, onGeometryCreated]);

  const handleClose = useCallback(() => {
    cleanupDrawing();
    enableMapInteractions();
    onClose();
  }, [cleanupDrawing, enableMapInteractions, onClose]);

  return (
    <Card className="analysis-widget w-96 shadow-lg">
      <CardHeader className="relative">
        <CardTitle>Analysis</CardTitle>
        <button 
          className="widget-close-button" 
          onClick={handleClose}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="1" className="text-xs">Draw</TabsTrigger>
            <TabsTrigger value="2" disabled={!geometry || drawMode === 'polygon'} className="text-xs">
              Buffer
            </TabsTrigger>
            <TabsTrigger value="3" disabled={!geometry} className="text-xs">
              Report
            </TabsTrigger>
          </TabsList>

          <TabsContent value="1">
            <div className="space-y-4">
              <Button 
                className="w-full"
                variant={drawMode === 'point' ? 'default' : 'outline'}
                onClick={() => handleDrawButtonClick('point')}
                disabled={isDrawing}
              >
                <MapPin className="mr-2 h-4 w-4" />
                Drop Point
              </Button>
              <Button 
                className="w-full"
                variant={drawMode === 'polygon' ? 'default' : 'outline'}
                onClick={() => handleDrawButtonClick('polygon')}
                disabled={isDrawing}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Draw Polygon
              </Button>
              {isDrawing && drawMode === 'polygon' && (
                <div className="text-sm text-center text-gray-500">
                  Click to add vertices. Double-click to complete.
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="2">
            <div className="space-y-4">
              <RadioGroup value={bufferType} onValueChange={(value: 'radius' | 'drivetime') => setBufferType(value)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="radius" id="radius" />
                  <Label htmlFor="radius">Radius</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="drivetime" id="drivetime" />
                  <Label htmlFor="drivetime">Drive Time</Label>
                </div>
              </RadioGroup>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Distance</Label>
                  <Input 
                    type="number" 
                    value={bufferValue}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBufferValue(e.target.value)}
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Select value={bufferUnit} onValueChange={(value: 'kilometers' | 'minutes') => setBufferUnit(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {bufferType === 'radius' ? (
                        <>
                          <SelectItem value="kilometers">Kilometers</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="minutes">Minutes</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button className="w-full" onClick={createBuffer}>
                Create Buffer
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="3">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Dynamic Infographics</Label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {reportTemplates.map((template) => (
                      <SelectItem key={template} value={template}>
                        {template}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={generateReport}>
                Generate Report
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default AnalysisWidget;