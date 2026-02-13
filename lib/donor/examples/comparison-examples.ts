/**
 * Usage Examples for Candidate Comparison Engine
 *
 * This file demonstrates how to use the CandidateRegistry, RecipientFilter,
 * and ComparisonEngine for head-to-head fundraising analysis.
 */

import { candidateRegistry } from '../CandidateRegistry';
import { recipientFilter } from '../RecipientFilter';
import { comparisonEngine } from '../ComparisonEngine';
import type { Contribution } from '../types';
import type { CommitteeContributionData } from '../types-committee';

/**
 * Example 1: Compare two specific candidates (e.g., Slotkin vs Rogers in MI Senate)
 */
export async function example1_CompareTwoCandidates() {
  // Initialize registry
  await candidateRegistry.initialize();

  // Get candidates
  const slotkin = candidateRegistry.getCandidateById('S4MI00470'); // Elissa Slotkin
  const rogers = candidateRegistry.getCandidateById('S4MI00XXX'); // Mike Rogers (example)

  if (!slotkin || !rogers) {
    console.error('Candidates not found');
    return;
  }

  // Load contribution data
  const contributions: Contribution[] = await fetch('/data/donors/contributions.json').then(
    (r) => r.json()
  );
  const committeeData: CommitteeContributionData = await fetch(
    '/data/donors/committee-contributions.json'
  ).then((r) => r.json());
  const ieData = await fetch('/data/donors/independent-expenditures.json').then((r) =>
    r.json()
  );

  // Compare
  const comparison = comparisonEngine.compareCandidates(
    [slotkin, rogers],
    contributions,
    committeeData,
    ieData
  );

  // Display results
  console.log('=== MI Senate Race Comparison ===\n');

  comparison.candidates.forEach((profile) => {
    console.log(`${profile.name} (${profile.party})`);
    console.log(`  Total Raised: $${(profile.totalRaised / 1000000).toFixed(2)}M`);
    console.log(`  Donor Count: ${profile.donorCount.toLocaleString()}`);
    console.log(`  Avg Contribution: $${profile.avgContribution.toFixed(0)}`);
    console.log(`  Small Dollar %: ${profile.smallDollarPct.toFixed(1)}%`);
    console.log(`  Grassroots Score: ${profile.grassrootsScore.toFixed(0)}/100`);
    console.log(`  IE Support: $${(profile.ieSupport / 1000000).toFixed(2)}M`);
    console.log(`  IE Oppose: $${(profile.ieOppose / 1000000).toFixed(2)}M`);
    console.log(`  Total Investment: $${(profile.totalInvestment / 1000000).toFixed(2)}M\n`);
  });

  console.log('=== Comparison ===');
  console.log(
    `Total Raised Advantage: ${comparison.comparison.totalRaisedAdvantage.candidateName} +$${(comparison.comparison.totalRaisedAdvantage.amount / 1000000).toFixed(2)}M (${comparison.comparison.totalRaisedAdvantage.percentage.toFixed(0)}%)`
  );
  console.log(
    `Donor Count Advantage: ${comparison.comparison.donorCountAdvantage.candidateName} +${comparison.comparison.donorCountAdvantage.amount.toLocaleString()} donors`
  );
  console.log(
    `Grassroots Advantage: ${comparison.comparison.grassrootsAdvantage.candidateName}`
  );
  console.log(
    `Outside Money Advantage: ${comparison.comparison.outsideMoneyAdvantage.candidateName} +$${(comparison.comparison.outsideMoneyAdvantage.amount / 1000000).toFixed(2)}M`
  );

  console.log('\n=== Insights ===');
  comparison.insights.forEach((insight) => console.log(`- ${insight}`));
}

/**
 * Example 2: Compare all candidates in MI-07 House race
 */
