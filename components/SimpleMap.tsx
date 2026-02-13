/* eslint-disable react-hooks/exhaustive-deps */
import React, { useRef, useEffect } from 'react';
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Graphic from '@arcgis/core/Graphic';
import { SimpleFillSymbol, SimpleLineSymbol } from '@arcgis/core/symbols';
import { CardHeader, CardTitle } from '@/components/ui/card';
import * as geometryEngine from '@arcgis/core/geometry/geometryEngine';

interface MapConfig {
  unitType: 'miles' | 'kilometers';
  colors: {
    area: string;
    border: string;
  };
}

interface SimpleMapProps {
  geometry?: __esri.Geometry;
  areaDescription: string;
  config: {
    zoom: number;
    center: [number, number];
    colors: {
      area: string;
      border: string;
    };
    unitType: 'miles' | 'kilometers';
  };
}

const hexToRgb = (hex: string): number[] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [0, 0, 0];
};

const SimpleMap: React.FC<SimpleMapProps> = ({ geometry, areaDescription, config }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<__esri.MapView | null>(null);

  useEffect(() => {
    if (!mapRef.current || !geometry) return;

    const map = new Map({
      basemap: "gray-vector"
    });

    const graphicsLayer = new GraphicsLayer();
    map.add(graphicsLayer);

    if (geometry) {
      const graphic = new Graphic({
        geometry,
        symbol: new SimpleFillSymbol({
          color: [...hexToRgb(config.colors.area), 0.2],
          outline: new SimpleLineSymbol({
            color: config.colors.border,
            width: 2
          })
        })
      });
      graphicsLayer.add(graphic);

      if (geometry.type === "polygon") {
        const geodesicArea = geometryEngine.geodesicArea(geometry as __esri.Polygon, config.unitType === 'miles' ? 'square-miles' : 'square-kilometers');
        const formattedArea = Math.round(geodesicArea).toLocaleString();
        const unit = config.unitType === 'miles' ? 'sq mi' : 'km²';
        areaDescription = `${formattedArea} ${unit}`;
      }
    }

    const view = new MapView({
      container: mapRef.current,
      map,
      ui: {
        components: []
      },
      constraints: {
        rotationEnabled: false,
        minScale: 300000
      },
      extent: geometry?.extent ? geometry.extent.clone().expand(1.4) : undefined
    });

    viewRef.current = view;

    return () => {
      viewRef.current?.destroy();
    };
  }, [geometry, config.colors.area, config.colors.border, config.unitType]);

  return (
    <div className="h-full flex flex-col -z-10">
      <div className="flex-1" style={{ marginTop: '-22vh' }}>
        <div ref={mapRef} className="w-full h-full" tabIndex={-1} />
      </div>
    </div>
  );
};

export default SimpleMap;