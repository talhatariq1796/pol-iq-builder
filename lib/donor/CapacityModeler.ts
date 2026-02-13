/**
 * CapacityModeler - Estimate donor giving capacity based on multiple signals
 *
 * Combines ZIP-level income data, occupation indicators, and giving history
 * to estimate how much a donor could realistically give per year.
 *
 * Methodology:
 * 1. ZIP median income provides baseline capacity estimate
 * 2. Occupation adjusts capacity (high-capacity jobs = multiplier)
 * 3. Employer size/type provides additional signal
 * 4. Giving history validates/overrides estimates
 *
 * Confidence levels:
 * - High: Have occupation + employer + giving history
 * - Medium: Have 2 of 3 signals
 * - Low: Only have ZIP income
 *
 * @module lib/donor/CapacityModeler
 */

export interface CapacityFactors {
  zipMedianIncome: number;
  occupationCapacity: 'high' | 'medium' | 'low' | 'unknown';
  employerCapacity: 'high' | 'medium' | 'low' | 'unknown';
  givingHistory: number;
}

export interface CapacityEstimate {
  estimatedAnnualCapacity: number;  // Max they could give per year
  confidenceLevel: 'high' | 'medium' | 'low';
  factorsUsed: string[];
  methodology: string;
}

// High-capacity occupations (typically $200K+ income potential)
const HIGH_CAPACITY_OCCUPATIONS = [
  'attorney', 'lawyer', 'counsel',
  'physician', 'doctor', 'surgeon', 'dentist', 'psychiatrist',
  'executive', 'ceo', 'president', 'chairman', 'chief',
  'owner', 'partner', 'principal',
  'director', 'managing director',
  'investor', 'venture capital', 'private equity',
  'banker', 'investment banker',
  'finance director', 'cfo',
  'consultant', 'partner',
  'architect',
  'actuary',
  'pharmacist',
];

// Medium-capacity occupations (typically $75K-$150K income)
const MEDIUM_CAPACITY_OCCUPATIONS = [
  'manager', 'director',
  'professor', 'associate professor', 'assistant professor',
  'teacher', 'educator',
  'nurse', 'nurse practitioner', 'physician assistant',
  'accountant', 'cpa',
  'realtor', 'real estate agent', 'broker',
  'sales manager', 'sales director',
  'analyst', 'senior analyst',
  'engineer',
  'software developer', 'programmer',
  'project manager',
  'administrator',
  'coordinator',
  'specialist',
];

// High-capacity employer indicators
const HIGH_CAPACITY_EMPLOYERS = [
  'self employed', 'self-employed',
  'retired',
  'law firm', 'llp', 'pllc',
  'investment', 'capital',
  'consulting',
  'fortune 500',
];

export class CapacityModeler {
  /**
   * Estimate donor capacity based on available signals
   *
   * @param factors - Available capacity indicators
   * @returns Capacity estimate with confidence level
   */
  estimateCapacity(factors: CapacityFactors): CapacityEstimate {
    const factorsUsed: string[] = [];
    let baseCapacity = 0;
    let confidencePoints = 0;

    // Factor 1: ZIP median income (always available)
    const incomeCapacity = this.capacityFromIncome(factors.zipMedianIncome);
    baseCapacity = incomeCapacity;
    factorsUsed.push(`ZIP median income: $${factors.zipMedianIncome.toLocaleString()}`);
    confidencePoints += 1;

    // Factor 2: Occupation capacity multiplier
    if (factors.occupationCapacity !== 'unknown') {
      const occupationMultiplier = this.occupationMultiplier(factors.occupationCapacity);
      baseCapacity *= occupationMultiplier;
      factorsUsed.push(`Occupation: ${factors.occupationCapacity} capacity (${occupationMultiplier}x)`);
      confidencePoints += 2; // Occupation is strong signal
    }

    // Factor 3: Employer capacity adjustment
    if (factors.employerCapacity !== 'unknown') {
      const employerMultiplier = this.employerMultiplier(factors.employerCapacity);
      baseCapacity *= employerMultiplier;
      factorsUsed.push(`Employer: ${factors.employerCapacity} capacity (${employerMultiplier}x)`);
      confidencePoints += 1;
    }

    // Factor 4: Giving history validation
    // If donor has given significantly more than base estimate, use history
    if (factors.givingHistory > 0) {
      const historyCapacity = factors.givingHistory * 1.5; // Assume 50% headroom above max gift

      if (historyCapacity > baseCapacity * 1.2) {
        // History suggests higher capacity than demographics
        baseCapacity = Math.max(baseCapacity, historyCapacity);
        factorsUsed.push(`Giving history: $${factors.givingHistory.toLocaleString()} validates higher capacity`);
        confidencePoints += 2; // History is strong validator
      } else {
        factorsUsed.push(`Giving history: $${factors.givingHistory.toLocaleString()}`);
        confidencePoints += 1;
      }
    }

    // Determine confidence level
    let confidenceLevel: 'high' | 'medium' | 'low';
    if (confidencePoints >= 5) {
      confidenceLevel = 'high';
    } else if (confidencePoints >= 3) {
      confidenceLevel = 'medium';
    } else {
      confidenceLevel = 'low';
    }

    // Round to nearest $100
    const estimatedAnnualCapacity = Math.round(baseCapacity / 100) * 100;

    return {
      estimatedAnnualCapacity,
      confidenceLevel,
      factorsUsed,
      methodology: this.describeMethodology(confidenceLevel),
    };
  }

