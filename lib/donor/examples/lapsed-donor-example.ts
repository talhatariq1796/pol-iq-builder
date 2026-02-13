/**
 * Lapsed Donor Analyzer - Usage Example
 *
 * This example demonstrates how to use the Lapsed Donor Analyzer
 * to identify, score, and cluster lapsed donors for re-engagement campaigns.
 */

import {
  LapsedDonorAnalyzer,
  DonorClusterAnalyzer,
  RecoveryScorer,
} from '../index';
import type { DonorProfile, Contribution } from '../types';
import type { LapsedDonorCriteria } from '../LapsedDonorAnalyzer';

// Mock data for demonstration
const mockProfiles: DonorProfile[] = [
  {
    donorId: 'donor1',
    zipCode: '48823',
    city: 'East Lansing',
    recencyScore: 1, // Low recency = lapsed
    frequencyScore: 5,
    monetaryScore: 5,
    totalContributed: 2500,
    contributionCount: 10,
    avgContribution: 250,
    firstContributionDate: '2020-01-15',
    lastContributionDate: '2023-06-20', // Last gave in 2023
    likelyParty: 'DEM',
    partyConfidence: 0.95,
    segment: 'at_risk',
  },
  {
    donorId: 'donor2',
    zipCode: '48864',
    city: 'Okemos',
    recencyScore: 1,
    frequencyScore: 3,
    monetaryScore: 4,
    totalContributed: 750,
    contributionCount: 5,
    avgContribution: 150,
    firstContributionDate: '2021-03-10',
    lastContributionDate: '2023-10-15', // Last gave in 2023
    likelyParty: 'DEM',
    partyConfidence: 0.85,
    segment: 'at_risk',
  },
];

const mockContributions: Contribution[] = [
  // Donor 1 contributions (all in 2020-2023)
  {
    id: 'c1',
    source: 'fec',
    contributorName: 'John Smith',
    city: 'East Lansing',
    state: 'MI',
    zipCode: '48823',
    committeeId: 'C00123456',
    party: 'DEM',
    amount: 250,
    date: '2020-01-15',
    transactionType: 'individual',
    electionCycle: '2020',
  },
  {
    id: 'c2',
    source: 'fec',
    contributorName: 'John Smith',
    city: 'East Lansing',
    state: 'MI',
    zipCode: '48823',
    committeeId: 'C00123456',
    party: 'DEM',
    amount: 500,
    date: '2023-06-20',
    transactionType: 'individual',
    electionCycle: '2024',
  },
  // Donor 2 contributions
  {
    id: 'c3',
    source: 'fec',
    contributorName: 'Jane Doe',
    city: 'Okemos',
    state: 'MI',
    zipCode: '48864',
    committeeId: 'C00123456',
    party: 'DEM',
    amount: 150,
    date: '2023-10-15',
    transactionType: 'individual',
    electionCycle: '2024',
  },
];

/**
 * Example 1: Basic Lapsed Donor Identification
 */
function example1_identifyLapsedDonors() {
  console.log('=== Example 1: Identify Lapsed Donors ===\n');

  // Define criteria: gave before 2024, but not since 2024
  const criteria: LapsedDonorCriteria = {
    lastGaveBefore: '2024-01-01',
    notGivenSince: '2024-01-01',
    minHistoricalAmount: 100,
    minHistoricalGifts: 2,
    party: 'ALL',
  };

  // Create analyzer
  const analyzer = new LapsedDonorAnalyzer();

  // Identify lapsed donors
  const lapsedDonors = analyzer.identifyLapsedDonors(
    mockProfiles,
    mockContributions,
    criteria
  );

  console.log(`Found ${lapsedDonors.length} lapsed donors:\n`);

  // Display each lapsed donor
  lapsedDonors.forEach((donor, i) => {
    console.log(`${i + 1}. ${analyzer.formatLapsedDonor(donor)}\n`);
  });

  // Show summary
  const summary = analyzer.getSummary(lapsedDonors);
  console.log('Summary Statistics:');
  console.log(`  Total lapsed: ${summary.totalLapsed}`);
  console.log(`  Total historical value: $${summary.totalHistoricalValue.toLocaleString()}`);
  console.log(`  Avg historical gift: $${summary.avgHistoricalGift.toFixed(2)}`);
  console.log(`  Total estimated recovery: $${summary.totalEstimatedRecovery.toLocaleString()}`);
  console.log(`  Avg recovery score: ${summary.avgRecoveryScore.toFixed(1)}/100`);
  console.log(`  Avg months since lapse: ${summary.avgMonthsSinceLapse.toFixed(1)}\n`);

  return lapsedDonors;
}

