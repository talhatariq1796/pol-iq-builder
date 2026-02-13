/**
 * Donor Integrator for Comparison Tool
 *
 * Integrates donor data from the FEC-sourced Donor Dashboard into the
 * Comparison Tool, calculating donor concentration metrics per entity.
 */

import type { ComparisonEntity } from './types';
import type {
  DonorConcentrationMetrics,
  DonorComparison,
  DonorIntegrationOptions,
  ZIPAggregateData,
  LapsedDonorData,
  DonorGrowthMetrics,
} from './types-donor';
import { DonorLookup } from './DonorLookup';

const DEFAULT_OPTIONS: DonorIntegrationOptions = {
  includeIEData: false,
  includeLapsedAnalysis: true,
  minDonorThreshold: 5,
};

export class DonorIntegrator {
  private lookup: DonorLookup;
  private zipAggregates: Map<string, ZIPAggregateData>;
  private lapsedDonors: LapsedDonorData[];
  private dataLoaded: boolean = false;

  constructor() {
    this.lookup = new DonorLookup();
    this.zipAggregates = new Map();
    this.lapsedDonors = [];
  }

  /**
   * Load donor data from files
   * Should be called once before using other methods
   */
  async loadData(): Promise<void> {
    if (this.dataLoaded) return;

    try {
      // In browser context, fetch from public folder
      // In Node context, read from filesystem
      const isBrowser = typeof window !== 'undefined';

      if (isBrowser) {
        // Browser: fetch from public folder
        const [zipRes, lapsedRes] = await Promise.all([
          fetch('/data/donors/zip-aggregates.json'),
          fetch('/data/donors/lapsed-donors.json').catch(() => ({ ok: false })),
        ]);

        if (zipRes.ok) {
          const zipData = await zipRes.json();
          if (Array.isArray(zipData)) {
            for (const agg of zipData) {
              this.zipAggregates.set(agg.zipCode, agg);
            }
          } else if (zipData.aggregates) {
            for (const agg of zipData.aggregates) {
              this.zipAggregates.set(agg.zipCode, agg);
            }
          }
        }

        if (lapsedRes && 'ok' in lapsedRes && lapsedRes.ok) {
          const lapsedData = await (lapsedRes as Response).json();
          this.lapsedDonors = Array.isArray(lapsedData) ? lapsedData : (lapsedData.donors || []);
        }
      } else {
        // Node: read from filesystem
        const fs = await import('fs/promises');
        const path = await import('path');

        const publicDir = path.join(process.cwd(), 'public');

        try {
          const zipData = JSON.parse(
            await fs.readFile(path.join(publicDir, 'data/donors/zip-aggregates.json'), 'utf-8')
          );
          if (Array.isArray(zipData)) {
            for (const agg of zipData) {
              this.zipAggregates.set(agg.zipCode, agg);
            }
          } else if (zipData.aggregates) {
            for (const agg of zipData.aggregates) {
              this.zipAggregates.set(agg.zipCode, agg);
            }
          }
        } catch (e) {
          console.warn('Could not load zip-aggregates.json:', e);
        }

        try {
          const lapsedData = JSON.parse(
            await fs.readFile(path.join(publicDir, 'data/donors/lapsed-donors.json'), 'utf-8')
          );
          this.lapsedDonors = Array.isArray(lapsedData) ? lapsedData : (lapsedData.donors || []);
        } catch (e) {
          // Lapsed donors file may not exist yet
          console.warn('Could not load lapsed-donors.json');
        }
      }

      this.dataLoaded = true;
    } catch (error) {
      console.error('Failed to load donor data:', error);
      this.dataLoaded = true; // Mark as loaded to prevent repeated failures
    }
  }

