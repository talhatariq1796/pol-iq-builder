/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent
} from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RotateCcw, AlertCircle, MousePointer, Target, Hexagon, Car, UserIcon, MapPin, ChevronRight } from 'lucide-react';
import { useDrawing } from '@/hooks/useDrawing';
import ReportDialog from '@/components/ReportDialog';
import Circle from "@arcgis/core/geometry/Circle";
import Graphic from "@arcgis/core/Graphic";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import * as serviceArea from "@arcgis/core/rest/serviceArea";
import ServiceAreaParameters from "@arcgis/core/rest/support/ServiceAreaParameters";
import FeatureSet from "@arcgis/core/rest/support/FeatureSet";

import esriConfig from "@arcgis/core/config";
esriConfig.apiKey = process.env.NEXT_PUBLIC_ARCGIS_API_KEY || '';

type DrawMode = 'point' | 'polygon' | 'click';
type Step = 'draw' | 'buffer' | 'report';

interface ReportsTabProps {
  view: __esri.MapView;
  layerStates: { [key: string]: { layer: __esri.FeatureLayer | null } };
}

interface AlertCardProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'point' | 'polygon' | 'click';
}

const DRAWING_CONFIG: Record<DrawMode, {
  icon: React.FC<any>;
  label: string;
  tooltip: string;
  className: string;
  activeClassName: string;
}> = {
  point: {
    icon: Target,
    label: 'Point',
    tooltip: 'Drop Point on Map',
    className: 'hover:bg-gray-50 hover:text-blue-600',
    activeClassName: 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm'
  },
  polygon: {
    icon: Hexagon,
    label: 'Polygon',
    tooltip: 'Draw Polygon on Map',
    className: 'hover:bg-gray-50 hover:text-green-600',
    activeClassName: 'bg-green-50 text-green-600 border-green-200 shadow-sm'
  },
  click: {
    icon: MousePointer,
    label: 'Select',
    tooltip: 'Select Existing Feature',
    className: 'hover:bg-gray-50 hover:text-purple-600',
    activeClassName: 'bg-purple-50 text-purple-600 border-purple-200 shadow-sm'
  }
};

const AlertCard: React.FC<AlertCardProps> = ({ children, variant = "default" }) => {
  const variants = {
    default: "bg-muted border-border",
    success: "bg-green-50 border-green-200 text-green-700",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-700",
    error: "bg-red-50 border-red-200 text-red-700",
    point: "bg-blue-50 text-blue-700 border-blue-200",
    polygon: "bg-green-50 text-green-700 border-green-200",
    click: "bg-purple-50 text-purple-700 border-purple-200",
  } as const;

  return (
    <div className={`p-4 rounded-lg border ${variants[variant]}`}>
      {children}
    </div>
  );
};

const DrawingTools: React.FC<{
  drawMode: DrawMode | null;
  handleDrawButtonClick: (mode: DrawMode) => void;
  isDrawing: boolean;
  isSelectionMode: boolean;
  onSelectionComplete: () => void;
  hasSelectedFeature: boolean;
  shouldShowNext: boolean;
  selectedCount: number;
}> = ({
  drawMode,
  handleDrawButtonClick,
  isDrawing,
  isSelectionMode,
  onSelectionComplete,
  hasSelectedFeature,
  shouldShowNext,
  selectedCount
}) => (
  <div className="space-y-4">
    <div className="grid grid-cols-3 gap-4">
      {Object.entries(DRAWING_CONFIG).map(([mode, config]) => (
        <Button
          key={mode}
          variant="outline"
          onClick={() => handleDrawButtonClick(mode as DrawMode)}
          className={`
            flex flex-col items-center justify-center gap-2 h-24
            transition-colors duration-200
            ${drawMode === mode ? config.activeClassName : config.className}
          `}
          disabled={isDrawing && drawMode !== mode}
        >
          <config.icon className={`h-6 w-6 ${drawMode === mode ? 'text-current' : ''}`} />
          <span className="text-sm font-medium">{config.label}</span>
        </Button>
      ))}
    </div>

    {isSelectionMode && hasSelectedFeature && (
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">
          {selectedCount} feature{selectedCount !== 1 ? 's' : ''} selected
        </p>
        {shouldShowNext && (
          <Button onClick={onSelectionComplete} size="sm">
            Continue
          </Button>
        )}
      </div>
    )}
  </div>
);

