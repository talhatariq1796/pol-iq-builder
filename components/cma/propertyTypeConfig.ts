/**
 * Property Type Configuration
 *
 * Defines property types, their categories (residential vs revenue),
 * and validation rules for CMA filter dialog.
 */

export type PropertyCategory = 'residential' | 'revenue';

export interface PropertyTypeDefinition {
  id: string;
  label: string;
  category: PropertyCategory;
  description: string;
  icon?: string;
}

/**
 * Residential Property Types
 * Can be mixed together in CMA analysis
 */
export const RESIDENTIAL_PROPERTY_TYPES: PropertyTypeDefinition[] = [
  {
    id: 'house',
    label: 'Single-Family House',
    category: 'residential',
    description: 'Detached single-family homes',
    icon: '🏠',
  },
  {
    id: 'condo',
    label: 'Condo/Apartment',
    category: 'residential',
    description: 'Condominiums and apartments',
    icon: '🏢',
  },
  {
    id: 'townhouse',
    label: 'Townhouse',
    category: 'residential',
    description: 'Attached townhouses',
    icon: '🏘️',
  },
];

/**
 * Revenue Property Types (Investment Properties)
 * Can be mixed together in CMA analysis
 * CANNOT be mixed with residential types
 */
export const REVENUE_PROPERTY_TYPES: PropertyTypeDefinition[] = [
  {
    id: 'duplex',
    label: 'Duplex (2-4 units)',
    category: 'revenue',
    description: 'Small multi-unit residential buildings',
    icon: '🏚️',
  },
  {
    id: 'multiplex',
    label: 'Multiplex (5+ units)',
    category: 'revenue',
    description: 'Larger multi-unit residential buildings',
    icon: '🏬',
  },
  {
    id: 'commercial',
    label: 'Commercial Property',
    category: 'revenue',
    description: 'Retail, office, and commercial spaces',
    icon: '🏪',
  },
];

/**
 * All property types combined
 */
export const ALL_PROPERTY_TYPES: PropertyTypeDefinition[] = [
  ...RESIDENTIAL_PROPERTY_TYPES,
  ...REVENUE_PROPERTY_TYPES,
];

/**
 * Get property category from type ID
 */
export function getPropertyCategory(typeId: string): PropertyCategory | null {
  const type = ALL_PROPERTY_TYPES.find(t => t.id === typeId);
  return type?.category || null;
}

/**
 * Get property types for a given category
 */
export function getPropertyTypesByCategory(category: PropertyCategory): PropertyTypeDefinition[] {
  return ALL_PROPERTY_TYPES.filter(t => t.category === category);
}

/**
 * Validate that property types don't mix categories
 * Returns error message if invalid, null if valid
 */
export function validatePropertyTypeSelection(selectedTypes: string[]): string | null {
  if (selectedTypes.length === 0) {
    return null; // Empty selection is valid (will show all)
  }

  const categories = new Set(
    selectedTypes
      .map(id => getPropertyCategory(id))
      .filter((cat): cat is PropertyCategory => cat !== null)
  );

  if (categories.size > 1) {
    return '⚠️ Cannot mix Residential and Revenue properties in the same analysis. Please select properties from one category only.';
  }

  return null;
}

/**
 * Get the dominant category from selected types
 * Returns null if no types selected or mixed categories
 */
export function getDominantCategory(selectedTypes: string[]): PropertyCategory | null {
  if (selectedTypes.length === 0) return null;

  const categories = selectedTypes
    .map(id => getPropertyCategory(id))
    .filter((cat): cat is PropertyCategory => cat !== null);

  const uniqueCategories = new Set(categories);

  // Mixed categories = invalid
  if (uniqueCategories.size > 1) return null;

  // Single category
  return categories[0] || null;
}

/**
 * Filter properties by selected types and category
 */
