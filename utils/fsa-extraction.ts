/**
 * FSA (Forward Sortation Area) Extraction Utilities
 * 
 * Provides utilities for extracting FSA codes from Canadian addresses
 * and enriching real estate data with demographic information.
 * 
 * Based on the simplified no-ArcGIS strategy for real estate platform.
 */

export interface PropertyAddress {
  address: string;
  lat?: number;
  lng?: number;
}

export interface FSADemographics {
  fsa_code: string;
  population: number;
  median_income: number;
  avg_dwelling_value: number;
  total_dwellings: number;
  unemployment_rate: number;
  avg_household_size: number;
  education_bachelor_plus_pct?: number;
}

export interface EnrichedPropertyPoint extends PropertyAddress {
  property_id: string;
  sold_price?: number;
  asking_price?: number;
  time_on_market?: number;
  rent_price?: number;
  bedrooms?: number;
  bathrooms?: number;
  property_type?: string;
  year_built?: number;
  date_listed?: string;
  date_sold?: string;
  fsa_code?: string;
  fsa_demographics?: FSADemographics | null;
  calculated_fields?: {
    price_delta?: number;
    income_to_price_ratio?: number;
    market_segment?: string;
    price_vs_area_avg?: number;
  };
}

/**
 * Extracts FSA code from a Canadian address
 * Canadian postal code format: A1A 1A1 (FSA is first 3 characters: A1A)
 */
export function extractFSAFromAddress(address: string): string | null {
  if (!address || typeof address !== 'string') {
    return null;
  }

  // Remove common address prefixes and clean the string
  const cleanAddress = address
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

  // Canadian postal code pattern: Letter-Digit-Letter followed by space and Digit-Letter-Digit
  // Examples: H3V 2R1, K1A 0A6, M5V 3C6
  const postalCodeMatch = cleanAddress.match(/([A-Z]\d[A-Z])\s*\d[A-Z]\d/);
  
  if (postalCodeMatch && postalCodeMatch[1]) {
    return postalCodeMatch[1]; // Return the FSA part (first 3 characters)
  }

  // Alternative pattern: look for FSA at the end of address
  const fsaMatch = cleanAddress.match(/\b([A-Z]\d[A-Z])\b/);
  if (fsaMatch && fsaMatch[1]) {
    return fsaMatch[1];
  }

  return null;
}

/**
 * Validates that a string is a valid FSA code
 */
export function isValidFSA(fsa: string): boolean {
  if (!fsa || typeof fsa !== 'string') {
    return false;
  }

  // FSA format: Letter-Digit-Letter (e.g., H3V, K1A, M5V)
  const fsaPattern = /^[A-Z]\d[A-Z]$/;
  return fsaPattern.test(fsa.toUpperCase());
}

/**
 * Enriches real estate properties with FSA demographic data
 */
export function enrichRealEstateData(
  properties: PropertyAddress[],
  demographics: FSADemographics[]
): EnrichedPropertyPoint[] {
  // Create FSA lookup table for O(1) access
  const fsaLookup = new Map(
    demographics.map(d => [d.fsa_code.toUpperCase(), d])
  );

  return properties.map((property, index) => {
    // Extract FSA from address
    const fsa = extractFSAFromAddress(property.address);
    const demo = fsa ? fsaLookup.get(fsa) : null;

    // Create enriched property point
    const enrichedProperty: EnrichedPropertyPoint = {
      ...property,
      property_id: `property_${index + 1}`,
      fsa_code: fsa || undefined,
      fsa_demographics: demo || null
    };

    // Calculate derived fields if we have demographic data and property price
    if (demo && 'sold_price' in property && property.sold_price && typeof property.sold_price === 'number') {
      enrichedProperty.calculated_fields = {
        income_to_price_ratio: demo.median_income / property.sold_price,
        market_segment: categorizePropertyByPrice(property.sold_price, demo.avg_dwelling_value)
      };

      // Calculate price delta if asking price is available
      if ('asking_price' in property && property.asking_price && typeof property.asking_price === 'number') {
        enrichedProperty.calculated_fields.price_delta = 
          ((property.sold_price - property.asking_price) / property.asking_price) * 100;
      }
    }

    return enrichedProperty;
  });
}

/**
 * Categorizes property by price relative to area average
 */
function categorizePropertyByPrice(soldPrice: number, areaAverage: number): string {
  const ratio = soldPrice / areaAverage;
  
  if (ratio < 0.8) return 'below_market';
  if (ratio > 1.2) return 'above_market';
  return 'market_rate';
}

/**
 * Groups properties by FSA code
 */
export function groupPropertiesByFSA(properties: EnrichedPropertyPoint[]): Map<string, EnrichedPropertyPoint[]> {
  const fsaGroups = new Map<string, EnrichedPropertyPoint[]>();

  properties.forEach(property => {
    if (property.fsa_code) {
      const fsa = property.fsa_code;
      if (!fsaGroups.has(fsa)) {
        fsaGroups.set(fsa, []);
      }
      fsaGroups.get(fsa)!.push(property);
    }
  });

  return fsaGroups;
}

/**
 * Calculates FSA-level aggregations for ML training
 */
export interface FSAAggregation {
  fsa_code: string;
  property_count: number;
  avg_sold_price: number;
  avg_time_on_market: number;
  avg_rent_price: number;
  price_delta_avg: number;
  population: number;
  median_income: number;
  avg_dwelling_value: number;
  total_dwellings: number;
  unemployment_rate: number;
  avg_household_size: number;
  // Calculated market metrics
  price_volatility: number;
  market_activity_score: number;
  affordability_index: number;
}

