/**
 * VAN Exporter
 *
 * Exports canvassing data in VAN-compatible formats.
 * Supports walk list export, turf cutters, and result import.
 *
 * VAN (Voter Activation Network) is the industry-standard campaign software
 * for Democratic campaigns. This engine provides export/import compatibility.
 */

import type {
  CanvassingTurf,
  CanvassingUniverse,
  CanvassingPrecinct
} from './types';
import type { TurfAssignment } from './types-volunteer';
import type { CanvassingSession } from './types-progress';

/**
 * Standard VAN walk list row format
 */
export interface VANWalkListRow {
  // Standard VAN fields (voter identification)
  VoterFileVANID?: string;
  StateFileID?: string;
  FirstName?: string;
  LastName?: string;
  StreetAddress?: string;
  City?: string;
  State?: string;
  Zip5?: string;
  Age?: number;
  Gender?: string;
  Party?: string;
  Phone?: string;
  PrecinctName?: string;

  // Canvassing fields
  TurfName?: string;
  Priority?: number;

  // Custom fields (Political Landscape scores)
  GotvScore?: number;
  PersuasionScore?: number;
  TargetingStrategy?: string;

  // Index signature for CSV flexibility
  [key: string]: string | number | undefined;
}

/**
 * VAN result import row format
 */
export interface VANResultRow {
  VoterFileVANID: string;
  CanvassedDate: string;
  CanvassedTime?: string;
  ContactType: 'Door' | 'Phone' | 'Text';
  ResultCode: string; // e.g., 'Canvassed', 'Not Home', 'Refused', 'Moved'
  CanvasserName?: string;
  Notes?: string;

  // Survey responses (optional)
  SurveyQuestion1?: string;
  SurveyResponse1?: string;
  SurveyQuestion2?: string;
  SurveyResponse2?: string;
}

/**
 * Export options
 */
export interface ExportOptions {
  format: 'csv' | 'xlsx';
  includeCustomFields?: boolean;
  sortBy?: 'priority' | 'address' | 'precinct';
  maxRows?: number;
  filename?: string;
}

/**
 * Import result summary
 */
export interface ImportResult {
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  errors: Array<{ row: number; error: string }>;
  summary: {
    contacted: number;
    notHome: number;
    refused: number;
    moved: number;
    other: number;
  };
}

/**
 * VAN Exporter - Export canvassing data to VAN-compatible formats
 */
export class VANExporter {
  /**
   * Export walk list for a turf
   */
  static exportWalkList(
    turf: CanvassingTurf,
    precincts: CanvassingPrecinct[],
    options: ExportOptions = { format: 'csv' }
  ): { filename: string; content: string; mimeType: string } {
    // Build rows from precinct data
    const rows: VANWalkListRow[] = [];

    for (const precinct of precincts) {
      if (!turf.precinctIds.includes(precinct.precinctId)) {
        continue; // Only include precincts in this turf
      }

      // For now, we aggregate at precinct level
      // In production, this would be per-voter rows
      rows.push({
        PrecinctName: precinct.precinctName,
        TurfName: turf.turfName,
        Priority: precinct.priorityRank,
        GotvScore: Math.round(precinct.gotvPriority * 100),
        PersuasionScore: Math.round(precinct.persuasionOpportunity * 100),
        TargetingStrategy: precinct.targetingStrategy,
      });
    }

    // Sort rows
    this.sortRows(rows, options.sortBy || 'priority');

    // Limit rows
    if (options.maxRows && rows.length > options.maxRows) {
      rows.splice(options.maxRows);
    }

    // Generate filename
    const date = new Date().toISOString().split('T')[0];
    const filename = options.filename || `walklist_${turf.turfName}_${date}.csv`;

    // Generate content
    const columns = this.getVANColumns(options.includeCustomFields);
    const content = this.toCSV(rows, columns);

    return {
      filename,
      content,
      mimeType: options.format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv',
    };
  }