export function filterPropertiesByType(
  properties: any[],
  selectedTypes: string[],
  allowedCategory?: PropertyCategory
): any[] {
  // No filter = show all
  if (selectedTypes.length === 0 && !allowedCategory) {
    console.log('[filterPropertiesByType] No filters, returning all', properties.length, 'properties');
    return properties;
  }

  console.log('[filterPropertiesByType] Filtering with:', {
    selectedTypes,
    allowedCategory,
    totalProperties: properties.length
  });

  const filtered = properties.filter((prop, index) => {
    // Check for property type in multiple locations (top-level and nested in properties)
    const propType = prop.pt ||
                     prop.property_type ||
                     prop.propertyType ||
                     prop.properties?.pt ||
                     prop.properties?.property_type ||
                     prop.properties?.propertyType;
    const sourcePropertyType = prop.sourcePropertyType || prop.properties?.sourcePropertyType;
    const isRevenueProperty = prop.isRevenueProperty || false;

    // Debug first 3 properties
    if (index < 3) {
      console.log(`[filterPropertiesByType] Property ${index}:`, {
        address: prop.address,
        pt: propType,
        sourcePropertyType,
        isRevenueProperty,
        propCategory: isRevenueProperty ? 'revenue' : 'residential'
      });
    }

    // If category restriction exists, enforce it
    if (allowedCategory) {
      const propCategory: PropertyCategory = isRevenueProperty ? 'revenue' : 'residential';
      if (propCategory !== allowedCategory) {
        if (index < 3) {
          console.log(`  ❌ Category mismatch: ${propCategory} !== ${allowedCategory}`);
        }
        return false;
      }
    }

    // If specific types selected, check if property matches
    if (selectedTypes.length > 0) {
      // First, try to match using sourcePropertyType (most reliable)
      if (sourcePropertyType) {
        const matches = selectedTypes.includes(sourcePropertyType);
        if (index < 3) {
          console.log(`  ${matches ? '✅' : '❌'} Source type match: ${sourcePropertyType}, in [${selectedTypes.join(', ')}]? ${matches}`);
        }
        return matches;
      }

      // Fallback to pt field mapping if sourcePropertyType not available
      if (!propType) {
        if (index < 3) {
          console.log('  ❌ No property type found');
        }
        return false;
      }

      // Map property type codes to our IDs
      const typeMapping: Record<string, string> = {
        // Houses
        'SF': 'house',
        'BUN': 'house',      // Bungalow
        'SL': 'house',       // Split-level
        'CT': 'house',       // Cottage (detached house)
        '1HS': 'house',      // 1.5 story house
        '2HS': 'house',      // 2 story house
        'MH': 'house',       // Mobile home

        // Condos
        'APT': 'condo',      // Apartment
        'HOU': 'condo',      // House-style condo
        'LS': 'condo',       // Loft/Studio
        'CO': 'condo',       // Condo
        'TH': 'townhouse',   // Townhouse

        // Revenue Properties
        '2X': 'duplex',      // Duplex
        '3X': 'multiplex',   // Triplex
        '4X': 'multiplex',   // Quadplex
        '5X': 'multiplex',   // 5-plex
        'DP': 'duplex',      // Duplex (alt code)
        'MP': 'multiplex',   // Multiplex
        'CM': 'commercial',  // Commercial/Mixed use
        'OTH': 'multiplex',  // Other revenue (treat as multiplex)
      };

      const mappedType = typeMapping[propType] || propType.toLowerCase();
      const matches = selectedTypes.includes(mappedType);

      if (index < 3) {
        console.log(`  ${matches ? '✅' : '❌'} PT field match: ${propType} → ${mappedType}, in [${selectedTypes.join(', ')}]? ${matches}`);
      }

      return matches;
    }

    if (index < 3) {
      console.log('  ✅ No type filter, keeping property');
    }
    return true;
  });

  console.log(`[filterPropertiesByType] Result: ${filtered.length}/${properties.length} properties matched`);
  return filtered;
}

/**
 * Get user-friendly label for property category
 */
export function getCategoryLabel(category: PropertyCategory): string {
  return category === 'residential'
    ? 'Residential Properties'
    : 'Revenue Properties (Investment)';
}

/**
 * Get description for property category
 */
export function getCategoryDescription(category: PropertyCategory): string {
  if (category === 'residential') {
    return 'Single-family homes, condos, and townhouses for owner-occupancy';
  } else {
    return 'Multi-unit buildings and commercial properties generating rental income';
  }
}
