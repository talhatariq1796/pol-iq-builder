import React, { useEffect, useState, useCallback } from 'react';
import Graphic from "@arcgis/core/Graphic";
import Point from "@arcgis/core/geometry/Point";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import TextSymbol from "@arcgis/core/symbols/TextSymbol";
import { MapPin, ShoppingBag, Users, DollarSign, Car } from 'lucide-react';
import { ACTIVE_COLOR_SCHEME } from '@/utils/renderer-standardization';

export interface SampleHotspot {
  id: string;
  name: string;
  coordinates: [number, number]; // [longitude, latitude]
  type: 'retail' | 'demographic' | 'economic' | 'transportation';
  description: string;
  sampleQuery: string;
  color: string;
  icon: React.ComponentType<any>;
}

// Define Florida sample hotspots
export const FLORIDA_HOTSPOTS: SampleHotspot[] = [
  {
    id: 'miami-retail',
    name: 'Miami Retail District',
    coordinates: [-80.1918, 25.7617],
    type: 'retail',
    description: 'Explore retail density and consumer patterns in Miami',
    sampleQuery: 'Show me retail opportunities within 5 miles of downtown Miami',
    color: ACTIVE_COLOR_SCHEME[1], // Orange
    icon: ShoppingBag
  },
  {
    id: 'tampa-demographics',
    name: 'Tampa Bay Demographics',
    coordinates: [-82.4572, 27.9506],
    type: 'demographic',
    description: 'Analyze demographic trends and population insights',
    sampleQuery: 'What are the demographic patterns in Tampa Bay area?',
    color: '#0080ff', // Blue (keep unique for demographics)
    icon: Users
  },
  {
    id: 'orlando-economic',
    name: 'Orlando Economic Zone',
    coordinates: [-81.3792, 28.5383],
    type: 'economic',
    description: 'Economic indicators and growth patterns analysis',
    sampleQuery: 'Analyze economic growth indicators for Orlando metropolitan area',
    color: ACTIVE_COLOR_SCHEME[3], // Green (primary)
    icon: DollarSign
  },
  {
    id: 'jacksonville-transport',
    name: 'Jacksonville Transportation',
    coordinates: [-81.6557, 30.3322],
    type: 'transportation',
    description: 'Transportation networks and accessibility analysis',
    sampleQuery: 'Show transportation accessibility within Jacksonville',
    color: '#bf00ff', // Purple (keep unique for transportation)
    icon: Car
  }
];

// Default view configuration - hardcoded for Jacksonville metro area
export const FLORIDA_DEFAULT_VIEW = {
  center: [-82.3096907401495, 30.220957986146445], // Jacksonville metro area center
  zoom: 9, // Jacksonville metro area zoom level (2 levels out from 11)
  extent: {
    xmin: -81.9,
    ymin: 30.1,
    xmax: -81.3,
    ymax: 30.6,
    spatialReference: { wkid: 4326 }
  }
};

interface SampleHotspotsProps {
  view: __esri.MapView;
  onHotspotClick?: (hotspot: SampleHotspot) => void;
  showWelcomeOverlay?: boolean;
}

