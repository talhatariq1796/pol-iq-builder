/**
 * DonorLayerSwitcher Component
 *
 * UI component for switching between donor visualization modes
 * and controlling layer-specific options.
 *
 * Features:
 * - Tab-based layer selection
 * - Layer-specific controls (color by, filters, etc.)
 * - Legend display for active layer
 */

import { useState } from 'react';

// ============================================================================
// Types
// ============================================================================

export type DonorLayerType = 'individual' | 'lapsed' | 'upgrade' | 'ie' | 'comparison';

interface DonorLayerOptions {
  individual: {
    colorBy: 'amount' | 'frequency' | 'recency';
    minAmount: number;
  };
  lapsed: {
    colorBy: 'recoveryScore' | 'historicalValue' | 'count';
    minRecoveryScore: number;
  };
  upgrade: {
    colorBy: 'upgradeScore' | 'upgradeGap' | 'utilization';
    minScore: number;
  };
  ie: {
    showFor: 'all' | 'DEM' | 'REP';
    colorBy: 'totalSpending' | 'netAdvantage';
  };
}

interface DonorLayerSwitcherProps {
  activeLayer: DonorLayerType;
  onLayerChange: (layer: DonorLayerType) => void;
  layerOptions: DonorLayerOptions;
  onOptionsChange: (layer: keyof DonorLayerOptions, options: any) => void;
  className?: string;
}

// ============================================================================
// Main Component
// ============================================================================

