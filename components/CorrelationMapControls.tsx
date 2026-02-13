import React, { useState } from 'react';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { CorrelationService } from '../services/correlation.service';

interface CorrelationResult {
  pearson: number;
  spearman?: number;
  kendall?: number;
  pValue: number;
  spatialStats?: {
    moransI: number;
    getisOrdG: number;
    hotspots: number;
    coldspots: number;
    outliers: number;
  };
}

interface CorrelationMapControlsProps {
  layer: FeatureLayer;
  primaryField: string;
  comparisonField?: string;
  onFieldChange: (field: string) => void;
  onComparisonFieldChange?: (field: string) => void;
  onClose: () => void;
  correlationResult: CorrelationResult | null;
  loading: boolean;
  error: string | null;
}

export const CorrelationMapControls: React.FC<CorrelationMapControlsProps> = ({
  layer,
  primaryField,
  comparisonField,
  onFieldChange,
  onComparisonFieldChange,
  onClose,
  correlationResult,
  loading,
  error
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [correlationMethod, setCorrelationMethod] = useState<'pearson' | 'spearman' | 'kendall' | 'all'>('pearson');
  const [includeSpatialStats, setIncludeSpatialStats] = useState(false);

  const getCorrelationStrength = (value: number): string => {
    const absValue = Math.abs(value);
    if (absValue >= 0.7) return 'strong';
    if (absValue >= 0.3) return 'moderate';
    return 'weak';
  };

  const getCorrelationDirection = (value: number): string => {
    if (value > 0) return 'Positive';
    if (value < 0) return 'Negative';
    return 'No';
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 w-full max-w-sm sm:max-w-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Correlation Analysis</h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
        >
          ×
        </button>
      </div>

      {loading && (
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      )}

      {error && (
        <div className="text-red-500 mb-4">
          {error}
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700">
          Primary Field
        </label>
        <select
          value={primaryField}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onFieldChange(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          {layer.fields.map((field) => (
            <option key={field.name} value={field.name}>
              {field.alias}
            </option>
          ))}
        </select>
      </div>

      {onComparisonFieldChange && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">
            Comparison Field
          </label>
          <select
            value={comparisonField}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onComparisonFieldChange(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            {layer.fields.map((field) => (
              <option key={field.name} value={field.name}>
                {field.alias}
              </option>
            ))}
          </select>
        </div>
      )}

      {correlationResult && (
        <div className="mb-4">
          <h3 className="text-lg font-medium mb-2">Correlation Results</h3>
          
          {/* Pearson Correlation (always shown) */}
          <div className="mb-2">
            <div className="flex justify-between">
              <span className="font-medium">Pearson&apos;s r:</span>
              <span>{correlationResult.pearson.toFixed(3)}</span>
            </div>
            <div className="text-sm text-gray-600">
              {correlationResult.pearson !== undefined ? `${getCorrelationStrength(correlationResult.pearson)} ${getCorrelationDirection(correlationResult.pearson)} Correlation` : 'No Correlation'}
            </div>
          </div>

          {/* Additional Correlation Methods */}
          {correlationMethod === 'all' && (
            <>
              {correlationResult.spearman !== undefined && (
                <div className="mb-2">
                  <div className="flex justify-between">
                    <span className="font-medium">Spearman&apos;s ρ:</span>
                    <span>{correlationResult.spearman.toFixed(3)}</span>
                  </div>
                </div>
              )}
              {correlationResult.kendall !== undefined && (
                <div className="mb-2">
                  <div className="flex justify-between">
                    <span className="font-medium">Kendall&apos;s τ:</span>
                    <span>{correlationResult.kendall.toFixed(3)}</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Statistical Significance */}
          <div className="mb-2">
            <div className="flex justify-between">
              <span className="font-medium">p-value:</span>
              <span>{correlationResult.pValue.toFixed(4)}</span>
            </div>
          </div>

          {/* Spatial Statistics Results */}
          {includeSpatialStats && correlationResult.spatialStats && (
            <div className="mb-4">
              <h4 className="text-md font-medium mb-2">Spatial Statistics</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium">Moran&apos;s I:</div>
                  <div>{correlationResult.spatialStats.moransI.toFixed(3)}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">Getis-Ord G*:</div>
                  <div>{correlationResult.spatialStats.getisOrdG.toFixed(3)}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">Hot Spots:</div>
                  <div>{correlationResult.spatialStats.hotspots}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">Cold Spots:</div>
                  <div>{correlationResult.spatialStats.coldspots}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">Outliers:</div>
                  <div>{correlationResult.spatialStats.outliers}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Advanced Analysis Toggle */}
      <div className="mb-4">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-blue-600 hover:text-blue-800"
        >
          {showAdvanced ? 'Hide Advanced Analysis' : 'Show Advanced Analysis'}
        </button>
      </div>

      {showAdvanced && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Correlation Method
            </label>
            <select
              value={correlationMethod}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCorrelationMethod(e.target.value as any)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="pearson">Pearson</option>
              <option value="spearman">Spearman</option>
              <option value="kendall">Kendall</option>
              <option value="all">All Methods</option>
            </select>
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={includeSpatialStats}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIncludeSpatialStats(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">
                Include Spatial Statistics
              </span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}; 
