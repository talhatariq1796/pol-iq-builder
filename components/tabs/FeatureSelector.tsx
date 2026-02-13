import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { AlertCircle, MousePointerClick } from 'lucide-react';
import Graphic from "@arcgis/core/Graphic";
import { SimpleFillSymbol } from "@arcgis/core/symbols";
import FeatureSelectionUI from './FeatureSelectionUI';

const FeatureSelector = ({ 
  view, 
  onFeatureSelect, 
  isActive 
}: { 
  view: __esri.MapView | null;
  onFeatureSelect: (geometry: __esri.Geometry) => void;
  isActive: boolean;
}) => {
  const [hoverGraphic, setHoverGraphic] = useState<__esri.Graphic | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<__esri.Graphic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isHovering, setIsHovering] = useState(false);

  // Memoize symbols to prevent recreation on every render
  const symbols = useMemo(() => ({
    hover: new SimpleFillSymbol({
      color: [128, 0, 255, 0.2], // Purple with transparency
      outline: {
        color: [128, 0, 255], // Purple
        width: 2
      }
    }),
    selected: new SimpleFillSymbol({
      color: [128, 0, 255, 0.3], // Slightly more opaque purple
      outline: {
        color: [128, 0, 255],
        width: 3
      }
    })
  }), []);

  // Pointer move handler for hover effects
  const handlePointerMove = useCallback((event: __esri.ViewPointerMoveEvent) => {
    if (!view?.map) return;

    view.hitTest(event, {
      include: view.map.layers.toArray()
    }).then((response) => {
      const featureHit = response.results.find(
        (result): result is __esri.GraphicHit => 
          result.type === 'graphic' && 
          result.graphic !== null &&
          result.graphic !== undefined &&
          result.graphic.geometry !== null &&
          result.graphic.geometry !== undefined &&
          result.graphic.layer !== null &&
          result.graphic.layer !== undefined &&
          result.graphic.layer.type === 'feature'
      );

      if (featureHit?.graphic) {
        setIsHovering(true);
        if (hoverGraphic?.geometry !== featureHit.graphic.geometry) {
          // Remove previous hover effect
          if (hoverGraphic) {
            view.graphics.remove(hoverGraphic);
          }

          const graphic = new Graphic({
            geometry: featureHit.graphic.geometry,
            symbol: symbols.hover
          });

          view.graphics.add(graphic);
          setHoverGraphic(graphic);
        }
      } else {
        setIsHovering(false);
        if (hoverGraphic) {
          view.graphics.remove(hoverGraphic);
          setHoverGraphic(null);
        }
      }
    });
  }, [view, hoverGraphic, symbols.hover]);

  // Click handler for feature selection
  const handleClick = useCallback((event: __esri.ViewClickEvent) => {
    if (!view?.map) return;
    
    event.stopPropagation();
    setError(null);
    
    view.hitTest(event, {
      include: view.map.layers.toArray()
    }).then((response) => {
      const featureHit = response.results.find(
        (result): result is __esri.GraphicHit => 
          result.type === 'graphic' && 
          result.graphic !== null &&
          result.graphic !== undefined &&
          result.graphic.geometry !== null &&
          result.graphic.geometry !== undefined &&
          result.graphic.layer !== null &&
          result.graphic.layer !== undefined &&
          result.graphic.layer.type === 'feature'
      );

      if (featureHit?.graphic?.geometry) {
        // Remove previous selection graphic if it exists
        if (selectedFeature) {
          view.graphics.remove(selectedFeature);
        }

        // Create new selection graphic
        const selectionGraphic = new Graphic({
          geometry: featureHit.graphic.geometry,
          symbol: symbols.selected
        });

        view.graphics.add(selectionGraphic);
        setSelectedFeature(featureHit.graphic);
        onFeatureSelect(featureHit.graphic.geometry);
      } else {
        setError("No selectable feature found at this location");
        setTimeout(() => setError(null), 3000);
      }
    });
  }, [view, onFeatureSelect, selectedFeature, symbols.selected]);

  // Set up and clean up event handlers
  useEffect(() => {
    if (!view) return;

    let moveHandler: IHandle | null = null;
    let clickHandler: IHandle | null = null;

    if (isActive) {
      moveHandler = view.on('pointer-move', handlePointerMove);
      clickHandler = view.on('click', handleClick);
      
      if (view.container) {
        (view.container as HTMLDivElement).style.cursor = 'pointer';
      }

      view.map?.layers.forEach(layer => {
        if (layer.type === "feature") {
          (layer as __esri.FeatureLayer).set("popupEnabled", false);
        }
      });
    }

    return () => {
      moveHandler?.remove();
      clickHandler?.remove();
      
      if (view.container) {
        (view.container as HTMLDivElement).style.cursor = 'default';
      }

      view.map?.layers.forEach(layer => {
        if (layer.type === "feature") {
          (layer as __esri.FeatureLayer).set("popupEnabled", true);
        }
      });

      // Clean up any remaining graphics
      if (hoverGraphic) {
        view.graphics.remove(hoverGraphic);
        setHoverGraphic(null);
      }
      if (selectedFeature) {
        view.graphics.remove(selectedFeature);
        setSelectedFeature(null);
      }
    };
  }, [view, isActive, handlePointerMove, handleClick, hoverGraphic, selectedFeature]);

  return (
    <>
      <div className="absolute bottom-4 left-4 z-10 space-y-2">
        {isActive && (
          <>
            <div className="bg-white/90 backdrop-blur-sm shadow-lg rounded-lg p-3 flex items-center space-x-2 border">
              <MousePointerClick className="h-5 w-5 text-purple-600" />
              <span className="text-sm font-medium">
                {isHovering ? "Click to select highlighted feature" : "Click any feature on the map"}
              </span>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center space-x-2 animate-in slide-in-from-bottom-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}
          </>
        )}
      </div>
      
      {isActive && <FeatureSelectionUI selectedFeature={selectedFeature} />}
    </>
  );
};

export default FeatureSelector;