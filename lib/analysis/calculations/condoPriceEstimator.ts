/**
 * Condo Price Estimator
 *
 * Calculates estimated condo prices based on square footage and comparable sold properties.
 * Uses average price per square foot from comparable sales to estimate property value.
 *
 * @module lib/analysis/calculations/condoPriceEstimator
 */

export interface CondoPriceEstimate {
  estimatedPrice: number;
  avgPricePerSqFt: number;
  calculationExplanation: string;
  comparablesUsed: number;
  priceRange?: { min: number; max: number };
  confidenceLevel?: 'high' | 'medium' | 'low';
}

export interface ComparableProperty {
  st?: string; // Status field: 'SO' = Sold, 'AC' = Active
  status?: string;
  building_size?: number;
  squareFootage?: number;
  askedsold_price?: number;
  price?: number;
  address?: string;
}

/**
 * Estimates condo price based on user-entered square footage and comparable sales
 *
 * Calculation:
 * 1. Filter sold condos with valid building_size and price
 * 2. Calculate average price per sqft: Sum(prices) / Sum(square footage)
 * 3. Estimated price = user sqft × avg price per sqft
 * 4. Calculate price range: ±15% of estimate
 * 5. Determine confidence level based on number of comparables
 *
 * @param userSquareFootage - Square footage entered by user
 * @param comparableCondos - Array of comparable condo properties
 * @returns Price estimate with detailed calculation explanation
 */
export function estimateCondoPrice(
  userSquareFootage: number,
  comparableCondos: ComparableProperty[]
): CondoPriceEstimate {
  // Filter for sold condos with valid size and price data
  const soldCondos = comparableCondos.filter(p => {
    const isSold = p.st === 'SO' || p.st === 'so' || p.status === 'sold';
    const hasSize = (p.building_size || p.squareFootage || 0) > 0;
    const hasPrice = (p.askedsold_price || p.price || 0) > 0;

    return isSold && hasSize && hasPrice;
  });

  console.log('[condoPriceEstimator] Filtering comparables:', {
    totalComparables: comparableCondos.length,
    soldWithData: soldCondos.length,
    userSquareFootage
  });

  // Handle case with insufficient data
  if (soldCondos.length === 0) {
    return {
      estimatedPrice: 0,
      avgPricePerSqFt: 0,
      calculationExplanation: 'Unable to estimate price: No comparable sold condos found with valid data.',
      comparablesUsed: 0,
      confidenceLevel: 'low'
    };
  }

  // Calculate totals
  const totalPrice = soldCondos.reduce((sum, p) => {
    return sum + (p.askedsold_price || p.price || 0);
  }, 0);

  const totalSqFt = soldCondos.reduce((sum, p) => {
    return sum + (p.building_size || p.squareFootage || 0);
  }, 0);

  // Calculate average price per sqft
  const avgPricePerSqFt = totalSqFt > 0 ? totalPrice / totalSqFt : 0;

  // Calculate estimated price
  const estimatedPrice = Math.round(userSquareFootage * avgPricePerSqFt);

  // Calculate price range (±15%)
  const priceRange = {
    min: Math.round(estimatedPrice * 0.85),
    max: Math.round(estimatedPrice * 1.15)
  };

  // Determine confidence level
  let confidenceLevel: 'high' | 'medium' | 'low' = 'low';
  if (soldCondos.length >= 10) {
    confidenceLevel = 'high';
  } else if (soldCondos.length >= 5) {
    confidenceLevel = 'medium';
  }

  // Generate detailed explanation
  const explanation = `
📊 CONDO PRICE ESTIMATE CALCULATION

Based on ${soldCondos.length} comparable sold condos:

🏢 User Property:
   Square Footage: ${userSquareFootage.toLocaleString()} sqft

💰 Market Analysis:
   Average Price per Sqft: $${avgPricePerSqFt.toFixed(2)}/sqft
   Total Comparable Sales: $${totalPrice.toLocaleString()}
   Total Square Footage Analyzed: ${totalSqFt.toLocaleString()} sqft

🎯 Price Estimate:
   Estimated Price: $${estimatedPrice.toLocaleString()}
   Price Range: $${priceRange.min.toLocaleString()} - $${priceRange.max.toLocaleString()}
   Confidence Level: ${confidenceLevel.toUpperCase()}

📐 Calculation:
   ${userSquareFootage.toLocaleString()} sqft × $${avgPricePerSqFt.toFixed(2)}/sqft = $${estimatedPrice.toLocaleString()}

⚠️ IMPORTANT CONSIDERATIONS:
This is a simplified estimate based solely on square footage. Actual condo prices vary significantly based on:

• Floor Level & Views: Higher floors with better views command premium prices
• Building Amenities: Pool, gym, concierge, parking, storage
• Renovation Quality: Updated kitchens, bathrooms, flooring
• Unit Layout: Open concept vs. traditional, natural light
• Building Condition: Age, maintenance, reserve fund status
• Condo Fees: Monthly fees impact affordability and value
• Location Within Building: Corner units, end units, noise factors
• Market Timing: Seasonal variations and market conditions

📋 Recommendation:
For accurate pricing, consider hiring a professional appraiser who can account for all these factors and provide a detailed comparative market analysis specific to the building and unit characteristics.
  `.trim();

  console.log('[condoPriceEstimator] Estimate calculated:', {
    estimatedPrice,
    avgPricePerSqFt: avgPricePerSqFt.toFixed(2),
    comparablesUsed: soldCondos.length,
    confidenceLevel,
    priceRange
  });

  return {
    estimatedPrice,
    avgPricePerSqFt,
    calculationExplanation: explanation,
    comparablesUsed: soldCondos.length,
    priceRange,
    confidenceLevel
  };
}

/**
 * Formats price estimate for display in UI
 *
 * @param estimate - Price estimate object
 * @returns Formatted string for display
 */
export function formatPriceEstimate(estimate: CondoPriceEstimate): string {
  if (estimate.comparablesUsed === 0) {
    return 'Unable to estimate (no comparables)';
  }

  return `$${estimate.estimatedPrice.toLocaleString()} (${estimate.confidenceLevel} confidence, ${estimate.comparablesUsed} comps)`;
}

/**
 * Gets suggested square footage ranges by property type
 *
 * @param propertyType - Type of property
 * @returns Min/max square footage range
 */
export function getSuggestedSqftRange(propertyType: string): { min: number; max: number } {
  const ranges: Record<string, { min: number; max: number }> = {
    condo: { min: 600, max: 1500 },
    apartment: { min: 500, max: 1200 },
    townhouse: { min: 1200, max: 2000 },
    loft: { min: 800, max: 2500 }
  };

  return ranges[propertyType.toLowerCase()] || { min: 600, max: 1500 };
}