export default function SampleHotspots({ 
  view, 
  onHotspotClick,
  showWelcomeOverlay = true 
}: SampleHotspotsProps) {
  const [hotspotGraphics, setHotspotGraphics] = useState<__esri.Graphic[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showOverlay, setShowOverlay] = useState(showWelcomeOverlay);
  const [hoveredHotspot, setHoveredHotspot] = useState<string | null>(null);

  // Initialize hotspots on the map
  useEffect(() => {
    if (!view || isInitialized) return;

    const initializeHotspots = async () => {
      try {
        // Wait for view to be ready
        await view.when();

        // Create graphics for each hotspot
        const graphics: __esri.Graphic[] = [];

        FLORIDA_HOTSPOTS.forEach(hotspot => {
          // Create the main marker
          const point = new Point({
            longitude: hotspot.coordinates[0],
            latitude: hotspot.coordinates[1],
            spatialReference: { wkid: 4326 }
          });

          // Create pulsing marker symbol
          const markerSymbol = new SimpleMarkerSymbol({
            color: hotspot.color,
            outline: {
              color: [255, 255, 255, 0.8],
              width: 2
            },
            size: 12
          });

          // Create the graphic with attributes
          const graphic = new Graphic({
            geometry: point,
            symbol: markerSymbol,
            attributes: {
              ...hotspot,
              type: 'sample-hotspot'
            },
            popupTemplate: {
              title: hotspot.name,
              content: `
                <div style="padding: 10px;">
                  <p style="margin-bottom: 10px;">${hotspot.description}</p>
                  <p style="font-style: italic; color: #666;">Click to explore this area</p>
                  <hr style="margin: 10px 0; border: none; border-top: 1px solid #eee;">
                  <p style="font-size: 12px; color: #888;">Sample query: "${hotspot.sampleQuery}"</p>
                </div>
              `
            }
          });

          graphics.push(graphic);

          // Add label for the hotspot
          const labelSymbol = new TextSymbol({
            text: hotspot.name,
            color: "white",
            haloColor: "black",
            haloSize: 1,
            font: {
              size: 10,
              weight: "bold"
            },
            yoffset: -15
          });

          const labelGraphic = new Graphic({
            geometry: point,
            symbol: labelSymbol,
            attributes: {
              ...hotspot,
              type: 'sample-hotspot-label'
            }
          });

          graphics.push(labelGraphic);
        });

        // Add all graphics to the view
        view.graphics.addMany(graphics);
        setHotspotGraphics(graphics);

        // Set up click handler
        view.on("click", (event) => {
          view.hitTest(event).then((response) => {
            const hotspotHit = response.results.find(
              result => result.type === 'graphic' && 
                       (result as __esri.GraphicHit).graphic?.attributes?.type === 'sample-hotspot'
            );

            if (hotspotHit && hotspotHit.type === 'graphic') {
              const graphicHit = hotspotHit as __esri.GraphicHit;
              const hotspotData = FLORIDA_HOTSPOTS.find(
                h => h.id === graphicHit.graphic.attributes.id
              );
              if (hotspotData && onHotspotClick) {
                onHotspotClick(hotspotData);
                setShowOverlay(false);
              }
            }
          });
        });

        // Set up hover effect
        view.on("pointer-move", (event) => {
          view.hitTest(event).then((response) => {
            const hotspotHit = response.results.find(
              result => result.type === 'graphic' && 
                       (result as __esri.GraphicHit).graphic?.attributes?.type === 'sample-hotspot'
            );

            if (hotspotHit && hotspotHit.type === 'graphic') {
              const graphicHit = hotspotHit as __esri.GraphicHit;
              setHoveredHotspot(graphicHit.graphic.attributes.id);
              if (view.container) {
                view.container.style.cursor = 'pointer';
              }
            } else {
              setHoveredHotspot(null);
              if (view.container) {
                view.container.style.cursor = 'default';
              }
            }
          });
        });

        setIsInitialized(true);

        // Auto-hide overlay after 10 seconds
        if (showWelcomeOverlay) {
          setTimeout(() => {
            setShowOverlay(false);
          }, 10000);
        }

      } catch (error) {
        console.error('Error initializing sample hotspots:', error);
      }
    };

    initializeHotspots();

    // Cleanup
    return () => {
      if (view && hotspotGraphics.length > 0) {
        view.graphics.removeMany(hotspotGraphics);
      }
    };
  }, [view, isInitialized, onHotspotClick, showWelcomeOverlay, hotspotGraphics]);

  // Add pulsing animation to hotspots
  useEffect(() => {
    if (!view || hotspotGraphics.length === 0) return;

    const animateHotspots = () => {
      hotspotGraphics.forEach((graphic, index) => {
        if (graphic.attributes?.type === 'sample-hotspot') {
          const baseSize = 12;
          const pulse = Math.sin(Date.now() * 0.001 + index) * 2;
          const isHovered = graphic.attributes.id === hoveredHotspot;
          
          if (graphic.symbol && graphic.symbol.type === 'simple-marker') {
            const symbol = graphic.symbol as __esri.SimpleMarkerSymbol;
            graphic.symbol = symbol.clone();
            (graphic.symbol as __esri.SimpleMarkerSymbol).size = 
              isHovered ? baseSize + 6 : baseSize + pulse;
          }
        }
      });
    };

    const intervalId = setInterval(animateHotspots, 50);
    return () => clearInterval(intervalId);
  }, [view, hotspotGraphics, hoveredHotspot]);

  // Note: Initial view is now set in MapClient with Jacksonville coordinates
  // No need to override it here

  return (
    <>
      {/* Welcome Overlay */}
      {showOverlay && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-40 animate-entrance">
          <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg p-4 shadow-lg max-w-md">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <MapPin className="h-5 w-5 text-primary animate-pulse" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  Welcome to MPIQ Analysis
                </h3>
                <p className="text-xs text-muted-foreground">
                  Click on any highlighted city to explore sample analyses, or select your own area to begin.
                </p>
                <button
                  onClick={() => setShowOverlay(false)}
                  className="mt-2 text-xs text-primary hover:underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hotspot Legend */}
      <div className="absolute bottom-20 left-20 z-30 bg-background/90 backdrop-blur-sm border border-border rounded-lg p-3 animate-entrance">
        <h4 className="text-xs font-semibold mb-2">Sample Analysis Areas</h4>
        <div className="space-y-1">
          {FLORIDA_HOTSPOTS.map(hotspot => {
            const Icon = hotspot.icon;
            return (
              <div 
                key={hotspot.id}
                className="flex items-center space-x-2 text-xs cursor-pointer hover:bg-muted/50 p-1 rounded transition-colors"
                onClick={() => onHotspotClick?.(hotspot)}
              >
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: hotspot.color }}
                />
                <Icon className="h-3 w-3" />
                <span className="text-muted-foreground">{hotspot.name}</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}