  /**
   * Get donor metrics for an entity
   * Returns null if insufficient donor data
   */
  async getDonorMetrics(
    entity: ComparisonEntity,
    options: Partial<DonorIntegrationOptions> = {}
  ): Promise<DonorConcentrationMetrics | null> {
    await this.loadData();

    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Get ZIP codes for entity
    const mapping = this.lookup.getZIPsForEntity(entity);

    if (mapping.zipCodes.length === 0) {
      return null;
    }

    // Aggregate ZIP data
    const zipData: ZIPAggregateData[] = [];
    for (const zip of mapping.zipCodes) {
      const agg = this.zipAggregates.get(zip);
      if (agg) {
        zipData.push(agg);
      }
    }

    if (zipData.length === 0) {
      return null;
    }

    // Calculate totals
    const totalDonors = zipData.reduce((sum, z) => sum + z.donorCount, 0);

    if (totalDonors < opts.minDonorThreshold) {
      return null;
    }

    const totalRaised = zipData.reduce((sum, z) => sum + z.totalAmount, 0);
    const totalContributions = zipData.reduce((sum, z) => sum + z.contributionCount, 0);
    const avgDonation = totalContributions > 0 ? totalRaised / totalContributions : 0;

    // Calculate median (weighted average of ZIP medians)
    const medianDonation = this.calculateWeightedMedian(zipData);

    // Donor density
    const donorDensity = entity.demographics.totalPopulation > 0
      ? (totalDonors / entity.demographics.totalPopulation) * 1000
      : 0;

    // Calculate composition metrics
    const grassrootsAmount = this.estimateGrassrootsAmount(zipData);
    const majorAmount = this.estimateMajorDonorAmount(zipData);
    const midLevelAmount = totalRaised - grassrootsAmount - majorAmount;

    const grassrootsPct = totalRaised > 0 ? (grassrootsAmount / totalRaised) * 100 : 0;
    const majorDonorsPct = totalRaised > 0 ? (majorAmount / totalRaised) * 100 : 0;
    const midLevelPct = 100 - grassrootsPct - majorDonorsPct;

    // Growth metrics
    const donorGrowth = this.calculateGrowthMetrics(zipData);

    // Party breakdown
    const demAmount = zipData.reduce((sum, z) => sum + z.demAmount, 0);
    const repAmount = zipData.reduce((sum, z) => sum + z.repAmount, 0);
    const partyTotal = demAmount + repAmount;

    // Lapsed donors
    const lapsedInEntity = opts.includeLapsedAnalysis
      ? this.lapsedDonors.filter(d => mapping.zipCodes.includes(d.zipCode)).length
      : 0;

    // Upgrade potential score
    const upgradePotential = this.calculateUpgradePotential(
      avgDonation,
      entity.demographics.medianIncome,
      grassrootsPct
    );

    return {
      totalDonors,
      totalRaised,
      avgDonation: Math.round(avgDonation * 100) / 100,
      medianDonation: Math.round(medianDonation * 100) / 100,
      donorDensity: Math.round(donorDensity * 100) / 100,

      grassrootsPct: Math.round(grassrootsPct * 10) / 10,
      midLevelPct: Math.round(midLevelPct * 10) / 10,
      majorDonorsPct: Math.round(majorDonorsPct * 10) / 10,

      donorGrowth,
      lapsedDonors: lapsedInEntity,
      upgradePotential,

      topOccupations: [], // Would require donor profile data

      demAmount,
      repAmount,
      demPct: partyTotal > 0 ? Math.round((demAmount / partyTotal) * 100) : 0,
      repPct: partyTotal > 0 ? Math.round((repAmount / partyTotal) * 100) : 0,
    };
  }