  /**
   * Export walk list for entire universe
   */
  static exportUniverseWalkList(
    universe: CanvassingUniverse,
    options: ExportOptions = { format: 'csv' }
  ): { filename: string; content: string; mimeType: string } {
    // Build rows from all precincts
    const rows: VANWalkListRow[] = universe.precincts.map(precinct => ({
      PrecinctName: precinct.precinctName,
      Priority: precinct.priorityRank,
      GotvScore: Math.round(precinct.gotvPriority * 100),
      PersuasionScore: Math.round(precinct.persuasionOpportunity * 100),
      TargetingStrategy: precinct.targetingStrategy,
    }));

    // Sort rows
    this.sortRows(rows, options.sortBy || 'priority');

    // Limit rows
    if (options.maxRows && rows.length > options.maxRows) {
      rows.splice(options.maxRows);
    }

    // Generate filename
    const date = new Date().toISOString().split('T')[0];
    const safeName = universe.name.replace(/[^a-z0-9_-]/gi, '_');
    const filename = options.filename || `universe_${safeName}_${date}.csv`;

    // Generate content
    const columns = this.getVANColumns(options.includeCustomFields);
    const content = this.toCSV(rows, columns);

    return {
      filename,
      content,
      mimeType: options.format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv',
    };
  }

  /**
   * Export turf assignments for volunteers
   */
  static exportAssignments(
    assignments: TurfAssignment[],
    turfs: CanvassingTurf[],
    options: ExportOptions = { format: 'csv' }
  ): { filename: string; content: string; mimeType: string } {
    const turfMap = new Map(turfs.map(t => [t.turfId, t]));

    const rows = assignments.map(assignment => {
      const turf = turfMap.get(assignment.turfId);
      return {
        AssignmentID: assignment.id,
        VolunteerID: assignment.volunteerId,
        TurfID: assignment.turfId,
        TurfName: turf?.turfName || '',
        UniverseID: assignment.universeId,
        Priority: assignment.priority,
        Status: assignment.status,
        AssignedAt: assignment.assignedAt,
        EstimatedDoors: turf?.estimatedDoors || 0,
        EstimatedHours: turf?.estimatedHours || 0,
        CompletionDate: assignment.expectedCompletionDate || '',
      };
    });

    // Sort by priority
    rows.sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.Priority as keyof typeof priorityOrder] -
             priorityOrder[b.Priority as keyof typeof priorityOrder];
    });

    // Generate filename
    const date = new Date().toISOString().split('T')[0];
    const filename = options.filename || `assignments_${date}.csv`;

    // Generate content
    const columns = [
      'AssignmentID', 'VolunteerID', 'TurfID', 'TurfName', 'UniverseID',
      'Priority', 'Status', 'AssignedAt', 'EstimatedDoors', 'EstimatedHours',
      'CompletionDate'
    ];
    const content = this.toCSV(rows, columns);

    return {
      filename,
      content,
      mimeType: options.format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv',
    };
  }

  /**
   * Generate VAN turf cutter file
   * (Defines geographic boundaries for turfs)
   */
  static generateTurfCutter(
    turfs: CanvassingTurf[],
    format: 'shapefile' | 'geojson' | 'kml' = 'geojson'
  ): { filename: string; content: string; mimeType: string } {
    if (format === 'geojson') {
      // Generate GeoJSON feature collection
      const featureCollection: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: turfs.map(turf => ({
          type: 'Feature',
          properties: {
            turfId: turf.turfId,
            turfName: turf.turfName,
            doors: turf.estimatedDoors,
            hours: turf.estimatedHours,
            priority: turf.priority,
            density: turf.density,
            avgGotv: Math.round(turf.avgGotvPriority * 100),
            avgPersuasion: Math.round(turf.avgPersuasionOpportunity * 100),
          },
          geometry: {
            type: 'Polygon',
            coordinates: [[
              // Placeholder - in production, compute actual boundaries
              [-84.5, 42.6],
              [-84.5, 42.7],
              [-84.4, 42.7],
              [-84.4, 42.6],
              [-84.5, 42.6],
            ]],
          },
        })),
      };

      const date = new Date().toISOString().split('T')[0];
      return {
        filename: `turf_cutter_${date}.geojson`,
        content: JSON.stringify(featureCollection, null, 2),
        mimeType: 'application/geo+json',
      };
    }

    // For shapefile and KML, return placeholder
    // In production, use libraries like 'shapefile' or 'tokml'
    throw new Error(`Format ${format} not yet implemented`);
  }

  /**
   * Parse VAN result import file
   */
  static parseResultsImport(
    csvContent: string
  ): { rows: VANResultRow[]; errors: string[] } {
    const errors: string[] = [];
    const parsedRows = this.parseCSV(csvContent);
    const rows: VANResultRow[] = [];

    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      const rowNum = i + 2; // Account for header

      // Validate required fields
      if (!row.VoterFileVANID) {
        errors.push(`Row ${rowNum}: Missing VoterFileVANID`);
        continue;
      }
      if (!row.CanvassedDate) {
        errors.push(`Row ${rowNum}: Missing CanvassedDate`);
        continue;
      }
      if (!row.ResultCode) {
        errors.push(`Row ${rowNum}: Missing ResultCode`);
        continue;
      }

      // Validate contact type
      const contactType = row.ContactType as VANResultRow['ContactType'];
      if (!['Door', 'Phone', 'Text'].includes(contactType)) {
        errors.push(`Row ${rowNum}: Invalid ContactType "${row.ContactType}"`);
        continue;
      }

      rows.push({
        VoterFileVANID: row.VoterFileVANID,
        CanvassedDate: row.CanvassedDate,
        CanvassedTime: row.CanvassedTime,
        ContactType: contactType,
        ResultCode: row.ResultCode,
        CanvasserName: row.CanvasserName,
        Notes: row.Notes,
        SurveyQuestion1: row.SurveyQuestion1,
        SurveyResponse1: row.SurveyResponse1,
        SurveyQuestion2: row.SurveyQuestion2,
        SurveyResponse2: row.SurveyResponse2,
      });
    }

    return { rows, errors };
  }

  /**
   * Import canvass results from VAN export
   */
  static importResults(
    rows: VANResultRow[],
    universeId: string
  ): ImportResult {
    const result: ImportResult = {
      totalRows: rows.length,
      successfulRows: 0,
      failedRows: 0,
      errors: [],
      summary: {
        contacted: 0,
        notHome: 0,
        refused: 0,
        moved: 0,
        other: 0,
      },
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // Account for header

      try {
        // Validate row
        const validation = this.validateImportRow(row as unknown as Record<string, string>);
        if (!validation.valid) {
          result.errors.push({
            row: rowNum,
            error: validation.errors.join(', '),
          });
          result.failedRows++;
          continue;
        }

        // Map result code to our internal format
        const status = this.mapResultCode(row.ResultCode);
        result.summary[status]++;

        // In production, would save to database/store
        // For now, just track counts
        result.successfulRows++;
      } catch (error) {
        result.errors.push({
          row: rowNum,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        result.failedRows++;
      }
    }

    return result;
  }

  /**
   * Convert our sessions to VAN result format
   */
  static sessionsToVANFormat(
    sessions: CanvassingSession[]
  ): VANResultRow[] {
    const rows: VANResultRow[] = [];

    for (const session of sessions) {
      // Create summary row for the session
      // In production, this would be per-voter contact
      rows.push({
        VoterFileVANID: `session_${session.id}`,
        CanvassedDate: new Date(session.startTime).toISOString().split('T')[0],
        CanvassedTime: new Date(session.startTime).toTimeString().split(' ')[0],
        ContactType: 'Door',
        ResultCode: 'Canvassed',
        CanvasserName: `Volunteer_${session.volunteerId}`,
        Notes: session.notes || '',
      });
    }

    return rows;
  }

  // ============================================================
  // Private Helper Methods
  // ============================================================

  /**
   * Generate CSV content from rows
   */
  private static toCSV(
    rows: Record<string, unknown>[],
    columns: string[]
  ): string {
    const lines: string[] = [];

    // Header row
    lines.push(columns.join(','));

    // Data rows
    for (const row of rows) {
      const values = columns.map(col => {
        const value = row[col];
        return this.escapeCSV(value);
      });
      lines.push(values.join(','));
    }

    return lines.join('\n');
  }

  /**
   * Escape CSV value
   */
  private static escapeCSV(value: unknown): string {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  /**
   * Parse CSV content to rows
   */
  private static parseCSV(content: string): Record<string, string>[] {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    // Parse header
    const headers = this.parseCSVLine(lines[0]);

    // Parse data rows
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      const row: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = values[j] || '';
      }
      rows.push(row);
    }

    return rows;
  }

  /**
   * Parse a single CSV line (handles quoted values)
   */
  private static parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    // Add last field
    values.push(current);

    return values;
  }

  /**
   * Map VAN result code to our internal format
   */
  private static mapResultCode(
    vanCode: string
  ): 'contacted' | 'notHome' | 'refused' | 'moved' | 'other' {
    const normalized = vanCode.toLowerCase().trim();

    // Contacted / Success
    if (['canvassed', 'contact made', 'contacted', 'success'].includes(normalized)) {
      return 'contacted';
    }

    // Not home
    if (['not home', 'nh', 'no answer'].includes(normalized)) {
      return 'notHome';
    }

    // Refused
    if (['refused', 'ref', 'do not contact'].includes(normalized)) {
      return 'refused';
    }

    // Moved
    if (['moved', 'bad address', 'wrong address'].includes(normalized)) {
      return 'moved';
    }

    // Everything else
    return 'other';
  }

  /**
   * Get standard VAN column headers
   */
  private static getVANColumns(includeCustom = false): string[] {
    const standard = [
      'VoterFileVANID',
      'StateFileID',
      'FirstName',
      'LastName',
      'StreetAddress',
      'City',
      'State',
      'Zip5',
      'Age',
      'Gender',
      'Party',
      'Phone',
      'PrecinctName',
      'TurfName',
      'Priority',
    ];

    if (includeCustom) {
      return [
        ...standard,
        'GotvScore',
        'PersuasionScore',
        'TargetingStrategy',
      ];
    }

    return standard;
  }

  /**
   * Validate import data row
   */
  private static validateImportRow(
    row: Record<string, string>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields
    if (!row.VoterFileVANID?.trim()) {
      errors.push('Missing VoterFileVANID');
    }
    if (!row.CanvassedDate?.trim()) {
      errors.push('Missing CanvassedDate');
    }
    if (!row.ResultCode?.trim()) {
      errors.push('Missing ResultCode');
    }

    // Date format validation
    if (row.CanvassedDate && !/^\d{4}-\d{2}-\d{2}$/.test(row.CanvassedDate)) {
      errors.push('Invalid date format (expected YYYY-MM-DD)');
    }

    // Contact type validation
    if (row.ContactType && !['Door', 'Phone', 'Text'].includes(row.ContactType)) {
      errors.push(`Invalid ContactType: ${row.ContactType}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Sort rows by specified field
   */
  private static sortRows(
    rows: VANWalkListRow[],
    sortBy: 'priority' | 'address' | 'precinct'
  ): void {
    switch (sortBy) {
      case 'priority':
        rows.sort((a, b) => (a.Priority || 999) - (b.Priority || 999));
        break;
      case 'address':
        rows.sort((a, b) => {
          const addrA = `${a.StreetAddress || ''} ${a.City || ''}`.toLowerCase();
          const addrB = `${b.StreetAddress || ''} ${b.City || ''}`.toLowerCase();
          return addrA.localeCompare(addrB);
        });
        break;
      case 'precinct':
        rows.sort((a, b) => {
          const precinctA = a.PrecinctName || '';
          const precinctB = b.PrecinctName || '';
          return precinctA.localeCompare(precinctB);
        });
        break;
    }
  }
}