/**
 * Example 2: Detailed Recovery Scoring
 */
function example2_detailedRecoveryScores(lapsedDonors: any[]) {
  console.log('=== Example 2: Detailed Recovery Scoring ===\n');

  const recoveryScorer = new RecoveryScorer();

  lapsedDonors.forEach((donor, i) => {
    const detailedScore = recoveryScorer.calculateDetailedScore(donor);

    console.log(`${i + 1}. Donor ${donor.donorId}:`);
    console.log(`   Total Score: ${detailedScore.totalScore}/100`);
    console.log(`   Components:`);
    console.log(`     - Lapse Recency: ${detailedScore.components.lapseRecency}/100`);
    console.log(`     - Historical Value: ${detailedScore.components.historicalValue}/100`);
    console.log(`     - Giving Consistency: ${detailedScore.components.givingConsistency}/100`);
    console.log(`     - Relationship Tenure: ${detailedScore.components.relationshipTenure}/100`);
    console.log(`     - Demographic Match: ${detailedScore.components.demographicMatch}/100`);
    console.log(`   Confidence: ${detailedScore.confidence}%`);
    console.log(`   Recommended Channel: ${detailedScore.recommendedChannel.toUpperCase()}`);
    console.log(`   Estimated Recovery: $${detailedScore.estimatedRecoveryAmount} (${(detailedScore.estimatedRecoveryProbability * 100).toFixed(0)}% probability)\n`);
  });
}

/**
 * Example 3: Channel Recommendations
 */
function example3_channelRecommendations(lapsedDonors: any[]) {
  console.log('=== Example 3: Multi-Channel Recommendations ===\n');

  const recoveryScorer = new RecoveryScorer();

  lapsedDonors.forEach((donor, i) => {
    console.log(`${i + 1}. Donor ${donor.donorId} ($${donor.totalHistoricalAmount}):`);

    const channels = recoveryScorer.getChannelRecommendations(donor);

    channels.forEach((ch) => {
      console.log(`   ${ch.priority}. ${ch.channel.toUpperCase()}`);
      console.log(`      Reasoning: ${ch.reasoning}`);
      console.log(`      Cost: $${ch.estimatedCostPerContact}/contact`);
      console.log(`      Response Rate: ${(ch.estimatedResponseRate * 100).toFixed(0)}%`);
    });

    console.log('');
  });
}

/**
 * Example 4: Geographic Clustering
 */
function example4_geographicClustering(lapsedDonors: any[]) {
  console.log('=== Example 4: Geographic Clustering ===\n');

  const clusterAnalyzer = new DonorClusterAnalyzer();

  // Create clusters
  const clusters = clusterAnalyzer.createClusters(lapsedDonors, {
    maxDistance: 10, // 10 miles
    minDonorsPerCluster: 1, // Allow small clusters for demo
    maxClustersToReturn: 5,
    prioritizeHighValue: true,
  });

  console.log(`Created ${clusters.length} clusters:\n`);

  clusters.forEach((cluster, i) => {
    console.log(`${i + 1}. ${clusterAnalyzer.formatCluster(cluster)}\n`);
  });
}

/**
 * Example 5: Filtering and Segmentation
 */
function example5_filteringAndSegmentation(lapsedDonors: any[]) {
  console.log('=== Example 5: Filtering and Segmentation ===\n');

  const analyzer = new LapsedDonorAnalyzer();

  // Filter for high-priority donors only
  const highPriority = analyzer.filterLapsedDonors(lapsedDonors, {
    priority: 'high',
  });

  console.log(`High Priority Donors: ${highPriority.length}`);
  highPriority.forEach((d) => {
    console.log(`  - ${d.city} | $${d.totalHistoricalAmount} | Score: ${d.recoveryScore}`);
  });
  console.log('');

  // Filter for phone banking targets (score >= 60)
  const phoneTargets = analyzer.filterLapsedDonors(lapsedDonors, {
    minRecoveryScore: 60,
    channel: 'phone',
  });

  console.log(`Phone Banking Targets: ${phoneTargets.length}`);
  phoneTargets.forEach((d) => {
    console.log(`  - ${d.city} | $${d.totalHistoricalAmount} | Score: ${d.recoveryScore}`);
  });
  console.log('');

  // Filter by party
  const demDonors = analyzer.filterLapsedDonors(lapsedDonors, {
    party: 'DEM',
  });

  console.log(`Democratic Donors: ${demDonors.length}`);
  console.log('');
}

