/**
 * Core segmentation engine for filtering and matching precincts
 * based on multi-dimensional criteria.
 */

import type {
  SegmentFilters,
  SegmentResults,
  PrecinctMatch,
  DemographicFilters,
  PoliticalFilters,
  TargetingFilters,
  EngagementFilters,
} from './types';

// Actual precinct data structure from ingham_precincts.json
interface PrecinctData {
  id: string;
  name: string;
  jurisdiction: string; // Simple string like "East Lansing"
  jurisdictionType: 'city' | 'township';

  demographics: {
    totalPopulation: number;
    population18up: number;
    medianAge: number;
    medianHHI: number;
    collegePct: number;
    homeownerPct: number;
    diversityIndex: number;
    populationDensity: number;
  };

  political: {
    demAffiliationPct: number;
    repAffiliationPct: number;
    independentPct: number;
    liberalPct: number;
    moderatePct: number;
    conservativePct: number;
  };

  electoral: {
    partisanLean: number;
    swingPotential: number;
    competitiveness: 'safe_d' | 'likely_d' | 'lean_d' | 'toss_up' | 'lean_r' | 'likely_r' | 'safe_r';
    avgTurnout: number;
    turnoutDropoff: number;
  };

  targeting: {
    gotvPriority: number;
    persuasionOpportunity: number;
    combinedScore: number;
    strategy: string;
  };

  engagement?: {
    politicalDonorPct: number;
    activistPct: number;
    cnnMsnbcPct: number;
    foxNewsmaxPct: number;
    nprPct: number;
    socialMediaPct: number;
    facebookPct: number;
    youtubePct: number;
  };
}

type DensityType = 'urban' | 'suburban' | 'rural';

/**
 * Main segmentation engine class
 */
export class SegmentEngine {
  private precincts: PrecinctData[];

  /**
   * Create a new SegmentEngine
   * @param precincts - Array of precinct data to query against
   */
  constructor(precincts: PrecinctData[]) {
    this.precincts = precincts;
  }

  /**
   * Execute a segment query with the given filters
   * @param filters - Multi-dimensional filter criteria
   * @returns Matching precincts and aggregate statistics
   */
  query(filters: SegmentFilters): SegmentResults {
    const matchingPrecincts: PrecinctMatch[] = [];

    for (const precinct of this.precincts) {
      if (this.matchesAllFilters(precinct, filters)) {
        const match: PrecinctMatch = {
          precinctId: precinct.id,
          precinctName: precinct.name,
          jurisdiction: precinct.jurisdiction,
          registeredVoters: precinct.demographics.population18up,
          gotvPriority: precinct.targeting.gotvPriority,
          persuasionOpportunity: precinct.targeting.persuasionOpportunity,
          swingPotential: precinct.electoral.swingPotential,
          targetingStrategy: precinct.targeting.strategy,
          partisanLean: precinct.electoral.partisanLean,
          matchScore: this.calculateMatchScore(precinct, filters),
        };
        matchingPrecincts.push(match);
      }
    }

    // Sort by match score descending
    matchingPrecincts.sort((a, b) => b.matchScore - a.matchScore);

    // Calculate aggregates
    const stats = this.calculateAggregates(matchingPrecincts);

    return {
      matchingPrecincts,
      precinctCount: matchingPrecincts.length,
      totalPrecincts: matchingPrecincts.length, // Alias
      percentageOfTotal: (matchingPrecincts.length / this.precincts.length) * 100,
      ...stats,
      calculatedAt: new Date().toISOString(),
    };
  }

  /**
   * Check if a precinct matches all filter categories
   */
  private matchesAllFilters(precinct: PrecinctData, filters: SegmentFilters): boolean {
    if (filters.demographics && !this.matchesDemographics(precinct, filters.demographics)) {
      return false;
    }
    if (filters.political && !this.matchesPolitical(precinct, filters.political)) {
      return false;
    }
    if (filters.targeting && !this.matchesTargeting(precinct, filters.targeting)) {
      return false;
    }
    if (filters.engagement && !this.matchesEngagement(precinct, filters.engagement)) {
      return false;
    }
    return true;
  }