  /**
   * Compare donor metrics between two entities
   */
  async compareDonorMetrics(
    leftEntity: ComparisonEntity,
    rightEntity: ComparisonEntity,
    options: Partial<DonorIntegrationOptions> = {}
  ): Promise<DonorComparison> {
    const [left, right] = await Promise.all([
      this.getDonorMetrics(leftEntity, options),
      this.getDonorMetrics(rightEntity, options),
    ]);

    const insights = this.generateDonorInsights(left, right, leftEntity.name, rightEntity.name);

    const comparison: DonorComparison = {
      left,
      right,
      insights,
    };

    // Calculate differences if both have data
    if (left && right) {
      comparison.differences = {
        totalRaisedDiff: left.totalRaised - right.totalRaised,
        donorDensityDiff: left.donorDensity - right.donorDensity,
        grassrootsDiff: left.grassrootsPct - right.grassrootsPct,
        lapsedDonorsDiff: left.lapsedDonors - right.lapsedDonors,
      };
    }

    return comparison;
  }

  /**
   * Generate insights comparing two entities' donor profiles
   */
  private generateDonorInsights(
    left: DonorConcentrationMetrics | null,
    right: DonorConcentrationMetrics | null,
    leftName: string,
    rightName: string
  ): string[] {
    const insights: string[] = [];

    if (!left && !right) {
      insights.push('No donor data available for either entity');
      return insights;
    }

    if (!left) {
      insights.push(`No donor data available for ${leftName}`);
      if (right) {
        insights.push(`${rightName} has ${right.totalDonors} donors with $${right.totalRaised.toLocaleString()} raised`);
      }
      return insights;
    }

    if (!right) {
      insights.push(`No donor data available for ${rightName}`);
      insights.push(`${leftName} has ${left.totalDonors} donors with $${left.totalRaised.toLocaleString()} raised`);
      return insights;
    }

    // Both have data - compare

    // Donor density comparison
    if (left.donorDensity > right.donorDensity * 1.5) {
      insights.push(
        `${leftName} has ${(left.donorDensity / right.donorDensity).toFixed(1)}x higher donor density (${left.donorDensity.toFixed(1)} vs ${right.donorDensity.toFixed(1)} per 1000 residents)`
      );
    } else if (right.donorDensity > left.donorDensity * 1.5) {
      insights.push(
        `${rightName} has ${(right.donorDensity / left.donorDensity).toFixed(1)}x higher donor density (${right.donorDensity.toFixed(1)} vs ${left.donorDensity.toFixed(1)} per 1000 residents)`
      );
    }

    // Total raised comparison
    if (left.totalRaised > right.totalRaised * 2) {
      insights.push(
        `${leftName} raised ${(left.totalRaised / right.totalRaised).toFixed(1)}x more ($${left.totalRaised.toLocaleString()} vs $${right.totalRaised.toLocaleString()})`
      );
    } else if (right.totalRaised > left.totalRaised * 2) {
      insights.push(
        `${rightName} raised ${(right.totalRaised / left.totalRaised).toFixed(1)}x more ($${right.totalRaised.toLocaleString()} vs $${left.totalRaised.toLocaleString()})`
      );
    }

    // Grassroots comparison
    if (Math.abs(left.grassrootsPct - right.grassrootsPct) > 15) {
      const higher = left.grassrootsPct > right.grassrootsPct ? leftName : rightName;
      const higherPct = Math.max(left.grassrootsPct, right.grassrootsPct);
      const lowerPct = Math.min(left.grassrootsPct, right.grassrootsPct);
      insights.push(
        `${higher} has stronger grassroots support (${higherPct.toFixed(0)}% vs ${lowerPct.toFixed(0)}% donations under $200)`
      );
    }

    // Lapsed donor opportunity
    if (left.lapsedDonors > 20 || right.lapsedDonors > 20) {
      const entity = left.lapsedDonors > right.lapsedDonors ? leftName : rightName;
      const count = Math.max(left.lapsedDonors, right.lapsedDonors);
      insights.push(`${entity} has ${count} lapsed donors (recovery opportunity)`);
    }

    // Upgrade potential
    if (Math.abs(left.upgradePotential - right.upgradePotential) > 20) {
      const higher = left.upgradePotential > right.upgradePotential ? leftName : rightName;
      const higherScore = Math.max(left.upgradePotential, right.upgradePotential);
      insights.push(`${higher} has higher donor upgrade potential (score: ${higherScore}/100)`);
    }

    return insights;
  }