const BufferTools = ({ 
  bufferType, 
  handleBufferTypeChange 
}: { 
  bufferType: string;
  handleBufferTypeChange: (type: string) => void;
}) => {
  const tools = [
    {
      type: 'radius',
      icon: MapPin,
      label: 'Radius',
      activeColor: 'text-blue-600',
      hoverColor: 'hover:text-blue-600',
      activeBg: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      type: 'drivetime',
      icon: Car,
      label: 'Drive Time',
      activeColor: 'text-green-600',
      hoverColor: 'hover:text-green-600',
      activeBg: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    {
      type: 'walktime',
      icon: UserIcon,
      label: 'Walk Time',
      activeColor: 'text-purple-600',
      hoverColor: 'hover:text-purple-600',
      activeBg: 'bg-purple-50',
      borderColor: 'border-purple-200'
    }
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {tools.map(tool => (
        <Button
          key={tool.type}
          variant="outline"
          onClick={() => handleBufferTypeChange(tool.type)}
          className={`
            flex flex-col items-center justify-center gap-2 h-24
            transition-colors duration-200
            ${bufferType === tool.type 
              ? `${tool.activeBg} ${tool.activeColor} border ${tool.borderColor} shadow-sm` 
              : `hover:bg-gray-50 ${tool.hoverColor}`}
          `}
        >
          <tool.icon className={`h-6 w-6 ${bufferType === tool.type ? tool.activeColor : ''}`} />
          <span className="text-sm font-medium">{tool.label}</span>
        </Button>
      ))}
    </div>
  );
};

export default function ReportsTab({ view, layerStates }: ReportsTabProps) {
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [geometry, setGeometry] = useState<__esri.Geometry | null>(null);
  const [activeStep, setActiveStep] = useState<Step>('draw');
  const [drawMode, setDrawMode] = useState<DrawMode | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [bufferType, setBufferType] = useState('radius');
  const [bufferValue, setBufferValue] = useState('1');
  const [bufferUnit, setBufferUnit] = useState('kilometers');

  const drawing = useDrawing({
    view,
    setDrawMode,
    setIsDrawing,
    setTargetGeometry: (value: __esri.Geometry | null | ((prev: __esri.Geometry | null) => __esri.Geometry | null)) => {
      if (typeof value !== 'function' && value) {
        setGeometry(value);
        setHasSelection(true);
      }
    },
    onGeometryCreated: useCallback((geom: __esri.Geometry) => {
      setGeometry(geom);
      setHasSelection(true);
      
      if (drawMode !== 'click') {
        cancelDrawing();
        setDrawMode(null);
        if (geom.type === 'point') {
          setActiveStep('buffer');
        } else {
          setActiveStep('report');
        }
      }
    }, [drawMode]),
    onDrawingStarted: useCallback(() => {
      setIsDrawing(true);
      setError(null);
      setHasSelection(false);
      view?.graphics.removeAll();
    }, [view]),
    onDrawingCanceled: useCallback(() => {
      setIsDrawing(false);
      setDrawMode(null);
      setError(null);
      setHasSelection(false);
    }, []),
    onValidationError: useCallback((error: string) => {
      setError(error);
    }, [])
  });

  const cancelDrawing = useCallback(() => {
    if (drawMode !== 'click') {
      setDrawMode(null);
      setIsSelectionMode(false);
    }
    setIsDrawing(false);
    drawing.cancelDrawing();
  }, [drawMode, drawing]);

  const handleDrawButtonClick = useCallback((mode: DrawMode) => {
    setDrawMode(mode);
    setIsSelectionMode(mode === 'click');
    setGeometry(null);
    setError(null);
    setHasSelection(false);
    view?.graphics.removeAll();
    
    cancelDrawing();
    drawing.startDrawing(mode);
  }, [drawing, view, cancelDrawing]);

  const handleBufferTypeChange = useCallback((type: string) => {
    setBufferType(type);
    setBufferUnit(type === 'radius' ? 'miles' : 'minutes');
    setBufferValue('1');
  }, []);

  const createAndAddBuffer = useCallback((bufferGeometry: __esri.Geometry, color: number[]) => {
    if (!view) return;

    const bufferGraphic = new Graphic({
      geometry: bufferGeometry,
      symbol: new SimpleFillSymbol({
        color: [...color, 0.2],
        outline: { color, width: 2 }
      })
    });

    view.graphics.add(bufferGraphic);
    if (bufferGeometry.extent) {
      view.goTo(bufferGeometry.extent.expand(1.2));
    }
    setGeometry(bufferGeometry);
    setActiveStep('report');
  }, [view]);

  const handleCreateBuffer = useCallback(async () => {
    if (!geometry || geometry.type !== 'point' || !view) return;

    const getBufferColor = () => {
      switch (bufferType) {
        case 'radius': return [37, 99, 235];
        case 'drivetime': return [249, 115, 22];
        case 'walktime': return [147, 51, 234];
        default: return [37, 99, 235];
      }
    };

    const color = getBufferColor();
    let timeInMinutes = parseFloat(bufferValue);

    if (bufferType === 'radius') {
      let radiusInMeters = parseFloat(bufferValue);
      if (bufferUnit === 'kilometers') {
        radiusInMeters *= 1000;
      }

      const bufferGeometry = new Circle({
        center: geometry as __esri.Point,
        radius: radiusInMeters,
        radiusUnit: "meters",
        spatialReference: view.spatialReference
      });

      createAndAddBuffer(bufferGeometry, color);
      return;
    }

    try {
      if (bufferUnit === 'kilometers') {
        const speedInKmh = bufferType === 'drivetime' ? 50 : 5;
        const distanceInKm = parseFloat(bufferValue);
        timeInMinutes = (distanceInKm / speedInKmh) * 60;
      }

      const params = new ServiceAreaParameters({
        facilities: new FeatureSet({
          features: [{
            geometry: geometry,
            attributes: { Name: "Location", TravelTime: timeInMinutes }
          }]
        }),
        defaultBreaks: [timeInMinutes],
        travelDirection: "from-facility",
        outputGeometryPrecision: 1,
        trimOuterPolygon: true,
        outSpatialReference: view.spatialReference,
        travelMode: {
          attributeParameterValues: [],
          description: "Results are calculated using the street network",
          impedanceAttributeName: "TravelTime",
          name: bufferType === "drivetime" ? "Driving Time" : "Walking Time",
          type: bufferType === "drivetime" ? "automobile" : "walk",
          useHierarchy: true,
          restrictionAttributeNames: [],
          simplificationTolerance: 2,
          timeAttributeName: "TravelTime"
        }
      });

      const result = await serviceArea.solve(
        "https://route-api.arcgis.com/arcgis/rest/services/World/ServiceAreas/NAServer/ServiceArea_World/solveServiceArea",
        params
      );

      if (result.serviceAreaPolygons?.features && result.serviceAreaPolygons.features.length > 0) {
        const geometry = result.serviceAreaPolygons.features[0].geometry;
        if (geometry) {
          createAndAddBuffer(geometry, color);
        }
      }
    } catch (error) {
      console.error('Error creating service area:', error);
      const estimatedRadius = bufferType === 'drivetime' 
        ? timeInMinutes * 800 
        : timeInMinutes * 80;

      const bufferGeometry = new Circle({
        center: geometry as __esri.Point,
        radius: estimatedRadius,
        radiusUnit: "meters",
        spatialReference: view.spatialReference
      });

      createAndAddBuffer(bufferGeometry, color);
    }
  }, [geometry, bufferType, bufferValue, bufferUnit, view, createAndAddBuffer]);

  const handleSelectionComplete = useCallback(() => {
    if (!drawing.targetGeometry) return;
    
    setGeometry(drawing.targetGeometry);
    setActiveStep('report');
    setHasSelection(true);
  }, [drawing]);

  const handleReset = useCallback(() => {
    setActiveStep('draw');
    setDrawMode(null);
    setIsDrawing(false);
    setGeometry(null);
    setError(null);
    setIsSelectionMode(false);
    setHasSelection(false);
    
    if (drawing) {
      drawing.cancelDrawing();
      setTimeout(() => {
        if (view) {
          view.graphics.removeAll();
        }
        const graphicsLayer = drawing.getGraphicsLayer?.();
        if (graphicsLayer) {
          graphicsLayer.removeAll();
        }
      }, 0);
    }
  }, [drawing, view]);

  const getInstructionText = useCallback(() => {
    if (error) return error;
    if (!drawMode) return "Select a method to define your area of interest";
    
    const instructions = {
      point: "Click on the map to drop a point",
      polygon: "Click on the map to begin drawing a polygon",
      click: "Click on a feature or features on the map"
    };
    
    return instructions[drawMode];
  }, [error, drawMode]);

  if (!view || !layerStates) {
    console.log('Early return triggered:', { view, layerStates });
    return (
      <div className="p-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {!view ? "Loading map view..." : "Loading layer data..."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <Card className="m-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Generate Report</CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleReset}
          title="Reset Tool"
          className="hover:bg-gray-100"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent>
        <Tabs 
          value={activeStep as string}
          onValueChange={(value: string) => setActiveStep(value as Step)} 
          className="space-y-4"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="draw">1. Draw</TabsTrigger>
            <TabsTrigger value="buffer" disabled={!geometry || geometry.type !== 'point'}>
              2. Buffer
            </TabsTrigger>
            <TabsTrigger value="report" disabled={!geometry}>
              3. Generate
            </TabsTrigger>
          </TabsList>

          <TabsContent value="draw">
            <div className="space-y-4">
              <AlertCard variant={(drawMode as 'point' | 'polygon' | 'click') || 'default'}>
                {getInstructionText()}
              </AlertCard>
              <DrawingTools
                drawMode={drawMode}
                handleDrawButtonClick={handleDrawButtonClick}
                isDrawing={isDrawing}
                isSelectionMode={drawMode === 'click'}
                onSelectionComplete={handleSelectionComplete}
                hasSelectedFeature={drawing.hasHitFeature}
                shouldShowNext={true}
                selectedCount={drawing.selectedFeatureCount}
              />
            </div>
          </TabsContent>

          <TabsContent value="buffer">
            <div className="space-y-4">
              <AlertCard variant="success">
                Define the area around your point
              </AlertCard>
              <BufferTools 
                bufferType={bufferType}
                handleBufferTypeChange={handleBufferTypeChange}
              />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Distance</Label>
                  <Input
                    type="number"
                    value={bufferValue}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBufferValue(e.target.value)}
                    min="0"
                    step={bufferType === 'radius' ? "0.1" : "1"}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Select
                    value={bufferUnit}
                    onValueChange={setBufferUnit}
                  >
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
              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={() => setActiveStep('draw')}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleCreateBuffer}
                  className="flex-1"
                >
                  Create Buffer
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="report">
            <div className="space-y-4">
              <AlertCard variant="success">
                Your area has been selected. Click generate to create your report.
              </AlertCard>
              <Button 
                onClick={() => setIsReportDialogOpen(true)}
                className="w-full"
              >
                Generate Report
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {isReportDialogOpen && geometry && (
          <ReportDialog 
            isOpen={isReportDialogOpen}
            onClose={() => setIsReportDialogOpen(false)}
            geometry={geometry}
            reportType="standard"
          />
        )}
      </CardContent>
    </Card>
  );
}