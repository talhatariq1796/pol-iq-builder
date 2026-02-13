import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Table } from 'lucide-react';
import { AnalysisResult } from '@/lib/analysis/types';
import { analysisFeatures } from '@/lib/analysis/analysisLens';
import { FieldMappingHelper } from '@/utils/visualizations/field-mapping-helper';

interface UnifiedDataTableProps {
  analysisResult: AnalysisResult;
  onExport: () => void;
}

export default function UnifiedDataTable({ analysisResult, onExport }: UnifiedDataTableProps) {
  const data = analysisResult?.data;
  // Prepare table data with only essential columns and filtered data
  const tableData = useMemo(() => {
    if (!data?.records || data.records.length === 0) {
      return { headers: [], rows: [], filteredCount: 0 };
    }

    // Filter out national parks from the data table
    const filteredRecords = analysisFeatures(data.records);

    // Create headers - only essential columns with human-readable names
    const headers = [
      'Area ID',
      'Area Name', 
      FieldMappingHelper.getFriendlyFieldName(data.targetVariable || 'score'),
      'Rank'
    ];

    // Create rows from filtered records - only essential data
    const rows = filteredRecords.map((record, index) => {
      const row = [
        record.area_id || '',
        record.area_name || '',
        record.value?.toFixed(2) || '',
        (record.rank || index + 1).toString()
      ];
      return row;
    });

    return { headers, rows, filteredCount: data.records.length - filteredRecords.length };
  }, [data]);

  const stats = useMemo(() => {
    if (!data?.statistics) return null;
    
    return [
      { label: 'Total Records', value: data.statistics.total },
      { label: 'Mean', value: data.statistics.mean?.toFixed(2) },
      { label: 'Median', value: data.statistics.median?.toFixed(2) },
      { label: 'Min', value: data.statistics.min?.toFixed(2) },
      { label: 'Max', value: data.statistics.max?.toFixed(2) },
      { label: 'Std Dev', value: data.statistics.stdDev?.toFixed(2) }
    ];
  }, [data?.statistics]);

  if (!data || !data.records || data.records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <Table className="w-12 h-12 mb-4" />
        <p className="text-sm">No data available to display</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with export button */}
      <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
        <div>
          <h3 className="text-sm font-semibold">Data Table</h3>
          <p className="text-xs theme-text-secondary">
            {tableData.rows.length} records • {tableData.headers.length} columns
          </p>
        </div>
        <Button onClick={onExport} size="sm" variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Statistics summary */}
      {stats && (
        <div className="p-4 theme-bg-secondary border-b dark:border-gray-700">
          <h4 className="text-xs font-semibold mb-2">Summary Statistics</h4>
          <div className="grid grid-cols-3 gap-4">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-xs theme-text-secondary">{stat.label}</div>
                <div className="text-xs font-mono">{stat.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="theme-bg-secondary sticky top-0">
            <tr>
              {tableData.headers.map((header, index) => (
                <th key={index} className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300 border-b dark:border-gray-700">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:theme-bg-secondary border-b dark:border-gray-700">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-3 py-2 theme-text-primary">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer with record count */}
      <div className="p-2 border-t dark:border-gray-700 theme-bg-secondary text-center">
        <span className="text-xs theme-text-secondary">
          Showing {tableData.rows.length} of {data.totalRecords || (tableData.rows.length + (tableData.filteredCount || 0))} records
          {(tableData.filteredCount || 0) > 0 && (
            <span className="ml-2 text-muted-foreground">({tableData.filteredCount} national parks filtered)</span>
          )}
        </span>
      </div>
    </div>
  );
}