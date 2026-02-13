/**
 * Campaign Planning Service
 * 
 * Generates intelligent campaign recommendations, budget allocations,
 * and marketing strategies based on territory characteristics and analysis data.
 */

import { ClusterResult, ClusteringMethod } from '../types';

export interface CampaignRecommendation {
  territoryId: number;
  territoryName: string;
  
  // Budget & Investment
  recommendedBudget: {
    min: number;
    max: number;
    optimal: number;
    currency: string;
    rationale: string;
  };
  
  // Targeting & Strategy
  campaignStrategy: {
    type: 'awareness' | 'consideration' | 'conversion' | 'retention';
    priority: 'high' | 'medium' | 'low';
    timeline: string;
    objectives: string[];
  };
  
  // Media & Channels
  mediaRecommendations: {
    primaryChannels: MediaChannel[];
    secondaryChannels: MediaChannel[];
    budgetAllocation: Record<string, number>; // percentage allocation
  };
  
  // Audience & Demographics
  audienceInsights: {
    primaryDemographic: string;
    secondaryDemographics: string[];
    psychographics: string[];
    behaviors: string[];
  };
  
  // Performance Expectations
  expectedOutcomes: {
    reach: number;
    frequency: number;
    impressions: number;
    estimatedCPM: number;
    projectedROI: string;
  };
  
  // Competitive Context
  competitiveContext?: {
    marketPosition: string;
    threats: string[];
    opportunities: string[];
    differentiationStrategy: string;
  };
}

export interface MediaChannel {
  name: string;
  type: 'digital' | 'traditional' | 'outdoor' | 'events';
  suitability: number; // 1-10 score
  costEfficiency: number; // 1-10 score
  reach: number; // 1-10 score
  targeting: number; // 1-10 score
  rationale: string;
}

export interface CampaignComparison {
  territories: CampaignRecommendation[];
  budgetSummary: {
    totalBudget: { min: number; max: number; optimal: number };
    budgetByTerritory: Record<string, number>;
    budgetByChannel: Record<string, number>;
  };
  strategicInsights: {
    topOpportunities: string[];
    resourceAllocation: string[];
    riskFactors: string[];
    synergies: string[];
  };
}

/**
 * Main service for generating campaign planning recommendations
 */
export class CampaignPlanningService {
  private static instance: CampaignPlanningService | null = null;

  private constructor() {}

  public static getInstance(): CampaignPlanningService {
    if (!CampaignPlanningService.instance) {
      CampaignPlanningService.instance = new CampaignPlanningService();
    }
    return CampaignPlanningService.instance;
  }

  /**
   * Generate campaign recommendation for a single territory
   */
  public generateTerritoryRecommendation(
    cluster: ClusterResult,
    method: ClusteringMethod,
    totalBudget?: number
  ): CampaignRecommendation {
    
    const budgetRecommendation = this.calculateBudgetRecommendation(cluster, totalBudget);
    const strategy = this.determineStrategy(cluster, method);
    const mediaRecs = this.generateMediaRecommendations(cluster, method);
    const audience = this.analyzeAudience(cluster, method);
    const outcomes = this.projectOutcomes(cluster, budgetRecommendation.optimal);
    const competitive = this.analyzeCompetitiveContext(cluster, method);

    return {
      territoryId: cluster.clusterId,
      territoryName: cluster.name,
      recommendedBudget: budgetRecommendation,
      campaignStrategy: strategy,
      mediaRecommendations: mediaRecs,
      audienceInsights: audience,
      expectedOutcomes: outcomes,
      competitiveContext: competitive
    };
  }

  /**
   * Generate recommendations for multiple territories
   */
  public generateMultiTerritoryRecommendations(
    clusters: ClusterResult[],
    method: ClusteringMethod,
    totalBudget?: number
  ): CampaignComparison {
    
    const territories = clusters.map(cluster => 
      this.generateTerritoryRecommendation(cluster, method, totalBudget)
    );

    const budgetSummary = this.calculateBudgetSummary(territories);
    const strategicInsights = this.generateStrategicInsights(territories, clusters);

    return {
      territories,
      budgetSummary,
      strategicInsights
    };
  }

