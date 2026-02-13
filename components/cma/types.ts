/**
 * Canonical property parameters extracted ONCE from map feature.
 * Single source of truth for property data in CMA pipeline.
 * Extracted at PropertyPopupContent and passed downstream - NO re-extraction.
 */
export interface PropertyParams {
  // Core identification
  centrisNo: string;
  address: string;

  // Physical characteristics
  bedrooms: number | undefined;
  bathrooms: number | undefined;
  squareFootage: number | undefined;
  yearBuilt: number | undefined;
  lotSize: number | undefined;

  // Pricing
  price: number | undefined;
  pricePerSqFt: number | undefined;

  // Classification
  propertyType: string | undefined;  // pt field: BUN, APT, CO, etc.
  sourcePropertyType: 'house' | 'condo' | 'townhouse' | 'revenue' | undefined;
  status: 'sold' | 'active' | undefined;

  // Revenue property fields (for classification)
  potentialGrossRevenue: number | undefined;
  commonExpenses: number | undefined;
  grossIncomeMultiplier: number | undefined;
  priceVsAssessment: number | undefined;

  // Location (for similarity scoring and buffer creation)
  coordinates: {
    latitude: number;
    longitude: number;
  } | undefined;

  // Raw feature reference (for edge cases requiring geometry)
  _rawFeature?: __esri.Graphic;
}

export interface CMAFilters {
  propertyType: 'all' | 'house' | 'condo' | 'townhouse' | 'apartment' | 'duplex' | 'commercial' | 'revenue';
  propertyCategory?: 'residential' | 'revenue' | 'both'; // NEW: Filter by investment category
  selectedPropertyTypes?: string[]; // NEW: For checkbox multi-select ['house', 'condo', 'townhouse']

  // Residential Filters
  priceRange: { min: number; max: number };
  bedrooms: { min: number; max: number };
  bathrooms: { min: number; max: number };
  squareFootage: { min: number; max: number };
  yearBuilt: { min: number; max: number };
  listingStatus: 'both' | 'sold' | 'active';
  dateRange: {
    start: Date;
    end: Date;
  };

  // Revenue Property Filters (Investment-focused)
  grossIncomeRange?: { min: number; max: number }; // potential_gross_revenue
  gimRange?: { min: number; max: number }; // gross_income_multiplier
  priceVsAssessmentRange?: { min: number; max: number }; // price_vs_assessment %
}

// Dynamic data ranges calculated from actual property data
export interface CMADataRanges {
  priceRange: { min: number; max: number };
  bedrooms: { min: number; max: number };
  bathrooms: { min: number; max: number };
  squareFootage: { min: number; max: number };
  yearBuilt: { min: number; max: number };
}

// Default ranges when no data is available
export const DEFAULT_DATA_RANGES: CMADataRanges = {
  priceRange: { min: 0, max: 2000000 },
  bedrooms: { min: 0, max: 10 },
  bathrooms: { min: 0, max: 10 },
  squareFootage: { min: 0, max: 10000 },
  yearBuilt: { min: 1800, max: new Date().getFullYear() }
};

export interface AreaSelection {
  displayName: string;
  geometry: __esri.Geometry;
  method: 'draw' | 'search' | 'service-area' | 'project-area';
  metadata?: {
    area?: number;
    centroid?: __esri.Point;
    source?: string;
    bufferType?: 'radius' | 'drivetime' | 'walktime';
    bufferValue?: number;
    bufferUnit?: string;
  };
}

export interface CMAProperty {
  id: string;
  address: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  squareFootage: number;
  yearBuilt: number;
  status: 'sold' | 'active';
  st?: string; // Abbreviated status code from GeoJSON: 'SO' = sold, 'AC' = active
  geometry?: __esri.Geometry;
  cma_score?: number;

  // Additional Real Estate Fields from GeoJSON
  living_area?: number;
  lot_area?: number;
  asked_price?: number;
  asking_price?: number; // Alternative field name
  original_price?: number;
  original_sale_price?: number; // Original listing price before any reductions (from Centris)
  askedsold_price?: number; // Final sold price (from Centris blob data)
  sold_rented_price?: number; // Alternative sold price field from Centris
  sold_price?: number; // Sold price for sold properties
  sale_price?: number; // Alternative sold price field
  price_delta?: number; // Pre-calculated price delta percentage (asking vs sold)
  price_per_sqft?: number;
  price_to_median_ratio?: number; // Ratio of property price to market median
  property_type?: 'house' | 'condo' | 'townhouse' | 'apartment' | 'duplex' | 'commercial' | string;
  time_on_market?: number; // Days listed
  mls_number?: string;
  mls?: number; // Centris/MLS listing ID (numeric)
  centris_no?: number; // Alternative field name for Centris ID
  municipality?: string;
  postal_code?: string;
  fsa_code?: string;

  // Similarity Scoring (Issue #17)
  similarity_score?: number; // 0-100 score measuring similarity to subject property

  // Date fields for temporal analysis
  date_bc?: string; // Listing date (date broker commission)
  date_pp_acpt_expiration?: string; // Promise to purchase acceptance expiration date
  listing_date?: string; // Alternative listing date field
  sold_date?: string; // Sale completion date
  sale_date?: string; // Alternative sale date field
  close_date?: string; // Closing/transaction date