/**
 * Example 6: Campaign Planning Workflow
 */
function example6_campaignPlanningWorkflow(lapsedDonors: any[]) {
  console.log('=== Example 6: Campaign Planning Workflow ===\n');

  const analyzer = new LapsedDonorAnalyzer();
  const clusterAnalyzer = new DonorClusterAnalyzer();

  // Step 1: Segment by priority
  const byPriority = {
    high: analyzer.filterLapsedDonors(lapsedDonors, { priority: 'high' }),
    medium: analyzer.filterLapsedDonors(lapsedDonors, { priority: 'medium' }),
    low: analyzer.filterLapsedDonors(lapsedDonors, { priority: 'low' }),
  };

  console.log('Step 1: Priority Segmentation');
  console.log(`  High: ${byPriority.high.length} donors`);
  console.log(`  Medium: ${byPriority.medium.length} donors`);
  console.log(`  Low: ${byPriority.low.length} donors\n`);

  // Step 2: Channel assignment
  const byChannel = {
    phone: analyzer.filterLapsedDonors(lapsedDonors, { channel: 'phone' }),
    mail: analyzer.filterLapsedDonors(lapsedDonors, { channel: 'mail' }),
    door: analyzer.filterLapsedDonors(lapsedDonors, { channel: 'door' }),
    digital: analyzer.filterLapsedDonors(lapsedDonors, { channel: 'digital' }),
  };

  console.log('Step 2: Channel Assignment');
  console.log(`  Phone: ${byChannel.phone.length} donors`);
  console.log(`  Mail: ${byChannel.mail.length} donors`);
  console.log(`  Door: ${byChannel.door.length} donors`);
  console.log(`  Digital: ${byChannel.digital.length} donors\n`);

  // Step 3: Geographic clustering for door-to-door
  if (byChannel.door.length > 0) {
    const doorClusters = clusterAnalyzer.createClusters(byChannel.door, {
      maxDistance: 5,
      minDonorsPerCluster: 1,
    });

    console.log('Step 3: Door-to-Door Clusters');
    console.log(`  Created ${doorClusters.length} clusters`);

    doorClusters.forEach((cluster, i) => {
      console.log(`  Cluster ${i + 1}: ${cluster.donorCount} donors, ${cluster.estimatedHoursNeeded} hours`);
    });
    console.log('');
  }

  // Step 4: Budget allocation
  console.log('Step 4: Estimated Costs');
  const costs = {
    phone: byChannel.phone.length * 5, // $5 per call
    mail: byChannel.mail.length * 2, // $2 per mail piece
    door: byChannel.door.length * 3, // $3 per door
    digital: byChannel.digital.length * 0.1, // $0.10 per email
  };

  const totalCost = Object.values(costs).reduce((sum, cost) => sum + cost, 0);
  const summary = analyzer.getSummary(lapsedDonors);

  console.log(`  Phone Banking: $${costs.phone.toFixed(2)}`);
  console.log(`  Direct Mail: $${costs.mail.toFixed(2)}`);
  console.log(`  Door-to-Door: $${costs.door.toFixed(2)}`);
  console.log(`  Digital: $${costs.digital.toFixed(2)}`);
  console.log(`  Total Cost: $${totalCost.toFixed(2)}`);
  console.log(`  Estimated Recovery: $${summary.totalEstimatedRecovery.toLocaleString()}`);
  console.log(`  Expected ROI: ${(summary.totalEstimatedRecovery / totalCost).toFixed(1)}x\n`);
}

/**
 * Run all examples
 */
function runAllExamples() {
  const lapsedDonors = example1_identifyLapsedDonors();

  if (lapsedDonors.length > 0) {
    example2_detailedRecoveryScores(lapsedDonors);
    example3_channelRecommendations(lapsedDonors);
    example4_geographicClustering(lapsedDonors);
    example5_filteringAndSegmentation(lapsedDonors);
    example6_campaignPlanningWorkflow(lapsedDonors);
  }

  console.log('=== All Examples Complete ===');
}

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples();
}

// Export for use as a module
export {
  example1_identifyLapsedDonors,
  example2_detailedRecoveryScores,
  example3_channelRecommendations,
  example4_geographicClustering,
  example5_filteringAndSegmentation,
  example6_campaignPlanningWorkflow,
  runAllExamples,
};