  /**
   * Calculate budget recommendation based on territory characteristics
   */
  private calculateBudgetRecommendation(
    cluster: ClusterResult,
    totalBudget?: number
  ): CampaignRecommendation['recommendedBudget'] {
    
    const population = cluster.totalPopulation;
    const score = cluster.averageScore;
    const zipCodeCount = cluster.zipCodes.length;
    const radius = cluster.radiusMiles;

    // Base budget calculation using population and score
    const populationFactor = Math.log10(population) * 10000; // Logarithmic scaling
    const scoreFactor = score * 5000; // Higher scores get more budget
    const geographyFactor = radius > 50 ? 1.3 : radius > 25 ? 1.1 : 1.0; // Geographic complexity

    const baseBudget = (populationFactor + scoreFactor) * geographyFactor;

    // Calculate min/max ranges
    const min = Math.round(baseBudget * 0.7);
    const max = Math.round(baseBudget * 1.5);
    const optimal = Math.round(baseBudget);

    // Budget rationale
    let rationale = `Based on ${population.toLocaleString()} population (${populationFactor.toLocaleString()}) `;
    rationale += `and ${score.toFixed(1)} analysis score (${scoreFactor.toLocaleString()}). `;
    
    if (geographyFactor > 1) {
      rationale += `Geographic complexity factor of ${geographyFactor}x applied for ${radius.toFixed(0)}-mile radius. `;
    }

    if (score >= 7) {
      rationale += 'High-value territory warrants premium investment.';
    } else if (score <= 3) {
      rationale += 'Developing territory requires patient, sustained investment.';
    }

    return {
      min,
      max,
      optimal,
      currency: 'USD',
      rationale
    };
  }

  /**
   * Determine campaign strategy based on territory characteristics
   */
  private determineStrategy(
    cluster: ClusterResult,
    method: ClusteringMethod
  ): CampaignRecommendation['campaignStrategy'] {
    
    const score = cluster.averageScore;
    const population = cluster.totalPopulation;

    // Strategy type based on score
    let type: CampaignRecommendation['campaignStrategy']['type'];
    let priority: CampaignRecommendation['campaignStrategy']['priority'];
    let timeline: string;
    let objectives: string[];

    if (score >= 7) {
      type = 'conversion';
      priority = 'high';
      timeline = '4-6 weeks';
      objectives = [
        'Drive immediate conversions',
        'Capitalize on high intent',
        'Maximize ROI in prime territory'
      ];
    } else if (score >= 5) {
      type = 'consideration';
      priority = 'medium';
      timeline = '6-8 weeks';
      objectives = [
        'Build brand consideration',
        'Nurture qualified prospects',
        'Increase purchase intent'
      ];
    } else if (score >= 3) {
      type = 'awareness';
      priority = 'medium';
      timeline = '8-12 weeks';
      objectives = [
        'Build brand awareness',
        'Educate target audience',
        'Establish market presence'
      ];
    } else {
      type = 'awareness';
      priority = 'low';
      timeline = '12-16 weeks';
      objectives = [
        'Long-term market development',
        'Brand introduction',
        'Category education'
      ];
    }

    // Adjust based on population size
    if (population >= 200000 && priority !== 'high') {
      priority = 'medium'; // Large populations get at least medium priority
    }

    // Method-specific adjustments
    if (method === 'competitive-scores') {
      objectives.push('Competitive differentiation');
      if (type === 'conversion') {
        objectives.push('Win competitive conversions');
      }
    }

    return { type, priority, timeline, objectives };
  }