export function DonorLayerSwitcher({
  activeLayer,
  onLayerChange,
  layerOptions,
  onOptionsChange,
  className = '',
}: DonorLayerSwitcherProps) {
  const [showControls, setShowControls] = useState(true);

  return (
    <div className={`bg-white rounded-xl shadow-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-800">Donor Visualization</h3>
        <button
          onClick={() => setShowControls(!showControls)}
          className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
          title={showControls ? 'Collapse controls' : 'Expand controls'}
        >
          <svg
            className={`w-4 h-4 transition-transform ${showControls ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {showControls && (
        <div className="p-4 space-y-4">
          {/* Layer Tabs */}
          <div className="flex flex-col gap-1">
            <button
              onClick={() => onLayerChange('individual')}
              className={`px-3 py-2 text-xs rounded-lg font-medium transition-all text-left ${
                activeLayer === 'individual'
                  ? 'bg-[#33a852] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>Individual Donors</span>
                {activeLayer === 'individual' && (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
            </button>

            <button
              onClick={() => onLayerChange('lapsed')}
              className={`px-3 py-2 text-xs rounded-lg font-medium transition-all text-left ${
                activeLayer === 'lapsed'
                  ? 'bg-[#33a852] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>Lapsed Donors</span>
                {activeLayer === 'lapsed' && (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
            </button>

            <button
              onClick={() => onLayerChange('upgrade')}
              className={`px-3 py-2 text-xs rounded-lg font-medium transition-all text-left ${
                activeLayer === 'upgrade'
                  ? 'bg-[#33a852] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>Upgrade Prospects</span>
                {activeLayer === 'upgrade' && (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
            </button>

            <button
              onClick={() => onLayerChange('ie')}
              className={`px-3 py-2 text-xs rounded-lg font-medium transition-all text-left ${
                activeLayer === 'ie'
                  ? 'bg-[#33a852] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>Independent Expenditures</span>
                {activeLayer === 'ie' && (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
            </button>
          </div>

          {/* Layer-Specific Controls */}
          <div className="pt-3 border-t border-gray-200">
            {/* Individual Donors Controls */}
            {activeLayer === 'individual' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Color By</label>
                  <select
                    value={layerOptions.individual.colorBy}
                    onChange={(e) =>
                      onOptionsChange('individual', {
                        ...layerOptions.individual,
                        colorBy: e.target.value,
                      })
                    }
                    className="w-full px-2 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-[#33a852] focus:border-[#33a852]"
                  >
                    <option value="amount">Total Amount</option>
                    <option value="frequency">Gift Frequency</option>
                    <option value="recency">Last Gift Date</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Min Amount: ${layerOptions.individual.minAmount}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="5000"
                    step="100"
                    value={layerOptions.individual.minAmount}
                    onChange={(e) =>
                      onOptionsChange('individual', {
                        ...layerOptions.individual,
                        minAmount: parseInt(e.target.value),
                      })
                    }
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200"
                  />
                </div>
              </div>
            )}

            {/* Lapsed Donors Controls */}
            {activeLayer === 'lapsed' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Color By</label>
                  <select
                    value={layerOptions.lapsed.colorBy}
                    onChange={(e) =>
                      onOptionsChange('lapsed', {
                        ...layerOptions.lapsed,
                        colorBy: e.target.value,
                      })
                    }
                    className="w-full px-2 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-[#33a852] focus:border-[#33a852]"
                  >
                    <option value="recoveryScore">Recovery Score</option>
                    <option value="historicalValue">Historical Value</option>
                    <option value="count">Donor Count</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Min Recovery Score: {layerOptions.lapsed.minRecoveryScore}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={layerOptions.lapsed.minRecoveryScore}
                    onChange={(e) =>
                      onOptionsChange('lapsed', {
                        ...layerOptions.lapsed,
                        minRecoveryScore: parseInt(e.target.value),
                      })
                    }
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200"
                  />
                </div>
              </div>
            )}

            {/* Upgrade Prospects Controls */}
            {activeLayer === 'upgrade' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Color By</label>
                  <select
                    value={layerOptions.upgrade.colorBy}
                    onChange={(e) =>
                      onOptionsChange('upgrade', {
                        ...layerOptions.upgrade,
                        colorBy: e.target.value,
                      })
                    }
                    className="w-full px-2 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-[#33a852] focus:border-[#33a852]"
                  >
                    <option value="upgradeScore">Upgrade Score</option>
                    <option value="upgradeGap">Upgrade Gap ($)</option>
                    <option value="utilization">Capacity Utilization</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Min Upgrade Score: {layerOptions.upgrade.minScore}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={layerOptions.upgrade.minScore}
                    onChange={(e) =>
                      onOptionsChange('upgrade', {
                        ...layerOptions.upgrade,
                        minScore: parseInt(e.target.value),
                      })
                    }
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200"
                  />
                </div>
              </div>
            )}

            {/* IE Spending Controls */}
            {activeLayer === 'ie' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Show Spending For</label>
                  <select
                    value={layerOptions.ie.showFor}
                    onChange={(e) =>
                      onOptionsChange('ie', {
                        ...layerOptions.ie,
                        showFor: e.target.value,
                      })
                    }
                    className="w-full px-2 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-[#33a852] focus:border-[#33a852]"
                  >
                    <option value="all">All Parties</option>
                    <option value="DEM">Democrats Only</option>
                    <option value="REP">Republicans Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Color By</label>
                  <select
                    value={layerOptions.ie.colorBy}
                    onChange={(e) =>
                      onOptionsChange('ie', {
                        ...layerOptions.ie,
                        colorBy: e.target.value,
                      })
                    }
                    className="w-full px-2 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-[#33a852] focus:border-[#33a852]"
                  >
                    <option value="totalSpending">Total Spending</option>
                    <option value="netAdvantage">Party Advantage</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="pt-3 border-t border-gray-200">
            <h4 className="text-xs font-semibold text-gray-700 mb-2">Legend</h4>
            <div className="space-y-1.5">
              {activeLayer === 'lapsed' && (
                <>
                  <LegendItem color="rgb(34, 197, 94)" label="High Recovery (80-100)" />
                  <LegendItem color="rgb(234, 179, 8)" label="Medium Recovery (60-79)" />
                  <LegendItem color="rgb(239, 68, 68)" label="Low Recovery (0-59)" />
                </>
              )}

              {activeLayer === 'upgrade' && (
                <>
                  <LegendItem color="rgb(107, 33, 168)" label="High Potential (80-100)" />
                  <LegendItem color="rgb(147, 51, 234)" label="Medium Potential (60-79)" />
                  <LegendItem color="rgb(216, 180, 254)" label="Low Potential (0-59)" />
                </>
              )}

              {activeLayer === 'ie' && layerOptions.ie.colorBy === 'netAdvantage' && (
                <>
                  <LegendItem color="rgb(37, 99, 235)" label="DEM Advantage" />
                  <LegendItem color="rgb(147, 51, 234)" label="Contested" />
                  <LegendItem color="rgb(220, 38, 38)" label="REP Advantage" />
                </>
              )}

              {activeLayer === 'ie' && layerOptions.ie.colorBy === 'totalSpending' && (
                <>
                  <LegendItem color="rgb(234, 88, 12)" label="High Spending (>$10M)" />
                  <LegendItem color="rgb(251, 146, 60)" label="Medium Spending ($1M-$10M)" />
                  <LegendItem color="rgb(254, 215, 170)" label="Low Spending (<$1M)" />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-4 h-3 rounded border border-gray-300"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs text-gray-700">{label}</span>
    </div>
  );
}

export default DonorLayerSwitcher;