  /**
   * Calculate base capacity from median income
   *
   * Rule of thumb: Political giving capacity is 0.5-1% of household income
   * We use 0.75% as baseline for upper-middle-class donors
   */
  private capacityFromIncome(medianIncome: number): number {
    // Scale giving percentage with income
    let givingPct: number;

    if (medianIncome < 40000) {
      givingPct = 0.001; // 0.1% for lower income
    } else if (medianIncome < 75000) {
      givingPct = 0.003; // 0.3% for middle income
    } else if (medianIncome < 100000) {
      givingPct = 0.005; // 0.5% for upper-middle
    } else if (medianIncome < 150000) {
      givingPct = 0.0075; // 0.75% for high income
    } else if (medianIncome < 250000) {
      givingPct = 0.01; // 1% for very high income
    } else {
      givingPct = 0.015; // 1.5% for wealthy
    }

    return medianIncome * givingPct;
  }

  /**
   * Get occupation-based capacity multiplier
   */
  private occupationMultiplier(capacity: 'high' | 'medium' | 'low'): number {
    switch (capacity) {
      case 'high':
        return 2.0;  // High-capacity jobs earn 2x median
      case 'medium':
        return 1.3;  // Medium-capacity jobs earn 1.3x median
      case 'low':
        return 0.8;  // Low-capacity jobs earn 0.8x median
      default:
        return 1.0;
    }
  }

  /**
   * Get employer-based capacity multiplier
   */
  private employerMultiplier(capacity: 'high' | 'medium' | 'low'): number {
    switch (capacity) {
      case 'high':
        return 1.3;  // Self-employed, partners, etc. have higher capacity
      case 'medium':
        return 1.1;  // Stable employers
      case 'low':
        return 0.9;  // Lower-paying employers
      default:
        return 1.0;
    }
  }

  /**
   * Classify occupation capacity level
   */
  classifyOccupation(occupation?: string): 'high' | 'medium' | 'low' | 'unknown' {
    if (!occupation) return 'unknown';

    const occ = occupation.toLowerCase().trim();

    // Check high-capacity occupations
    for (const keyword of HIGH_CAPACITY_OCCUPATIONS) {
      if (occ.includes(keyword)) {
        return 'high';
      }
    }

    // Check medium-capacity occupations
    for (const keyword of MEDIUM_CAPACITY_OCCUPATIONS) {
      if (occ.includes(keyword)) {
        return 'medium';
      }
    }

    // Common low-capacity indicators
    const lowCapacityKeywords = [
      'retired', 'homemaker', 'student', 'unemployed',
      'assistant', 'clerk', 'cashier', 'server',
      'driver', 'laborer', 'worker'
    ];

    for (const keyword of lowCapacityKeywords) {
      if (occ.includes(keyword)) {
        return 'low';
      }
    }

    return 'unknown';
  }

  /**
   * Classify employer capacity level
   */
  classifyEmployer(employer?: string): 'high' | 'medium' | 'low' | 'unknown' {
    if (!employer) return 'unknown';

    const emp = employer.toLowerCase().trim();

    // Check high-capacity employers
    for (const keyword of HIGH_CAPACITY_EMPLOYERS) {
      if (emp.includes(keyword)) {
        return 'high';
      }
    }

    // Check for specific employer types
    if (emp.includes('university') || emp.includes('college')) {
      return 'medium'; // Academia typically medium capacity
    }

    if (emp.includes('government') || emp.includes('city of') || emp.includes('state of')) {
      return 'medium'; // Public sector typically medium
    }

    if (emp.includes('hospital') || emp.includes('health') || emp.includes('medical')) {
      return 'medium'; // Healthcare typically medium-high
    }

    // If we have an employer but can't classify, assume medium
    return 'medium';
  }

  /**
   * Describe the methodology used for capacity estimation
   */
  private describeMethodology(confidence: 'high' | 'medium' | 'low'): string {
    switch (confidence) {
      case 'high':
        return 'Capacity estimated from ZIP income, occupation, employer, and giving history. High confidence.';
      case 'medium':
        return 'Capacity estimated from ZIP income with partial occupation/employer data. Medium confidence.';
      case 'low':
        return 'Capacity estimated from ZIP income only. Low confidence - consider acquiring more data.';
    }
  }

  /**
   * Batch estimate capacities for multiple donors
   */
  batchEstimate(
    donorFactors: Array<{ donorId: string; factors: CapacityFactors }>
  ): Map<string, CapacityEstimate> {
    const results = new Map<string, CapacityEstimate>();

    for (const { donorId, factors } of donorFactors) {
      const estimate = this.estimateCapacity(factors);
      results.set(donorId, estimate);
    }

    return results;
  }
}