export function aggregatePropertiesByFSA(properties: EnrichedPropertyPoint[]): FSAAggregation[] {
  const fsaGroups = groupPropertiesByFSA(properties);
  const aggregations: FSAAggregation[] = [];

  fsaGroups.forEach((props, fsa) => {
    // Filter out properties without required data for calculations
    const validProps = props.filter(p => 
      p.sold_price && 
      p.time_on_market && 
      p.fsa_demographics
    );

    if (validProps.length === 0) return;

    const demo = validProps[0].fsa_demographics!;
    
    // Calculate averages
    const soldPrices = validProps.map(p => p.sold_price!);
    const timesOnMarket = validProps.map(p => p.time_on_market!);
    const rentPrices = validProps.map(p => p.rent_price).filter(Boolean) as number[];
    const priceDeltas = validProps.map(p => p.calculated_fields?.price_delta).filter(Boolean) as number[];

    const avgSoldPrice = average(soldPrices);
    const avgTimeOnMarket = average(timesOnMarket);
    const avgRentPrice = rentPrices.length > 0 ? average(rentPrices) : 0;
    const avgPriceDelta = priceDeltas.length > 0 ? average(priceDeltas) : 0;

    // Calculate derived metrics
    const priceVolatility = standardDeviation(soldPrices);
    const marketActivityScore = validProps.length / demo.total_dwellings;
    const affordabilityIndex = demo.median_income / avgSoldPrice;

    aggregations.push({
      fsa_code: fsa,
      property_count: validProps.length,
      avg_sold_price: avgSoldPrice,
      avg_time_on_market: avgTimeOnMarket,
      avg_rent_price: avgRentPrice,
      price_delta_avg: avgPriceDelta,
      population: demo.population,
      median_income: demo.median_income,
      avg_dwelling_value: demo.avg_dwelling_value,
      total_dwellings: demo.total_dwellings,
      unemployment_rate: demo.unemployment_rate,
      avg_household_size: demo.avg_household_size,
      price_volatility: priceVolatility,
      market_activity_score: marketActivityScore,
      affordability_index: affordabilityIndex
    });
  });

  return aggregations;
}

/**
 * Creates ML training dataset from FSA aggregations
 */
export interface MLTrainingRecord {
  // Target variables
  avg_time_on_market: number;
  avg_sold_price: number;
  avg_rent_price: number;
  price_delta_avg: number;

  // Feature variables (demographics)
  fsa_code: string;
  population: number;
  median_income: number;
  avg_dwelling_value: number;
  total_dwellings: number;
  unemployment_rate: number;
  avg_household_size: number;

  // Market features
  property_count: number;
  price_volatility: number;
  market_activity_score: number;

  // Derived features
  income_to_price_ratio: number;
  affordability_index: number;
}

export function createMLTrainingDataset(aggregations: FSAAggregation[]): MLTrainingRecord[] {
  return aggregations.map(agg => ({
    // Target variables
    avg_time_on_market: agg.avg_time_on_market,
    avg_sold_price: agg.avg_sold_price,
    avg_rent_price: agg.avg_rent_price,
    price_delta_avg: agg.price_delta_avg,

    // Feature variables
    fsa_code: agg.fsa_code,
    population: agg.population,
    median_income: agg.median_income,
    avg_dwelling_value: agg.avg_dwelling_value,
    total_dwellings: agg.total_dwellings,
    unemployment_rate: agg.unemployment_rate,
    avg_household_size: agg.avg_household_size,

    // Market features
    property_count: agg.property_count,
    price_volatility: agg.price_volatility,
    market_activity_score: agg.market_activity_score,

    // Derived features
    income_to_price_ratio: agg.median_income / agg.avg_sold_price,
    affordability_index: agg.affordability_index
  }));
}

/**
 * Statistical utility functions
 */
function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
}

function standardDeviation(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const avg = average(numbers);
  const squaredDiffs = numbers.map(num => Math.pow(num - avg, 2));
  const avgSquaredDiff = average(squaredDiffs);
  return Math.sqrt(avgSquaredDiff);
}

/**
 * Validation utilities
 */
export function validatePropertyData(property: EnrichedPropertyPoint): string[] {
  const errors: string[] = [];

  if (!property.address) {
    errors.push('Address is required');
  }

  if (!property.fsa_code) {
    errors.push('FSA code could not be extracted from address');
  } else if (!isValidFSA(property.fsa_code)) {
    errors.push(`Invalid FSA code format: ${property.fsa_code}`);
  }

  if (property.sold_price && property.sold_price <= 0) {
    errors.push('Sold price must be positive');
  }

  if (property.time_on_market && property.time_on_market < 0) {
    errors.push('Time on market cannot be negative');
  }

  return errors;
}

/**
 * Export utilities for debugging and analysis
 */
export function generateFSAReport(properties: EnrichedPropertyPoint[]): {
  totalProperties: number;
  propertiesWithFSA: number;
  uniqueFSAs: number;
  fsaCoverage: number;
  topFSAs: Array<{ fsa: string; count: number }>;
} {
  const propertiesWithFSA = properties.filter(p => p.fsa_code);
  const fsaCounts = new Map<string, number>();

  propertiesWithFSA.forEach(p => {
    if (p.fsa_code) {
      fsaCounts.set(p.fsa_code, (fsaCounts.get(p.fsa_code) || 0) + 1);
    }
  });

  const topFSAs = Array.from(fsaCounts.entries())
    .map(([fsa, count]) => ({ fsa, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalProperties: properties.length,
    propertiesWithFSA: propertiesWithFSA.length,
    uniqueFSAs: fsaCounts.size,
    fsaCoverage: properties.length > 0 ? (propertiesWithFSA.length / properties.length) * 100 : 0,
    topFSAs
  };
}