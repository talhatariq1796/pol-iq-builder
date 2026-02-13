"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { MapPin, Home, Circle } from 'lucide-react';
import type { Property } from './types';

interface SimpleMapProps {
  properties: Property[];
  selectedProperty?: Property | null;
  onPropertySelect?: (property: Property) => void;
  selectedComparableIds?: string[]; // NEW: IDs of selected comparables
  hoveredPropertyId?: string | null; // NEW: ID of hovered property from table
  bufferGeometry?: __esri.Geometry | null; // NEW: Buffer geometry to display
}

const SimpleMap: React.FC<SimpleMapProps> = ({
  properties,
  selectedProperty,
  onPropertySelect,
  selectedComparableIds = [],
  hoveredPropertyId = null,
  bufferGeometry = null
}) => {
  // Debounce filter changes (300ms) to avoid excessive re-renders
  const [debouncedProperties, setDebouncedProperties] = useState(properties);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedProperties(properties);
    }, 300);

    return () => clearTimeout(timer);
  }, [properties]);

  // Calculate map bounds and center with real-time property filtering
  const mapData = useMemo(() => {
    if (debouncedProperties.length === 0) {
      return {
        center: { lat: 45.5017, lng: -73.5673 }, // Montreal default
        bounds: null,
        neighborhoods: [],
        soldCount: 0,
        activeCount: 0
      };
    }

    // Count properties by status for legend
    const soldCount = debouncedProperties.filter(p => p.status === 'sold' || p.st === 'SO').length;
    const activeCount = debouncedProperties.filter(p => p.status === 'active' || p.st === 'AC').length;

    // Group properties by neighborhood for visualization
    const neighborhoods = debouncedProperties.reduce((acc, property) => {
      // Extract neighborhood from address (last part after comma)
      const addressParts = property.address.split(',');
      const neighborhood = addressParts.length > 1 ? addressParts[addressParts.length - 1].trim() : 'Unknown';
      if (!acc[neighborhood]) {
        acc[neighborhood] = {
          name: neighborhood,
          properties: [],
          count: 0,
          avgPrice: 0,
          totalPrice: 0
        };
      }

      acc[neighborhood].properties.push(property);
      acc[neighborhood].count += 1;
      acc[neighborhood].totalPrice += property.price || 0;
      acc[neighborhood].avgPrice = acc[neighborhood].totalPrice / acc[neighborhood].count;

      return acc;
    }, {} as Record<string, any>);

    return {
      center: { lat: 45.5017, lng: -73.5673 }, // Montreal area
      bounds: null,
      neighborhoods: Object.values(neighborhoods),
      soldCount,
      activeCount
    };
  }, [debouncedProperties]);

  // Mock coordinates for Montreal area neighborhoods
  const neighborhoodCoordinates = {
    'Montreal': { lat: 45.5017, lng: -73.5673 },
    'Pointe-Claire': { lat: 45.4463, lng: -73.8168 },
    'Laval': { lat: 45.6066, lng: -73.7124 },
    'Longueuil': { lat: 45.5312, lng: -73.5185 },
    'Brossard': { lat: 45.4584, lng: -73.4615 },
    'Saint-Laurent': { lat: 45.5084, lng: -73.7779 },
    'Dollard-Des Ormeaux': { lat: 45.4943, lng: -73.8243 },
    'Pierrefonds-Roxboro': { lat: 45.5084, lng: -73.8779 },
    'Westmount': { lat: 45.4838, lng: -73.5999 },
    'Verdun': { lat: 45.4581, lng: -73.5678 }
  } as Record<string, { lat: number; lng: number }>;

  // Helper to determine marker color based on property status
  const getMarkerColor = (property: Property, isHovered: boolean, isSelected: boolean) => {
    const isSold = property.status === 'sold' || property.st === 'SO';

    if (isSelected) {
      return '#F59E0B'; // Orange/Gold for selected comparables
    }

    if (isHovered) {
      return '#8B5CF6'; // Purple for hovered property
    }

    return isSold ? '#EF4444' : '#22C55E'; // Red for sold, Green for active
  };

  // Helper to get marker size based on state
  const getMarkerSize = (property: Property, isHovered: boolean, isSelected: boolean) => {
    if (isHovered) return 32; // Pulse effect when hovered
    if (isSelected) return 28; // Larger when selected
    return 24; // Default size
  };

  return (
    <div className="relative w-full h-full bg-gradient-to-br from-blue-50 to-green-50 rounded-lg overflow-hidden border">
      {/* Buffer Zone Visualization */}
      {bufferGeometry && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-blue-100 opacity-20 rounded-lg" />
          <div className="absolute top-2 left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">
            Buffer Zone
          </div>
        </div>
      )}

      {/* Map Container */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <MapPin className="h-12 w-12 text-blue-500 mx-auto mb-2" />
          <p className="text-sm text-gray-600 mb-4">Real-Time Property Map</p>
          <p className="text-xs text-gray-500">
            {debouncedProperties.length} properties across {mapData.neighborhoods.length} neighborhoods
          </p>
          <div className="flex items-center justify-center gap-4 mt-2 text-xs">
            <div className="flex items-center gap-1">
              <Circle className="h-3 w-3 text-green-500 fill-current" />
              <span>{mapData.activeCount} Active</span>
            </div>
            <div className="flex items-center gap-1">
              <Circle className="h-3 w-3 text-red-500 fill-current" />
              <span>{mapData.soldCount} Sold</span>
            </div>
            {selectedComparableIds.length > 0 && (
              <div className="flex items-center gap-1">
                <Circle className="h-3 w-3 text-orange-500 fill-current" />
                <span>{selectedComparableIds.length} Selected</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Neighborhood Markers with Real-time Status Colors */}
      <div className="absolute inset-0">
        {mapData.neighborhoods.map((neighborhood: any, index) => {
          const coords = neighborhoodCoordinates[neighborhood.name] ||
                        neighborhoodCoordinates['Montreal'];

          // Calculate individual property markers within each neighborhood
          return (
            <div key={neighborhood.name}>
              {neighborhood.properties.map((property: Property, propIndex: number) => {
                const isHovered = hoveredPropertyId === property.id;
                const isSelected = selectedComparableIds.includes(property.id);
                const markerColor = getMarkerColor(property, isHovered, isSelected);
                const markerSize = getMarkerSize(property, isHovered, isSelected);

                // Spread properties within neighborhood cluster
                const offsetX = (propIndex % 3 - 1) * 3;
                const offsetY = (Math.floor(propIndex / 3) - 1) * 3;

                return (
                  <div
                    key={property.id}
                    className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group transition-all duration-200 ${
                      isHovered ? 'z-50 animate-pulse' : 'z-10'
                    }`}
                    style={{
                      left: `${20 + (index % 5) * 15 + offsetX}%`,
                      top: `${20 + Math.floor(index / 5) * 20 + offsetY}%`,
                      width: `${markerSize}px`,
                      height: `${markerSize}px`
                    }}
                    onClick={() => onPropertySelect?.(property)}
                  >
                    {/* Marker */}
                    <div className="relative w-full h-full">
                      <div
                        className={`w-full h-full rounded-full border-2 border-white shadow-lg flex items-center justify-center transition-all ${
                          isSelected ? 'ring-2 ring-orange-400 ring-offset-2' : ''
                        } ${
                          isHovered ? 'ring-4 ring-purple-400 ring-offset-2 scale-110' : ''
                        }`}
                        style={{ backgroundColor: markerColor }}
                      >
                        {isSelected && (
                          <span className="text-xs text-white font-bold">★</span>
                        )}
                      </div>

                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-black text-white text-xs rounded-lg px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                        <div className="font-medium truncate max-w-[200px]">{property.address}</div>
                        <div className="flex items-center gap-2">
                          <span>${property.price?.toLocaleString() || 'N/A'}</span>
                          <span>•</span>
                          <span>{property.bedrooms || 0}BR</span>
                          <span>•</span>
                          <span className={property.status === 'sold' || property.st === 'SO' ? 'text-red-300' : 'text-green-300'}>
                            {property.status === 'sold' || property.st === 'SO' ? 'SOLD' : 'ACTIVE'}
                          </span>
                        </div>
                        {isSelected && (
                          <div className="text-orange-300 font-semibold">Selected Comparable</div>
                        )}
                        {/* Arrow */}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-black"></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Enhanced Legend with Real-time Status */}
      <div className="absolute bottom-4 left-4 bg-white bg-opacity-95 rounded-lg p-3 shadow-lg border border-gray-200">
        <div className="text-xs font-bold text-gray-800 mb-2">Map Legend</div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-gray-700">
            <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow"></div>
            <span>Active Listing</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-700">
            <div className="w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow"></div>
            <span>Sold Property</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-700">
            <div className="w-4 h-4 bg-orange-500 rounded-full border-2 border-white shadow relative">
              <span className="absolute inset-0 flex items-center justify-center text-white text-[8px]">★</span>
            </div>
            <span>Selected Comparable</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-700">
            <div className="w-4 h-4 bg-purple-500 rounded-full border-2 border-white shadow animate-pulse"></div>
            <span>Hovered Property</span>
          </div>
        </div>
      </div>

      {/* Real-time Stats Panel */}
      <div className="absolute bottom-4 right-4 bg-white bg-opacity-95 rounded-lg p-3 shadow-lg border border-gray-200">
        <div className="text-xs font-bold text-gray-800 mb-2">Live Stats</div>
        <div className="space-y-1">
          <div className="flex justify-between gap-4 text-xs">
            <span className="text-gray-600">Total:</span>
            <span className="font-semibold text-blue-600">{debouncedProperties.length}</span>
          </div>
          <div className="flex justify-between gap-4 text-xs">
            <span className="text-gray-600">Active:</span>
            <span className="font-semibold text-green-600">{mapData.activeCount}</span>
          </div>
          <div className="flex justify-between gap-4 text-xs">
            <span className="text-gray-600">Sold:</span>
            <span className="font-semibold text-red-600">{mapData.soldCount}</span>
          </div>
          {selectedComparableIds.length > 0 && (
            <div className="flex justify-between gap-4 text-xs pt-1 border-t border-gray-200">
              <span className="text-gray-600">Selected:</span>
              <span className="font-semibold text-orange-600">{selectedComparableIds.length}</span>
            </div>
          )}
        </div>
      </div>

      {/* Selected Property Highlight */}
      {selectedProperty && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white rounded-lg px-3 py-2 shadow-lg">
          <div className="text-sm font-medium">{selectedProperty.address}</div>
          <div className="text-xs opacity-90">
            ${(selectedProperty.price ?? 0).toLocaleString()} • 
            {selectedProperty.bedrooms}BR • 
            {selectedProperty.bathrooms}BA
          </div>
        </div>
      )}
    </div>
  );
};

export { SimpleMap };
export default SimpleMap;