/* eslint-disable @typescript-eslint/ban-ts-comment */
import React, { useState, useEffect, useRef } from 'react';
import { Users, DollarSign, Building, Info, X } from 'lucide-react';
import Extent from "@arcgis/core/geometry/Extent";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import Graphic from "@arcgis/core/Graphic";
import Polygon from "@arcgis/core/geometry/Polygon";
import { ACTIVE_COLOR_SCHEME } from '@/utils/renderer-standardization';

// Pre-joined data interfaces
export interface PreJoinedSampleAreasData {
  version: string;
  generated: string;
  project: {
    name: string;
    industry: string;
    primaryBrand?: string;
  };
  areas: SampleAreaData[];
}

export interface SampleAreaData {
  // Geographic Identity
  zipCode: string;
  city: string;
  county: string;
  state: string;
  
  // Geometry
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
  bounds: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  };
  
  // Demographics data
  demographics: {
    [key: string]: number;
  };
  
  // Analysis scores for sample area selection
  analysisScores: {
    [key: string]: number;
  };
  
  // Data quality indicator
  dataQuality: number;
}

// Individual FSA/ZIP code interface  
export interface ZipCodeArea {
  zipCode: string; 
  city: string;
  // Quebec housing specific fields - using actual field names from our data
  homeownershipRate: number;
  rentalRate: number;
  medianIncome: number;
  housingValue: number;
  hotGrowth: number;
  newHomeowner: number;
  affordability: number;
  youngMaintainers: number;
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
  bounds: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  };
}

// City grouping interface
export interface DisplaySampleArea {
  id: string;
  name: string;
  zipCodes: ZipCodeArea[];
  combinedBounds: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  };
}

interface SampleAreasPanelProps {
  view: __esri.MapView;
  onClose: () => void;
  visible: boolean;
}

// Helper function to safely convert values to numbers for ArcGIS
const safeNumber = (value: any): number => {
  if (value === null || value === undefined || value === '') return 0;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  return isNaN(num) ? 0 : num;
};

// Bookmark extents for Quebec cities
const BOOKMARK_EXTENTS: { [key: string]: { xmin: number; ymin: number; xmax: number; ymax: number } } = {
  'montreal': { xmin: -73.98, ymin: 45.41, xmax: -73.48, ymax: 45.71 },
  'quebec city': { xmin: -71.35, ymin: 46.75, xmax: -71.15, ymax: 46.85 },
  'laval': { xmin: -73.82, ymin: 45.52, xmax: -73.68, ymax: 45.62 },
  'gatineau': { xmin: -75.78, ymin: 45.40, xmax: -75.62, ymax: 45.52 }
};

