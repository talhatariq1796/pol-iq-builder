/**
 * SpatialQueryHandler - AI handler for spatial/proximity queries
 *
 * Processes queries like:
 * - "donors within 5 miles of MSU"
 * - "precincts within 10 minute drive of the capitol"
 * - "show voters near 123 Main St"
 *
 * Uses existing ArcGIS infrastructure:
 * - Geocoding: ArcGIS World Geocoder
 * - Radius buffers: ArcGIS Circle geometry
 * - Drive/walk time: ArcGIS Service Area API
 * - Spatial queries: SpatialFilterService
 */

import type { MapCommand, SuggestedAction } from '@/components/ai-native/AIPoliticalSessionHost';
import type { ParsedIntent } from './intentParser';

// Re-export HandlerResult for consistency with workflowHandlers
export interface HandlerResult {
  response: string;
  mapCommands?: MapCommand[];
  suggestedActions?: SuggestedAction[];
  data?: any;
}

// Known landmarks in Ingham County for quick geocoding
const KNOWN_LANDMARKS: Record<string, { lat: number; lng: number; name: string }> = {
  'msu': { lat: 42.7251, lng: -84.4791, name: 'Michigan State University' },
  'michigan state': { lat: 42.7251, lng: -84.4791, name: 'Michigan State University' },
  'michigan state university': { lat: 42.7251, lng: -84.4791, name: 'Michigan State University' },
  'spartan stadium': { lat: 42.7284, lng: -84.4844, name: 'Spartan Stadium' },
  'breslin center': { lat: 42.7267, lng: -84.4936, name: 'Breslin Center' },
  'capitol': { lat: 42.7336, lng: -84.5553, name: 'Michigan State Capitol' },
  'state capitol': { lat: 42.7336, lng: -84.5553, name: 'Michigan State Capitol' },
  'michigan state capitol': { lat: 42.7336, lng: -84.5553, name: 'Michigan State Capitol' },
  'lansing city hall': { lat: 42.7336, lng: -84.5514, name: 'Lansing City Hall' },
  'frandor': { lat: 42.7359, lng: -84.5155, name: 'Frandor Shopping Center' },
  'eastwood towne center': { lat: 42.7371, lng: -84.4394, name: 'Eastwood Towne Center' },
  'meridian mall': { lat: 42.7197, lng: -84.4233, name: 'Meridian Mall' },
  'lansing mall': { lat: 42.7075, lng: -84.5938, name: 'Lansing Mall' },
  'cooley law school stadium': { lat: 42.7469, lng: -84.5472, name: 'Cooley Law School Stadium' },
  'lugnuts': { lat: 42.7469, lng: -84.5472, name: 'Jackson Field (Lugnuts)' },
  'old town': { lat: 42.7386, lng: -84.5528, name: 'Old Town Lansing' },
  'east lansing': { lat: 42.7369, lng: -84.4839, name: 'East Lansing' },
  'downtown lansing': { lat: 42.7325, lng: -84.5555, name: 'Downtown Lansing' },
  'lcc': { lat: 42.7347, lng: -84.5564, name: 'Lansing Community College' },
  'lansing community college': { lat: 42.7347, lng: -84.5564, name: 'Lansing Community College' },
  'sparrow hospital': { lat: 42.7364, lng: -84.5483, name: 'Sparrow Hospital' },
  'mclaren greater lansing': { lat: 42.7078, lng: -84.5308, name: 'McLaren Greater Lansing Hospital' },
};

export interface SpatialQueryResult {
  success: boolean;
  geocodedLocation?: {
    address: string;
    latitude: number;
    longitude: number;
  };
  bufferType: 'radius' | 'drivetime' | 'walktime';
  distance: number;
  unit: string;
  dataType: 'donors' | 'precincts' | 'voters' | 'all';
  matchedFeatures?: {
    precincts?: string[];
    donors?: any[];
    totalVoters?: number;
  };
  error?: string;
}

/**
 * Geocode a location string to coordinates
 * First checks known landmarks, then falls back to ArcGIS geocoding
 */
