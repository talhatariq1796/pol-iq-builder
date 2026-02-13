/**
 * Volunteer Location Layer
 *
 * Shows volunteer positions on the map with real-time
 * status indicators and turf assignments.
 */

'use client';

import React, { useMemo, useState } from 'react';
import { Source, Layer, Marker, Popup } from 'react-map-gl';
import type { CircleLayer, SymbolLayer } from 'react-map-gl';
import { User, UserCheck, UserX, MapPin } from 'lucide-react';

export interface VolunteerLocation {
  volunteerId: string;
  volunteerName: string;
  location: [number, number]; // [lng, lat]
  status: 'active' | 'idle' | 'offline' | 'break';
  currentTurfId?: string;
  currentTurfName?: string;
  lastUpdate?: string;
  doorsToday?: number;
  contactsToday?: number;
}

export interface VolunteerLocationLayerProps {
  volunteers: VolunteerLocation[];
  selectedVolunteerId?: string;
  onVolunteerClick?: (volunteerId: string) => void;
  showLabels?: boolean;
  visible?: boolean;
}

// Status colors
const STATUS_COLORS = {
  active: '#22C55E',   // green
  idle: '#F59E0B',     // yellow
  offline: '#6B7280',  // gray
  break: '#3B82F6',    // blue
};

export function VolunteerLocationLayer({
  volunteers,
  selectedVolunteerId,
  onVolunteerClick,
  showLabels = true,
  visible = true,
}: VolunteerLocationLayerProps) {
  const [hoveredVolunteer, setHoveredVolunteer] = useState<VolunteerLocation | null>(null);

  // Convert to GeoJSON
  const geojsonData = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: volunteers.map(v => ({
      type: 'Feature' as const,
      properties: {
        volunteerId: v.volunteerId,
        volunteerName: v.volunteerName,
        status: v.status,
        currentTurfId: v.currentTurfId,
        currentTurfName: v.currentTurfName,
        doorsToday: v.doorsToday || 0,
        contactsToday: v.contactsToday || 0,
        isSelected: v.volunteerId === selectedVolunteerId,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: v.location,
      },
    })),
  }), [volunteers, selectedVolunteerId]);

  // Circle layer for volunteer markers
  const circleLayer: CircleLayer = useMemo(() => ({
    id: 'volunteer-circles',
    type: 'circle',
    paint: {
      'circle-radius': [
        'case',
        ['get', 'isSelected'], 12,
        8
      ],
      'circle-color': [
        'match', ['get', 'status'],
        'active', STATUS_COLORS.active,
        'idle', STATUS_COLORS.idle,
        'offline', STATUS_COLORS.offline,
        'break', STATUS_COLORS.break,
        '#6B7280'
      ],
      'circle-stroke-width': [
        'case',
        ['get', 'isSelected'], 3,
        1.5
      ],
      'circle-stroke-color': '#ffffff',
    },
  }), []);

  // Label layer
  const labelLayer: SymbolLayer = useMemo(() => ({
    id: 'volunteer-labels',
    type: 'symbol',
    layout: {
      'text-field': ['get', 'volunteerName'],
      'text-size': 11,
      'text-offset': [0, 1.5],
      'text-anchor': 'top',
    },
    paint: {
      'text-color': '#374151',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1,
    },
  }), []);

  if (!visible || volunteers.length === 0) return null;

  return (
    <>
      <Source id="volunteers" type="geojson" data={geojsonData}>
        <Layer {...circleLayer} />
        {showLabels && <Layer {...labelLayer} />}
      </Source>

      {/* Custom Markers for better interaction */}
      {volunteers.map(volunteer => (
        <Marker
          key={volunteer.volunteerId}
          longitude={volunteer.location[0]}
          latitude={volunteer.location[1]}
          anchor="center"
          onClick={() => {
            onVolunteerClick?.(volunteer.volunteerId);
          }}
        >
          <div
            className={`
              cursor-pointer transition-transform
              ${volunteer.volunteerId === selectedVolunteerId ? 'scale-125' : 'hover:scale-110'}
            `}
            onMouseEnter={() => setHoveredVolunteer(volunteer)}
            onMouseLeave={() => setHoveredVolunteer(null)}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center border-2 border-white shadow-md"
              style={{ backgroundColor: STATUS_COLORS[volunteer.status] }}
            >
              {volunteer.status === 'active' ? (
                <UserCheck className="w-4 h-4 text-white" />
              ) : volunteer.status === 'offline' ? (
                <UserX className="w-4 h-4 text-white" />
              ) : (
                <User className="w-4 h-4 text-white" />
              )}
            </div>
          </div>
        </Marker>
      ))}

      {/* Popup on hover */}
      {hoveredVolunteer && (
        <Popup
          longitude={hoveredVolunteer.location[0]}
          latitude={hoveredVolunteer.location[1]}
          anchor="bottom"
          closeButton={false}
          closeOnClick={false}
          offset={15}
        >
          <div className="p-2 text-sm min-w-[150px]">
            <div className="font-semibold">{hoveredVolunteer.volunteerName}</div>
            <div className="flex items-center gap-1 text-xs">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: STATUS_COLORS[hoveredVolunteer.status] }}
              />
              <span className="capitalize">{hoveredVolunteer.status}</span>
            </div>
            {hoveredVolunteer.currentTurfName && (
              <div className="text-xs text-gray-500 mt-1">
                <MapPin className="w-3 h-3 inline mr-1" />
                {hoveredVolunteer.currentTurfName}
              </div>
            )}
            <div className="text-xs text-gray-600 mt-1">
              Today: {hoveredVolunteer.doorsToday || 0} doors, {hoveredVolunteer.contactsToday || 0} contacts
            </div>
          </div>
        </Popup>
      )}
    </>
  );
}

export default VolunteerLocationLayer;
