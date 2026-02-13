"use client";

import type { CMAProperty, CMAFilters, PropertyParams } from '../types';
import { PropertyTypeClassifier } from '@/lib/analysis/PropertyTypeClassifier';

/**
 * @deprecated Use PropertyParams from '../types' instead.
 * Kept for backwards compatibility with existing code.
 */
export interface PropertyFilterParams {
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  yearBuilt?: number;
  price?: number;
  propertyType?: string;
  status?: string;
  sourcePropertyType?: string;
  potential_gross_revenue?: number | null;
  common_expenses?: number | null;
  gross_income_multiplier?: number | null;
  price_vs_assessment?: number | null;
}

// Re-export PropertyParams for consumers
export type { PropertyParams } from '../types';

export interface AutoFilterOptions {
  // Tolerance ranges for filtering (defaults from Issue #15 requirements)
  bedroomsTolerance?: number; // Default: ±1 bedroom
  bathroomsTolerance?: number; // Default: ±1 bathroom
  squareFootageTolerance?: number; // Default: ±20% of square footage
  yearBuiltTolerance?: number; // Default: ±10 years
  priceTolerance?: number; // Default: ±20% of price (15-20% range, using 20%)

  // Override specific filters
  includeAllStatuses?: boolean; // Include both sold and active properties
  customPriceRange?: { min: number; max: number };
  customDateRange?: { start: Date; end: Date };
}

/**
 * Generates auto-filters based on selected property parameters.
 * Accepts both PropertyParams and legacy PropertyFilterParams.
 *
 * Updated for Issue #15: Uses property-based tolerance ranges (±1 bed/bath, ±20% sqft/price, ±10y year)
 * Now includes automatic property category detection (revenue vs residential)
 */
