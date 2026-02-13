/**
 * Field Extractor Utility with Logging
 *
 * Standardizes field extraction from property data with multiple fallback patterns.
 * Logs which field name succeeded when debug mode is enabled.
 *
 * Issue #7: CMA Pipeline Audit - Standardize Field Names with Logging
 */

const DEBUG_ENABLED = process.env.NEXT_PUBLIC_DEBUG_FIELDS === 'true';

/**
 * Utility function to try multiple field names and log which one succeeded
 */
function tryFields<T>(
  attrs: Record<string, any>,
  fieldNames: string[],
  fieldType: string,
  parser: (value: any) => T | null,
  debug?: boolean
): T | null {
  // Handle null/undefined attrs object
  if (!attrs || typeof attrs !== 'object') {
    return null;
  }

  const shouldLog = debug ?? DEBUG_ENABLED;
  const attempts: Array<{ field: string; found: boolean; value?: any }> = [];

  for (const fieldName of fieldNames) {
    const value = attrs[fieldName];

    if (value !== undefined && value !== null && value !== '' && value !== 'N/A') {
      const parsed = parser(value);

      if (parsed !== null) {
        if (shouldLog) {
          attempts.push({ field: fieldName, found: true, value: parsed });

          // Build log message
          const triedFields = fieldNames.map(f => {
            const match = f === fieldName;
            return `${f} ${match ? '✅' : '❌'}`;
          }).join(', ');

          console.log(`[fieldExtractor] ${fieldType}: Found '${fieldName}' = ${parsed} (tried: ${triedFields})`);
        }

        return parsed;
      }

      attempts.push({ field: fieldName, found: false, value });
    } else {
      attempts.push({ field: fieldName, found: false });
    }
  }

  if (shouldLog) {
    const triedFields = fieldNames.map(f => `${f} ❌`).join(', ');
    console.warn(`[fieldExtractor] ${fieldType}: No valid value found (tried: ${triedFields})`);
  }

  return null;
}

/**
 * Extract price from property attributes
 * Field priority: askedsold_price > asked_price > price_display > price
 */
export function extractPrice(attrs: Record<string, any>, debug?: boolean): number | null {
  return tryFields(
    attrs,
    ['askedsold_price', 'asked_price', 'asking_price', 'price_display', 'price', 'sold_price', 'sale_price'],
    'Price',
    (value) => {
      // Handle string prices like "Price on Request"
      if (typeof value === 'string') {
        // Clean currency symbols and commas
        const cleaned = value.replace(/[$,\s]/g, '');
        const num = parseFloat(cleaned);
        return (!isNaN(num) && num > 0) ? num : null;
      }

      // Handle numeric prices
      if (typeof value === 'number' && value > 0) {
        return value;
      }

      return null;
    },
    debug
  );
}

/**
 * Extract status from property attributes
 * Field priority: st > is_sold > status
 * Returns: 'sold' | 'active' | null
 */
export function extractStatus(attrs: Record<string, any>, debug?: boolean): 'sold' | 'active' | null {
  return tryFields(
    attrs,
    ['st', 'is_sold', 'status'],
    'Status',
    (value) => {
      // Handle Centris status codes (st field)
      if (typeof value === 'string') {
        const upper = value.toUpperCase();
        if (upper === 'SO' || upper === 'SOLD') return 'sold';
        if (upper === 'AC' || upper === 'ACTIVE') return 'active';
      }

      // Handle is_sold boolean/number field (0 = active, 1 = sold)
      if (typeof value === 'number') {
        if (value === 1) return 'sold';
        if (value === 0) return 'active';
      }

      // Handle boolean is_sold
      if (typeof value === 'boolean') {
        return value ? 'sold' : 'active';
      }

      return null;
    },
    debug
  );
}

/**
 * Extract bedrooms from property attributes
 * Field priority: bedrooms_number > bedrooms
 */
export function extractBedrooms(attrs: Record<string, any>, debug?: boolean): number | null {
  return tryFields(
    attrs,
    ['bedrooms_number', 'bedrooms', 'bedroom_count', 'num_bedrooms'],
    'Bedrooms',
    (value) => {
      const num = typeof value === 'string' ? parseFloat(value) : value;
      return (typeof num === 'number' && !isNaN(num) && num >= 0) ? Math.floor(num) : null;
    },
    debug
  );
}

/**
 * Extract bathrooms from property attributes
 * Field priority: bathrooms_number > bathrooms
 */
export function extractBathrooms(attrs: Record<string, any>, debug?: boolean): number | null {
  return tryFields(
    attrs,
    ['bathrooms_number', 'bathrooms', 'bathroom_count', 'num_bathrooms'],
    'Bathrooms',
    (value) => {
      const num = typeof value === 'string' ? parseFloat(value) : value;
      // Allow decimals for half-baths (e.g., 2.5 bathrooms)
      return (typeof num === 'number' && !isNaN(num) && num >= 0) ? num : null;
    },
    debug
  );
}