  // Property Images (URLs or base64)
  image_url?: string; // Main property image
  thumbnail_url?: string; // Thumbnail for listings
  photos?: string[]; // Additional property photos

  // Demographic Fields from GeoJSON
  age_median?: number;
  ECYPTAPOP?: number; // Total population
  population_25_34?: number;
  population_density?: number;
  ECYMTN1524_P?: number; // % aged 15-24
  ECYMTN2534_P?: number; // % aged 25-34
  ECYMTN3544_P?: number; // % aged 35-44
  ECYMTN4554_P?: number; // % aged 45-54
  ECYMTN5564_P?: number; // % aged 55-64
  ECYMTN65P_P?: number;  // % aged 65+
  education_university_rate?: number;

  // Economic Fields from GeoJSON
  avg_household_income?: number;
  ECYHNIAGG?: number; // Aggregate household income
  ECYHNIAVG?: number; // Average household income
  ECYHNIMED?: number; // Median household income
  median_housing_value?: number;
  unemployment_rate?: number;
  homeownership_rate?: number;
  ECYTENOWN_P?: number; // % owned dwellings (current)
  ECYTENRENT_P?: number; // % rented dwellings (current)
  P5YTENOWN_P?: number; // % owned dwellings (5 years ago)
  P5YTENRENT_P?: number; // % rented dwellings (5 years ago)
  P0YTENOWN_P?: number; // % owned dwellings (10 years ago)
  P0YTENRENT_P?: number; // % rented dwellings (10 years ago)
  ECYTENHHD?: number; // Total households
  ECYCDOCO_P?: number; // % condo units
  ECYCDOOWCO_P?: number; // % owned condos
  ECYCDORECO_P?: number; // % rented condos
  HOUSING_AFFORDABILITY_INDEX?: number;
  rental_yield?: number;
  HOT_GROWTH_INDEX?: number;

  // Investment Metrics (Revenue Properties Only)
  potential_gross_revenue?: number; // PGI - Annual rental income (from Centris)
  common_expenses?: number; // Monthly operating expenses (from Centris)
  gross_income_multiplier?: number; // GIM - Already calculated by Centris
  price_vs_assessment?: number; // Price as % of municipal assessment (from Centris)

  // Calculated Investment Metrics
  pgi?: number; // Potential Gross Income (same as potential_gross_revenue)
  noi?: number; // Net Operating Income = PGI - (Operating Expenses × 12)
  nim?: number; // Net Income Multiplier = Sale Price / NOI
  egi?: number; // Effective Gross Income = PGI × (1 - vacancy rate)
  effective_noi?: number; // Effective NOI = EGI - (Operating Expenses × 12)
  gim?: number; // Gross Income Multiplier (same as gross_income_multiplier)
  price_to_assessment_ratio?: number; // Price to Assessment Ratio (same as price_vs_assessment)

  // Property Classification (Revenue vs Residential)
  isRevenueProperty?: boolean; // Auto-detected: has potential_gross_revenue OR common_expenses
  propertyCategory?: 'residential' | 'revenue'; // Explicit category for routing
}

// Export alias for backwards compatibility
export type Property = CMAProperty;

export interface CMAStats {
  average_price: number;
  median_price: number;
  price_per_sqft: number;
  average_dom: number; // days on market
  average_cma_score: number;
  total_properties: number;
  sold_properties: number;
  active_properties: number;
  marketAppreciation?: number; // percentage appreciation
  maxPrice?: number;
  minPrice?: number;
  avgPrice?: number;
  inventoryLevel?: 'low' | 'medium' | 'high';
  
  // New statistical properties from fixes
  standardDeviation?: number;
  variance?: number;
  median_cma_score?: number;
  min?: number;
  max?: number;
  count?: number;
  mean?: number;
  median?: number;
  soldCount?: number;
  activeCount?: number;
  validDaysOnMarketCount?: number;
}

export interface AIInsight {
  id?: string;
  title: string;
  content: string;
  type?: 'market_trend' | 'pricing_insight' | 'recommendation' | 'warning';
  category?: string;
  confidence: number;
  source?: string;
  timestamp?: Date;
  impact?: 'low' | 'medium' | 'high';
}

/**
 * Calculate days on market from property dates
 * For sold properties: date_pp_acpt_expiration - date_bc
 * For active properties: today - date_bc
 */
export function calculateTimeOnMarket(property: CMAProperty): number | undefined {
  const { date_bc, date_pp_acpt_expiration, st, status } = property;
  
  if (!date_bc) return undefined;
  
  try {
    const listingDate = new Date(date_bc);
    const isSold = (status?.toLowerCase() === 'sold') || (st?.toUpperCase() === 'SO');
    
    if (isSold && date_pp_acpt_expiration) {
      // Sold: use acceptance date as end date
      const soldDate = new Date(date_pp_acpt_expiration);
      const diffDays = Math.ceil((soldDate.getTime() - listingDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Sanity check: DOM should be positive and reasonable (< 2 years)
      return (diffDays > 0 && diffDays < 730) ? diffDays : undefined;
    } else {
      // Active: use today as end date
      const today = new Date();
      const diffDays = Math.ceil((today.getTime() - listingDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Sanity check: DOM should be positive and reasonable (< 2 years)
      return (diffDays > 0 && diffDays < 730) ? diffDays : undefined;
    }
  } catch (error) {
    console.warn('[calculateTimeOnMarket] Failed to parse dates:', error);
    return undefined;
  }
}