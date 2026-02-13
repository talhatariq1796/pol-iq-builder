'use client';

/**
 * CSV Uploader Component
 *
 * Provides drag-and-drop CSV file upload with:
 * - File type validation
 * - Column auto-detection
 * - Field mapping interface
 * - Preview before import
 * - Progress indication
 */

import React, { useState, useCallback, useRef } from 'react';
import type {
  CSVColumn,
  CSVParseResult,
  ColumnMapping,
  CSVUploadConfig,
  CSVUploadResult,
} from '@/lib/export/types';

// ============================================================================
// Types
// ============================================================================

export interface CSVUploaderProps {
  onUpload: (result: CSVUploadResult) => void;
  config?: Partial<CSVUploadConfig>;
  expectedColumns?: string[];
  requiredColumns?: string[];
  className?: string;
  disabled?: boolean;
}

interface UploadState {
  status: 'idle' | 'parsing' | 'mapping' | 'importing' | 'complete' | 'error';
  file: File | null;
  parseResult: CSVParseResult | null;
  mappings: ColumnMapping[];
  error: string | null;
  progress: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: CSVUploadConfig = {
  expectedColumns: [],
  requiredColumns: [],
  autoDetectMapping: true,
  validateOnParse: true,
  maxRows: 100000,
  maxFileSize: 50 * 1024 * 1024, // 50MB
};

// Common political data field mappings
const FIELD_SUGGESTIONS: Record<string, string[]> = {
  precinct_id: ['precinct', 'precinctid', 'precinct_id', 'pct', 'pctid'],
  precinct_name: ['precinctname', 'precinct_name', 'pct_name', 'name'],
  jurisdiction: ['jurisdiction', 'city', 'township', 'municipality'],
  voter_id: ['voterid', 'voter_id', 'vanid', 'id'],
  first_name: ['firstname', 'first_name', 'fname', 'first'],
  last_name: ['lastname', 'last_name', 'lname', 'last'],
  address: ['address', 'street', 'streetaddress', 'addr'],
  zip: ['zip', 'zipcode', 'zip_code', 'postal'],
  party: ['party', 'party_affiliation', 'partycode'],
  score: ['score', 'priority', 'rank', 'rating'],
};

// ============================================================================
// CSV Uploader Component
// ============================================================================

export function CSVUploader({
  onUpload,
  config: userConfig,
  expectedColumns = [],
  requiredColumns = [],
  className = '',
  disabled = false,
}: CSVUploaderProps) {
  const config = { ...DEFAULT_CONFIG, ...userConfig, expectedColumns, requiredColumns };
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<UploadState>({
    status: 'idle',
    file: null,
    parseResult: null,
    mappings: [],
    error: null,
    progress: 0,
  });

  const [isDragging, setIsDragging] = useState(false);

  // --------------------------------------------------------------------------
  // File Handling
  // --------------------------------------------------------------------------

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [disabled]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
    },
    []
  );

  const handleFile = useCallback(
    async (file: File) => {
      // Validate file type
      if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
        setState((s: UploadState) => ({
          ...s,
          status: 'error',
          error: 'Please upload a CSV file',
        }));
        return;
      }

      // Validate file size
      if (config.maxFileSize && file.size > config.maxFileSize) {
        setState((s: UploadState) => ({
          ...s,
          status: 'error',
          error: `File too large. Maximum size: ${Math.round(config.maxFileSize! / 1024 / 1024)}MB`,
        }));
        return;
      }

      setState((s: UploadState) => ({
        ...s,
        status: 'parsing',
        file,
        error: null,
        progress: 10,
      }));

      try {
        const parseResult = await parseCSV(file, config);

        // Auto-detect mappings
        const mappings = config.autoDetectMapping
          ? autoDetectMappings(parseResult.columns, config.expectedColumns)
          : [];

        setState((s: UploadState) => ({
          ...s,
          status: 'mapping',
          parseResult,
          mappings,
          progress: 50,
        }));
      } catch (error) {
        setState((s: UploadState) => ({
          ...s,
          status: 'error',
          error: error instanceof Error ? error.message : 'Failed to parse CSV',
        }));
      }
    },
    [config]
  );

  // --------------------------------------------------------------------------
  // Mapping Handlers
  // --------------------------------------------------------------------------

  const updateMapping = useCallback((sourceColumn: string, targetField: string) => {
    setState((s: UploadState) => {
      const existingIndex = s.mappings.findIndex((m) => m.sourceColumn === sourceColumn);
      const newMappings = [...s.mappings];

      if (existingIndex >= 0) {
        if (targetField) {
          newMappings[existingIndex] = { sourceColumn, targetField };
        } else {
          newMappings.splice(existingIndex, 1);
        }
      } else if (targetField) {
        newMappings.push({ sourceColumn, targetField });
      }

      return { ...s, mappings: newMappings };
    });
  }, []);

  const handleImport = useCallback(async () => {
    if (!state.parseResult) return;

    setState((s: UploadState) => ({ ...s, status: 'importing', progress: 75 }));

    try {
      // Validate required columns are mapped
      const mappedFields = state.mappings.map((m) => m.targetField);
      const missingRequired = config.requiredColumns.filter(
        (col) => !mappedFields.includes(col)
      );

      if (missingRequired.length > 0) {
        throw new Error(`Missing required fields: ${missingRequired.join(', ')}`);
      }

      // Transform data using mappings
      const transformedData = transformData(
        state.parseResult.previewRows,
        state.mappings
      );

      const result: CSVUploadResult = {
        success: true,
        totalRows: state.parseResult.rowCount,
        validRows: transformedData.length,
        invalidRows: state.parseResult.rowCount - transformedData.length,
        mappedFields,
        data: transformedData,
      };

      setState((s: UploadState) => ({ ...s, status: 'complete', progress: 100 }));
      onUpload(result);
    } catch (error) {
      setState((s: UploadState) => ({
        ...s,
        status: 'error',
        error: error instanceof Error ? error.message : 'Import failed',
      }));
    }
  }, [state.parseResult, state.mappings, config.requiredColumns, onUpload]);

  const reset = useCallback(() => {
    setState({
      status: 'idle',
      file: null,
      parseResult: null,
      mappings: [],
      error: null,
      progress: 0,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className={`csv-uploader ${className}`}>
      {/* Drop Zone */}
      {state.status === 'idle' && (
        <div
          className={`
            border-2 border-dashed rounded-lg p-8 text-center transition-colors
            ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-blue-400'}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileSelect}
            disabled={disabled}
          />

          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>

          <p className="mt-2 text-sm text-gray-600">
            Drag and drop a CSV file, or click to select
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Maximum file size: {Math.round((config.maxFileSize || 0) / 1024 / 1024)}MB
          </p>
        </div>
      )}

      {/* Parsing State */}
      {state.status === 'parsing' && (
        <div className="text-center py-8">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-sm text-gray-600">Parsing {state.file?.name}...</p>
        </div>
      )}

      {/* Mapping Interface */}
      {state.status === 'mapping' && state.parseResult && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Map Columns</h3>
              <p className="text-sm text-gray-500">
                {state.parseResult.rowCount.toLocaleString()} rows detected
              </p>
            </div>
            <button
              onClick={reset}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>

          {/* Column Mapping Table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    CSV Column
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Sample Values
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Map To
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {state.parseResult.columns.map((column) => (
                  <tr key={column.name}>
                    <td className="px-4 py-2 text-sm font-medium text-gray-900">
                      {column.name}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500 truncate max-w-xs">
                      {column.sampleValues.slice(0, 3).join(', ')}
                    </td>
                    <td className="px-4 py-2">
                      <select
                        className="block w-full rounded-md border-gray-300 shadow-sm text-sm"
                        value={
                          state.mappings.find((m) => m.sourceColumn === column.name)
                            ?.targetField || ''
                        }
                        onChange={(e) => updateMapping(column.name, e.target.value)}
                      >
                        <option value="">-- Skip --</option>
                        {config.expectedColumns.map((field) => (
                          <option key={field} value={field}>
                            {field}
                            {config.requiredColumns.includes(field) ? ' *' : ''}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Preview */}
          {state.parseResult.previewRows.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Preview (first 5 rows)</h4>
              <div className="overflow-x-auto border rounded">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {Object.keys(state.parseResult.previewRows[0]).map((key) => (
                        <th key={key} className="px-2 py-1 text-left">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {state.parseResult.previewRows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-t">
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="px-2 py-1 truncate max-w-xs">
                            {val}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import Button */}
          <div className="flex justify-end gap-2">
            <button
              onClick={reset}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
            >
              Import {state.parseResult.rowCount.toLocaleString()} Rows
            </button>
          </div>
        </div>
      )}

      {/* Importing State */}
      {state.status === 'importing' && (
        <div className="text-center py-8">
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${state.progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-600">Importing data...</p>
        </div>
      )}

      {/* Complete State */}
      {state.status === 'complete' && (
        <div className="text-center py-8">
          <svg
            className="mx-auto h-12 w-12 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <p className="mt-2 text-sm text-gray-600">Import complete!</p>
          <button
            onClick={reset}
            className="mt-4 text-sm text-blue-600 hover:text-blue-800"
          >
            Upload another file
          </button>
        </div>
      )}

      {/* Error State */}
      {state.status === 'error' && (
        <div className="text-center py-8">
          <svg
            className="mx-auto h-12 w-12 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="mt-2 text-sm text-red-600">{state.error}</p>
          <button
            onClick={reset}
            className="mt-4 text-sm text-blue-600 hover:text-blue-800"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

async function parseCSV(
  file: File,
  config: CSVUploadConfig
): Promise<CSVParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).filter((line) => line.trim());

        if (lines.length === 0) {
          throw new Error('CSV file is empty');
        }

        // Parse header
        const headerLine = lines[0];
        const headers = parseCSVLine(headerLine);

        // Parse rows
        const rows: Record<string, string>[] = [];
        const maxRows = Math.min(lines.length - 1, config.maxRows || Infinity);

        for (let i = 1; i <= maxRows; i++) {
          if (!lines[i]) continue;
          const values = parseCSVLine(lines[i]);
          const row: Record<string, string> = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          rows.push(row);
        }

        // Build column info
        const columns: CSVColumn[] = headers.map((name, index) => ({
          name,
          index,
          sampleValues: rows.slice(0, 10).map((r) => r[name]).filter(Boolean),
          inferredType: inferType(rows.slice(0, 100).map((r) => r[name])),
        }));

        resolve({
          success: true,
          columns,
          rowCount: lines.length - 1,
          previewRows: rows,
        });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }

  result.push(current.trim());
  return result;
}

function inferType(values: string[]): 'string' | 'number' | 'date' | 'boolean' | 'unknown' {
  const nonEmpty = values.filter((v) => v.trim());
  if (nonEmpty.length === 0) return 'unknown';

  // Check for numbers
  const allNumbers = nonEmpty.every((v) => !isNaN(Number(v)));
  if (allNumbers) return 'number';

  // Check for booleans
  const booleans = ['true', 'false', 'yes', 'no', '1', '0'];
  const allBooleans = nonEmpty.every((v) => booleans.includes(v.toLowerCase()));
  if (allBooleans) return 'boolean';

  // Check for dates
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/,
    /^\d{2}\/\d{2}\/\d{4}$/,
    /^\d{2}-\d{2}-\d{4}$/,
  ];
  const allDates = nonEmpty.every((v) =>
    datePatterns.some((pattern) => pattern.test(v))
  );
  if (allDates) return 'date';

  return 'string';
}

function autoDetectMappings(
  columns: CSVColumn[],
  expectedFields: string[]
): ColumnMapping[] {
  const mappings: ColumnMapping[] = [];

  for (const column of columns) {
    const normalizedName = column.name.toLowerCase().replace(/[^a-z0-9]/g, '');

    for (const field of expectedFields) {
      const suggestions = FIELD_SUGGESTIONS[field] || [field.toLowerCase()];
      if (suggestions.some((s) => normalizedName.includes(s.replace(/[^a-z0-9]/g, '')))) {
        mappings.push({ sourceColumn: column.name, targetField: field });
        break;
      }
    }
  }

  return mappings;
}

function transformData(
  rows: Record<string, string>[],
  mappings: ColumnMapping[]
): Record<string, unknown>[] {
  return rows.map((row) => {
    const transformed: Record<string, unknown> = {};

    for (const mapping of mappings) {
      const value = row[mapping.sourceColumn];

      switch (mapping.transform) {
        case 'uppercase':
          transformed[mapping.targetField] = value?.toUpperCase();
          break;
        case 'lowercase':
          transformed[mapping.targetField] = value?.toLowerCase();
          break;
        case 'number':
          transformed[mapping.targetField] = value ? Number(value) : null;
          break;
        case 'date':
          transformed[mapping.targetField] = value ? new Date(value).toISOString() : null;
          break;
        default:
          transformed[mapping.targetField] = value;
      }
    }

    return transformed;
  });
}

export default CSVUploader;