export function generateAutoFilters(
  selectedProperty: PropertyParams | PropertyFilterParams,
  options: AutoFilterOptions = {}
): CMAFilters {
  // Normalize to PropertyFilterParams format for internal processing
  const params: PropertyFilterParams = 'centrisNo' in selectedProperty
    ? toPropertyFilterParams(selectedProperty as PropertyParams)
    : selectedProperty;
  const {
    bedroomsTolerance = 1,        // Issue #15: ±1 bedroom
    bathroomsTolerance = 1,       // Issue #15: ±1 bathroom
    squareFootageTolerance = 0.20, // Issue #15: ±20% of square footage
    yearBuiltTolerance = 10,      // Issue #15: ±10 years
    priceTolerance = 0.20,        // Issue #15: ±20% of price (15-20% range)
    includeAllStatuses = true,
    customPriceRange,
    customDateRange
  } = options;

  // Auto-detect property category using PropertyTypeClassifier
  const classification = PropertyTypeClassifier.classify({
    potential_gross_revenue: params.potential_gross_revenue,
    common_expenses: params.common_expenses,
    gross_income_multiplier: params.gross_income_multiplier,
    price_vs_assessment: params.price_vs_assessment,
    property_type: params.propertyType,
  });

  console.log('[autoFilterUtils] Property classification:', {
    isRevenueProperty: classification.isRevenueProperty,
    propertyCategory: classification.propertyCategory,
    confidence: classification.confidence,
    reason: classification.detectionReason,
  });

  // Issue #15: Apply ±1 bedroom tolerance (or full range if not specified)
  let bedroomsMin = 0;
  let bedroomsMax = 20;
  if (params.bedrooms !== undefined && params.bedrooms !== null) {
    bedroomsMin = Math.max(0, params.bedrooms - bedroomsTolerance);
    bedroomsMax = params.bedrooms + bedroomsTolerance;
  }

  // Issue #15: Apply ±1 bathroom tolerance (or full range if not specified)
  let bathroomsMin = 0;
  let bathroomsMax = 10;
  if (params.bathrooms !== undefined && params.bathrooms !== null) {
    bathroomsMin = Math.max(0, params.bathrooms - bathroomsTolerance);
    bathroomsMax = params.bathrooms + bathroomsTolerance;
  }

  // Issue #15: Apply ±20% square footage tolerance (or full range if not specified)
  let squareFootageMin = 0;
  let squareFootageMax = 10000;
  if (params.squareFootage && params.squareFootage > 0) {
    const sqftBase = params.squareFootage;
    const sqftVariance = sqftBase * squareFootageTolerance;
    squareFootageMin = Math.max(0, Math.round(sqftBase - sqftVariance));
    squareFootageMax = Math.round(sqftBase + sqftVariance);
  }

  // Issue #15: Apply ±10 years tolerance (or full range if not specified)
  const currentYear = new Date().getFullYear();
  let yearBuiltMin = 1900;
  let yearBuiltMax = currentYear;
  if (params.yearBuilt && params.yearBuilt > 0) {
    yearBuiltMin = Math.max(1900, params.yearBuilt - yearBuiltTolerance);
    yearBuiltMax = Math.min(currentYear, params.yearBuilt + yearBuiltTolerance);
  }

  // Issue #15: Apply ±20% price tolerance (or full range if not specified)
  let priceMin = 0;
  let priceMax = 2000000;
  if (customPriceRange) {
    priceMin = customPriceRange.min;
    priceMax = customPriceRange.max;
  } else if (params.price && params.price > 0) {
    const priceBase = params.price;
    const priceVariance = priceBase * priceTolerance;
    priceMin = Math.max(0, Math.round(priceBase - priceVariance));
    priceMax = Math.round(priceBase + priceVariance);
  }

  // Determine property type
  let propertyType: CMAFilters['propertyType'] = 'all';
  if (params.propertyType) {
    const typeMap: Record<string, CMAFilters['propertyType']> = {
      'house': 'house',
      'condo': 'condo',
      'townhouse': 'townhouse',
      'apartment': 'apartment',
      'duplex': 'duplex',
      'commercial': 'commercial'
    };
    propertyType = typeMap[params.propertyType.toLowerCase()] || 'all';
  }

  // Determine listing status
  let listingStatus: CMAFilters['listingStatus'] = 'both';
  if (!includeAllStatuses && params.status) {
    if (params.status.toLowerCase() === 'sold') {
      listingStatus = 'sold';
    } else if (params.status.toLowerCase() === 'active') {
      listingStatus = 'active';
    }
  }

  // Date range (default to last year)
  const dateRange = customDateRange || {
    start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
    end: new Date()
  };

  // Auto-select property types based on classification
  let selectedPropertyTypes: string[] = [];
  if (classification.isRevenueProperty) {
    // Revenue property: select revenue-properties checkbox
    selectedPropertyTypes = ['duplex', 'multiplex', 'commercial'];
  } else {
    // PRIORITY 1: Check sourcePropertyType from blob data (most reliable)
    // This is set when properties are loaded from house_active, condo_active, etc.
    const sourceType = params.sourcePropertyType;
    if (sourceType === 'house') {
      selectedPropertyTypes = ['house'];
      console.log('[autoFilterUtils] Using sourcePropertyType: house');
    } else if (sourceType === 'condo') {
      selectedPropertyTypes = ['condo'];
      console.log('[autoFilterUtils] Using sourcePropertyType: condo');
    } else if (sourceType === 'townhouse') {
      selectedPropertyTypes = ['townhouse'];
      console.log('[autoFilterUtils] Using sourcePropertyType: townhouse');
    } else {
      // PRIORITY 2: Infer from pt code (less reliable)
      const propType = (params.propertyType || '').toUpperCase().trim();

      // House codes from Centris: BUN (bungalow), SL (split-level), CT (cottage), SF (single family)
      // NOTE: CT is Cottage in single_family data, NOT condo!
      const houseCodes = ['SF', 'BUN', 'SL', 'CT', '2S', 'SP', 'CA', 'HOUSE', 'BUNGALOW', 'COTTAGE', '1HS', '2HS', 'MH'];
      const isHouseType = houseCodes.some(code => propType === code || propType.startsWith(code));

      // Condo codes: APT (apartment), CO (condo), HOU (house-style condo), LS (loft/studio)
      // Exclude CT as it means Cottage in house data
      const condoCodes = ['APT', 'CO', 'HOU', 'LS', 'CONDO', 'APARTMENT'];
      const isCondoType = condoCodes.some(code => propType === code || propType.startsWith(code));

      // Townhouse codes: TH, TO (townhouse), ROW (row house)
      const townhouseCodes = ['TH', 'TO', 'ROW', 'TOWNHOUSE'];
      const isTownhouseType = townhouseCodes.some(code => propType === code || propType.startsWith(code));

      if (isHouseType) {
        selectedPropertyTypes = ['house'];
      } else if (isCondoType) {
        selectedPropertyTypes = ['condo'];
      } else if (isTownhouseType) {
        selectedPropertyTypes = ['townhouse'];
      } else {
        // Unknown type: include all residential types to avoid filtering out the property
        console.warn('[autoFilterUtils] Unknown property type, including all residential:', propType);
        selectedPropertyTypes = ['house', 'townhouse', 'condo'];
      }
    }
  }

  console.log('[autoFilterUtils] Auto-selected property types:', {
    rawPropertyType: params.propertyType,
    normalizedType: (params.propertyType || '').toUpperCase().trim(),
    selectedPropertyTypes,
    propertyCategory: classification.propertyCategory,
    isRevenueProperty: classification.isRevenueProperty
  });

  return {
    propertyType,
    priceRange: { min: priceMin, max: priceMax },
    bedrooms: { min: bedroomsMin, max: bedroomsMax },
    bathrooms: { min: bathroomsMin, max: bathroomsMax },
    squareFootage: { min: squareFootageMin, max: squareFootageMax },
    yearBuilt: { min: yearBuiltMin, max: yearBuiltMax },
    listingStatus,
    dateRange,
    // NEW: Include property category and selected types for auto-filtering
    propertyCategory: classification.propertyCategory,
    selectedPropertyTypes,
  };
}

