'use client';

import React, { useState, useCallback, useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface TurnoutScenario {
  id: string;
  name: string;
  description: string;
  turnoutMultipliers: {
    base: number;      // Multiplier for base voters (strong partisans)
    swing: number;     // Multiplier for swing voters
    infrequent: number; // Multiplier for infrequent voters
  };
  demographicModifiers?: {
    young?: number;    // 18-34 turnout modifier
    senior?: number;   // 65+ turnout modifier
    college?: number;  // College-educated modifier
    urban?: number;    // Urban area modifier
  };
}

export interface PrecinctScenarioResult {
  precinctId: string;
  precinctName: string;
  baselineTurnout: number;
  projectedTurnout: number;
  turnoutChange: number;
  baselineMargin: number;
  projectedMargin: number;
  marginSwing: number;
  votesGained: number;
  flipped: boolean;
}

export interface ScenarioSummary {
  scenarioName: string;
  totalVotersAdded: number;
  netMarginChange: number;
  precinctsFlipped: number;
  highestImpactPrecincts: PrecinctScenarioResult[];
  recommendation: string;
}

export interface WhatIfPanelProps {
  precincts: PrecinctData[];
  onScenarioRun?: (summary: ScenarioSummary) => void;
  onClose?: () => void;
}

interface PrecinctData {
  id: string;
  name: string;
  jurisdiction: string;
  demographics: {
    population18up: number;
    medianAge: number;
    collegePct: number;
    populationDensity: number;
  };
  electoral: {
    avgTurnout: number;
    partisanLean: number;
  };
  political: {
    demAffiliationPct: number;
    repAffiliationPct: number;
    independentPct: number;
  };
}

// ============================================================================
// Preset Scenarios
// ============================================================================

const PRESET_SCENARIOS: TurnoutScenario[] = [
  {
    id: 'presidential-surge',
    name: 'Presidential Year Surge',
    description: 'Model turnout similar to 2020 presidential election (+15% overall)',
    turnoutMultipliers: {
      base: 1.10,
      swing: 1.20,
      infrequent: 1.25,
    },
    demographicModifiers: {
      young: 1.15,
      senior: 1.05,
    },
  },
  {
    id: 'midterm-dropoff',
    name: 'Midterm Dropoff',
    description: 'Model typical midterm turnout decline (-12% from presidential)',
    turnoutMultipliers: {
      base: 0.95,
      swing: 0.85,
      infrequent: 0.70,
    },
    demographicModifiers: {
      young: 0.75,
      senior: 0.95,
    },
  },
  {
    id: 'gotv-success',
    name: 'Successful GOTV Campaign',
    description: 'Model +8% turnout among base voters from ground game',
    turnoutMultipliers: {
      base: 1.15,
      swing: 1.05,
      infrequent: 1.20,
    },
  },
  {
    id: 'youth-mobilization',
    name: 'Youth Mobilization',
    description: 'Model +20% turnout among 18-34 year olds',
    turnoutMultipliers: {
      base: 1.05,
      swing: 1.10,
      infrequent: 1.15,
    },
    demographicModifiers: {
      young: 1.25,
      senior: 1.00,
      college: 1.15,
    },
  },
  {
    id: 'senior-surge',
    name: 'Senior Voter Surge',
    description: 'Model +12% turnout among 65+ voters',
    turnoutMultipliers: {
      base: 1.08,
      swing: 1.05,
      infrequent: 1.10,
    },
    demographicModifiers: {
      young: 1.00,
      senior: 1.15,
    },
  },
  {
    id: 'low-turnout',
    name: 'Low Turnout Election',
    description: 'Model special election or low-engagement scenario (-20%)',
    turnoutMultipliers: {
      base: 0.90,
      swing: 0.75,
      infrequent: 0.50,
    },
  },
];

// ============================================================================
// Turnout Modeling Engine
// ============================================================================

function calculateScenarioResults(
  precincts: PrecinctData[],
  scenario: TurnoutScenario
): PrecinctScenarioResult[] {
  return precincts.map(precinct => {
    const { demographics, electoral, political } = precinct;

    // Baseline values
    const baselineTurnout = electoral.avgTurnout;
    const baselineMargin = electoral.partisanLean; // Positive = D advantage

    // Calculate voter composition weights
    const baseVoterPct = (political.demAffiliationPct + political.repAffiliationPct) * 0.7;
    const swingVoterPct = political.independentPct * 0.5 + (political.demAffiliationPct + political.repAffiliationPct) * 0.1;
    const infrequentPct = 100 - baseVoterPct - swingVoterPct;

    // Apply turnout multipliers
    let turnoutMultiplier =
      (baseVoterPct / 100) * scenario.turnoutMultipliers.base +
      (swingVoterPct / 100) * scenario.turnoutMultipliers.swing +
      (infrequentPct / 100) * scenario.turnoutMultipliers.infrequent;

    // Apply demographic modifiers
    if (scenario.demographicModifiers) {
      const dm = scenario.demographicModifiers;

      // Age-based modifiers
      if (dm.young && demographics.medianAge < 35) {
        turnoutMultiplier *= dm.young;
      } else if (dm.senior && demographics.medianAge > 55) {
        turnoutMultiplier *= dm.senior;
      }

      // Education modifier
      if (dm.college && demographics.collegePct > 40) {
        const collegeBoost = (demographics.collegePct - 40) / 60; // 0-1 scale
        turnoutMultiplier *= 1 + (dm.college - 1) * collegeBoost;
      }

      // Urban modifier
      if (dm.urban && demographics.populationDensity > 2000) {
        turnoutMultiplier *= dm.urban;
      }
    }

    // Calculate projected turnout (capped at 95%)
    const projectedTurnout = Math.min(95, baselineTurnout * turnoutMultiplier);
    const turnoutChange = projectedTurnout - baselineTurnout;

    // Calculate margin impact
    // Assumption: New voters follow area's partisan lean but with regression to mean
    const newVoterLean = baselineMargin * 0.7; // New voters are less partisan
    const existingVoterMargin = baselineMargin;

    // Weighted margin based on turnout mix
    const existingVoterWeight = baselineTurnout / projectedTurnout;
    const newVoterWeight = 1 - existingVoterWeight;

    const projectedMargin =
      existingVoterMargin * existingVoterWeight +
      newVoterLean * newVoterWeight;

    const marginSwing = projectedMargin - baselineMargin;

    // Calculate actual votes gained (for the favored party)
    const votingAgePop = demographics.population18up;
    const baselineVotes = votingAgePop * (baselineTurnout / 100);
    const projectedVotes = votingAgePop * (projectedTurnout / 100);
    const votesGained = Math.round((projectedVotes - baselineVotes) * (projectedMargin / 100));

    // Check if precinct "flipped"
    const flipped =
      (baselineMargin > 0 && projectedMargin < 0) ||
      (baselineMargin < 0 && projectedMargin > 0);

    return {
      precinctId: precinct.id,
      precinctName: precinct.name,
      baselineTurnout: Math.round(baselineTurnout * 10) / 10,
      projectedTurnout: Math.round(projectedTurnout * 10) / 10,
      turnoutChange: Math.round(turnoutChange * 10) / 10,
      baselineMargin: Math.round(baselineMargin * 10) / 10,
      projectedMargin: Math.round(projectedMargin * 10) / 10,
      marginSwing: Math.round(marginSwing * 10) / 10,
      votesGained,
      flipped,
    };
  });
}

function generateSummary(
  scenario: TurnoutScenario,
  results: PrecinctScenarioResult[]
): ScenarioSummary {
  const totalVotersAdded = results.reduce(
    (sum, r) => sum + Math.max(0, r.votesGained),
    0
  );

  const netMarginChange =
    results.reduce((sum, r) => sum + r.marginSwing, 0) / results.length;

  const precinctsFlipped = results.filter(r => r.flipped).length;

  // Sort by absolute margin swing to find highest impact
  const highestImpactPrecincts = [...results]
    .sort((a, b) => Math.abs(b.marginSwing) - Math.abs(a.marginSwing))
    .slice(0, 5);

  // Generate recommendation
  let recommendation: string;
  if (totalVotersAdded > 1000 && netMarginChange > 2) {
    recommendation = `This scenario adds ${totalVotersAdded.toLocaleString()} voters with a +${netMarginChange.toFixed(1)} point margin shift. High-impact precincts: ${highestImpactPrecincts.slice(0, 3).map(p => p.precinctName).join(', ')}.`;
  } else if (totalVotersAdded > 500) {
    recommendation = `Moderate impact: ${totalVotersAdded.toLocaleString()} additional voters. Focus GOTV resources on ${highestImpactPrecincts[0].precinctName} for maximum effect.`;
  } else if (netMarginChange < -2) {
    recommendation = `Warning: This scenario shifts margins against you by ${Math.abs(netMarginChange).toFixed(1)} points. Consider defensive strategies in vulnerable precincts.`;
  } else {
    recommendation = `Limited impact scenario. Consider combining with targeted persuasion in swing precincts.`;
  }

  return {
    scenarioName: scenario.name,
    totalVotersAdded,
    netMarginChange: Math.round(netMarginChange * 10) / 10,
    precinctsFlipped,
    highestImpactPrecincts,
    recommendation,
  };
}

// ============================================================================
// Component
// ============================================================================

export const WhatIfPoliticalPanel: React.FC<WhatIfPanelProps> = ({
  precincts,
  onScenarioRun,
  onClose,
}) => {
  const [selectedScenario, setSelectedScenario] = useState<TurnoutScenario | null>(null);
  const [customScenario, setCustomScenario] = useState<TurnoutScenario>({
    id: 'custom',
    name: 'Custom Scenario',
    description: 'Your custom turnout model',
    turnoutMultipliers: {
      base: 1.0,
      swing: 1.0,
      infrequent: 1.0,
    },
  });
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [results, setResults] = useState<PrecinctScenarioResult[] | null>(null);
  const [summary, setSummary] = useState<ScenarioSummary | null>(null);

  // Run scenario
  const runScenario = useCallback(() => {
    const scenario = isCustomMode ? customScenario : selectedScenario;
    if (!scenario || precincts.length === 0) return;

    const scenarioResults = calculateScenarioResults(precincts, scenario);
    const scenarioSummary = generateSummary(scenario, scenarioResults);

    setResults(scenarioResults);
    setSummary(scenarioSummary);

    if (onScenarioRun) {
      onScenarioRun(scenarioSummary);
    }
  }, [selectedScenario, customScenario, isCustomMode, precincts, onScenarioRun]);

  // Memoized sorted results for display
  const sortedResults = useMemo(() => {
    if (!results) return [];
    return [...results].sort((a, b) => Math.abs(b.marginSwing) - Math.abs(a.marginSwing));
  }, [results]);

  return (
    <div className="what-if-panel bg-white rounded-lg shadow-lg p-6 max-w-4xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">What-If Turnout Modeling</h2>
          <p className="text-sm text-gray-600">
            Model different turnout scenarios and see projected impacts
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Scenario Selection */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => setIsCustomMode(false)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              !isCustomMode
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Preset Scenarios
          </button>
          <button
            onClick={() => setIsCustomMode(true)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              isCustomMode
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Custom
          </button>
        </div>

        {!isCustomMode ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {PRESET_SCENARIOS.map(scenario => (
              <button
                key={scenario.id}
                onClick={() => setSelectedScenario(scenario)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  selectedScenario?.id === scenario.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="font-medium text-sm text-gray-900">{scenario.name}</div>
                <div className="text-xs text-gray-500 mt-1">{scenario.description}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Turnout Multipliers
              </label>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-gray-500">Base Voters</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.5"
                    max="1.5"
                    value={customScenario.turnoutMultipliers.base}
                    onChange={e =>
                      setCustomScenario((prev: TurnoutScenario) => ({
                        ...prev,
                        turnoutMultipliers: {
                          ...prev.turnoutMultipliers,
                          base: parseFloat(e.target.value) || 1,
                        },
                      }))
                    }
                    className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Swing Voters</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.5"
                    max="1.5"
                    value={customScenario.turnoutMultipliers.swing}
                    onChange={e =>
                      setCustomScenario((prev: TurnoutScenario) => ({
                        ...prev,
                        turnoutMultipliers: {
                          ...prev.turnoutMultipliers,
                          swing: parseFloat(e.target.value) || 1,
                        },
                      }))
                    }
                    className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Infrequent</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.5"
                    max="1.5"
                    value={customScenario.turnoutMultipliers.infrequent}
                    onChange={e =>
                      setCustomScenario((prev: TurnoutScenario) => ({
                        ...prev,
                        turnoutMultipliers: {
                          ...prev.turnoutMultipliers,
                          infrequent: parseFloat(e.target.value) || 1,
                        },
                      }))
                    }
                    className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
                  />
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Values: 1.0 = no change, 1.1 = +10% turnout, 0.9 = -10% turnout
            </p>
          </div>
        )}
      </div>

      {/* Run Button */}
      <div className="mb-6">
        <button
          onClick={runScenario}
          disabled={!isCustomMode && !selectedScenario}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Run Scenario Analysis
        </button>
      </div>

      {/* Results */}
      {summary && (
        <div className="border-t pt-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-700">
                +{summary.totalVotersAdded.toLocaleString()}
              </div>
              <div className="text-sm text-green-600">Additional Voters</div>
            </div>
            <div className={`p-4 rounded-lg ${summary.netMarginChange >= 0 ? 'bg-blue-50' : 'bg-red-50'}`}>
              <div className={`text-2xl font-bold ${summary.netMarginChange >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                {summary.netMarginChange >= 0 ? '+' : ''}{summary.netMarginChange}
              </div>
              <div className={`text-sm ${summary.netMarginChange >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                Margin Shift (pts)
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-700">
                {summary.precinctsFlipped}
              </div>
              <div className="text-sm text-purple-600">Precincts Flipped</div>
            </div>
          </div>

          {/* Recommendation */}
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg mb-6">
            <div className="font-medium text-amber-800 mb-1">Strategic Recommendation</div>
            <div className="text-sm text-amber-700">{summary.recommendation}</div>
          </div>

          {/* Detailed Results Table */}
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Precinct-Level Impact</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Precinct</th>
                    <th className="text-right py-2 px-2">Baseline</th>
                    <th className="text-right py-2 px-2">Projected</th>
                    <th className="text-right py-2 px-2">Turnout Δ</th>
                    <th className="text-right py-2 px-2">Margin Δ</th>
                    <th className="text-right py-2 px-2">Votes</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.slice(0, 10).map(result => (
                    <tr key={result.precinctId} className={`border-b ${result.flipped ? 'bg-yellow-50' : ''}`}>
                      <td className="py-2 px-2">
                        {result.precinctName}
                        {result.flipped && (
                          <span className="ml-2 text-xs bg-yellow-200 text-yellow-800 px-1 rounded">
                            FLIP
                          </span>
                        )}
                      </td>
                      <td className="text-right py-2 px-2">{result.baselineTurnout}%</td>
                      <td className="text-right py-2 px-2">{result.projectedTurnout}%</td>
                      <td className={`text-right py-2 px-2 ${result.turnoutChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {result.turnoutChange >= 0 ? '+' : ''}{result.turnoutChange}%
                      </td>
                      <td className={`text-right py-2 px-2 ${result.marginSwing >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {result.marginSwing >= 0 ? '+' : ''}{result.marginSwing}
                      </td>
                      <td className={`text-right py-2 px-2 ${result.votesGained >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {result.votesGained >= 0 ? '+' : ''}{result.votesGained}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sortedResults.length > 10 && (
              <div className="text-sm text-gray-500 mt-2 text-center">
                Showing top 10 of {sortedResults.length} precincts by impact
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatIfPoliticalPanel;