export async function example2_CompareRace() {
  await candidateRegistry.initialize();

  // Get all MI-07 candidates
  const mi07Candidates = candidateRegistry.getCandidatesByRace('MI-H-07');

  console.log(`\n=== MI-07 House Race (${mi07Candidates.length} candidates) ===\n`);

  // Load data
  const contributions: Contribution[] = await fetch('/data/donors/contributions.json').then(
    (r) => r.json()
  );
  const committeeData: CommitteeContributionData = await fetch(
    '/data/donors/committee-contributions.json'
  ).then((r) => r.json());
  const ieData = await fetch('/data/donors/independent-expenditures.json').then((r) =>
    r.json()
  );

  // Compare race
  const raceComparison = comparisonEngine.compareRace(
    'MI-H-07',
    mi07Candidates,
    contributions,
    committeeData,
    ieData
  );

  // Display leaderboard
  console.log('Leaderboard:');
  raceComparison.leaderboard.forEach((entry) => {
    console.log(
      `${entry.rank}. ${entry.name} (${entry.party}) - $${(entry.totalRaised / 1000000).toFixed(2)}M`
    );
    if (entry.advantage > 0) {
      console.log(`   (+$${(entry.advantage / 1000).toFixed(0)}K advantage)`);
    }
  });

  console.log(`\nTotal Race Investment: $${(raceComparison.totalRaised / 1000000).toFixed(2)}M`);
  console.log(`Total Donors: ${raceComparison.totalDonors.toLocaleString()}`);

  console.log('\nInsights:');
  raceComparison.insights.forEach((insight) => console.log(`- ${insight}`));
}

/**
 * Example 3: Filter contributions by recipient (one candidate)
 */
export async function example3_FilterContributions() {
  await candidateRegistry.initialize();

  const slotkin = candidateRegistry.getCandidateById('S4MI00470');
  if (!slotkin) return;

  const contributions: Contribution[] = await fetch('/data/donors/contributions.json').then(
    (r) => r.json()
  );

  // Get all contributions to Slotkin
  const slotkinContribs = recipientFilter.getContributionsForCandidate(
    contributions,
    slotkin.candidateId
  );

  console.log('\n=== Elissa Slotkin - Individual Contributions ===');
  console.log(`Total: $${slotkinContribs.totalAmount.toLocaleString()}`);
  console.log(`Donors: ${slotkinContribs.donorCount.toLocaleString()}`);
  console.log(`Contributions: ${slotkinContribs.contributionCount.toLocaleString()}`);
  console.log(`Avg: $${slotkinContribs.avgContribution.toFixed(0)}`);
  console.log(`Median: $${slotkinContribs.medianContribution.toFixed(0)}`);

  // Filter by amount
  const smallDollar = recipientFilter.filterContributions(contributions, {
    candidateIds: [slotkin.candidateId],
    maxAmount: 200,
  });

  console.log(
    `\nSmall Dollar (<$200): $${smallDollar.totalAmount.toLocaleString()} (${((smallDollar.totalAmount / slotkinContribs.totalAmount) * 100).toFixed(1)}%)`
  );

  // Filter by ZIP
  const inghamZips = ['48823', '48864', '48933', '48910', '48911'];
  const inghamContribs = recipientFilter.filterContributions(contributions, {
    candidateIds: [slotkin.candidateId],
    zipCodes: inghamZips,
  });

  console.log(
    `\nIngham County: $${inghamContribs.totalAmount.toLocaleString()} from ${inghamContribs.donorCount} donors`
  );
}

/**
 * Example 4: Get leaderboard (top fundraisers)
 */