/**
 * Extract square footage from property attributes
 * Field priority: living_area > building_size > lot_size > square_footage
 *
 * Note: building_size from Centris is often a string like "59.11 X 27.7 ft"
 * which is lot dimensions, not square footage. Prefer living_area.
 */
export function extractSquareFootage(attrs: Record<string, any>, debug?: boolean): number | null {
  return tryFields(
    attrs,
    ['living_area', 'square_footage', 'sqft', 'total_area', 'floor_area'],
    'Square Footage',
    (value) => {
      // Handle numeric values
      if (typeof value === 'number' && !isNaN(value) && value > 0) {
        return value;
      }

      // Handle string values (e.g., "1,500 sqft")
      if (typeof value === 'string') {
        // Skip dimension strings like "59.11 X 27.7 ft"
        if (value.includes('X') || value.includes('x')) {
          return null;
        }

        const cleaned = value.replace(/[,\s]/g, '');
        const num = parseFloat(cleaned);
        return (!isNaN(num) && num > 0) ? num : null;
      }

      return null;
    },
    debug
  );
}

/**
 * Extract year built from property attributes
 * Field priority: year_built > construction_year > built_year
 */
export function extractYearBuilt(attrs: Record<string, any>, debug?: boolean): number | null {
  return tryFields(
    attrs,
    ['year_built', 'construction_year', 'built_year', 'year_constructed'],
    'Year Built',
    (value) => {
      const num = typeof value === 'string' ? parseInt(value, 10) : value;
      const currentYear = new Date().getFullYear();

      // Validate year is reasonable (1800 to current year + 2 for pre-construction)
      return (typeof num === 'number' && !isNaN(num) && num >= 1800 && num <= currentYear + 2)
        ? num
        : null;
    },
    debug
  );
}

/**
 * Extract Centris number from property attributes
 * Field priority: centris_no > mls > mls_number
 */
export function extractCentrisNo(attrs: Record<string, any>, debug?: boolean): number | null {
  return tryFields(
    attrs,
    ['centris_no', 'mls', 'mls_number', 'listing_id'],
    'Centris No',
    (value) => {
      // Handle string MLS numbers
      if (typeof value === 'string') {
        const num = parseInt(value, 10);
        return (!isNaN(num) && num > 0) ? num : null;
      }

      // Handle numeric MLS numbers
      if (typeof value === 'number' && !isNaN(value) && value > 0) {
        return Math.floor(value);
      }

      return null;
    },
    debug
  );
}

/**
 * Extract lot size from property attributes
 * Field priority: lot_size > lot_area > land_area
 */
export function extractLotSize(attrs: Record<string, any>, debug?: boolean): number | null {
  return tryFields(
    attrs,
    ['lot_size', 'lot_area', 'land_area', 'lot_sqft'],
    'Lot Size',
    (value) => {
      // Handle numeric values
      if (typeof value === 'number' && !isNaN(value) && value > 0) {
        return value;
      }

      // Handle string values
      if (typeof value === 'string') {
        // Skip dimension strings like "59.11 X 27.7 ft"
        if (value.includes('X') || value.includes('x')) {
          return null;
        }

        const cleaned = value.replace(/[,\s]/g, '');
        const num = parseFloat(cleaned);
        return (!isNaN(num) && num > 0) ? num : null;
      }

      return null;
    },
    debug
  );
}

/**
 * Extract municipality/city from property attributes
 * Field priority: municipality > city > town
 */
export function extractMunicipality(attrs: Record<string, any>, debug?: boolean): string | null {
  return tryFields(
    attrs,
    ['municipality', 'city', 'town', 'location'],
    'Municipality',
    (value) => {
      return (typeof value === 'string' && value.trim().length > 0) ? value.trim() : null;
    },
    debug
  );
}

/**
 * Extract postal code from property attributes
 * Field priority: postal_code > fsa_code > zip_code
 */
export function extractPostalCode(attrs: Record<string, any>, debug?: boolean): string | null {
  return tryFields(
    attrs,
    ['postal_code', 'fsa_code', 'zip_code', 'postalcode'],
    'Postal Code',
    (value) => {
      return (typeof value === 'string' && value.trim().length > 0) ? value.trim() : null;
    },
    debug
  );
}

/**
 * Extract potential gross revenue (PGI) from property attributes
 * For investment/revenue properties only
 */
