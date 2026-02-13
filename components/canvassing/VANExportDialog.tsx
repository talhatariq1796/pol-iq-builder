'use client';

import React, { useState, useEffect } from 'react';
import type {
  CanvassingUniverse,
  CanvassingTurf,
} from '@/lib/canvassing/types';

// Local types for the dialog
interface VANExportOptions {
  exportType: 'full' | 'turf' | 'results';
  turfId?: string;
  sortBy: 'priority' | 'address' | 'precinct';
  includeStandardColumns: boolean;
  includeCustomColumns: boolean;
  maxRows?: number;
}

interface VANValidationReport {
  isValid: boolean;
  errors: Array<{ field: string; message: string }>;
  warnings: Array<{ field: string; message: string }>;
  rowCount: number;
  totalRecords: number;
  missingVANIds: number;
  invalidPhones: number;
}
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  RadioGroup,
  RadioGroupItem,
} from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

interface VANExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  universe: CanvassingUniverse;
  turfs?: CanvassingTurf[];
}

type ExportType = 'full' | 'turf' | 'results';
type SortBy = 'priority' | 'address' | 'precinct';

export function VANExportDialog({
  open,
  onOpenChange,
  universe,
  turfs = [],
}: VANExportDialogProps) {
  const { toast } = useToast();
  const [exportType, setExportType] = useState<ExportType>('full');
  const [selectedTurfId, setSelectedTurfId] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortBy>('priority');
  const [includeStandardColumns, setIncludeStandardColumns] = useState(true);
  const [includeCustomColumns, setIncludeCustomColumns] = useState(false);
  const [maxRows, setMaxRows] = useState<number | undefined>(undefined);
  const [validationReport, setValidationReport] = useState<VANValidationReport | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setExportType('full');
      setSelectedTurfId('');
      setSortBy('priority');
      setIncludeStandardColumns(true);
      setIncludeCustomColumns(false);
      setMaxRows(undefined);
      setValidationReport(null);
      setPreview([]);
    }
  }, [open]);

  // Generate preview when options change
  useEffect(() => {
    if (!open) return;

    const generatePreview = async () => {
      try {
        // Generate a simple validation report
        const report: VANValidationReport = {
          isValid: true,
          errors: [],
          warnings: [],
          rowCount: universe.precincts.length,
          totalRecords: universe.precincts.length,
          missingVANIds: 0,
          invalidPhones: 0,
        };

        // Check for empty universe
        if (universe.precincts.length === 0) {
          report.isValid = false;
          report.errors.push({ field: 'universe', message: 'Universe has no precincts' });
        }

        // Check for selected turf if turf export
        if (exportType === 'turf' && !selectedTurfId) {
          report.isValid = false;
          report.errors.push({ field: 'turf', message: 'Please select a turf' });
        }

        setValidationReport(report);

        // Generate preview headers
        const headers = ['PrecinctID', 'PrecinctName', 'TotalVoters', 'Priority'];
        if (includeCustomColumns) {
          headers.push('GotvScore', 'PersuasionScore');
        }

        // Generate preview data (placeholder)
        const previewRows = [headers];
        const precinctsToShow = universe.precincts.slice(0, 5);
        for (const precinct of precinctsToShow) {
          previewRows.push([
            precinct.precinctId,
            precinct.precinctName,
            String(precinct.registeredVoters),
            String(precinct.gotvPriority || 1)
          ]);
        }
        setPreview(previewRows);
      } catch (error) {
        console.error('Preview generation failed:', error);
      }
    };

    generatePreview();
  }, [open, exportType, selectedTurfId, sortBy, includeStandardColumns, includeCustomColumns, universe, turfs]);

  const handleDownload = async () => {
    setIsGenerating(true);

    try {
      // Build headers
      const headers = ['PrecinctID', 'PrecinctName', 'TotalVoters', 'Priority'];
      if (includeCustomColumns) {
        headers.push('GotvScore', 'PersuasionScore');
      }

      // Build CSV rows
      const rows = [headers.join(',')];
      const precinctsToExport = maxRows ? universe.precincts.slice(0, maxRows) : universe.precincts;
      for (const precinct of precinctsToExport) {
        const row = [
          precinct.precinctId,
          precinct.precinctName,
          String(precinct.registeredVoters),
          String(precinct.gotvPriority || 1)
        ];
        if (includeCustomColumns) {
          row.push(String(precinct.gotvPriority), String(precinct.persuasionOpportunity));
        }
        rows.push(row.join(','));
      }
      const csvData = rows.join('\n');

      // Create download
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const filename = `van-export-${universe.id}-${Date.now()}.csv`;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Export Complete',
        description: `Downloaded ${filename} with ${precinctsToExport.length} precincts`,
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: 'Export Failed',
        description: error instanceof Error ? error.message : 'Failed to generate export file',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const hasBlockingErrors = validationReport && validationReport.errors.length > 0;
  const canExport = !hasBlockingErrors && preview.length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Export to VAN Format
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Export Type Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Export Type</Label>
            <RadioGroup value={exportType} onValueChange={(value: string) => setExportType(value as ExportType)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="full" id="export-full" />
                <Label htmlFor="export-full" className="font-normal cursor-pointer">
                  Full Universe
                  <span className="text-muted-foreground text-sm ml-2">
                    All precincts in universe
                  </span>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="turf" id="export-turf" />
                <Label htmlFor="export-turf" className="font-normal cursor-pointer">
                  Single Turf
                  <span className="text-muted-foreground text-sm ml-2">
                    Export specific turf assignment
                  </span>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="results" id="export-results" />
                <Label htmlFor="export-results" className="font-normal cursor-pointer">
                  Canvass Results
                  <span className="text-muted-foreground text-sm ml-2">
                    Completed contacts only
                  </span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Turf Selector */}
          {exportType === 'turf' && (
            <div className="space-y-2">
              <Label htmlFor="turf-select">Select Turf</Label>
              <Select value={selectedTurfId} onValueChange={setSelectedTurfId}>
                <SelectTrigger id="turf-select">
                  <SelectValue placeholder="Choose a turf..." />
                </SelectTrigger>
                <SelectContent>
                  {turfs.map((turf) => (
                    <SelectItem key={turf.turfId} value={turf.turfId}>
                      {turf.turfName} ({turf.precinctIds.length} precincts, {turf.estimatedDoors} doors)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Export Options */}
          <div className="space-y-4 border rounded-lg p-4">
            <h3 className="text-sm font-medium">Export Options</h3>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="standard-columns"
                  checked={includeStandardColumns}
                  onCheckedChange={(checked: boolean | 'indeterminate') => setIncludeStandardColumns(!!checked)}
                />
                <Label htmlFor="standard-columns" className="font-normal cursor-pointer">
                  Include standard VAN columns
                  <span className="text-muted-foreground text-xs ml-2">
                    (VAN ID, First Name, Last Name, Address, Phone)
                  </span>
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="custom-columns"
                  checked={includeCustomColumns}
                  onCheckedChange={(checked: boolean | 'indeterminate') => setIncludeCustomColumns(!!checked)}
                />
                <Label htmlFor="custom-columns" className="font-normal cursor-pointer">
                  Include custom columns
                  <span className="text-muted-foreground text-xs ml-2">
                    (Priority Score, Precinct, District, etc.)
                  </span>
                </Label>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="sort-by">Sort by</Label>
                  <Select value={sortBy} onValueChange={(value: string) => setSortBy(value as SortBy)}>
                    <SelectTrigger id="sort-by">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="priority">Priority Score</SelectItem>
                      <SelectItem value="address">Address (Street Order)</SelectItem>
                      <SelectItem value="precinct">Precinct Name</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1 space-y-2">
                  <Label htmlFor="max-rows">Max Rows (Optional)</Label>
                  <input
                    id="max-rows"
                    type="number"
                    min="1"
                    placeholder="All rows"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={maxRows ?? ''}
                    onChange={(e) => setMaxRows(e.target.value ? parseInt(e.target.value) : undefined)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Validation Report */}
          {validationReport && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Validation Report</Label>

              {validationReport.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium mb-1">Blocking Errors:</div>
                    <ul className="list-disc list-inside space-y-1">
                      {validationReport.errors.map((error, i) => (
                        <li key={i} className="text-sm">{error.message}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {validationReport.warnings.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium mb-1">Warnings:</div>
                    <ul className="list-disc list-inside space-y-1">
                      {validationReport.warnings.map((warning, i) => (
                        <li key={i} className="text-sm">{warning.message}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {validationReport.errors.length === 0 && validationReport.warnings.length === 0 && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-600">
                    No validation issues found. Ready to export.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline">
                  {validationReport.totalRecords.toLocaleString()} total records
                </Badge>
                {validationReport.missingVANIds > 0 && (
                  <Badge variant="secondary">
                    {validationReport.missingVANIds.toLocaleString()} missing VAN IDs
                  </Badge>
                )}
                {validationReport.invalidPhones > 0 && (
                  <Badge variant="secondary">
                    {validationReport.invalidPhones.toLocaleString()} invalid phones
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Preview */}
          {preview.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Preview (First 5 Rows)</Label>
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted">
                      <tr>
                        {preview[0]?.map((header, i) => (
                          <th key={i} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.slice(1).map((row, i) => (
                        <tr key={i} className="border-t">
                          {row.map((cell, j) => (
                            <td key={j} className="px-3 py-2 whitespace-nowrap">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Format Selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Format</Label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                disabled={!canExport}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                CSV
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                XLSX (Coming Soon)
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleDownload}
            disabled={!canExport || isGenerating}
          >
            <Download className="h-4 w-4 mr-2" />
            {isGenerating ? 'Generating...' : 'Download CSV'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