/**
 * Extracts property parameters from a graphic feature (from map popup).
 *
 * IMPORTANT: This should be called ONCE at PropertyPopupContent and the result
 * passed downstream. Do NOT call this multiple times in the CMA pipeline.
 */
export function extractPropertyParams(feature: __esri.Graphic): PropertyParams {
  const attrs = feature.attributes || {};
  const geom = feature.geometry as any;

  // Extract property type
  const extractedPropertyType = attrs.pt || attrs.propertyType || attrs.property_type || attrs.PROPERTY_TYPE;

  // Extract address
  const address = attrs.address || attrs.ADDRESS ||
    (attrs.civic_number ? `${attrs.civic_number} ${attrs.street_name || ''}`.trim() : '');

  // Normalize status
  const rawStatus = attrs.status || attrs.st || attrs.STATUS;
  let status: 'sold' | 'active' | undefined = undefined;
  if (rawStatus) {
    const s = String(rawStatus).toLowerCase();
    if (s === 'so' || s === 'sold') status = 'sold';
    else if (s === 'ac' || s === 'active') status = 'active';
  }

  // Extract coordinates from geometry
  let coordinates: PropertyParams['coordinates'] = undefined;
  if (geom) {
    if (geom.latitude !== undefined && geom.longitude !== undefined) {
      coordinates = { latitude: geom.latitude, longitude: geom.longitude };
    } else if (geom.x !== undefined && geom.y !== undefined) {
      // WebMercator or similar - approximate conversion
      coordinates = { latitude: geom.y, longitude: geom.x };
    } else if (geom.centroid) {
      coordinates = { latitude: geom.centroid.latitude, longitude: geom.centroid.longitude };
    }
  }

  // Normalize sourcePropertyType
  const rawSourceType = attrs.sourcePropertyType || attrs.source_property_type;
  let sourcePropertyType: PropertyParams['sourcePropertyType'] = undefined;
  if (rawSourceType) {
    const st = String(rawSourceType).toLowerCase();
    if (st === 'house') sourcePropertyType = 'house';
    else if (st === 'condo') sourcePropertyType = 'condo';
    else if (st === 'townhouse') sourcePropertyType = 'townhouse';
    else if (st === 'revenue' || st === 'multiplex') sourcePropertyType = 'revenue';
  }

  const params: PropertyParams = {
    centrisNo: String(attrs.centris_no || attrs.CENTRIS_NO || attrs.mls_number || ''),
    address,

    bedrooms: parseIntOrUndefined(attrs.bedrooms || attrs.bedrooms_number || attrs.BEDROOMS),
    bathrooms: parseFloatOrUndefined(attrs.bathrooms || attrs.bathrooms_number || attrs.BATHROOMS),
    squareFootage: parseIntOrUndefined(attrs.squareFootage || attrs.square_footage || attrs.SQUARE_FOOTAGE || attrs.living_area),
    yearBuilt: parseIntOrUndefined(attrs.yearBuilt || attrs.year_built || attrs.YEAR_BUILT),
    lotSize: parseIntOrUndefined(attrs.lot_size || attrs.lotSize || attrs.LOT_SIZE),

    price: parseIntOrUndefined(attrs.price || attrs.askedsold_price || attrs.asked_price || attrs.PRICE),
    pricePerSqFt: parseFloatOrUndefined(attrs.price_per_sqft || attrs.PRICE_PER_SQFT),

    propertyType: extractedPropertyType,
    sourcePropertyType,
    status,

    potentialGrossRevenue: parseFloatOrUndefined(attrs.potential_gross_revenue || attrs.POTENTIAL_GROSS_REVENUE),
    commonExpenses: parseFloatOrUndefined(attrs.common_expenses || attrs.COMMON_EXPENSES),
    grossIncomeMultiplier: parseFloatOrUndefined(attrs.gross_income_multiplier || attrs.GIM),
    priceVsAssessment: parseFloatOrUndefined(attrs.price_vs_assessment || attrs.PRICE_VS_ASSESSMENT),

    coordinates,
    _rawFeature: feature
  };

  console.log('[extractPropertyParams] ✅ Single extraction complete:', {
    centrisNo: params.centrisNo,
    address: params.address,
    price: params.price,
    bedrooms: params.bedrooms,
    status: params.status,
    hasCoordinates: !!params.coordinates
  });

  return params;
}