  /**
   * Generate media channel recommendations
   */
  private generateMediaRecommendations(
    cluster: ClusterResult,
    method: ClusteringMethod
  ): CampaignRecommendation['mediaRecommendations'] {
    
    const population = cluster.totalPopulation;
    const radius = cluster.radiusMiles;
    const score = cluster.averageScore;

    const allChannels: MediaChannel[] = [
      // Digital Channels
      {
        name: 'Social Media Advertising',
        type: 'digital',
        suitability: this.calculateChannelSuitability('social', population, radius, score),
        costEfficiency: 8,
        reach: 9,
        targeting: 10,
        rationale: 'Excellent targeting capabilities and cost efficiency'
      },
      {
        name: 'Search Engine Marketing',
        type: 'digital',
        suitability: this.calculateChannelSuitability('search', population, radius, score),
        costEfficiency: 7,
        reach: 7,
        targeting: 9,
        rationale: 'High-intent targeting with measurable ROI'
      },
      {
        name: 'Display Advertising',
        type: 'digital',
        suitability: this.calculateChannelSuitability('display', population, radius, score),
        costEfficiency: 6,
        reach: 8,
        targeting: 8,
        rationale: 'Good reach with visual impact and retargeting capabilities'
      },
      {
        name: 'Connected TV',
        type: 'digital',
        suitability: this.calculateChannelSuitability('ctv', population, radius, score),
        costEfficiency: 5,
        reach: 8,
        targeting: 7,
        rationale: 'Premium format with TV-like reach and digital targeting'
      },

      // Traditional Channels
      {
        name: 'Local Radio',
        type: 'traditional',
        suitability: this.calculateChannelSuitability('radio', population, radius, score),
        costEfficiency: 8,
        reach: 6,
        targeting: 4,
        rationale: 'Cost-effective local reach with strong frequency'
      },
      {
        name: 'Local TV',
        type: 'traditional',
        suitability: this.calculateChannelSuitability('tv', population, radius, score),
        costEfficiency: 4,
        reach: 9,
        targeting: 3,
        rationale: 'High reach and credibility, premium format'
      },
      {
        name: 'Print Advertising',
        type: 'traditional',
        suitability: this.calculateChannelSuitability('print', population, radius, score),
        costEfficiency: 5,
        reach: 4,
        targeting: 5,
        rationale: 'Targeted local publications with engaged readership'
      },

      // Outdoor & Events
      {
        name: 'Outdoor Billboards',
        type: 'outdoor',
        suitability: this.calculateChannelSuitability('outdoor', population, radius, score),
        costEfficiency: 6,
        reach: 7,
        targeting: 3,
        rationale: 'High visibility and frequency in key locations'
      },
      {
        name: 'Local Events',
        type: 'events',
        suitability: this.calculateChannelSuitability('events', population, radius, score),
        costEfficiency: 4,
        reach: 3,
        targeting: 8,
        rationale: 'Direct engagement with highly targeted audiences'
      }
    ];

    // Sort channels by suitability
    const sortedChannels = [...allChannels].sort((a, b) => b.suitability - a.suitability);

    // Select primary and secondary channels
    const primaryChannels = sortedChannels.slice(0, 3);
    const secondaryChannels = sortedChannels.slice(3, 6);

    // Calculate budget allocation
    const budgetAllocation: Record<string, number> = {};
    let totalSuitability = primaryChannels.reduce((sum, channel) => sum + channel.suitability, 0);
    
    primaryChannels.forEach(channel => {
      budgetAllocation[channel.name] = Math.round((channel.suitability / totalSuitability) * 70); // 70% to primary
    });

    totalSuitability = secondaryChannels.reduce((sum, channel) => sum + channel.suitability, 0);
    secondaryChannels.forEach(channel => {
      budgetAllocation[channel.name] = Math.round((channel.suitability / totalSuitability) * 30); // 30% to secondary
    });

    return {
      primaryChannels,
      secondaryChannels,
      budgetAllocation
    };
  }

