import { DEFAULT_FILL_ALPHA } from "./constants";
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Renderer from '@arcgis/core/renderers/Renderer';
import ClassBreaksRenderer from '@arcgis/core/renderers/ClassBreaksRenderer';
import { BaseVisualization, BaseVisualizationData, VisualizationOptions, VisualizationResult } from './base-visualization';
import Color from '@arcgis/core/Color';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import axios from 'axios';
import Field from '@arcgis/core/layers/support/Field';
import Collection from '@arcgis/core/core/Collection';
import Graphic from '@arcgis/core/Graphic';
import RangeDomain from '@arcgis/core/layers/support/RangeDomain';
import Query from '@arcgis/core/rest/support/Query';
import { StandardizedLegendData } from '@/types/legend';
import { FieldMappingHelper } from './field-mapping-helper';

export interface TrendsData extends BaseVisualizationData {
  keyword: string;
  timeframe?: string;
  geo?: string;
  category?: string;
  resolution?: 'COUNTRY' | 'REGION' | 'CITY' | 'DMA' | 'METRO';
  searchType?: 'web' | 'images' | 'news' | 'youtube' | 'shopping';
  results?: {
    date: string;
    value: number;
  }[];
  geoData?: {
    geo: string;
    geoName: string;
    value: number;
    coordinates: number[] | null;
  }[];
  searchMetadata?: {
    id: string;
    status: string;
    created_at: string;
    processed_at: string;
  };
  formattedMessage?: string;
}

export class TrendsVisualization extends BaseVisualization<TrendsData> {
  protected renderer: Renderer;
  protected title: string = 'Google Trends Analysis';
  private readonly STATSCAN_URL = 'https://geo.statcan.gc.ca/geo_wa/rest/services/2021/Cartographic_boundary_files/MapServer/9';

  constructor() {
    super();
    this.renderer = new ClassBreaksRenderer({
      field: "value",
      defaultSymbol: new SimpleFillSymbol({
        color: new Color([200, 200, 200, 0.5]),
        outline: {
          color: new Color([128, 128, 128, 1]),
          width: 1
        }
      }),
      classBreakInfos: [
        { 
          minValue: 0, 
          maxValue: 25, 
          symbol: new SimpleFillSymbol({
            color: new Color([239, 59, 44, 1]),
            outline: {
              color: new Color([128, 128, 128, 1]),
              width: 1
            }
          })
        },
        { 
          minValue: 25, 
          maxValue: 50, 
          symbol: new SimpleFillSymbol({
            color: new Color([255, 127, 0, 1]),
            outline: {
              color: new Color([128, 128, 128, 1]),
              width: 1
            }
          })
        },
        { 
          minValue: 50, 
          maxValue: 75, 
          symbol: new SimpleFillSymbol({
            color: new Color([158, 215, 152, 1]),
            outline: {
              color: new Color([128, 128, 128, 1]),
              width: 1
            }
          })
        },
        { 
          minValue: 75, 
          maxValue: 100, 
          symbol: new SimpleFillSymbol({
            color: new Color([49, 163, 84, 1]),
            outline: {
              color: new Color([128, 128, 128, 1]),
              width: 1
            }
          })
        }
      ]
    });
  }

