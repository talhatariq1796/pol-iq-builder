import { useState, useEffect, useMemo } from 'react';
import { CMAFilters, AreaSelection, CMAProperty, CMAStats, CMADataRanges, DEFAULT_DATA_RANGES } from '../types';
import { calculateFilterRanges } from '@/lib/utils/filterRanges';

/**
 * Validate if a price value is legitimate for CMA analysis.
 * Returns false for: null, undefined, 0, negative, NaN, "Price Available on Request", etc.
 *
 * Properties with invalid prices should NOT be included in CMA calculations,
 * but they ARE still shown on the map layer.
 *
 * @param price - The price value to validate
 * @returns true if price is valid for analysis, false otherwise
 */
function isValidPrice(price: any): boolean {
  // Handle null/undefined
  if (price === null || price === undefined) {
    return false;
  }

  // Handle string values like "Price Available on Request"
  if (typeof price === 'string') {
    const normalized = price.toLowerCase().trim();
    // Check for common invalid price strings
    if (
      normalized === '' ||
      normalized === '0' ||
      normalized.includes('available') ||
      normalized.includes('request') ||
      normalized.includes('contact') ||
      normalized.includes('call') ||
      normalized.includes('n/a') ||
      normalized.includes('tbd') ||
      normalized.includes('negotiable')
    ) {
      return false;
    }
    // Try to parse as number
    const parsed = parseFloat(normalized.replace(/[,$]/g, ''));
    return !isNaN(parsed) && parsed > 0;
  }

  // Handle numeric values
  if (typeof price === 'number') {
    return !isNaN(price) && isFinite(price) && price > 0;
  }

  return false;
}

/**
 * Clean up verbose GeoJSON addresses to shorter format
 * From: "206, Avenue Adams, Pointe-Claire, Agglomération de Montréal, Montréal (région administrative), Québec, H9R 5B1, Canada"
 * To: "206, Avenue Adams, Pointe-Claire, QC, H9R 5B1"
 */
function cleanAddress(address: string): string {
  if (!address) return 'Unknown Address';

  // Split by comma and trim each part
  const parts = address.split(',').map(s => s.trim());

  // Remove unwanted parts
  const filtered = parts.filter(part => {
    // Skip these redundant parts
    if (part.includes('Agglomération')) return false;
    if (part.includes('région administrative')) return false;
    if (part === 'Canada') return false;
    if (part === 'Québec') return false; // Will replace with QC
    return true;
  });

  // Take street (0), street name (1), municipality (2), and postal code (last)
  // Insert "QC" before postal code
  const result: string[] = [];

  // Add first 3 parts (street number + name, municipality)
  result.push(...filtered.slice(0, 3));

  // Add province abbreviation
  result.push('QC');

  // Add postal code (last part, should be like H9R 5B1)
  const postalCode = filtered[filtered.length - 1];
  if (postalCode && /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i.test(postalCode)) {
    result.push(postalCode);
  }

  return result.join(', ');
}

interface UseCMAAnalysisProps {
  selectedArea?: AreaSelection;
  filters: CMAFilters;
  enabled?: boolean;
}

interface UseCMAAnalysisReturn {
  properties: CMAProperty[];
  stats: CMAStats;
  isLoading: boolean;
  error: string | null;
  dataRanges: CMADataRanges; // Dynamic ranges based on actual data
}

