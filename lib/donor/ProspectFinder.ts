/**
 * ProspectFinder - Identifies high-capacity areas with low donor penetration
 *
 * This class analyzes ZIP code donor data and demographics to find prospect areas
 * where donor participation is below the county/region average, but where demographic
 * indicators suggest high fundraising potential.
 */

import type {
  ZIPAggregate,
  ZIPDemographics,
  ProspectOptions,
  ProspectArea,
} from './types';

export class ProspectFinder {
  /**
   * Find high-capacity areas with low donor penetration
   *
   * Algorithm:
   * 1. Calculate county-wide benchmarks (average donor rate, average gift size)
   * 2. For each ZIP with demographic data:
   *    - Skip if median income below threshold
   *    - Calculate donor rate gap as percentage below average
   *    - Skip if gap is not significant enough
   *    - Estimate fundraising potential based on untapped donors
   *    - Calculate composite score considering income, population, and gap
   * 3. Sort by score descending and return top prospects
   *
   * @param zipAggregates - Map of ZIP codes to aggregated donor data
   * @param demographics - Map of ZIP codes to demographic data
   * @param options - Filtering and threshold options
   * @returns Array of ProspectArea objects sorted by score (highest first)
   */
  findProspectAreas(
    zipAggregates: Map<string, ZIPAggregate>,
    demographics: Map<string, ZIPDemographics>,
    options: ProspectOptions
  ): ProspectArea[] {
    const prospects: ProspectArea[] = [];

    // Step 1: Calculate county-wide benchmarks
    const allAggregates = Array.from(zipAggregates.values());

    // Calculate average donor rate (donors per 1000 population)
    const totalDonors = allAggregates.reduce((sum, z) => sum + z.donorCount, 0);
    const totalPopulation = allAggregates.reduce((sum, z) => {
      const demo = demographics.get(z.zipCode);
      return sum + (demo?.population || 0);
    }, 0);

    const avgDonorRate = totalPopulation > 0
      ? (totalDonors / totalPopulation) * 1000
      : 0;

    // Calculate average gift size
    const totalAmount = allAggregates.reduce((sum, z) => sum + z.totalAmount, 0);
    const avgGiftSize = totalDonors > 0
      ? totalAmount / totalDonors
      : 0;

    // Handle edge case: no data available
    if (avgDonorRate === 0 || avgGiftSize === 0) {
      return prospects;
    }

    // Step 2: Analyze each ZIP code with demographic data
    for (const [zip, demo] of demographics) {
      // Skip if doesn't meet minimum income threshold
      if (demo.medianIncome < options.minMedianIncome) {
        continue;
      }

      const agg = zipAggregates.get(zip);

      // Calculate current donor rate for this ZIP
      const currentDonors = agg?.donorCount || 0;
      const zipDonorRate = demo.population > 0
        ? (currentDonors / demo.population) * 1000
        : 0;

      // Calculate donor rate gap as percentage below average
      const gapPercent = avgDonorRate > 0
        ? ((avgDonorRate - zipDonorRate) / avgDonorRate) * 100
        : 0;

      // Skip if gap is not significant enough
      if (gapPercent < options.minDonorGap) {
        continue;
      }

      // Estimate potential donors and fundraising potential
      const expectedDonors = (demo.population / 1000) * avgDonorRate;
      const untappedDonors = Math.max(0, expectedDonors - currentDonors);

      // Conservative estimate (50% of average) to high estimate (150% of average)
      const potentialLow = untappedDonors * avgGiftSize * 0.5;
      const potentialHigh = untappedDonors * avgGiftSize * 1.5;

      // Calculate composite score:
      // - gapPercent/100: Weight by how far below average (0-1+)
      // - medianIncome/50000: Weight by income capacity (normalized to $50K baseline)
      // - log10(population): Weight by population size (logarithmic to avoid skew)
      const score =
        (gapPercent / 100) *
        (demo.medianIncome / 50000) *
        Math.log10(Math.max(10, demo.population));

      prospects.push({
        zipCode: zip,
        city: demo.city,
        medianIncome: demo.medianIncome,
        population: demo.population,
        currentDonorRate: zipDonorRate,
        avgDonorRate,
        gapPercent,
        potentialLow,
        potentialHigh,
        score,
      });
    }

    // Step 3: Sort by score descending (highest potential first)
    prospects.sort((a, b) => b.score - a.score);

    return prospects;
  }

  /**
   * Format prospect area for display
   *
   * @param prospect - ProspectArea to format
   * @returns Formatted string representation
   */
  formatProspect(prospect: ProspectArea): string {
    const income = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(prospect.medianIncome);

    const potentialLow = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(prospect.potentialLow);

    const potentialHigh = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(prospect.potentialHigh);

    return [
      `ZIP: ${prospect.zipCode} (${prospect.city})`,
      `Median Income: ${income}`,
      `Donor Rate: ${prospect.currentDonorRate.toFixed(1)}/1K (${prospect.gapPercent.toFixed(0)}% below average)`,
      `Potential: ${potentialLow}-${potentialHigh}`,
      `Score: ${prospect.score.toFixed(2)}`,
    ].join(' | ');
  }

  /**
   * Get summary statistics for a list of prospects
   *
   * @param prospects - Array of ProspectArea objects
   * @returns Summary statistics
   */
  getProspectSummary(prospects: ProspectArea[]): {
    totalZips: number;
    totalPopulation: number;
    avgMedianIncome: number;
    totalPotentialLow: number;
    totalPotentialHigh: number;
    avgGapPercent: number;
  } {
    if (prospects.length === 0) {
      return {
        totalZips: 0,
        totalPopulation: 0,
        avgMedianIncome: 0,
        totalPotentialLow: 0,
        totalPotentialHigh: 0,
        avgGapPercent: 0,
      };
    }

    return {
      totalZips: prospects.length,
      totalPopulation: prospects.reduce((sum, p) => sum + p.population, 0),
      avgMedianIncome: prospects.reduce((sum, p) => sum + p.medianIncome, 0) / prospects.length,
      totalPotentialLow: prospects.reduce((sum, p) => sum + p.potentialLow, 0),
      totalPotentialHigh: prospects.reduce((sum, p) => sum + p.potentialHigh, 0),
      avgGapPercent: prospects.reduce((sum, p) => sum + p.gapPercent, 0) / prospects.length,
    };
  }

  /**
   * Filter prospects by party affiliation
   *
   * This method examines existing donor patterns in the ZIP aggregate data
   * to determine if a prospect area aligns with a specific party preference.
   *
   * @param prospects - Array of ProspectArea objects
   * @param zipAggregates - Map of ZIP codes to aggregated donor data
   * @param party - Party preference ('DEM', 'REP', or 'all')
   * @returns Filtered array of prospects
   */
  filterByParty(
    prospects: ProspectArea[],
    zipAggregates: Map<string, ZIPAggregate>,
    party: 'DEM' | 'REP' | 'all'
  ): ProspectArea[] {
    if (party === 'all') {
      return prospects;
    }

    return prospects.filter((prospect) => {
      const agg = zipAggregates.get(prospect.zipCode);
      if (!agg) {
        // No donor history - can't determine party preference
        return true;
      }

      // Determine if this ZIP leans toward the requested party
      const demShare = agg.totalAmount > 0
        ? agg.demAmount / agg.totalAmount
        : 0.5;

      if (party === 'DEM') {
        // Include if more than 50% of contributions went to Democrats
        return demShare > 0.5;
      } else {
        // Include if more than 50% of contributions went to Republicans
        return demShare < 0.5;
      }
    });
  }
}