  /**
   * Calculate channel suitability based on territory characteristics
   */
  private calculateChannelSuitability(
    channelType: string,
    population: number,
    radius: number,
    score: number
  ): number {
    let suitability = 5; // Base score

    switch (channelType) {
      case 'social':
        suitability += population > 100000 ? 2 : 1;
        suitability += score > 6 ? 2 : score > 4 ? 1 : 0;
        suitability += radius < 30 ? 1 : 0;
        break;

      case 'search':
        suitability += score > 6 ? 3 : score > 4 ? 2 : 1;
        suitability += population > 50000 ? 1 : 0;
        break;

      case 'display':
        suitability += population > 100000 ? 2 : 1;
        suitability += score > 5 ? 1 : 0;
        break;

      case 'ctv':
        suitability += population > 200000 ? 3 : population > 100000 ? 2 : 1;
        suitability += score > 6 ? 1 : 0;
        break;

      case 'radio':
        suitability += radius < 50 ? 3 : 1;
        suitability += population > 50000 ? 1 : 0;
        break;

      case 'tv':
        suitability += population > 200000 ? 3 : population > 100000 ? 2 : 1;
        suitability += radius > 30 ? 1 : 0;
        break;

      case 'print':
        suitability += radius < 30 ? 2 : 1;
        suitability += population > 75000 ? 1 : 0;
        break;

      case 'outdoor':
        suitability += population > 100000 ? 2 : 1;
        suitability += radius < 40 ? 1 : 0;
        break;

      case 'events':
        suitability += radius < 25 ? 3 : radius < 50 ? 2 : 1;
        suitability += score > 5 ? 1 : 0;
        break;
    }

    return Math.min(10, Math.max(1, suitability));
  }

  /**
   * Analyze audience characteristics
   */
  private analyzeAudience(
    cluster: ClusterResult,
    method: ClusteringMethod
  ): CampaignRecommendation['audienceInsights'] {
    
    const insights = cluster.keyInsights.toLowerCase();
    
    let primaryDemographic = 'General market';
    const secondaryDemographics: string[] = [];
    const psychographics: string[] = [];
    const behaviors: string[] = [];

    // Extract demographics from insights
    if (insights.includes('young')) {
      primaryDemographic = 'Young adults (25-34)';
      secondaryDemographics.push('Teenagers (18-24)');
      psychographics.push('Tech-savvy', 'Social media active', 'Trend-conscious');
      behaviors.push('Mobile-first', 'Social sharing', 'Video consumption');
    } else if (insights.includes('family')) {
      primaryDemographic = 'Families (35-49)';
      secondaryDemographics.push('Parents with children');
      psychographics.push('Value-conscious', 'Quality-focused', 'Brand loyal');
      behaviors.push('Research-oriented', 'Bulk purchasing', 'Referral-driven');
    } else if (insights.includes('mature')) {
      primaryDemographic = 'Mature adults (50+)';
      secondaryDemographics.push('Empty nesters');
      psychographics.push('Quality-focused', 'Brand loyal', 'Traditional values');
      behaviors.push('In-store preference', 'Word-of-mouth influenced', 'Brand research');
    }

    // Income-based insights
    if (insights.includes('high income') || insights.includes('affluent')) {
      psychographics.push('Premium-oriented', 'Quality over price', 'Status-conscious');
      behaviors.push('Premium product purchase', 'Brand loyalty', 'Influence others');
    } else if (insights.includes('value') || insights.includes('price-sensitive')) {
      psychographics.push('Value-conscious', 'Deal-seeking', 'Practical');
      behaviors.push('Comparison shopping', 'Coupon usage', 'Bulk buying');
    }

    // Method-specific insights
    if (method === 'competitive-scores') {
      if (insights.includes('nike')) {
        behaviors.push('Nike brand affinity', 'Athletic lifestyle', 'Performance-oriented');
      }
      if (insights.includes('adidas')) {
        behaviors.push('Adidas brand preference', 'Style-conscious', 'Sports culture');
      }
    }

    return {
      primaryDemographic,
      secondaryDemographics,
      psychographics,
      behaviors
    };
  }