export async function example4_GetLeaderboard() {
  await candidateRegistry.initialize();

  // Load data
  const contributions: Contribution[] = await fetch('/data/donors/contributions.json').then(
    (r) => r.json()
  );
  const committeeData: CommitteeContributionData = await fetch(
    '/data/donors/committee-contributions.json'
  ).then((r) => r.json());
  const ieData = await fetch('/data/donors/independent-expenditures.json').then((r) =>
    r.json()
  );

  // Get all MI candidates
  const miCandidates = candidateRegistry.getCandidatesByState('MI');

  // Get leaderboard
  const leaderboard = comparisonEngine.getLeaderboard(
    miCandidates,
    contributions,
    committeeData,
    ieData,
    { state: 'MI' }
  );

  console.log('\n=== Michigan Fundraising Leaderboard ===\n');
  leaderboard.candidates.slice(0, 10).forEach((candidate) => {
    console.log(
      `${candidate.rank}. ${candidate.name} (${candidate.party} - ${candidate.state}${candidate.district ? `-${candidate.district}` : ''})`
    );
    console.log(`   Raised: $${(candidate.totalRaised / 1000000).toFixed(2)}M`);
    console.log(`   Donors: ${candidate.donorCount.toLocaleString()}`);
    console.log(`   Grassroots Score: ${candidate.grassrootsScore.toFixed(0)}/100`);
    console.log(
      `   Total Investment: $${(candidate.totalInvestment / 1000000).toFixed(2)}M\n`
    );
  });
}

/**
 * Example 5: Filter by party and office
 */
export async function example5_FilterByPartyAndOffice() {
  await candidateRegistry.initialize();

  // Get all Democratic House candidates in Michigan
  const demHouseCandidates = candidateRegistry
    .getCandidatesByState('MI')
    .filter((c) => c.office === 'H' && c.party === 'DEM');

  console.log('\n=== Michigan Democratic House Candidates ===');
  console.log(`Total: ${demHouseCandidates.length}\n`);

  demHouseCandidates
    .sort((a, b) => b.totalRaised - a.totalRaised)
    .forEach((candidate) => {
      console.log(
        `${candidate.name} (MI-${candidate.district}) - $${(candidate.totalRaised / 1000000).toFixed(2)}M`
      );
    });
}

/**
 * Example 6: Search candidates by name
 */
export async function example6_SearchByName() {
  await candidateRegistry.initialize();

  const results = candidateRegistry.searchByName('slotkin');

  console.log('\n=== Search Results for "slotkin" ===\n');
  results.forEach((candidate) => {
    console.log(`${candidate.name} (${candidate.party} - ${candidate.state}-${candidate.office})`);
    console.log(`  Total Raised: $${(candidate.totalRaised / 1000000).toFixed(2)}M`);
    console.log(`  IE Support: $${(candidate.ieSupport / 1000000).toFixed(2)}M`);
    console.log(`  IE Oppose: $${(candidate.ieOppose / 1000000).toFixed(2)}M\n`);
  });
}

/**
 * Example 7: Compare across different offices (cross-race comparison)
 */
export async function example7_CrossRaceComparison() {
  await candidateRegistry.initialize();

  // Get top House candidate
  const houseCandidates = candidateRegistry.getCandidatesByOffice('H');
  const topHouse = houseCandidates.sort((a, b) => b.totalRaised - a.totalRaised)[0];

  // Get top Senate candidate
  const senateCandidates = candidateRegistry.getCandidatesByOffice('S');
  const topSenate = senateCandidates.sort((a, b) => b.totalRaised - a.totalRaised)[0];

  console.log('\n=== Top House vs Top Senate Fundraiser ===\n');
  console.log(`House: ${topHouse.name} - $${(topHouse.totalRaised / 1000000).toFixed(2)}M`);
  console.log(
    `Senate: ${topSenate.name} - $${(topSenate.totalRaised / 1000000).toFixed(2)}M`
  );

  const diff = topSenate.totalRaised - topHouse.totalRaised;
  console.log(
    `\nDifference: $${Math.abs(diff / 1000000).toFixed(2)}M (Senate ${diff > 0 ? 'higher' : 'lower'})`
  );
}

// Export all examples
export const examples = {
  example1_CompareTwoCandidates,
  example2_CompareRace,
  example3_FilterContributions,
  example4_GetLeaderboard,
  example5_FilterByPartyAndOffice,
  example6_SearchByName,
  example7_CrossRaceComparison,
};