  async create(data: TrendsData, options: VisualizationOptions = {}): Promise<VisualizationResult> {
    try {
      console.log('TrendsVisualization.create called with data:', {
        keyword: data.keyword,
        geoDataLength: data.geoData?.length,
        timeSeriesLength: data.results?.length
      });

      // Store the data for later use
      this.data = data;

      // Update the layer title to be more descriptive
      this.title = `Search Interest: ${data.keyword}`;

      // Create the feature layer with improved popup template and visibility settings
      const layer = new FeatureLayer({
        source: [],  // Start with empty source
        title: this.title,
        visible: true,
        opacity: 0.8,
        objectIdField: "OBJECTID",
        geometryType: "polygon",
        spatialReference: { wkid: 102100 },
        fields: [
          {
            name: "OBJECTID",
            type: "oid"
          },
          {
            name: "CSDNAME",
            type: "string"
          },
          {
            name: "CSDUID",
            type: "string"
          },
          {
            name: "value",
            type: "double"
          }
        ],
        popupTemplate: {
          title: "{CSDNAME}",
          content: [
            {
              type: "text",
              text: "Search interest for '{CSDNAME}' relative to other cities"
            },
            {
              type: "fields",
              fieldInfos: [
                {
                  fieldName: "value",
                  label: "Interest Level",
                  format: {
                    places: 0,
                    digitSeparator: true
                  }
                }
              ]
            }
          ]
        }
      });

      // Create a reference layer to query features from
      const referenceLayer = new FeatureLayer({
        url: this.STATSCAN_URL,
        outFields: ['*']
      });

      // Wait for reference layer to load
      await referenceLayer.load();
      console.log('Reference layer loaded');

      // Check if we have any data at all
      if (!data.geoData?.length) {
        console.error('No geographic data available from SerpApi');
        throw new Error('No trends data available for this search term');
      }

      // Store all cities and their values
      const allCityValues = new Map<string, number>();
      data.geoData.forEach(point => {
        if (point.geoName && point.value !== undefined) {
          allCityValues.set(point.geoName, point.value);
          console.log(`Added city: ${point.geoName} with value: ${point.value}`);
        }
      });

      // Create a base query
      const query = new Query({
        outFields: ['*'],
        returnGeometry: true,
        where: "PRUID = '35'",  // Filter to Ontario
        outSpatialReference: { wkid: 102100 }
      });

      // Query all features first
      const results = await referenceLayer.queryFeatures(query);
      console.log('Query results:', {
        featureCount: results.features.length,
        fields: results.fields?.map(f => ({ name: f.name, alias: f.alias }))
      });

      const features = results.features;
      const processedFeatures: Graphic[] = [];
      const processedCities = new Map<string, boolean>();
      const unmatchedCities: string[] = [];

      // Log sample feature attributes to see available fields
      if (features.length > 0) {
        console.log('Sample feature attributes:', {
          availableFields: Object.keys(features[0].attributes),
          sampleValues: {
            CSDNAME: features[0].attributes.CSDNAME,
            CSDUID: features[0].attributes.CSDUID,
            CSDTYPE: features[0].attributes.CSDTYPE,
            PRNAME: features[0].attributes.PRNAME
          }
        });
      }

      // Add known municipality mappings
      const municipalityMappings: { [key: string]: { municipality: string; type: string } } = {
        'Cobden': { municipality: 'Whitewater Region', type: 'township' },
        'Kemptville': { municipality: 'North Grenville', type: 'municipality' }
      };

      // Keep track of city to municipality mappings for the UI
      const cityToMunicipalityMap = new Map<string, { municipality: string; csduid: string }>();

      // Process each city from trends data
      for (const [cityName, value] of allCityValues.entries()) {
        let matched = false;

        // Check if this city has a known mapping
        const mappedInfo = municipalityMappings[cityName];
        if (mappedInfo) {
          console.log(`Using known mapping for ${cityName}: ${mappedInfo.municipality}`);
          // Try to find the mapped municipality
          const mappedMatches = features.filter(f => {
            const csdName = f.attributes?.CSDNAME;
            return csdName && typeof csdName === 'string' && 
                   csdName.toLowerCase() === mappedInfo.municipality.toLowerCase();
          });

          if (mappedMatches.length > 0) {
            const feature = mappedMatches[0];
            const clonedFeature = feature.clone();
            // Store the original city name in the attributes for display
            clonedFeature.attributes = {
              OBJECTID: processedFeatures.length + 1,
              CSDNAME: feature.attributes.CSDNAME,
              CSDUID: feature.attributes.CSDUID,
              value: value,
              originalCity: cityName  // Add this to track the original city name
            };
            processedFeatures.push(clonedFeature);
            processedCities.set(cityName, true);
            // Store the mapping for UI
            cityToMunicipalityMap.set(cityName, {
              municipality: feature.attributes.CSDNAME,
              csduid: feature.attributes.CSDUID
            });
            matched = true;
            console.log(`Matched ${cityName} to municipality: ${feature.attributes.CSDNAME} (${feature.attributes.CSDTYPE})`);
            continue;
          }
        }

        // Log all features that might contain this city name
        const potentialMatches = features.filter(f => {
          const csdName = f.attributes?.CSDNAME;
          const csdType = f.attributes?.CSDTYPE;
          const csduid = f.attributes?.CSDUID;
          
          // Log more details about potential matches
          if (csdName && typeof csdName === 'string' && 
              (csdName.toLowerCase().includes(cityName.toLowerCase()) ||
               cityName.toLowerCase().includes(csdName.toLowerCase()))) {
            console.log(`Potential match details for ${cityName}:`, {
              CSDNAME: csdName,
              CSDTYPE: csdType,
              CSDUID: csduid,
              matchType: csdName.toLowerCase() === cityName.toLowerCase() ? 'exact' :
                        csdName.toLowerCase().includes(cityName.toLowerCase()) ? 'contains' :
                        'partial'
            });
          }
          
          return csdName && typeof csdName === 'string' && 
                 (csdName.toLowerCase().includes(cityName.toLowerCase()) ||
                  cityName.toLowerCase().includes(csdName.toLowerCase()));
        });

        // Try exact match first
        const exactMatches = features.filter(f => {
          const csdName = f.attributes?.CSDNAME;
          if (csdName && typeof csdName === 'string') {
            const isMatch = csdName.toLowerCase() === cityName.toLowerCase();
            if (isMatch) {
              console.log(`Found exact match: "${csdName}" = "${cityName}" (Type: ${f.attributes.CSDTYPE})`);
            }
            return isMatch;
          }
          return false;
        });

        if (exactMatches.length > 0) {
          exactMatches.forEach(feature => {
            const clonedFeature = feature.clone();
            clonedFeature.attributes = {
              OBJECTID: processedFeatures.length + 1,
              CSDNAME: feature.attributes.CSDNAME,
              CSDUID: feature.attributes.CSDUID,
              value: value
            };
            processedFeatures.push(clonedFeature);
            processedCities.set(cityName, true);
          });
          matched = true;
          console.log(`Exact match found for: ${cityName}`);
        }

        // If no exact match, try partial match with additional context
        if (!matched) {
          const partialMatches = features.filter(f => {
            const csdName = f.attributes?.CSDNAME;
            const csdType = f.attributes?.CSDTYPE;
            if (csdName && typeof csdName === 'string') {
              // Enhanced matching strategies
              const isPartialMatch = 
                // Direct inclusion
                csdName.toLowerCase().includes(cityName.toLowerCase()) ||
                cityName.toLowerCase().includes(csdName.toLowerCase()) ||
                // Check if city is part of a township/municipality
                csdName.toLowerCase().includes(cityName.toLowerCase() + ' township') ||
                csdName.toLowerCase().includes(cityName.toLowerCase() + ' municipality') ||
                // Check for village designation
                csdName.toLowerCase().includes(cityName.toLowerCase() + ' village') ||
                // Check for variations with 'town of' prefix
                csdName.toLowerCase().includes('town of ' + cityName.toLowerCase()) ||
                // Remove common suffixes for comparison
                csdName.toLowerCase().replace(/ (township|municipality|city|town|village|county)$/, '') === cityName.toLowerCase() ||
                // Check for incorporated places
                csdName.toLowerCase().replace(/^(township of|town of|village of|municipality of|county of) /, '') === cityName.toLowerCase();
              
              if (isPartialMatch) {
                console.log(`Found partial match: "${csdName}" (Type: ${csdType}) matches "${cityName}" using enhanced matching`);
              }
              return isPartialMatch;
            }
            return false;
          });

          if (partialMatches.length > 0) {
            // Sort partial matches by length and type
            const typeOrder = ['CY', 'T', 'VL', 'TV', 'TP', 'M', 'MU']; // City, Town, Village, Town Village, Township, Municipality
            const sortedMatches = partialMatches.sort((a, b) => {
              const aName = a.attributes.CSDNAME;
              const bName = b.attributes.CSDNAME;
              // Prefer shorter names (more likely to be the core municipality)
              if (aName.length !== bName.length) {
                return aName.length - bName.length;
              }
              // If lengths are equal, prefer certain types
              const aTypeIndex = typeOrder.indexOf(a.attributes.CSDTYPE);
              const bTypeIndex = typeOrder.indexOf(b.attributes.CSDTYPE);
              return aTypeIndex - bTypeIndex;
            });

            // Log all potential matches for debugging
            console.log(`Sorted matches for ${cityName}:`, sortedMatches.map(m => ({
              CSDNAME: m.attributes.CSDNAME,
              CSDTYPE: m.attributes.CSDTYPE,
              score: typeOrder.indexOf(m.attributes.CSDTYPE)
            })));

            // Use the best match
            const bestMatch = sortedMatches[0];
            const clonedFeature = bestMatch.clone();
            clonedFeature.attributes = {
              OBJECTID: processedFeatures.length + 1,
              CSDNAME: bestMatch.attributes.CSDNAME,
              CSDUID: bestMatch.attributes.CSDUID,
              value: value
            };
            processedFeatures.push(clonedFeature);
            processedCities.set(cityName, true);
            matched = true;
            console.log(`Using best match for ${cityName}: ${bestMatch.attributes.CSDNAME} (${bestMatch.attributes.CSDTYPE})`);
            }
          }

          if (!matched) {
          unmatchedCities.push(cityName);
          console.log(`No match found for: ${cityName}. Available types in area:`, 
            features
              .filter(f => f.attributes.CSDNAME?.toLowerCase().includes(cityName.substring(0, 3).toLowerCase()))
              .map(f => ({
                CSDNAME: f.attributes.CSDNAME,
                CSDTYPE: f.attributes.CSDTYPE,
                CSDUID: f.attributes.CSDUID
              }))
          );
        }
      }

      // Calculate quartiles for the values
      const values = Array.from(allCityValues.values()).sort((a, b) => a - b);
      const q1Index = Math.floor(values.length * 0.25);
      const q2Index = Math.floor(values.length * 0.5);
      const q3Index = Math.floor(values.length * 0.75);
      
      const quartiles = {
        q1: values[q1Index],
        q2: values[q2Index],
        q3: values[q3Index]
      };

      console.log('Quartile values:', quartiles);

      // Import createQuartileRenderer
      const { createQuartileRenderer } = await import('../createQuartileRenderer');
      
      // Set source first so the layer has data for the renderer to query
      layer.source = new Collection(processedFeatures);
      
      // Set layer metadata to indicate this is a Google Trends layer
      layer.set('metadata', {
        isGoogleTrendsLayer: true,
        valueType: 'interest',
        valueField: 'value'
      });
      
      // Add field mapping to ensure renderer can find the value field
      layer.set('fieldsMap', { 
        thematic_value: 'value' 
      });
      
      // Use the createQuartileRenderer function for consistent rendering
      console.log('[TrendsVisualization] Creating quartile renderer');
      const rendererResult = await createQuartileRenderer({
        layer: layer,
        field: 'value',
        opacity: 0.7,
        outlineWidth: 0.5,
        outlineColor: [128, 128, 128],
        isCompositeIndex: false
      });
      
      if (rendererResult && rendererResult.renderer) {
        console.log('[TrendsVisualization] Successfully created quartile renderer');
        layer.renderer = rendererResult.renderer;
        this.renderer = rendererResult.renderer;
      } else {
        console.error('[TrendsVisualization] Failed to create quartile renderer, falling back to manual renderer');
        
        // Fallback to manual renderer if createQuartileRenderer fails
        const fallbackRenderer = new ClassBreaksRenderer({
          field: "value",
          defaultSymbol: new SimpleFillSymbol({
            color: new Color([200, 200, 200, 0.5]),
            outline: {
              color: new Color([128, 128, 128, 1]),
              width: 1
            }
          }),
          classBreakInfos: [
            {
              minValue: 0,
              maxValue: quartiles.q1,
              symbol: new SimpleFillSymbol({
                color: new Color([239, 59, 44, DEFAULT_FILL_ALPHA]),
                outline: {
                  color: new Color([128, 128, 128, 1]),
                  width: 1
                }
              })
            },
            {
              minValue: quartiles.q1,
              maxValue: quartiles.q2,
              symbol: new SimpleFillSymbol({
                color: new Color([255, 127, 0, DEFAULT_FILL_ALPHA]),
                outline: {
                  color: new Color([128, 128, 128, 1]),
                  width: 1
                }
              })
            },
            {
              minValue: quartiles.q2,
              maxValue: quartiles.q3,
              symbol: new SimpleFillSymbol({
                color: new Color([158, 215, 152, DEFAULT_FILL_ALPHA]),
                outline: {
                  color: new Color([128, 128, 128, 1]),
                  width: 1
                }
              })
            },
            {
              minValue: quartiles.q3,
              maxValue: Math.max(...values),
              symbol: new SimpleFillSymbol({
                color: new Color([49, 163, 84, DEFAULT_FILL_ALPHA]),
                outline: {
                  color: new Color([128, 128, 128, 1]),
                  width: 1
                }
              })
            }
          ]
        });
        
        layer.renderer = fallbackRenderer;
        this.renderer = fallbackRenderer;
      }

      // Store the layer and extent
      this.layer = layer;
      this.extent = processedFeatures[0]?.geometry?.extent?.clone() ?? null;

      // If we have multiple features, expand the extent
      if (processedFeatures.length > 1) {
        for (let i = 1; i < processedFeatures.length; i++) {
          const extent = processedFeatures[i].geometry?.extent;
          if (extent && this.extent) {
            this.extent.union(extent);
          }
        }
      }

      // Expand the extent slightly for better visibility
      if (this.extent) {
        this.extent.expand(1.5);
      }

      // Format the message to include ALL cities with clickable names and proper mapping info
      const sortedCities = Array.from(allCityValues.entries())
        .sort(([, a], [, b]) => b - a);

      const topCities = sortedCities.slice(0, 5);
      const bottomCities = sortedCities.slice(-5).reverse();

      const formattedMessage = `Search interest for "${data.keyword}":

Top 5 Cities by Interest:
${topCities.map(([city, value], index) => {
  const mappingInfo = cityToMunicipalityMap.get(city);
  const displayInfo = mappingInfo ? ` (part of ${mappingInfo.municipality})` : '';
  const cityId = processedFeatures.find(f => 
    f.attributes.CSDNAME.toLowerCase() === city.toLowerCase() ||
    f.attributes.originalCity === city
  )?.attributes.CSDUID || '';
  
  return `${index + 1}. <button class="clickable-text" data-city-id="${cityId}" data-city-name="${city}">${city}</button>: ${Math.round(value)}${displayInfo}`;
}).join('\n')}

Cities with Lowest Interest:
${bottomCities.filter(([city]) => !topCities.some(([topCity]) => topCity === city))
  .slice(0, 5)
  .map(([city, value], index) => {
    const mappingInfo = cityToMunicipalityMap.get(city);
    const displayInfo = mappingInfo ? ` (part of ${mappingInfo.municipality})` : '';
    const cityId = processedFeatures.find(f => 
      f.attributes.CSDNAME.toLowerCase() === city.toLowerCase() ||
      f.attributes.originalCity === city
    )?.attributes.CSDUID || '';
    
    return `${index + 1}. <button class="clickable-text" data-city-id="${cityId}" data-city-name="${city}">${city}</button>: ${Math.round(value)}${displayInfo}`;
  }).join('\n')}

Time Period: ${data.timeframe || 'past 30 days'}
Search Type: ${data.searchType || 'web'}
${data.category !== '0' ? `Category: ${data.category}` : ''}

The visualization shows relative search interest across different cities in Ontario:
⬛ Low (0-${Math.round(quartiles.q1)})
⬛ Medium-Low (${Math.round(quartiles.q1)}-${Math.round(quartiles.q2)})
⬛ Medium-High (${Math.round(quartiles.q2)}-${Math.round(quartiles.q3)})
⬛ High (${Math.round(quartiles.q3)}-100)${
unmatchedCities.length > 0 ? `\n\nNote: Some cities (${unmatchedCities.join(', ')}) are shown with approximate locations based on their regions.` : ''
}`;

      // Store the formatted message
      this.data.formattedMessage = formattedMessage;

      // Return with explicit visibility settings
      return {
        layer: this.layer,
        extent: this.extent,
        renderer: this.renderer,
        legendInfo: this.getLegendInfo(),
        options: {
          visible: true,
          opacity: 0.8
        }
      };

    } catch (error) {
      console.error('Error creating trends visualization:', error);
      throw error;
    }
  }

  private buildDefinitionExpression(cityValues: Map<string, number>): string {
    const cityNames = Array.from(cityValues.keys())
      .map(name => `'${name}'`)
      .join(',');
    return `LOWER(CSDNAME) IN (${cityNames})`;
  }

  getLegendInfo(): StandardizedLegendData {
    // Use standardized field mapping for keyword
    const friendlyKeyword = this.data?.keyword ? FieldMappingHelper.getFriendlyFieldName(this.data.keyword) : 'Search Interest';
    
    return {
      title: friendlyKeyword,
      type: "class-breaks",
      description: `Trends analysis for ${this.data?.timeframe || 'time period'} in ${this.data?.geo || 'location'}`,
      items: [{
        label: 'Trend',
        color: 'rgba(0, 116, 217, DEFAULT_FILL_ALPHA)',
        shape: 'square',
        size: 16
      }]
    };
  }
}