  /**
   * Project campaign outcomes
   */
  private projectOutcomes(
    cluster: ClusterResult,
    budget: number
  ): CampaignRecommendation['expectedOutcomes'] {
    
    const population = cluster.totalPopulation;
    const score = cluster.averageScore;

    // Calculate reach (percentage of population)
    const reachPercentage = Math.min(85, Math.max(30, 
      30 + (budget / 1000) * 0.5 + score * 5
    ));
    const reach = Math.round(population * (reachPercentage / 100));

    // Calculate frequency
    const frequency = Math.min(8, Math.max(2, 
      2 + (budget / 10000) + (score > 6 ? 1 : 0)
    ));

    // Calculate impressions
    const impressions = reach * frequency;

    // Estimate CPM based on market characteristics
    const baseCPM = 15; // Base CPM
    const populationFactor = population > 200000 ? 1.2 : population > 100000 ? 1.1 : 1.0;
    const scoreFactor = score > 7 ? 0.9 : score > 5 ? 1.0 : 1.1; // Higher scores are more efficient
    const estimatedCPM = Math.round(baseCPM * populationFactor * scoreFactor);

    // Project ROI
    let projectedROI = '';
    if (score >= 7) {
      projectedROI = '4:1 to 6:1';
    } else if (score >= 5) {
      projectedROI = '3:1 to 5:1';
    } else if (score >= 3) {
      projectedROI = '2:1 to 4:1';
    } else {
      projectedROI = '1.5:1 to 3:1 (long-term)';
    }

    return {
      reach,
      frequency: Math.round(frequency * 10) / 10,
      impressions,
      estimatedCPM,
      projectedROI
    };
  }

  /**
   * Analyze competitive context
   */
  private analyzeCompetitiveContext(
    cluster: ClusterResult,
    method: ClusteringMethod
  ): CampaignRecommendation['competitiveContext'] | undefined {
    
    if (method !== 'competitive-scores') {
      return undefined;
    }

    const insights = cluster.keyInsights.toLowerCase();
    const score = cluster.averageScore;

    let marketPosition = '';
    const threats: string[] = [];
    const opportunities: string[] = [];
    let differentiationStrategy = '';

    // Determine market position
    if (score >= 7) {
      marketPosition = 'Market leader with strong competitive advantage';
      threats.push('Competitor response to dominance');
      opportunities.push('Expand market share further', 'Premium positioning');
      differentiationStrategy = 'Reinforce leadership through innovation and premium experience';
    } else if (score >= 5) {
      marketPosition = 'Strong contender with growth potential';
      threats.push('Increased competition', 'Market leader response');
      opportunities.push('Capture market share', 'Niche specialization');
      differentiationStrategy = 'Focus on unique value propositions and customer experience';
    } else if (score >= 3) {
      marketPosition = 'Challenger with opportunity to gain ground';
      threats.push('Established competitor advantages', 'Resource constraints');
      opportunities.push('Underserved segments', 'Value positioning');
      differentiationStrategy = 'Target specific segments with tailored messaging';
    } else {
      marketPosition = 'Market entrant requiring patient investment';
      threats.push('Well-established competition', 'Brand awareness gap');
      opportunities.push('Blue ocean potential', 'Disruptive positioning');
      differentiationStrategy = 'Create new category or dramatically different value proposition';
    }

    // Brand-specific insights
    if (insights.includes('nike')) {
      threats.push('Nike brand loyalty', 'Performance expectations');
      opportunities.push('Alternative to mainstream choice');
    }
    if (insights.includes('adidas')) {
      threats.push('Adidas style preference', 'Sports culture connection');
      opportunities.push('Technical performance angle');
    }

    return {
      marketPosition,
      threats,
      opportunities,
      differentiationStrategy
    };
  }

