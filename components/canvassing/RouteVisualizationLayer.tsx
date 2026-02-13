/**
 * Route Visualization Layer
 *
 * Displays optimized canvassing routes on the map
 * with numbered stops, direction arrows, and progress.
 */

'use client';

import React, { useMemo, useState } from 'react';
import { Source, Layer, Marker, Popup } from 'react-map-gl';
import type { LineLayer, CircleLayer, SymbolLayer } from 'react-map-gl';
import { MapPin, Clock, Home, CheckCircle } from 'lucide-react';
import type { OptimizedRoute, RouteStop } from '@/lib/canvassing/RouteOptimizer';

export interface RouteVisualizationLayerProps {
  route: OptimizedRoute;
  stopCoordinates: Map<string, [number, number]>; // precinctId -> [lng, lat]
  completedStops?: string[]; // precinctIds that are done
  currentStopIndex?: number;
  showDirections?: boolean;
  onStopClick?: (stop: RouteStop) => void;
  visible?: boolean;
}

// Colors
const ROUTE_COLOR = '#3B82F6'; // blue
const COMPLETED_COLOR = '#22C55E'; // green
const CURRENT_COLOR = '#F59E0B'; // yellow
const UPCOMING_COLOR = '#6B7280'; // gray

export function RouteVisualizationLayer({
  route,
  stopCoordinates,
  completedStops = [],
  currentStopIndex,
  showDirections = true,
  onStopClick,
  visible = true,
}: RouteVisualizationLayerProps) {
  const [hoveredStop, setHoveredStop] = useState<RouteStop | null>(null);

  // Build route line GeoJSON
  const routeLineGeoJSON = useMemo(() => {
    const coordinates: [number, number][] = [];

    route.stops.forEach(stop => {
      const coord = stopCoordinates.get(stop.precinctId);
      if (coord) {
        coordinates.push(coord);
      }
    });

    return {
      type: 'FeatureCollection' as const,
      features: [{
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          coordinates,
        },
      }],
    };
  }, [route.stops, stopCoordinates]);

  // Build stop points GeoJSON
  const stopsGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: route.stops.map((stop, index) => {
      const coord = stopCoordinates.get(stop.precinctId);
      const isCompleted = completedStops.includes(stop.precinctId);
      const isCurrent = index === currentStopIndex;

      return {
        type: 'Feature' as const,
        properties: {
          order: stop.order,
          precinctId: stop.precinctId,
          precinctName: stop.precinctName,
          isCompleted,
          isCurrent,
          estimatedMinutes: stop.estimatedMinutes,
          estimatedDoors: stop.estimatedDoors,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: coord || [0, 0],
        },
      };
    }).filter(f => f.geometry.coordinates[0] !== 0),
  }), [route.stops, stopCoordinates, completedStops, currentStopIndex]);

  // Line layer
  const lineLayer: LineLayer = useMemo(() => ({
    id: 'route-line',
    type: 'line',
    paint: {
      'line-color': ROUTE_COLOR,
      'line-width': 3,
      'line-dasharray': [2, 1],
    },
    layout: {
      'line-join': 'round',
      'line-cap': 'round',
    },
  }), []);

  // Stop circle layer
  const stopCircleLayer: CircleLayer = useMemo(() => ({
    id: 'route-stops',
    type: 'circle',
    paint: {
      'circle-radius': 12,
      'circle-color': [
        'case',
        ['get', 'isCompleted'], COMPLETED_COLOR,
        ['get', 'isCurrent'], CURRENT_COLOR,
        UPCOMING_COLOR
      ],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  }), []);

  // Stop number labels
  const stopLabelLayer: SymbolLayer = useMemo(() => ({
    id: 'route-stop-labels',
    type: 'symbol',
    layout: {
      'text-field': ['to-string', ['get', 'order']],
      'text-size': 10,
      'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
    },
    paint: {
      'text-color': '#ffffff',
    },
  }), []);

  // Direction arrows along the route
  const arrowLayer: SymbolLayer = useMemo(() => ({
    id: 'route-arrows',
    type: 'symbol',
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': 100,
      'text-field': '▸',
      'text-size': 16,
      'text-rotation-alignment': 'map',
      'text-keep-upright': false,
    },
    paint: {
      'text-color': ROUTE_COLOR,
    },
  }), []);

  if (!visible) return null;

  return (
    <>
      {/* Route line */}
      <Source id="route-line" type="geojson" data={routeLineGeoJSON}>
        <Layer {...lineLayer} />
        {showDirections && <Layer {...arrowLayer} />}
      </Source>

      {/* Stop markers */}
      <Source id="route-stops" type="geojson" data={stopsGeoJSON}>
        <Layer {...stopCircleLayer} />
        <Layer {...stopLabelLayer} />
      </Source>

      {/* Interactive markers for stops */}
      {route.stops.map((stop, index) => {
        const coord = stopCoordinates.get(stop.precinctId);
        if (!coord) return null;

        const isCompleted = completedStops.includes(stop.precinctId);
        const isCurrent = index === currentStopIndex;

        return (
          <Marker
            key={stop.precinctId}
            longitude={coord[0]}
            latitude={coord[1]}
            anchor="center"
            onClick={() => {
              onStopClick?.(stop);
            }}
          >
            <div
              className="cursor-pointer"
              onMouseEnter={() => setHoveredStop(stop)}
              onMouseLeave={() => setHoveredStop(null)}
            >
              <div
                className={`
                  w-6 h-6 rounded-full flex items-center justify-center
                  text-white text-xs font-bold border-2 border-white shadow-md
                  ${isCurrent ? 'animate-pulse ring-2 ring-yellow-400' : ''}
                `}
                style={{
                  backgroundColor: isCompleted ? COMPLETED_COLOR : isCurrent ? CURRENT_COLOR : UPCOMING_COLOR,
                }}
              >
                {isCompleted ? <CheckCircle className="w-3 h-3" /> : stop.order}
              </div>
            </div>
          </Marker>
        );
      })}

      {/* Stop popup on hover */}
      {hoveredStop && (() => {
        const coord = stopCoordinates.get(hoveredStop.precinctId);
        if (!coord) return null;
        const isCompleted = completedStops.includes(hoveredStop.precinctId);

        return (
          <Popup
            longitude={coord[0]}
            latitude={coord[1]}
            anchor="bottom"
            closeButton={false}
            closeOnClick={false}
            offset={20}
          >
            <div className="p-2 text-sm min-w-[180px]">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Stop #{hoveredStop.order}</span>
                {isCompleted && (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Done
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-600">{hoveredStop.precinctName}</div>
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Home className="w-3 h-3" />
                  {hoveredStop.estimatedDoors} doors
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {hoveredStop.estimatedMinutes} min
                </span>
              </div>
              {hoveredStop.tips.length > 0 && (
                <div className="text-xs text-blue-600 mt-1 italic">
                  {hoveredStop.tips[0]}
                </div>
              )}
            </div>
          </Popup>
        );
      })()}

      {/* Route summary footer */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 text-sm">
        <div className="font-semibold">{route.turfName}</div>
        <div className="text-xs text-gray-600">
          {route.stops.length} stops • {route.totalDoors.toLocaleString()} doors • ~{Math.round(route.totalMinutes)} min
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {completedStops.length} of {route.stops.length} completed
        </div>
      </div>
    </>
  );
}

export default RouteVisualizationLayer;
