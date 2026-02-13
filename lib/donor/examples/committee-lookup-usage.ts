/**
 * Example Usage: Committee Lookup Service
 *
 * This file demonstrates how to use the CommitteeLookupService
 * to query FEC committee data in the application.
 */

import { CommitteeLookup } from '../CommitteeLookup';

/**
 * Example 1: Initialize and get basic stats
 */
async function example1_BasicStats() {
  console.log('Example 1: Get Committee Data Stats');
  console.log('=====================================\n');

  // Initialize the service (must be done before any queries)
  await CommitteeLookup.initialize();

  // Get summary statistics
  const stats = CommitteeLookup.getStats();
  console.log('Total Committees:', stats.total.toLocaleString());
  console.log('\nBy Party:');
  console.log('  Democratic:', stats.byParty.DEM.toLocaleString());
  console.log('  Republican:', stats.byParty.REP.toLocaleString());
  console.log('  Other:', stats.byParty.OTHER.toLocaleString());
  console.log('  Unknown:', stats.byParty.UNKNOWN.toLocaleString());
  console.log('\nProcessed At:', stats.processedAt);
}

/**
 * Example 2: Look up specific committees
 */
async function example2_LookupCommittees() {
  console.log('\nExample 2: Look Up Specific Committees');
  console.log('========================================\n');

  await CommitteeLookup.initialize();

  // Look up major party committees
  const dccc = CommitteeLookup.getById('C00000935');
  const rnc = CommitteeLookup.getById('C00003418');
  const actblue = CommitteeLookup.getById('C00401224');

  console.log('DCCC:', dccc?.name, '-', dccc?.party);
  console.log('RNC:', rnc?.name, '-', rnc?.party);
  console.log('ActBlue:', actblue?.name, '-', actblue?.party);
}

/**
 * Example 3: Search committees by name
 */
async function example3_SearchByName() {
  console.log('\nExample 3: Search Committees by Name');
  console.log('======================================\n');

  await CommitteeLookup.initialize();

  // Search for committees containing "michigan"
  const michiganCommittees = CommitteeLookup.searchByName('michigan').slice(0, 5);

  console.log('Michigan Committees (first 5):');
  michiganCommittees.forEach((committee) => {
    console.log(`  ${committee.id} - ${committee.name} (${committee.party})`);
  });
}

/**
 * Example 4: Get committees by type
 */
async function example4_GetByType() {
  console.log('\nExample 4: Get Committees by Type');
  console.log('===================================\n');

  await CommitteeLookup.initialize();

  // Get Super PACs
  const superPACs = CommitteeLookup.getSuperPACs().slice(0, 5);
  console.log('Super PACs (first 5):');
  superPACs.forEach((committee) => {
    console.log(`  ${committee.name} - ${committee.party}`);
  });

  // Get Party Committees
  const partyCommittees = CommitteeLookup.getPartyCommittees().slice(0, 5);
  console.log('\nParty Committees (first 5):');
  partyCommittees.forEach((committee) => {
    console.log(`  ${committee.name} - ${committee.party}`);
  });
}

/**
 * Example 5: Get committees by party
 */
async function example5_GetByParty() {
  console.log('\nExample 5: Get Committees by Party');
  console.log('====================================\n');

  await CommitteeLookup.initialize();

  // Get Democratic committees
  const demCommittees = CommitteeLookup.getByParty('DEM').slice(0, 5);
  console.log('Democratic Committees (first 5):');
  demCommittees.forEach((committee) => {
    console.log(`  ${committee.name} (${committee.typeDescription})`);
  });

  // Get Republican committees
  const repCommittees = CommitteeLookup.getByParty('REP').slice(0, 5);
  console.log('\nRepublican Committees (first 5):');
  repCommittees.forEach((committee) => {
    console.log(`  ${committee.name} (${committee.typeDescription})`);
  });
}

/**
 * Example 6: Get committees by state
 */
async function example6_GetByState() {
  console.log('\nExample 6: Get Committees by State');
  console.log('====================================\n');

  await CommitteeLookup.initialize();

  // Get Michigan committees
  const michiganCommittees = CommitteeLookup.getByState('MI').slice(0, 5);
  console.log('Michigan Committees (first 5):');
  michiganCommittees.forEach((committee) => {
    console.log(`  ${committee.name} - ${committee.party}`);
  });
}

/**
 * Example 7: Batch lookup
 */
async function example7_BatchLookup() {
  console.log('\nExample 7: Batch Lookup');
  console.log('========================\n');

  await CommitteeLookup.initialize();

  // Look up multiple committees at once
  const committeeIds = ['C00000935', 'C00003418', 'C00401224', 'C00010603'];
  const committees = CommitteeLookup.getBatch(committeeIds);

  console.log('Batch Lookup Results:');
  committees.forEach((committee) => {
    console.log(`  ${committee.id}: ${committee.name} (${committee.party})`);
  });
}

/**
 * Example 8: Check committee existence and get party
 */
async function example8_UtilityMethods() {
  console.log('\nExample 8: Utility Methods');
  console.log('===========================\n');

  await CommitteeLookup.initialize();

  const testIds = ['C00000935', 'C99999999', 'C00003418'];

  testIds.forEach((id) => {
    const exists = CommitteeLookup.exists(id);
    const party = CommitteeLookup.getParty(id);
    const name = CommitteeLookup.getName(id);

    console.log(`Committee ${id}:`);
    console.log(`  Exists: ${exists}`);
    console.log(`  Party: ${party}`);
    console.log(`  Name: ${name}`);
  });
}

/**
 * Example 9: React Component Usage
 */
function example9_ReactComponent() {
  console.log('\nExample 9: React Component Usage');
  console.log('==================================\n');

  console.log(`
import { useEffect, useState } from 'react';
import { CommitteeLookup } from '@/lib/donor/CommitteeLookup';

function DonorAnalysisComponent() {
  const [initialized, setInitialized] = useState(false);
  const [committee, setCommittee] = useState(null);

  useEffect(() => {
    // Initialize on component mount
    CommitteeLookup.initialize().then(() => {
      setInitialized(true);
    });
  }, []);

  useEffect(() => {
    if (initialized) {
      // Look up a committee
      const dccc = CommitteeLookup.getById('C00000935');
      setCommittee(dccc);
    }
  }, [initialized]);

  if (!initialized) {
    return <div>Loading committee data...</div>;
  }

  return (
    <div>
      <h2>Committee Info</h2>
      {committee && (
        <div>
          <p>Name: {committee.name}</p>
          <p>Party: {committee.party}</p>
          <p>Type: {committee.typeDescription}</p>
        </div>
      )}
    </div>
  );
}
  `);
}

/**
 * Run all examples
 */
async function runAllExamples() {
  try {
    await example1_BasicStats();
    await example2_LookupCommittees();
    await example3_SearchByName();
    await example4_GetByType();
    await example5_GetByParty();
    await example6_GetByState();
    await example7_BatchLookup();
    await example8_UtilityMethods();
    example9_ReactComponent();

    console.log('\n✅ All examples completed successfully!');
  } catch (error) {
    console.error('❌ Error running examples:', error);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples();
}

export {
  example1_BasicStats,
  example2_LookupCommittees,
  example3_SearchByName,
  example4_GetByType,
  example5_GetByParty,
  example6_GetByState,
  example7_BatchLookup,
  example8_UtilityMethods,
  example9_ReactComponent,
  runAllExamples,
};