export default function SampleAreasPanel({ view, onClose, visible }: SampleAreasPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [displayAreas, setDisplayAreas] = useState<DisplaySampleArea[]>([]);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);

  // Widget positioning effect
  useEffect(() => {
    if (!view || !containerRef.current) return;

    const container = containerRef.current;
    
    if (visible) {
      // Add to map UI as widget
      try {
        view.ui.add({
          component: container,
          position: "top-left",
          index: 2
        });
      } catch (error) {
        console.log('[SampleAreasPanel] Widget already added to view');
      }
    } else {
      // Remove from map UI  
      try {
        view.ui.remove(container);
      } catch (error) {
        console.log('[SampleAreasPanel] Widget not in view');
      }
    }
    
    return () => {
      try {
        view.ui.remove(container);
      } catch (error) {
        // Component already removed or not added
      }
    };
  }, [view, visible]);

  // Load sample areas data when component mounts
  useEffect(() => {
    if (visible && displayAreas.length === 0) {
      loadPreJoinedData();
    }
  }, [visible]);

  const selectRandomMetrics = () => {
    const housingMetricKeys = [
      'homeownershipRate',      // 'Homeownership Rate (%)'
      'rentalRate',              // 'Rental Rate (%)'
      'medianIncome',            // 'Median Household Income'
      'housingValue',            // 'Housing Value'
      'hotGrowth',               // 'Hot Growth Index'
      'newHomeowner',            // 'New Homeowner Index'
      'affordability',           // 'Housing Affordability Index'
      'youngMaintainers'         // 'Young Maintainers (%)'
    ];
    
    const shuffled = [...housingMetricKeys].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 4);
  };

  const loadPreJoinedData = async () => {
    console.log('[SampleAreasPanel] Loading pre-joined data...');
    setLoading(true);
    
    try {
      // Load the real sample areas data we generated
      const response = await fetch('/data/sample_areas_data_real.json');
      
      if (response.ok) {
        console.log('[SampleAreasPanel] Successfully fetched sample areas data');
        const sampleData = await response.json();
        console.log('[SampleAreasPanel] Sample data loaded, areas count:', sampleData.areas?.length);
        // Process the real data
        processRealSampleData(sampleData);
      } else {
        console.log('[SampleAreasPanel] Pre-joined data not found');
        setDisplayAreas([]);
      }
    } catch (error) {
      console.error('[SampleAreasPanel] Error loading sample areas data:', error);
      setDisplayAreas([]);
    } finally {
      setLoading(false);
    }
  };

  const processRealSampleData = (sampleData: any) => {
    console.log('[SampleAreasPanel] Processing real sample areas data:', sampleData.areas?.length, 'areas');
    
    // Select random metrics for this session
    const randomMetrics = selectRandomMetrics();
    setSelectedMetrics(randomMetrics);
    console.log('[SampleAreasPanel] Selected random metrics:', randomMetrics);
    
    // Group areas by city
    const citiesMap = new Map<string, any[]>();
    
    sampleData.areas.forEach((area: any) => {
      const cityKey = area.city.toLowerCase();
      if (!citiesMap.has(cityKey)) {
        citiesMap.set(cityKey, []);
      }
      citiesMap.get(cityKey)!.push(area);
    });
    
    console.log('[SampleAreasPanel] Cities grouped:', Array.from(citiesMap.keys()).map(city => `${city}: ${citiesMap.get(city)?.length} FSAs`));
    
    // Convert to DisplaySampleArea format
    const areas: DisplaySampleArea[] = [];
    
    citiesMap.forEach((zipAreas, cityKey) => {
      const cityName = zipAreas[0].city;
      console.log(`[SampleAreasPanel] Processing city ${cityName} with ${zipAreas.length} FSAs`);
      
      // Convert areas to ZipCodeArea format with real geometry and demographics
      const zipCodes: ZipCodeArea[] = zipAreas.map((area: any) => {
        const demo = area.demographics;
        
        return {
          zipCode: area.zipCode,
          city: area.city,
          geometry: area.geometry,
          bounds: area.bounds,
          // Map from our demographics data structure
          homeownershipRate: safeNumber(demo['Homeownership Rate (%)']),
          rentalRate: safeNumber(demo['Rental Rate (%)']),
          medianIncome: safeNumber(demo['Median Household Income']),
          housingValue: safeNumber(demo['Housing Value']),
          hotGrowth: safeNumber(demo['Hot Growth Index']),
          newHomeowner: safeNumber(demo['New Homeowner Index']),
          affordability: safeNumber(demo['Housing Affordability Index']),
          youngMaintainers: safeNumber(demo['Young Maintainers (%)'])
        };
      });
      
      // Calculate combined bounds
      const combinedBounds = zipCodes.reduce((bounds, zip) => {
        if (!zip.bounds) {
          console.log(`[SampleAreasPanel] WARNING: FSA ${zip.zipCode} has no bounds`);
          return bounds;
        }
        return {
          xmin: Math.min(bounds.xmin, zip.bounds.xmin),
          ymin: Math.min(bounds.ymin, zip.bounds.ymin),
          xmax: Math.max(bounds.xmax, zip.bounds.xmax),
          ymax: Math.max(bounds.ymax, zip.bounds.ymax)
        };
      }, {
        xmin: Infinity,
        ymin: Infinity,
        xmax: -Infinity,
        ymax: -Infinity
      });
      
      areas.push({
        id: cityKey,
        name: cityName,
        zipCodes,
        combinedBounds
      });
      
      console.log(`[SampleAreasPanel] ${cityName} final area created with bounds:`, combinedBounds);
    });
    
    setDisplayAreas(() => areas);
    console.log('[SampleAreasPanel] Created', areas.length, 'display areas from real data');
    console.log('[SampleAreasPanel] Available cities:', areas.map(a => `${a.name} (${a.zipCodes.length} FSAs)`));
    
    // Create the choropleth layers on the map
    createChoroplethLayers(areas);
  };

  const createChoroplethLayers = (areas: DisplaySampleArea[]) => {
    console.log('[SampleAreasPanel] Creating city-level choropleth layers for', areas.length, 'cities');
    if (!view) {
      console.log('[SampleAreasPanel] No view available for layer creation');
      return;
    }

    // Clear any existing sample area graphics first
    clearAllSamples();

    let globalObjectId = 1;

    // Create graphics for each city
    for (const area of areas) {
      console.log(`[SampleAreasPanel] Creating layer for ${area.name} with ${area.zipCodes.length} FSAs`);
      const cityGraphics: __esri.Graphic[] = [];
      
      // Get the selected metric for coloring
      const selectedMetric = selectedMetrics[0] || 'homeownershipRate';
      
      // Collect all values for the selected metric to calculate breaks
      const values = area.zipCodes.map(zip => (zip as any)[selectedMetric]).filter(v => v !== null && v !== undefined);
      
      if (values.length === 0) {
        console.warn(`[SampleAreasPanel] No valid values for metric ${selectedMetric} in ${area.name}`);
        continue;
      }
      
      // Calculate class breaks (quartiles)
      values.sort((a, b) => a - b);
      const cityBreaks = [
        values[Math.floor(values.length * 0.25)],
        values[Math.floor(values.length * 0.5)],
        values[Math.floor(values.length * 0.75)]
      ];
      
      console.log(`[SampleAreasPanel] ${area.name} breaks for ${selectedMetric}:`, cityBreaks);
      
      // Create graphics for each FSA
      for (const zipCode of area.zipCodes) {
        try {
          const polygon = new Polygon({
            rings: zipCode.geometry.coordinates,
            spatialReference: { wkid: 4326 }
          });

          const attributes = {
            OBJECTID: globalObjectId++,
            ...zipCode
          };

          const graphic = new Graphic({
            geometry: polygon,
            attributes: attributes
          });
          
          // Assign color based on value
          const value = (zipCode as any)[selectedMetric];
          let colorIndex = 3; // Default to highest
          if (value <= cityBreaks[0]) colorIndex = 0;
          else if (value <= cityBreaks[1]) colorIndex = 1;
          else if (value <= cityBreaks[2]) colorIndex = 2;
          
          graphic.symbol = new SimpleFillSymbol({
            color: [
              parseInt(ACTIVE_COLOR_SCHEME[colorIndex].slice(1, 3), 16),
              parseInt(ACTIVE_COLOR_SCHEME[colorIndex].slice(3, 5), 16),
              parseInt(ACTIVE_COLOR_SCHEME[colorIndex].slice(5, 7), 16),
              0.6  // 60% opacity like unified repo
            ],
            outline: {
              color: [0, 0, 0, 0],
              width: 0
            }
          });
          
          cityGraphics.push(graphic);
        } catch (error) {
          console.error(`[SampleAreasPanel] Error creating graphic for FSA ${zipCode.zipCode}:`, error);
        }
      }
      
      if (cityGraphics.length > 0) {
        // Add graphics directly to map view
        view.graphics.addMany(cityGraphics);
        console.log(`[SampleAreasPanel] Added ${cityGraphics.length} graphics directly to map for ${area.name}`);
      } else {
        console.warn(`[SampleAreasPanel] No graphics created for ${area.name}`);
      }
    }
  };

  const clearAllSamples = () => {
    if (!view) return;
    
    // Remove all graphics from the view (we'll re-add what we need)
    view.graphics.removeAll();
    console.log('[SampleAreasPanel] Cleared all sample area graphics');
  };

  const handleAreaClick = (area: DisplaySampleArea) => {
    console.log(`[SampleAreasPanel] Area clicked: ${area.name}`);
    setSelectedArea(area.id);
    
    if (view && area.combinedBounds) {
      // Use predefined bookmark extents if available
      const bookmarkExtent = BOOKMARK_EXTENTS[area.name.toLowerCase()];
      const extent = bookmarkExtent ? 
        new Extent({
          xmin: bookmarkExtent.xmin,
          ymin: bookmarkExtent.ymin,
          xmax: bookmarkExtent.xmax,
          ymax: bookmarkExtent.ymax,
          spatialReference: { wkid: 4326 }
        }) :
        new Extent({
          xmin: area.combinedBounds.xmin,
          ymin: area.combinedBounds.ymin,
          xmax: area.combinedBounds.xmax,
          ymax: area.combinedBounds.ymax,
          spatialReference: { wkid: 4326 }
        });
      
      view.goTo(extent, {
        duration: 1000,
        easing: "ease-in-out"
      });
    }
  };

  const getQuickStats = (area: DisplaySampleArea) => {
    // Define metric calculators for all available housing metrics
    const metricCalculators: { [key: string]: { calculate: () => number; label: string; icon: any; format: (val: number) => string } } = {
      homeownershipRate: {
        calculate: () => Math.round((area.zipCodes.reduce((sum, zip) => sum + (zip.homeownershipRate || 0), 0) / area.zipCodes.length) * 10) / 10,
        label: 'Ownership %',
        icon: Building,
        format: (val) => `${val}%`
      },
      rentalRate: {
        calculate: () => Math.round((area.zipCodes.reduce((sum, zip) => sum + (zip.rentalRate || 0), 0) / area.zipCodes.length) * 10) / 10,
        label: 'Rental %',
        icon: Building,
        format: (val) => `${val}%`
      },
      medianIncome: {
        calculate: () => Math.round(area.zipCodes.reduce((sum, zip) => sum + (zip.medianIncome || 0), 0) / area.zipCodes.length),
        label: 'Median Income',
        icon: DollarSign,
        format: (val) => `$${(val / 1000).toFixed(0)}k`
      },
      housingValue: {
        calculate: () => Math.round(area.zipCodes.reduce((sum, zip) => sum + (zip.housingValue || 0), 0) / area.zipCodes.length),
        label: 'Housing Value',
        icon: Building,
        format: (val) => `$${(val / 1000).toFixed(0)}k`
      },
      hotGrowth: {
        calculate: () => Math.round((area.zipCodes.reduce((sum, zip) => sum + (zip.hotGrowth || 0), 0) / area.zipCodes.length) * 10) / 10,
        label: 'Hot Growth',
        icon: Users,
        format: (val) => `${val.toFixed(1)}`
      },
      newHomeowner: {
        calculate: () => Math.round((area.zipCodes.reduce((sum, zip) => sum + (zip.newHomeowner || 0), 0) / area.zipCodes.length) * 10) / 10,
        label: 'New Homeowner',
        icon: Users,
        format: (val) => `${val.toFixed(1)}`
      },
      affordability: {
        calculate: () => Math.round((area.zipCodes.reduce((sum, zip) => sum + (zip.affordability || 0), 0) / area.zipCodes.length) * 10) / 10,
        label: 'Affordability',
        icon: DollarSign,
        format: (val) => `${val.toFixed(1)}`
      },
      youngMaintainers: {
        calculate: () => Math.round((area.zipCodes.reduce((sum, zip) => sum + (zip.youngMaintainers || 0), 0) / area.zipCodes.length) * 10) / 10,
        label: 'Young Maintainers',
        icon: Users,
        format: (val) => `${val}%`
      }
    };

    // Use the randomly selected metrics to generate stats, with fallback to defaults
    const activeMetrics = selectedMetrics.length > 0 ? selectedMetrics : ['homeownershipRate', 'affordability', 'hotGrowth', 'medianIncome'];
    
    return activeMetrics.map(metricKey => {
      const calculator = metricCalculators[metricKey];
      if (!calculator) return null;
      
      const value = calculator.calculate();
      return {
        label: calculator.label,
        value: calculator.format(value),
        icon: calculator.icon
      };
    }).filter(Boolean);
  };

  if (!visible) return null;

  return (
    <div 
      ref={containerRef}
      className="widget-container esri-widget sample-areas-panel"
      style={{ 
        display: visible ? 'block' : 'none'
      }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between"
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--theme-border)',
          backgroundColor: 'var(--theme-bg-primary)',
          minHeight: '40px'
        }}
      >
        <h3 
          style={{
            margin: '0',
            fontSize: '16px',
            fontWeight: '600',
            color: '#33a852',
            lineHeight: '1.2',
            flex: '1'
          }}
        >
          Quebec Housing Markets
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTooltip(!showTooltip)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Information"
          >
            <Info className="w-4 h-4" style={{ color: 'var(--theme-text-secondary)' }} />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close panel"
          >
            <X className="w-4 h-4" style={{ color: 'var(--theme-text-secondary)' }} />
          </button>
        </div>
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div 
          className="absolute left-4 top-16 z-50 p-3 rounded-lg shadow-xl"
          style={{
            backgroundColor: 'var(--theme-bg-primary)',
            border: '1px solid var(--theme-border)',
            width: '280px'
          }}
        >
          <p className="text-sm mb-3" style={{ color: 'var(--theme-text-primary)' }}>
            Explore Quebec housing market data across major cities. Click on a city to zoom and view detailed FSA-level information.
          </p>
          
          {/* Legend */}
          <div className="border-t pt-2" style={{ borderColor: 'var(--theme-border)' }}>
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--theme-text-primary)' }}>
              Data Visualization Scale:
            </p>
            <div className="flex justify-between text-xs">
              <div className="flex items-center gap-1">
                <div 
                  className="w-3 h-3 rounded-sm"
                  style={{ 
                    backgroundColor: ACTIVE_COLOR_SCHEME[0],
                    border: '1px solid #ddd',
                    opacity: 1,
                    boxShadow: 'none',
                    backgroundClip: 'padding-box',
                    zIndex: 1,
                    position: 'relative'
                  }}
                />
                <span style={{ color: 'var(--theme-text-secondary)' }}>Lowest</span>
              </div>
              <div className="flex items-center gap-1">
                <div 
                  className="w-3 h-3 rounded-sm"
                  style={{ 
                    backgroundColor: ACTIVE_COLOR_SCHEME[1],
                    border: '1px solid #ddd',
                    opacity: 1,
                    boxShadow: 'none',
                    backgroundClip: 'padding-box',
                    zIndex: 1,
                    position: 'relative'
                  }}
                />
                <span style={{ color: 'var(--theme-text-secondary)' }}>Low</span>
              </div>
              <div className="flex items-center gap-1">
                <div 
                  className="w-3 h-3 rounded-sm"
                  style={{ 
                    backgroundColor: ACTIVE_COLOR_SCHEME[2],
                    border: '1px solid #ddd',
                    opacity: 1,
                    boxShadow: 'none',
                    backgroundClip: 'padding-box',
                    zIndex: 1,
                    position: 'relative'
                  }}
                />
                <span style={{ color: 'var(--theme-text-secondary)' }}>High</span>
              </div>
              <div className="flex items-center gap-1">
                <div 
                  className="w-3 h-3 rounded-sm"
                  style={{ 
                    backgroundColor: ACTIVE_COLOR_SCHEME[3],
                    border: '1px solid #ddd',
                    opacity: 1,
                    boxShadow: 'none',
                    backgroundClip: 'padding-box',
                    zIndex: 1,
                    position: 'relative'
                  }}
                />
                <span style={{ color: 'var(--theme-text-secondary)' }}>Highest</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8" style={{ padding: '16px' }}>
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2" 
               style={{ borderColor: 'var(--theme-accent-primary)' }} />
          <p className="mt-2 text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
            Loading housing market data...
          </p>
        </div>
      )}

      {/* Areas List */}
      {!loading && displayAreas.length > 0 && (
        <div>
          {displayAreas.map((area) => {
            const quickStats = getQuickStats(area);
            const isSelected = selectedArea === area.id;
            
            return (
              <div
                key={area.id}
                className="p-4 transition-all cursor-pointer"
                style={{
                  borderBottom: '1px solid var(--theme-border)',
                  backgroundColor: isSelected ? 'var(--theme-bg-tertiary)' : 'transparent',
                  borderLeft: isSelected ? '4px solid var(--theme-accent-primary)' : 'none'
                }}
                onClick={() => handleAreaClick(area)}
              >
                {/* Area Header */}
                <div className="mb-3">
                  <h4 className="text-xs font-medium mb-1" style={{ color: 'var(--theme-text-primary)' }}>
                    {area.name}
                  </h4>
                  <p className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
                    {area.zipCodes.length} FSAs
                  </p>
                </div>
                
                {/* Dynamic Metrics Grid */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {quickStats.map((stat, idx) => stat && (
                    <div key={idx} className="flex items-center space-x-1">
                      <stat.icon className="h-3 w-3" style={{ color: 'var(--theme-text-secondary)' }} />
                      <div>
                        <p className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
                          {stat.label}
                        </p>
                        <p className="text-xs font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                          {stat.value}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* No Data State */}
      {!loading && displayAreas.length === 0 && (
        <div className="text-center py-8" style={{ padding: '16px' }}>
          <p className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
            No sample areas available
          </p>
        </div>
      )}
    </div>
  );
}