  /**
   * Check if precinct matches demographic filters
   */
  private matchesDemographics(precinct: PrecinctData, filters: DemographicFilters): boolean {
    const demo = precinct.demographics;

    // Age range (component format)
    if (filters.ageRange) {
      const [minAge, maxAge] = filters.ageRange;
      if (demo.medianAge < minAge || demo.medianAge > maxAge) {
        return false;
      }
    }
    // Age range - preset format (age_range: { min_median_age, max_median_age })
    if (filters.age_range) {
      const minAge = filters.age_range.min_median_age ?? 0;
      const maxAge = filters.age_range.max_median_age ?? 120;
      if (demo.medianAge < minAge || demo.medianAge > maxAge) {
        return false;
      }
    }

    // Age cohort (component format)
    if (filters.ageCohort) {
      const age = demo.medianAge;
      switch (filters.ageCohort) {
        case 'young':
          if (age >= 35) return false;
          break;
        case 'middle':
          if (age < 35 || age >= 55) return false;
          break;
        case 'senior':
          if (age < 55) return false;
          break;
      }
    }
    // Age cohort - preset format (age_cohort_emphasis)
    if (filters.age_cohort_emphasis) {
      const age = demo.medianAge;
      switch (filters.age_cohort_emphasis) {
        case 'young':
          if (age >= 35) return false;
          break;
        case 'middle':
          if (age < 35 || age >= 55) return false;
          break;
        case 'senior':
          if (age < 55) return false;
          break;
      }
    }

    // Income range (component format)
    if (filters.incomeRange) {
      const [minIncome, maxIncome] = filters.incomeRange;
      if (demo.medianHHI < minIncome || demo.medianHHI > maxIncome) {
        return false;
      }
    }
    // Income range - preset format (income_range: { min_median_hhi, max_median_hhi })
    if (filters.income_range) {
      const minIncome = filters.income_range.min_median_hhi ?? 0;
      const maxIncome = filters.income_range.max_median_hhi ?? 10000000;
      if (demo.medianHHI < minIncome || demo.medianHHI > maxIncome) {
        return false;
      }
    }

    // Income level (component format)
    if (filters.incomeLevel) {
      const income = demo.medianHHI;
      switch (filters.incomeLevel) {
        case 'low':
          if (income >= 40000) return false;
          break;
        case 'middle':
          if (income < 40000 || income >= 75000) return false;
          break;
        case 'upper_middle':
          if (income < 75000 || income >= 125000) return false;
          break;
        case 'high':
          if (income < 125000) return false;
          break;
      }
    }
    // Income level - preset format (income_level)
    if (filters.income_level) {
      const income = demo.medianHHI;
      switch (filters.income_level) {
        case 'low':
          if (income >= 40000) return false;
          break;
        case 'middle':
          if (income < 40000 || income >= 75000) return false;
          break;
        case 'upper_middle':
          if (income < 75000 || income >= 125000) return false;
          break;
        case 'high':
          if (income < 125000) return false;
          break;
      }
    }

    // Education level (component format)
    if (filters.educationLevel) {
      const collegePct = demo.collegePct;
      switch (filters.educationLevel) {
        case 'high_school':
          if (collegePct >= 25) return false;
          break;
        case 'some_college':
          if (collegePct < 25 || collegePct >= 50) return false;
          break;
        case 'bachelors':
          if (collegePct < 50 || collegePct >= 75) return false;
          break;
        case 'graduate':
          if (collegePct < 75) return false;
          break;
      }
    }
    // Education level - preset format (education_level)
    if (filters.education_level) {
      const collegePct = demo.collegePct;
      switch (filters.education_level) {
        case 'high_school':
          if (collegePct >= 25) return false;
          break;
        case 'some_college':
          if (collegePct < 25 || collegePct >= 50) return false;
          break;
        case 'bachelors':
          if (collegePct < 50 || collegePct >= 75) return false;
          break;
        case 'graduate':
          if (collegePct < 75) return false;
          break;
      }
    }

    // Min college percentage (component format)
    if (filters.minCollegePct !== undefined && demo.collegePct < filters.minCollegePct) {
      return false;
    }
    // Min college percentage - preset format (min_college_pct)
    if (filters.min_college_pct !== undefined && demo.collegePct < filters.min_college_pct) {
      return false;
    }

    // Housing type (support both naming conventions)
    const housingType = filters.housing_type;
    if (housingType) {
      const ownerPct = demo.homeownerPct;
      switch (housingType) {
        case 'owner':
          if (ownerPct < 60) return false;
          break;
        case 'renter':
          if (ownerPct >= 40) return false;
          break;
        case 'mixed':
          if (ownerPct < 40 || ownerPct >= 60) return false;
          break;
      }
    }

    // Min homeowner percentage
    if (filters.minHomeownerPct !== undefined && demo.homeownerPct < filters.minHomeownerPct) {
      return false;
    }

    // Density type (component format - accepts array)
    if (filters.density && filters.density.length > 0) {
      const densityType = this.categorizeDensity(demo.populationDensity);
      if (!filters.density.includes(densityType)) {
        return false;
      }
    }
    // Density - preset format (density_type - single value)
    if (filters.density_type) {
      const densityType = this.categorizeDensity(demo.populationDensity);
      if (densityType !== filters.density_type) {
        return false;
      }
    }

    // Diversity range (component format)
    if (filters.diversityRange) {
      const [minDiv, maxDiv] = filters.diversityRange;
      if (demo.diversityIndex < minDiv || demo.diversityIndex > maxDiv) {
        return false;
      }
    }
    // Diversity - preset format (min_diversity_index, max_diversity_index)
    if (filters.min_diversity_index !== undefined || filters.max_diversity_index !== undefined) {
      const minDiv = filters.min_diversity_index ?? 0;
      const maxDiv = filters.max_diversity_index ?? 100;
      if (demo.diversityIndex < minDiv || demo.diversityIndex > maxDiv) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if precinct matches political filters
   */
  private matchesPolitical(precinct: PrecinctData, filters: PoliticalFilters): boolean {
    const pol = precinct.political;
    const elec = precinct.electoral;

    // Party lean (accepts array)
    if (filters.partyLean && filters.partyLean.length > 0) {
      const lean = elec.partisanLean;
      let matches = false;

      for (const leanType of filters.partyLean) {
        switch (leanType) {
          case 'strong_dem':
            if (lean < -20) matches = true;
            break;
          case 'lean_dem':
            if (lean >= -20 && lean < -5) matches = true;
            break;
          case 'independent':
            if (lean >= -5 && lean < 5) matches = true;
            break;
          case 'lean_rep':
            if (lean >= 5 && lean < 20) matches = true;
            break;
          case 'strong_rep':
            if (lean >= 20) matches = true;
            break;
        }
      }

      if (!matches) return false;
    }

    // Party affiliation percentages
    if (filters.min_dem_affiliation_pct !== undefined && pol.demAffiliationPct < filters.min_dem_affiliation_pct) {
      return false;
    }
    if (filters.min_rep_affiliation_pct !== undefined && pol.repAffiliationPct < filters.min_rep_affiliation_pct) {
      return false;
    }
    if (filters.min_independent_pct !== undefined && pol.independentPct < filters.min_independent_pct) {
      return false;
    }

    // Political outlook
    if (filters.politicalOutlook) {
      const liberalPct = pol.liberalPct;
      const moderatePct = pol.moderatePct;
      const conservativePct = pol.conservativePct;

      switch (filters.politicalOutlook) {
        case 'liberal':
          if (liberalPct <= moderatePct || liberalPct <= conservativePct) return false;
          break;
        case 'moderate':
          if (moderatePct <= liberalPct || moderatePct <= conservativePct) return false;
          break;
        case 'conservative':
          if (conservativePct <= liberalPct || conservativePct <= moderatePct) return false;
          break;
      }
    }

    // Min moderate percentage
    if (filters.min_moderate_pct !== undefined && pol.moderatePct < filters.min_moderate_pct) {
      return false;
    }

    // Partisan lean range (support both component and preset formats)
    if (filters.partisanLeanRange) {
      const [minLean, maxLean] = filters.partisanLeanRange;
      if (elec.partisanLean < minLean || elec.partisanLean > maxLean) {
        return false;
      }
    }
    // Partisan lean range - preset format (partisan_lean_range: { min, max })
    if (filters.partisan_lean_range) {
      const minLean = filters.partisan_lean_range.min ?? -100;
      const maxLean = filters.partisan_lean_range.max ?? 100;
      if (elec.partisanLean < minLean || elec.partisanLean > maxLean) {
        return false;
      }
    }

    // Competitiveness
    if (filters.competitiveness && filters.competitiveness.length > 0) {
      if (!filters.competitiveness.includes(elec.competitiveness)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if precinct matches targeting filters
   */
  private matchesTargeting(precinct: PrecinctData, filters: TargetingFilters): boolean {
    const tgt = precinct.targeting;
    const elec = precinct.electoral;

    // GOTV priority range (component format)
    if (filters.gotvPriorityRange) {
      const [minGotv, maxGotv] = filters.gotvPriorityRange;
      if (tgt.gotvPriority < minGotv || tgt.gotvPriority > maxGotv) {
        return false;
      }
    }
    // GOTV priority - preset format (min_gotv_priority, max_gotv_priority)
    if (filters.min_gotv_priority !== undefined || filters.max_gotv_priority !== undefined) {
      const minGotv = filters.min_gotv_priority ?? 0;
      const maxGotv = filters.max_gotv_priority ?? 100;
      if (tgt.gotvPriority < minGotv || tgt.gotvPriority > maxGotv) {
        return false;
      }
    }

    // Persuasion opportunity range (component format)
    if (filters.persuasionRange) {
      const [minPersuasion, maxPersuasion] = filters.persuasionRange;
      if (tgt.persuasionOpportunity < minPersuasion || tgt.persuasionOpportunity > maxPersuasion) {
        return false;
      }
    }
    // Persuasion - preset format (min_persuasion, max_persuasion)
    if (filters.min_persuasion !== undefined || filters.max_persuasion !== undefined) {
      const minPersuasion = filters.min_persuasion ?? 0;
      const maxPersuasion = filters.max_persuasion ?? 100;
      if (tgt.persuasionOpportunity < minPersuasion || tgt.persuasionOpportunity > maxPersuasion) {
        return false;
      }
    }

    // Swing potential range (component format)
    if (filters.swingPotentialRange) {
      const [minSwing, maxSwing] = filters.swingPotentialRange;
      if (elec.swingPotential < minSwing || elec.swingPotential > maxSwing) {
        return false;
      }
    }
    // Swing potential - preset format (min_swing_potential, max_swing_potential)
    if (filters.min_swing_potential !== undefined || filters.max_swing_potential !== undefined) {
      const minSwing = filters.min_swing_potential ?? 0;
      const maxSwing = filters.max_swing_potential ?? 100;
      if (elec.swingPotential < minSwing || elec.swingPotential > maxSwing) {
        return false;
      }
    }

    // Targeting strategy (accepts array)
    const strategyFilter = filters.targeting_strategy || filters.strategy;
    if (strategyFilter && strategyFilter.length > 0) {
      if (!strategyFilter.includes(tgt.strategy as any)) {
        return false;
      }
    }

    // Turnout range (component format)
    if (filters.turnoutRange) {
      const [minTurnout, maxTurnout] = filters.turnoutRange;
      if (elec.avgTurnout < minTurnout || elec.avgTurnout > maxTurnout) {
        return false;
      }
    }
    // Turnout - preset format (min_turnout, max_turnout)
    if (filters.min_turnout !== undefined || filters.max_turnout !== undefined) {
      const minTurnout = filters.min_turnout ?? 0;
      const maxTurnout = filters.max_turnout ?? 100;
      if (elec.avgTurnout < minTurnout || elec.avgTurnout > maxTurnout) {
        return false;
      }
    }

    // Turnout dropoff
    if (filters.min_dropoff !== undefined && elec.turnoutDropoff < filters.min_dropoff) {
      return false;
    }

    return true;
  }

  /**
   * Check if precinct matches engagement filters
   */
  private matchesEngagement(precinct: PrecinctData, filters: EngagementFilters): boolean {
    const eng = precinct.engagement;

    // Return false if no engagement data and filters are present
    if (!eng) {
      return false;
    }

    // High donor concentration (component format)
    if (filters.highDonorConcentration && eng.politicalDonorPct < 15) {
      return false;
    }
    // High donor concentration - preset format (high_donor_concentration)
    if (filters.high_donor_concentration && eng.politicalDonorPct < 15) {
      return false;
    }

    // High activist concentration (component format)
    if (filters.highActivistConcentration && eng.activistPct < 10) {
      return false;
    }
    // High activist concentration - preset format (high_activist_concentration)
    if (filters.high_activist_concentration && eng.activistPct < 10) {
      return false;
    }

    // News preference (component format)
    if (filters.newsPreference) {
      switch (filters.newsPreference) {
        case 'cnn_msnbc':
          if (eng.cnnMsnbcPct <= eng.foxNewsmaxPct || eng.cnnMsnbcPct < 30) return false;
          break;
        case 'fox_newsmax':
          if (eng.foxNewsmaxPct <= eng.cnnMsnbcPct || eng.foxNewsmaxPct < 30) return false;
          break;
        case 'mixed':
          if (Math.abs(eng.cnnMsnbcPct - eng.foxNewsmaxPct) > 10) return false;
          break;
        case 'social_first':
          if (eng.socialMediaPct < 50) return false;
          break;
        case 'npr':
          if (eng.nprPct < 20) return false;
          break;
      }
    }
    // News preference - preset format (news_preference)
    if (filters.news_preference) {
      switch (filters.news_preference) {
        case 'cnn_msnbc':
          if (eng.cnnMsnbcPct <= eng.foxNewsmaxPct || eng.cnnMsnbcPct < 30) return false;
          break;
        case 'fox_newsmax':
          if (eng.foxNewsmaxPct <= eng.cnnMsnbcPct || eng.foxNewsmaxPct < 30) return false;
          break;
        case 'mixed':
          if (Math.abs(eng.cnnMsnbcPct - eng.foxNewsmaxPct) > 10) return false;
          break;
        case 'social_first':
          if (eng.socialMediaPct < 50) return false;
          break;
        case 'npr':
          if (eng.nprPct < 20) return false;
          break;
      }
    }

    // High social media (component format)
    if (filters.highSocialMedia && eng.socialMediaPct < 60) {
      return false;
    }
    // High social media - preset format (high_social_media)
    if (filters.high_social_media && eng.socialMediaPct < 60) {
      return false;
    }

    return true;
  }

  /**
   * Calculate match score for a precinct (0-100)
   * Higher score = better match to filters
   */
  private calculateMatchScore(precinct: PrecinctData, filters: SegmentFilters): number {
    let totalScore = 0;
    let filterCount = 0;

    // Demographic scoring
    if (filters.demographics) {
      const demo = precinct.demographics;
      let demoScore = 100;
      let demoFilters = 0;

      if (filters.demographics.ageRange) {
        demoFilters++;
        const [minAge, maxAge] = filters.demographics.ageRange;
        const ageTarget = (minAge + maxAge) / 2;
        const ageDiff = Math.abs(demo.medianAge - ageTarget);
        demoScore -= Math.min(ageDiff * 2, 30);
      }

      if (filters.demographics.incomeRange) {
        demoFilters++;
        const [minIncome, maxIncome] = filters.demographics.incomeRange;
        const incomeTarget = (minIncome + maxIncome) / 2;
        const incomeDiff = Math.abs(demo.medianHHI - incomeTarget) / 1000;
        demoScore -= Math.min(incomeDiff * 0.5, 30);
      }

      if (filters.demographics.minCollegePct !== undefined) {
        demoFilters++;
        const collegeDiff = Math.max(0, filters.demographics.minCollegePct - demo.collegePct);
        demoScore -= collegeDiff * 0.5;
      }

      if (demoFilters > 0) {
        filterCount++;
        totalScore += demoScore;
      }
    }

    // Political scoring
    if (filters.political) {
      const elec = precinct.electoral;
      let polScore = 100;
      let polFilters = 0;

      if (filters.political.partisanLeanRange) {
        polFilters++;
        const [minLean, maxLean] = filters.political.partisanLeanRange;
        const leanTarget = (minLean + maxLean) / 2;
        const leanDiff = Math.abs(elec.partisanLean - leanTarget);
        polScore -= leanDiff * 0.5;
      }

      if (polFilters > 0) {
        filterCount++;
        totalScore += polScore;
      }
    }

    // Targeting scoring
    if (filters.targeting) {
      const tgt = precinct.targeting;
      let tgtScore = 100;
      let tgtFilters = 0;

      if (filters.targeting.gotvPriorityRange) {
        tgtFilters++;
        const [minGotv, maxGotv] = filters.targeting.gotvPriorityRange;
        const gotvTarget = (minGotv + maxGotv) / 2;
        const gotvDiff = Math.abs(tgt.gotvPriority - gotvTarget);
        tgtScore -= gotvDiff * 0.5;
      }

      if (filters.targeting.persuasionRange) {
        tgtFilters++;
        const [minPersuasion, maxPersuasion] = filters.targeting.persuasionRange;
        const persuasionTarget = (minPersuasion + maxPersuasion) / 2;
        const persuasionDiff = Math.abs(tgt.persuasionOpportunity - persuasionTarget);
        tgtScore -= persuasionDiff * 0.5;
      }

      if (tgtFilters > 0) {
        filterCount++;
        totalScore += tgtScore;
      }
    }

    // Average across all filter categories
    const finalScore = filterCount > 0 ? totalScore / filterCount : 100;

    return Math.max(0, Math.min(100, Math.round(finalScore)));
  }

  /**
   * Calculate aggregate statistics for matched precincts
   */
  private calculateAggregates(matches: PrecinctMatch[]): {
    estimatedVoters: number;
    estimatedVAP: number;
    vap: number;
    averageGOTV: number;
    avgGOTV: number;
    averagePersuasion: number;
    avgPersuasion: number;
    averagePartisanLean: number;
    avgPartisanLean: number;
    averageTurnout: number;
    avgTurnout: number;
    avgSwingPotential: number;
    strategyBreakdown: Record<string, number>;
  } {
    if (matches.length === 0) {
      return {
        estimatedVoters: 0,
        estimatedVAP: 0,
        vap: 0,
        averageGOTV: 0,
        avgGOTV: 0,
        averagePersuasion: 0,
        avgPersuasion: 0,
        averagePartisanLean: 0,
        avgPartisanLean: 0,
        averageTurnout: 0,
        avgTurnout: 0,
        avgSwingPotential: 0,
        strategyBreakdown: {},
      };
    }

    const totalVoters = matches.reduce((sum, m) => sum + m.registeredVoters, 0);
    const avgGOTVVal = matches.reduce((sum, m) => sum + m.gotvPriority, 0) / matches.length;
    const avgPersuasionVal = matches.reduce((sum, m) => sum + m.persuasionOpportunity, 0) / matches.length;
    const avgPartisanLeanVal = matches.reduce((sum, m) => sum + m.partisanLean, 0) / matches.length;
    const avgSwingPotentialVal = matches.reduce((sum, m) => sum + m.swingPotential, 0) / matches.length;

    // Get turnout from original precincts
    const precinctIds = matches.map(m => m.precinctId);
    const matchedPrecincts = this.precincts.filter(p => precinctIds.includes(p.id));
    const avgTurnoutVal = matchedPrecincts.length > 0
      ? matchedPrecincts.reduce((sum, p) => sum + p.electoral.avgTurnout, 0) / matchedPrecincts.length
      : 0;

    // Strategy breakdown
    const strategyBreakdown: Record<string, number> = {};
    matches.forEach(m => {
      strategyBreakdown[m.targetingStrategy] = (strategyBreakdown[m.targetingStrategy] || 0) + 1;
    });

    const roundedGOTV = Math.round(avgGOTVVal * 10) / 10;
    const roundedPersuasion = Math.round(avgPersuasionVal * 10) / 10;
    const roundedPartisanLean = Math.round(avgPartisanLeanVal * 10) / 10;
    const roundedTurnout = Math.round(avgTurnoutVal * 10) / 10;
    const roundedSwingPotential = Math.round(avgSwingPotentialVal * 10) / 10;

    return {
      estimatedVoters: totalVoters,
      estimatedVAP: totalVoters,
      vap: totalVoters,
      averageGOTV: roundedGOTV,
      avgGOTV: roundedGOTV,
      averagePersuasion: roundedPersuasion,
      avgPersuasion: roundedPersuasion,
      averagePartisanLean: roundedPartisanLean,
      avgPartisanLean: roundedPartisanLean,
      averageTurnout: roundedTurnout,
      avgTurnout: roundedTurnout,
      avgSwingPotential: roundedSwingPotential,
      strategyBreakdown,
    };
  }

  /**
   * Categorize population density into urban/suburban/rural
   */
  private categorizeDensity(density: number): DensityType {
    if (density >= 3000) return 'urban';
    if (density >= 500) return 'suburban';
    return 'rural';
  }

  /**
   * Get all precincts (for debugging/testing)
   */
  getAllPrecincts(): PrecinctData[] {
    return this.precincts;
  }
}