/**
 * Converts PropertyParams to legacy PropertyFilterParams for backwards compatibility.
 */
export function toPropertyFilterParams(params: PropertyParams): PropertyFilterParams {
  return {
    bedrooms: params.bedrooms,
    bathrooms: params.bathrooms,
    squareFootage: params.squareFootage,
    yearBuilt: params.yearBuilt,
    price: params.price,
    propertyType: params.propertyType,
    status: params.status,
    sourcePropertyType: params.sourcePropertyType,
    potential_gross_revenue: params.potentialGrossRevenue,
    common_expenses: params.commonExpenses,
    gross_income_multiplier: params.grossIncomeMultiplier,
    price_vs_assessment: params.priceVsAssessment,
  };
}

/**
 * Extracts property parameters from a CMAProperty object
 */
export function extractPropertyParamsFromCMA(property: CMAProperty): PropertyFilterParams {
  return {
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    squareFootage: property.squareFootage,
    yearBuilt: property.yearBuilt,
    price: property.price,
    propertyType: undefined, // CMAProperty doesn't have property type
    status: property.status
  };
}

/**
 * Creates a human-readable description of the auto-applied filters
 */
export function describeAutoFilters(
  selectedProperty: PropertyFilterParams,
  filters: CMAFilters
): string {
  const parts: string[] = [];
  
  if (selectedProperty.bedrooms) {
    parts.push(`${filters.bedrooms.min}-${filters.bedrooms.max} bedrooms`);
  }
  
  if (selectedProperty.bathrooms) {
    parts.push(`${filters.bathrooms.min}-${filters.bathrooms.max} bathrooms`);
  }
  
  if (selectedProperty.squareFootage) {
    parts.push(`${filters.squareFootage.min.toLocaleString()}-${filters.squareFootage.max.toLocaleString()} sq ft`);
  }
  
  if (selectedProperty.price) {
    parts.push(`$${filters.priceRange.min.toLocaleString()}-$${filters.priceRange.max.toLocaleString()}`);
  }
  
  if (selectedProperty.yearBuilt) {
    parts.push(`built ${filters.yearBuilt.min}-${filters.yearBuilt.max}`);
  }
  
  if (filters.propertyType !== 'all') {
    parts.push(`${filters.propertyType} properties`);
  }
  
  if (filters.listingStatus !== 'both') {
    parts.push(`${filters.listingStatus} listings`);
  }
  
  return parts.length > 0 
    ? `Similar properties: ${parts.join(', ')}`
    : 'All properties in area';
}

// Helper functions
function parseIntOrUndefined(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = parseInt(String(value), 10);
  return isNaN(parsed) ? undefined : parsed;
}

function parseFloatOrUndefined(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = parseFloat(String(value));
  return isNaN(parsed) ? undefined : parsed;
}