  /**
   * Calculate budget summary across territories
   */
  private calculateBudgetSummary(
    territories: CampaignRecommendation[]
  ): CampaignComparison['budgetSummary'] {
    
    const totalMin = territories.reduce((sum, t) => sum + t.recommendedBudget.min, 0);
    const totalMax = territories.reduce((sum, t) => sum + t.recommendedBudget.max, 0);
    const totalOptimal = territories.reduce((sum, t) => sum + t.recommendedBudget.optimal, 0);

    const budgetByTerritory: Record<string, number> = {};
    territories.forEach(t => {
      budgetByTerritory[t.territoryName] = t.recommendedBudget.optimal;
    });

    const budgetByChannel: Record<string, number> = {};
    territories.forEach(territory => {
      territory.mediaRecommendations.primaryChannels.forEach(channel => {
        const allocation = territory.mediaRecommendations.budgetAllocation[channel.name] || 0;
        const channelBudget = (territory.recommendedBudget.optimal * allocation) / 100;
        budgetByChannel[channel.name] = (budgetByChannel[channel.name] || 0) + channelBudget;
      });
    });

    return {
      totalBudget: { min: totalMin, max: totalMax, optimal: totalOptimal },
      budgetByTerritory,
      budgetByChannel
    };
  }

  /**
   * Generate strategic insights for multi-territory campaigns
   */
  private generateStrategicInsights(
    territories: CampaignRecommendation[],
    clusters: ClusterResult[]
  ): CampaignComparison['strategicInsights'] {
    
    const topOpportunities: string[] = [];
    const resourceAllocation: string[] = [];
    const riskFactors: string[] = [];
    const synergies: string[] = [];

    // Analyze top opportunities
    const highScoreTerritories = territories.filter(t => {
      const cluster = clusters.find(c => c.clusterId === t.territoryId);
      return cluster && cluster.averageScore >= 7;
    });
    
    if (highScoreTerritories.length > 0) {
      topOpportunities.push(
        `${highScoreTerritories.length} high-value territories ready for conversion campaigns`
      );
    }

    const largeTerritories = territories.filter(t => {
      const cluster = clusters.find(c => c.clusterId === t.territoryId);
      return cluster && cluster.totalPopulation >= 200000;
    });
    
    if (largeTerritories.length > 0) {
      topOpportunities.push(
        `${largeTerritories.length} large-population territories offer scale opportunities`
      );
    }

    // Resource allocation insights
    const totalBudget = territories.reduce((sum, t) => sum + t.recommendedBudget.optimal, 0);
    const highPriorityBudget = territories
      .filter(t => t.campaignStrategy.priority === 'high')
      .reduce((sum, t) => sum + t.recommendedBudget.optimal, 0);
    
    resourceAllocation.push(
      `${Math.round((highPriorityBudget / totalBudget) * 100)}% of budget allocated to high-priority territories`
    );

    // Channel synergies
    const channelCount: Record<string, number> = {};
    territories.forEach(t => {
      t.mediaRecommendations.primaryChannels.forEach(channel => {
        channelCount[channel.name] = (channelCount[channel.name] || 0) + 1;
      });
    });

    const commonChannels = Object.entries(channelCount)
      .filter(([, count]) => count >= Math.ceil(territories.length * 0.5))
      .map(([channel]) => channel);

    if (commonChannels.length > 0) {
      synergies.push(
        `Cross-territory efficiency through ${commonChannels.join(', ')} channels`
      );
    }

    // Risk factors
    const lowScoreTerritories = territories.filter(t => {
      const cluster = clusters.find(c => c.clusterId === t.territoryId);
      return cluster && cluster.averageScore <= 3;
    });
    
    if (lowScoreTerritories.length > 0) {
      riskFactors.push(
        `${lowScoreTerritories.length} territories require patient, long-term investment`
      );
    }

    return {
      topOpportunities,
      resourceAllocation,
      riskFactors,
      synergies
    };
  }
}