async function geocodeLocation(location: string): Promise<{ lat: number; lng: number; address: string } | null> {
  const locationLower = location.toLowerCase().trim();

  // Check known landmarks first
  if (KNOWN_LANDMARKS[locationLower]) {
    const landmark = KNOWN_LANDMARKS[locationLower];
    return {
      lat: landmark.lat,
      lng: landmark.lng,
      address: landmark.name,
    };
  }

  // Check partial matches for landmarks
  for (const [key, landmark] of Object.entries(KNOWN_LANDMARKS)) {
    if (locationLower.includes(key) || key.includes(locationLower)) {
      return {
        lat: landmark.lat,
        lng: landmark.lng,
        address: landmark.name,
      };
    }
  }

  // Fall back to ArcGIS geocoding
  try {
    const apiKey = process.env.NEXT_PUBLIC_ARCGIS_API_KEY;
    if (!apiKey) {
      console.warn('[SpatialQueryHandler] No ArcGIS API key available');
      return null;
    }

    // Bias search towards Ingham County, Michigan
    const searchLocation = `${location}, Ingham County, Michigan`;
    const url = `https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&singleLine=${encodeURIComponent(searchLocation)}&outFields=Match_addr&maxLocations=1&outSR=4326&token=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.candidates && data.candidates.length > 0) {
      const candidate = data.candidates[0];
      return {
        lat: candidate.location.y,
        lng: candidate.location.x,
        address: candidate.address,
      };
    }

    return null;
  } catch (error) {
    console.error('[SpatialQueryHandler] Geocoding error:', error);
    return null;
  }
}

/**
 * Handle spatial query intent - main entry point
 */
export async function handleSpatialQuery(
  spatialParams: NonNullable<ParsedIntent['spatialParams']>,
  query: string
): Promise<HandlerResult> {
  console.log('[SpatialQueryHandler] Processing spatial query:', spatialParams);

  const { queryType, distance, unit, location, dataType } = spatialParams;

  // Step 1: Geocode the location
  const geocoded = await geocodeLocation(location);

  if (!geocoded) {
    return {
      response: `I couldn't find a location matching "${location}". Try being more specific, like "MSU campus", "downtown Lansing", or a full address like "123 Main St, Lansing, MI".`,
      suggestedActions: [
        {
          id: 'try-landmark',
          label: 'Search near MSU',
          action: `Show ${dataType !== 'all' ? dataType : 'precincts'} within ${distance} ${unit} of MSU`,
          icon: 'map-pin',
        },
        {
          id: 'try-capitol',
          label: 'Search near Capitol',
          action: `Show ${dataType !== 'all' ? dataType : 'precincts'} within ${distance} ${unit} of the Capitol`,
          icon: 'landmark',
        },
      ],
    };
  }

  // Step 2: Build the response based on query type
  let bufferDescription: string;
  let mapCommandType: string;

  switch (queryType) {
    case 'drivetime':
      bufferDescription = `${distance} minute drive`;
      mapCommandType = 'showDriveTimeBuffer';
      break;
    case 'walktime':
      bufferDescription = `${distance} minute walk`;
      mapCommandType = 'showWalkTimeBuffer';
      break;
    default:
      bufferDescription = `${distance} ${unit}`;
      mapCommandType = 'showRadiusBuffer';
  }

  // Step 3: Build response text based on data type
  let responseText = `**${dataType === 'all' ? 'Area' : capitalizeFirst(dataType)} within ${bufferDescription} of ${geocoded.address}**\n\n`;

  // For now, we'll provide map commands to visualize the buffer
  // The actual feature intersection would happen in the map component
  const mapCommands: MapCommand[] = [
    {
      type: 'flyTo',
      target: `${geocoded.lat},${geocoded.lng}`,
      zoom: queryType === 'walktime' ? 15 : queryType === 'drivetime' ? 13 : 12,
    },
    {
      type: 'showBuffer',
      bufferType: queryType,
      center: { lat: geocoded.lat, lng: geocoded.lng },
      distance: distance,
      unit: unit,
      dataType: dataType,
    } as any, // Extended map command for buffer
  ];

  // Add appropriate heatmap based on data type
  if (dataType === 'donors') {
    responseText += `I'm showing a ${bufferDescription} buffer around **${geocoded.address}** to identify donor concentration in this area.\n\n`;
    responseText += `The map will highlight this area and show donor density. You can:\n`;
    responseText += `- See total contributions within the buffer\n`;
    responseText += `- View top ZIP codes by donation amount\n`;
    responseText += `- Identify high-capacity donor households\n`;

  } else if (dataType === 'precincts') {
    responseText += `I'm showing precincts within a ${bufferDescription} of **${geocoded.address}**.\n\n`;
    responseText += `This will help you:\n`;
    responseText += `- Identify which precincts are accessible from this location\n`;
    responseText += `- Plan canvassing routes efficiently\n`;
    responseText += `- Understand the political makeup of the area\n`;

    mapCommands.push({
      type: 'showChoropleth',
      metric: 'partisan_lean',
    });

  } else if (dataType === 'voters') {
    responseText += `I'm analyzing the voter universe within a ${bufferDescription} of **${geocoded.address}**.\n\n`;
    responseText += `This is useful for:\n`;
    responseText += `- Estimating canvassing door counts\n`;
    responseText += `- Identifying GOTV targets\n`;
    responseText += `- Planning event outreach\n`;

    mapCommands.push({
      type: 'showHeatmap',
      metric: 'gotv_priority',
    });

  } else {
    responseText += `I'm displaying a ${bufferDescription} buffer around **${geocoded.address}**.\n\n`;
    responseText += `Use this to explore:\n`;
    responseText += `- Precinct boundaries and demographics\n`;
    responseText += `- Donor concentration\n`;
    responseText += `- Canvassing potential\n`;
  }

  responseText += `\n📍 **Location**: ${geocoded.address}\n`;
  responseText += `📏 **Buffer**: ${bufferDescription}\n`;
  responseText += `🎯 **Data Focus**: ${capitalizeFirst(dataType)}\n`;

  // Step 4: Build suggested actions
  const suggestedActions: SuggestedAction[] = [];

  // Always offer to change buffer type
  if (queryType !== 'drivetime') {
    suggestedActions.push({
      id: 'switch-drivetime',
      label: `Use ${distance} min drive time`,
      action: `Show ${dataType !== 'all' ? dataType : 'precincts'} within ${distance} minute drive of ${geocoded.address}`,
      icon: 'car',
    });
  }

  if (queryType !== 'radius') {
    suggestedActions.push({
      id: 'switch-radius',
      label: `Use ${distance} mile radius`,
      action: `Show ${dataType !== 'all' ? dataType : 'precincts'} within ${distance} miles of ${geocoded.address}`,
      icon: 'circle',
    });
  }

  // Data type switches
  if (dataType !== 'donors') {
    suggestedActions.push({
      id: 'show-donors',
      label: 'Show donors in area',
      action: `Show donors within ${bufferDescription} of ${geocoded.address}`,
      icon: 'dollar-sign',
    });
  }

  if (dataType !== 'precincts') {
    suggestedActions.push({
      id: 'show-precincts',
      label: 'Show precincts',
      action: `Show precincts within ${bufferDescription} of ${geocoded.address}`,
      icon: 'map',
    });
  }

  // Analysis actions
  suggestedActions.push({
    id: 'plan-canvass',
    label: 'Plan canvassing',
    action: `Plan canvassing within ${bufferDescription} of ${geocoded.address}`,
    icon: 'route',
  });

  suggestedActions.push({
    id: 'generate-report',
    label: 'Generate area report',
    action: `Generate a targeting report for the area around ${geocoded.address}`,
    icon: 'file-text',
  });

  return {
    response: responseText,
    mapCommands,
    suggestedActions: suggestedActions.slice(0, 5), // Limit to 5 suggestions
    data: {
      geocodedLocation: geocoded,
      bufferType: queryType,
      distance,
      unit,
      dataType,
    },
  };
}

/**
 * Capitalize first letter
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