export function extractPotentialGrossRevenue(attrs: Record<string, any>, debug?: boolean): number | null {
  return tryFields(
    attrs,
    ['potential_gross_revenue', 'gross_revenue', 'pgi', 'annual_revenue', 'rental_income'],
    'Potential Gross Revenue',
    (value) => {
      const num = typeof value === 'string' ? parseFloat(value) : value;
      return (typeof num === 'number' && !isNaN(num) && num > 0) ? num : null;
    },
    debug
  );
}

/**
 * Extract common expenses from property attributes
 * For condos and investment properties
 */
export function extractCommonExpenses(attrs: Record<string, any>, debug?: boolean): number | null {
  return tryFields(
    attrs,
    ['common_expenses', 'condo_fees', 'monthly_fees', 'operating_expenses'],
    'Common Expenses',
    (value) => {
      const num = typeof value === 'string' ? parseFloat(value) : value;
      return (typeof num === 'number' && !isNaN(num) && num >= 0) ? num : null;
    },
    debug
  );
}

/**
 * Extract gross income multiplier from property attributes
 * For investment properties
 */
export function extractGrossIncomeMultiplier(attrs: Record<string, any>, debug?: boolean): number | null {
  return tryFields(
    attrs,
    ['gross_income_multiplier', 'gim', 'income_multiplier'],
    'Gross Income Multiplier',
    (value) => {
      const num = typeof value === 'string' ? parseFloat(value) : value;
      return (typeof num === 'number' && !isNaN(num) && num > 0) ? num : null;
    },
    debug
  );
}

/**
 * Extract all common fields at once from property attributes
 * Returns an object with standardized field names
 */
export interface ExtractedPropertyFields {
  price: number | null;
  status: 'sold' | 'active' | null;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFootage: number | null;
  yearBuilt: number | null;
  centrisNo: number | null;
  lotSize: number | null;
  municipality: string | null;
  postalCode: string | null;

  // Investment property fields
  potentialGrossRevenue: number | null;
  commonExpenses: number | null;
  grossIncomeMultiplier: number | null;
}

/**
 * Extract all property fields at once
 */
export function extractPropertyFields(
  attrs: Record<string, any>,
  debug?: boolean
): ExtractedPropertyFields {
  return {
    price: extractPrice(attrs, debug),
    status: extractStatus(attrs, debug),
    bedrooms: extractBedrooms(attrs, debug),
    bathrooms: extractBathrooms(attrs, debug),
    squareFootage: extractSquareFootage(attrs, debug),
    yearBuilt: extractYearBuilt(attrs, debug),
    centrisNo: extractCentrisNo(attrs, debug),
    lotSize: extractLotSize(attrs, debug),
    municipality: extractMunicipality(attrs, debug),
    postalCode: extractPostalCode(attrs, debug),
    potentialGrossRevenue: extractPotentialGrossRevenue(attrs, debug),
    commonExpenses: extractCommonExpenses(attrs, debug),
    grossIncomeMultiplier: extractGrossIncomeMultiplier(attrs, debug),
  };
}

/**
 * Check if property is a revenue/investment property
 * Returns true if potential_gross_revenue or common_expenses exists
 */
export function isRevenueProperty(attrs: Record<string, any>): boolean {
  const pgi = extractPotentialGrossRevenue(attrs, false);
  const expenses = extractCommonExpenses(attrs, false);
  return (pgi !== null && pgi > 0) || (expenses !== null && expenses > 0);
}

/**
 * Get a summary of missing fields for a property
 * Useful for data quality checks
 */
export function getMissingFields(attrs: Record<string, any>): string[] {
  const fields = extractPropertyFields(attrs, false);
  const missing: string[] = [];

  if (fields.price === null) missing.push('price');
  if (fields.status === null) missing.push('status');
  if (fields.bedrooms === null) missing.push('bedrooms');
  if (fields.bathrooms === null) missing.push('bathrooms');
  if (fields.squareFootage === null) missing.push('squareFootage');
  if (fields.yearBuilt === null) missing.push('yearBuilt');
  if (fields.centrisNo === null) missing.push('centrisNo');

  return missing;
}

/**
 * Calculate data completeness score (0-100)
 * Higher score = more complete data
 */
export function calculateCompletenessScore(attrs: Record<string, any>): number {
  const fields = extractPropertyFields(attrs, false);
  const totalFields = 7; // Core fields: price, status, bedrooms, bathrooms, sqft, year, centris

  let filledFields = 0;
  if (fields.price !== null) filledFields++;
  if (fields.status !== null) filledFields++;
  if (fields.bedrooms !== null) filledFields++;
  if (fields.bathrooms !== null) filledFields++;
  if (fields.squareFootage !== null) filledFields++;
  if (fields.yearBuilt !== null) filledFields++;
  if (fields.centrisNo !== null) filledFields++;

  return Math.round((filledFields / totalFields) * 100);
}