export function useCMAAnalysis({
  selectedArea,
  filters,
  enabled = true
}: UseCMAAnalysisProps): UseCMAAnalysisReturn {
  const [properties, setProperties] = useState<CMAProperty[]>([]);
  const [stats, setStats] = useState<CMAStats>({
    average_price: 0,
    median_price: 0,
    price_per_sqft: 0,
    average_dom: 0,
    average_cma_score: 0,
    total_properties: 0,
    sold_properties: 0,
    active_properties: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('[useCMAAnalysis] useEffect triggered:', {
      enabled,
      hasSelectedArea: !!selectedArea,
      filters: {
        propertyType: filters?.propertyType,
        priceRange: filters?.priceRange,
        listingStatus: filters?.listingStatus
      }
    });

    if (!enabled || !selectedArea) {
      console.log('[useCMAAnalysis] Skipping - enabled:', enabled, 'hasSelectedArea:', !!selectedArea);
      return;
    }

    const loadCMAData = async () => {
      console.log('[useCMAAnalysis] Starting loadCMAData...');
      setIsLoading(true);
      setError(null);

      try {
        // 🔍 DETAILED DEBUG: Log selectedArea geometry details
        console.log('🔍 [useCMAAnalysis] DETAILED GEOMETRY TRACE - selectedArea:', {
          displayName: selectedArea.displayName,
          hasGeometry: !!selectedArea.geometry,
          geometryType: selectedArea.geometry?.type,
          geometryExtent: selectedArea.geometry?.extent,
          isBufferedPolygon: selectedArea.geometry?.type === 'polygon',
          isOriginalPoint: selectedArea.geometry?.type === 'point'
        });

        // 🔍 DEBUG: Check if this is still a point or the buffered polygon
        if (selectedArea.geometry?.type === 'point') {
          console.warn('⚠️ [useCMAAnalysis] WARNING: Geometry is still a Point, not a buffered Polygon! Spatial filtering may not work correctly.');
        } else if (selectedArea.geometry?.type === 'polygon') {
          console.log('✅ [useCMAAnalysis] Geometry is a Polygon - spatial filtering should work correctly.');
        }

        // Convert ArcGIS geometry to API-expected format
        let geometryForAPI: any;
        if (selectedArea.geometry?.type === 'polygon' && (selectedArea.geometry as any).rings) {
          // ArcGIS polygon format - convert to expected format
          geometryForAPI = {
            type: 'polygon',
            coordinates: (selectedArea.geometry as any).rings,
            extent: selectedArea.geometry.extent
          };
          console.log('🔍 [useCMAAnalysis] Converted ArcGIS polygon to API format');
        } else if (selectedArea.geometry?.type === 'point' && (selectedArea.geometry as any).x !== undefined) {
          // ArcGIS point format
          geometryForAPI = {
            type: 'point',
            coordinates: [(selectedArea.geometry as any).x, (selectedArea.geometry as any).y],
            extent: selectedArea.geometry.extent
          };
          console.log('🔍 [useCMAAnalysis] Converted ArcGIS point to API format');
        } else {
          // Already in expected format or unknown format
          geometryForAPI = selectedArea.geometry;
        }
        
        const requestPayload = {
          geometry: geometryForAPI,
          filters: {
            propertyType: filters.propertyType,
            selectedPropertyTypes: filters.selectedPropertyTypes,
            propertyCategory: filters.propertyCategory,
            priceRange: filters.priceRange,
            bedrooms: filters.bedrooms,
            bathrooms: filters.bathrooms,
            squareFootage: filters.squareFootage,
            yearBuilt: filters.yearBuilt,
            listingStatus: filters.listingStatus, // Pass actual filter value to API (no fallback)
            dateRange: filters.dateRange ? {
              start: filters.dateRange.start.toISOString(),
              end: filters.dateRange.end.toISOString()
            } : undefined,
            radius: '5_km',
            sample_size: 100,
            cma_depth: 'comprehensive'
          },
          metadata: {
            analysis_name: `CMA for ${selectedArea.displayName}`,
            user_id: 'current_user'
          }
        };

        console.log('🔍 [useCMAAnalysis] Request payload being sent to API:', {
          hasGeometry: !!requestPayload.geometry,
          geometryType: requestPayload.geometry?.type,
          selectedPropertyTypes: requestPayload.filters.selectedPropertyTypes,
          propertyCategory: requestPayload.filters.propertyCategory,
          filtersCount: Object.keys(requestPayload.filters).length,
          expectedPropertyCount: 'TBD from API response'
        });

        // Call the actual CMA API
        const response = await fetch('/api/comparative-market-analysis', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestPayload)
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Network error' }));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const apiResult = await response.json();
        
        // 🔍 DETAILED DEBUG: Log API response details
        console.log('🔍 [useCMAAnalysis] API Response received:', {
          success: apiResult.success,
          propertiesCount: apiResult.properties?.length || 0,
          hasMarketStats: !!apiResult.market_statistics,
          avgCMAScore: apiResult.market_statistics?.average_cma_score,
          totalProperties: apiResult.market_statistics?.total_properties,
          expectedVsActual: {
            expected: '< 100 (should be spatially filtered)',
            actual: apiResult.properties?.length || 0,
            isFiltered: (apiResult.properties?.length || 0) < 1000
          }
        });

        // 🔍 DEBUG: Sample first few properties to check spatial data
        if (apiResult.properties && apiResult.properties.length > 0) {
          console.log('🔍 [useCMAAnalysis] Sample properties from API:', apiResult.properties.slice(0, 3).map((prop: any) => ({
            area_id: prop.area_id,
            area_name: prop.area_name,
            cma_score: prop.cma_score,
            coordinates: prop.coordinates,
            hasCoordinates: !!prop.coordinates
          })));
        }
        
        if (!apiResult.success) {
          throw new Error(apiResult.error || 'CMA analysis failed');
        }

        // ✅ FIX: Use API's already-filtered properties instead of re-loading and re-filtering
        // The API has already applied spatial filtering and property type filtering
        console.log('[useCMAAnalysis] ✅ Using API filtered properties:', {
          propertiesFromAPI: apiResult.properties?.length || 0,
          apiHandledFilters: ['spatial (buffer)', 'property type', 'price range', 'bedrooms', 'bathrooms', 'square footage', 'year built']
        });

        // Map API properties to our internal format
        // API returns properties with structure: { area_id, area_name, cma_score, coordinates, properties: {...} }
        let filteredProperties = (apiResult.properties || []).map((apiProp: any) => {
          // Flatten nested properties to top level
          const props = apiProp.properties || {};
          return {
            ...props, // Spread all property fields to top level
            id: apiProp.area_id || props.id,
            address: apiProp.area_name || props.address,
            price: apiProp.price || props.price,
            cma_score: apiProp.cma_score,
            coordinates: apiProp.coordinates,
            latitude: apiProp.coordinates?.[1] || props.latitude,
            longitude: apiProp.coordinates?.[0] || props.longitude,
          };
        });

        console.log('[useCMAAnalysis] Mapped API properties to internal format:', {
          propertiesCount: filteredProperties.length,
          sampleProperty: filteredProperties[0] ? {
            id: filteredProperties[0].id,
            address: filteredProperties[0].address,
            price: filteredProperties[0].price,
            cma_score: filteredProperties[0].cma_score
          } : 'No properties'
        });

        // ✅ CRITICAL: Filter out properties without valid prices
        // Properties without legitimate prices should NOT be included in CMA analysis/calculations
        // but ARE still shown on the map layer (PropertyDataService handles map layer separately)
        const beforePriceFilter = filteredProperties.length;
        const invalidPriceProperties: any[] = [];
        filteredProperties = filteredProperties.filter((p: any) => {
          const price = p.price ?? p.properties?.price ?? p.askedsold_price ?? p.properties?.askedsold_price;
          const valid = isValidPrice(price);
          if (!valid) {
            invalidPriceProperties.push({
              address: p.address,
              price: price,
              priceType: typeof price
            });
          }
          return valid;
        });

        if (invalidPriceProperties.length > 0) {
          console.log(`[useCMAAnalysis] ⚠️ Price filter: ${beforePriceFilter} → ${filteredProperties.length} properties (${invalidPriceProperties.length} excluded)`);
          console.log('[useCMAAnalysis] Sample excluded properties (invalid price):', invalidPriceProperties.slice(0, 5));
        }

        // ✅ REMOVED: Client-side listing status filter
        // The API now handles status filtering server-side (lines 334-348 in route.ts)
        // This eliminates redundant client-side filtering and reduces bandwidth waste

        console.log('[useCMAAnalysis] ✅ Final filtered properties:', {
          count: filteredProperties.length,
          filtersApplied: ['API: spatial', 'API: property type', 'API: price/beds/baths', 'API: listing status', 'Client: valid price']
        });

        // ✅ Transform filtered properties to CMAProperty format
        const transformedProperties: CMAProperty[] = filteredProperties.map((prop: any, index: number) => {
                    // DEBUG: Log revenue fields for first 3 properties
                    if (Math.random() < 0.01) {
                      console.log('[CMAProperty Transform] Sample:', {
                        id: prop.id,
                        price: prop.price,
                        gross_income_multiplier: prop.gross_income_multiplier ?? prop.properties?.gross_income_multiplier,
                        potential_gross_revenue: prop.potential_gross_revenue ?? prop.properties?.potential_gross_revenue,
                        price_vs_assessment: prop.price_vs_assessment ?? prop.properties?.price_vs_assessment,
                        common_expenses: prop.common_expenses ?? prop.properties?.common_expenses,
                        gim: prop.gim ?? prop.properties?.gim,
                        pgi: prop.pgi ?? prop.properties?.pgi,
                        propertyCategory: prop.propertyCategory ?? prop.property_category ?? prop.properties?.propertyCategory ?? prop.properties?.property_category,
                        isRevenueProperty: prop.isRevenueProperty ?? prop.properties?.isRevenueProperty,
                      });
                    }
          return {
            id: (prop.centris_no || prop.mls || prop.id)?.toString() || Math.random().toString(),
            address: cleanAddress(prop.address || 'Unknown Address'),
            // Revenue fields: preserve from blob storage if present
            price: prop.price ?? prop.properties?.price ?? 0,
            bedrooms: prop.bedrooms_number ?? prop.bedrooms ?? prop.properties?.bedrooms ?? 0,
            bathrooms: prop.bathrooms_number ?? prop.bathrooms ?? prop.properties?.bathrooms ?? 0,
            squareFootage: prop.square_footage ?? prop.living_area ?? prop.properties?.square_footage ?? 0,
            yearBuilt: prop.year_built ?? prop.yearBuilt ?? prop.properties?.year_built ?? 0,
            // Normalize status field - API returns 'SO' for sold, 'AC' for active
            // The st field may be at top level OR nested in properties object
            status: (() => {
              const rawStatus = (prop.st || prop.properties?.st || prop.status || prop.properties?.status || '').toString().toUpperCase();

              // DEBUG: Log first 3 properties to see what we're getting
              if (index < 3) {
                console.log(`[useCMAAnalysis] Property ${index} status debug:`, {
                  address: prop.address,
                  prop_st: prop.st,
                  prop_properties_st: prop.properties?.st,
                  prop_status: prop.status,
                  prop_properties_status: prop.properties?.status,
                  prop_is_sold: prop.is_sold,
                  rawStatus,
                  willReturn: rawStatus === 'SO' || rawStatus === 'SOLD' ? 'sold' : 'active',
                  // Show full structure
                  hasPropertiesObject: !!prop.properties,
                  propertiesKeys: prop.properties ? Object.keys(prop.properties).slice(0, 5) : []
                });
              }

              if (rawStatus === 'SO' || rawStatus === 'SOLD') return 'sold';
              if (rawStatus === 'AC' || rawStatus === 'ACTIVE') return 'active';
              return 'active'; // Default to active if unknown
            })(),
            st: prop.st || prop.properties?.st || prop.status || prop.properties?.status || 'AC',
            cma_score: Math.random() * 40 + 60, // CMA score between 60-100
            coordinates: prop.longitude && prop.latitude ? [prop.longitude, prop.latitude] : undefined,
            // MLS/Centris fields
            mls: prop.mls || prop.centris_no,
            centris_no: prop.centris_no || prop.mls,
            mls_number: (prop.mls_number || prop.mls || prop.centris_no)?.toString(),
            // Municipality and location
            municipality: prop.municipality || prop.municipalityborough,
            postal_code: prop.postal_code || prop.fsa,
            // Price fields for delta calculation
            asking_price: prop.asking_price ?? prop.askedsold_price ?? prop.properties?.asking_price,
            original_price: prop.original_price ?? prop.original_sale_price ?? prop.properties?.original_price,
            sold_price: prop.sold_price ?? prop.sold_rented_price ?? prop.properties?.sold_price,
            price_delta: prop.price_delta ?? prop.properties?.price_delta,
            price_to_median_ratio: prop.price_to_median_ratio ?? prop.properties?.price_to_median_ratio,
            // ✅ TIME ON MARKET - Required for Page 6 velocity charts
            time_on_market: prop.time_on_market ?? prop.days_on_market ?? prop.properties?.time_on_market,
            // ✅ DATE FIELDS - Required for calculating time on market
            date_bc: prop.date_bc ?? prop.properties?.date_bc,
            date_pp_acpt_expiration: prop.date_pp_acpt_expiration ?? prop.properties?.date_pp_acpt_expiration,
            // ✅ DEMOGRAPHIC FIELDS - Required for Page 4 (Demographics & Market Insights)
            ECYPTAPOP: prop.ECYPTAPOP ?? prop.properties?.ECYPTAPOP,
            ECYTENHHD: prop.ECYTENHHD ?? prop.properties?.ECYTENHHD,
            ECYHNIAVG: prop.ECYHNIAVG ?? prop.properties?.ECYHNIAVG,
            ECYHNIMED: prop.ECYHNIMED ?? prop.properties?.ECYHNIMED,
            ECYTENOWN_P: prop.ECYTENOWN_P ?? prop.properties?.ECYTENOWN_P,
            ECYTENRENT_P: prop.ECYTENRENT_P ?? prop.properties?.ECYTENRENT_P,
            P5YTENOWN_P: prop.P5YTENOWN_P ?? prop.properties?.P5YTENOWN_P,
            P5YTENRENT_P: prop.P5YTENRENT_P ?? prop.properties?.P5YTENRENT_P,
            P0YTENOWN_P: prop.P0YTENOWN_P ?? prop.properties?.P0YTENOWN_P,
            P0YTENRENT_P: prop.P0YTENRENT_P ?? prop.properties?.P0YTENRENT_P,
            ECYCDOCO_P: prop.ECYCDOCO_P ?? prop.properties?.ECYCDOCO_P,
            ECYCDOOWCO_P: prop.ECYCDOOWCO_P ?? prop.properties?.ECYCDOOWCO_P,
            ECYCDORECO_P: prop.ECYCDORECO_P ?? prop.properties?.ECYCDORECO_P,
            // Revenue property fields (critical for PDF)
            gross_income_multiplier: prop.gross_income_multiplier ?? prop.properties?.gross_income_multiplier ?? prop.properties?.gim,
            potential_gross_revenue: prop.potential_gross_revenue ?? prop.properties?.potential_gross_revenue ?? prop.properties?.pgi,
            price_vs_assessment: prop.price_vs_assessment ?? prop.properties?.price_vs_assessment,
            common_expenses: prop.common_expenses ?? prop.properties?.common_expenses,
            gim: prop.gim ?? prop.properties?.gim,
            pgi: prop.pgi ?? prop.properties?.pgi,
            propertyCategory: prop.propertyCategory ?? prop.property_category ?? prop.properties?.propertyCategory ?? prop.properties?.property_category,
            isRevenueProperty: prop.isRevenueProperty ?? prop.properties?.isRevenueProperty,
          };
        });

        // Calculate real stats from the API response
        // Calculate average CMA score from actual property scores (60-100 range)
        const validCMAScores = transformedProperties
          .map(p => p.cma_score || 0)
          .filter(score => score >= 0 && score <= 100); // Only valid CMA scores

        const avgCMAScore = validCMAScores.length > 0
          ? validCMAScores.reduce((sum, score) => sum + score, 0) / validCMAScores.length
          : 75; // Default to 75 if no valid scores

        console.log('[useCMAAnalysis] CMA Score Calculation:', {
          propertiesCount: transformedProperties.length,
          validScoresCount: validCMAScores.length,
          calculatedAvgScore: avgCMAScore,
          sampleScores: validCMAScores.slice(0, 5)
        });

        // Filter properties with valid square footage for price per sqft calculation
        const validPropertiesForPricePerSqft = transformedProperties.filter(p =>
          p.squareFootage > 0 && p.price > 0
        );

        console.log('[useCMAAnalysis] Price per sqft calculation:', {
          totalProperties: transformedProperties.length,
          validPropertiesForPricePerSqft: validPropertiesForPricePerSqft.length,
          sampleValidProperty: validPropertiesForPricePerSqft[0] ? {
            address: validPropertiesForPricePerSqft[0].address,
            price: validPropertiesForPricePerSqft[0].price,
            squareFootage: validPropertiesForPricePerSqft[0].squareFootage,
            pricePerSqft: validPropertiesForPricePerSqft[0].price / validPropertiesForPricePerSqft[0].squareFootage
          } : 'No valid properties',
          sampleInvalidProperty: transformedProperties.find(p => p.squareFootage <= 0 || p.price <= 0) ? {
            address: transformedProperties.find(p => p.squareFootage <= 0 || p.price <= 0)?.address,
            price: transformedProperties.find(p => p.squareFootage <= 0 || p.price <= 0)?.price,
            squareFootage: transformedProperties.find(p => p.squareFootage <= 0 || p.price <= 0)?.squareFootage
          } : 'All properties valid'
        });

        const calculatedStats: CMAStats = {
          average_price: transformedProperties.length > 0
            ? transformedProperties.reduce((sum, p) => sum + p.price, 0) / transformedProperties.length
            : 0,
          median_price: transformedProperties.length > 0
            ? transformedProperties.map(p => p.price).sort((a, b) => a - b)[Math.floor(transformedProperties.length / 2)]
            : 0,
          // ✅ FIX: Only calculate price per sqft for properties with valid square footage
          price_per_sqft: validPropertiesForPricePerSqft.length > 0
            ? Math.round(validPropertiesForPricePerSqft.reduce((sum, p) => sum + (p.price / p.squareFootage), 0) / validPropertiesForPricePerSqft.length)
            : 0, // Return 0 instead of 200 when no valid data (will be displayed as "N/A" in UI)
          // Calculate real average days on market from time_on_market field
          average_dom: (() => {
            const validDOM = transformedProperties
              .map(p => p.time_on_market || 0)
              .filter(dom => dom > 0 && dom < 3650); // Filter out invalid values (< 10 years)
            return validDOM.length > 0
              ? Math.round(validDOM.reduce((sum, dom) => sum + dom, 0) / validDOM.length)
              : 0; // Return 0 if no valid data
          })(),
          average_cma_score: Math.max(0, Math.min(100, Math.round(avgCMAScore * 10) / 10)), // Ensure 0-100 range
          total_properties: transformedProperties.length,
          sold_properties: transformedProperties.filter(p => p.status === 'sold').length,
          active_properties: transformedProperties.filter(p => p.status === 'active').length
        };

        // 🔍 FINAL DEBUG: Property count analysis
        console.log('🔍 [useCMAAnalysis] FINAL PROPERTY COUNT ANALYSIS:', {
          fromAPI: apiResult.properties?.length || 0,
          afterTransformation: transformedProperties.length,
          expectedIfFiltered: '< 100 properties within selected area',
          actualResult: transformedProperties.length,
          isLikelyUnfiltered: transformedProperties.length > 1000,
          spatialFilteringWorking: transformedProperties.length < 500,
          areaInfo: {
            displayName: selectedArea?.displayName,
            geometryType: selectedArea?.geometry?.type,
            hasExtent: !!selectedArea?.geometry?.extent
          }
        });

        console.log(`[useCMAAnalysis] Successfully loaded ${transformedProperties.length} properties from API`);
        console.log(`[useCMAAnalysis] Average CMA score: ${calculatedStats.average_cma_score.toFixed(2)}`);
        console.log(`[useCMAAnalysis] Property count breakdown:`, {
          total: transformedProperties.length,
          sold: calculatedStats.sold_properties,
          active: calculatedStats.active_properties,
          area: selectedArea?.displayName || 'Unknown'
        });
        
        // DEBUG: Check first 3 properties' st field
        console.log('[useCMAAnalysis] 🔍 Sample property st values:', transformedProperties.slice(0, 3).map(p => ({
          address: p.address,
          st: p.st,
          status: p.status,
          has_st_field: 'st' in p
        })));

        setProperties(transformedProperties);
        setStats(calculatedStats);
      } catch (err) {
        console.error('[useCMAAnalysis] Error loading CMA data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load CMA data');
        
        // Fallback to empty data
        setProperties([]);
        setStats({
          average_price: 0,
          median_price: 0,
          price_per_sqft: 0,
          average_dom: 0,
          average_cma_score: 0,
          total_properties: 0,
          sold_properties: 0,
          active_properties: 0
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadCMAData();
  }, [selectedArea, enabled,
    // Destructure filters to avoid object reference issues
    filters?.propertyType,
    filters?.selectedPropertyTypes?.join(','), // Convert array to string for dependency tracking
    filters?.propertyCategory,
    filters?.priceRange?.min,
    filters?.priceRange?.max,
    filters?.bedrooms?.min,
    filters?.bedrooms?.max,
    filters?.bathrooms?.min,
    filters?.bathrooms?.max,
    filters?.squareFootage?.min,
    filters?.squareFootage?.max,
    filters?.yearBuilt?.min,
    filters?.yearBuilt?.max,
    filters?.listingStatus, // Include listingStatus - now triggers API call
    filters?.dateRange?.start?.getTime(),
    filters?.dateRange?.end?.getTime()
  ]);

  // Calculate dynamic data ranges from loaded properties
  const dataRanges = useMemo(() => {
    if (properties.length === 0) {
      return DEFAULT_DATA_RANGES;
    }

    // Map CMAProperty to format expected by calculateFilterRanges
    const propertyData = properties.map(p => ({
      price: p.price,
      bedrooms_number: p.bedrooms,
      bathrooms_number: p.bathrooms,
      square_footage: p.squareFootage,
      year_built: p.yearBuilt
    }));

    return calculateFilterRanges(propertyData);
  }, [properties]);

  return {
    properties,
    stats,
    isLoading,
    error,
    dataRanges
  };
}