import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BarChart, Download, TrendingUp, Info } from 'lucide-react';
import { AnalysisResult } from '@/lib/analysis/types';
import { FieldMappingHelper } from '@/utils/visualizations/field-mapping-helper';

interface UnifiedInsightsChartProps {
  analysisResult: AnalysisResult;
  onExportChart: () => void;
}

export default function UnifiedInsightsChart({ analysisResult, onExportChart }: UnifiedInsightsChartProps) {
  const data = analysisResult?.data;
  const featureImportanceData = useMemo(() => {
    if (!data?.featureImportance || data.featureImportance.length === 0) {
      return null;
    }

    // Filter to only show fields used in score calculation (exclude system fields)
    const scoreRelevantFields = data.featureImportance.filter(item => {
      const fieldName = item.feature || '';
      // Exclude system/metadata fields
      const systemFields = ['OBJECTID', 'ID', 'Shape__Area', 'Shape__Length', 'CreationDate', 'EditDate', 'Creator', 'Editor'];
      return !systemFields.includes(fieldName);
    });

    // Sort by importance and take top 10
    return scoreRelevantFields
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 10)
      .map(item => ({
        ...item,
        normalizedImportance: item.importance * 100, // Convert to percentage for display
        friendlyName: FieldMappingHelper.getFriendlyFieldName(item.feature || '')
      }));
  }, [data?.featureImportance]);

  const maxImportance = useMemo(() => {
    if (!featureImportanceData) return 0;
    return Math.max(...featureImportanceData.map(item => item.normalizedImportance));
  }, [featureImportanceData]);

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-full theme-text-secondary">
        <BarChart className="w-12 h-12 mb-4" />
        <p className="text-sm">No analysis data available</p>
      </div>
    );
  }

  if (!featureImportanceData) {
    return (
      <div className="flex flex-col h-full p-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-sm font-semibold">Feature Importance</h3>
            <p className="text-xs theme-text-secondary">Analysis insights and variable importance</p>
          </div>
        </div>
        
        <Alert className="mb-4">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Feature importance analysis is not available for this analysis type.
          </AlertDescription>
        </Alert>

      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
        <div>
          <h3 className="text-sm font-semibold">Feature Importance</h3>
          <p className="text-xs theme-text-secondary">
            Top {featureImportanceData.length} most important variables
          </p>
        </div>
        <Button onClick={onExportChart} size="sm" variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export Chart
        </Button>
      </div>

      {/* Chart content */}
      <div className="flex-1 p-4">
        <div className="space-y-3">
          {featureImportanceData.map((item, index) => (
            <div key={index} className="space-y-1">
              {/* Feature name and value */}
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium theme-text-primary">
                  {item.friendlyName || item.description || item.feature}
                </span>
                <span className="text-xs font-mono theme-text-secondary">
                  {item.normalizedImportance.toFixed(1)}%
                </span>
              </div>
              
              {/* Progress bar */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${(item.normalizedImportance / maxImportance) * 100}%`
                  }}
                />
              </div>
              
              {/* Rank indicator */}
              <div className="flex items-center gap-2">
                <span className="text-xs theme-text-secondary">#{index + 1}</span>
                {index === 0 && <TrendingUp className="w-3 h-3 text-green-500" />}
              </div>
            </div>
          ))}
        </div>

        {/* Summary info */}
        <div className="mt-6 p-3 theme-bg-secondary rounded-lg">
          <h4 className="text-xs font-semibold mb-2">Interpretation</h4>
          <p className="text-xs theme-text-secondary">
            Feature importance shows which variables have the strongest influence on predicting{' '}
            <strong>{FieldMappingHelper.getFriendlyFieldName(data.targetVariable || 'score')}</strong>. Higher values indicate greater predictive power.
          </p>
        </div>

      </div>
    </div>
  );
}