  // =====================================================================
  // PRIVATE HELPER METHODS
  // =====================================================================

  /**
   * Calculate weighted median from ZIP aggregates
   */
  private calculateWeightedMedian(zipData: ZIPAggregateData[]): number {
    const totalContributions = zipData.reduce((sum, z) => sum + z.contributionCount, 0);
    if (totalContributions === 0) return 0;

    let weightedSum = 0;
    for (const z of zipData) {
      weightedSum += z.medianContribution * z.contributionCount;
    }
    return weightedSum / totalContributions;
  }

  /**
   * Estimate grassroots amount (donations < $200)
   * Uses heuristic: ~60% of contributions are grassroots in typical campaigns
   */
  private estimateGrassrootsAmount(zipData: ZIPAggregateData[]): number {
    // Heuristic: if median is low, more is grassroots
    const avgMedian = zipData.reduce((sum, z) => sum + z.medianContribution, 0) / zipData.length;
    const grassrootsRatio = avgMedian < 100 ? 0.70 : avgMedian < 200 ? 0.55 : 0.40;

    const total = zipData.reduce((sum, z) => sum + z.totalAmount, 0);
    return total * grassrootsRatio;
  }

  /**
   * Estimate major donor amount (donations >= $1000)
   */
  private estimateMajorDonorAmount(zipData: ZIPAggregateData[]): number {
    // Use topDonorCount and maxSingleDonation as indicators
    let majorAmount = 0;
    for (const z of zipData) {
      // Estimate: top donors contribute ~avgMax × count
      const avgMax = z.maxSingleDonation * 0.5; // Conservative estimate
      majorAmount += avgMax * z.topDonorCount;
    }
    return majorAmount;
  }

  /**
   * Calculate growth metrics from ZIP data
   */
  private calculateGrowthMetrics(zipData: ZIPAggregateData[]): DonorGrowthMetrics {
    const amountLast30Days = zipData.reduce((sum, z) => sum + (z.amountLast30Days || 0), 0);
    const amountLast90Days = zipData.reduce((sum, z) => sum + (z.amountLast90Days || 0), 0);
    const amountLast12Months = zipData.reduce((sum, z) => sum + (z.amountLast12Months || 0), 0);
    const totalAmount = zipData.reduce((sum, z) => sum + z.totalAmount, 0);

    // Estimate new donors (rough approximation)
    const avgContribution = totalAmount / Math.max(1, zipData.reduce((sum, z) => sum + z.contributionCount, 0));
    const last30Days = avgContribution > 0 ? Math.round(amountLast30Days / avgContribution / 2) : 0;
    const last90Days = avgContribution > 0 ? Math.round(amountLast90Days / avgContribution / 2) : 0;

    // Year over year (estimate based on recency of contributions)
    const recentRatio = amountLast12Months > 0 && totalAmount > 0
      ? (amountLast12Months / totalAmount) * 100
      : 0;
    const yearOverYear = recentRatio > 50 ? 20 : recentRatio > 30 ? 0 : -20;

    return {
      last30Days,
      last90Days,
      yearOverYear,
      amountLast30Days,
      amountLast90Days,
    };
  }

  /**
   * Calculate upgrade potential score
   * Based on income headroom and current giving level
   */
  private calculateUpgradePotential(
    avgDonation: number,
    medianIncome: number,
    grassrootsPct: number
  ): number {
    // Higher income + lower avg donation = more upgrade potential
    const incomeScore = Math.min(100, (medianIncome / 1000));

    // Higher grassroots % = more upgrade potential (many small donors to upgrade)
    const grassrootsScore = grassrootsPct;

    // Lower avg donation relative to income = more headroom
    const headroomScore = avgDonation > 0
      ? Math.min(100, (medianIncome / avgDonation) * 2)
      : 50;

    return Math.round((incomeScore * 0.3 + grassrootsScore * 0.3 + headroomScore * 0.4));
  }
}
